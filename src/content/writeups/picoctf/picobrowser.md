---
title: 'picobrowser'
target: 'picoCTF — picobrowser'
difficulty: 'easy'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where clicking a Flag button returned an error saying the browser was not "picobrowser", and spoofing the User-Agent header to "picobrowser" in a curl request returned the flag.'
role: 'appsec'
tags: ['web-exploitation', 'user-agent', 'http-headers', 'curl', 'picoctf']
problem: 'A website that only renders its flag for a browser called "picobrowser". Clicking the Flag button with a normal browser returns an error displaying the current User-Agent string.'
action: 'Clicked the Flag button, noted the User-Agent rejection, copied the request as cURL from DevTools Network tab, replaced the User-Agent header with "picobrowser", and ran the modified command.'
outcome: 'Retrieved the flag by spoofing the User-Agent header in a curl request.'
draft: false
---

## Background

picobrowser is a picoCTF Web Exploitation challenge about HTTP header manipulation. The challenge description says the website "can be rendered only by picobrowser" and hints that you do not need to download a new browser. The server checks the `User-Agent` header on incoming requests and gates access to the flag based on whether it matches a specific string. Since the `User-Agent` header is entirely client-controlled, it can be set to anything.

---

## The website and the rejection

The challenge URL loaded a simple page titled "My New Website" with a navigation bar (Home, Sign In, Sign Out) and a large green button labelled "Flag" in the centre.

![Website at jupiter.challenges.picoctf.org/problem/50522/ showing "My New Website" as the heading with Home (blue button), Sign In, and Sign Out navigation links. Below is a grey content area containing a large green "Flag" button. The footer reads "PicoCTF 2019".](/writeups/picoctf-picobrowser/01.png)

Clicking the Flag button returned an error message in a red dismissable alert box: "You're not picobrowser!" followed by the full User-Agent string that the browser had sent — the standard Chrome identifier `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36`.

![The same page after clicking the Flag button, now showing a red alert box at the top with the message "You're not picobrowser! Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" with a dismiss button. The Flag button remains below.](/writeups/picoctf-picobrowser/02.png)

The server was reading the `User-Agent` header from the request and checking it against the string `picobrowser`. If it did not match, it reflected the actual User-Agent back in the error message. The fix was straightforward — send a request with `User-Agent: picobrowser`.

---

## Capturing and modifying the request

Opened DevTools and went to the Network tab, then clicked the Flag button again to capture the request. Two entries appeared for `flag` — the first was a 307 redirect, and the second was the 200 OK response containing the rejection. Right-clicked the 200 request and selected Copy → Copy as cURL (bash) to get the full request as a curl command with all the headers the browser had sent.

![The website with DevTools Network tab open, showing the Flag button being clicked. The network panel is visible with request entries, and the cursor is on the request for the flag endpoint.](/writeups/picoctf-picobrowser/03.png)

Pasted the command into a text editor and changed the `User-Agent` header from the Chrome string to `picobrowser`:

```
curl 'https://jupiter.challenges.picoctf.org/problem/50522/flag' \
  -H 'User-Agent: picobrowser' \
  -H 'Accept: text/html,application/xhtml+xml' \
  -H 'Connection: keep-alive' \
  -H 'Referer: https://jupiter.challenges.picoctf.org/problem/50522/flag'
```

The rest of the headers (Accept-Language, Sec-Fetch, sec-ch-ua) were optional — the server only cared about `User-Agent`.

---

## Getting the flag

Ran the modified curl command in a terminal and piped the output through `grep "pico"` to filter for the flag. The HTML response contained the flag in a `<code>` element inside the page body, right after a heading confirming "picobrowser!" was recognised.

![Terminal showing the curl command with User-Agent set to "picobrowser" piped through grep "pico". The output shows HTML fragments including a strong element containing "picobrowser!" and a paragraph with "Flag:" followed by a code element containing the flag value, partially redacted with a red bar.](/writeups/picoctf-picobrowser/04.png)

`picoCTF{p1c0_s3cr3t_ag3nt_51414fa7}`

---

## What I took from this

The `User-Agent` header is a self-reported string that the client sends with every HTTP request — the browser sets it by default, but the user can change it to anything they want. Using it for access control is like asking visitors to state their own name at the door and trusting whatever they say. Any HTTP client — curl, Python's requests library, Burp Suite, or even a browser extension — can set any User-Agent string. In a real application, access control should never depend on request headers that the client controls. Authentication tokens, session cookies tied to server-side state, or IP-based restrictions are all more appropriate mechanisms. The User-Agent header is useful for analytics and content negotiation (serving mobile versus desktop layouts), but it has zero security value because it can be trivially spoofed.
