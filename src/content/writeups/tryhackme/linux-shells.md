---
title: 'Linux Shells'
target: 'TryHackMe — Linux Shells (Cyber Security 101)'
difficulty: 'easy'
date: 2026-08-26
summary: 'Interacting with the Linux shell, the differences between Bash, Zsh and Fish, the building blocks of a shell script — variables, loops, conditionals — and a practical exercise that greps a keyword out of log files.'
role: 'pentest'
tags: ['Linux', 'Bash', 'Shell scripting', 'grep', 'CLI', 'Automation']
problem: 'The GUI does most things, but the shell does them faster, scriptably, and over a connection where a GUI isn''t an option — which is most of the time in security work.'
action: 'Worked through core shell commands, compared the common shells, built up scripts from variables to loops to conditionals, and fixed a broken log-search script to pull a flag.'
outcome: 'A working grasp of shell scripting fundamentals and a flag found by repairing and running a search script.'
---

Everything the GUI does with clicks, the shell does with commands — and once
you're working over SSH on a box with no desktop, the shell is all you have. This
room covers interacting with it, the shells worth knowing, and enough scripting to
automate the repetitive parts.

The shell itself is the facilitator between the user and the OS.

## Getting around

The handful of commands you use constantly:

```bash
pwd              # print working directory — where am I
cd Desktop       # change directory
ls               # list directory contents
cat file.txt     # print a file's contents
```

And the one that earns its reputation, `grep` — search a file for a word or
pattern, which on a large file is the difference between finding a line and
scrolling forever:

```bash
grep THM dictionary.txt
```

- Facilitator between user and OS: **Shell**
- Default shell in most distros: **Bash**
- Command to list directory contents: **ls**
- Command to search inside a file: **grep**

## Which shell

Bash is the default nearly everywhere, but it's not the only option. Check what
you're in, and what's installed:

```bash
echo $SHELL          # your current shell
cat /etc/shells      # every shell installed on the system
```

Switch temporarily by typing its name (`zsh`), or permanently with
`chsh -s /usr/bin/zsh`. The three worth knowing:

- **Bash** (Bourne Again Shell) — the default; strong scripting, history, tab
  completion.
- **Fish** (Friendly Interactive Shell) — built for ease of use, with auto spell
  correction, themes, and syntax highlighting out of the box.
- **Zsh** (Z Shell) — heavily customisable with advanced completion; a little
  slower for all its features.

- Shell with syntax highlighting out of the box: **Fish**
- Shell without auto spell correction: **Bash**
- Command showing previously executed commands this session: **history**

## Scripting building blocks

A shell script strings commands into one executable file. Four pieces make up the
basics.

**Shebang** — the first line, naming the interpreter:

```bash
#!/bin/bash
```

**Variables** — store a value once, reuse it by name:

```bash
#!/bin/bash
echo "Hey, what's your name?"
read name
echo "Welcome, $name"
```

`read` takes input into the variable; `$name` reads it back. Make it executable,
then run it:

```bash
chmod +x variable_script.sh
./variable_script.sh
```

**Loops** — repeat a block. This one counts 1 to 10:

```bash
#!/bin/bash
for i in {1..10}; do
  echo $i
done
```

`do` opens the loop body, `done` closes it, and `i` takes each value in turn.

**Conditionals** — branch on a test. Show a secret only to the right user:

```bash
#!/bin/bash
echo "Please enter your name first:"
read name
if [ "$name" = "Stewart" ]; then
  echo "Welcome Stewart! Here is the secret: THM_Script"
else
  echo "Sorry! You are not authorized to access the secret."
fi
```

Comments (`#`) document what each line does and are ignored at runtime.

- Shebang in a Bash script: **#!/bin/bash**
- Command giving executable permission: **chmod +x**
- Construct for iterative tasks: **Loops**

## The locker script

The room's exercise combines all three constructs — a loop to collect three
inputs, then a conditional checking all of them at once:

```bash
#!/bin/bash
username=""
companyname=""
pin=""
for i in {1..3}; do
  if [ "$i" -eq 1 ]; then
    echo "Enter your Username:"; read username
  elif [ "$i" -eq 2 ]; then
    echo "Enter your Company name:"; read companyname
  else
    echo "Enter your PIN:"; read pin
  fi
done
if [ "$username" = "John" ] && [ "$companyname" = "Tryhackme" ] && [ "$pin" = "7385" ]; then
  echo "Authentication Successful. You can now access your locker, John."
else
  echo "Authentication Denied!!"
fi
```

The `&&` chain is the point — all three conditions must hold, so the correct PIN
alongside the right username and company is **7385**.

## Practical: fixing the search script

The final exercise drops a broken script in `/home/user` that's meant to search
`.log` files for a keyword. Become root first so every log is readable:

```bash
sudo su
```

The script has empty `""` that need filling — the target directory and the flag
string. Completed:

```bash
#!/bin/bash
directory="/var/log"
flag="thm-flag01-script"

echo "Flag search in directory: $directory in progress..."

for file in "$directory"/*.log; do
  if grep -q "$flag" "$file"; then
    echo "Flag found in: $(basename "$file")"
  fi
done
```

`grep -q` runs quietly — it returns success or failure without printing, which is
exactly what a conditional wants. Make it executable and run it:

```bash
chmod +x flag_hunt.sh
./flag_hunt.sh
```

It reports the flag lives in **authentication.log**. And the room's throwaway
second question — a `grep` for "cat" in that same file answers where the cat is
sleeping (under the table):

```bash
grep "cat" /var/log/authentication.log
```

## What I took from this

Scripting is where the shell stops being a faster GUI and becomes a force
multiplier. The locker script is a toy, but the shape — collect input, test it,
branch — is every automation you'll write. And the practical exercise is the
honest version of real work: you're rarely writing a script from scratch, you're
reading someone else's, spotting the gap (the empty quotes), and filling it
correctly.

The `grep -q` detail is the one worth keeping. Inside a conditional you don't want
grep's output, you want its exit status — did it match or not — and `-q` gives you
exactly that. It's a small thing that turns grep from a display tool into a
decision your script can act on.
