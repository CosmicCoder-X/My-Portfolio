---
title: 'Lame'
target: 'Hack The Box — Lame'
difficulty: 'easy'
date: 2025-09-15
summary: 'An HTB machine — scanning with nmap to find FTP (21) running vsftpd 2.3.4 with anonymous login, SSH (22), and SMB (139/445) running Samba on a Linux host, finding vsftpd 2.3.4 is vulnerable to a known backdoor command execution but the Metasploit exploit fails because the backdoor callback port 6200 is firewalled, pivoting to SMB and using Metasploit''s smb_version scanner to identify Samba 3.0.20-Debian, exploiting CVE-2007-2447 (Samba "username map script" command execution) with the multi/samba/usermap_script module to obtain a command shell directly as root — no privilege escalation needed.'
role: 'pentest'
tags: ['nmap', 'ftp', 'vsftpd', 'smb', 'samba', 'metasploit', 'cve-2007-2447', 'rce', 'searchsploit']
problem: 'Lame is an easy-rated Linux machine with four open ports — FTP (21) running vsftpd 2.3.4 with anonymous login enabled, SSH (22) running OpenSSH 4.7p1, and SMB (139/445) running Samba 3.0.20-Debian. The vsftpd 2.3.4 version contains a notorious backdoor that opens a shell on port 6200 when triggered, but the firewall blocks that port. The Samba 3.0.20 version is vulnerable to CVE-2007-2447, a command injection in the "username map script" configuration option that allows unauthenticated remote code execution, and the Samba service runs as root — granting immediate full system access.'
action: 'Ran nmap with host discovery disabled (-Pn) to identify open ports — 21/tcp (FTP), 22/tcp (SSH), 139/tcp (NetBIOS), 445/tcp (SMB). Ran a targeted service version and script scan (-sVC) against the four ports — identified vsftpd 2.3.4 on port 21 with anonymous FTP login allowed, OpenSSH 4.7p1 on port 22, and Samba smbd 3.X-4.X on ports 139/445 with workgroup WORKGROUP. Service Info confirmed Unix/Linux OS. Searched for vsftpd 2.3.4 exploits with searchsploit — found two results for Backdoor Command Execution (unix/remote/49757.py and unix/remote/17491.rb). Attempted the vsftpd backdoor exploit in Metasploit (exploit/unix/ftp/vsftpd_234_backdoor) — the exploit connected and triggered the backdoor (Banner 220 vsFTPd 2.3.4, USER 331 Please specify the password) but reported "Exploit completed, but no session was created" because the callback port 6200 is blocked by the firewall. Pivoted to SMB — used Metasploit''s auxiliary/scanner/smb/smb_version module to enumerate the exact Samba version, which identified it as Samba 3.0.20-Debian with SMBv1 and optional signing. Searched for Samba 3.0.20 exploits — found exploit/multi/samba/usermap_script (CVE-2007-2447, "username map script" Command Execution, excellent rank). Selected the module, set LHOST to tun0 (10.10.14.117) and RHOSTS to 10.10.10.3. The exploit triggered and opened a command shell session as root (uid=0). Located both flags at /home/makis/user.txt and /root/root.txt using find, confirmed both are 33 bytes.'
outcome: 'Gained root access to the machine directly through exploitation. The attack chain was nmap enumeration identifying vsftpd 2.3.4 and Samba 3.0.20, a failed vsftpd backdoor attempt (port 6200 firewalled), Metasploit SMB version detection confirming Samba 3.0.20-Debian, and CVE-2007-2447 Samba usermap_script exploitation for immediate root access with no privilege escalation required.'
draft: false
---

## Background

Lame is an easy-rated Linux machine and one of the original HackTheBox boxes — often the very first machine new users would encounter. It's a straightforward Metasploit exercise with a deliberate misdirection built in: the FTP service runs a version with a famous backdoor, but the firewall blocks the callback port, forcing a pivot to SMB where the actual vulnerability sits. The box requires no privilege escalation because the vulnerable Samba service runs as root, making it a single-step exploit from enumeration to full compromise.

---

## Enumeration

An nmap scan against the target reveals four open ports:

```
PORT    STATE SERVICE
21/tcp  open  ftp
22/tcp  open  ssh
139/tcp open  netbios-ssn
445/tcp open  microsoft-ds
```

A targeted service version scan fills in the details:

```
PORT    STATE SERVICE     VERSION
21/tcp  open  ftp         vsftpd 2.3.4
|_ftp-anon: Anonymous FTP login allowed (FTP code 230)
22/tcp  open  ssh         OpenSSH 4.7p1 Debian 8ubuntu1 (protocol 2.0)
139/tcp open  netbios-ssn Samba smbd 3.X - 4.X (workgroup: WORKGROUP)
445/tcp open  netbios-ssn Samba smbd 3.X - 4.X (workgroup: WORKGROUP)
Service Info: OSs: Unix, Linux
```

Two services immediately stand out: **vsftpd 2.3.4** on FTP with anonymous login, and **Samba** on SMB. The vsftpd version is particularly notable — 2.3.4 is one of the most infamous versions in security history.

---

## The vsftpd 2.3.4 backdoor — a dead end

vsftpd 2.3.4 contains a backdoor that was inserted into the source code by an unknown attacker in 2011. When a username containing a smiley face (`:)`) is sent during authentication, the backdoor opens a command shell listener on port 6200. Searching for exploits confirms this:

![Terminal at ~/Documents/htb/Lame showing searchsploit vsftpd 2.3.4 with results table — vsftpd 2.3.4 - Backdoor Command Execution at unix/remote/49757.py and vsftpd 2.3.4 - Backdoor Command Execution (Metasploit) at unix/remote/17491.rb. Shellcodes: No Results.](/writeups/htb-lame/01-searchsploit-vsftpd.png)

Two exploits available — a standalone Python script and the Metasploit module. Attempting the Metasploit exploit:

![Metasploit console showing search vsftpd 2.3.4 finding exploit/unix/ftp/vsftpd_234_backdoor (2011-07-03, excellent rank, VSFTPD v2.3.4 Backdoor Command Execution highlighted). Module selected with use 0, show options displaying CHOST, CPORT, Proxies (not required), RHOSTS (required), and RPORT 21 (required). Exploit target set to Automatic. RHOSTS set to 10.10.10.3, exploit run. Output shows Banner 220 (vsFTPd 2.3.4), USER 331 Please specify the password, then Exploit completed but no session was created.](/writeups/htb-lame/02-vsftpd-exploit-fail.png)

The exploit triggers the backdoor successfully — the banner confirms vsftpd 2.3.4 and the USER command is accepted — but the session fails to open. The backdoor tries to connect back on port 6200, which is blocked by the firewall. This is a deliberate part of the box's design — the obvious vulnerability is a dead end.

---

## SMB version detection — Samba 3.0.20

With the FTP path closed, attention turns to SMB. Nmap only identified the Samba version as `3.X - 4.X`, which is too broad to search for specific exploits. Metasploit's `smb_version` auxiliary scanner provides the exact version:

![Metasploit console showing search smb_version finding auxiliary/scanner/smb/smb_version (normal rank, SMB Version Detection highlighted). Module selected, show options displaying RHOSTS (required), RPORT (not required), THREADS 1 (required). RHOST set to 10.10.10.3, run. Output shows SMB Detected (versions:1) (preferred dialect:) (signatures:optional), Host could not be identified: Unix (Samba 3.0.20-Debian). Scanned 1 of 1 hosts (100% complete).](/writeups/htb-lame/03-smb-version.png)

**Samba 3.0.20-Debian** — SMBv1 with optional signatures. This version is vulnerable to CVE-2007-2447, a command injection vulnerability in Samba's "username map script" configuration option. When the `username map script` option is enabled, Samba passes the username through `/bin/sh` for processing, and an attacker can inject shell metacharacters into the username to execute arbitrary commands.

---

## CVE-2007-2447 — root shell

Searching for Samba 3.0.20 exploits in Metasploit leads directly to the `usermap_script` module. Setting the target and listener, then running:

![Metasploit console showing search samba 3.0.20 finding exploit/multi/samba/usermap_script (2007-05-14, excellent rank, Samba "username map script" Command Execution highlighted). Module selected with use 0, no payload configured defaulting to cmd/unix/reverse_netcat. Show options displaying module options CHOST, CPORT, Proxies (not required), RHOSTS (required), RPORT 139 (required), and payload options LHOST 192.168.0.225 (required) and LPORT 4444 (required). Exploit target Automatic. LHOST set to tun0 (10.10.14.117), RHOSTS set to 10.10.10.3, run. Output shows Started reverse TCP handler on 10.10.14.117:4444, Command shell session 1 opened (10.10.14.117:4444 to 10.10.10.3:48567) at 2024-06-24 13:21:21 +0200. Then id command returns uid=0(root) gid=0(root).](/writeups/htb-lame/04-samba-exploit-root.png)

The exploit sends a crafted username containing shell metacharacters through the `username map script` handler, which executes the injected command — in this case, a reverse netcat shell. Since Samba runs as root on this machine, the shell lands directly as **uid=0(root)** with no privilege escalation needed.

---

## Flags

With root access, locating and reading both flags:

![Terminal showing find / -name user.txt 2>/dev/null returning /home/makis/user.txt, find / -name root.txt 2>/dev/null returning /root/root.txt, wc /home/makis/user.txt showing 1 1 33 (33 bytes), wc /root/root.txt showing 1 1 33 (33 bytes).](/writeups/htb-lame/05-flags.png)

Both flags retrieved — `user.txt` in `/home/makis/` and `root.txt` in `/root/`.

---

## What I took from this

Lame's design is instructive beyond the exploitation itself. The vsftpd 2.3.4 backdoor is deliberately placed as a misdirection — it's the more famous vulnerability, it shows up immediately in enumeration, and searchsploit confirms it's exploitable. A tester who fixates on this single finding without checking why it fails (the firewall blocking port 6200) could waste significant time. The lesson is that when an exploit fails, understanding *why* it fails — not just that it fails — determines whether the vulnerability is truly unexploitable or just needs a different approach. In this case the port block is definitive, but in other scenarios, a failed exploit might just need a different payload, a different target configuration, or manual exploitation instead of a Metasploit module.

CVE-2007-2447 is a clean example of command injection through a configuration feature. The `username map script` option in Samba was designed to run a script that translates client-supplied usernames to local usernames — a legitimate feature for environments where Windows and Unix naming conventions differ. The vulnerability exists because the username is passed to `/bin/sh` without sanitization, so shell metacharacters in the username field execute as commands. The fix was straightforward — Samba started sanitizing the input before passing it to the shell — but the underlying pattern (user input reaching a shell interpreter without sanitization) appears in every language and framework. Wherever a system passes untrusted input to `system()`, `exec()`, `popen()`, or any shell invocation, the same class of vulnerability exists.

The fact that both the vsftpd backdoor and the Samba exploit land directly as root (when they work) highlights a common characteristic of service-level vulnerabilities on older systems: services ran as root by default because privilege separation wasn't a priority. Modern systems run services as dedicated low-privilege users specifically to limit the impact of service-level exploits — if Samba had been running as a `samba` user, this exploit would have been a foothold requiring escalation, not a complete compromise.
