---
title: 'waves over lambda'
target: 'picoCTF — waves over lambda'
difficulty: 'easy'
date: 2026-07-22
summary: 'A picoCTF Cryptography challenge where a passage of text was encrypted with a simple substitution cipher, and using an automated frequency analysis solver decoded the ciphertext to reveal the flag embedded in the header.'
role: 'appsec'
tags: ['cryptography', 'substitution-cipher', 'frequency-analysis', 'picoctf']
problem: 'A netcat service that outputs a block of ciphertext encrypted with a monoalphabetic substitution cipher. The challenge description hints at substitutions, and the title references the physics equation for frequency (c over lambda).'
action: 'Connected to the service to retrieve the ciphertext, pasted it into quipqiup (an automated substitution cipher solver that uses frequency analysis and dictionary matching), and read the decrypted output.'
outcome: 'Retrieved the flag from the decrypted header line of the substitution cipher output.'
draft: false
---

## Background

waves over lambda is a picoCTF Cryptography challenge about monoalphabetic substitution ciphers. The challenge description says "We made a lot of substitutions to encrypt this" — directly stating the cipher type. The title is a reference to the physics equation f = c / lambda (frequency equals the speed of light divided by wavelength), which ties into the solution method: frequency analysis. Connecting to the provided service via netcat returns a block of ciphertext where each letter has been consistently replaced by a different letter throughout the text.

---

## The ciphertext

Connected to the service with `nc 2019shell1.picoctf.com 32282` and received a header line containing the flag (also encrypted) followed by a long passage of encrypted English text:

```
yvmhqbxj urqr wj pvdq csbh - cqrgdrmyp_wj_y_virq_sblktb_oxxuxxvkdy
```

The body text was several paragraphs long — a passage from Joseph Conrad's *Heart of Darkness*, chosen because its length provided enough character frequency data for automated solvers to work with. In a substitution cipher, each letter in the plaintext is consistently mapped to a single letter in the ciphertext (for example, every `e` might become `r`, every `t` might become `x`, and so on). The mapping is fixed across the entire message, which means the statistical distribution of letters in the ciphertext mirrors the distribution in the plaintext — just with different labels.

---

## Solving with frequency analysis

A monoalphabetic substitution cipher with a passage this long is trivially solvable with frequency analysis. In English, the letter `e` appears roughly 13% of the time, `t` about 9%, `a` about 8%, and so on. By counting how often each letter appears in the ciphertext and matching those frequencies against known English letter frequencies, the substitution table can be reconstructed. For a passage of several hundred words, automated tools can solve this in under a second.

Pasted the full ciphertext into [quipqiup](https://www.quipqiup.com/), an online substitution cipher solver that combines frequency analysis with dictionary word matching. The tool returned the fully decrypted text, including the header line:

```
congrats here is your flag - frequency_is_c_over_lambda_ptthttobuc
```

The body text decoded to the opening of *Heart of Darkness*: "between us there was, as i have already said somewhere, the bond of the sea..."

`picoCTF{frequency_is_c_over_lambda_ptthttobuc}`

---

## What I took from this

Substitution ciphers were considered strong for centuries — Mary Queen of Scots was famously convicted based on intercepted messages encrypted with one — but they have been breakable since the 9th century when the Arab polymath Al-Kindi described frequency analysis. The fundamental weakness is that substitution preserves the statistical structure of the plaintext language. Every language has a characteristic letter frequency distribution, and no matter how the letters are shuffled, that distribution shows through in the ciphertext. The longer the message, the more closely the ciphertext frequencies match the expected distribution, and the easier the solve. Modern encryption algorithms like AES avoid this entirely by operating on fixed-size blocks of bits rather than individual characters, and by using key-dependent transformations that produce ciphertext with a uniform distribution — every possible output byte is equally likely, making frequency analysis useless.
