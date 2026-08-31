---
title: 'Soulmate'
target: 'Hack The Box — Soulmate'
difficulty: 'easy'
date: 2025-09-15
summary: 'An HTB machine — scanning with nmap to find SSH (22) and nginx (80) redirecting to soulmate.htb, discovering a dating app with registration and a CrushFTP v11.3.0 instance on ftp.soulmate.htb, exploiting CVE-2025-31161 (CrushFTP authentication bypass) to create an admin user, changing ben''s password through the User Manager, uploading a PHP webshell to webProd/assets/ for a reverse shell as www-data, finding an Erlang start.escript with hardcoded credentials for ben (HouseH0ldings998), SSH-ing in as ben, then escalating to root via an Erlang OTP SSH daemon on port 2222 — connecting with ben''s credentials drops into an Eshell running as root where os:cmd() gives full command execution.'
role: 'pentest'
tags: ['nmap', 'crushftp', 'cve-2025-31161', 'authentication-bypass', 'php-webshell', 'reverse-shell', 'erlang', 'ssh', 'hardcoded-credentials', 'password-reuse', 'privilege-escalation']
problem: 'Soulmate is an easy-rated Linux machine running SSH (22) and nginx (80) serving a dating application at soulmate.htb. A CrushFTP v11.3.0 instance runs on ftp.soulmate.htb and is vulnerable to CVE-2025-31161, an authentication bypass that allows arbitrary user creation. The CrushFTP admin panel exposes a User Manager where existing users'' passwords can be changed, and ben''s VFS includes a webProd directory mapped to the web root. An Erlang start.escript on the system contains hardcoded SSH credentials, and an Erlang OTP SSH daemon running on port 2222 as root provides direct command execution through the Eshell.'
action: 'Ran nmap with service version detection against the target — 22/tcp (OpenSSH 8.9p1 Ubuntu) and 80/tcp (nginx 1.18.0 redirecting to http://soulmate.htb/). Added soulmate.htb to /etc/hosts. The main site is a dating application called Soulmate with a registration page. Subdomain enumeration found ftp.soulmate.htb hosting CrushFTP v11.3.0 Build 2. Researched CVE-2025-31161 — an authentication bypass in CrushFTP that allows unauthenticated user creation. Ran the PoC exploit to create user qwe with password qwerty on ftp.soulmate.htb. Logged into the CrushFTP web interface as qwe, which had admin access to the User Manager showing users ben, crushadmin, default, jenna, and TempAccount. Changed ben''s password through the admin panel. Logged in as ben — the VFS showed three folders in User''s Stuff: IT, ben, and webProd. Navigated to webProd/assets/ and uploaded simple.php (a PHP webshell, 194 bytes). Triggered the webshell and caught a reverse shell on a netcat listener as uid=33(www-data). Enumerated running processes — found an Erlang process running start.escript at /usr/local/lib/erlang_login/start.escript. Read the script — it contained hardcoded credentials {user_passwords, [{"ben", "HouseH0ldings998"}]} and configured an SSH daemon on port 2222 with publickey and password authentication. Confirmed port 2222 was listening locally (ss -tulpn showed 127.0.0.1:2222), and connecting with nc showed SSH-2.0-Erlang/5.2.9. SSH-ed to port 2222 as ben with password HouseH0ldings998 — dropped into Eshell V15.2.5 (ssh_runner@soulmate). Listed available modules to confirm the environment. Ran os:cmd(''id'') — returned uid=0(root) gid=0(root), confirming the Erlang SSH daemon runs as root. Retrieved the root flag.'
outcome: 'Gained root access to the machine. The attack chain was CrushFTP authentication bypass (CVE-2025-31161) for admin access, PHP webshell upload through the CrushFTP file manager for initial shell as www-data, hardcoded Erlang SSH credentials for lateral movement to ben, and Erlang OTP SSH daemon running as root for privilege escalation.'
draft: false
---

## Background

Soulmate is an easy-rated Linux machine running a dating application behind nginx and a CrushFTP instance on a separate virtual host. The attack chain moves through three distinct services — an authentication bypass in CrushFTP provides admin access to a file manager that reaches the web root, a PHP webshell uploaded through that file manager gives a foothold as www-data, hardcoded credentials in an Erlang script provide SSH access as a real user, and an Erlang OTP SSH daemon running as root turns that user access into full system compromise. The box is a straightforward demonstration of how hardcoded credentials and services running as root without isolation create simple escalation paths.

---

## Enumeration

An nmap scan against the target reveals two open ports — 22/tcp running OpenSSH 8.9p1 and 80/tcp running nginx 1.18.0 with a redirect to `http://soulmate.htb/`.

![Nmap scan output showing nmap -sVC 10.10.11.86 with host up at 1.0s latency, 998 closed tcp ports, port 22/tcp open ssh OpenSSH 8.9p1 Ubuntu 3ubuntu0.13 with ECDSA and ED25519 host keys, port 80/tcp open http nginx 1.18.0 Ubuntu with http-title Did not follow redirect to http://soulmate.htb/ and http-server-header nginx/1.18.0 Ubuntu, Service Info OS Linux.](/writeups/htb-soulmate/01-nmap-scan.png)

After adding `soulmate.htb` to `/etc/hosts`, the main site loads as a dating application called **Soulmate** with a registration page offering fields for username, full name, password, bio, and an optional profile picture.

![Soulmate registration page showing a pink heart logo, Join Soulmate heading, Create your account and start your love journey subtitle, fields for Username (asd), Full Name (assd), Password and Confirm Password (filled with dots), Tell us about yourself textarea (asd), Profile Picture Optional with Browse button showing No file selected, Upload a photo to make your profile stand out text, and a pink Create Account button with Already have an account Sign in here link.](/writeups/htb-soulmate/02-soulmate-register.png)

Subdomain enumeration discovers `ftp.soulmate.htb` — a CrushFTP instance running version 11.3.0 Build 2.

---

## CVE-2025-31161 — CrushFTP authentication bypass

CVE-2025-31161 is an authentication bypass vulnerability in CrushFTP that allows unauthenticated attackers to create arbitrary user accounts. Running the public PoC exploit against `ftp.soulmate.htb` creates a new user with admin-level access:

```bash
python3 cve-2025-31161.py --target_host ftp.soulmate.htb --port 80 --target_user root --new_user qwe --password qwerty
```

![Terminal showing python3 cve-2025-31161.py execution with Preparing Payloads, Warming up the target, Target is up and running, Sending Account Create Request, User created successfully, Exploit Complete you can now login with Username qwe Password qwerty.](/writeups/htb-soulmate/03-crushftp-exploit.png)

The exploit creates user `qwe` with password `qwerty`. Logging into the CrushFTP web interface with these credentials:

![CrushFTP login page with dark background, CrushFTP logo with fist icon, Username Or Email field containing qwe, Password field filled with dots, Remember me checkbox unchecked, Forgot your password link, and orange Sign in button.](/writeups/htb-soulmate/04-crushftp-login.png)

---

## Admin access and password change

The newly created user has access to the CrushFTP **User Manager** — an admin panel listing all users on the system. The user list shows ben, crushadmin, default, jenna, and TempAccount. Selecting ben's account reveals his VFS (Virtual File System) configuration: the Server's Files side shows the full filesystem (`/`), and the User's Stuff side shows three folders — ben, IT, and webProd.

![CrushFTP admin User Manager at ftp.soulmate.htb/WebInterface/UserManager/index.html, Version 11.3.0 Build 2, showing user list with ben selected, crushadmin, default, jenna, TempAccount. User Settings for ben showing Account Enabled checked, Last login 08/13/2025, User name ben, Password field with dots. VFS tab showing Server Files with full filesystem directories (app, bin, dev, etc, home, lib, lib64, opt, proc, root, run, sbin) and User Stuff with folders ben, IT, webProd. Permissions showing Download and View checked, Upload unchecked.](/writeups/htb-soulmate/05-user-manager.png)

The `webProd` folder is particularly interesting — it's likely mapped to the web application's document root. Changing ben's password through the admin panel and logging in as ben confirms access to these three folders.

![CrushFTP file browser logged in as Ben showing Home directory with three folders: IT (1 Items), ben (1 Items), and webProd (1 Items), all with Last Modified date 09/14/2025 14:40:43.556.](/writeups/htb-soulmate/06-ben-files.png)

---

## Webshell upload and reverse shell

Navigating into `webProd/assets/` reveals subdirectories for `css` and `images` — this is the web application's static assets directory. Uploading a simple PHP webshell (`simple.php`, 194 bytes) through the CrushFTP file manager:

![CrushFTP file browser at Home > webProd > assets showing Files To Upload dialog with simple.php (194.0 B) queued for upload to /webProd/assets/ path, with Add files, Upload, Cancel, Overwrite All, Resume All, Share Uploaded, and Remove buttons. Background shows css and images subdirectories.](/writeups/htb-soulmate/07-php-upload.png)

With the webshell uploaded to the web root's assets directory, triggering it and catching the reverse shell on a netcat listener:

```bash
nc -nvlp 4444
```

![Terminal showing nc -nvlp 4444 listening on any 4444, connection received from 10.10.11.86 port 47308, id and whoami output showing uid=33(www-data) gid=33(www-data) groups=33(www-data).](/writeups/htb-soulmate/08-reverse-shell.png)

A shell as `www-data`. The user flag is accessible from here.

---

## Lateral movement — Erlang hardcoded credentials

Enumerating running processes reveals an interesting Erlang process. The `ps aux` output shows an Erlang VM running `start.escript` with an `-extra` flag pointing to `/usr/local/lib/erlang_login/start.escript` — highlighted in the process list alongside the usual nginx, php-fpm, cron, and a `clean-web.sh` script running under inotifywait.

![ps aux output with an Erlang process highlighted in yellow and red showing no_dot_erlang -sname ssh_runner -run escript start with -extra /usr/local/lib/erlang_login/start.escript, running as root PID 1048 with 1.6% memory usage. Other visible processes include php-fpm master, ModemManager, containerd, CRON, epmd daemon, clean-web.sh, inotifywait monitoring /var/www/soulmate.htb/public, sshd, nginx master and worker processes.](/writeups/htb-soulmate/09-ps-erlang.png)

Reading the `start.escript` file reveals exactly what this Erlang process does — it configures and starts an SSH daemon with hardcoded credentials:

![Terminal showing start.escript contents with failfun callback printing Auth failed messages, auth_methods set to publickey and password, user_passwords list containing tuple {"ben", "HouseH0ldings998"}, idle_time infinity, max_channels 10, max_sessions 10, parallel_login true, SSH daemon running on port 2222 with Press Ctrl+C to exit message, error handling for Failed to start SSH daemon.](/writeups/htb-soulmate/10-start-escript.png)

The script hardcodes ben's password as **HouseH0ldings998** and starts an SSH daemon on port **2222** with both publickey and password authentication enabled. Confirming the port is listening locally and identifying the service:

![Terminal showing ben@soulmate running ss -tulpn with multiple listening ports including 127.0.0.1:2222, then nc 127.0.0.1 2222 returning SSH-2.0-Erlang/5.2.9 banner.](/writeups/htb-soulmate/11-port-2222.png)

Port 2222 is bound to localhost only, running **Erlang SSH 5.2.9**. This is an Erlang OTP SSH implementation, not standard OpenSSH — it drops users into an Erlang shell (Eshell) rather than a bash session.

---

## Privilege escalation — Erlang OTP SSH as root

SSH-ing to port 2222 as ben with the hardcoded password drops into an Eshell:

```bash
ssh -p 2222 127.0.0.1
```

![Terminal showing ben@soulmate running ssh -p 2222 127.0.0.1, ED25519 key fingerprint prompt, yes to continue, ben@127.0.0.1 password prompt, then Eshell V15.2.5 press Ctrl+G to abort type help() for help, (ssh_runner@soulmate)1> prompt.](/writeups/htb-soulmate/12-erlang-ssh.png)

The Eshell is the Erlang interactive shell — a fully functional runtime environment. Listing the available modules confirms the full Erlang standard library is loaded, including the `os` module:

![Erlang module listing showing numerous .beam files from /usr/local/lib/erlang paths including kernel, stdlib, ssh, compiler modules — lists, logger, maps, net_kernel, orddict, ordsets, os, otp_internal, peer, persistent_term, prim_buffer through prim_socket, proc_lib, proplists, pubkey_cert_records, public_key, queue, rand, raw_file_io, re, rpc, sets, shell, shell_default, sofs, ssh, ssh_acceptor and more.](/writeups/htb-soulmate/13-module-list.png)

The `os` module provides the `cmd/1` function which executes system commands and returns the output as a string. Since the Erlang SSH daemon was started as root (visible in the `ps aux` output earlier as PID 1048 running under root), any command executed through `os:cmd()` runs as root:

```erlang
os:cmd('id').
```

![Terminal showing bottom of Erlang module listing with standard_error, start_escript (erlang_login/start.escript), string, supervisor, supervisor_bridge, sys_core_alias through v3_core, unicode, unicode_util, user_drv, user_sup, zlib all preloaded, then ok, followed by (ssh_runner@soulmate)6> os:cmd('id'). returning "uid=0(root) gid=0(root)_groups=0(root)\n" and (ssh_runner@soulmate)7> prompt.](/writeups/htb-soulmate/14-root-shell.png)

`uid=0(root)` — the Erlang SSH daemon runs as root, and `os:cmd()` provides unrestricted command execution. The root flag was retrieved.

---

## What I took from this

CrushFTP's CVE-2025-31161 is a devastating authentication bypass — it doesn't just read data or bypass a login, it creates fully functional admin accounts. The cascading impact here is the real lesson: one unauthenticated request to create an admin user → password changes for existing users → file upload to the web root → reverse shell. The entire initial access chain hinges on a single vulnerability, but each step requires understanding what the CrushFTP admin panel exposes. The VFS configuration was the key insight — seeing that ben's `webProd` folder mapped to the web application's document root made the webshell upload path obvious.

The Erlang OTP SSH daemon running as root is a pattern worth remembering for future boxes. It's easy to overlook because it doesn't show up as a standard SSH service — it runs on a non-standard port, bound to localhost only, and the banner identifies it as `Erlang/5.2.9` rather than `OpenSSH`. The Eshell isn't a traditional shell, but `os:cmd()` is functionally equivalent to command execution in any other language. The core issue is running the daemon as root with hardcoded credentials in a plaintext script — `start.escript` is world-readable and contains the password in clear text. If the daemon needs to run, it should run as an unprivileged user, and credentials should be loaded from a protected configuration file rather than hardcoded in the script itself.
