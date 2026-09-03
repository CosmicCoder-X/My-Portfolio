---
title: 'AD: Basic & Authenticated Enumeration'
target: 'TryHackMe — AD: Basic Authentication / AD: Authenticated Enumeration'
difficulty: 'medium'
date: 2025-08-29
summary: "A combined walkthrough of two Active Directory rooms covering unauthenticated reconnaissance through anonymous SMB and enum4linux, credential acquisition via CrackMapExec password spraying and AS-REP roasting, and authenticated domain enumeration with PowerShell AD cmdlets."
role: 'pentest'
tags: ['active-directory', 'enumeration', 'nmap', 'smb', 'enum4linux', 'crackmapexec', 'password-spraying', 'as-rep-roasting', 'hashcat', 'powershell', 'kerberos', 'windows-server']
problem: "A Windows Server 2019 domain controller for tryhackme.loc requires full enumeration from zero access. The task spans unauthenticated reconnaissance and credential acquisition through to authenticated domain enumeration of users, groups, computers, and AD objects."
action: "Ran Nmap to fingerprint services, accessed the UserBackups SMB share via anonymous login, and used enum4linux to extract the password policy. Performed a CrackMapExec password spray to recover rduke credentials and cracked AS-REP roasted hashes with Hashcat for asrepuser1. Authenticated via RDP and enumerated domain users, groups, computers, and Domain Admin membership with PowerShell AD cmdlets, then compared Get-ADGroup against net group with Compare-Object."
outcome: "Mapped the domain from zero access to full authenticated enumeration — retrieved the SMB flag, cracked credentials for rduke and asrepuser1, and enumerated 31 domain users, 54 domain groups (versus 21 visible to net group), 5 Domain Admins, and the Administrator SID."
draft: false
---

## Background

These two rooms — AD: Basic Authentication and AD: Authenticated Enumeration — form a natural pair. The first covers how to go from zero access to valid domain credentials against an Active Directory environment, and the second covers what to do once you have those credentials. Combining them into a single writeup mirrors how a real engagement flows: you don't stop after cracking a password, and you don't start authenticated enumeration in a vacuum. The target throughout is a Windows Server 2019 Datacenter domain controller for the `tryhackme.loc` domain.

The methodology moves through three phases. Unauthenticated reconnaissance maps the attack surface and extracts whatever the domain gives away for free. Credential acquisition turns that intelligence into valid credentials through password spraying and AS-REP roasting. Authenticated enumeration uses those credentials to map the domain's internal structure — users, groups, computers, memberships, and the gaps between different enumeration tools.

---

## Unauthenticated reconnaissance

### Nmap service scan

The engagement starts with a full service and version scan against the domain controller at 10.211.11.10:

```
sudo nmap -sC -sV -O 10.211.11.10
```

![Nmap scan output against 10.211.11.10 showing 13 open ports — SSH on 22, DNS on 53, Kerberos on 88, MSRPC on 135, NetBIOS on 139, LDAP on 389 and 3268, SMB on 445, Kpasswd on 464, RPC over HTTP on 593, LDAPS on 636 and 3269, and RDP on 3389, with SSL certificate showing commonName DC.tryhackme.loc, rdp-ntlm-info revealing Target_Name TRYHACKME, DNS_Domain_Name tryhackme.loc, DNS_Computer_Name DC.tryhackme.loc, and Product_Version 10.0.17763.](/writeups/thm-ad-basic-authenticated-enumeration/01-nmap-scan-part1.png)

The scan reveals the full signature of an Active Directory domain controller. Kerberos on port 88, LDAP on 389 and 3268, and SMB on 445 are the three services that immediately confirm this is a DC rather than a member server. The RDP NTLM info leak is particularly useful — without authenticating to anything, Nmap's scripting engine extracts the NetBIOS domain name (`TRYHACKME`), the DNS domain (`tryhackme.loc`), the computer name (`DC`), and the Windows build number (`10.0.17763`). That build number maps to **Windows Server 2019 Datacenter**, confirmed in the second half of the scan output.

![Continuation of the Nmap scan showing host script results — smb-security-mode revealing guest account used with user-level authentication and message signing required, smb-os-discovery confirming Windows Server 2019 Datacenter 17763 with Computer name DC, Domain tryhackme.loc, Forest tryhackme.loc, and FQDN DC.tryhackme.loc, smb2-security-mode showing signing enabled and required, scan completed in 316.10 seconds.](/writeups/thm-ad-basic-authenticated-enumeration/02-nmap-scan-part2.png)

The SMB scripts surface additional details. Message signing is required — this rules out relay attacks without workarounds. The guest account is enabled, which means anonymous or guest-level access to SMB shares is worth testing. The OS discovery confirms the domain and forest are both `tryhackme.loc`, meaning this is a single-domain, single-forest environment with no trust relationships to complicate things.

### Anonymous SMB access

With the guest account enabled, the next step is checking what SMB shares allow anonymous access. Connecting to the `UserBackups` share with the `-N` flag (no password) succeeds immediately:

```
smbclient \\\\10.211.11.10\\UserBackups -N
```

![Terminal showing smbclient connecting to the UserBackups share on 10.211.11.10 with anonymous login successful, directory listing revealing flag.txt (14 bytes) and story.txt (953 bytes), and the more command downloading flag.txt.](/writeups/thm-ad-basic-authenticated-enumeration/03-smbclient-anonymous.png)

The share contains `flag.txt` and `story.txt`. Downloading `flag.txt` reveals **THM{88_SMB_88}**. Anonymous SMB access on a domain controller is a significant finding in any real engagement — it means the share permissions were explicitly configured to allow unauthenticated access, and the contents could include anything from backup scripts to credential files. In this case it's a flag, but in production environments, `UserBackups` shares with anonymous access are exactly the kind of low-hanging fruit that leads to credential harvesting.

### Password policy extraction with enum4linux

Before attempting any brute-force or spray attacks, extracting the domain password policy is essential — it tells you the minimum password length (which informs wordlist filtering), the complexity requirements, and critically, the lockout threshold and duration. Spraying without knowing the lockout policy is how you lock out every account in the domain and get your engagement terminated.

```
enum4linux 10.211.11.10
```

![enum4linux output showing password policy information for domain TRYHACKME — minimum password length 7, password history length 24, maximum password age 41 days 23 hours 53 minutes, Password Complexity Flags 000001, Account Lockout Threshold 10, Locked Account Duration 2 minutes, Reset Account Lockout Counter 2 minutes, with rpcclient confirmation of Password Complexity Enabled and Minimum Password Length 7.](/writeups/thm-ad-basic-authenticated-enumeration/04-enum4linux-password-policy.png)

The policy reveals the critical parameters. **Minimum password length is 7**, which means any wordlist entries shorter than 7 characters can be filtered out immediately. **Complexity is enabled** (the `000001` flag and the rpcclient confirmation), requiring at least three of the four character categories — uppercase, lowercase, digits, and special characters. The **lockout threshold is 10 attempts**, with a **2-minute lockout duration** and a 2-minute reset counter. A 10-attempt threshold with a 2-minute reset is relatively permissive — it means a careful spray can try up to 9 passwords per user per 2-minute window without triggering lockout, though in practice a conservative spray would stay well under that limit. The password history of 24 prevents the last 24 passwords from being reused, and the maximum age of roughly 42 days means passwords rotate regularly.

---

## Credential acquisition

### Password spraying with CrackMapExec

With the password policy in hand, password spraying becomes a calculated attack rather than a gamble. The approach is to take a list of common passwords that meet the complexity requirements (7+ characters, mixed character types) and try each one against target accounts. CrackMapExec handles the SMB authentication and colour-codes the results:

![CrackMapExec SMB output showing password spray results against the rduke account on 10.211.11.10 — multiple red STATUS_LOGON_FAILURE entries for passwords like Password!, Password1, and P@ssword, then a green successful hit for tryhackme.loc\rduke:Password1!, followed by continued failures for other candidates and the user account.](/writeups/thm-ad-basic-authenticated-enumeration/05-crackmapexec-spray.png)

The spray hits on **rduke:Password1!** — the green `[+]` line stands out clearly against the red failures. `Password1!` meets the complexity requirements (uppercase, lowercase, digit, special character) and clears the 7-character minimum, which is exactly why it's in every password spray wordlist. It's a password that technically satisfies every policy requirement while being trivially guessable. The other attempts — `Password!`, `Password1`, `P@ssword`, `Pa5sword1` — all fail, and the `user` account at the bottom also fails, confirming that the spray was targeted and that `rduke` was the vulnerable account.

### AS-REP roasting

AS-REP roasting targets accounts that have Kerberos pre-authentication disabled — the `UF_DONT_REQUIRE_PREAUTH` flag. Normally, when a user requests a TGT from the KDC, they must prove their identity by encrypting a timestamp with their password hash. Accounts with pre-authentication disabled skip this step, meaning anyone can request a TGT for that account and receive a response encrypted with the user's password hash. That hash can then be cracked offline with no lockout risk.

The tool for requesting AS-REP hashes on Windows is **Rubeus**, and the collected hashes are cracked with Hashcat using **mode 18200** (Kerberos 5, etype 23, AS-REP):

```
hashcat -m 18200 ASREPRoasted.txt /usr/share/wordlists/rockyou.txt
```

![Hashcat output cracking two AS-REP hashes in mode 18200 (Kerberos 5, etype 23, AS-REP) using the rockyou.txt wordlist — session status Cracked, 2/2 hashes recovered at 387.0 kH/s, candidate transition showing r6276713 to qwerlqwe, completed in 5 seconds.](/writeups/thm-ad-basic-authenticated-enumeration/06-hashcat-asrep.png)

Hashcat cracks both hashes in 5 seconds flat at 387 kH/s against rockyou.txt. The asrepuser1 password is **qwerty123!** — another password that satisfies complexity requirements on paper while being one of the most common patterns in breach datasets. The speed of the crack underscores why AS-REP roasting is such a reliable attack: accounts with pre-authentication disabled are giving away password-equivalent material to anyone who asks, and the offline cracking has no lockout, no detection (the initial request is a normal Kerberos operation), and no rate limiting.

---

## Authenticated enumeration

With valid credentials (`rduke:Password1!`), the next phase is mapping the domain from within. RDP access to the domain controller provides a PowerShell session where the Active Directory module is available for direct enumeration.

### Users, groups, and computers

The core enumeration queries are straightforward PowerShell one-liners that answer the fundamental questions about the domain's size and structure:

![PowerShell session as rduke showing AD enumeration commands — (Get-ADUser -Filter *).Count returning 31, Get-ADUser rduke DisplayName returning Raoul Duke, (Get-LocalUser).Count returning 5, (Get-ADGroup -Filter *).Count returning 54, Get-ADUser asrepuser1 DistinguishedName returning CN=asrepuser1,CN=Users,DC=tryhackme,DC=loc, (Get-ADGroupMember "Domain Admins").Count returning 5, (Get-ADComputer -Filter *).Count returning 2, and Get-ADGroup filtering for admin-related names returning 13.](/writeups/thm-ad-basic-authenticated-enumeration/07-powershell-ad-enum.png)

The domain contains **31 domain user accounts** and **5 local user accounts** on the DC itself. The rduke account's display name is **Raoul Duke** — a reference to the Hunter S. Thompson character, which is the kind of creative naming that shows up in lab environments. There are **54 domain groups**, **2 computer objects** (the DC and presumably one member server or workstation), and **5 members in Domain Admins**. Filtering groups by names containing "admin" returns **13 groups**, covering the various administrative tiers and built-in admin groups that exist in any AD deployment.

The asrepuser1 distinguished name — **CN=asrepuser1,CN=Users,DC=tryhackme,DC=loc** — confirms the account sits in the default Users container rather than a custom OU, which is typical for service accounts or test accounts that were created quickly without proper organizational unit placement.

### Get-ADGroup versus net group

One of the more instructive comparisons in AD enumeration is the gap between modern PowerShell cmdlets and legacy `net` commands. Running `net group /domain` against the same domain controller returns a visibly shorter list:

![PowerShell showing Get-ADGroup count of 54, then net group /domain output listing 21 groups for domain tryhackme.loc — including Cloneable Domain Controllers, DnsUpdateProxy, Domain Admins, Domain Computers, Domain Controllers, Domain Guests, Domain Users, Enterprise Admins, Enterprise Key Admins, Enterprise Read-only Domain Controllers, Group Policy Creator Owners, HR Share RW, Internet Access, Key Admins, Protected Users, Read-only Domain Controllers, Schema Admins, Server Admins, and Tier 0, 1, and 2 Admins.](/writeups/thm-ad-basic-authenticated-enumeration/08-net-group-domain.png)

`Get-ADGroup` finds **54 groups**. `net group /domain` shows only **21**. The discrepancy is significant — `net group` only lists domain global groups and ignores domain local groups and universal groups entirely. In a real engagement, relying solely on legacy tools means missing more than half the groups in the domain, including security-critical ones like built-in Administrators, Backup Operators, and Remote Desktop Users.

The `Compare-Object` cmdlet makes this gap explicit:

```powershell
Compare-Object -ReferenceObject $New -DifferenceObject (Get-Content .\Desktop\Legacy.txt)
```

![PowerShell Compare-Object output showing the SideIndicator <= for groups present in Get-ADGroup but missing from net group output — including Administrators, Users, Guests, Print Operators, Backup Operators, Replicator, Remote Desktop Users, Network Configuration Operators, Performance Monitor and Log Users, Distributed COM Users, IIS_IUSRS, Cryptographic Operators, Event Log Readers, Certificate Service DCOM Access, RDS Remote Access, Endpoint, and Management Servers, Hyper-V Administrators, Access Control Assistance Operators, Remote Management Users, Storage Replica Administrators, Cert Publishers, RAS and IAS Servers, Server Operators, Account Operators, Pre-Windows 2000 Compatible Access, Incoming Forest Trust Builders, Windows Authorization Access Group, Terminal Server License Servers, Allowed and Denied RODC Password Replication Groups, and DnsAdmins.](/writeups/thm-ad-basic-authenticated-enumeration/09-compare-object.png)

The `<=` side indicator marks groups that exist in the `Get-ADGroup` output but are absent from the `net group` listing. The missing groups include some of the most security-relevant in any AD environment — **Backup Operators** (who can read any file on the domain controller), **Server Operators** (who can log on locally to DCs and manage services), **Account Operators** (who can create and modify most accounts), **DnsAdmins** (a well-known privilege escalation vector), and **Remote Desktop Users**. Any of these could be the group that gives an attacker the escalation path they need, and `net group` doesn't know they exist. This is why PowerShell AD cmdlets are the standard for authenticated enumeration — the legacy tools were never designed to see the full picture.

### Querying AD objects by distinguished name

The final enumeration technique targets a specific object — the built-in Administrator account — using `Get-ADObject` with the domain's distinguished name as the search base:

```powershell
$ADRoot = (Get-ADDomain).DistinguishedName
Get-ADObject "cn=Administrator,cn=Users,$ADRoot" -Properties * | Select-Object Name, ObjectClass, objectSID
```

![PowerShell showing the ADRoot variable set to the domain distinguished name, then Get-ADObject querying cn=Administrator returning Name Administrator, ObjectClass user, and objectSID S-1-5-21-4103247791-2828088783-3009141321-500.](/writeups/thm-ad-basic-authenticated-enumeration/10-ad-object-sid.png)

The Administrator account's SID is **S-1-5-21-4103247791-2828088783-3009141321-500**. The `-500` RID suffix is the well-known identifier for the built-in Administrator account in every AD domain — it's the one account that can never be locked out and that exists in every domain regardless of configuration. The domain SID portion (`S-1-5-21-4103247791-2828088783-3009141321`) is the unique identifier for this specific domain, and knowing it is useful for crafting golden tickets, performing SID history injection, and other advanced AD attacks that require the domain SID as an input parameter.

---

## What I took from this

The combined arc of these two rooms captures the real rhythm of an Active Directory engagement. The unauthenticated phase isn't just "run Nmap" — it's about extracting the password policy before spraying, checking anonymous access on every protocol, and building enough intelligence to make the credential acquisition phase surgical rather than noisy. The password policy extraction with enum4linux is the step that separates a careful operator from one who locks out the helpdesk queue and gets a phone call from the client.

The credential acquisition techniques — password spraying and AS-REP roasting — both exploit the same fundamental weakness: humans choosing predictable passwords. `Password1!` and `qwerty123!` both satisfy complexity requirements while being trivially crackable. Complexity policies create an illusion of security by forcing a specific character mix without addressing the actual problem, which is that humans build passwords from predictable patterns. Password length requirements of 14+ characters and passphrases would be more effective than any complexity rule, but that's a policy decision, not a technical control.

The most valuable lesson from the authenticated enumeration phase is the tooling gap. An operator who runs `net group /domain` and calls it done has missed 33 of 54 groups in this domain, including groups with direct paths to domain admin. The `Compare-Object` demonstration makes this viscerally clear — the built-in AD security groups that control backup privileges, service management, DNS administration, and remote access are all invisible to the legacy tool. In any engagement, using `Get-ADGroup`, `Get-ADUser`, and `Get-ADGroupMember` is the minimum standard, and tools like BloodHound that map the relationships between these objects are what turn a flat list of groups into actionable attack paths.
