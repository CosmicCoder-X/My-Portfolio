---
title: 'Forensics Git 0'
target: 'picoCTF — Forensics Git 0'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Forensics challenge where a full disk image contained a Linux filesystem with a Git repository in a user's home directory, and the flag was embedded in a commit message found by examining the Git log after mounting the correct partition."
role: 'forensics'
tags: ['forensics', 'disk-image', 'git', 'partition', 'mount', 'picoctf']
problem: "A 1 GiB disk image file (disk.img) containing a full MBR partition table with three partitions. The hint asks how to extract a directory from the disk image."
action: "Identified the image as a full disk with file and fdisk, enumerated the partition table to find three partitions (two Linux, one swap), calculated byte offsets from sector numbers to mount partition 1 (which turned out to be a boot partition), then used losetup to mount partition 3 as the main root filesystem, navigated through the user home directory to find a Git repository in /home/ctf-player/Code/secrets/, and examined the Git commit log to find the flag in the commit message."
outcome: 'Found the flag in the Git commit message after mounting the correct partition and navigating to the secrets repository.'
draft: false
---

## Background

Forensics Git 0 is a picoCTF Forensics challenge about extracting data from a raw disk image. The challenge provides a single file — `disk.img` — with the hint "How can you extract the directory from the disk image?" Unlike challenges that provide a single filesystem partition, this image contains a full disk with an MBR partition table, requiring partition enumeration and offset calculations before any data can be accessed.

---

## Identifying the disk image

Started with standard file identification:

```
$ file disk.img
```

![Kali terminal showing the file command output for disk.img. The output reads "disk.img: DOS/MBR boot sector" followed by details of three partitions: partition 1 with ID=0x83, active, starting at sector 2048 with 614400 sectors; partition 2 with ID=0x82, starting at sector 616448 with 524288 sectors; and partition 3 with ID=0x83, starting at sector 1140736 with 956416 sectors.](/writeups/picoctf-forensics-git-0/01.png)

The output confirmed this was a full disk image with an MBR partition table, not a single filesystem. Three partitions were listed, and the partition type IDs indicated their purpose: `0x83` for Linux filesystems (partitions 1 and 3) and `0x82` for Linux swap (partition 2).

---

## Enumerating the partitions

Used `fdisk` for a cleaner view of the partition layout:

```
$ fdisk -l disk.img
```

![Kali terminal showing fdisk -l output. The disk is 1 GiB (1073741824 bytes, 2097152 sectors) with 512-byte sectors and a DOS disklabel. Three partitions are listed: disk.img1 (boot, start 2048, 614400 sectors, 300M, type 83 Linux), disk.img2 (start 616448, 524288 sectors, 256M, type 82 Linux swap/Solaris), and disk.img3 (start 1140736, 956416 sectors, 467M, type 83 Linux).](/writeups/picoctf-forensics-git-0/02.png)

The partition table showed a 300M boot partition (partition 1, marked active), a 256M swap partition (partition 2, not interesting for data recovery), and a 467M Linux partition (partition 3, likely the root filesystem). The sector size was 512 bytes, which was needed to calculate the byte offset for mounting.

---

## Mounting partition 1

Partition 1 started at sector 2048. Multiplying by the sector size gave the byte offset: 2048 × 512 = 1048576. Mounted it with the loop device and offset option:

```
$ mkdir /mnt/p1
$ mount -o loop,offset=1048576 disk.img /mnt/p1
```

![Kali terminal showing the mkdir and mount commands for partition 1. The mount command uses the loop option with offset=1048576 to mount the first partition from the disk image to /mnt/p1.](/writeups/picoctf-forensics-git-0/03.png)

Inspecting the contents revealed this was a boot partition — it contained kernel images and bootloader configuration but no user data. The flag was not here, so partition 3 was the next target.

---

## Mounting partition 3

Rather than manually calculating another offset for a second loop mount (which can cause conflicts with overlapping loop devices), used `losetup` with the `-P` flag to automatically create partition-mapped loop devices:

```
$ losetup -Pf --show disk.img
/dev/loop0

$ mount /dev/loop0p3 /mnt/p3
```

![Kali terminal showing the losetup command creating /dev/loop0, followed by mounting /dev/loop0p3 to /mnt/p3.](/writeups/picoctf-forensics-git-0/04.png)

The `-P` flag told `losetup` to scan the partition table and create sub-devices (`/dev/loop0p1`, `/dev/loop0p2`, `/dev/loop0p3`) for each partition, making it straightforward to mount any of them by name.

---

## Navigating the filesystem

With partition 3 mounted, explored the directory structure looking for user data:

```
$ ls -la /mnt/p3/home
ctf-player

$ ls -la /mnt/p3/home/ctf-player
Code

$ ls -la /mnt/p3/home/ctf-player/Code
secrets

$ ls -la /mnt/p3/home/ctf-player/Code/secrets
.git
note.txt

$ cat /mnt/p3/home/ctf-player/Code/secrets/note.txt
The picoCTF flag format is 'picoCTF{}' where there is some leetspeak phrase in between the curly braces
```

![Kali terminal showing a series of ls -la commands navigating through the mounted filesystem. The path /mnt/p3/home leads to ctf-player, then Code, then secrets, which contains a .git directory and a note.txt file. The cat command on note.txt shows the message about the picoCTF flag format being picoCTF{} with a leetspeak phrase inside.](/writeups/picoctf-forensics-git-0/05.png)

The trail led from `/home` to `ctf-player` to `Code/secrets/`, where two things were present: a `note.txt` explaining the flag format, and a `.git` directory. The note was a hint, not the flag itself — but the Git repository was exactly the kind of place where data gets committed and can be recovered from history even if the working tree has been cleaned up.

---

## Extracting the flag from Git history

The presence of a `.git` directory meant the flag could be in the commit history — stored in a commit message, a previous version of a file, or a diff. Checked the Git log:

```
$ git -C /mnt/p3/home/ctf-player/Code/secrets log
```

![Kali terminal showing the git log output for the secrets repository. A single commit is shown: hash 327681bb38cf467cec328eec9707b240e3e74ced (HEAD to master), authored by ctf-player on Wed Nov 19 08:49:27 2025, with the message "Wrap this phrase in the flag format: g17_1n_7h3_d15k_" followed by a redacted suffix.](/writeups/picoctf-forensics-git-0/06.png)

The commit message contained the flag content directly: "Wrap this phrase in the flag format" followed by the leetspeak phrase. Wrapping it in `picoCTF{}` as instructed by the note gave the flag.

The flag was retrieved.

---

## What I took from this

This challenge covered the full workflow of extracting data from a raw disk image — a fundamental skill in digital forensics. The key steps were: identifying the image type with `file` (full disk vs. single partition), enumerating the partition table with `fdisk` to find which partitions existed and what type they were, calculating byte offsets from sector numbers and sector sizes (offset = start_sector × sector_size), and mounting the correct partition using either manual loop mounts with offsets or the more convenient `losetup -P` approach that automatically maps partitions to devices. The challenge also demonstrated why partition 1 (boot) and partition 3 (root) needed to be checked separately — the boot partition contained only kernel and bootloader files, while the actual user data lived on the root filesystem. The Git angle added a layer: even after mounting the correct filesystem, the flag was not in any regular file's current contents but in the commit history. In real forensic investigations, Git repositories found on seized media are goldmines — they preserve every version of every file, complete with timestamps and author information, and `git log`, `git show`, and `git diff` can reconstruct a timeline of exactly what the user did with their code. Unlike shell history (which can be truncated) or filesystem timestamps (which can be touched), Git's object store is append-only by default, making it resistant to casual anti-forensic cleanup.
