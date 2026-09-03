---
title: 'Operation Orchid'
target: 'picoCTF — Operation Orchid'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Forensics challenge where a disk image contained an encrypted flag file and a deleted plaintext copy. The shell history in .ash_history revealed the openssl encryption command with its password, and reversing it decrypted the flag."
role: 'forensics'
tags: ['forensics', 'disk-image', 'sleuthkit', 'openssl', 'encryption', 'ash-history', 'picoctf']
problem: "A disk image with three partitions containing evidence of file encryption and deletion. The flag was encrypted with openssl and the plaintext was shredded, but the encryption command and password were recorded in shell history."
action: "Identified the disk image with file, listed partitions with mmls, searched both Linux partitions with fls for flag-related files, found a deleted flag.txt and an encrypted flag.txt.enc on partition 3, discovered the openssl encryption command and password in .ash_history via icat, extracted the encrypted file, and reversed the openssl command to decrypt it."
outcome: 'Decrypted flag.txt.enc using the password from shell history and retrieved the flag.'
draft: false
---

## Background

Operation Orchid is a picoCTF Forensics challenge about recovering encrypted data from a disk image. The scenario presents a disk image where someone encrypted a flag file using openssl, then shredded the plaintext original — but left behind enough forensic evidence to reconstruct the decryption process. The challenge exercises a full disk forensics workflow: partition enumeration, file listing across partitions, shell history analysis, file extraction, and decryption.

---

## Identifying the disk image

Started with `file` to determine the image format:

```
$ file disk.flag.img
disk.flag.img: DOS/MBR boot sector; partition 1 : ID=0x83, active, start-CHS (0x0,32,33), end-CHS (0xc,223,19), startsector 2048, 204800 sectors; partition 2 : ID=0x82, start-CHS (0xc,223,20), end-CHS (0x19,159,6), startsector 206848, 204800 sectors; partition 3 : ID=0x83, start-CHS (0x19,159,7), end-CHS (0x32,253,11), startsector 411648, 407552 sectors
```

A full disk image with an MBR partition table — three partitions, two Linux (`0x83`) and one Linux swap (`0x82`). A quick `strings | grep -i picoctf` across the entire image returned nothing, so the flag was not stored as plaintext anywhere on the disk.

---

## Enumerating partitions with Sleuthkit

Used `mmls` from The Sleuth Kit to get a clean partition layout:

```
$ mmls disk.flag.img
DOS Partition Table
Offset Sector: 0
Units are in 512-byte sectors

      Slot      Start        End          Length       Description
000:  Meta      0000000000   0000000000   0000000001   Primary Table (#0)
001:  -------   0000000000   0000002047   0000002048   Unallocated
002:  000:000   0000002048   0000206847   0000204800   Linux (0x83)
003:  000:001   0000206848   0000411647   0000204800   Linux Swap / Solaris x86 (0x82)
004:  000:002   0000411648   0000819199   0000407552   Linux (0x83)
```

Two Linux partitions to search: partition 002 (starting at sector 2048) and partition 004 (starting at sector 411648). The swap partition was not useful for this investigation.

---

## Searching for the flag file

Used `fls` from The Sleuth Kit to recursively list files on each partition and grep for anything flag-related. The `-rp` flags tell `fls` to recurse into all directories and print the full path for each file. The `-o` flag specifies the partition's starting sector offset.

Partition 002 (sector 2048) came up empty:

```
$ fls -rp -o 0000002048 disk.flag.img | grep -i flag.txt
```

No results — this was the boot partition. Partition 004 (sector 411648) was more interesting:

```
$ fls -rp -o 0000411648 disk.flag.img | grep -i flag.txt
r/r * 1876(realloc):    root/flag.txt
r/r 1782:       root/flag.txt.enc
```

Two entries. The first — `r/r * 1876(realloc)` — was a deleted file, indicated by the asterisk (`*`). The `(realloc)` tag meant the inode had been reallocated to a different file, so the original content of `flag.txt` was likely overwritten. The second — `r/r 1782` — was `flag.txt.enc`, an existing (non-deleted) file. The `.enc` extension strongly suggested encryption.

---

## Examining the file contents

Used `icat` to extract file contents by inode number. First tried the deleted `flag.txt` at inode 1876:

```
$ icat -o 0000411648 disk.flag.img 1876
           -0.881573            34.311733
```

The inode had been reallocated — instead of the flag, it contained what appeared to be GPS coordinates. The original flag data was gone. Then tried `flag.txt.enc` at inode 1782:

```
$ icat -o 0000411648 disk.flag.img 1782
Salted__S�765+%�765⍟⍰+⍟O⍟⍰k⍟ђ(A⍟⍟⍟⍟c⍟⍟...
```

The output started with `Salted__` — the unmistakable header of an OpenSSL encrypted file. The `Salted__` prefix is followed by 8 bytes of salt, then the ciphertext. This confirmed the file was encrypted with OpenSSL using a salted key derivation, but the encryption algorithm and password were still unknown.

---

## Finding the encryption command in shell history

Listed all files in the `/root` directory to look for anything that might reveal how the encryption was performed:

```
$ fls -rp -o 0000411648 disk.flag.img | grep -i "root/"
r/r 1875:       root/.ash_history
r/r * 1876(realloc):    root/flag.txt
r/r 1782:       root/flag.txt.enc
```

The `.ash_history` file — the command history for the Almquist shell (ash), commonly used in Alpine Linux and BusyBox environments — was sitting right there at inode 1875. Extracted it:

```
$ icat -o 0000411648 disk.flag.img 1875
touch flag.txt
nano flag.txt
apk get nano
apk --help
apk add nano
nano flag.txt
openssl aes256 -salt -in flag.txt -out flag.txt.enc -k unbreakablepassword1234567
shred -u flag.txt
ls -al
halt
```

The entire operation was laid out in sequence. The user created `flag.txt`, installed nano to edit it, wrote the flag into it, then encrypted it with `openssl aes256` using the password `unbreakablepassword1234567`. After encryption, they ran `shred -u flag.txt` to securely delete the plaintext — `shred` overwrites the file's data blocks with random patterns before unlinking it, which is why the deleted inode at 1876 contained garbage coordinates instead of the flag. Finally, they ran `halt` to shut down the system.

The critical line was the OpenSSL command, which revealed the cipher (`aes256`), the salt flag (`-salt`), and the password (`unbreakablepassword1234567`).

---

## Extracting and decrypting the flag

Extracted the encrypted file to the local filesystem:

```
$ icat -o 0000411648 disk.flag.img 1782 > flag.txt.enc
```

Then reversed the OpenSSL command — swapping `-in` and `-out` targets and adding the `-d` flag for decryption:

```
$ openssl aes256 -d -salt -in flag.txt.enc -out flag.txt -k unbreakablepassword1234567
```

![Kali terminal showing the openssl decryption command. OpenSSL outputs a deprecation warning about key derivation, recommending -iter or -pbkdf2, followed by "bad decrypt" and a provider error about ossl_cipher_unpadblock. Despite the warning, cat flag.txt reveals the flag starting with picoCTF followed by content obscured by a red scribble and a closing brace.](/writeups/picoctf-operation-orchid/01.png)

OpenSSL printed a deprecation warning about the legacy key derivation method and a "bad decrypt" error related to padding — but it still produced output. The warning about `-iter` or `-pbkdf2` appeared because the encryption used the older `EVP_BytesToKey` key derivation rather than the more modern PBKDF2, and the padding error was a consequence of this version mismatch between the encrypting and decrypting OpenSSL versions. Despite the warnings, the decrypted `flag.txt` contained the flag.

The flag was retrieved.

---

## What I took from this

This challenge demonstrated a fundamental principle of forensic investigation: attackers who encrypt and shred their files can still leave behind the exact commands they used to do it. Shell history files — `.bash_history`, `.ash_history`, `.zsh_history` — are one of the most valuable artifacts in a filesystem forensic examination because they record commands verbatim, including arguments, passwords, and file paths. The user in this challenge took the step of shredding the plaintext flag (which successfully destroyed the file's data blocks, as confirmed by the reallocated inode returning garbage), but did not clear their shell history, which preserved the encryption password in plain text.

The `shred -u` command is worth understanding in detail. Unlike a simple `rm`, which only removes the directory entry and marks the inode and data blocks as free, `shred` overwrites the file's actual data blocks with random patterns multiple times before unlinking it. This is why `icat` on the deleted inode returned coordinates rather than the flag — the data blocks had been overwritten. However, `shred` has limitations: it is ineffective on journaling filesystems (like ext4) where the journal may retain copies of the original data, on copy-on-write filesystems (like Btrfs or ZFS) where modifications create new blocks rather than overwriting old ones, and on SSDs where wear-leveling may preserve the original data in different physical locations. In this challenge, the point was moot because the encryption password was recoverable from history, but in a real investigation, even a properly shredded file might be recoverable depending on the underlying filesystem and storage hardware.

The broader lesson is that secure deletion requires a comprehensive approach — encrypting the file, shredding the plaintext, clearing shell history, and ideally using full-disk encryption so that individual file operations are never exposed in the clear. Missing any one of these steps can unravel the entire effort, and forensic analysts know to check every possible artifact source before concluding that evidence has been truly destroyed.
