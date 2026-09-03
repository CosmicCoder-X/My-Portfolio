---
title: 'Irish-Name-Repo 3'
target: 'picoCTF — Irish-Name-Repo 3'
difficulty: 'medium'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where an admin login applied ROT13 to the password before inserting it into a SQL query, so encoding a standard SQL injection payload with ROT13 beforehand produced the correct cleartext injection after the server decoded it.'
role: 'appsec'
tags: ['web-exploitation', 'sql-injection', 'rot13', 'authentication-bypass', 'hidden-fields', 'picoctf']
problem: 'An Irish-themed website with an admin login page. The password field is transformed server-side before being used in the SQL query, and a hidden debug field in the form reveals the transformation.'
action: 'Enabled the hidden debug field, submitted a test password to discover it was ROT13-encoded before query insertion, then ROT13-encoded a SQL injection payload and submitted it as the password to bypass authentication.'
outcome: 'Retrieved the flag by submitting a pre-encoded SQL injection payload that became valid SQL after the server applied ROT13.'
draft: false
---

## Background

Irish-Name-Repo 3 is a picoCTF Web Exploitation challenge that combines SQL injection with a simple cipher. The application applies ROT13 — a letter substitution cipher that shifts each letter 13 positions in the alphabet — to the password input before inserting it into the SQL query. A standard SQL injection payload would be garbled by this transformation, so the trick is to apply ROT13 to the payload before sending it, so that the server's ROT13 pass produces the intended SQL syntax.

---

## The website and admin login

The challenge loaded an Irish-themed website titled "List 'o the Irish!" at `jupiter.challenges.picoctf.org/problem/40742/`, displaying a grid of photos with names and captions — Aidan Gillen ("I was on Game of Thrones!"), Aiden Higgens ("All fiction happened"), and Alison Doody.

![Website at jupiter.challenges.picoctf.org showing "List 'o the Irish!" as the heading, with three portrait photos in a row: Aidan Gillen with caption "I was on Game of Thrones!", Aiden Higgens with caption "All fiction happened", and Alison Doody with caption "hehe...Doody." A hamburger menu icon sits in the top left.](/writeups/picoctf-irish-name-repo-3/01.png)

The hamburger menu led to an admin login page at `/login.html`. Unlike a typical login form, this one only had a Password field — no username. The form was a simple Bootstrap panel titled "Admin Log In" with a password input and a Login button.

![Admin login page at jupiter.challenges.picoctf.org/problem/40742/login.html showing a panel with blue header "Admin Log In", a Password label, a text input field, and a blue Login button.](/writeups/picoctf-irish-name-repo-3/02.png)

---

## Discovering the ROT13 transformation

Opened DevTools and inspected the form's HTML in the Elements tab. Below the visible password input, there was a hidden form field: `<input type="hidden" name="debug" value="0">`. Changed the value from `0` to `1` to enable debug output, then submitted `admin` as the password to see what the server did with it.

![DevTools Elements tab showing the login form source code with the password input field and below it a hidden input with name "debug" and value changed to "1". The form action points to login.php with method POST. The left side shows the login form with "admin" entered as the password.](/writeups/picoctf-irish-name-repo-3/03.png)

The debug output in the response revealed the SQL query the server was executing. The password `admin` had been transformed to `nqzva` before being placed into the query. Comparing the two — `a→n`, `d→q`, `m→z`, `i→v`, `n→a` — each letter was shifted by exactly 13 positions. This was ROT13, and since ROT13 is its own inverse (applying it twice returns the original text), the same operation would encode and decode.

The SQL query shown in debug mode was something like `SELECT * FROM admin where password = '' or 1=1; --'`. To get that query to contain a valid injection after the server's ROT13 pass, the payload needed to be ROT13-encoded before submission.

---

## Encoding the payload and bypassing the login

The target SQL injection payload was the classic `' or 1=1; --` — close the string, add a true condition, and comment out the rest. Ran this through ROT13 encoding using [Cryptii](https://cryptii.com/). The alphabetic characters shifted: `or` became `be`, and the non-alphabetic characters (`'`, `1`, `=`, `;`, `-`) stayed the same since ROT13 only affects letters. The encoded payload was `' be 1=1; --`.

Entered `' be 1=1; --` as the password with the debug field still set to `1` and clicked Login. The server applied ROT13 to the input, transforming `be` back to `or`, and inserted the result into the SQL query as `' or 1=1; --`. The injection bypassed the password check, and the response came back with the flag.

![Login response page showing "Logged in!" as the heading and "Your flag is: picoCTF{3v3n_m0r3_SQL_4424e7af}" in the body. The DevTools Elements tab is open on the right showing the HTML source with the pre element containing the SQL query and the flag in a paragraph tag. The URL bar shows the login.php endpoint.](/writeups/picoctf-irish-name-repo-3/04.png)

`picoCTF{3v3n_m0r3_SQL_4424e7af}`

---

## What I took from this

This challenge demonstrates that encoding or obfuscating user input before using it in a SQL query is not a defence against injection — it is just a speed bump. ROT13 is a trivially reversible substitution cipher, and an attacker who discovers the transformation (in this case, via a debug flag left in the form) can simply pre-encode their payload to compensate. The hidden debug field is a separate issue: hidden form fields are not hidden from anyone who can right-click and inspect the page, and they should never control security-relevant behaviour like query logging. The real defence, as always, is parameterised queries. No amount of input transformation — encoding, escaping, filtering — is a substitute for keeping user data out of the query structure entirely. The server should also never expose raw SQL queries in responses, even behind a debug flag, because that feedback gives an attacker the exact information they need to refine their injection.
