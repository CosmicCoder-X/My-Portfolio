---
title: 'Timeline 1'
target: 'picoCTF — Timeline 1'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Forensics challenge where building a Sleuthkit MAC(B) timeline from an ext4 disk image revealed a suspicious file dropped in /etc/ seconds before the attacker cleared their shell history, and extracting it by inode with icat produced a base64-encoded flag."
role: 'forensics'
tags: ['forensics', 'disk-image', 'sleuthkit', 'timeline-analysis', 'dfir', 'picoctf']
problem: "A gzipped raw disk image (partition4.img.gz) with no further context. The hints steer toward building a Sleuthkit MAC timeline, examining recent timestamps, watching for anti-forensic actions, and filtering for newly created files."
action: "Decompressed and fingerprinted the image as a raw ext4 filesystem with no partition table, built a MAC(B) timeline using fls and mactime, filtered for macb entries to isolate newly created files, separated baseline OS provisioning noise from a late-stage anomaly in /etc/chat that appeared 16 seconds before a suspiciously small .ash_history file, then extracted the file by inode with icat and base64-decoded its contents."
outcome: 'Recovered the base64-encoded flag from the anomalous /etc/chat file that the attacker had tried to obscure by clearing their shell history.'
draft: false
---

## Background

Timeline 1 is a picoCTF Forensics challenge that serves as a genuine introduction to one of the core techniques in digital forensics and incident response: MAC(B) timeline analysis. The challenge provides a single file — `partition4.img.gz` — and asks to find the flag inside the disk image. The four hints progressively guide the approach: create a Sleuthkit MAC timeline, look at recent timestamps, pay close attention to timestamps near an anti-forensic action, and filter for new files by grepping for `macb`.

A MAC(B) timeline is a chronological reconstruction of filesystem activity built from the four timestamp types that most filesystems track per file. **M** (Modified) records when content was last written. **A** (Accessed) records when the file was last read or opened. **C** (Changed) records when metadata like permissions or ownership was altered. **B** (Born) records when the file was created — this is ext4-specific and not all filesystems track it. When all four timestamps fire simultaneously on a single file, it means that file was just created, which is exactly the signal the challenge wants us to find.

---

## Identifying the evidence

Never assume the format of evidence. Decompressed the image and fingerprinted it:

```
$ gunzip partition4.img.gz
$ file partition4.img
partition4.img: Linux rev 1.0 ext4 filesystem data, UUID=7a00e9da-98f8-4f0f-b257-95edf422d902 (extents) (64bit) (large files) (huge files)
```

It was a raw ext4 filesystem, not a full disk image with a partition table. This distinction mattered for tool usage — running `mmls` (which reads partition tables) confirmed there was no MBR or GPT to parse:

```
$ mmls partition4.img
```

No output. The filesystem started at offset 0, which meant no `-o <offset>` flag was needed for any downstream Sleuthkit tools.

---

## Building the MAC(B) timeline

Sleuthkit constructs timelines in two stages. First, `fls` walks every inode and directory entry in the filesystem — including deleted-but-recoverable files — and outputs a body file in a format that `mactime` can parse. Second, `mactime` converts that raw body file into a sorted, human-readable timeline:

```
$ fls -r -m / partition4.img > body.txt
$ mactime -b body.txt -d > timeline.csv
```

The `-r` flag made `fls` recurse through the entire filesystem tree, and `-m /` formatted the output with `/` as the mount point for `mactime` compatibility. The `-d` flag on `mactime` produced comma-separated output sorted oldest to newest, with a flags column showing which of the M/A/C/B events fired at each timestamp for each file.

The resulting `timeline.csv` was the crime scene log — every timestamped event on the disk, in chronological order.

---

## Establishing a baseline

A fresh OS install generates thousands of timeline entries in the first few seconds — symlinks being created, package databases being populated, config directories being laid down. None of that is interesting. Recognising it as noise is half the skill in timeline analysis.

Following hint #4, filtered for entries where all four flags fired together (newly created files):

```
$ grep "macb" timeline.csv
```

The top of the output was a wall of Alpine Linux provisioning noise: BusyBox symlinks (`/bin/ls -> /bin/busybox`), APK package metadata, CA certificate bundles, vim runtime files — all timestamped within a tight window on November 11, 2025, with a second cluster around December 2, 2025 at 00:41–00:42. This was consistent with an initial OS installation followed by a later package management session (`apk add` pulling in cert bundles, vim, curl, and related dependencies).

None of this was the flag. It was the baseline against which any anomaly would stand out.

---

## Spotting the anomaly

Following hint #2 — look at recent timestamps — the most recent activity on the disk was a short burst at 00:50:07–00:50:23, well after the bulk provisioning had finished:

```
Tue Dec 02 2025 00:50:07,49,macb,r/rrw-r--r--,0,0,32716,"/etc/chat"
Tue Dec 02 2025 00:50:23,1024,macb,d/drwxr-xr-x,0,0,33017,"/lib/rc/cache"
Tue Dec 02 2025 00:50:23,8,macb,r/rrw-r--r--,0,0,33020,"/lib/rc/cache/softlevel"
Tue Dec 02 2025 00:50:23,9,macb,r/rr--------,0,0,4943,"/root/.ash_history"
Tue Dec 02 2025 00:50:23,32,macb,r/rr--------,0,0,65278,"/var/lib/seedrng/seed.credit"
```

Two entries stood out immediately.

The first anomaly was `/etc/chat` — a 49-byte file appearing in `/etc/`. Alpine Linux does not ship anything called `/etc/chat` by default. It is not part of BusyBox, OpenRC, or any standard package. A tiny, out-of-place file sitting in a system config directory is exactly the kind of artifact a threat actor drops when staging a payload, a note, or in this case a CTF flag.

The second anomaly was the anti-forensic action that hint #3 was pointing at. Sixteen seconds after `/etc/chat` was created, `/root/.ash_history` showed a MACB event with a size of just 9 bytes. This was a root shell session that had spent the previous several minutes installing packages, editing files with vim, and managing certificates. A history file that small for that volume of activity is a textbook sign of log tampering — whoever created `/etc/chat` cleared or truncated their shell history immediately after finishing their work. In real-world incident response, this pattern — a suspicious artifact followed within seconds by evidence of history clearing — is a strong signal that the artifact created just before the cleanup is worth pulling.

---

## Extracting the file by inode

Sleuthkit's `icat` extracts a file's raw data blocks directly from its inode number, bypassing the need to mount the image (and working even on deleted files, provided the blocks have not been reallocated). The inode for `/etc/chat` — 32716 — was in the timeline output:

```
$ icat partition4.img 32716
NTczNDE3aDEzcl83aDRuXzdoM18xNDU3XzU4NTI3YmIyMjIK
```

The extracted content was base64-encoded — a common lightweight obfuscation trick to keep a flag from being caught by a `strings` or `grep` pass over the raw image.

---

## Decoding the flag

```
$ echo "NTczNDE3aDEzcl83aDRuXzdoM18xNDU3XzU4NTI3YmIyMjIK" | base64 -d
573417h13r_7h4n_7h3_1457_58527bb222
```

Read in leetspeak, that decoded to "stealthier_than_the_last" — a fitting message given that the entire challenge revolved around catching someone who tried and failed to cover their tracks.

`picoCTF{573417h13r_7h4n_7h3_1457_58527bb222}`

---

## What I took from this

This challenge walked through the standard DFIR timeline workflow end to end. Acquisition and triage came first — working from a preserved image and identifying the filesystem type before choosing tools. Timeline construction with `fls` and `mactime` produced a MAC(B) super-timeline covering every file event on disk. Baseline establishment meant recognising the wall of routine OS provisioning noise so it did not drown out real signal. Anomaly detection meant flagging files that did not belong (`/etc/chat` has no business existing on an Alpine system) and correlating them against known anti-forensic patterns (a suspiciously undersized shell history). The 16-second gap between artifact creation and history tampering was the kind of temporal correlation that turns two isolated observations into a coherent narrative of an attacker's session. Carving with `icat` pulled the file directly by inode, independent of whether it was still visible through a normal mount. And the final base64 decode reversed the lightweight obfuscation layer. Each of these steps — triage, timeline, baseline, anomaly, correlation, carve, decode — is a building block that scales directly to real incident response work, where the disk images are terabytes instead of megabytes and the timelines contain millions of entries instead of thousands, but the analytical process is identical.
