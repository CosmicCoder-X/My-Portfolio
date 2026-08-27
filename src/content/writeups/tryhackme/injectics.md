---
title: 'Injectics'
target: 'TryHackMe — Injectics'
difficulty: 'medium'
date: 2025-08-27
summary: 'A sports-themed web application vulnerable to SQL injection and Server-Side Template Injection. Client-side SQL filters are bypassed with URL encoding and Burp Suite, a DROP TABLE destroys the users table to trigger default credential restoration, and Twig SSTI in the admin profile page escalates to remote code execution.'
role: 'appsec'
tags: ['sql-injection', 'ssti', 'twig', 'burp-suite', 'gobuster', 'nmap', 'client-side-bypass', 'web-exploitation', 'template-injection', 'privilege-escalation']
problem: 'A web application called Injectics 2024 runs on port 80 with login functionality for both developers and administrators. The login form has SQL injection protections, and the goal is to bypass them, escalate to admin access, and find the flags hidden on the server.'
action: 'Enumerated the application with Nmap and Gobuster, discovered a mail.log file containing default credentials and a credential-restoration cron job. Bypassed client-side SQL filters using URL-encoded payloads through Burp Suite, logged in as the dev user, then used a DROP TABLE injection in the leaderboard editor to trigger the credential restoration service. Logged in as admin with the default credentials, identified Twig SSTI in the profile first name field, and escalated to remote code execution to find and read the final flag.'
outcome: 'Retrieved both flags: THM{INJECTICS_ADMIN_PANEL_007} from the admin dashboard and THM{5735172b6c147f4dd649872f73e0fdea} via Twig SSTI command execution. Documented the full chain from SQL injection bypass through SSTI to RCE.'
draft: false
---

## Reconnaissance

### Nmap scan

Starting with a service scan against the target:

```
nmap -sS -sV 10.48.132.170
```

![Nmap scan results — port 22 running OpenSSH 8.2p1 Ubuntu, port 80 running Apache httpd 2.4.41 on Ubuntu.](/writeups/thm-injectics/01-nmap-scan.png)

Two ports open: **SSH on 22** and **HTTP on 80**. The web server is Apache 2.4.41 on Ubuntu — a standard LAMP-style setup.

### The web application

Browsing to port 80 reveals **Injectics 2024**, a sports event tracking site with navigation links for Home, Events, Athletes, Medals, Contact, and Login. Only Home and Login are functional — the rest are static.

![The Injectics 2024 homepage — a sports-themed landing page with "Catch all the action and track the performance of your favorite athletes and teams."](/writeups/thm-injectics/02-injectics-homepage.png)

### Directory enumeration

Running Gobuster with a broad set of extensions to catch anything useful:

```
gobuster dir -w /usr/share/wordlists/SecLists/Discovery/Web-Content/directory-list-2.3-medium.txt -x html,js,txt,log,php,db,json -u http://10.48.132.170
```

![Gobuster results — /index.php, /login.php, /mail.log, /flags, /css, /js, /logout.php, /script.js, /dashboard.php, /functions.php among others.](/writeups/thm-injectics/03-gobuster-enumeration.png)

Several interesting results: `/mail.log`, `/flags`, `/script.js`, `/dashboard.php`, and `/functions.php`. The `/mail.log` file stands out immediately — log files exposed on a web server often contain sensitive information.

### The mail log — default credentials

Opening `/mail.log` reveals an internal email from the dev team to the superadmin:

![mail.log contents — an email from dev@injectics.thm to superadmin@injectics.thm describing a service called Injectics that monitors the database and automatically inserts default credentials into the users table if it is deleted or corrupted. Default credentials listed: superadmin@injectics.thm / superSecurePasswd101 and dev@injectics.thm / devPasswd123.](/writeups/thm-injectics/04-mail-log-credentials.png)

This is a goldmine. The email explains that a service runs every minute and automatically inserts default credentials into the `users` table if it gets deleted or corrupted. The credentials are right there in the email: `superadmin@injectics.thm` / `superSecurePasswd101` and `dev@injectics.thm` / `devPasswd123`. This means if the users table can be destroyed via SQL injection, the service will restore it with known credentials — including the admin account.

---

## SQL injection — bypassing client-side filters

### Testing the login form

The login page has fields for email and password plus a separate "Login as Admin" button. Attempting a basic SQL injection payload returns "Invalid email or password":

![Login form showing "Invalid email or password" error after submitting the payload a%27 || 1=1 -- in the email field.](/writeups/thm-injectics/05-login-sqli-blocked.png)

The injection is being blocked. Checking the page source and `script.js` reveals why — the application has **client-side filtering** that strips common SQL injection keywords and characters: `or`, `and`, `union`, `select`, single quotes (`'`), and double quotes (`"`).

### Bypassing with URL encoding and Burp Suite

Since the filter is client-side only, it can be bypassed entirely by intercepting the request after it leaves the browser. The key substitutions: `'` becomes `%27`, and `OR` becomes `||` (which isn't in the blocklist). The final payload:

```
username=a%27 || 1=1 -- &password=www&function=login
```

Sending this through Burp Suite's Repeater directly to `/functions.php`:

![Burp Suite request and response — POST to /functions.php with the SQL injection payload in the body. Response shows {"status":"success","message":"Login successful","is_admin":"true","first_name":"dev","last_name":"dev","redirect_link":"dashboard.php?isadmin=false"}.](/writeups/thm-injectics/06-burp-sqli-bypass.png)

The server responds with `"Login successful"` — the SQL filter is purely client-side and does nothing on the backend. The response confirms the injection worked and redirects to the dashboard.

---

## Privilege escalation — DROP TABLE to admin

### The leaderboard editor

After logging in as the dev user, the dashboard shows a medals leaderboard with an **Edit** button on each row. The leaderboard data is submitted via POST to `/edit_leaderboard.php` with parameters for rank, country, gold, silver, and bronze. This is another injection point.

### Dropping the users table

The plan: inject a `DROP TABLE users` statement into one of the leaderboard fields, which will destroy the users table. The credential-restoration service described in the mail log runs every minute, so within 60 seconds it will recreate the table with the default admin credentials.

Capturing the edit request in Burp Suite and appending the injection:

![Burp Suite request — POST to /edit_leaderboard.php with the payload rank=1&country=&gold=22; DROP TABLE users -- &silver=21&bronze=45454.](/writeups/thm-injectics/07-burp-drop-table.png)

The `gold` parameter carries the injection: `22; DROP TABLE users --`. The semicolon terminates the legitimate UPDATE statement, the DROP TABLE destroys the users table, and the comment marker (`--`) neutralises the rest of the query.

### Logging in as admin

After waiting for the restoration service to run, logging in with the default admin credentials from the mail log (`superadmin@injectics.thm` / `superSecurePasswd101`) works:

![Admin dashboard — "Welcome, admin!" with the flag THM{INJECTICS_ADMIN_PANEL_007} displayed above the medals leaderboard.](/writeups/thm-injectics/08-admin-dashboard-flag.png)

The first flag drops immediately on the admin dashboard:

```
THM{INJECTICS_ADMIN_PANEL_007}
```

---

## Server-Side Template Injection — from admin to RCE

### Identifying the template engine

The admin panel has a **Profile** page that the dev account didn't have. The Update Profile form takes an email, first name, and last name — and the first name is reflected directly on the dashboard's welcome message. That's a potential SSTI vector.

Testing with the classic detection payload `{{7*'7'}}` in the First Name field:

![Update Profile form — email set to superadmin@injectics.thm, First Name set to {{7*'7'}}, Last Name set to mxgd.](/writeups/thm-injectics/09-ssti-test-payload.png)

After submitting, the dashboard displays:

![Admin dashboard showing "Welcome, 49!" — confirming the template engine evaluated 7*7=49.](/writeups/thm-injectics/10-ssti-twig-confirmed.png)

The greeting now reads **"Welcome, 49!"** — the template engine evaluated `7*'7'` as `49`. If this were Django/Jinja2, the result would have been `7777777` (string repetition). The integer multiplication confirms the engine is **Twig** (PHP).

### Escalating to command execution

With Twig confirmed, the next step is a code execution payload. Using the `passthru` function through Twig's filter syntax to search for flag files on the server:

![Update Profile form — First Name set to {{['find / -type f -name "*.txt" 2>/dev/null',"]|sort('passthru')}}.](/writeups/thm-injectics/11-ssti-find-payload.png)

The payload uses Twig's `sort` filter with `passthru` as the comparison function, which tricks PHP into executing the array element as a shell command. After submitting, the dashboard reveals the final flag:

![Admin dashboard showing "Welcome, THM{5735172b6c147f4dd649872f73e0fdea} Array!" — the flag retrieved via SSTI command execution.](/writeups/thm-injectics/12-final-flag.png)

```
THM{5735172b6c147f4dd649872f73e0fdea}
```

---

## What I took from this

The most interesting part of this room was the privilege escalation strategy. Instead of trying to crack the admin password or find a direct authentication bypass, the attack exploited the application's own resilience mechanism against it — the credential-restoration service that was meant to be a safety net became the attack vector. Dropping the users table forced the service to recreate it with known default credentials, turning a defensive feature into a backdoor. The other takeaway is about client-side validation: the SQL injection filter in `script.js` gave a false sense of security while the server accepted raw input without any sanitisation. Every filter that matters needs to live server-side — client-side checks are a UX convenience, not a security boundary.
