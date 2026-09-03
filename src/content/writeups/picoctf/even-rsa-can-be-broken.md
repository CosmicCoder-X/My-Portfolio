---
title: 'Even RSA can be broken???'
target: 'picoCTF — Even RSA can be broken???'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Cryptography challenge where the server's RSA key generation reused prime factors across connections, and computing the GCD of two different moduli revealed the shared prime, allowing full factorisation and decryption of the flag."
role: 'appsec'
tags: ['cryptography', 'rsa', 'gcd', 'common-factor-attack', 'python', 'picoctf']
problem: "A service that generates 1024-bit RSA keys and encrypts the flag on each connection. The hints suggest the prime generation is flawed and recommend comparing N values across multiple connections."
action: "Connected to the service twice to collect two different RSA moduli, computed their GCD to extract the shared prime factor, factored the first modulus, calculated the private key, and decrypted the ciphertext."
outcome: 'Retrieved the flag by exploiting the shared prime factor between two RSA key pairs.'
draft: false
---

## Background

Even RSA can be broken??? is a picoCTF Cryptography challenge that demonstrates what happens when RSA key generation reuses prime factors. RSA's security depends entirely on the difficulty of factoring the modulus N into its two prime components p and q. For a properly generated 1024-bit key, this factorisation is computationally infeasible. But if the same prime appears in two different moduli, the Greatest Common Divisor (GCD) of those moduli instantly reveals the shared factor — and from there, the entire private key can be reconstructed. The challenge hints made this direction clear: "How much do we trust randomness?", "Notice anything interesting about N?", and "Try comparing N across multiple requests."

---

## The encryption code

The challenge provided the Python source for the encryption service. The script generated a 1024-bit RSA key pair using a custom `get_primes` function imported from a separate `setup` module, encrypted the flag, and printed the public modulus N, the public exponent e, and the ciphertext:

```python
from Crypto.Util.number import bytes_to_long, inverse
from setup import get_primes

e = 65537

def gen_key(k):
    p, q = get_primes(k // 2)
    N = p * q
    d = inverse(e, (p - 1) * (q - 1))
    return ((N, e), d)

def encrypt(pubkey, m):
    N, e = pubkey
    return pow(bytes_to_long(m.encode('utf-8')), e, N)
```

The public exponent `e = 65537` was standard. The `get_primes` function was hidden inside the `setup` module — its implementation was not provided, but the hints strongly suggested it was not generating truly independent primes on each call.

---

## Collecting two moduli

Connected to the service at `verbal-sleep.picoctf.net:52407` and recorded the first set of values:

```
N1: 15246371575666810318071560882478537680794162003233695143063687779299219917798096533287873061794928043973546967162708047565879160057881329756701227629701058
e:  65537
c1: 14936627686918967033826024603671491500159795625645685666831649978691027405407167068077266014318526139391629817446892935951972789216938309628528087682212125
```

Connected a second time and recorded the new modulus:

```
N2: 15772710152380393956677230998150838832724202526226220965511426207234192194165075180356723438817864378694883898093570590246925419068885667217116725696190134
```

If the `get_primes` function was reusing a prime factor across connections, then N1 and N2 would share a common factor. Computing `gcd(N1, N2)` would reveal it instantly — GCD runs in negligible time regardless of the number size.

---

## The common factor attack

The attack was straightforward. If N1 = p * q1 and N2 = p * q2 (where p is the reused prime), then `gcd(N1, N2) = p`. With p known, q1 = N1 / p, and the private key d1 can be computed from Euler's totient phi1 = (p - 1) * (q1 - 1).

```python
import math
from Crypto.Util.number import inverse, long_to_bytes

N1 = 15246371575666810318071560882478537680794162003233695143063687779299219917798096533287873061794928043973546967162708047565879160057881329756701227629701058
c1 = 14936627686918967033826024603671491500159795625645685666831649978691027405407167068077266014318526139391629817446892935951972789216938309628528087682212125
e_val = 65537
N2 = 15772710152380393956677230998150838832724202526226220965511426207234192194165075180356723438817864378694883898093570590246925419068885667217116725696190134

p = math.gcd(N1, N2)
q1 = N1 // p
phi1 = (p - 1) * (q1 - 1)
d1 = inverse(e_val, phi1)
decrypted_long = pow(c1, d1, N1)
flag = long_to_bytes(decrypted_long).decode('utf-8')
print(flag)
```

The GCD returned the shared prime:

```
p  = 123439192946039034801809120305083945267363892514679133300848677421895674628059
q1 = 123513415390757898019809562130807954003000731286904045366732182730985398230967
```

With both factors known, the script computed the private exponent d1, decrypted the ciphertext using modular exponentiation `pow(c1, d1, N1)`, and converted the resulting integer back to bytes.

`picoCTF{tw0_1$_pr!m3605cd50e}`

---

## What I took from this

This challenge is a clean demonstration of why RSA's security is entirely dependent on the quality of its prime generation. The mathematical hardness of factoring a 1024-bit semiprime is irrelevant if the primes are not unique — GCD is an O(log N) operation that can find a shared factor between two moduli in microseconds, no matter how large they are. This is not a theoretical concern: in 2012, researchers analysed millions of RSA public keys collected from the internet and found that approximately 0.2% of them shared a prime factor with at least one other key, due to poor entropy in embedded devices and virtual machines during key generation. The fix is straightforward — use a cryptographically secure random number generator (like `/dev/urandom` or Python's `secrets` module) with sufficient entropy, and never reuse or seed the generator predictably. The `get_primes` function in this challenge was a black box, but the fact that it produced overlapping primes across connections meant it was either using a fixed seed, drawing from a limited pool, or had some other entropy flaw. In production systems, RSA key generation should also verify that p and q are sufficiently different (their difference should not be too small, which would make Fermat's factorisation method viable) and that neither p-1 nor q-1 has only small prime factors (which would make Pollard's p-1 algorithm effective).
