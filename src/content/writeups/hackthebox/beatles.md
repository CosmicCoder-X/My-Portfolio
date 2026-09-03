---
title: 'Beatles'
target: 'Hack The Box — Beatles'
difficulty: 'easy'
date: 2025-08-29
summary: 'A forensics challenge — ROT13-encoded message hints at a four-character zip password, cracked with fcrackzip to reveal a Beatles logo JPG. Steghide extraction with passphrase THEBEATLES yields a hidden ELF binary containing a base64-encoded flag.'
role: 'forensics'
tags: ['steganography', 'rot13', 'zip-cracking', 'fcrackzip', 'steghide', 'elf-binary', 'base64', 'strings', 'rockyou']
problem: 'The challenge provides a zip file containing a text message (m3ss@g#_f0r_pAuL) encoded in an unreadable format and a password-protected BAND.zip. The task is to follow the breadcrumbs — decode the message, crack the zip, and extract the flag from whatever is hidden inside.'
action: 'Decoded the ROT13 message revealing a four-character passphrase hint and the tool name fcrackzip. Cracked BAND.zip with fcrackzip/rockyou.txt (password: pass). Ran steghide on the extracted Beatles logo JPG with passphrase THEBEATLES, extracting a hidden ELF binary. Ran strings on the binary to find a base64-encoded flag and decoded it.'
outcome: 'Recovered the flag HTB{S0rRy_My_FR13nD} by decoding the base64 string extracted via strings from the hidden ELF binary. The challenge chained ROT13 decoding, zip cracking, steghide extraction with a contextual passphrase, and static analysis of a binary.'
draft: false
---

## Background

Beatles is a multi-layered forensics challenge that chains several common CTF techniques together — ROT13, zip cracking, steganography, and binary analysis. Each step reveals a clue for the next, and the Beatles theme runs throughout. The challenge is more about recognising each encoding and knowing which tool to reach for than about any single difficult step.

---

## The encoded message

The challenge zip contains two items: a text file named `m3ss@g#_f0r_pAuL` and a password-protected `BAND.zip`. Opening the text file shows garbled but structured text — it's clearly a letter with line breaks, a greeting, a body, a sign-off, and a postscript, but every word is shifted.

![Terminal showing the contents of m3ss@g#_f0r_pAuL with numbered lines — line 1 reads Url Cnhy, line 3 reads Zl Sbyqre unf cnffcuenfr jvgu sbhe (4) punenpgref, line 5 reads Pbhyq lbh spenpx vg sbe zr, line 7 reads V fraq lbh n zrffntr sbe bhe Gbhe arkg zbagu, line 9 reads Qba'g Funer vg jvgu bgure zrzoref bs bhe onaq, line 11 reads -Wbua Yraaba, line 14 reads CF: Crnpr naq Ybir zl sevraq... Orngyrf Onaq sbe rire!](/writeups/htb-beatles/01-rot13-encoded.png)

The structure and the letter-like format suggest a simple substitution cipher. The sign-off `-Wbua Yraaba` is a strong hint — that's seven and six characters, matching "John Lennon". It's ROT13.

---

## ROT13 decode

Piping the file through `rot13` decodes it instantly:

![Terminal running cat m3ss@g#_f0r_pAuL piped through rot13, showing the decoded message — Hey Paul, My Folder has passphrase with four (4) characters, Could you fcrack it for me, I send you a message for our Tour next month, Don't Share it with other members of our band, signed John Lennon, PS Peace and Love my friend Beatles Band for ever!](/writeups/htb-beatles/02-rot13-decoded.png)

The decoded message from John Lennon to Paul reveals three useful things: the zip passphrase is **four characters** long, the word "fcrack" is a hint toward the tool **fcrackzip**, and the Beatles theme confirms the band context. The message also mentions a hidden tour message — that's what's waiting inside the zip.

---

## Cracking the zip

The message says the passphrase is four characters and practically names the tool. Running `fcrackzip` with dictionary mode against `rockyou.txt` cracks it immediately — the password is **pass**.

![Terminal running fcrackzip -u -D -p /usr/share/wordlists/rockyou.txt BAND.zip, with the result PASSWORD FOUND pw == pass.](/writeups/htb-beatles/03-fcrackzip.png)

With a four-character password like `pass`, a targeted wordlist generated with `crunch` would have been the cleaner approach, but `rockyou.txt` finds it in under a second anyway — `pass` is one of the most common passwords in the list.

---

## The Beatles image

Extracting `BAND.zip` with the password `pass` reveals `BAND.JPG` — a 1600x1067 pixel image of The Beatles logo with the silhouettes of the four band members.

![Image viewer showing BAND.JPG — the iconic The Beatles logo in black text with silhouettes of four band members with arms outstretched below, 1600 by 1067 pixels, 77.6 kB.](/writeups/htb-beatles/04-beatles-image.png)

A JPG file with a challenge that mentions a hidden message — steganography is the obvious next step. The question is which tool and which passphrase.

---

## Steghide extraction

After trying several steganography tools, the passphrase turned out to be guessable from context — **THEBEATLES**, taken directly from the image content. Running `steghide extract -sf BAND.JPG` with this passphrase extracts a file called `testabeatle.out`. Checking it with `file` reveals it's an **ELF 64-bit LSB pie executable** — a Linux binary, not stripped.

![Terminal running steghide extract -sf BAND.JPG, entering the passphrase, extracting testabeatle.out, then running file on it showing ELF 64-bit LSB pie executable x86-64 version 1 SYSV dynamically linked interpreter /lib64/ld-linux-x86-64.so.2 for GNU/Linux 2.6.32 not stripped.](/writeups/htb-beatles/05-steghide-extract.png)

The passphrase `THEBEATLES` is in the `rockyou.txt` wordlist, so a brute-force with `stegcracker` would have found it eventually — but guessing it from the image saved the wait.

---

## The binary challenge

Running the ELF binary presents an interactive challenge — it greets Paul, warns about being hacked, and poses math questions. Answering them correctly (5+5 = 10, 5+5-5*(5/5) = 5, and a longer arithmetic expression = 40) reveals a base64-encoded string as the "message".

![Terminal output from running the ELF binary showing the interactive challenge — Hey Paul If you are here Give my your favourite character, then math questions with results 10, 5, and 40, followed by Hey Paul nice this is the message and a long base64 string, ending with WTF You are not Paul SOS SOS SOS HACKER HERE I will call the police and END OF CHALLENGE.](/writeups/htb-beatles/06-elf-challenge.png)

The binary also works with `strings` — the base64 string is embedded as a plaintext constant, so playing through the interactive challenge isn't strictly necessary. Either way, the base64 string is the final layer.

---

## Decoding the flag

Decoding the base64 string reveals John's tour message and the flag:

![Terminal running echo on the base64 string piped through base64 -d, outputting — The tour was canceled for the following month, I'll go out for dinner with my girlfriend named Yoco, and the flag HTB{S0rRy_My_FR13nD}.](/writeups/htb-beatles/07-base64-flag.png)

The flag: **HTB{S0rRy_My_FR13nD}**

The decoded message completes the narrative — John's secret tour message to Paul was that the tour is cancelled and he's going to dinner with his girlfriend instead. Sorry, Paul.

---

## What I took from this

The challenge is a layered encoding exercise where each step is individually simple but the chain tests whether you can identify the right tool for each layer. ROT13 is recognisable from the letter structure and the sign-off matching a known name. Zip cracking with a known password length is a standard `fcrackzip` job. Steghide on a JPG is one of the first things to try in any image steganography challenge, and the passphrase being derived from the image content is a common pattern — always try obvious contextual guesses before reaching for a brute-force tool.

The `strings` shortcut on the ELF binary is worth noting. In CTF forensics challenges, running `strings` on a binary before executing it is good practice for two reasons — it can reveal the flag or intermediate data without needing to reverse-engineer or interact with the program, and it's safer than running an unknown executable. The binary here was benign, but in a real scenario, executing an unknown ELF from a steganography extraction without analysis would be a risk. `strings` followed by `file` and a quick look at the output is the safer first step.
