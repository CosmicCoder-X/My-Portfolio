---
title: 'SpookyPass'
target: 'Hack The Box — SpookyPass'
difficulty: 'easy'
date: 2025-08-29
summary: 'A beginner reversing challenge — extracting a hardcoded plaintext password from an ELF binary using strings and supplying it at runtime to retrieve the flag.'
role: 'pentest'
tags: ['reversing', 'strings', 'elf', 'checksec', 'static-analysis', 'hardcoded-credentials']
problem: 'An ELF binary prompts for a password before revealing the flag. The password is stored as a plaintext string with no obfuscation.'
action: 'Confirmed ELF type with filetype and checked protections with checksec. Ran strings against the binary and found the hardcoded password s3cr3t_p455_f0r_gh05t5_4nd_gh0ul5 in plaintext. Supplied it at runtime to retrieve the flag.'
outcome: 'Flag: HTB{un0bfu5c4t3d_5tr1ng5}. The entire solve was strings plus runtime input -- no disassembly needed.'
draft: false
---

## Background

SpookyPass is a Halloween-themed reversing challenge that tests whether you check the obvious before reaching for heavy tools. The binary asks for a password and gives you the flag if you get it right. The entire solve is three commands.

---

## File analysis

Starting with the basics — identifying the file type and checking what protections are in place.

```
filetype -f pass
```

The output confirms it's an ELF executable. Running `checksec` shows standard protections: Partial RELRO, Stack Canary, NX enabled, and PIE enabled. These would matter if the challenge involved exploitation, but for static analysis they're irrelevant — the password still has to live somewhere in the binary for the comparison to work.

---

## Extracting the password

Running `strings` against the binary and piping through `less` dumps every printable string sequence. Among the standard ELF metadata, GCC version strings, and GLIBC symbols, the password sits in plaintext: **s3cr3t_p455_f0r_gh05t5_4nd_gh0ul5**. The surrounding strings — "Welcome to the", "SPOOKIEST", "party of the year", "Before we let you in, you'll need to give us the password" — confirm this is the authentication prompt's hardcoded comparison value.

![Strings output from the pass binary showing printable content including the hardcoded password s3cr3t_p455_f0r_gh05t5_4nd_gh0ul5, the welcome messages, and standard ELF metadata like GCC version, GLIBC symbols, and main.c source reference.](/writeups/htb-spookypass/01-strings-output.png)

---

## Getting the flag

Running the binary, it prints the spooky welcome banner and prompts for the password. Supplying `s3cr3t_p455_f0r_gh05t5_4nd_gh0ul5` passes the check — "Welcome inside!" followed by the flag: **HTB{un0bfu5c4t3d_5tr1ng5}**.

![Terminal showing filetype confirming pass as an ELF binary, checksec output with Partial RELRO and Stack Canary and NX and PIE enabled, strings piped through less, and finally executing the binary with the extracted password to receive HTB{un0bfu5c4t3d_5tr1ng5}.](/writeups/htb-spookypass/02-checksec-strings-flag.png)

---

## What I took from this

The flag name says it all — **un0bfu5c4t3d_5tr1ng5**. The password was stored as a plaintext string in the binary with no obfuscation, no encoding, no runtime decryption. The `strings` utility exists precisely for this kind of low-hanging fruit, and it's always worth running before opening a disassembler. In real-world binaries, hardcoded credentials show up more often than they should — API keys, database passwords, encryption secrets — and `strings` catches every one that isn't deliberately hidden. The challenge is a reminder that the simplest tool is often the right first step.
