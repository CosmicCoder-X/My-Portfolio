---
title: 'More Cookies'
target: 'picoCTF — More Cookies'
difficulty: 'medium'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where the auth_name cookie was homomorphically encrypted using CBC mode, and brute-forcing a single-bit flip across all byte positions revealed the admin flag without needing to decrypt the ciphertext.'
role: 'appsec'
tags: ['web-exploitation', 'cookies', 'cbc-bitflip', 'homomorphic-encryption', 'brute-force', 'python', 'picoctf']
problem: 'A cookie search page that only the admin can use. The auth_name cookie is encrypted (base64-encoded ciphertext), and the challenge description hints at homomorphic encryption with oddly capitalised "CBC" letters.'
action: 'Decoded the cookie to confirm it was encrypted ciphertext, identified the CBC bitflip vector from the capitalisation hint, then wrote a Python script to brute-force every byte position and bit value until flipping one produced an admin response containing the flag.'
outcome: 'Retrieved the flag by flipping the correct bit in the encrypted cookie to toggle the admin field without decrypting the ciphertext.'
draft: false
---

## Background

More Cookies is a picoCTF Web Exploitation challenge and a follow-up to the simpler "Cookies" challenge. This time the cookie is encrypted — base64-decoding it produces ciphertext, not readable key-value pairs. The challenge description says "I forgot Cookies can Be modified Client-side, so now I decided to encrypt them!" with the letters C, B, and C oddly capitalised in "Can Be modified Client-side", hinting at CBC (Cipher Block Chaining) mode. The challenge also links to the Wikipedia article on [homomorphic encryption](https://en.wikipedia.org/wiki/Homomorphic_encryption), which is the key to the solution: you do not need to decrypt the cookie to change what it says.

---

## The encrypted cookie

The challenge page at `mercury.picoctf.net:25992` displayed a simple message: "Welcome to my cookie search page. Only the admin can use it!" Inspecting the cookies in the browser revealed a single cookie named `auth_name` with a long base64-encoded value:

```
auth_name=UXVDRDhEMmNrbTFCV25jbzdheFBjbHNmOWErZnNJdnY5Nk5pUkVNTkVXYUdRK0FVSk9tTGtRT3h1a0dWSDJrbmNHSUxsRTlNR2FZZFJaZ3RRb09EdngyUnd6L3FlbCtPSmZjbnJUVE5pWnVVUHNDQ1lJdFkzbTI4N29NWWxBRU4=
```

Decoding the base64 produced binary gibberish — not a readable string like `admin=0` or a JSON object. The cookie was genuinely encrypted, so simply editing it like in the original Cookies challenge was not an option. But the challenge was not asking for decryption — it was pointing toward a property of CBC mode that makes decryption unnecessary.

---

## The CBC bitflip attack

CBC (Cipher Block Chaining) mode encrypts data in blocks, where each plaintext block is XORed with the previous ciphertext block before encryption. This creates a dependency chain that means flipping a single bit in a ciphertext block will flip the corresponding bit in the next plaintext block after decryption. The attacker does not need to know the key, the plaintext, or the block boundaries — they just need to know that somewhere in the plaintext there is a value like `admin=0` and that flipping the right bit will change it to `admin=1`.

The homomorphic encryption hint reinforced this: homomorphic encryption allows operations on ciphertext that produce meaningful changes in the plaintext without ever decrypting. A CBC bitflip is exactly that — modifying the encrypted data to change the decrypted result.

The problem was that without knowing the plaintext structure, there was no way to know which byte position contained the admin bit or which bit value to flip. The cookie was 96 bytes after base64 decoding, and the target bit could be anywhere. The solution was brute force — try every combination of byte position and bit value until the server accepted the modified cookie as admin.

---

## Brute-forcing the bitflip

Wrote a Python script that iterated through every byte position (0 to 127) and every possible single-bit XOR value (0 to 127), flipped that bit in the decoded cookie, re-encoded it as base64, and sent it to the server. If the response contained `picoCTF{`, the flag had been found:

```python
from base64 import b64decode, b64encode
import requests

def bitFlip(pos, bit, data):
    raw = b64decode(data)
    list1 = list(raw)
    list1[pos] = chr(ord(list1[pos]) ^ bit)
    raw = ''.join(list1)
    return b64encode(raw)

ck = "UXVDRDhEMmNrbTFCV25jbzdheFBjbHNmOWErZnNJdnY5Nk5pUkVNTkVXYUdRK0FVSk9tTGtRT3h1a0dWSDJrbmNHSUxsRTlNR2FZZFJaZ3RRb09EdngyUnd6L3FlbCtPSmZjbnJUVE5pWnVVUHNDQ1lJdFkzbTI4N29NWWxBRU4="

for i in range(128):
    for j in range(128):
        c = bitFlip(i, j, ck)
        cookies = {'auth_name': c}
        r = requests.get('http://mercury.picoctf.net:25992/', cookies=cookies)
        if "picoCTF{" in r.text:
            print(r.text)
            break
```

The worst case was 128 x 128 = 16,384 requests, but in practice the script found the right combination well before exhausting the search space. When the correct bit was flipped, the server decrypted the modified cookie, read the admin field as true, and returned the page with the flag embedded in the response.

`picoCTF{cO0ki3s_yum_82f39377}`

---

## What I took from this

The CBC bitflip attack is a classic cryptographic vulnerability that demonstrates why encryption alone is not enough to protect data integrity. CBC mode provides confidentiality — an attacker cannot read the plaintext — but it does not provide authentication. Without a message authentication code (MAC) or authenticated encryption mode (like GCM or ChaCha20-Poly1305), the server has no way to detect that the ciphertext has been modified. The fix is to use authenticated encryption, which combines encryption with integrity verification so that any modification to the ciphertext causes the decryption to fail rather than producing altered plaintext. In web applications specifically, session data should be stored server-side with only an opaque session token in the cookie, or if the cookie must carry data, it should be both encrypted and signed (encrypt-then-MAC) so that tampered cookies are rejected before decryption is even attempted.
