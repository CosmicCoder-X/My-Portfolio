---
title: 'JAuth'
target: 'picoCTF — JAuth'
difficulty: 'medium'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where logging in with provided demo credentials returned a JWT cookie using HS256, and changing the algorithm to "none" while setting the role claim from "user" to "admin" — then stripping the signature — bypassed verification and granted admin access with the flag.'
role: 'appsec'
tags: ['web-exploitation', 'jwt', 'authentication-bypass', 'none-algorithm', 'token-manipulation', 'picoctf']
problem: 'A web application with a login page and demo credentials (test / Test123!). The objective is to escalate from a regular user to admin by exploiting the JWT authentication mechanism.'
action: 'Logged in with the demo credentials, extracted the JWT cookie, decoded it to find alg: HS256 and role: user, changed alg to "none" and role to "admin", removed the signature, replaced the cookie and refreshed to gain admin access.'
outcome: 'Retrieved the flag by exploiting the JWT none-algorithm vulnerability, where the server accepted an unsigned token as valid because it honoured the attacker-controlled algorithm field.'
draft: false
---

## Background

JAuth is a picoCTF Web Exploitation challenge targeting JSON Web Tokens (JWT). JWTs are a widely used authentication mechanism — a token is issued after login, containing claims about the user (their role, session ID, expiry) signed with a secret key. The server verifies the signature on each request to ensure the token has not been tampered with. The "none" algorithm attack exploits a flaw where the server trusts the `alg` field in the token header to decide how to verify the signature — if the attacker changes it to `"none"`, a misconfigured server skips verification entirely, accepting any payload without a valid signature.

---

## Logging in with the demo account

The challenge presented a login page with the message "Authentication failed :(" and a hint below the form: "Try this demo account" with username `test` and password `Test123!`.

![Login page with dark background showing "Authentication failed :(" in green text at the top, Username and Password input fields with a green "login" button, and below it a demo account section with red arrows pointing to username: test and password: Test123!.](/writeups/picoctf-jauth/01.png)

Logging in with those credentials succeeded. After authentication, the application set a JWT cookie in the browser — the token that would be sent with every subsequent request to prove the user's identity.

---

## Decoding the JWT

Extracted the JWT cookie and decoded it in a JWT debugger. The token followed the standard three-part structure (`header.payload.signature`) and used HS256 (HMAC-SHA256) for signing.

![JWT decoder showing the full token string with "Signature verification failed" warning. The Header section shows typ: "JWT" and alg: "HS256". The Payload section shows auth: 1705843213141, agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64;...", role: "user", and iat: 1705843213.](/writeups/picoctf-jauth/02.png)

The payload contained four claims: `auth` (a timestamp), `agent` (the browser User-Agent string), `role` set to `"user"`, and `iat` (issued-at timestamp). The `role` field was the target — changing it to `"admin"` would grant elevated access, but simply editing the payload would invalidate the HS256 signature, and the server would reject the token.

---

## The none-algorithm attack

The bypass exploited the fact that the server trusted the `alg` field in the token header to decide which algorithm to use for signature verification. By changing `alg` from `"HS256"` to `"none"`, the server would treat the token as unsigned — no signature to verify, so no signature to fail. The attack required two changes to the token:

1. In the header: change `"alg": "HS256"` to `"alg": "none"`
2. In the payload: change `"role": "user"` to `"role": "admin"`

Both sections were then base64url-encoded, concatenated with a dot, and the signature section (the third part after the second dot) was left empty — producing a token in the form `header.payload.` (with a trailing dot and no signature).

The crafted token:

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJhdXRoIjoxNzA1ODQzMjEzMTQxLCJhZ2VudCI6Ik1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQ7IHJ2OjEyMS4wKSBHZWNrby8yMDEwMDEwMSBGaXJlZm94LzEyMS4wIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzA1ODQzMjEzfQ.
```

Replaced the JWT cookie in the browser with this crafted token and refreshed the page. The server accepted the unsigned token, read the `role` claim as `"admin"`, and granted admin access — displaying the flag.

---

## What I took from this

The none-algorithm attack is one of the most well-known JWT vulnerabilities, documented in RFC 7519 itself. It works because the token carries its own verification instructions in the `alg` header field, and a naive implementation uses that field to select the verification method. When an attacker sets `alg` to `"none"`, the server skips signature verification and accepts whatever claims the token contains. The fix is to never trust the `alg` field from the token — the server should have a hardcoded expected algorithm and reject any token that specifies a different one. Most modern JWT libraries support an `algorithms` allowlist parameter for exactly this reason: `jwt.verify(token, secret, { algorithms: ["HS256"] })` will reject tokens with `alg: "none"` regardless of what the token says. Additionally, the payload's `role` claim should be validated against the server's own user database rather than taken at face value from the token.
