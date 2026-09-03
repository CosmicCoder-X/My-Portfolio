---
title: 'Special'
target: "picoCTF — Special"
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF General Skills challenge where a shell autocorrected every command input, mangling standard commands. Bash parameter expansion syntax ${parameter=command} bypassed the spell checker and executed commands directly."
role: 'pentest'
tags: ['general-skills', 'bash', 'parameter-expansion', 'restricted-shell', 'spell-check', 'picoctf']
problem: "An SSH server running a custom 'Special' shell that automatically spell-checks and capitalises every word typed, making standard Linux commands unrecognisable to the interpreter."
action: "Connected via SSH and discovered that normal commands were being autocorrected. Experimented with bash parameter expansion syntax, found that ${parameter=command} executed the command as a default value assignment, used it to list directories, locate the flag file in blargh/flag.txt, and read it with input redirection."
outcome: 'Read the flag using parameter expansion to bypass the spell checker.'
draft: false
---

## Background

Special is a picoCTF General Skills challenge that presents a shell with a twist — every word typed is automatically spell-checked and corrected before the shell processes it. The challenge description introduces it as "Special, the Spell Checked Interface for Affecting Linux," a beta product that "properly spells and capitalises" every word "automatically and behind-the-scenes." In practice, this means that typing `ls` gets corrected to `Is` or `Ls`, `cat` becomes `Cat`, and essentially every standard Linux command is mangled before bash sees it.

---

## The spell-checked shell

Connected to the challenge server via SSH:

```
ssh -p 51065 ctf-player@saturn.picoctf.net
```

![Kali terminal showing SSH connection to saturn.picoctf.net on port 51065. The ED25519 host key fingerprint is displayed and accepted. The server is running Ubuntu 20.04.3 LTS on GNU/Linux 5.19.0-1024-aws x86_64. The standard Ubuntu welcome message is displayed. The prompt reads Special$.](/writeups/picoctf-special/01.png)

The server was running Ubuntu 20.04.3 LTS. The prompt — `Special$` — immediately confirmed this was not a standard bash session. Testing with `ls` revealed the problem:

![Special shell showing ls being autocorrected to Is, which returns sh: 1: Is: not found. The prompt returns to Special$.](/writeups/picoctf-special/02.png)

The shell corrected `ls` to `Is` (capitalising the L), and `sh` could not find a command called `Is`. Every standard command would suffer the same fate — the spell checker intercepted the input before the shell could interpret it, turning valid commands into capitalised words or entirely different dictionary words.

---

## Bypassing with parameter expansion

The challenge hint suggested experimenting with different shell syntax. The key was finding a syntax construct where the command appeared inside a structure that the spell checker would not touch. Bash parameter expansion — specifically the `${parameter=value}` syntax — turned out to be the answer.

The syntax `${parameter=value}` assigns a default value to a variable if it is not already set, and crucially, if the value is a command, bash executes it as part of the expansion. Since the entire construct is wrapped in `${}` braces and uses special characters, the spell checker did not process the contents the same way it processed bare words.

Worked through several syntax variations to find one that the shell would accept:

![Special shell showing a sequence of parameter expansion attempts. ${parameter?ls} returns sh: 1: parameter: ls. ${:ls} returns Bad substitution. ${parameter=ls} successfully outputs blargh. ${parameter=cat blargh} returns cat: blargh: Is a directory. ${parameter=cd blargh} echoes back the expansion without executing. ${parameter=ls blargh} outputs flag.txt. ${parameter=cat < blargh/flag.txt} outputs the flag picoCTF{5p311ch3ck followed by partially redacted content and _0c61d335} highlighted in a red box.](/writeups/picoctf-special/03.png)

The progression was methodical. `${parameter?ls}` used the error-message form of expansion, which printed `ls` as an error string rather than executing it. `${:ls}` was invalid syntax. But `${parameter=ls}` worked — it assigned `ls` as the default value, and in doing so, executed the command and returned `blargh`, a directory in the current working directory.

From there, the exploration was straightforward:

- `${parameter=cat blargh}` — confirmed `blargh` was a directory, not a file
- `${parameter=ls blargh}` — listed the contents, revealing `flag.txt`
- `${parameter=cat < blargh/flag.txt}` — used input redirection to read the flag file

The final command used `cat` with input redirection (`<`) rather than passing the file path as an argument, which successfully output the flag.

The flag was retrieved.

---

## What I took from this

This challenge highlighted how bash's parameter expansion syntax can serve as an execution vector that bypasses input filters. The spell checker was designed to intercept and correct bare words — a reasonable approach for catching standard commands typed directly at the prompt. But it did not account for the many ways bash can evaluate and execute strings that appear inside its special syntax constructs. The `${parameter=value}` form is just one of several expansion syntaxes (`${parameter:-value}`, `${parameter:+value}`, `${parameter:?value}`) that bash processes internally, and any of them could potentially bypass a filter that only inspects the surface-level input.

The broader lesson is about understanding the distinction between what a filter sees and what the shell ultimately processes. Command filters, restricted shells, and web application firewalls all face the same fundamental problem: there are far more ways to express a command in bash (or any shell) than a filter can reasonably anticipate. Parameter expansion, command substitution (`$()`), process substitution (`<()`), brace expansion, arithmetic expansion, and here-strings all provide alternative paths to command execution that do not look like conventional commands at the input layer. In penetration testing, this principle applies directly to WAF bypass techniques and shell escape scenarios where the goal is to find an execution path that the filter has not accounted for.
