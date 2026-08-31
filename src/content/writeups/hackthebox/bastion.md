---
title: 'Bastion'
target: 'Hack The Box — Bastion'
difficulty: 'easy'
date: 2025-12-10
summary: 'An HTB machine — scanning with nmap to find SSH (22), MSRPC (135), NetBIOS (139), SMB (445), and WinRM (5985) on a Windows Server 2016 host, discovering a Backups SMB share with guest read/write access containing a WindowsImageBackup with VHD files, mounting the VHD with guestmount to access the full backup filesystem, extracting SAM and SYSTEM registry hives from Windows/System32/config, dumping NTLM hashes with samdump2 and impacket-secretsdump to recover L4mpje''s hash, cracking the hash to bureaulampje, SSHing in as L4mpje after evil-winrm failed, running enumeration scripts to discover mRemoteNG with stored credentials, decrypting the Administrator password from mRemoteNG''s confCons.xml configuration, and SSHing in as Administrator for root.'
role: 'pentest'
tags: ['nmap', 'smb', 'smbmap', 'vhd', 'guestmount', 'windows-backup', 'sam-dump', 'samdump2', 'impacket', 'secretsdump', 'hash-cracking', 'ssh', 'evil-winrm', 'mremoteng', 'credential-extraction', 'privilege-escalation', 'windows']
problem: 'Bastion is an easy-rated Windows Server 2016 machine with SMB, SSH, and WinRM exposed. The Backups SMB share is accessible with guest credentials and contains a full WindowsImageBackup with VHD (Virtual Hard Disk) files from a machine called L4mpje-PC. Mounting the VHD exposes the entire Windows filesystem including the SAM and SYSTEM registry hives, which can be dumped offline to extract NTLM password hashes. L4mpje''s hash cracks to bureaulampje, granting SSH access. On the system, mRemoteNG — a remote connection manager — stores encrypted credentials in its configuration file, including the Administrator password that can be decrypted with known tools.'
action: 'Ran AutoRecon to enumerate all services — identified SSH (22), MSRPC (135), NetBIOS (139), SMB (445), WinRM (5985), and several high-port RPC services on Windows Server 2016 Standard 14393. AutoRecon''s smbmap output revealed the Backups share accessible with guest credentials at READ/WRITE permissions. Mounted the Backups share with mount -t cifs and explored the structure — found WindowsImageBackup/L4mpje-PC containing a backup from 2019-02-22 with two VHD files (9b9cfbc3 at 37MB and 9b9cfbc4 at 5.4GB). Installed libguestfs-tools and mounted the larger VHD with guestmount --inspector --ro to access the full Windows filesystem. Navigated to Windows/System32/config and identified the SAM and SYSTEM registry hives. Copied both hives to the loot directory. Ran samdump2 ./SYSTEM ./SAM to extract NTLM hashes — recovered hashes for Administrator, Guest, and L4mpje (RID 1000). Verified with impacket secretsdump.py LOCAL -system ./SYSTEM -sam ./SAM which produced identical results. Checked L4mpje''s NTLM hash on CrackStation — cracked to bureaulampje. Attempted evil-winrm with L4mpje:bureaulampje which failed with WinAuthorizationError. Connected via SSH as l4mpje@10.10.10.134 with password bureaulampje. Retrieved the user flag. Set up a Python SimpleHTTPServer to transfer enumeration tools. Uploaded and ran linpeas to enumerate privilege escalation vectors. Discovered mRemoteNG installed with stored credentials in AppData. Extracted the encrypted Administrator password from mRemoteNG''s confCons.xml configuration file and decrypted it using a known mRemoteNG password decryption tool. SSHed in as Administrator and retrieved the root flag.'
outcome: 'Gained Administrator access through offline credential extraction from a Windows backup and application credential recovery. Guest SMB access to a Backups share exposed VHD files containing the full filesystem, SAM/SYSTEM hive dumping recovered L4mpje''s credentials, and mRemoteNG''s stored configuration contained the Administrator password.'
draft: false
---

## Background

Bastion is an easy-rated Windows machine that teaches offline credential extraction from backup media — a technique that bypasses every runtime protection on the target because the attack happens entirely against static files. The machine exposes a full Windows backup through an SMB share with guest access, and from there it's a matter of mounting the Virtual Hard Disk, pulling the SAM and SYSTEM registry hives, and cracking the extracted hashes. The privilege escalation follows a similar pattern — credentials stored by a remote connection manager that can be decrypted offline. No exploits, no CVEs — just backups and stored credentials left in accessible places.

---

## Enumeration

Running **AutoRecon** against the target to enumerate all services simultaneously:

```
python3 /opt/AutoRecon/autorecon.py -cs 25 -vv -o /home/kali/Documents/HTB/lab/ 10.10.10.134
```

The full TCP scan reveals a Windows Server 2016 Standard machine with several services:

```
PORT      STATE SERVICE      VERSION
22/tcp    open  ssh          OpenSSH for_Windows_7.9 (protocol 2.0)
135/tcp   open  msrpc        Microsoft Windows RPC
139/tcp   open  netbios-ssn  Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds Windows Server 2016 Standard 14393 microsoft-ds
5985/tcp  open  http         Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
49664-49670/tcp  open  msrpc  Microsoft Windows RPC
```

**SSH on 22**, **SMB on 139/445**, and **WinRM on 5985** — plus the standard Windows RPC ports. AutoRecon's SMB enumeration scripts automatically probe share permissions, revealing the key finding:

```
Disk        Permissions     Comment
----        -----------     -------
ADMIN$      NO ACCESS       Remote Admin
Backups     READ, WRITE
C$          NO ACCESS       Default share
IPC$        READ ONLY       Remote IPC
```

The **Backups** share is accessible with guest credentials at **READ/WRITE** permissions — no authentication required.

---

## SMB share — WindowsImageBackup

Mounting the Backups share locally to explore its contents:

```
sudo mount -t cifs //10.10.10.134/Backups /mnt/backups
```

![Terminal showing tree /mnt/sysvol/ output. Root contains CRZONWVISU, nmap-test-file, note.txt, SDT65CB.tmp, THAEXPIYGU, and WindowsImageBackup directories. Under WindowsImageBackup/L4mpje-PC/Backup 2019-02-22 124351 are two VHD files (9b9cfbc3 and 9b9cfbc4), BackupSpecs.xml, multiple cd113385 XML files for various Writers, plus Catalog (BackupGlobalCatalog, GlobalCatalog), MediaId, and SPPMetadataCache directories. Total 7 directories, 20 files.](/writeups/htb-bastion/01-smb-tree.png)

A full **WindowsImageBackup** from a machine called **L4mpje-PC** — a complete system backup from February 22, 2019. The backup contains two VHD (Virtual Hard Disk) files — the smaller one (37MB) is the boot partition, and the larger one (5.4GB) is the main system partition containing the Windows installation.

---

## Mounting the VHD — offline filesystem access

VHD files are mountable on Linux with `guestmount` from the `libguestfs-tools` package:

```
sudo apt-get install libguestfs-tools
sudo guestmount --add 9b9cfbc4-369e-11e9-a17c-806e6f6e6963.vhd --inspector --ro /mnt/test/backup
```

The `--inspector` flag auto-detects the filesystem, and `--ro` mounts it read-only. With the VHD mounted, the entire Windows filesystem is accessible — `C:\Windows`, `C:\Users`, `C:\Program Files`, everything. The target is the **SAM** and **SYSTEM** registry hives in `Windows\System32\config`:

![Terminal at /mnt/test/backup/Windows/System32/config showing ls -la output with full directory listing. Among the files, SAM (262144 bytes, Feb 22 2019) and SYSTEM (9699328 bytes, Feb 22 2019) are highlighted with green boxes. Other files include BCD-Template, COMPONENTS, DEFAULT, SECURITY, SOFTWARE, and their associated LOG files, plus Journal, RegBack, systemprofile, and TxR directories.](/writeups/htb-bastion/02-sam-system-hives.png)

The **SAM** hive stores local user account password hashes, and the **SYSTEM** hive contains the boot key needed to decrypt them. With both files accessible, offline hash extraction is straightforward.

---

## Dumping hashes — SAM and SYSTEM

Copying the hives to the attacker machine and extracting hashes with **samdump2**:

```
cp SAM /home/kali/Documents/HTB/lab/10.10.10.134/loot/
cp SYSTEM /home/kali/Documents/HTB/lab/10.10.10.134/loot/
samdump2 ./SYSTEM ./SAM
```

![Terminal at ~/Documents/HTB/lab/10.10.10.134/loot showing samdump2 ./SYSTEM ./SAM output. Three accounts listed — disabled Administrator with RID 500 and NTLM hash 31d6cfe0d16ae931b73c59d7e0c089c0, disabled Guest with RID 501 and same hash, and L4mpje with RID 1000 and NTLM hash 26112010952d963c8dc4217daec986d9.](/writeups/htb-bastion/03-samdump2.png)

Three accounts extracted. The Administrator and Guest hashes are the well-known "empty password" NTLM hash (`31d6cfe0d16ae931b73c59d7e0c089c0`), meaning those accounts are disabled. **L4mpje** (RID 1000) has a real hash. Verifying with **impacket-secretsdump** for a second opinion:

```
python3 /opt/impacket/examples/secretsdump.py LOCAL -system ./SYSTEM -sam ./SAM
```

![Terminal showing secretsdump.py LOCAL -system ./SYSTEM -sam ./SAM output. Impacket v0.9.21.dev1 by SecureAuth Corporation. Target system bootKey 0x8b56b2cb5033d8e2e289c26f8939a25f. Dumping local SAM hashes — Administrator:500 with hash 31d6cfe0d16ae931b73c59d7e0c089c0, Guest:501 with same empty hash, L4mpje:1000 with hash 26112010952d963c8dc4217daec986d9. Cleaning up.](/writeups/htb-bastion/04-secretsdump.png)

Identical results — L4mpje's NTLM hash is `26112010952d963c8dc4217daec986d9`. Checking this hash on **CrackStation** returns an instant result: **bureaulampje** (Dutch for "desk lamp" — fitting the L4mpje username).

---

## Shell as L4mpje

First attempt — **evil-winrm** with the cracked credentials:

```
evil-winrm -i 10.10.10.134 -u 'L4mpje' -p 'bureaulampje'
```

![Terminal showing evil-winrm connecting to 10.10.10.134 as L4mpje with password bureaulampje. Evil-WinRM shell v2.3 establishing connection to remote endpoint. Red error message — An error of type WinRM::WinRMAuthorizationError happened, message is WinRM::WinRMAuthorizationError. Exiting with code 1.](/writeups/htb-bastion/05-evil-winrm-fail.png)

**WinRMAuthorizationError** — L4mpje's account doesn't have WinRM permissions. Not every user with valid credentials can use WinRM; the account needs to be in the `Remote Management Users` group. Falling back to **SSH**, which was also open on port 22:

```
ssh l4mpje@10.10.10.134
```

![Terminal showing SSH session as l4mpje@BASTION at C:\Users\L4mpje. Microsoft Windows Version 10.0.14393, copyright 2016 Microsoft Corporation.](/writeups/htb-bastion/06-ssh-l4mpje.png)

A shell as **l4mpje@BASTION** through OpenSSH for Windows. The user flag was retrieved from L4mpje's desktop.

---

## Privilege escalation — mRemoteNG credentials

Setting up a Python SimpleHTTPServer to transfer enumeration scripts to the target:

![Terminal at /opt/linux showing directory listing with privilege escalation tools — les, linenum, LinEnum.sh, linPEAS, linpeas.sh, linux-enum-mod.sh, Linux_Exploit_Suggester, linux-exploit-suggester.sh, linux-kernel-exploits, linuxPEAwesomeScript, linuxprivchecker, linuxprivchecker.py, linux-soft-exploit-suggester, lpec, lpec.sh, pspy, pwncat_b64, unix-priv-esc, unix-privesc-check, and upc.sh. Bottom shows sudo python -m SimpleHTTPServer 80 starting HTTP server on 0.0.0.0 port 80.](/writeups/htb-bastion/07-enumeration-tools.png)

Running enumeration on the target reveals an interesting installed application — **mRemoteNG**, a multi-remote connection manager for Windows. mRemoteNG stores connection profiles including credentials in an XML configuration file at `C:\Users\L4mpje\AppData\Roaming\mRemoteNG\confCons.xml`. This file contains encrypted passwords for saved connections — including one for the **Administrator** account.

mRemoteNG's encryption is well-documented and reversible. The default encryption uses AES-128-GCM with a known master password ("mR3m"), and several tools exist to decrypt the stored credentials. Extracting and decrypting the Administrator password from `confCons.xml` reveals the plaintext credentials.

With the Administrator password recovered, SSH provides the final shell:

```
ssh administrator@10.10.10.134
```

**Administrator access** — the root flag was retrieved.

---

## What I took from this

Bastion's core technique — mounting a VHD from a backup and extracting SAM/SYSTEM hives — is a real-world attack vector that comes up in engagements where backup infrastructure is poorly secured. The attack happens entirely offline: no failed login attempts, no brute-force detection, no event logs on the target. The backup files contain everything needed to extract every local account's NTLM hash, and the only protection is access control on the backup storage itself. Guest access to a share containing system backups is the misconfiguration that makes everything else possible.

The evil-winrm failure is a useful reminder that WinRM access is permission-gated separately from account validity. A valid credential pair doesn't automatically mean WinRM access — the account needs explicit membership in `Remote Management Users` or equivalent. When WinRM fails, SSH (if available) is the immediate fallback, and on modern Windows servers with OpenSSH installed, it's often available.

The mRemoteNG privilege escalation follows the same pattern as the initial access — credentials stored in a file that's accessible to the current user and protected by reversible encryption. Remote connection managers, password managers without strong master passwords, browser saved credentials, and configuration files with "encrypted" passwords are all variations of the same vulnerability: secrets at rest protected by weak or default encryption keys. The defense is either not storing credentials at all (using certificate-based authentication, SSO, or credential vaults with proper master passwords) or ensuring that the files containing encrypted credentials are only accessible to highly privileged accounts.
