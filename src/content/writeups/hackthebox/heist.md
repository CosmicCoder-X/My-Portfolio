---
title: 'Heist'
target: 'Hack The Box — Heist'
difficulty: 'easy'
date: 2025-11-25
summary: 'An HTB machine — scanning with nmap to find HTTP (80), MSRPC (135), and SMB (445) on a Windows Server 2019 host, discovering an issues portal at /issues.php with guest login where a user named Hazard posted a Cisco router configuration containing type 5 and type 7 password hashes, cracking the type 5 enable secret with john to reveal stealth1agent and decoding the type 7 passwords, using crackmapexec RID brute-force with Hazard''s credentials to enumerate domain users including Chase, password spraying to gain evil-winrm access as Chase, dumping the Firefox process memory with procdump to extract administrator credentials from cached login form data, and using psexec.py with the recovered admin password to escalate to NT AUTHORITY\SYSTEM.'
role: 'pentest'
tags: ['nmap', 'cisco', 'hash-cracking', 'john', 'type-7-decode', 'crackmapexec', 'rid-brute', 'evil-winrm', 'password-spraying', 'procdump', 'process-dump', 'firefox', 'credential-extraction', 'psexec', 'impacket', 'privilege-escalation', 'windows']
problem: 'Heist is an easy-rated Windows Server 2019 machine with three open ports — HTTP (80) serving a support issues portal with guest login, MSRPC (135), and SMB (445). The issues portal contains a post from a user named Hazard who uploaded a Cisco router configuration file with password hashes — a type 5 (MD5) enable secret and two type 7 (reversible) username passwords. The type 5 hash cracks to stealth1agent, and the type 7 passwords decode to known values. With Hazard''s credentials, RID brute-forcing via crackmapexec reveals additional domain users. Password spraying across the discovered users gains WinRM access as Chase. A running Firefox process on Chase''s desktop contains cached login credentials in memory — dumping the process with procdump and grepping for login form data reveals the administrator password, which grants SYSTEM access through psexec.'
action: 'Ran nmap to identify three open ports — 80/tcp (HTTP), 135/tcp (MSRPC), and 445/tcp (SMB/microsoft-ds) on a Windows Server 2019 host. Browsed to the web portal and accessed /issues.php with guest login. Found a support thread where user Hazard posted about Cisco router configuration problems with an attached config.txt file. Retrieved the Cisco configuration from /attachments/config.txt containing enable secret 5 $1$pdQG$o8nrSzsGXeaduXrjlvKc91, username rout3r password 7 0242114B0E143F015F5D1E161713, and username admin privilege 15 password 7 02375012182C1A1D751618034F36415408. Cracked the type 5 hash with john using rockyou.txt — revealed stealth1agent. Decoded the two type 7 passwords using a Cisco type 7 reversal tool. Used crackmapexec SMB RID brute-force with Hazard:stealth1agent to enumerate domain users — discovered Administrator (500), Guest (501), DefaultAccount (503), WDAGUtilityAccount (504), Hazard (1008), support, Chase, and Jason on domain SUPPORTDESK. Performed password spraying with the collected credentials across all discovered users. Gained evil-winrm access as Chase with password Q4)sJu\Y8qz*A3?d. Retrieved user flag. Found todo.txt on Chase''s desktop. Identified Firefox running as PID 6352. Used procdump.exe -ma 6352 firefox -accepteula to dump the Firefox process memory — created a 491MB firefox.dmp file. Ran strings -el firefox.dmp | grep login_password to extract cached login form data — found login_username=admin@support.htb and login_password=4dD!5}x/re8]FBuZ from localhost/login.php requests. Used psexec.py with administrator:4dD!5}x/re8]FBuZ@10.10.10.149 to obtain a SYSTEM shell. Retrieved the root flag.'
outcome: 'Gained SYSTEM-level access through a multi-stage credential recovery chain. A Cisco configuration file exposed on a support portal provided the initial credentials, RID brute-forcing discovered additional users, password spraying granted WinRM access as Chase, Firefox process memory dumping revealed cached administrator credentials, and psexec with those credentials provided NT AUTHORITY\SYSTEM access.'
draft: false
---

## Background

Heist is an easy-rated Windows machine that revolves entirely around credential recovery and reuse — there are no software exploits, no CVEs, and no kernel vulnerabilities in the attack chain. Every escalation step comes from finding passwords in places they shouldn't be and testing them against services they weren't intended for. The machine starts with a Cisco router configuration file carelessly uploaded to a support portal, and from there it's a chain of cracking hashes, enumerating users, spraying passwords, and extracting credentials from process memory. It's a machine that rewards patience and thoroughness over technical sophistication.

---

## Enumeration

An nmap scan against the target reveals three open ports:

![Terminal showing nmap scan report for 10.10.10.149 with host up at 0.13s latency and 997 filtered tcp ports. Three open ports listed — 80/tcp http, 135/tcp msrpc, and 445/tcp microsoft-ds. OS detection warning stating results may be unreliable, device type general purpose, running Microsoft Windows 2019 at 88% confidence, aggressive OS guess Microsoft Windows Server 2019 at 88%.](/writeups/htb-heist/01-nmap-scan.png)

Three services — **HTTP on port 80**, **MSRPC on port 135**, and **SMB on port 445**. The OS fingerprint points to Windows Server 2019. HTTP is the most promising entry point — MSRPC and SMB are standard Windows services that typically require credentials for anything useful.

---

## Exploring the web portal

Navigating to the web application on port 80 presents a login page with a **"Login as guest"** option. Clicking through to the issues page reveals a support thread:

![Browser at 10.10.10.149/issues.php showing an Issues page with a support thread. User Hazard posted 20 minutes ago saying he has been experiencing problems with his Cisco router and that here is a part of the configuration the previous admin had been using, with an Attachment link highlighted by an arrow. Support Admin with admin badge responded 10 minutes ago thanking for posting and promising to look into it. Hazard replied 10 minutes ago asking for a Windows server account to access the files.](/writeups/htb-heist/02-issues-page.png)

A user named **Hazard** posted about problems with a Cisco router and attached the configuration file the previous admin had been using. The conversation is revealing — Hazard is asking for a Windows server account, which tells us he's a legitimate user on the system, and the **Support Admin** (with admin privileges) is actively responding.

Clicking the **Attachment** link opens the Cisco configuration file:

![Browser at 10.10.10.149/attachments/config.txt showing a Cisco router configuration — version 12.2, no service pad, service password-encryption enabled, isdn switch-type basic-5ess, hostname ios-1. Security section shows passwords min-length 12, enable secret 5 $1$pdQG$o8nrSzsGXeaduXrjlvKc91. Two username entries — rout3r with password 7 0242114B0E143F015F5D1E161713, and admin with privilege 15 and password 7 02375012182C1A1D751618034F36415408. SSH configured with authentication-retries 5 and version 2.](/writeups/htb-heist/03-cisco-config.png)

This configuration file is a goldmine. Three password hashes are exposed:

- **Enable secret (type 5):** `$1$pdQG$o8nrSzsGXeaduXrjlvKc91` — an MD5-based hash, the strongest of the three but still crackable
- **rout3r (type 7):** `0242114B0E143F015F5D1E161713` — a reversible Vigenère cipher, trivially decodable
- **admin (type 7):** `02375012182C1A1D751618034F36415408` — same weak encoding as rout3r

Cisco type 7 passwords are not hashes at all — they're obfuscated with a known, fixed key and can be decoded instantly with any Cisco type 7 reversal tool. The type 5 enable secret is an actual MD5 hash that needs to be cracked.

---

## Cracking the hashes

Starting with the type 5 enable secret — feeding it to **john** with the `rockyou.txt` wordlist:

```
john type5.txt --wordlist=/usr/share/wordlists/rockyou.txt --fork=4
```

![Terminal showing john cracking type5.txt with rockyou.txt and fork=4. Warning about detected hash type md5crypt and format suggestion. Default input encoding UTF-8. Loaded 1 password hash md5crypt crypt(3) $1$ and variants MD5 128/1. Node numbers 1-4 of 4 fork. The cracked password stealth1agent is displayed. Completed in 47 seconds with 18398 passwords per second.](/writeups/htb-heist/04-john-crack.png)

The type 5 hash cracks to **stealth1agent** in under a minute. Combined with the decoded type 7 passwords, the full set of recovered credentials is:

| **Source** | **Type** | **Password** |
|:---|:---|:---|
| Enable secret | Type 5 (MD5) | `stealth1agent` |
| rout3r | Type 7 (reversible) | `$uperP@ssword` |
| admin | Type 7 (reversible) | `Q4)sJu\Y8qz*A3?d` |

Three passwords from three different accounts on a Cisco router. The question now is whether any of these passwords are reused on the Windows machine itself — starting with the user who uploaded the config file: Hazard.

---

## User enumeration — RID brute-force

Before spraying passwords, it's important to know what user accounts actually exist on the system. Hazard's credentials work against SMB, so **crackmapexec** can perform a RID brute-force to enumerate all local accounts:

```
crackmapexec smb 10.10.10.149 -u 'Hazard' -p 'stealth1agent' --rid-brute
```

![Terminal showing crackmapexec SMB RID brute-force against 10.10.10.149 with Hazard:stealth1agent. Target identified as Windows 10.0 Build 17763 x64, name SUPPORTDESK, domain SupportDesk, signing False, SMBv1 False. Successfully authenticated. RID enumeration reveals — 500 SUPPORTDESK\Administrator (SidTypeUser), 501 SUPPORTDESK\Guest (SidTypeUser), 503 SUPPORTDESK\DefaultAccount (SidTypeUser), 504 SUPPORTDESK\WDAGUtilityAccount (SidTypeUser), 1008 SUPPORTDESK\Hazard (SidTypeUser), 1013 SUPPORTDESK\Jason (SidTypeUser), additional users support and Chase visible.](/writeups/htb-heist/05-rid-bruteforce.png)

The RID brute-force reveals the full list of accounts on the **SUPPORTDESK** domain — the default Windows accounts (Administrator, Guest, DefaultAccount, WDAGUtilityAccount) plus four user accounts: **Hazard** (RID 1008), **support**, **Chase**, and **Jason** (RID 1013). These are the targets for password spraying.

---

## Gaining remote access — password spraying

With three recovered passwords and a list of user accounts, the next step is trying every combination. Password spraying each of the cracked credentials against each discovered user across available services — SMB, WinRM, and the web login.

The winning combination: **Chase** authenticates with the admin type 7 password `Q4)sJu\Y8qz*A3?d` over WinRM:

```
evil-winrm -i 10.10.10.149 -u 'chase' -p 'Q4)sJu\Y8qz*A3?d'
```

![Terminal showing evil-winrm connecting to 10.10.10.149 as chase with password Q4)sJu\Y8qz*A3?d. Evil-WinRM shell v3.5 established with warning about remote path completions disabled due to ruby limitation. Connection established to remote endpoint. Commands whoami returning supportdesk\chase, followed by cd .. and ls at C:\Users\Chase directory.](/writeups/htb-heist/06-evil-winrm-chase.png)

A shell as **supportdesk\chase** through Evil-WinRM. The user flag was retrieved from Chase's desktop. Alongside the flag, a `todo.txt` file sits on the desktop — a reminder about updates and password changes that haven't been done yet. More importantly, checking the running processes reveals **Firefox** running as PID 6352. A browser process with active session data in memory is worth investigating.

---

## Process memory dump — Firefox credentials

Running browsers often hold sensitive data in memory — login form submissions, session tokens, cached credentials. If Chase was logged into the support portal through Firefox, those credentials might still be in the process's memory space. Using **procdump** from Sysinternals to create a full memory dump of the Firefox process:

```
./procdump.exe -ma 6352 firefox -accepteula
```

![Evil-WinRM session showing procdump.exe -ma 6352 firefox -accepteula command execution. ProcDump v11.0 by Mark Russinovich, Sysinternals. Dump initiated at C:\Users\Chase\Desktop\firefox.dmp with estimated size 490 MB. Dump completed — 491 MB written in 2.3 seconds. Directory listing shows firefox.dmp at 502036677 bytes, procdump.exe at 791960 bytes, todo.txt at 121 bytes, and user.txt at 34 bytes on Chase's Desktop.](/writeups/htb-heist/07-procdump-firefox.png)

A **491 MB** memory dump is created. Now comes the extraction — searching through the dump for login form data. Since the support portal uses a standard HTML login form, the credentials would be submitted as POST parameters. Searching for `login_password` in the dump:

```
strings -el firefox.dmp | grep login_password
```

![Terminal showing strings -el firefox.dmp piped to grep login_password. Multiple matching lines from Mozilla Firefox process memory showing cached form submissions to localhost/login.php with repeated entries of login_username=admin@support.htb and login_password=4dD!5}x/re8]FBuZ in URL-encoded form data, along with MOZ_CRASHREPORTER entries containing the same credentials.](/writeups/htb-heist/08-firefox-creds.png)

Multiple hits — all pointing to the same credentials cached in Firefox's memory from login form submissions to `localhost/login.php`:

- **Username:** `admin@support.htb`
- **Password:** `4dD!5}x/re8]FBuZ`

These are the **administrator** credentials for the support portal. The `-el` flag in `strings` extracts little-endian Unicode strings, which is what Windows applications (including Firefox on Windows) use internally. Without it, these credentials would be invisible in the dump output.

---

## Privilege escalation — psexec as administrator

The recovered password `4dD!5}x/re8]FBuZ` belongs to the admin account on the web portal — but does the Windows administrator use the same password? Testing with **psexec.py** from Impacket:

```
psexec.py 'administrator:4dD!5}x/re8]FBuZ@10.10.10.149'
```

![Terminal showing psexec.py with administrator:4dD!5}x/re8]FBuZ@10.10.10.149. Impacket v0.9.19 by SecureAuth Corporation. Requesting shares on 10.10.10.149, found writable share ADMIN$. Uploading file WfVNoBqA.exe, opening SVCManager, creating and starting service KOxK. Microsoft Windows Version 10.0.17763.437, copyright 2018 Microsoft Corporation. Command prompt at C:\Windows\system32 with whoami returning nt authority\system.](/writeups/htb-heist/09-psexec-system.png)

**NT AUTHORITY\SYSTEM** — the administrator reused the web portal password for the Windows administrator account. Psexec found the writable `ADMIN$` share, uploaded a service executable, and spawned a SYSTEM shell. The root flag was retrieved.

---

## What I took from this

Heist is a pure credential-hunting exercise from start to finish — no buffer overflows, no misconfigurations to exploit, no CVEs to look up. Every step is about finding passwords and testing where else they work. The entire attack chain relies on one fundamental weakness: people reuse passwords and store them in places they assume are private.

The Cisco configuration file is the catalyst, and it illustrates a broader point about hash types. Cisco type 7 encoding was never designed to be secure — it's a Vigenère cipher with a fixed key, and any online tool can reverse it instantly. It exists only to prevent casual shoulder-surfing of passwords displayed in `show running-config` output. The type 5 enable secret uses MD5, which is actual hashing but still falls to a wordlist attack in under a minute with `john`. The practical takeaway is that "encrypted" doesn't mean "safe" — the encryption scheme matters enormously, and both of Cisco's older password types are trivially breakable.

The RID brute-force step is worth emphasizing because it's often overlooked. SMB access with any valid credential pair — even a low-privilege user like Hazard — is enough to enumerate every account on the system through RID cycling. This turns a single working credential into a complete user list, which transforms password spraying from a blind attack into a targeted one. The difference between spraying three passwords against two known users versus three passwords against six known users is significant — in this case, it's the difference between getting a shell and going nowhere.

The Firefox process dump is the most interesting technique on the box. Process memory is rarely cleaned up proactively — data lingers in a process's address space long after the application has moved on. Firefox, like most browsers, keeps form submission data in memory because the HTTP stack doesn't zero out buffers after use. This means that any user who logged into a web application through Firefox is potentially exposing those credentials to anyone who can dump the process memory. The technique generalizes beyond Firefox — any process that handles credentials (browsers, email clients, RDP sessions, password managers before they lock) can be a target. The `strings` command with `-el` for little-endian Unicode extraction is essential on Windows targets — without it, you'd miss the majority of readable strings in process dumps because Windows applications use UTF-16LE internally.

The final escalation — web portal admin password reused for the Windows administrator account — is the same class of vulnerability that started the chain. Hazard's Cisco router password worked on the Windows machine. Chase's Cisco admin password worked on WinRM. The portal admin's password worked for the Windows administrator. Every pivot on this machine is password reuse. In a real environment, this pattern compounds rapidly — one breached credential leads to enumeration, which leads to spraying, which leads to more credentials, which leads to more access. It's why credential hygiene and password managers aren't just IT convenience — they're the primary defense against exactly this kind of lateral movement.
