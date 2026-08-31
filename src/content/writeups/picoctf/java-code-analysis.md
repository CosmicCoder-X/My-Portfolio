---
title: 'Java Code Analysis!?!'
target: 'picoCTF — Java Code Analysis!?!'
difficulty: 'medium'
date: 2026-08-31
summary: 'BookShelf Pico protects its Flag book with an HS256 JWT, but source review exposes the hardcoded signing key 1234. I forged an Admin token, replaced the browser''s local-storage values, and accessed picoCTF{w34k_jwt_n0t_g00d_42f5774a}.'
role: 'appsec'
tags: ['web-exploitation', 'jwt', 'java', 'source-code-review', 'hardcoded-secret', 'authentication-bypass', 'authorization', 'picoctf']
problem: 'A Free user can see but cannot read the Admin-only Flag book in BookShelf Pico.'
action: 'Reviewed the Java JWT implementation, recovered the hardcoded HS256 secret 1234, changed the Free token claims to Admin with userId 2 and email admin, signed the token, and replaced the matching local-storage values.'
outcome: 'The forged Admin JWT unlocked the Flag book and revealed picoCTF{w34k_jwt_n0t_g00d_42f5774a}. Store signing keys outside source code and never trust client-controlled role claims alone.'
draft: false
---

## Background

Java Code Analysis!?! is a picoCTF Web Exploitation challenge based on a Java
application called **BookShelf Pico**. The application presents an online book
library, but its most interesting title—**Flag**—is unavailable to ordinary
users. It is marked as an Admin-only book.

The supplied account is a Free account, so logging in is enough to see the
application but not enough to read the protected content.

![The BookShelf Pico login page with Email and Password fields, a Login button, and a Sign up link beneath the red BookShelf Pico header.](/writeups/picoctf-java-code-analysis/01.png)

The challenge hints narrow the source review to the Java application''s
controllers, services, and security code. That matters here: the target is not
to guess an administrator password, but to understand how the application
creates and verifies its authorisation token.

---

## Following the JWT signing path

The Flag book states that an Admin role is required. Its locked view also makes
the client-side authentication state easy to spot: browser local storage holds
an `auth-token` and a separate `token-payload` value.

![The locked Flag book in BookShelf Pico saying that an Admin role is required, with browser developer tools open to Storage > Local Storage. The entries auth-token and token-payload are visible for the challenge site.](/writeups/picoctf-java-code-analysis/02.png)

That token structure is a strong sign that the application uses a JSON Web
Token (JWT). A JWT signed with `HS256` is trustworthy only while its HMAC secret
remains private, so the first useful question from the hints is where that
secret comes from.

Reviewing the security package leads to `SecretGenerator.java`. The method
named `generateRandomString(int len)` looks as though it should create a new
secret, but the implementation has been replaced by a fixed return value:

```java
return "1234";
```

![Visual Studio Code displaying SecretGenerator.java in the BookShelf Pico security package. The generateRandomString method contains a comment saying not so random and returns the hardcoded value 1234.](/writeups/picoctf-java-code-analysis/03.png)

This gives the exact secret used to sign the application''s JWTs: `1234`.
Knowing a symmetric JWT secret is equivalent to knowing how to mint tokens for
the application. It is a checkpoint, not the complete bypass—the forged token
still has to contain the claims expected for an administrator.

---

## Reading the Free-user token

I opened developer tools with `F12`, selected **Storage**, then **Local
Storage**, and copied the `auth-token` value. Pasting it into
[jwt.io](https://jwt.io/) revealed an `HS256` header and the current Free-user
payload.

![jwt.io showing the copied encoded JWT on the left and its decoded HS256 header and payload on the right. The payload identifies a Free user of BookShelf Pico with userId 1 and email user, while the HMACSHA256 secret field is still empty.](/writeups/picoctf-java-code-analysis/04.png)

The fields relevant to authorisation were clear:

```json
{
  "role": "Free",
  "iss": "bookshelf",
  "userId": 1,
  "email": "user"
}
```

The token also includes normal issued-at and expiry timestamps. Those do not
need to be invented or removed; the important change is to turn the identity
and privilege claims into the Admin account described by the application.

---

## Forging an Admin token

In jwt.io, I changed the relevant payload fields to the Admin values and entered
the recovered secret in the signature-verification field:

```json
{
  "role": "Admin",
  "iss": "bookshelf",
  "userId": 2,
  "email": "admin"
}
```

The signing secret was:

```text
1234
```

![jwt.io showing the edited JWT payload with role Admin, userId 2, and email admin. The Verify Signature section uses HMACSHA256 with 1234 entered as the secret, producing a newly signed encoded token.](/writeups/picoctf-java-code-analysis/05.png)

Because the application uses `HS256`, jwt.io can compute a valid HMAC signature
for the edited payload once it has the same secret as the server. The resulting
token is not merely decoded data with a changed role—it is a cryptographically
valid token from the server''s point of view because the server secret was
exposed.

I copied the new encoded value into the `auth-token` local-storage entry. I
also replaced `token-payload` with the matching Admin JSON so the browser''s
stored client state matched the claims in the signed token. After editing, I
used the refresh control in developer tools to ensure the updated local-storage
values were saved.

![Browser developer tools open to Local Storage after the edit, showing a new auth-token and token-payload with role Admin, issuer bookshelf, userId 2, and email admin. The storage refresh button is highlighted.](/writeups/picoctf-java-code-analysis/06.png)

---

## Reading the Flag book

Refreshing BookShelf Pico caused the application to recognise the forged token
as an Admin session. The account label changed to **Admin**, the Flag book was
no longer locked, and its contents became visible.

![The unlocked Flag book in BookShelf Pico under an Admin account. The open page reads Great job! Here''s your flag: picoCTF{w34k_jwt_n0t_g00d_42f5774a}.](/writeups/picoctf-java-code-analysis/07.png)

`picoCTF{w34k_jwt_n0t_g00d_42f5774a}`

---

## What I took from this

This challenge is a clear example of the difference between using a security
mechanism and using it securely. JWT signatures protect tokens from tampering
only if the signing key is unpredictable and remains secret. Returning `1234`
from a Java method named `generateRandomString` defeats the entire purpose of
the signature: anyone with the source can create a token with whatever `role`,
`userId`, and `email` the application accepts.

Hardcoded secrets should never be committed with application code. The JWT key
should be high-entropy, injected at deployment from a protected secret manager
or environment configuration, and rotated immediately if it is ever exposed.
For access to sensitive resources, applications should also treat client
claims carefully: the server should validate the token and, where appropriate,
resolve current permissions from trusted server-side account data instead of
making an unverified business decision from a role value the client can retain
for the life of a token. Finally, short-lived tokens in secure, HttpOnly cookie
storage reduce the impact of browser-side token theft compared with persistent
tokens stored in local storage.
