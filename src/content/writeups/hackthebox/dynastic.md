---
title: 'Dynastic'
target: 'Hack The Box — Dynastic'
difficulty: 'easy'
date: 2025-08-29
summary: 'A crypto challenge — given a Python encryption script and its output, analysing the encrypt function to identify it as a Trithemius cipher (a position-dependent Caesar shift where each letter is shifted forward by its index), reverse engineering it by subtracting the index instead of adding it, and running the decryption script to recover the flag.'
role: 'appsec'
tags: ['crypto', 'python', 'reverse-engineering', 'trithemius-cipher', 'caesar-cipher', 'script-analysis', 'identity-map']
problem: 'Two files are provided — source.py (the encryption script) and output.txt (the encrypted flag). The encryption script imports a hidden FLAG variable, encrypts it using a custom function, and writes the ciphertext to output.txt. The task is to reverse engineer the encryption logic and decrypt the flag.'
action: 'Opened output.txt to find the encrypted flag DJF_CTA_SWYH_NPDKK_MBZ_QPHTIGPMZY_KRZSQE?!_ZL_CN_PGLIMCU_YU_KJODME_RYGZXL. Analysed source.py to understand the encryption — the encrypt function iterates over each character, converts alphabetic characters to their position in the alphabet (A=0 through Z=25), adds the character index i, and converts back to a letter using modulo 26. Non-alphabetic characters pass through unchanged. Recognised this as a Trithemius cipher — a variant of the Caesar cipher where the shift increases by one for each character position. Wrote a decryption script that reverses the operation by subtracting i instead of adding it. Ran the script to decrypt the ciphertext.'
outcome: 'Recovered the flag HTB{DID_YOU_KNOW_ABOUT_THE_TRITHEMIUS_CIPHER?!_IT_IS_SIMILAR_TO_CAESAR_CIPHER} by reversing the position-dependent shift cipher. The flag itself names the cipher used — the Trithemius cipher.'
draft: false
---

## Background

Dynastic is a beginner crypto challenge that provides the encryption source code alongside the ciphertext. With both in hand, the task is purely about reading the code, understanding the transformation, and reversing it. The cipher turns out to be a Trithemius cipher — a polyalphabetic substitution where each letter is shifted by its position index, making it a Caesar cipher with an incrementing key.

---

## The ciphertext

The `output.txt` file contains a hint and the encrypted flag:

![Notepad showing output.txt with the text Make sure you wrap the decrypted text with the HTB flag format followed by the encrypted string DJF_CTA_SWYH_NPDKK_MBZ_QPHTIGPMZY_KRZSQE?!_ZL_CN_PGLIMCU_YU_KJODME_RYGZXL.](/writeups/htb-dynastic/01-output-txt.png)

The ciphertext is all uppercase with underscores, question marks, and exclamation marks preserved — suggesting that non-alphabetic characters pass through the encryption unchanged. The `Make sure you wrap the decrypted text with the HTB flag format` line tells us the output won't already have `HTB{}` around it.

---

## The encryption script

The `source.py` file reveals the encryption logic:

![Code editor showing source.py — importing FLAG from secret and randint from random, defining to_identity_map that returns ord(a) minus 0x41, from_identity_map that returns chr(a % 26 + 0x41), and an encrypt function that iterates over the message, passing non-alpha characters through unchanged and shifting alpha characters by adding the index i to their identity map value before converting back.](/writeups/htb-dynastic/02-source-py.png)

```python
from secret import FLAG
from random import randint

def to_identity_map(a):
    return ord(a) - 0x41

def from_identity_map(a):
    return chr(a % 26 + 0x41)

def encrypt(m):
    c = ''
    for i in range(len(m)):
        ch = m[i]
        if not ch.isalpha():
            ech = ch
        else:
            chi = to_identity_map(ch)
            ech = from_identity_map(chi + i)
        c += ech
    return c

with open('output.txt', 'w') as f:
    f.write('Make sure you wrap the decrypted text with the HTB flag format :-]\n')
    f.write(encrypt(FLAG))
```

The `random` import is a red herring — `randint` is never used anywhere in the code. Breaking down what the encryption actually does:

`to_identity_map(a)` converts a letter to its alphabetic position by subtracting `0x41` (65, the ASCII value of 'A'). So A becomes 0, B becomes 1, through Z becoming 25.

`from_identity_map(a)` does the reverse — takes a number, applies modulo 26 to wrap it within the alphabet range, adds `0x41`, and converts back to a character.

The `encrypt` function iterates over every character. Non-alphabetic characters (underscores, punctuation) pass through unchanged. For each letter, it converts to its identity map value, **adds the current index `i`**, and converts back. This means the first letter (i=0) is unshifted, the second letter (i=1) is shifted by 1, the third (i=2) by 2, and so on. Each letter is shifted forward by a different amount — its position in the string.

This is a **Trithemius cipher**, a classical polyalphabetic cipher where the shift key is simply the position of the character. It's a special case of the Vigenere cipher where the key is the alphabet itself (A, B, C, D, ...).

---

## Reversing the cipher

Since the encryption adds `i` to each letter's position, the decryption subtracts `i` instead. The `to_identity_map` and `from_identity_map` functions stay the same — only the operation inside the loop flips from addition to subtraction:

```python
def to_identity_map(a):
    return ord(a) - 0x41

def from_identity_map(a):
    return chr(a % 26 + 0x41)

def decrypt(m):
    c = ''
    for i in range(len(m)):
        ch = m[i]
        if not ch.isalpha():
            ech = ch
        else:
            chi = to_identity_map(ch)
            ech = from_identity_map(chi - i)
        c += ech
    return c

encrypted_message = "DJF_CTA_SWYH_NPDKK_MBZ_QPHTIGPMZY_KRZSQE?!_ZL_CN_PGLIMCU_YU_KJODME_RYGZXL"
decrypted_message = decrypt(encrypted_message)
print(decrypted_message)
```

The `% 26` in `from_identity_map` handles the wraparound — when the subtraction produces a negative number, modulo 26 wraps it back into the valid alphabet range. This is the same reason the encryption doesn't break when addition pushes past Z.

Running the decryption script produces the plaintext:

![Online Python IDE showing the decryption script on the left with the decrypt function subtracting i instead of adding it, and the Output panel on the right displaying DID_YOU_KNOW_ABOUT_THE_TRITHEMIUS_CIPHER?!_IT_IS_SIMILAR_TO_CAESAR_CIPHER followed by Code Execution Successful.](/writeups/htb-dynastic/03-decrypt-flag.png)

The flag: **HTB{DID_YOU_KNOW_ABOUT_THE_TRITHEMIUS_CIPHER?!_IT_IS_SIMILAR_TO_CAESAR_CIPHER}**

---

## What I took from this

The challenge is a clean introduction to reversing a cipher from its source code. When the encryption code is provided, the solve isn't about cryptanalysis — it's about reading the code carefully, understanding the mathematical operation, and applying its inverse. The single-character difference between `chi + i` (encrypt) and `chi - i` (decrypt) is all that separates the two scripts.

The Trithemius cipher is worth understanding in context. Unlike a Caesar cipher (which uses a fixed shift for every character), the Trithemius cipher shifts each character by its position, making it polyalphabetic. In a Caesar cipher, the letter A always maps to the same ciphertext letter; in Trithemius, it maps differently depending on where it appears in the plaintext. This makes frequency analysis harder, but since the key is completely predictable (it's just 0, 1, 2, 3, ...), it offers no real security — anyone who knows the scheme can decrypt instantly without needing to discover a key.

The `% 26` modular arithmetic is a fundamental pattern in classical cryptography. Every alphabetic cipher operates within a ring of 26 elements, and modular arithmetic ensures that operations wrap around cleanly — shifting Z forward by 1 gives A, and shifting A backward by 1 gives Z. Recognising this pattern makes it straightforward to reverse any substitution cipher that works within the alphabet.
