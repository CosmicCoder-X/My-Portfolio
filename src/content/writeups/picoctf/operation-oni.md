---
title: 'Operation Oni'
target: 'picoCTF — Operation Oni'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Forensics challenge where an SSH private key was extracted from a disk image using Sleuthkit, then used to authenticate to a remote challenge server and retrieve the flag."
role: 'forensics'
tags: ['forensics', 'disk-image', 'sleuthkit', 'ssh', 'ed25519', 'icat', 'picoctf']
problem: "A gzip-compressed disk image containing a full MBR partition table. The task is to find credentials within the disk image that allow access to a remote challenge server where the flag is stored."
action: "Decompressed the disk image with gunzip, identified two Linux partitions with file and fsstat, listed files on each partition with fls to find the root filesystem, navigated to the .ssh directory where an Ed25519 private key was stored, extracted it with icat, set correct permissions with chmod, and used it to SSH into the challenge server."
outcome: 'Authenticated to the remote server with the extracted SSH key and read the flag from flag.txt.'
draft: false
---

## Background

Operation Oni is a picoCTF Forensics challenge that combines disk image analysis with SSH key recovery. The challenge provides a gzip-compressed disk image and a remote server endpoint. The objective is to extract authentication credentials from the disk image and use them to log into the challenge server where the flag resides. Unlike challenges where the flag is hidden somewhere in the disk image itself, this one requires using evidence from the image to access an external system.

---

## Decompressing and identifying the disk image

The challenge file was a gzip-compressed disk image. Started by identifying it with `file`, decompressing with `gunzip`, and examining the resulting image:

![Kali terminal showing ls revealing disk.img.gz, file identifying it as gzip compressed data originally named disk.img last modified Wed Oct 6 14:32:01 2021, gunzip decompressing it, ls confirming disk.img is now present, and file on disk.img showing DOS/MBR boot sector with partition 1 ID=0x83 active starting at sector 2048 with 204800 sectors and partition 2 ID=0x83 starting at sector 206848 with 264192 sectors.](/writeups/picoctf-operation-oni/01.png)

The decompressed `disk.img` was a full disk with an MBR partition table containing two Linux partitions (`0x83`). Partition 1 started at sector 2048 with 204800 sectors, and partition 2 started at sector 206848 with 264192 sectors. No swap partition this time — just two Linux filesystems to investigate.

---

## Examining partition 1

Used `fsstat` from The Sleuth Kit to check the filesystem type and metadata of partition 1 at offset 2048:

![Kali terminal showing fsstat -o 2048 disk.img output. File System Type is Ext4, Volume ID is 2a165fb5739b8ebd13454f994690b5e3. Last Written at 2021-10-06 10:31:45 EDT, Last Checked at 2021-10-06 10:28:55 EDT, Last Mounted at 2021-10-06 10:29:48 EDT. Unmounted properly, last mounted on /mnt/boot. Source OS is Linux with Dynamic Structure. Compat Features include Journal, Ext Attributes, Resize Inode, Dir Index. Journal ID is 00, Journal Inode is 8.](/writeups/picoctf-operation-oni/02.png)

The key detail was the mount point — `/mnt/boot`. This was a boot partition. Listed its contents with `fls` to confirm:

![Kali terminal showing fls -o 2048 disk.img output. The partition contains lost+found, ldlinux.sys, ldlinux.c32, config-virt, vmlinuz-virt, initramfs-virt, a symlink to boot, libutil.c32, extlinux.conf, libcom32.c32, mboot.c32, menu.c32, System.map-virt, vesamenu.c32, and a virtual directory $OrphanFiles at inode 25585.](/writeups/picoctf-operation-oni/03.png)

Bootloader files — `ldlinux.sys`, `vmlinuz-virt`, `initramfs-virt`, `extlinux.conf` — nothing useful for finding credentials. The root filesystem had to be on partition 2.

---

## Examining partition 2 — the root filesystem

Listed the root directory of partition 2 at offset 206848:

![Kali terminal showing fls -o 206848 disk.img output. The partition contains a full Linux directory structure: home, lost+found, boot, etc, proc, dev, tmp, lib, var, usr, bin, sbin, media, mnt, opt, root, run, srv, sys, and $OrphanFiles at inode 33049.](/writeups/picoctf-operation-oni/04.png)

This was the root filesystem — a complete Linux directory tree with `home`, `root`, `etc`, `var`, and all the standard directories. The interesting targets were `root` (the root user's home directory) and `home` (for any regular user accounts).

Navigating into the `root` directory and then into its `.ssh` subdirectory revealed SSH key files. Used `icat` to read the contents of the key files by their inode numbers — inode 2345 for the private key and inode 2346 for the public key:

![Kali terminal showing two icat commands. The first, icat -o 206848 disk.img 2345, outputs a full OpenSSH Ed25519 private key block starting with BEGIN OPENSSH PRIVATE KEY and ending with END OPENSSH PRIVATE KEY. The second, icat -o 206848 disk.img 2346, outputs the corresponding public key: ssh-ed25519 followed by the key data and the comment root@localhost.](/writeups/picoctf-operation-oni/05.png)

An Ed25519 SSH keypair belonging to `root@localhost`. The private key was the credential needed to authenticate to the challenge server. The public key confirmed the key type (`ssh-ed25519`) and that it was generated for the root user on the local machine.

---

## Extracting the private key

Extracted the private key to a local file using `icat` with output redirection:

![Kali terminal showing icat -o 206848 disk.img 2345 redirected to id_ed25519, followed by ls confirming disk.img and id_ed25519 are present in the working directory.](/writeups/picoctf-operation-oni/06.png)

Before using the key, its file permissions needed to be restricted. SSH enforces strict permission requirements on private key files — if the permissions are too open (readable by group or others), SSH will refuse to use the key entirely and fall back to password authentication. Set the permissions to `600` (read/write for owner only) with `chmod 600 id_ed25519`.

---

## SSH authentication and flag retrieval

With the extracted and permission-corrected private key, connected to the challenge server using the `-i` flag to specify the identity file:

```
ssh -i id_ed25519 -p 59807 ctf-player@saturn.picoctf.net
```

![Kali terminal showing the SSH connection to saturn.picoctf.net on port 59807 using the extracted Ed25519 key. The host key fingerprint is displayed and accepted. The server identifies as Ubuntu 20.04.5 LTS running on GNU/Linux 6.5.0-1023-aws x86_64. The welcome message shows documentation, management, and support URLs, along with a note that the system has been minimized. The prompt shows ctf-player@challenge.](/writeups/picoctf-operation-oni/07.png)

The SSH connection succeeded without prompting for a password — the extracted private key matched the server's authorized keys for the `ctf-player` account. The server was running Ubuntu 20.04.5 LTS on AWS infrastructure.

Listed the home directory and read the flag:

![Terminal showing ctf-player@challenge with ls revealing flag.txt, then cat flag.txt outputting picoCTF{k3y_5l3u7h_af277f77}.](/writeups/picoctf-operation-oni/08.png)

`picoCTF{k3y_5l3u7h_af277f77}`

---

## What I took from this

This challenge connected two disciplines that are frequently paired in real-world incident response: disk forensics and credential recovery. Extracting SSH keys from seized media is a standard forensic technique — private keys stored on a compromised system can be used to map out the attacker's lateral movement paths, identify which other systems they had access to, and in some cases, access those systems directly to assess the scope of the breach. The Ed25519 key type is worth noting: it is the modern default for OpenSSH, generating shorter keys (256-bit) that are faster to authenticate with and considered more secure than RSA keys of equivalent computational strength, based on the Twisted Edwards curve.

The challenge also reinforced the importance of SSH key management practices. The private key was stored unencrypted — no passphrase protected it, which meant anyone with read access to the file could use it immediately. In a production environment, SSH private keys should always be passphrase-protected so that even if the key file is exfiltrated, it cannot be used without the passphrase. The `chmod 600` step was a practical reminder of SSH's security model: the client refuses to use a key that is readable by other users on the system, because a key that anyone can read provides no authentication guarantee. This protection is enforced client-side, so bypassing it would require modifying the SSH client configuration — something that would itself be a red flag in an investigation. The broader pattern of disk image analysis followed by credential extraction and lateral access mirrors real attack chains, where defenders need to trace exactly which keys and credentials were available on each compromised host to determine the blast radius of an intrusion.
