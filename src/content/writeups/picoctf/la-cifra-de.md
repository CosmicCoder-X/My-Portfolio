---
title: 'la cifra de'
target: 'picoCTF — la cifra de'
difficulty: 'easy'
date: 2026-07-22
summary: "A picoCTF Cryptography challenge where a netcat service returned text encrypted with a Vigenere cipher, and using dcode.fr's cipher identifier and Vigenere decoder with automatic key recovery revealed the flag."
role: 'appsec'
tags: ['cryptography', 'vigenere-cipher', 'cipher-identification', 'picoctf']
problem: "A netcat service that outputs a passage of text encrypted with a historical cipher. The title references Giovan Battista Bellaso's book on the Vigenere cipher, and the hint says to look at history."
action: "Connected via netcat to retrieve the ciphertext, used dcode.fr's cipher identifier to confirm it was a Vigenere cipher, then used the Vigenere decoder with automatic key detection to decrypt the text, adjusting for a shifted key across different portions of the ciphertext."
outcome: 'Decoded the Vigenere ciphertext to retrieve the flag embedded in the decrypted passage.'
draft: false
---

## Background

la cifra de is a picoCTF Cryptography challenge about the Vigenere cipher — a polyalphabetic substitution cipher that was considered unbreakable for centuries. The title is a reference to "La cifra del. Sig. Giovan Battista Bellaso" (1553), the book that first described the cipher now attributed to Blaise de Vigenere. The challenge description says "I found this cipher in an old book. Can you figure out what it says?" and the hint suggests that "there are tools that make this easy" and that "looking at history will help."

---

## Retrieving the ciphertext

Connected to the service with `nc jupiter.challenges.picoctf.org 5726` and received a block of encrypted text. The ciphertext was a passage of lowercase alphabetic characters with spaces and punctuation preserved — a characteristic of classical ciphers that only operate on the letters while leaving everything else unchanged.

---

## Identifying the cipher

The title and historical hints narrowed the field to classical ciphers, but rather than guessing, used [dcode.fr's cipher identifier](https://www.dcode.fr/cipher-identifier) to analyse the ciphertext. Pasted the encrypted text into the identifier and clicked Analyse.

![dcode.fr Cipher Identifier page showing the encrypted text pasted into the "Ciphertext to Recognize" field. The Results panel on the left shows dcode's analyser suggestions with Vigenere Cipher at the top of the list with full confidence bars, followed by Autoclave Cipher, Beaufort Cipher, Rozier, Vernam Cipher, Variant Beaufort Cipher, Gronsfeld Cipher, Jefferson Wheel Cipher, Trithemius Cipher, Substitution Cipher, Shift Cipher, Homophonic Cipher, Chaocipher, and Enigma Machine in descending order of likelihood. A red arrow points to Vigenere Cipher at the top.](/writeups/picoctf-la-cifra-de/01.png)

The identifier ranked Vigenere Cipher as the top match with full confidence. This made sense — a Vigenere cipher produces ciphertext that looks like random letters but retains the statistical patterns of the plaintext language at repeating key-length intervals, which is exactly what the identifier's frequency analysis detected.

---

## Decrypting with the Vigenere decoder

Clicked through to [dcode.fr's Vigenere decoder](https://www.dcode.fr/vigenere-cipher) and pasted the ciphertext. The tool offered several decryption methods: knowing the key, knowing the key length, knowing a partial key, knowing a plaintext word, and automatic Kasiski cryptanalysis.

Started with automatic decryption, which identified the most likely key as `FLAG`. Decrypting with this key produced mostly readable English, but some portions came out as gibberish — the key was not consistent across the entire ciphertext. Inspecting the output more carefully and trying variations revealed that part of the text used the shifted key `AGFL` instead of `FLAG`. This is a common pattern in CTF challenges where the key wraps differently depending on how non-alphabetic characters (spaces, punctuation) are handled during encryption.

![dcode.fr Vigenere Cipher decoder page showing the ciphertext in the input field and the decryption results on the left side. The Parameters section shows Plaintext Language set to English with the standard A-Z alphabet. The Decryption method is set to "Knowing the Key/Password" with "FLAG" entered as the key. The decoded text on the left shows readable English passages about the history of the Vigenere cipher, with a blue arrow pointing to partially decoded text at the bottom where the key "AGFL" was identified as the correct variant for that section. A red bar redacts the flag value in the decoded output.](/writeups/picoctf-la-cifra-de/02.png)

Running the decoder with `AGFL` on the remaining portion produced the section containing the flag. The decrypted text was a passage about the history of polyalphabetic ciphers, with the flag embedded in the content.

`picoCTF{b311a50_0r_v1gn3r3_c1ph3r6fe60eaa}`

---

## What I took from this

The Vigenere cipher was a significant advancement over monoalphabetic substitution (like the Caesar cipher) because it used a repeating key to apply different shift values to different positions in the plaintext. This meant that simple frequency analysis — counting letter occurrences — no longer worked directly, since the same plaintext letter could be encrypted as different ciphertext letters depending on its position relative to the key. For centuries this made the cipher practically unbreakable, earning it the nickname "le chiffre indechiffrable." The breakthrough came in the 19th century when Friedrich Kasiski published a method for determining the key length by finding repeated sequences in the ciphertext. Once the key length is known, the cipher reduces to multiple independent Caesar ciphers (one per key position), each of which is trivially solvable with frequency analysis. Modern tools like dcode.fr automate this entire process — key length detection, frequency analysis per position, and dictionary matching — making Vigenere ciphers solvable in seconds. The lesson is that security through obscurity (relying on the attacker not knowing the cipher type) and short key lengths are both fatal weaknesses. Modern encryption algorithms use keys that are computationally infeasible to brute-force and do not reveal structural patterns in the ciphertext regardless of how much data is encrypted.
