---
title: 'Crack The Hash'
target: 'TryHackMe — Crack The Hash'
difficulty: 'easy'
date: 2026-08-26
summary: 'Identifying and cracking hashes across MD5, SHA1, SHA256, MD4, bcrypt, NTLM, sha512crypt and HMAC-SHA1 — where online lookups stop working and hashcat with the right mode takes over.'
role: 'pentest'
tags: ['Hashcat', 'Hash cracking', 'bcrypt', 'NTLM', 'sha512crypt', 'HMAC-SHA1', 'rockyou']
problem: 'A pile of hashes across different algorithms. The task is two-fold: identify what each one is, then choose the right method — a lookup for the weak ones, hashcat with the correct mode for the rest.'
action: 'Identified each hash, used online reversers for the unsalted legacy algorithms, then moved to hashcat with per-algorithm modes for bcrypt, NTLM, sha512crypt and HMAC-SHA1.'
outcome: 'Every hash cracked, and a working understanding of why some fall to a lookup and others need a wordlist and the right -m value.'
---

Hashing is one-way by design: a fixed-size digest you can verify against but can't
reverse. The catch is that "can't reverse" doesn't mean "can't guess" — if you
hash a wordlist and compare, a weak password falls regardless of the algorithm.
This room is a tour of that, from hashes so weak a website reverses them to ones
that need hashcat pointed at the correct mode.

## Identify before you crack

The one habit this room drills is identifying the algorithm first — the cracking
method depends entirely on it. A hash analyzer reads the length and format and
tells you what you're probably looking at:

![hash analyzer identifying MD5](/writeups/thm-crack-the-hash/01-hash-analyzer-md5.png)

`hashid` or `hash-identifier` on the command line do the same. One warning the room
teaches the hard way: these tools guess, and they're sometimes wrong — a 32-hex
string is *MD5 or MD4 or NTLM*, all identical in length. When one method fails,
re-identify before assuming the hash is hard.

## Level 1 — the ones a lookup cracks

The first hashes are unsalted legacy algorithms with huge public rainbow tables,
so an online reverser resolves them instantly:

- `48bb6e862e54f2a795ffc4e541caed4d` — MD5 → **easy**
- `CBFDAC6008F9CAB4083784CBD1874F76618D2A97` — SHA1 → **password123**
- `1C8BFE8F801D79745C4631D09FFF36C82AA37FC4CCE4FC946683D7B336B63032` — SHA256 → **letmein**
- `279412f945939ba78ce0758d3fd83daa` — MD4 → **Eternity22**

The point isn't that these algorithms are "broken" mathematically — it's that
they're unsalted and fast, so someone has already hashed every common password and
published the table. Salt and slowness are what defeat that, which is exactly what
the next hash demonstrates.

## The bcrypt wall

`$2y$12$Dwt1BZj6pcyc3Dy1FWZ5ieeUznr71EeNkJkUlypTsgbX1H68wsRom` breaks the pattern.
The `$2y$` prefix is bcrypt, which is salted and deliberately slow — no lookup
table exists, so this is where hashcat starts. Using the room's hint that the
password is short, a filtered wordlist plus bcrypt mode 3200:

```bash
hashcat -a 0 -m 3200 hash.txt new_Possible_Passwd.txt --force
```

![hashcat bcrypt command](/writeups/thm-crack-the-hash/02-hashcat-bcrypt-cmd.png)

`-a 0` is a dictionary attack; `-m 3200` is bcrypt. Result: **bleh**.

The `$prefix$` is the thing to learn here — it names the algorithm right in the
hash. `$2y$` bcrypt, `$6$` sha512crypt, and so on, which tells you the mode before
any tool does.

## Level 2 — hashcat and the right mode

**`F09EDCB1...C2D0C85`** — SHA256, cracked with `-m 1400` against rockyou →
**paule**.

**`1DFECA0C002AE40B8619ECF94819CC1B`** — this is the "don't trust one tool" lesson.
The analyzer misidentified it; it's actually **NTLM** (mode 1000). Once identified
correctly it cracks fast → **n63umy8lkf4i**. A 32-hex hash being NTLM rather than
MD5 is the exact ambiguity from earlier, and the reason to re-check when a crack
stalls.

**sha512crypt** — the salted, prefixed one:

```
$6$aReallyHardSalt$6WKUTqzq.UQQmrm0p/T7MPpMbGNnzXPMAXi4bJMl9be...
```

`$6$` is sha512crypt, hashcat mode **1800**. With a 6-character filtered list:

```bash
hashcat -a 0 -m 1800 hash.txt sixLetter.txt --force
```

![hashcat cracking sha512crypt](/writeups/thm-crack-the-hash/03-hashcat-sha512-cracked.png)

Result: **waka99**.

**HMAC-SHA1 with a salt** — `e5d8870e...e56d6`, salt `tryhackme`. With only a hash
and a salt (no key material), the mode is **160** (HMAC-SHA1, key = $salt). The
hash file has to be formatted as `hash:salt` first:

```bash
hashcat -a 0 -m 160 hash.txt rockyou.txt --force
```

![hashcat cracking HMAC-SHA1](/writeups/thm-crack-the-hash/04-hashcat-hmac-sha1-cracked.png)

Result: **481616481616**.

## What I took from this

The whole room reduces to two decisions: *what is this hash*, and *what does that
make the right attack*. Get the first wrong and you'll burn time cracking with the
wrong mode against a hash that would fall in seconds with the right one — the NTLM
case is exactly that trap.

The deeper point is why some hashes fold to a website and others don't. MD5 and
SHA1 aren't beaten by clever maths here; they're beaten by being fast and
unsalted, so the work was done once and tabulated. bcrypt and sha512crypt resist
because salt makes precomputation useless and slowness makes brute force
expensive. That's the actual security lesson under the puzzle — not "which
algorithm is broken," but "which properties make guessing impractical," which is
the thing that matters when you're choosing how to store passwords rather than
crack them.
