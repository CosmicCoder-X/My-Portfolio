---
title: 'No SQL Injection'
target: 'picoCTF — No SQL Injection'
difficulty: 'medium'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge — an Express.js login application backed by MongoDB (Mongoose + MongoMemoryServer) where the provided source code (server.js) revealed that the /login endpoint JSON.parse()d email and password fields when wrapped in curly braces, enabling NoSQL operator injection by sending the password as {"$ne":""} (not equal to empty string) which matched the stored user picoplayer355@picoctf.org regardless of the actual password value, returning a JSON response containing a base64-encoded token field that decoded to the flag picoCTF{jBhD2y7XoNzPv_1YxS9Ew5qL0uI6pasql_injection_784e40e8}.'
role: 'appsec'
tags: ['web-exploitation', 'nosql-injection', 'mongodb', 'mongoose', 'express', 'nodejs', 'burp-suite', 'base64', 'authentication-bypass', 'source-code-review', 'picoctf']
problem: 'No SQL Injection is a picoCTF Web Exploitation challenge presenting a login page backed by MongoDB through Mongoose. The challenge provides both the web application link and a downloadable source code archive (app.tar.gz). The objective is to bypass authentication by exploiting how the server handles user input in MongoDB queries, then extract the flag from the authenticated response.'
action: 'The challenge provided two links: one to download the source code archive and another to the live application. Started by extracting the source code with gunzip app.tar.gz followed by tar -xvf app.tar to examine the application logic before attacking it. The extracted app folder contained four files: admin.html, index.html, package.json, and server.js. The HTML files were standard frontend pages and package.json listed the dependencies — the interesting file was server.js which contained the entire backend logic. Reading through server.js revealed everything needed for the attack. The application was built on Express.js with Mongoose connecting to a MongoMemoryServer instance. The user schema defined five fields: email, firstName, lastName, password, and token — with the token field defaulting to "{{Flag}}", meaning the actual flag value would be stored in the token field of every user record. During server startup, a single user was seeded into the database with the email picoplayer355@picoctf.org, names "pico" and "player", and a randomly generated 16-character hex password using crypto.randomBytes(16).toString("hex").slice(0, 16). That random password meant brute-forcing was not viable — the attack had to bypass the password check entirely. The critical vulnerability was in the /login POST handler. The code extracted email and password from the request body, then applied a conditional transformation before using them in the MongoDB query: if the value started with "{" and ended with "}", it was passed through JSON.parse(), otherwise it was used as a plain string. This meant that sending a JSON object as the password value — wrapped in curly braces so the startsWith/endsWith check triggered the parse — would inject a MongoDB query operator directly into the findOne() query. The classic NoSQL authentication bypass uses the $ne (not equal) operator. By sending the password as {"$ne":""}, the MongoDB query becomes: find a user where email equals "picoplayer355@picoctf.org" AND password is not equal to empty string. Since the stored password was a random hex string (definitely not empty), the condition evaluated to true and the query returned the user — authentication bypassed without knowing the actual password. Opened the live application which presented a login page. The known email picoplayer355@picoctf.org was visible as a hint on the page. Rather than submitting through the browser form, captured the login request in Burp Suite to have full control over the JSON payload. In Burp Repeater, crafted the POST request to /login with Content-Type: application/json and the body: {"email":"picoplayer355@picoctf.org","password":"{\"$ne\": \"\"}"}. The password value was the string {"$ne": ""} — the outer quotes made it a JSON string value in the request body, and the server''s startsWith("{") / endsWith("}") check detected the curly braces and JSON.parse()d it into the MongoDB operator object {$ne: ""}. The server responded with HTTP 200 and a JSON body containing: success true, email picoplayer355@picoctf.org, firstName pico, lastName player, and a token field containing a base64-encoded string: cGljb0NURntqQmhEMnk3WG9OelB2XzFZeFM5RXc1cUwwdUk2cGFzcWxfaW5qZWN0aW9uXzc4NGU0MGU4fQ==. Decoded the token in the terminal with echo "cGljb0NURntqQmhEMnk3WG9OelB2XzFZeFM5RXc1cUwwdUk2cGFzcWxfaW5qZWN0aW9uXzc4NGU0MGU4fQ==" | base64 -d which output the flag: picoCTF{jBhD2y7XoNzPv_1YxS9Ew5qL0uI6pasql_injection_784e40e8}.'
outcome: 'Bypassed authentication and retrieved the flag picoCTF{jBhD2y7XoNzPv_1YxS9Ew5qL0uI6pasql_injection_784e40e8} through NoSQL operator injection. The vulnerability existed because the server intentionally parsed JSON objects from string inputs and passed them directly into the MongoDB query, allowing the $ne operator to match any non-empty password. The source code review was the key accelerator — reading server.js revealed the exact parsing logic, the known email address, and the fact that the flag was stored in the token field of the user record. Without source code, the same vulnerability could have been discovered through testing JSON payloads in the login form, but the code made the attack path unambiguous. The correct mitigations are: sanitise and validate user input against an allowlist of accepted characters, use parameterised queries instead of directly interpolating user input into query objects, and apply an allowlist of accepted keys to prevent operator injection — never JSON.parse() user-supplied strings into database query parameters.'
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
