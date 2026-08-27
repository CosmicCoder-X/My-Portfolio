---
title: 'Forensics'
target: 'TryHackMe — Forensics'
difficulty: 'medium'
date: 2026-08-27
summary: 'Volatility-based memory forensics on a Windows 7 dump: profiling the image, hunting suspicious processes and ports with pslist, shellbags, netscan and malfind, then extracting IOCs with strings and envars.'
role: 'forensics'
tags: ['Volatility', 'Memory forensics', 'malfind', 'shellbags', 'netscan', 'IOC', 'envars', 'strings']
problem: 'A raw memory dump from a compromised Windows 7 machine. The goal is to triage it end-to-end — identify the OS, find suspicious processes and network activity, detect injected code, and pull concrete indicators of compromise.'
action: 'Profiled the image with imageinfo, enumerated processes and user activity with pslist and shellbags, identified suspicious network listeners with netscan, flagged injected code via malfind, then extracted IOC domains, IPs and an anomalous environment variable with strings and envars.'
outcome: 'Full triage of the memory image: OS identified, malicious PIDs isolated, injected code confirmed across three processes, and a set of IOC domains, IPs and the OANOCACHE marker recovered.'
draft: false
---

This room is a guided walkthrough of memory forensics with Volatility 2. You
get a raw dump from a Windows machine that's been compromised, and the tasks
walk you through the standard triage sequence: profiling the image, enumerating
what was running, spotting the anomalies, and pulling IOCs. It covers a lot of
Volatility's core plugin set in one sitting.

Download `victim.raw` from the room, start Volatility, and work from
`/home/kali/Desktop/Tools/volatility`.

## Profiling the image

The first thing Volatility needs is the correct profile — the OS and service
pack the dump came from, so it knows how to parse kernel structures. `imageinfo`
runs a KDBG scan and suggests matching profiles:

```bash
python2 vol.py -f victim.raw imageinfo
```

![imageinfo output showing Win7SP1x64 profile and image metadata](/writeups/thm-forensics/01-imageinfo.png)

Several profiles match (Win7SP1x64, Win7SP0x64, Win2008R2SP variants), but the
suggested list starts with **Win7SP1x64** — the one to use going forward. The
output also gives the image timestamp: 2019-05-02 18:11:45 UTC.

The operating system of this dump is **Windows**.

## Enumerating processes

With the profile locked in, `pslist` shows every process that was running when
the dump was taken. The room asks for the PID of `SearchIndexer` — the Windows
Search service. Piping through `grep` pulls it out directly:

```bash
python2 vol.py -f victim.raw --profile=Win7SP1x64 pslist | grep SearchIndexer
```

![pslist output filtered for SearchIndexer, PID 2180](/writeups/thm-forensics/02-pslist-searchindexer.png)

SearchIndexer's PID is **2180**.

## Tracking user activity with ShellBags

ShellBags record every folder a user has browsed in Explorer — they persist in
the registry even after the folder is closed, making them a reliable artifact
for user activity analysis. The room asks for the last directory the user
accessed:

```bash
python2 vol.py -f victim.raw --profile=Win7SP1x64 shellbags
```

![shellbags output showing deleted_files as the last accessed directory](/writeups/thm-forensics/03-shellbags-deleted-files.png)

The most recent entry in the BagMRU hierarchy is **deleted_files** — that's
the last folder the user touched. The name alone is a red flag in an
investigation: someone was looking at (or cleaning up) deleted content.

## Suspicious network activity

Switching to network analysis, `netscan` shows every socket and connection in
the dump — local and foreign addresses, owning PIDs, and timestamps. The room
is after a suspicious open port:

```bash
python2 vol.py -f victim.raw --profile=Win7SP1x64 netscan
```

![netscan output showing wmpnetwk.exe listening on UDP 5005](/writeups/thm-forensics/04-netscan-udp5005.png)

At the top of the results, `wmpnetwk.exe` (PID 2464) has opened **UDP port
5005** — `0.0.0.0:5005`, listening on all interfaces. While `wmpnetwk.exe` is a
legitimate Windows Media Player Network Sharing process, port 5005 isn't a
standard port for it, making this suspicious.

The answer is **UDP:5005**.

## Detecting injected code with malfind

`malfind` is the workhorse plugin for spotting code injection. It scans the
Virtual Address Descriptors (VADs) of each process looking for memory regions
that are marked `PAGE_EXECUTE_READWRITE` (protection 6) — writable *and*
executable — and then checks whether they contain actual code. Legitimate
processes rarely allocate memory this way; malware does it routinely to inject
and execute shellcode.

```bash
python2 vol.py -f victim.raw --profile=Win7SP1x64 malfind
```

![malfind results: explorer.exe PID 1860 and svchost.exe PID 1820 with PAGE_EXECUTE_READWRITE regions](/writeups/thm-forensics/05-malfind-explorer-svchost.png)

![malfind results: wmpnetwk.exe PID 2464 with PAGE_EXECUTE_READWRITE region](/writeups/thm-forensics/06-malfind-wmpnetwk.png)

Three processes come back with the `VadS` tag and `PAGE_EXECUTE_READWRITE`
protection:

- **explorer.exe** — PID **1860**
- **svchost.exe** — PID **1820**
- **wmpnetwk.exe** — PID **2464**

All three have private, executable memory regions containing what looks like
injected code. `wmpnetwk.exe` (PID 2464) is the same process that opened that
suspicious UDP port — connecting the network anomaly to a code injection finding.

The answer is **1860;1820;2464**.

## IOC extraction

With the malicious processes identified, the next step is extracting indicators
of compromise — domains and IPs embedded in the memory dump that point to C2
infrastructure or malicious sites. The `strings` command combined with `grep`
and regex patterns pulls these out based on the hint format the room provides.

### Suspicious domains

**`www.go****.ru`** — a four-character `.ru` domain:

```bash
strings victim.raw | grep '\<www\.go....\.ru\>'
```

![strings output matching www.goporn.ru](/writeups/thm-forensics/07-strings-goporn-ru.png)

Result: **www.goporn.ru**

**`www.i****.com`** — a four-character `.com` domain:

```bash
strings victim.raw | grep '\<www\.i....\.com\>'
```

![strings output matching www.ikaka.com](/writeups/thm-forensics/08-strings-ikaka-com.png)

Result: **www.ikaka.com**

**`www.ic******.com`**:

```bash
strings victim.raw | grep '\<www\.ic......\.com\>'
```

Result: **www.icsalabs.com**

### Suspicious IPs

The same technique with IP-shaped regex patterns:

```bash
strings victim.raw | grep '\<202\....\.233\....\>'
```

Result: **202.107.233.211**

```bash
strings victim.raw | grep '\<...\.200\...\.164\>'
```

Result: **209.200.12.164**

```bash
strings victim.raw | grep '\<209\.190\....\....\>'
```

Result: **209.190.122.186**

## The OANOCACHE environment variable

The room's final question ties back to the malicious PIDs from malfind.
Environment variables are process-specific key-value pairs, and an unusual one
can fingerprint malware behaviour. The `envars` plugin dumps them for a given
PID:

```bash
python2 vol.py -f victim.raw -p 2464 --profile=Win7SP1x64 envars
```

![envars output for PID 2464 showing OANOCACHE](/writeups/thm-forensics/09-envars-oanocache.png)

Scrolling through the standard system variables (COMPUTERNAME, APPDATA, Path,
etc.) for PID 2464 (`wmpnetwk.exe`), one stands out: **OANOCACHE** — set to
`1`. This isn't a standard Windows environment variable. It's related to OLE
Automation (part of how COM objects work), and its presence in a process flagged
for code injection is an additional indicator — it suggests the injected code is
manipulating COM/OLE behaviour, a technique malware uses to disable certain
caching mechanisms during exploitation.

## What I took from this

This room is the full triage loop in one pass: profile the dump, enumerate
what's running, find the anomalies, and extract the IOCs. The thing that stuck
is how the findings chain together — `netscan` flags `wmpnetwk.exe` on a
suspicious port, `malfind` confirms it has injected code, and `envars` adds the
`OANOCACHE` marker. Each plugin answers a different question, but the
investigation only makes sense when you connect them into one narrative: this
process was compromised, it's phoning home, and here's the infrastructure it's
talking to.

The other takeaway is how powerful `strings` with targeted regex is as a
last-resort IOC extractor. When structured plugins don't surface what you need,
raw string matching against a known pattern still pulls domains and IPs out of a
multi-gigabyte dump in seconds.
