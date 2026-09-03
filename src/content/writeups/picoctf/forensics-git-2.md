---
title: 'Forensics Git 2'
target: 'picoCTF — Forensics Git 2'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Forensics challenge where a perpetrator's disk deletion was interrupted before Git objects were destroyed, and dumping all Git objects with cat-file recovered a deleted chat log file containing the flag."
role: 'forensics'
tags: ['forensics', 'disk-image', 'git', 'git-objects', 'data-recovery', 'picoctf']
problem: "A disk image from a perpetrator whose deletion routine was interrupted mid-operation. The Git repository's working tree is missing files, but the hint says the deletion was interrupted before any Git objects were touched."
action: "Mounted partition 3 from the disk image, found a Git repository at /home/ctf-player/Code/killer-chat-app with staged but uncommitted files, noticed logs/3.txt was missing from the working tree despite 1.txt, 2.txt, and 4.txt being present, then used git cat-file --batch-all-objects --batch piped through strings and grep to dump all stored Git objects and search for the flag."
outcome: 'Recovered the flag from the deleted logs/3.txt blob that still existed in the Git object store.'
draft: false
---

## Background

Forensics Git 2 is the third and most advanced challenge in the picoCTF Forensics Git series. The description says "The agents interrupted the perpetrator's disk deletion routine. Can you recover this git repo?" — indicating that someone was in the process of destroying evidence when they were stopped. The hint confirms that "the deletion was interrupted before any git objects were touched," which means the `.git/objects` directory is intact even though files have been removed from the working tree.

The disk image mounting process was the same as Git 0 and Git 1 — partition 3 was the Linux root filesystem. That process is covered in the Git 0 writeup and is not repeated here.

---

## Investigating the repository

After mounting partition 3, the repository was at `/mnt/p3/home/ctf-player/Code/killer-chat-app`:

```
$ ls -la /mnt/p3/home/ctf-player/Code/killer-chat-app
total 6
drwxr-sr-x 4 kali kali 1024 Nov 19 05:47 .
drwxr-sr-x 3 kali kali 1024 Nov 19 05:47 ..
-rwxr-xr-x 1 kali kali   25 Nov 19 05:47 client
drwxr-sr-x 9 kali kali 1024 May 11 08:52 .git
drwxr-sr-x 2 kali kali 1024 Nov 19 05:47 logs
-rwxr-xr-x 1 kali kali   25 Nov 19 05:47 server
```

![Kali terminal showing ls -la of the killer-chat-app directory. The directory contains a client executable (25 bytes), a .git directory, a logs directory, and a server executable (25 bytes). All files are dated Nov 19 05:47 except the .git directory which is dated May 11 08:52.](/writeups/picoctf-forensics-git-2/01.png)

This looked like a chat application project with client and server executables and a logs directory. The `.git` directory was present, confirming this was a Git repository. Checked the repository status:

```
$ git status
On branch master

No commits yet

Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
        new file:   client
        new file:   logs/1.txt
        new file:   logs/2.txt
        new file:   logs/4.txt
        new file:   server
```

![Kali terminal showing git status output. The repository is on branch master with no commits yet. The staged changes list five new files: client, logs/1.txt, logs/2.txt, logs/4.txt, and server. There is no logs/3.txt in the staged files.](/writeups/picoctf-forensics-git-2/02.png)

Two things were immediately notable. First, the repository had no commits — the files were staged (added to the index) but never committed. This was an unusual state that suggested the perpetrator was in the middle of setting up the repository when the deletion began. Second, the staged log files jumped from `logs/2.txt` to `logs/4.txt` — `logs/3.txt` was missing. In a sequential set of chat logs, a gap like this is suspicious. Either the file was never created, or it was deleted — and given the challenge description about an interrupted deletion routine, the latter was far more likely.

---

## Dumping all Git objects

The challenge hint said the Git objects were untouched. Even though `logs/3.txt` was not in the working tree or the staging area, its blob might still exist in the object store if it was ever added with `git add`. Git stores objects as content-addressed files in `.git/objects/` — once a blob is written there, removing the file from the working tree or the index does not delete the blob. It becomes an unreachable object, but it persists until garbage collection explicitly prunes it.

Rather than manually traversing trees and commits (of which there were none — no commits had been made), dumped every object in the store and searched for the flag:

```
$ git cat-file --batch-all-objects --batch | strings | grep -i "picoCTF\|3.txt"
```

![Kali terminal showing the git cat-file command output. The grep matches two lines: ".100644 3.txt" (a tree entry referencing the file) and "Jay: Ask Rusty at the door and use password picoCTF{g17_r35cu3_1..." followed by a redacted suffix and closing brace with a period.](/writeups/picoctf-forensics-git-2/03.png)

The command worked in three stages. `git cat-file --batch-all-objects --batch` enumerated and dumped the raw content of every Git object in the repository — commits, trees, blobs, and tags, including unreachable ones. `strings` extracted human-readable text from the raw binary data. `grep -i "picoCTF\|3.txt"` filtered for either the flag format or the missing filename.

The output confirmed two things: a tree entry referencing `3.txt` existed (shown as `.100644 3.txt` — the file mode and name from a tree object), and the blob itself contained the line "Jay: Ask Rusty at the door and use password picoCTF{...}" — a chat log entry where someone had shared a password that happened to be the flag.

The flag was retrieved.

---

## What I took from this

This challenge demonstrated the deepest level of Git forensics in the series. Git 0 found the flag in a commit message (visible with `git log`). Git 1 found it in a deleted file recoverable by checking out an older commit (`git checkout`). Git 2 went further — there were no commits at all, and the file was not even in the staging area, so neither `git log` nor `git checkout` would have helped. The flag survived only because Git's content-addressable object store retains blobs even after they are removed from the index. The `git cat-file --batch-all-objects --batch` command is the forensic equivalent of a full disk scan for Git repositories — it bypasses all of Git's referencing mechanisms (branches, tags, HEAD, the index) and reads the raw object database directly. In real investigations, this technique recovers data that the user believed was thoroughly deleted. The broader lesson across all three Git challenges is that Git's append-only architecture makes it exceptionally resistant to evidence destruction. Deleting a file from the working tree leaves the blob. Removing it from the index leaves the blob. Even committing its removal leaves the blob (referenced by the older commit). The only way to truly purge data from a Git repository is to rewrite history with tools like `git filter-repo` followed by aggressive garbage collection and a force push — and even then, clones, forks, and backups may retain the original objects.
