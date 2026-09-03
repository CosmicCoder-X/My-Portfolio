---
title: 'Specialer'
target: "picoCTF — Specialer"
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF General Skills challenge where most command binaries were removed from the system, leaving only bash builtins. Shell scripting with for loops, test operators, and input redirection ($(<file)) replaced ls and cat to enumerate directories and read the flag."
role: 'pentest'
tags: ['general-skills', 'bash', 'builtins', 'restricted-shell', 'shell-scripting', 'picoctf']
problem: "An SSH server where external command binaries (ls, cat, clear, etc.) have been removed. Only bash builtins are available, and the flag is hidden across multiple directories containing decoy files."
action: "Connected via SSH and discovered that standard commands were missing. Used tab completion to list available bash builtins, wrote a for loop with test operators ([ -d ] and [ -f ]) to enumerate directories and files, navigated into three subdirectories (abra, ala, sim), then used printf with input redirection $(<file) to read file contents without cat, finding the flag in ala/kazam.txt."
outcome: 'Read all files across three directories using bash builtins and found the flag in ala/kazam.txt.'
draft: false
---

## Background

Specialer is a picoCTF General Skills challenge and the sequel to Special. Where the original Special used a spell checker to mangle commands, Specialer takes a more direct approach — the command binaries themselves have been removed from the system. The challenge description introduces it as "a Secure Interface for Affecting Linux Empirically Rad," and the prompt `Specialer$` confirms that this is another custom shell environment. The objective is the same: find and read the flag using whatever tools remain available.

---

## The stripped-down shell

Connected to the challenge server and immediately tested basic commands:

![Specialer shell showing SSH connection to saturn.picoctf.net. After login, clear returns command not found, ls returns command not found, pwd returns /home/ctf-player, ll returns command not found, and cat *.* returns command not found.](/writeups/picoctf-specialer/01.png)

The commands `clear`, `ls`, `ll`, and `cat` all returned "command not found" — they were not on the system. But `pwd` worked, confirming the current directory as `/home/ctf-player`. The pattern was clear: external binaries in `/bin` and `/usr/bin` had been removed, but bash's internal builtins were still functional since they are compiled into the shell itself, not stored as separate files on disk.

Pressing Tab twice with an empty prompt listed every available command — all bash builtins:

![Specialer shell showing tab completion output. Available commands include: !, ./, :, [, [[, ]], alias, bash, bg, bind, break, builtin, caller, case, cd, command, compgen, complete, compopt, continue, coproc, declare, dirs, disown, do, done, echo, elif, else, enable, esac, eval, exec, exit, export, false, fc, fg, fi, for, function, getopts, hash, help, history, if, in, jobs, kill, let, local, logout, mapfile, popd, printf, pushd, pwd, read, readarray, readonly, return, select, set, shift, shopt, source, suspend, test, then, time, times, trap, true, type, typeset, ulimit, umask, unalias, unset, until, wait, while, {, }.](/writeups/picoctf-specialer/02.png)

This was the complete toolkit: `echo`, `printf`, `cd`, `pwd`, `for`, `while`, `if`, `test`, `[`, `read`, and the rest of the bash builtins. No `ls`, no `cat`, no `grep`, no `find` — everything had to be done with flow control, string operations, and I/O redirection.

---

## Enumerating with a for loop

Without `ls`, listing directory contents required building it from bash primitives. The glob `*` expands to all non-hidden entries in the current directory, and the test operators `[ -d ]` and `[ -f ]` distinguish directories from regular files. Combined in a for loop:

```
for file in *
do
    if [ -d "$file" ]; then
        echo "$file is a directory."
    elif [ -f "$file" ]; then
        echo "$file is a regular file."
    fi
done
```

![Specialer shell showing the for loop execution. The output lists three directories: abra is a directory, ala is a directory, sim is a directory.](/writeups/picoctf-specialer/03.png)

Three directories: `abra`, `ala`, and `sim`. The naming followed a magic-themed pattern — "abra," "ala," and "sim" as in "abracadabra," "alakazam," and "simsalabim."

Navigated into each directory and ran the same loop to enumerate their contents. The `abra` directory contained `cadabra.txt` and `cadaniel.txt`. The `ala` directory had `kazam.txt` and `mode.txt`. The `sim` directory contained `city.txt` and `salabim.txt`:

![Terminal showing cd ../ala followed by the for loop, revealing kazam.txt and mode.txt as files. Then cd ../ shows the home directory contents: .hushlogin, .profile, abra/, ala/, sim/. Then cd ../sim followed by the same for loop reveals city.txt and salabim.txt as files.](/writeups/picoctf-specialer/04.png)

Six text files spread across three directories, with only one containing the flag. The challenge was reading them without `cat`.

---

## Reading files with input redirection

Bash's `$(<file)` syntax reads a file's entire contents into a string — it is command substitution with input redirection, and since it is a shell-level operation rather than an external command, it works without any binaries. Combined with `printf`, this replaced `cat` entirely.

Wrote a nested loop to iterate over all three directories, read every file, and print its contents:

```
for folder in abra ala sim
do
    cd "$folder"
    for file in *
    do
        if [ -d "$file" ]; then
            echo "$file: directory."
        elif [ -f "$file" ]; then
            echo "$folder/$file:"
            printf "%s " $(<$file)
            printf "\n\n"
        fi
    done
    cd ..
done
```

![Specialer shell showing the nested for loop output. abra/cadabra.txt contains "Nothing up my sleeve!". abra/cadaniel.txt contains "Yes, I did it! I really did it! I'm a true wizard!". ala/kazam.txt contains "return 0 picoCTF{y0u_d0n7_4ppr3c1473_wh47_w3r3_d01ng_h3r3_a8567b6f}". ala/mode.txt contains "Yummy! Ice cream!". sim/city.txt contains a UUID "05ed181c-4aa0-4d4a-8505-2fe6ca9097d3". sim/salabim.txt contains "#He was so kind, such a gentleman tied to the oceanside#".](/writeups/picoctf-specialer/05.png)

The flag was in `ala/kazam.txt`, surrounded by decoy files containing whimsical messages. The other files — magic show quotes, a UUID, ice cream enthusiasm, and a poetic fragment — were all red herrings consistent with the magic theme.

`picoCTF{y0u_d0n7_4ppr3c1473_wh47_w3r3_d01ng_h3r3_a8567b6f}`

---

## What I took from this

This challenge was a practical lesson in the difference between bash builtins and external commands. In a standard Linux environment, the distinction rarely matters — `ls` and `cat` feel like part of the shell, but they are separate executables stored in `/bin` or `/usr/bin` that bash locates via the `PATH` variable. Builtins like `echo`, `printf`, `cd`, `pwd`, `for`, `if`, `test`, and `read` are compiled directly into the bash binary and remain available even when every external binary has been removed. The `type` builtin can distinguish between the two: `type ls` reports "/usr/bin/ls" while `type echo` reports "echo is a shell builtin."

The `$(<file)` syntax was the critical discovery. It is a bash-specific feature (not POSIX) that reads a file's contents without spawning a subprocess or requiring an external command. Unlike command substitution `$(cat file)` which needs the `cat` binary, `$(<file)` is handled entirely within bash's own I/O routines. In restricted environments — whether a CTF challenge, a minimal Docker container, a BusyBox system, or a compromised host where an attacker has tampered with binaries — knowing which operations bash can perform natively versus which ones require external programs is the difference between being able to operate and being completely locked out. The broader principle is that bash itself is a remarkably capable programming environment: loops, conditionals, string manipulation, arithmetic, file I/O, and even network operations (via `/dev/tcp`) are all available without a single external binary.
