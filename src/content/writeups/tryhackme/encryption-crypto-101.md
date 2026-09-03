---
title: 'Encryption — Crypto 101'
target: 'TryHackMe — Encryption — Crypto 101'
difficulty: 'easy'
date: 2025-08-29
summary: "A walkthrough of core cryptography concepts — symmetric vs asymmetric encryption, RSA key math, Diffie-Hellman, digital certificates, PGP/GPG, cracking SSH keys with John the Ripper, and quantum computing threats to current standards."
role: 'soc'
tags: ['cryptography', 'rsa', 'ssh', 'gpg', 'pgp', 'aes', 'des', 'tls', 'john-the-ripper', 'encryption', 'diffie-hellman']
problem: "The task is to build a working mental model of symmetric and asymmetric cryptography, understand RSA and Diffie-Hellman at a mathematical level, practice cracking a passphrase-protected SSH key, and decrypt a GPG-encrypted message."
action: "Worked through RSA key math including prime factorisation and modular arithmetic, compared symmetric ciphers (AES, DES) against asymmetric schemes, and studied Diffie-Hellman key exchange. Cracked a passphrase-protected SSH key using ssh2john and John the Ripper with the rockyou wordlist. Imported a PGP private key to decrypt a GPG-encrypted message."
outcome: "Calculated RSA n=29239669 from given primes, cracked the SSH key passphrase (delicious) with John the Ripper, decrypted the GPG message with the imported PGP key, and identified E1 as the TryHackMe certificate issuer."
draft: false
---

## Background

This room is a ground-up introduction to cryptography — not as a penetration testing technique, but as the foundational technology that makes secure communication possible. It covers the mathematical principles behind encryption, the difference between symmetric and asymmetric schemes, and how those primitives combine into the protocols that secure real-world systems: TLS for web traffic, SSH for remote access, PGP for email and file encryption.

The room is heavily theoretical. Most tasks are knowledge-based questions rather than practical exploitation, which makes it a useful reference for understanding why things work the way they do rather than just how to use them. The two practical sections — cracking an SSH key passphrase and decrypting a GPG message — ground the theory in concrete operations.

---

## Key terminology and core concepts

Ciphertext is the encrypted output, plaintext is the readable input, and a cipher is the algorithm that transforms one into the other. The critical distinction that organises everything else in this room is between symmetric and asymmetric encryption.

Symmetric encryption uses a single key for both encryption and decryption. It's fast and efficient — AES (Advanced Encryption Standard) is the current standard, used in TLS, disk encryption, and most bulk data encryption. DES (Data Encryption Standard) is its predecessor, and the answer to whether DES is still considered secure is a firm no — its 56-bit key length makes it trivially brute-forceable with modern hardware. Triple DES (3DES) extended DES's life by applying the cipher three times, but AES has effectively replaced both.

Asymmetric encryption uses a key pair — a public key for encryption and a private key for decryption (or vice versa for signing). RSA is the most widely deployed asymmetric algorithm. It's computationally expensive compared to symmetric encryption, which is why hybrid schemes dominate: asymmetric encryption establishes a shared secret, and symmetric encryption handles the bulk data transfer. This is exactly how TLS works — the initial handshake uses asymmetric cryptography, and the session itself uses symmetric.

---

## RSA and the mathematics of asymmetric encryption

RSA's security rests on the difficulty of factoring large numbers. The key generation process starts with two large primes, p and q. Their product n = p * q becomes part of the public key, and the security of the system depends on the fact that deriving p and q from n is computationally infeasible for sufficiently large primes.

For the room's example: given p = 4391 and q = 6659, the value of n is 4391 * 6659 = **29239669**.

The modular arithmetic that underpins RSA is the modulo operation — the remainder after division. The room tests this with three calculations: 30 % 5 = **0** (30 divides evenly by 5), 25 % 7 = **4** (25 = 3*7 + 4), and 118613842 % 9091 = **3** (118613842 = 13047*9091 + 3).

Public keys can be used to verify that a message was signed by the holder of the corresponding private key — this is the basis of digital signatures. The answer to whether you can use a public key to verify something signed with a private key is yes.

---

## Diffie-Hellman key exchange

Diffie-Hellman solves a fundamental problem: how do two parties establish a shared secret over an insecure channel without ever transmitting the secret itself? The exchange uses modular exponentiation — both parties agree on public parameters, each generates a private value, exchanges computed public values, and independently derives the same shared secret. An eavesdropper who sees the public values cannot feasibly compute the shared secret without solving the discrete logarithm problem.

This key exchange is what makes protocols like TLS work in practice. The asymmetric component establishes the shared secret, and AES (or another symmetric cipher) encrypts the actual session traffic using that secret.

---

## Digital certificates and trust

Digital certificates are the mechanism that binds a public key to an identity. When a browser connects to a website over HTTPS, the server presents a certificate proving it controls the domain. That certificate is signed by a Certificate Authority (CA) — and the CA's own certificate is signed by a higher-level CA, forming a chain of trust that terminates at a root CA embedded in the browser or operating system's trust store.

The standard for web certificates is X.509. The compliance standard that mandates handling of credit card information securely (and by extension, proper use of encryption) is **PCI-DSS** (Payment Card Industry Data Security Standard).

Examining the TryHackMe website's HTTPS certificate, the issuer — the CA that signed it — is **E1** (Let's Encrypt's intermediate CA).

---

## SSH keys and cracking passphrases

SSH authentication supports both passwords and key pairs. Key-based authentication is significantly more secure — it eliminates the risk of brute-force password attacks entirely. An SSH private key can optionally be protected with a passphrase, adding a second factor: something you have (the key file) plus something you know (the passphrase). The protocol name that SSH keys are used for is **Secure Shell**.

When a passphrase-protected SSH key is obtained, the passphrase itself becomes an attack target. The process uses two tools: ssh2john to extract a crackable hash from the key file, and John the Ripper to brute-force the passphrase against a wordlist.

First, examining the private key to confirm its format:

```
cat id_rsa_1593558668558.id_rsa
```

![Kali terminal showing cat command on the SSH private key file — the output displays the BEGIN RSA PRIVATE KEY header confirming it is a passphrase-protected RSA key in PEM format.](/writeups/thm-encryption-crypto-101/01-cat-id-rsa.png)

The `BEGIN RSA PRIVATE KEY` header confirms this is an RSA private key in PEM format. Converting it to a format John the Ripper can process:

```
python /usr/share/john/ssh2john.py id_rsa_1593558668558.id_rsa > ssh.txt
```

![Kali terminal showing ssh2john converting the RSA private key file into a hash file ssh.txt for offline cracking with John the Ripper.](/writeups/thm-encryption-crypto-101/02-ssh2john.png)

ssh2john extracts the encryption parameters and key data into a hash format that John can work with. Running the crack against the rockyou wordlist:

```
john ssh.txt --wordlist=/usr/share/wordlists/rockyou.txt
```

![Kali terminal showing John the Ripper cracking ssh.txt — loaded 1 password hash (SSH private key, RSA/DSA/EC/OPENSSH), ran 2 OpenMP threads, result highlighted in green: delicious (id_rsa_1593558668558.id_rsa), session completed.](/writeups/thm-encryption-crypto-101/03-john-cracked.png)

John cracks the passphrase almost instantly: **delicious**. The output confirms it loaded the hash as an SSH private key type, ran with 2 OpenMP threads, and found the passphrase in the rockyou wordlist. The speed — 25.0g/s with 98400 candidates per second — shows that a weak passphrase provides almost no protection against offline attacks. This is the same lesson as password cracking in any other context: the passphrase needs to be strong enough to resist dictionary attacks, because the attacker has unlimited offline attempts once they have the key file.

---

## PGP, GPG, and decrypting messages

PGP (Pretty Good Privacy) provides encryption and signing for files, emails, and data at rest. GPG (GNU Privacy Guard) is the open-source implementation of the OpenPGP standard. Where TLS secures data in transit, PGP secures data at rest or in contexts where end-to-end encryption is needed without a real-time connection.

PGP uses the same hybrid approach as TLS: asymmetric encryption to exchange a session key, symmetric encryption to handle the actual data. The key management model is different though — PGP uses a web of trust rather than certificate authorities, meaning users vouch for each other's identities by signing each other's public keys.

Importing the provided PGP private key:

```
gpg --import tryhackme.key
```

![Kali terminal showing gpg --import tryhackme.key — key FFA4B5252BAEB2E6 imported, identified as TryHackMe (Example Key), secret key imported, total number processed 1.](/writeups/thm-encryption-crypto-101/04-gpg-import.png)

GPG imports the key with ID FFA4B5252BAEB2E6, identified as "TryHackMe (Example Key)". The output shows both the public and secret (private) components were processed. Decrypting the message:

```
gpg message.gpg
```

![Kali terminal showing gpg message.gpg — GPG reports the message was encrypted with a 1024-bit RSA key, ID 2A0A5FDC5081B1C5, created 2020-06-30, associated with TryHackMe (Example Key).](/writeups/thm-encryption-crypto-101/05-gpg-decrypt.png)

GPG identifies the message as encrypted with a 1024-bit RSA key (ID 2A0A5FDC5081B1C5) associated with the TryHackMe example key. The decryption succeeds because the matching private key was imported in the previous step. The decrypted output is written to a plaintext file, which can then be read with `cat` to retrieve the flag.

---

## Quantum computing and the future of encryption

The room closes with a forward-looking section on quantum computing's implications for cryptography. Quantum computers, if built at sufficient scale, could break RSA and Diffie-Hellman by efficiently solving the integer factorisation and discrete logarithm problems that these algorithms depend on. Shor's algorithm, running on a sufficiently powerful quantum computer, would reduce these from computationally infeasible to polynomial-time problems.

Symmetric encryption is less affected — Grover's algorithm provides only a quadratic speedup for brute-force search, meaning AES-256 would be reduced to AES-128 equivalent security, which is still considered safe. The response to this threat is post-quantum cryptography: new asymmetric algorithms based on mathematical problems that are believed to be hard for both classical and quantum computers, such as lattice-based and code-based schemes.

---

## What I took from this

The room's value is in building intuition for how cryptographic primitives compose into real systems. It's easy to use SSH, TLS, and GPG as black boxes — type the command, trust the output — but understanding why RSA works (and why it might stop working when quantum computers mature) changes how you evaluate security architectures. The practical takeaway: encryption protects data, but the key management around it determines whether that protection holds. A PGP-encrypted message is only as secure as the private key protecting it, and an SSH key is only as secure as its passphrase — which, as the John the Ripper demonstration showed, can be cracked in under a second if it's a dictionary word.

The modular arithmetic and prime factorisation sections feel academic in isolation, but they're the precise reason RSA is secure: multiplying two large primes is trivial, but factoring their product is not. When quantum computing eventually breaks that asymmetry, everything built on top of it — TLS certificates, SSH key exchange, PGP encryption — will need to migrate to post-quantum alternatives. That migration is already underway in standards bodies, which is why understanding the mathematical foundations matters even for blue-team practitioners who will never implement a cipher themselves.
