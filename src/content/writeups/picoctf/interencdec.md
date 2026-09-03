---
title: 'interencdec'
target: 'picoCTF — interencdec'
difficulty: 'easy'
date: 2026-07-22
summary: 'A picoCTF Cryptography challenge where the flag was double base64-encoded and then Caesar-shifted, and reversing each layer in order produced the plaintext flag.'
role: 'appsec'
tags: ['cryptography', 'base64', 'caesar-cipher', 'encoding', 'picoctf']
problem: 'A downloadable file containing a string that has been encoded through multiple layers — two rounds of base64 followed by a Caesar cipher shift.'
action: 'Decoded the string from base64 twice to reveal a Caesar-shifted flag format, then used dcode.fr to brute-force all 26 possible shifts and identified shift 3 as the one producing readable text.'
outcome: 'Retrieved the flag by peeling off each encoding layer in reverse order.'
draft: false
---

## Background

interencdec is a picoCTF Cryptography challenge about layered encoding. The challenge name is a portmanteau of "inter-enc-dec" — interleaved encoding and decoding. The challenge description says "Can you get the real meaning from this file?" and provides a downloadable file containing a single encoded string. The solution requires recognising each encoding layer and reversing them in the correct order.

---

## First layer: base64

Opening the file revealed a single string:

```
YidkM0JxZGtwQlRYdHFhR3g2YUhsZmF6TnFlVGwzWVROclgyMHdNakV5TnpVNGZRPT0nCg==
```

The trailing `==` padding and the character set (uppercase, lowercase, digits, `+`, `/`) were the immediate giveaway that this was base64. Decoding it produced:

```
b'd3BqdkpBTXtqaGx6aHlfazNqeTl3YTNrX20wMjEyNzU4fQ=='
```

The result was a Python byte string literal wrapping another base64 string — the `b'...'` formatting and the `==` padding inside it made that clear.

---

## Second layer: base64 again

Stripping the `b'` prefix and `'` suffix left the inner base64 string: `d3BqdkpBTXtqaGx6aHlfazNqeTl3YTNrX20wMjEyNzU4fQ==`. Decoding this second layer produced:

```
wpjvJAM{jhlzhy_k3jy9wa3k_m0212758}
```

This had the structure of a flag — the `{...}` format with underscores and alphanumeric characters — but `wpjvJAM` was not `picoCTF`. The letters had been shifted. Given that the structure was preserved (curly braces, underscores, and digits were unchanged while only letters were altered), this was a Caesar cipher — a simple alphabetic rotation.

---

## Third layer: Caesar cipher

A Caesar cipher shifts each letter by a fixed number of positions in the alphabet. With only 26 possible shifts, brute-forcing all of them is trivial. Used [dcode.fr's Caesar cipher decoder](https://www.dcode.fr/caesar-cipher) to test all shifts at once. The tool showed that a shift of 19 (or equivalently, a reverse shift of 7) transformed `wpjvJAM` into `picoCTF`, and the rest of the string decoded into readable English.

![dcode.fr Caesar Cipher Decoder showing the ciphertext "wpjvJAM{jhlzhy_k3jy9wa3k_m0212758}" entered in the input field, with the Shift/Key value set to 3 under Manual decryption and parameters, using the English alphabet of 26 letters from A to Z.](/writeups/picoctf-interencdec/01.png)

The decoded flag read naturally: `caesar_d3cr9pt3d` — "caesar decrypted" in leetspeak, which confirmed the shift was correct.

`picoCTF{caesar_d3cr9pt3d_f0212758}`

---

## What I took from this

Layered encoding is a common pattern in CTF challenges and in real-world obfuscation. Each layer on its own is trivial to reverse — base64 is not encryption, and a Caesar cipher with 26 possible keys is brute-forceable by hand — but stacking them creates a puzzle where the solver needs to recognise each layer and peel them off in the right order. The key indicators were structural: base64 has a distinctive character set and padding pattern, and the Caesar cipher preserved the flag's non-alphabetic structure (braces, underscores, digits) while shifting only the letters. In real-world security, encoding is often mistaken for encryption. Base64 is a format transformation, not a security mechanism — it converts binary data to printable ASCII, and anyone can decode it. Caesar cipher is a 2,000-year-old substitution cipher that was already considered weak in its own era. Neither provides confidentiality against even a casual attacker. When data needs to be protected, actual encryption (AES, ChaCha20, RSA with proper key management) is the only appropriate tool.
