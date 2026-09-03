---
title: 'Forensics Git 1'
target: 'picoCTF — Forensics Git 1'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Forensics challenge building on Git 0, where the flag was added in an earlier commit and then removed in the latest one. Checking out the previous commit restored flag.txt with the flag inside."
role: 'forensics'
tags: ['forensics', 'disk-image', 'git', 'git-history', 'partition', 'picoctf']
problem: "The same disk image setup as Forensics Git 0, but this time the secrets directory contains only a .git folder with no visible files — the flag was committed and then deleted in a subsequent commit."
action: "Mounted partition 3 from the disk image using the same approach as Git 0, navigated to the Git repository in /home/ctf-player/Code/secrets/, examined the Git log to find two commits (Add flag followed by Remove flag), checked out the earlier commit to restore the working tree to its previous state, and read the recovered flag.txt."
outcome: 'Recovered flag.txt by checking out the commit where it was originally added, before it was removed.'
draft: false
---

## Background

Forensics Git 1 is the sequel to Forensics Git 0 — same disk image format, same filesystem layout, but a different Git-based hiding technique. The hint asks "How can you checkout the files of a previous commit?" — directly indicating that the flag existed in an older commit and was subsequently deleted. Where Git 0 stored the flag in a commit message, Git 1 stores it in a file that was committed and then removed, requiring the investigator to recover a previous version of the repository's working tree.

The disk image mounting process was identical to Git 0 — identifying the MBR partition table, enumerating partitions with `fdisk`, and mounting partition 3 (the Linux root filesystem) using `losetup -Pf`. That process is covered in the Git 0 writeup and is not repeated here.

---

## Locating the repository

After mounting partition 3, navigated to the user's home directory:

```
$ ls /mnt/p3
bin boot dev etc home lib lost+found media mnt opt proc root run sbin srv swap sys tmp usr var

$ ls /mnt/p3/home
ctf-player

$ ls /mnt/p3/home/ctf-player
Code

$ ls /mnt/p3/home/ctf-player/Code
secrets

$ ls -la /mnt/p3/home/ctf-player/Code/secrets
total 3
drwxr-sr-x 3 kali kali 1024 Nov 19 04:20 .
drwxr-sr-x 3 kali kali 1024 Nov 19 04:20 ..
drwxr-sr-x 8 kali kali 1024 Nov 19 04:20 .git
```

![Kali terminal showing a series of ls commands navigating the mounted filesystem. Starting from /mnt/p3 showing a standard Linux root directory structure, through /home to ctf-player, then Code, then secrets. The final ls -la of the secrets directory shows only a .git directory — no note.txt or flag.txt in the working tree.](/writeups/picoctf-forensics-git-1/01.png)

Unlike Git 0, the secrets directory contained only a `.git` folder — no `note.txt`, no `flag.txt`, nothing in the working tree at all. Whatever files had been here were deleted. But the `.git` directory preserved the full history.

---

## Examining the Git history

Checked the commit log:

```
$ git -C /mnt/p3/home/ctf-player/Code/secrets log
```

![Kali terminal showing git log output with two commits. The latest commit (HEAD to master) is 5fb8194539c770a830b8ba089a50778c07072b03 by ctf-player on Wed Nov 19 09:20:05 2025 with message "Remove flag". The earlier commit is 177789af0b300e043ea8f54ea57d6cee352291ae by ctf-player on the same date with message "Add flag".](/writeups/picoctf-forensics-git-1/02.png)

Two commits, both made on the same day at the same time. The earlier commit (`177789a`) had the message "Add flag" and the latest commit (`5fb8194`, currently at HEAD) had the message "Remove flag". The narrative was clear — someone committed a flag file and then immediately committed its deletion. The current working tree reflected the state after the removal, which is why the directory appeared empty.

---

## Checking out the previous commit

The hint had already telegraphed the solution: check out the files from the previous commit. Navigated into the repository and checked out the "Add flag" commit by its hash:

```
$ git checkout 177789af0b300e043ea8f54ea57d6cee352291ae
```

![Kali terminal showing the git checkout command with the full commit hash. Git outputs a detached HEAD warning explaining that the HEAD is now at 177789a with the message "Add flag". The warning includes instructions about creating a new branch or undoing the operation.](/writeups/picoctf-forensics-git-1/03.png)

Git switched to a detached HEAD state at the "Add flag" commit. The working tree was now restored to the state it was in before the removal — any files that existed at that point would reappear in the directory.

---

## Recovering the flag

Listed the directory contents after the checkout:

```
$ ls -la
total 4
drwxr-sr-x 3 kali kali 1024 May 11 07:09 .
drwxr-sr-x 3 kali kali 1024 Nov 19 04:20 ..
-rw-r--r-- 1 root kali   31 May 11 07:09 flag.txt
drwxr-sr-x 8 kali kali 1024 May 11 07:09 .git

$ cat flag.txt
picoCTF{g17_r3m3mb3r5_c...}
```

![Kali terminal showing ls -la output after checking out the old commit. The directory now contains flag.txt (31 bytes, dated May 11 07:09) alongside the .git directory. The cat command on flag.txt shows picoCTF{g17_r3m3mb3r5_c followed by a redacted suffix and closing brace.](/writeups/picoctf-forensics-git-1/04.png)

The `flag.txt` file was back — 31 bytes, containing the flag. The checkout had restored the working tree to its state at the "Add flag" commit, making the previously deleted file accessible again.

The flag was retrieved.

---

## What I took from this

This challenge demonstrated a fundamental property of Git: deleting a file and committing the deletion does not erase the file from the repository. Git's object store is append-only — every version of every file that was ever committed is preserved as a blob object, and every commit is a snapshot of the entire tree at that point in time. The "Remove flag" commit did not destroy the flag's data; it simply recorded a new tree state that no longer included it. Checking out any earlier commit restores the full working tree as it existed then, including all files that were later deleted. This is why `git log`, `git checkout`, `git show`, and `git diff` are essential tools in forensic analysis of repositories found on seized media. Even when a user believes they have deleted sensitive data by committing its removal, the data persists in the object store unless the user takes additional steps like `git filter-branch`, `git filter-repo`, or garbage collection with aggressive pruning — and even those can sometimes be reversed if the objects have not yet been physically removed from the packfile. In incident response, the first thing to do with a recovered Git repository is examine the full reflog and commit history, because it is effectively an immutable audit trail of everything the user did with their files.
