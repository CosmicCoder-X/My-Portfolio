---
title: 'Da Vinci'
target: 'Hack The Box — Da Vinci'
difficulty: 'medium'
date: 2025-08-29
summary: 'A forensics challenge — three JPG images with layered steganography. Steghide with passphrase TOM extracts an MD5 key (leonardo), binwalk reveals an embedded zip in monalisa.jpg, and steghide on the extracted Mona.jpg with passphrase Guernica yields a triple-base64-encoded flag.'
role: 'forensics'
tags: ['steganography', 'steghide', 'binwalk', 'md5', 'base64', 'strings', 'zip-cracking', 'image-forensics', 'foremost']
problem: 'Three JPG images with the flag hidden across multiple layers of steganography, embedded archives, and contextual passphrases derived from art history.'
action: 'Steghide on the Hanks image with passphrase TOM extracted a message containing MD5 hash 020e60c6a84db8c5d4c2d56a4e4fe082, which cracked to leonardo. Strings on Plans.jpg revealed a YouTube link to Picasso Guernica. Binwalk on monalisa.jpg found an embedded famous.zip — unlocked with password leonardo, producing Mona.jpg. Steghide on Mona.jpg with passphrase Guernica extracted a key file with triple-base64-encoded data, decoded to the flag.'
outcome: 'Recovered HTB{M0n@_L1z@_!s_D3@D} via triple-base64 decode from a steghide-extracted key file. Solve chained steghide, strings, binwalk, zip cracking, and contextual passphrase guessing across four images.'
draft: false
---

## Background

Da Vinci is a multi-layered forensics challenge with an art theme running through it. Three images, multiple steganography tools, embedded files, and passwords derived from art history context. The challenge is more scavenger hunt than technical difficulty — each step reveals a piece that's needed later, and the trick is figuring out which piece goes where. Several of the passwords are contextual guesses rather than brute-force targets, which makes this one of those challenges where domain knowledge (or good Googling) matters as much as tool proficiency.

---

## The starting images

The challenge provides three JPG images: `monalisa.jpg`, `Plans.jpg`, and `Thepassword_is_the_small_name_of_the_actor_named_Hanks.jpg`. The third filename is practically a flashing sign — the actor named Hanks is Tom Hanks, who starred in The Da Vinci Code. The "small name" is **TOM**.

---

## Steghide on the Hanks image

Running `steghide extract -sf Thepassword_is_the_small_name_of_the_actor_named_Hanks.jpg` with the passphrase `TOM` extracts a file called `S3cr3t_m3ss@g3.txt`. The message is from someone called Luc1f3r to Filippos — it contains a key in the format of a 32-character hex string: **020e60c6a84db8c5d4c2d56a4e4fe082**. The message says "I used an encryption with 32 characters" and dares the reader to decrypt it.

![Terminal running steghide extract on the Hanks image with passphrase TOM, extracting S3cr3t_m3ss@g3.txt, then cat showing the message — Hey Filippos, This is my secret key for our folder with key 020e60c6a84db8c5d4c2d56a4e4fe082, I used an encryption with 32 characters, signed Luc1f3r.](/writeups/htb-davinci/01-steghide-secret-msg.png)

A 32-character hex string is MD5. Cracking it (CrackStation or any rainbow table) returns the plaintext: **leonardo**. This password doesn't work as a steghide passphrase on the remaining two images directly — it's needed later for something else.

---

## Strings and YouTube

Running `strings` on `Plans.jpg` reveals a YouTube link buried at the end of the binary: `https://www.youtube.com/watch?v=jc1Nfx4c5LQ`. The video shows Picasso's famous painting **Guernica** — a large anti-war mural. The painting name becomes another passphrase candidate to hold onto.

---

## Binwalk — the embedded zip

With steghide and strings exhausted on the original images, `binwalk` reveals what's hiding inside `monalisa.jpg` at the binary level. The scan shows a JFIF image at offset 0, then at offset 450363 — a **zip archive** named `famous.zip` embedded after the image data, containing an encrypted file called `Mona.jpg`.

![Terminal running binwalk on monalisa.jpg showing JPEG image data at offset 0, Zip archive data at offset 450363 named famous.zip with uncompressed size 117958, encrypted Zip archive data at offset 450440 named Mona.jpg with compressed size 117776, and two End of Zip archive footers.](/writeups/htb-davinci/02-binwalk-monalisa.png)

Extracting the zip with `binwalk -MDe monalisa.jpg` (or `foremost`) carves out `famous.zip`. The zip is password protected — and this is where the MD5-cracked password comes back. Since the Mona Lisa was painted by **Leonardo** da Vinci, and the key from the secret message cracked to `leonardo`, using it as the zip password extracts successfully.

---

## Mona.jpg — the selfie

Inside the zip is `Mona.jpg` — a 612x612 pixel parody image of the Mona Lisa taking a selfie with an iPhone. It's a humorous take on the painting, but the important part is what's hidden inside it.

![Image viewer showing Mona.jpg — a parody of the Mona Lisa painting where she is holding an iPhone and taking a selfie, 612 by 612 pixels, 122.9 kB.](/writeups/htb-davinci/03-mona-selfie.png)

---

## Steghide with Guernica

The YouTube video from earlier pointed to Picasso's Guernica, and that passphrase didn't work on the original images. But it works on this one — running `steghide extract -sf Mona.jpg` with the passphrase `Guernica` extracts a file simply called `key`.

![Terminal running steghide extract on Mona.jpg, entering the passphrase, extracting a file called key, then cat showing a base64-encoded string VTBaU1EyVXdNSGRpYTBKbVZFUkd0bEZHT0doak1UbEZZUVEJDUldaUlBUMD0=.](/writeups/htb-davinci/04-steghide-key.png)

The key file contains a base64-encoded string. Decoding it once produces another base64 string. Decoding that produces yet another. Three layers of base64 encoding:

```
cat key | base64 -d | base64 -d | base64 -d
HTB{M0n@_L1z@_!s_D3@D}
```

The flag: **HTB{M0n@_L1z@_!s_D3@D}**

---

## What I took from this

The challenge is a good exercise in keeping track of gathered intelligence across multiple steps. The MD5-cracked password `leonardo` doesn't pay off immediately — it sits unused until binwalk reveals the embedded zip several steps later. The YouTube link from `strings` on Plans.jpg similarly doesn't connect to anything until the fourth image appears. This pattern of collecting pieces that only become useful later is common in multi-stage forensics challenges and mirrors real investigations where a piece of evidence from early in the case suddenly becomes relevant much further down the line.

The contextual passphrase guessing is worth noting as a technique. Two of the three steghide passphrases in this challenge are derived from context rather than brute force — `TOM` from the filename hint and `Guernica` from the YouTube video. The third password (`leonardo`) comes from cracking an MD5 hash but is applied contextually to a zip embedded inside a Mona Lisa painting. In CTF steganography challenges, always try contextual guesses before reaching for stegcracker or a wordlist — the challenge creator often expects you to make the connection between the image content and the passphrase, and brute-forcing what was meant to be a knowledge check wastes time.

The binwalk step is the pivot that unlocks the challenge. Without it, you have a cracked MD5 password and a YouTube link that don't connect to anything. Binwalk should be a standard first step on any image in a forensics challenge — run `file`, `strings`, `exiftool`, and `binwalk` on every file before reaching for specialised tools. Embedded archives, appended data, and concatenated files are some of the most common hiding techniques, and binwalk catches them all in a single scan.
