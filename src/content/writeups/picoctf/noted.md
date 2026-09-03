---
title: 'Noted'
target: 'picoCTF — Noted'
difficulty: 'hard'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where a notes application rendered user input through unescaped EJS output, and chaining stored XSS with a CSRF login, same-origin window access, and a data: URL payload allowed exfiltrating the flag from a Puppeteer bot.'
role: 'appsec'
tags: ['web-exploitation', 'xss', 'csrf', 'same-origin-policy', 'puppeteer', 'javascript', 'picoctf']
problem: 'A notes application where a Puppeteer bot creates a note containing the flag in its own temporary account. The bot visits a URL you provide, but it has no internet access — only the challenge origin is reachable.'
action: "Identified stored XSS through EJS's unescaped output tag, discovered no CSRF protection on the login route, and built a multi-stage payload delivered as a data: URL that opened the bot's notes page in a named window, CSRF-logged the bot into the attacker's account, then used same-origin window access to read the flag from the previously opened window and send it to webhook.site."
outcome: 'Retrieved the flag by chaining stored XSS, CSRF login, and same-origin window access to exfiltrate the flag from the bot.'
draft: false
---

## Background

Noted is a picoCTF Web Exploitation challenge that goes well beyond a simple XSS exercise. The application is a straightforward notes app — users can register, log in, and create notes that are displayed back to them. The vulnerability is stored XSS through EJS's unescaped output tag, but exploiting it to get the flag requires chaining four separate techniques together: stored XSS for JavaScript execution, CSRF on the login endpoint to force the bot into a different account, same-origin window access to read data across sessions, and a `data:` URL to deliver the entire payload without needing an external server the bot cannot reach. Each piece is simple on its own, but the challenge is assembling them into a single exploit chain that works within the bot's constraints.

---

## The application

The challenge loaded a minimal notes application at `saturn.picoctf.net:61417` with a login page containing username and password fields, a Submit button, and a Register link.

![Login page at saturn.picoctf.net:61417 showing "Login" as the heading, username and password input fields, a Submit button, and a Register link below.](/writeups/picoctf-noted/01.png)

After registering an account and logging in, the application displayed a simple interface for creating notes — a text field for the note content and a button to save it. There was also a "Report" link that accepted a URL and sent a Puppeteer bot to visit it. The bot's behaviour was the key to the challenge: before visiting the reported URL, the bot created its own temporary account and saved a note containing the flag. After visiting the URL, it closed the browser. The flag existed only in the bot's session, and the goal was to steal it.

---

## Finding the XSS

The first thing to test was whether the note content was sanitised before rendering. Created a note with the content `<script>alert(1)</script>` and navigated to the notes page. The browser popped an alert dialog displaying "1" — the script had executed.

![Browser alert dialog from saturn.picoctf.net:61417 displaying the number "1" with an OK button, confirming that JavaScript injected through a note executes on the page.](/writeups/picoctf-noted/02.png)

This confirmed stored XSS. The application was using EJS (Embedded JavaScript) for templating, and looking at the source code, the note content was rendered using `<%-` instead of `<%=`. In EJS, `<%=` HTML-escapes the output (converting `<` to `&lt;`, `>` to `&gt;`, etc.), while `<%-` outputs the raw string without any escaping. This meant any HTML or JavaScript injected into a note would execute when the page rendered.

With XSS confirmed, the next question was how to use it to steal the flag from the bot. The bot created the flag note in its own account, visited whatever URL was reported, and then shut down. The XSS payload would need to run in a context where it could read the bot's notes — but the bot would not be logged into the attacker's account when it visited the reported URL. This was where the rest of the chain came in.

---

## Understanding the bot's constraints

The Puppeteer bot had two critical constraints that shaped the exploit. First, the bot had no outbound internet access — it could only reach the challenge application at `saturn.picoctf.net:61417`. This meant a simple XSS payload that fetched the flag and sent it to an external server would not work for the initial payload delivery. The bot could not load a script from an attacker-controlled server. However, the bot could make requests to any host that the challenge server could resolve, which included `webhook.site` since the requests went through the server's network stack.

Second, the bot created a fresh account, saved the flag as a note, and then navigated to the reported URL — all in the same browser instance. The bot's cookies for its own session were still active when it visited the reported URL. This meant if the reported URL was on the same origin as the challenge application, the bot would still be authenticated as itself while the XSS ran.

The problem was that the XSS payload was stored in the attacker's notes, not the bot's notes. To trigger the attacker's XSS, the bot needed to be logged into the attacker's account. But logging into the attacker's account would replace the bot's session cookie, losing access to the bot's notes page where the flag was stored. The solution was to access the bot's notes page before switching sessions — and that required understanding the login endpoint.

---

## No CSRF protection on login

Examining the `/login` route revealed that it had no CSRF protection at all — no CSRF tokens, no `SameSite` cookie attribute enforcement, no referrer checking. A POST request to `/login` with a username and password would log the user into that account and set a new session cookie, regardless of where the request originated. This meant the attacker could force the bot to log into the attacker's account by submitting a form to `/login` from any page the bot visited.

This was the second link in the chain: CSRF the bot into the attacker's account so the bot would load the attacker's notes page, where the stored XSS payload was waiting. But the flag was in the bot's notes, which were tied to the bot's original session. The bot needed to access its own notes before being CSRF'd into the attacker's account.

---

## The same-origin window trick

The key insight was `window.open()` and same-origin access between windows. When JavaScript opens a new window (or names an existing one) using `window.open()`, the returned reference allows full DOM access to that window — but only if both windows are on the same origin. Since the bot's notes page and the attacker's notes page were both on `saturn.picoctf.net:61417`, they shared the same origin.

The exploit chain worked like this. First, the payload opened the bot's notes page (`/notes`) in a new window with a specific name — say, `"flag"`. At this point, the bot was still logged into its own account, so `/notes` loaded the bot's notes including the flag. Second, the payload submitted a CSRF form to `/login`, logging the bot into the attacker's account. The browser's session cookie changed, but the already-loaded window named `"flag"` still had the bot's notes page in its DOM — it was already rendered and would not reload just because the cookie changed. Third, the login redirect landed the bot on the attacker's notes page, where the stored XSS payload executed. Fourth, the XSS payload accessed the `"flag"` window by name using `window.open("", "flag")`, which returned a reference to the existing window rather than opening a new one. Since both windows were same-origin, the XSS could read the DOM of the flag window, extract the note content containing the flag, and exfiltrate it.

---

## Delivering the payload with a data: URL

The remaining problem was delivery. The bot visited a URL provided through the Report form, and the entire multi-stage payload — opening the flag window, submitting the CSRF form, waiting for the redirect — needed to be contained in that single URL. An external URL would not work because the bot had no internet access. A URL on the challenge server would work for triggering the XSS, but the pre-login steps (opening the flag window and CSRF'ing the login) needed to happen before the bot reached the attacker's notes page.

The solution was a `data:` URL — a self-contained HTML document encoded directly in the URL itself. The `data:text/html` scheme allowed embedding an entire HTML page with inline JavaScript as the URL the bot would visit. No server needed, no external resources — the entire first stage of the exploit was in the URL.

The data: URL payload did three things in sequence. It opened `http://saturn.picoctf.net:61417/notes` in a window named `"flag"`, giving the bot a window with its own notes loaded. It then created and submitted a hidden form that POST'd the attacker's credentials to `/login`, which logged the bot into the attacker's account and redirected to the notes page. The stored XSS in the attacker's notes then fired, which was the second stage.

The stored XSS note in the attacker's account contained a script that waited briefly for the DOM to settle, then accessed the `"flag"` window, read its `document.body.innerText`, and sent the content to `webhook.site` as a query parameter in an image request. An image request (`new Image().src = ...`) was used instead of `fetch()` because it was a simple fire-and-forget mechanism that did not require CORS headers from the receiving server.

---

## Executing the attack

Set up a webhook.site endpoint to receive the exfiltrated data, then assembled the full exploit. Registered an account on the challenge application, created a note containing the XSS payload that would read the flag window and send its content to the webhook URL, and then reported the data: URL through the Report form.

The bot visited the data: URL, which opened the bot's notes in a named window, CSRF'd the bot into the attacker's account, and the redirect loaded the attacker's notes page where the XSS executed. The first request that appeared on webhook.site was the bot's initial visit — a GET request with no flag, just confirming the webhook was reachable from the bot's network.

![webhook.site inbox showing one GET request from IP 13.59.203.175 dated 06/22/2026, with full request headers including accept-encoding, sec-fetch headers showing navigate mode, user-agent showing Mozilla/5.0 with HeadlessChrome, and host webhook.site. Query strings and form values are empty.](/writeups/picoctf-noted/03.png)

A few seconds later, a second GET request arrived — this time with the flag in the query string. The query parameter contained the full text content of the bot's notes page: `My Notes flag picoCTF{p00rth0s_parl1ment_0f_p3p3gas_386f0184} New Note | Report`.

![webhook.site inbox now showing two GET requests. The selected request from 06/23/2026 shows the URL with a query string containing "flag=My%20Notes%20flag%20picoCTF{p00rth0s_parl1ment_0f_p3p3gas_386f0184}%20New%20Note%20|%20Report". The request headers show referer as http://0.0.0.0:8080/, sec-fetch-site as cross-site, and the same HeadlessChrome user-agent.](/writeups/picoctf-noted/04.png)

`picoCTF{p00rth0s_parl1ment_0f_p3p3gas_386f0184}`

---

## What I took from this

This challenge demonstrated that real-world XSS exploitation is rarely just `alert(1)`. The XSS vulnerability itself was trivial — unescaped EJS output — but turning it into flag exfiltration required understanding session management, CSRF, same-origin policy, and the constraints of the Puppeteer bot. Each vulnerability in the chain was individually simple: EJS using `<%-` instead of `<%=`, no CSRF token on the login form, same-origin windows having full DOM access to each other, and `data:` URLs rendering as full HTML documents. But chaining them together required understanding how browsers handle sessions, origins, and cross-window references. The defence against this entire chain was straightforward: HTML-escape all output (use `<%=` in EJS), add CSRF tokens to all state-changing endpoints including login, set `SameSite=Strict` on session cookies, and implement a Content Security Policy that restricts script execution to trusted sources. Any one of these mitigations would have broken a different link in the chain and prevented the exploit.
