---
title: 'Web Gauntlet 3'
target: 'picoCTF — Web Gauntlet 3'
difficulty: 'medium'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where a SQLite login page filtered common SQL keywords, operators, and the word "admin" with a 25-character limit, bypassed by concatenating the username with || and using GLOB for a password-always-true condition.'
role: 'appsec'
tags: ['web-exploitation', 'sql-injection', 'sqlite', 'filter-bypass', 'glob', 'concatenation', 'picoctf']
problem: 'A "Filtered SQLite Injection Challenge #3" login page with an extensive blacklist (or, and, true, false, union, like, =, >, <, ;, --, /*, */, admin) and a 25-character combined input limit. The goal is to log in as admin.'
action: "Used the SQLite concatenation operator || to reconstruct \"admin\" as adm'||'in in the username field, and the GLOB operator with a wildcard as the password to create an always-true condition, bypassing all filters within the character limit."
outcome: 'Logged in as admin and retrieved the flag from the filter.php source after a successful login.'
draft: false
---

## Background

Web Gauntlet 3 is a picoCTF Web Exploitation challenge about SQL injection with heavy filtering. The application is a SQLite-backed login page that blacklists a long list of SQL keywords and operators — `or`, `and`, `true`, `false`, `union`, `like`, `=`, `>`, `<`, `;`, `--`, `/*`, `*/`, and even the word `admin` itself. On top of that, the combined length of the username and password fields cannot exceed 25 characters. The challenge is to craft a payload that bypasses every filter, fits within the character limit, and still achieves admin login.

---

## The challenge setup

The challenge description was upfront about the constraints: "Last time, I promise! Only 25 characters this time. Log in as admin." It provided two URLs — the login page at `mercury.picoctf.net:63504/` and the filter list at `mercury.picoctf.net:63504/filter.php`.

![Challenge description showing the text "Last time, I promise! Only 25 characters this time. Log in as admin" with links to the Site at mercury.picoctf.net:63504/ and the Filter page at mercury.picoctf.net:63504/filter.php.](/writeups/picoctf-web-gauntlet-3/01.png)

The login page itself was a clean card-style form titled "Filtered SQLite Injection Challenge #3" with Username and Password fields and a SIGN IN button.

![Login page showing "Filtered SQLite Injection Challenge #3" as the heading, with Username and Password input fields and a blue SIGN IN button.](/writeups/picoctf-web-gauntlet-3/02.png)

Entering test data and submitting revealed the underlying SQLite query structure in the response — the application was plugging the username and password directly into a query. The response also made it clear that the target username was `admin`, but that string was blacklisted.

---

## Building the bypass

The filter list blocked every obvious approach. No `or` meant no `' or 1=1 --`. No `=` meant no equality comparisons. No `--` or `/*` meant no comment-based truncation. No `admin` meant the username could not be typed directly. No `like` meant no wildcard pattern matching through the usual operator. And the 25-character limit meant every byte counted.

Two SQLite features solved both problems:

The first was the concatenation operator `||`. SQLite uses `||` to join strings, so `'ad' || 'min'` evaluates to `'admin'` without the word `admin` ever appearing in the input. The filter checked each field as a raw string — it did not evaluate the SQL before filtering, so the individual fragments `ad` and `min` passed through cleanly. The username became `adm'||'in`, which broke out of the quoted string, concatenated the two halves, and reconstructed the target username inside the query.

The second was the `GLOB` operator. With `=`, `like`, `<`, `>`, and `!=` all blacklisted, there was no obvious way to create a true condition for the password check. But `GLOB` was not on the filter list. `GLOB` is SQLite's case-sensitive pattern matching operator, and `*` is its wildcard for "match everything." So a password of `a' GLOB '*` would close the password string, introduce a `GLOB` comparison that always evaluates to true (every string matches `*`), and satisfy the password condition without using any filtered keyword.

The final payload:

- **Username:** `adm'||'in`
- **Password:** `a' GLOB '*`

Combined character count: 9 + 12 = 21 characters — comfortably within the 25-character limit.

![Login page showing "adm'||'in" entered in the Username field and a masked password in the Password field, with the SIGN IN button below.](/writeups/picoctf-web-gauntlet-3/03.png)

Clicked SIGN IN and the application accepted the login.

---

## Retrieving the flag

After the successful login, navigating to `/filter.php` revealed the full PHP source code — the application displayed its own source when the session's `winner3` variable was set to 1. The source confirmed the filter array and the session logic, and at the very bottom, sitting in a PHP comment on the last line, was the flag.

![The filter.php page showing the full PHP source code with session_start(), the $filter array containing all blacklisted terms (or, and, true, false, union, like, =, >, <, ;, --, /*, */, admin), the win condition logic checking $_SESSION["winner3"], and at the bottom in a green PHP comment: picoCTF{k3ep_1t_sh0rt_eb90a623e2c581bcd3127d9d60a4dead}.](/writeups/picoctf-web-gauntlet-3/04.png)

`picoCTF{k3ep_1t_sh0rt_eb90a623e2c581bcd3127d9d60a4dead}`

---

## What I took from this

Web Gauntlet 3 demonstrates that blacklist-based input filtering is a losing strategy for preventing SQL injection. No matter how long the filter list grows, there is almost always an operator or syntax variant that was not included — in this case, SQLite's `||` concatenation and `GLOB` pattern matching. The 25-character limit added a constraint that forced creative compression of the payload, but the fundamental lesson is that filters operating on raw input strings cannot account for every possible SQL expression. The correct defence is parameterised queries (prepared statements), which separate the SQL structure from the user data entirely — the database engine never interprets user input as SQL, so no amount of creative syntax can break out of the parameter boundary. Additionally, the application leaked its own source code after a successful login, which is a separate vulnerability — debug and diagnostic endpoints should never be accessible in production, regardless of session state.
