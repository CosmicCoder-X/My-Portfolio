---
title: 'No SQL Injection'
target: 'picoCTF — No SQL Injection'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Web Exploitation challenge where an Express.js/MongoDB login application JSON.parse()d user input when wrapped in curly braces, enabling NoSQL operator injection. Sent the $ne (not equal) operator as the password to bypass authentication, then decoded the base64 token in the response to retrieve the flag."
role: 'appsec'
tags: ['web-exploitation', 'nosql-injection', 'mongodb', 'mongoose', 'express', 'nodejs', 'burp-suite', 'base64', 'authentication-bypass', 'source-code-review', 'picoctf']
problem: "A login page backed by MongoDB through Mongoose, with downloadable source code (app.tar.gz). The objective is to bypass authentication by exploiting how the server handles user input in MongoDB queries and extract the flag from the authenticated response."
action: "Extracted the source code and reviewed server.js, which revealed the /login handler JSON.parse()d input values wrapped in curly braces before passing them into MongoDB's findOne() query. The seeded user had a random hex password, making brute-force unviable, so crafted a NoSQL operator injection payload sending the password as {\"$ne\": \"\"} via Burp Suite. The server parsed this into a MongoDB $ne operator that matched any non-empty password, bypassing authentication and returning a base64-encoded token that decoded to the flag."
outcome: "Bypassed authentication and retrieved the flag picoCTF{jBhD2y7XoNzPv_1YxS9Ew5qL0uI6pasql_injection_784e40e8} through NoSQL operator injection. The source code review made the attack path unambiguous by revealing the exact parsing logic, known email, and flag storage location."
draft: false
---

## Background

No SQL Injection is a picoCTF Web Exploitation challenge targeting MongoDB through a Node.js/Express application. The challenge provides both the live application and its source code, making it a white-box exercise where the vulnerability can be identified through code review before launching a single request. The attack vector is NoSQL operator injection — a technique that abuses MongoDB's query operators (like `$ne`, `$gt`, `$regex`) when user input is passed directly into query objects without sanitisation.

---

## Reviewing the source code

The challenge provided the source code as `app.tar.gz`. Extracting it:

```
gunzip app.tar.gz
tar -xvf app.tar
```

![Kali terminal showing cd app followed by ls listing the extracted files: admin.html, index.html, package.json, and server.js.](/writeups/picoctf-nosql-injection/01.png)

The extracted `app` folder contained four files: `admin.html`, `index.html`, `package.json`, and `server.js`. The HTML files were standard frontend pages and `package.json` listed the dependencies (Express, Mongoose, MongoMemoryServer). The entire backend logic lived in `server.js`.

Reading through the source revealed three critical pieces of information. First, the user schema included a `token` field that defaulted to `"{{Flag}}"` — meaning the actual flag was stored as the token value for every user in the database. Second, a single user was seeded on startup with the email `picoplayer355@picoctf.org` and a randomly generated 16-character hex password (`crypto.randomBytes(16).toString("hex").slice(0, 16)`) — brute-forcing was not an option with that entropy. Third, and most importantly, the `/login` endpoint contained the vulnerability:

```javascript
const user = await User.findOne({
  email:
    email.startsWith("{") && email.endsWith("}")
      ? JSON.parse(email)
      : email,
  password:
    password.startsWith("{") && password.endsWith("}")
      ? JSON.parse(password)
      : password,
});
```

The code checked whether the email and password values started with `{` and ended with `}`. If they did, it ran `JSON.parse()` on them before inserting them into the MongoDB `findOne()` query. This was an explicit — almost educational — injection point. By sending a password value like `{"$ne": ""}`, the server would parse it into a JavaScript object `{$ne: ""}` and pass that directly into the query. MongoDB would then interpret `$ne` as the "not equal" operator, matching any document where the password field was not equal to an empty string. Since the stored password was a random hex string, the condition would always be true.

---

## Exploiting the injection

With the vulnerability understood and the known email in hand, the attack was a single crafted request. Opened Burp Suite, navigated to the login page, and captured a login attempt. Sent the request to Repeater and modified the JSON body to:

```json
{"email":"picoplayer355@picoctf.org","password":"{\"$ne\": \"\"}"}
```

The password field contained the string `{"$ne": ""}` — the server's `startsWith("{")` check detected the curly braces, `JSON.parse()` converted it to the MongoDB operator object `{$ne: ""}`, and the `findOne()` query became: find a user where email equals `picoplayer355@picoctf.org` AND password is not equal to empty string. The seeded user's random hex password was definitely not empty, so the query matched.

![Burp Suite Repeater showing the POST /login request with JSON body containing the known email and the NoSQL injection payload {"$ne":""} as the password, and the server response returning HTTP 200 with success true, the user email, a base64-encoded token field, firstName pico, and lastName player.](/writeups/picoctf-nosql-injection/02.png)

The server responded with HTTP 200 and a JSON body containing `"success": true` along with the user's details: email, firstName "pico", lastName "player", and the token field holding a base64-encoded string.

---

## Decoding the flag

The token value `cGljb0NURntqQmhEMnk3WG9OelB2XzFZeFM5RXc1cUwwdUk2cGFzcWxfaW5qZWN0aW9uXzc4NGU0MGU4fQ==` was clearly base64. Decoded it in the terminal:

```bash
echo "cGljb0NURntqQmhEMnk3WG9OelB2XzFZeFM5RXc1cUwwdUk2cGFzcWxfaW5qZWN0aW9uXzc4NGU0MGU4fQ==" | base64 -d
```

![Kali terminal showing the base64 decode command and its output: picoCTF{jBhD2y7XoNzPv_1YxS9Ew5qL0uI6pasql_injection_784e40e8}.](/writeups/picoctf-nosql-injection/03.png)

`picoCTF{jBhD2y7XoNzPv_1YxS9Ew5qL0uI6pasql_injection_784e40e8}`

---

## What I took from this

This challenge was deliberately transparent about its vulnerability — the source code made the injection point obvious, and the flag name itself contains "nosql_injection". But the pattern it demonstrates shows up in real applications more often than it should. The root cause was trusting user input enough to `JSON.parse()` it and feed the result directly into a database query. MongoDB's query language uses JavaScript objects, so any user-controlled object that reaches a query can inject operators like `$ne` (not equal), `$gt` (greater than), `$regex` (pattern match), or `$where` (arbitrary JavaScript execution). The `$ne` bypass used here is the simplest form — it matches any document where the field is not equal to the injected value — but more sophisticated attacks can extract data character by character using `$regex` or achieve full code execution through `$where`. The defences are straightforward: validate that user inputs are the expected type (strings, not objects), never parse user input into query objects, use parameterised queries or explicit field matching, and apply an allowlist of accepted keys if object input is genuinely needed. In this case, simply removing the `JSON.parse()` logic and treating email and password as plain strings would have closed the vulnerability entirely.
