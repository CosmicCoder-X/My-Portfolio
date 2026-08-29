---
title: 'Protocols and Servers 2'
target: 'TryHackMe — Protocols and Servers 2'
difficulty: 'easy'
date: 2025-08-28
summary: 'A blue-team oriented walkthrough of attacks against cleartext network protocols — sniffing POP3 credentials with tcpdump and Wireshark, understanding man-in-the-middle attacks against unencrypted channels, the role of TLS in upgrading protocols like HTTP, FTP, SMTP, POP3 and IMAP to their encrypted counterparts, SSH as a secure replacement for Telnet including SCP file transfers, and password attacks using THC Hydra to brute-force IMAP credentials.'
role: 'soc'
tags: ['network-security', 'sniffing', 'mitm', 'tls', 'ssh', 'hydra', 'pop3', 'imap', 'wireshark', 'tcpdump', 'password-attack', 'blue-team']
problem: 'Common network protocols like Telnet, HTTP, FTP, SMTP, POP3, and IMAP transmit data in cleartext, making them vulnerable to sniffing, man-in-the-middle attacks, and credential theft. The task is to understand these attack vectors, demonstrate credential capture from unencrypted POP3 traffic, explore how TLS and SSH mitigate these risks, and use THC Hydra to perform a dictionary attack against an IMAP service.'
action: 'Captured POP3 login credentials using tcpdump with port and ASCII output filters, confirmed the same capture in Wireshark with protocol display filters, reviewed the Ettercap and Bettercap MITM tooling landscape, studied the TLS handshake process and how it upgrades cleartext protocols to their encrypted equivalents, connected to a remote system over SSH and transferred files with SCP, and brute-forced an IMAP account password using THC Hydra with the rockyou wordlist.'
outcome: 'Extracted POP3 credentials (frank / D2xc9CgD) from both tcpdump and Wireshark captures, identified the TLS-secured port mappings for all major protocols, connected via SSH and confirmed kernel version 5.4.0-84-generic on the target, transferred files with SCP, and cracked the IMAP password for user lazie (butterfly) using Hydra.'
draft: false
---

## Background

This room is the security-focused follow-up to the introductory protocols and servers room. Where the first room covered how protocols like HTTP, FTP, SMTP, POP3, and IMAP work, this one examines what happens when those protocols are attacked — and how encryption mitigates the damage. The focus is on three core attack categories: sniffing (capturing credentials from cleartext traffic), man-in-the-middle attacks (intercepting and modifying traffic in transit), and password attacks (brute-forcing authentication). Each section demonstrates the vulnerability and then introduces the corresponding defence: TLS for encrypting the channel, SSH for replacing insecure remote access, and authentication hardening for resisting brute force.

The underlying theme is the CIA triad — Confidentiality, Integrity, and Availability — and how each attack maps to its opposite: Disclosure, Alteration, and Destruction. Sniffing compromises confidentiality, MITM compromises integrity, and exploited vulnerabilities (particularly DoS) compromise availability.

---

## Sniffing cleartext protocols

Any protocol that transmits data in cleartext is inherently vulnerable to sniffing. If an attacker has access to the network path between two communicating systems — through a wiretap, a switch with port mirroring, or a successful MITM position — they can capture and read everything that crosses the wire.

The demonstration uses POP3, which runs on port 110 and transmits usernames and passwords as plaintext `USER` and `PASS` commands. Capturing with tcpdump:

```
sudo tcpdump port 110 -A
```

The `port 110` filter restricts capture to POP3 traffic, and `-A` displays packet contents in ASCII. The output immediately reveals the credentials in the clear:

![Terminal showing tcpdump output filtering on port 110 — multiple packets between 10.20.30.1 and 10.20.30.148 on POP3, with USER frank visible in one packet and PASS D2xc9CgD visible in another, along with the server's +OK Password required response.](/writeups/thm-protocols-servers-2/01-tcpdump-pop3-capture.png)

The `USER frank` and `PASS D2xc9CgD` commands are transmitted as separate packets, both completely readable. The server responds with `+OK Password required` and then grants access — all visible to anyone capturing the traffic.

The same capture in Wireshark, filtering with `pop` in the display filter bar:

![Wireshark window showing pop3_packet_capture.pcapng — POP protocol filter applied, packet list showing the full POP3 session: +OK Hello there, USER frank, +OK Password required, PASS D2xc9CgD (highlighted with red arrows pointing to the username and password packets), +OK logged in, STAT, LIST, QUIT. The bottom pane shows the decoded Post Office Protocol with Request command PASS and Request parameter D2xc9CgD.](/writeups/thm-protocols-servers-2/02-wireshark-pop3-capture.png)

Wireshark's protocol dissector parses the POP3 commands into structured fields — the PASS command and its parameter `D2xc9CgD` are broken out in the packet details pane. The full session flow is visible: greeting, authentication, mailbox commands (STAT, LIST), and QUIT.

The tcpdump filter for capturing Telnet traffic specifically uses `port 23`, and the simplest Wireshark display filter for IMAP traffic is just `imap`.

---

## Man-in-the-middle attacks

A MITM attack occurs when an attacker positions themselves between two communicating parties, intercepting and potentially modifying traffic while both sides believe they're talking directly to each other. The classic example: a victim thinks they're sending $20 to a recipient, but the attacker intercepts the message and changes the amount before forwarding it.

Tools like Ettercap and Bettercap automate MITM attacks on local networks. Ettercap offers 3 different interfaces (text, curses, and GTK GUI), and Bettercap can be invoked in 3 ways as well.

![Ettercap documentation page — left side shows supported distributions (Debian/Ubuntu, Fedora, Gentoo, Pentoo, Mac OSX, FreeBSD, OpenBSD, NetBSD) and unsupported distributions (OpenSuSe, Solaris, Windows Vista/7/8). Right side lists compilation dependencies: Libpcap, Libnet1, Libpthread, Zlibc, Libtool, CMake 2.6, Flex, Bison, plus SSL dissection, GTK, NCurses, and Filter regex dependencies.](/writeups/thm-protocols-servers-2/03-ettercap-distributions.png)

Any cleartext protocol — HTTP, FTP, SMTP, POP3, IMAP — is vulnerable to MITM when there's no encryption layer to verify the integrity and authenticity of messages. The mitigation is cryptography: TLS provides both encryption (preventing eavesdropping) and authentication (preventing impersonation through certificate verification).

---

## TLS — upgrading cleartext protocols

TLS (Transport Layer Security) is the encryption layer that transforms vulnerable cleartext protocols into their secured equivalents. The upgrade adds a step between TCP connection establishment and application-layer communication: an SSL/TLS handshake that negotiates encryption parameters and verifies the server's identity through its certificate.

The handshake involves four stages: the client sends a ClientHello advertising its supported algorithms, the server responds with a ServerHello selecting parameters and providing its certificate, the client sends key exchange material, and both sides switch to encrypted communication. After this handshake, all subsequent traffic is encrypted — a packet capture sees only ciphertext.

The standard protocol-to-port mapping before and after TLS:

![Protocol port comparison table — HTTP on 80 becomes HTTPS on 443, FTP on 21 becomes FTPS on 990, SMTP on 25 becomes SMTPS on 465, POP3 on 110 becomes POP3S on 995, IMAP on 143 becomes IMAPS on 993.](/writeups/thm-protocols-servers-2/04-protocol-tls-ports.png)

DNS can also be secured with TLS — the three-letter acronym for this is **DoT** (DNS over TLS).

The browser handles certificate validation automatically when using HTTPS. It checks that the certificate is issued to the correct domain, signed by a trusted certificate authority, and hasn't expired. This is what prevents MITM attacks against HTTPS — the attacker can't produce a valid certificate for the target domain without compromising a certificate authority.

---

## SSH and SCP

SSH (Secure Shell) replaces Telnet as the secure method for remote system administration. It provides confidentiality (encrypted communication), integrity (tamper detection), and authentication (server identity verification) — the full CIA triad in a single protocol. SSH listens on port 22 by default and supports authentication via username/password or public key pairs.

Connecting to the target as user mark:

![Terminal showing SSH login — user@TryHackMe runs ssh mark@MACHINE_IP, enters password XBtc49AB, and receives the Debian 8 welcome message with last login timestamp.](/writeups/thm-protocols-servers-2/05-ssh-login-mark.png)

The first SSH connection to a new host prompts for fingerprint verification — this is the user's responsibility to confirm, since there's no third-party certificate authority in the SSH model. Accepting the fingerprint and connecting from a Kali attack box:

![Kali terminal — SSH connection to 10.10.106.207, first-time connection showing ED25519 key fingerprint verification prompt, then successful login to Ubuntu 20.04.3 LTS with kernel 5.4.0-84-generic, hostname bento.](/writeups/thm-protocols-servers-2/07-ssh-kali-connection.png)

The kernel release, obtained with `uname -r`, is `5.4.0-84-generic`.

SCP (Secure Copy Protocol) builds on SSH to provide encrypted file transfers. Transferring a file to the remote system:

```
scp document.txt mark@10.10.106.207:/home/mark
```

![Terminal showing SCP transfer — document.txt transferred to mark@10.10.106.207:/home/mark, 100% complete, 1997KB at 70.4MB/s.](/writeups/thm-protocols-servers-2/06-scp-transfer.png)

FTP can also be secured in two ways: FTPS (FTP over SSL/TLS) on port 990, or SFTP (FTP over SSH) which uses port 22 alongside the SSH service.

---

## Password attacks with THC Hydra

Authentication based on passwords is inherently susceptible to brute-force and dictionary attacks. THC Hydra automates the process of trying credentials against network services — it supports FTP, POP3, IMAP, SMTP, SSH, and HTTP among others.

The basic syntax is `hydra -l username -P wordlist.txt server service`, with useful flags like `-V` for verbose output (showing each attempt), `-s` for non-default ports, `-t` for parallel connections, and `-d` for debugging.

Interacting with the POP3 service manually via Telnet to verify that credentials work:

```
telnet MACHINE_IP 110
```

![Terminal showing Telnet session to POP3 port 110 — server greeting, USER frank / +OK frank, PASS D2xc9CgD / +OK 1 messages (179 octets), then STAT, LIST, RETR 1 retrieving an email from Mail Server to Frank with subject "Sending email with Telnet" and body "Hello Frank, I am just writing to say hi!", followed by QUIT.](/writeups/thm-protocols-servers-2/08-telnet-pop3-session.png)

The full POP3 session is visible: authentication, mailbox status check (1 message, 179 octets), listing, retrieving the email content, and disconnecting. Everything transmitted in cleartext.

Running Hydra against the IMAP service for user lazie:

```
hydra -l lazie -P rockyou.txt 10.10.71.43 imap -V
```

![Kali terminal showing Hydra v9.3 brute-forcing IMAP on 10.10.71.43 port 143 — 16 parallel tasks, verbose output showing each attempt from 123456 through butterfly, with the successful result: login lazie / password butterfly, 1 valid password found, attack completed.](/writeups/thm-protocols-servers-2/09-hydra-imap-bruteforce.png)

Hydra runs through the rockyou wordlist with 16 parallel threads, testing each password against the IMAP service. After 32 attempts, it finds the valid pair: `lazie` / `butterfly`. The verbose `-V` flag shows every attempt as it happens — useful for confirming the tool is working correctly and seeing progress.

The comprehensive protocol reference for this room:

![Protocol reference table — FTP (21, File Transfer, Cleartext), FTPS (990, File Transfer, Encrypted), HTTP (80, Worldwide Web, Cleartext), HTTPS (443, Worldwide Web, Encrypted), IMAP (143, Email MDA, Cleartext), IMAPS (993, Email MDA, Encrypted), POP3 (110, Email MDA, Cleartext), POP3S (995, Email MDA, Encrypted), SFTP (22, File Transfer, Encrypted), SSH (22, Remote Access and File Transfer, Encrypted), SMTP (25, Email MTA, Cleartext), SMTPS (465, Email MTA, Encrypted), Telnet (23, Remote Access, Cleartext).](/writeups/thm-protocols-servers-2/10-protocol-port-table.png)

Hydra's key options for reference:

![Hydra options table — -l username (login name), -P WordList.txt (password list), server service (target and service to attack), -s PORT (non-default port), -V or -vV (verbose, show attempts), -d (debugging output).](/writeups/thm-protocols-servers-2/11-hydra-options.png)

Mitigation against password attacks involves multiple layers: password policies enforcing complexity, account lockout after failed attempts, throttling authentication responses, CAPTCHA on GUI login pages, public key authentication (particularly effective for SSH), and two-factor authentication. No single measure is sufficient — combining several creates defense in depth.

---

## What I took from this

The room drives home a point that's easy to overlook once you're used to working with encrypted protocols: the default state of most network protocols is cleartext, and encryption is an add-on layer that had to be retrofitted. HTTP existed for years before HTTPS became standard, POP3 and IMAP still run on their cleartext ports by default in many configurations, and Telnet was the standard remote access tool until SSH replaced it. The protocols themselves weren't designed with security in mind — they were designed for functionality in a trusted network environment that no longer exists.

The tcpdump and Wireshark demonstrations make the risk concrete. Capturing `USER frank` and `PASS D2xc9CgD` from a POP3 session takes one command and zero effort. The same applies to any protocol running without TLS — FTP credentials, SMTP relay commands, HTTP form submissions. The mitigation is straightforward (use TLS everywhere), but the number of services still running cleartext in production environments is higher than it should be.

The Hydra section is a good reminder of why password policies matter from a defensive perspective. The rockyou wordlist found `butterfly` in 32 attempts — that's under a second with 16 parallel threads. Weak passwords combined with no account lockout and no rate limiting means automated tools will find valid credentials before a human analyst would notice the attempts in logs. The defense-in-depth approach (lockout + throttling + CAPTCHA + 2FA) exists because any single measure can be bypassed, but the combination makes automated attacks impractical.
