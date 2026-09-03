---
title: 'Dachshund Attacks'
target: 'picoCTF — Dachshund Attacks'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Cryptography challenge where an RSA service used a dangerously small private exponent d, making it vulnerable to Wiener's attack. Using the owiener Python module recovered d and decrypted the ciphertext to reveal the flag."
role: 'appsec'
tags: ['cryptography', 'rsa', 'wieners-attack', 'python', 'picoctf']
problem: "A netcat service that presents an RSA challenge with a public key (e, n) and ciphertext c. The description asks what happens when the private exponent d is too small, hinting at a specific class of RSA vulnerability."
action: "Connected to the service to retrieve e, n, and c. Recognised from the challenge description that d was deliberately small, researched RSA attacks for small private exponents, found Wiener's attack on StackExchange, then used the owiener Python module to recover d and decrypt the ciphertext with modular exponentiation."
outcome: "Recovered the private exponent d via Wiener's attack and decrypted the ciphertext to retrieve the flag."
draft: false
---

## Background

Dachshund Attacks is a picoCTF Cryptography challenge about exploiting RSA when the private exponent d is too small. The challenge description asks "What if d is too small?" and provides a netcat endpoint. The title is a play on words — "dachshund" is a small dog breed, and the "attack" in question is Wiener's attack, named after cryptographer Michael J. Wiener, who published it in 1990. Wiener showed that when the private exponent d is smaller than N^(1/4) / 3 (where N is the RSA modulus), the private key can be efficiently recovered from the public key alone using continued fraction expansion.

---

## Connecting to the service

Connected to the challenge server with netcat:

```
$ nc mercury.picoctf.net 58978
```

![Parrot terminal showing the netcat connection to mercury.picoctf.net on port 58978. The server responds with "Welcome to my RSA challenge!" followed by three large integers: e (the public exponent, starting with 7557163...), n (the modulus, starting with 1042648...), and c (the ciphertext, starting with 8356485...). All three values are several hundred digits long.](/writeups/picoctf-dachshund-attacks/01.png)

The server returned the RSA public key components and the ciphertext:

```
e: 755716300115592474679160041963655237231017499882747208569996331561006979497432...
n: 104264822177559958121185345685625126738948262250287370765852641494623692689301...
c: 835648516358493412663388704767446198242795626622811408373610545265369788341573...
```

In standard RSA, the public key consists of the modulus n (the product of two large primes p and q) and the public exponent e. The private key is the exponent d, computed as the modular inverse of e modulo φ(n) = (p − 1)(q − 1). Normally d is roughly the same size as n, making it impossible to guess or derive from the public key. But when d is artificially small — chosen for computational efficiency at the cost of security — the relationship between e and n leaks enough information for Wiener's attack to succeed.

---

## Researching the attack

The challenge description's question — "What if d is too small?" — pointed directly at a known class of RSA vulnerability. Searching for RSA attacks involving small private exponents led to a [StackExchange thread on RSA with small exponents](https://crypto.stackexchange.com/questions/109/rsa-with-small-exponents) that explained Wiener's attack. The core idea is that when d is small, the fraction e/n is a close rational approximation to a value related to d, and the convergents of the continued fraction expansion of e/n will include d (or more precisely, k/d where ed − kφ(n) = 1). This makes d recoverable in polynomial time without factoring n.

Further research turned up [owiener](https://github.com/orisano/owiener), a Python module that implements Wiener's attack. It takes e and n as inputs and returns d if the attack succeeds (i.e., if d is small enough to be in the continued fraction convergents).

---

## Writing and running the exploit

Installed the module with `pip3 install owiener` and wrote the exploit script:

```python
from Crypto.Util.number import *
import owiener

e = 75571630011559247467916004196365523723101749988274720856999633156100697949743229077254373572473553761409481204022236889285190344754598081629426878749038961992559483017510204445286211564579753927334633248616319273771592747840826682584585847158766063499572532690940648861536320335662618590177784873191208376037
n = 104264822177559958121185345685625126738948262250287370765852641494623692689301649825547648501037132023974059804732149880588649290412105537795539805864389176667291601168394340155301958074970190593946373249753144957916714362759829480068864579021086995046026296861777530607804711786502467899665982253012394687251
c = 83564851635849341266338870476744619824279562662281140837361054526536978834157331984295060906712640868013778333597207660860181436373499646293252823016766855129530658534013113108780224192546026799770378469971857070221572442911910694608072037067945670659135977127851512408796241927039506392357999689816670800206

d = owiener.attack(e, n)

if d is None:
    print("Failed")
else:
    print("Hacked d={}".format(d))
    M = pow(c, d, n)
    print(long_to_bytes(M))
```

The script had three steps. First, `owiener.attack(e, n)` performed the continued fraction expansion of e/n and checked each convergent to see if it yielded a valid private exponent. Second, once d was recovered, `pow(c, d, n)` performed the RSA decryption — computing c^d mod n to recover the plaintext integer M. Third, `long_to_bytes(M)` from PyCryptodome converted that integer back into bytes, producing the flag as readable text.

Running the exploit:

![Parrot terminal showing the exploit output. The command python3 exploit.py runs and prints "Hacked d=229500157428288110720274732282526363625123381656369483220206940467145080 45389" followed by "b'picoCTF{proving_wiener_6907362}'" — the recovered private exponent and the decrypted flag.](/writeups/picoctf-dachshund-attacks/02.png)

The attack recovered the private exponent d and decrypted the ciphertext instantly.

`picoCTF{proving_wiener_6907362}`

---

## What I took from this

Wiener's attack exploits a fundamental trade-off in RSA key generation. A small private exponent d makes decryption faster (since decryption computes c^d mod n, and a smaller d means fewer multiplications), which is why some implementations were tempted to choose small values of d. Wiener's 1990 paper showed this was catastrophic: if d < N^(1/4) / 3, the attacker can recover d from the public key (e, n) alone using the continued fraction method, without ever factoring N. The mathematical basis is that e and φ(n) are related by ed ≡ 1 (mod φ(n)), which means ed = kφ(n) + 1 for some integer k. Dividing both sides by dN gives e/N ≈ k/d (since φ(n) ≈ N for large primes). When d is small, k is also small, and k/d appears as a convergent in the continued fraction expansion of e/N. The continued fraction algorithm efficiently enumerates all close rational approximations to e/N, and for each candidate k/d, the attacker can check whether it yields a valid factorisation of N. The fix is straightforward: never use a private exponent smaller than N^(1/2). In practice, most RSA implementations generate d as the modular inverse of e modulo φ(n) with no attempt to minimise it, which naturally produces a d roughly the same size as N. The lesson extends beyond this specific attack — any attempt to optimise RSA by constraining key parameters opens the door to mathematical attacks that exploit the resulting structure.
