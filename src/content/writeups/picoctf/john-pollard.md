---
title: 'john_pollard'
target: 'picoCTF — john_pollard'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Cryptography challenge where an X.509 certificate contained a deliberately small 53-bit RSA modulus, and factoring it with Alpertron's integer factorisation calculator revealed the two primes that formed the flag."
role: 'appsec'
tags: ['cryptography', 'rsa', 'certificate', 'factorisation', 'openssl', 'picoctf']
problem: "A downloadable X.509 certificate file with a suspiciously small RSA public key. The challenge is named after John Pollard, who developed several integer factorisation algorithms."
action: "Downloaded the certificate with wget, parsed it with openssl x509 to extract the RSA modulus and exponent, noticed the modulus was only 53 bits (far too small for any real-world use), then factored it using Alpertron's online integer factorisation calculator to recover the two prime factors."
outcome: 'Recovered the two prime factors of the weak RSA modulus and submitted them as the flag in the format picoCTF{p,q}.'
draft: false
---

## Background

john_pollard is a picoCTF Cryptography challenge about breaking RSA by factoring a weak modulus. The challenge is named after John Pollard, a British mathematician who developed several influential integer factorisation algorithms — most notably Pollard's rho algorithm (1975) and Pollard's p − 1 algorithm (1974). Both are specialised methods for finding factors of composite numbers, and both are directly relevant to attacking RSA when the modulus is poorly constructed. The challenge provides a certificate file and asks "Can you crack the flag?", with hints pointing toward certificate parsing and factoring.

RSA's security rests entirely on the difficulty of factoring the product of two large primes. A modern RSA key uses a 2048-bit or 4096-bit modulus, which makes factorisation computationally infeasible with current hardware and algorithms. But if the modulus is small enough, factoring it is trivial — and once factored, the entire private key can be reconstructed.

---

## Downloading and examining the certificate

Downloaded the certificate file from the challenge URL using wget:

```
$ wget https://jupiter.challenges.picoctf.org/static/c882787a19ed5d627eea50f318d87ac5/cert
```

![Kali terminal showing the wget command downloading the cert file from jupiter.challenges.picoctf.org. The output shows the file resolving to 3.131.60.8, connecting over HTTPS, receiving a 200 OK response, and saving the 725-byte file.](/writeups/picoctf-john-pollard/01.png)

The file was 725 bytes — extremely small for anything containing a real RSA key. A standard 2048-bit RSA certificate is typically several kilobytes. This was the first indication that the key inside was deliberately weakened.

---

## Parsing the certificate with OpenSSL

Used OpenSSL's `x509` command to read the certificate's contents in human-readable form:

```
$ openssl x509 -in cert -text -noout
```

![Kali terminal showing the full openssl x509 output. The certificate is Version 1, Serial Number 12345, signed with md2WithRSAEncryption. The Issuer is CN=PicoCTF. Validity runs from July 8 to June 26, 2019. The Subject fields all read PicoCTF. Under Subject Public Key Info, the Public Key Algorithm is rsaEncryption with a 53-bit key. The Modulus is 4966306421059967 (hex 0x11a4d45212b17f) and the Exponent is 65537 (0x10001). The Signature Algorithm is md2WithRSAEncryption followed by the signature bytes.](/writeups/picoctf-john-pollard/02.png)

Several things stood out immediately. The signature algorithm was `md2WithRSAEncryption` — MD2 is an obsolete hash function that has been deprecated since the 1990s due to collision vulnerabilities. The serial number was `12345`, the validity period was absurdly short, and every subject field was just "PicoCTF." But the critical detail was in the public key info:

```
Public-Key: (53 bit)
Modulus: 4966306421059967 (0x11a4d45212b17f)
Exponent: 65537 (0x10001)
```

A 53-bit RSA modulus. For context, RSA moduli in production systems are 2048 bits at minimum — that is approximately 617 decimal digits. This modulus was a 16-digit number. The exponent was the standard 65537 (Fermat prime F4), which is the default public exponent used in virtually all RSA implementations because it is prime, has a low Hamming weight (making modular exponentiation fast), and is large enough to resist certain attacks.

The entire challenge reduced to a single question: what are the two prime factors of 4966306421059967?

---

## Factoring the modulus

A 53-bit number can be factored by trial division in a fraction of a second — there are only about 800,000 primes below its square root. But for a clean demonstration, used [Alpertron's integer factorisation calculator](https://www.alpertron.com.ar/ECM.HTM), which implements several algorithms including the Elliptic Curve Method (ECM) and the Self-Initialising Quadratic Sieve (SIQS).

Entered `4966306421059967` into the calculator and clicked Factor.

![Alpertron's Integer factorisation calculator web page showing the value 4966306421059967 entered in the input field. The result below reads: 4 966 306 421 059 967 = 67 867 967 × 73 176 001. Additional information shows Number of divisors: 4, Sum of divisors: 4 966 306 562 103 936, and Euler's totient: 4 966 306 280 016 000.](/writeups/picoctf-john-pollard/03.png)

The factorisation was instant:

```
4966306421059967 = 67867967 × 73176001
```

Both factors were prime, confirming this was a standard RSA modulus (the product of exactly two primes). Alpertron also showed the number of divisors as 4 (1, p, q, and n) and Euler's totient as 4966306280016000, which equals (p − 1)(q − 1) = 67867966 × 73176000 — the value needed to compute the RSA private key exponent d = e⁻¹ mod φ(n).

The flag was the two primes in ascending order.

`picoCTF{67867967,73176001}`

---

## What I took from this

RSA's security model is straightforward: if you can factor the modulus n into its two prime components p and q, you can compute Euler's totient φ(n) = (p − 1)(q − 1), and from there derive the private exponent d = e⁻¹ mod φ(n) using the extended Euclidean algorithm. With d in hand, you can decrypt anything encrypted with the corresponding public key. The entire system holds together only because factoring a sufficiently large semiprime (a product of two primes) is computationally intractable — there is no known polynomial-time algorithm for integer factorisation on classical computers. A 53-bit modulus factors instantly; a 512-bit modulus was factorable by academic teams in 1999; a 768-bit modulus was factored in 2009 after years of distributed computation; and 1024-bit moduli are now considered within reach of well-resourced adversaries. This is why the minimum recommended key size today is 2048 bits, and many organisations are moving to 4096 bits. The challenge also illustrates why certificate validation matters — a real TLS implementation that accepted a 53-bit key would be catastrophically broken, and modern certificate authorities and browsers enforce minimum key sizes precisely to prevent this. The name "john_pollard" is a nod to the fact that specialised factorisation algorithms like Pollard's rho and Pollard's p − 1 made it possible to factor numbers that trial division alone could not handle efficiently, pushing the boundaries of what key sizes were considered safe at each point in cryptographic history.
