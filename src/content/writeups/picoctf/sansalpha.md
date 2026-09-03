---
title: 'SansAlpha'
target: "picoCTF — SansAlpha"
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF General Skills challenge where the remote shell blocked all alphabetic characters and backslashes, forcing the use of bash glob wildcards and character class negation to invoke /bin/base64 on the flag file."
role: 'pentest'
tags: ['general-skills', 'bash', 'globbing', 'wildcards', 'restricted-shell', 'base64', 'picoctf']
problem: "An SSH server where the shell rejects any input containing alphabetic characters or backslashes. The flag file exists somewhere on the filesystem but cannot be read using conventional commands."
action: "Connected via SSH and discovered that all alphabetic input was blocked. Used bash glob wildcards (? and *) to enumerate the filesystem from the root directory, identified /bin/base64 as a usable command, and refined the glob pattern with character class negation [!_] to avoid collisions with /bin/x86_64, then decoded the base64 output locally."
outcome: 'Decoded the base64 output to retrieve the flag.'
draft: false
---

## Background

SansAlpha is a picoCTF General Skills challenge that drops the solver into a restricted bash shell where every alphabetic character and the backslash are blocked. Any command containing a letter — `ls`, `cat`, `echo`, anything — is rejected with "Unknown character detected." The challenge description hints at a multiverse where keyboards only have numbers and symbols, and the objective is to read a flag file somewhere on the system using only those characters.

The solution relies on bash globbing — wildcard characters that the shell expands into matching file and directory paths before attempting to execute them. Since glob characters (`?`, `*`, `[]`) are symbols rather than letters, they pass through the character filter, and bash's pathname expansion does the rest.

---

## The restricted shell

Connected to the challenge server via SSH:

```
ssh -p <port> ctf-player@mimas.picoctf.net
```

The server was running Ubuntu 20.04.3 LTS. Immediately tested the restrictions by running `ls`:

![SSH session showing Welcome to Ubuntu 20.04.3 LTS on GNU/Linux 6.5.0-1014-aws x86_64. The SansAlpha prompt shows ls followed by the error message "SansAlpha: Unknown character detected". The prompt returns to SansAlpha$.](/writeups/picoctf-sansalpha/01.png)

The shell rejected the command entirely — "Unknown character detected." No alphabetic characters could be used, which ruled out every standard command. The backslash was also blocked, eliminating escape sequences and octal/hex character encoding tricks like `$'\x6c\x73'`. The only characters available were numbers, most symbols, and whitespace.

---

## Enumerating the filesystem with glob wildcards

Bash glob wildcards are symbols — `?` matches exactly one character, `*` matches zero or more, and `[...]` matches a character set — so they pass through the character filter. When bash expands a glob pattern, the result is a valid filesystem path, and if that path is the first word in a command, bash tries to execute it. This meant that globbing could serve double duty: discovering what exists on the filesystem and executing binaries without ever typing their names.

Started from the root directory, adding one `?` at a time to map out path lengths:

![Terminal showing glob enumeration from root. /? returns No such file or directory. /?? returns No such file or directory. /??? returns bash: /bin: Is a directory. /???? returns bash: /boot: Is a directory. /????? returns bash: /lib32: Is a directory. /?????? returns bash: /libx32: Is a directory. /??????? returns No such file or directory.](/writeups/picoctf-sansalpha/02.png)

Each pattern returned only the first match, which was a quirk of this shell — unlike a standard bash environment where glob expansion produces all matches, this one appeared to return only the first alphabetically. The results revealed the standard Linux root directory structure: `/bin` (3 chars), `/boot` (4 chars), `/lib32` (5 chars), `/libx32` (6 chars).

The `/bin` directory was the most interesting — it contains essential command binaries. The challenge hint mentioned base64, so the target was `/bin/base64`. The flag file's full path, discovered through further glob enumeration, was `/home/ctf-player/blargh/flag.txt`.

---

## The collision problem

The first attempt was to glob `/bin/base64` and pass it the flag file path, also globbed:

```
/???/?????? /????/???????????/??????/????????
```

![Terminal showing /???/?????? matching /bin/base32, which complains about extra operand /bin/base64. A second attempt with the full flag path also fails with the same base32 error.](/writeups/picoctf-sansalpha/03.png)

The problem was that `/???/??????` matched `/bin/base32` before `/bin/base64` — both are 6-character names in a 3-character directory. Since bash returned the first match alphabetically, `base32` always won, and `/bin/base64` became an unexpected extra operand that `base32` rejected.

Tried narrowing the pattern to `/???/????64` to match only names ending in `64`:

![Terminal showing /???/????64 matching /bin/x86_64 instead, which complains about extra operand for the flag path.](/writeups/picoctf-sansalpha/04.png)

This time `/bin/x86_64` collided — it also matched `????64` and came first alphabetically. The underscore in `x86_64` was the distinguishing feature: `base64` has no underscore at position 4, but `x86_64` does (the `_` is the 4th character).

---

## Character class negation

The solution was to use bash's character class negation `[!_]` to exclude the underscore at the 4th position, which would filter out `x86_64` while keeping `base64`:

```
/???/???[!_]64 /????/???????????/??????/????????
```

![Terminal showing the refined glob command /???/???[!_]64 successfully matching /bin/base64 and encoding the flag file. The output is a base64 string: cmV0dXJuIDAgcGljb0NURns3aDE1X211MTcxdjNyNTNfMTVfbTRkbjM1NV8xNDUyNTZlY30=.](/writeups/picoctf-sansalpha/05.png)

The `[!_]` at position 4 excluded any filename with an underscore there — eliminating `x86_64` from the match set while keeping `base64`. The command successfully executed `/bin/base64` on the flag file and produced a base64-encoded string.

---

## Decoding the flag

Copied the base64 string back to the local Kali machine and decoded it:

```
$ echo "cmV0dXJuIDAgcGljb0NURns3aDE1X211MTcxdjNyNTNfMTVfbTRkbjM1NV8xNDUyNTZlY30=" | base64 -d
```

![Kali terminal showing the echo and base64 decode command. The output reads return 0 picoCTF{7h15_mu171v3r53 followed by content obscured by a red scribble and a closing brace.](/writeups/picoctf-sansalpha/06.png)

The flag was retrieved.

---

## What I took from this

This challenge was an exercise in operating within extreme constraints — a shell that stripped away the most fundamental building block of command-line interaction (letters) and forced a completely different approach to filesystem navigation and command execution. The key insight was that bash glob expansion happens before command execution and uses only symbols, which meant the character filter never saw the alphabetic characters in the expanded paths. The shell checked the input string for letters, found none (only `?`, `*`, `[`, `!`, `]`, `/`, and spaces), and passed it through to bash's glob engine, which expanded the wildcards into full paths containing the letters the filter was designed to block.

The collision problem — where multiple binaries matched the same glob pattern — was the real puzzle. Bash's glob expansion sorts matches alphabetically and the restricted shell returned only the first one, so `/bin/base32` would always beat `/bin/base64` in a pattern that matched both. Character class negation (`[!_]`) was the surgical tool that resolved this: by excluding a single character at a specific position, it eliminated `x86_64` from the match set without affecting `base64`. This kind of precision globbing is rarely needed in everyday shell usage, but it demonstrates a deeper understanding of how bash processes pathname expansion — knowledge that translates directly to constructing complex `find` patterns, writing robust shell scripts that handle unusual filenames, and understanding how restricted shells and command filters can be bypassed in penetration testing scenarios.
