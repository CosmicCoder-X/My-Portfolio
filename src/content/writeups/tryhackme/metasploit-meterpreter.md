---
title: 'Metasploit: Meterpreter'
target: 'TryHackMe — Meterpreter'
difficulty: 'easy'
date: 2026-08-26
summary: 'Post-exploitation on a Windows Server 2019 domain host: psexec for initial access over SMB, then enumerating shares, dumping the SAM, cracking a domain user, and searching the disk for two hidden files.'
role: 'pentest'
tags: ['Meterpreter', 'Metasploit', 'psexec', 'SMB', 'hashdump', 'Post-exploitation', 'enum_shares']
problem: 'A set of valid SMB credentials on a domain-joined Windows Server. The credentials are the way in — the work is everything after: what''s on the host, who else has accounts, and where the sensitive files are.'
action: 'Used psexec to turn the credentials into a Meterpreter session, then ran sysinfo, enum_shares, hashdump, cracked a user offline, and used search to locate two files.'
outcome: 'SYSTEM on ACME-TEST, a full SAM dump, jchambers'' cracked password, and the contents of two hidden files.'
---

The earlier Metasploit rooms are about getting *in*. This one is about what you do
once you're already there — Meterpreter as a post-exploitation platform. Initial
access is handed to you as a set of SMB credentials; everything interesting
happens afterward.

Meterpreter itself is worth one line of context: it runs in memory on the target,
never touching disk, and talks back over TLS. If you `ps` after landing, the
session shows up as whatever process it's living in — commonly `spoolsv.exe` —
not a `meterpreter.exe`. That's the whole point of it.

## Initial access with psexec

The room simulates a compromise using known credentials over SMB via the psexec
module:

```bash
use exploit/windows/smb/psexec
set RHOSTS <target>
set SMBUser <username>
set SMBPass <password>
show options
```

![psexec module options](/writeups/thm-meterpreter/01-psexec-options.png)

```bash
run
```

![psexec run, Meterpreter session opened](/writeups/thm-meterpreter/02-psexec-run-session.png)

psexec authenticates, selects a PowerShell target, executes the payload and a
Meterpreter session opens. (The "Service start timed out" line is expected — the
module notes it's fine when running a non-service payload.)

## Fingerprinting the host

First question in post-exploitation is always "where am I":

```bash
sysinfo
```

![sysinfo output](/writeups/thm-meterpreter/03-sysinfo.png)

- Computer name: **ACME-TEST**
- OS: Windows Server 2019 (10.0 Build 17763)
- Domain: **FLASH**

So this isn't a standalone box — it's domain-joined, which makes the accounts and
shares below more interesting than they'd be on a workgroup machine.

## Enumerating shares

Shares are where domain hosts leak the interesting stuff. Background the session
and find the enum_shares post module:

```bash
background
search smb share
```

![searching for the enum_shares module](/writeups/thm-meterpreter/04-search-enum-shares.png)

`post/windows/gather/enum_shares` is the one. Select it and check what it needs:

```bash
use post/windows/gather/enum_shares
show options
```

![enum_shares options](/writeups/thm-meterpreter/05-enum-shares-options.png)

It needs a SESSION to run through. List sessions to get the ID:

```bash
sessions -l
```

![active sessions](/writeups/thm-meterpreter/06-sessions-list.png)

Session 1, running as NT AUTHORITY\SYSTEM on ACME-TEST. Point the module at it:

```bash
set SESSION 1
run
```

![enum_shares results](/writeups/thm-meterpreter/07-enum-shares-run.png)

Three shares: the two default domain ones, `SYSVOL` and `NETLOGON` — and
**speedster** at `C:\Shares\speedster`, which is the non-default one a user
created. On a real engagement that custom share is exactly where you'd look
first, because it's the one a person made on purpose.

## Dumping and cracking

Back into the session and dump the SAM:

```bash
sessions -i 1
hashdump
```

![hashdump output](/writeups/thm-meterpreter/08-hashdump.png)

A full domain-host dump this time, not just three local accounts — Administrator,
Guest, krbtgt, and a set of real users: ballen, **jchambers**, jfox, lnelson,
erptest. Each line is `user:RID:LM:NTLM:::`, and the NTLM portion is the fourth
field.

For jchambers, that NTLM hash is `69596c7aa1e8daee17f8e78870e25a5c`.

NTLM hashes can't be reversed mathematically, but a weak password is still weak —
run it through an offline database like CrackStation and it resolves to
**Trustno1**. That's the value of a hashdump: even one cracked domain credential
is a foothold you can reuse across the network with the same tools.

## Finding files

Meterpreter's `search` walks the filesystem for you. Two files to find.

```bash
search -f secrets.txt
```

![search for secrets.txt](/writeups/thm-meterpreter/09-search-secrets.png)

Located at `c:\Program Files (x86)\Windows Multimedia Platform\secrets.txt` —
deliberately tucked somewhere a normal file would never be. Read it:

```bash
cat "c:\Program Files (x86)\Windows Multimedia Platform\secrets.txt"
```

![secrets.txt contents](/writeups/thm-meterpreter/10-cat-secrets.png)

It holds a Twitter password: `KDSvbsw3849!`

Same move for the second file:

```bash
search -f realsecret.txt
```

![search for realsecret.txt](/writeups/thm-meterpreter/11-search-realsecret.png)

`c:\inetpub\wwwroot\realsecret.txt` — inside the web root this time:

```bash
cat "c:\inetpub\wwwroot\realsecret.txt"
```

![realsecret.txt contents](/writeups/thm-meterpreter/12-cat-realsecret.png)

The real secret: *The Flash is the fastest man alive.*

## What I took from this

The shape of this is the shape of most post-exploitation: land, fingerprint,
enumerate, loot. `sysinfo` to know where you are, `enum_shares` to find where
things are kept, `hashdump` to harvest credentials, `search` to locate specific
files. None of it is exploitation — the exploit already happened — and that's the
point the room is making: getting a shell is the start of the work, not the end.

Two habits worth keeping. The non-default share is always the interesting one —
`SYSVOL` and `NETLOGON` are on every domain host, so `speedster` is the one a
human chose to create. And a single cracked hash out of a dump is worth more than
the whole list, because on a domain it's not just an answer to a question — it's a
credential you can carry to the next box.
