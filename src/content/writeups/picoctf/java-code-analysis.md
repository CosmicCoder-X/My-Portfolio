---
title: 'Java Code Analysis!?!'
target: 'picoCTF — Java Code Analysis!?!'
difficulty: 'medium'
date: 2026-08-31
summary: 'Java Code Analysis!?! is a picoCTF Web Exploitation challenge built around BookShelf Pico, a Java application that uses an HS256 JSON Web Token to decide which books a user may read. The Flag book is restricted to the Admin role, but source-code review of the security package reveals that SecretGenerator.generateRandomString() returns the hardcoded signing key 1234. After locating the Free user token in browser local storage, I decoded it, changed its role to Admin, userId to 2, and email to admin, signed the revised claims with the recovered secret, replaced both local-storage token values, and refreshed the application to read picoCTF{w34k_jwt_n0t_g00d_42f5774a}.'
role: 'appsec'
tags: ['web-exploitation', 'jwt', 'java', 'source-code-review', 'hardcoded-secret', 'authentication-bypass', 'authorization', 'picoctf']
problem: 'BookShelf Pico is an online reading application that provides a Free account but reserves the Flag book for an Admin-level account. The application stores an authentication token in browser local storage and relies on a JWT role claim for authorisation. The objective is to analyse the supplied Java source code, recover the JWT signing secret, forge a valid Admin token, and use it to access the protected book.'
action: 'Started at the BookShelf Pico login page and used the supplied Free account to enter the application. The Flag book was visible but locked, with the page explaining that an Admin role was required. The challenge hints specifically pointed to the controllers, services, and security packages, so I followed the JWT flow through the Java source instead of guessing at the role check. In src/main/java/io/github/nandandesai/pico/security/SecretGenerator.java, the generateRandomString(int len) method was supposed to create a server secret but returned the literal string 1234. Because JwtService used that value to sign HS256 tokens, 1234 was the complete JWT signing secret rather than a random value. Next, I opened the locked Flag book and used browser developer tools (F12) to inspect Storage > Local Storage for the challenge origin. Local storage contained auth-token, the signed JWT, and token-payload, its decoded JSON representation. I copied auth-token into jwt.io, which decoded it as an HS256 JWT for the Free user, including role Free, issuer bookshelf, userId 1, and email user. The role and userId hints showed which claims controlled access. I replaced the payload claims with role Admin, userId 2, and email admin, retained the normal issuer and time claims, and supplied 1234 in jwt.io''s HMACSHA256 verification-secret field. jwt.io then produced a new JWT whose signature matched the modified payload. I copied that complete signed token back into the auth-token local-storage value and updated token-payload to the matching JSON claims so the client-side state agreed with the token. Developer tools required a storage refresh after editing before the change was persisted. Finally, I refreshed the BookShelf Pico page. The account label changed to Admin, the Flag book unlocked, and its page displayed the flag.'
outcome: 'Forging a correctly signed Admin JWT bypassed the application''s role-based access control and revealed picoCTF{w34k_jwt_n0t_g00d_42f5774a}. The failure was not JWT itself but the application''s secret management: a predictable, hardcoded HS256 secret lets anyone who can inspect the source create valid tokens with arbitrary claims. A secure implementation must generate a high-entropy secret outside the source tree, store it in a protected secret manager or environment configuration, rotate it when exposed, and avoid storing long-lived bearer tokens in local storage where injected JavaScript can access them. Server-side authorisation should also verify current account privileges from trusted data for sensitive actions instead of treating a client-controlled role claim as the sole source of truth.'
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
