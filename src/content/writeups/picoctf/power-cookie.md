---
title: 'Power Cookie'
target: 'picoCTF — Power Cookie'
difficulty: 'easy'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where an "Online Gradebook" application set a cookie isAdmin=0 when continuing as guest, and changing it to isAdmin=1 before requesting /check.php returned the flag in the response.'
role: 'appsec'
tags: ['web-exploitation', 'cookies', 'authentication-bypass', 'burp-suite', 'picoctf']
problem: 'An Online Gradebook application with a "Continue as guest" button that redirects to /check.php with a message saying no guest services are available. The challenge is to figure out how the server identifies guests and bypass it.'
action: 'Clicked "Continue as guest", noticed the denial message, intercepted the request in Burp Suite and found a cookie isAdmin=0. Changed it to isAdmin=1 and resent the request to get the flag.'
outcome: 'Retrieved the flag by flipping a client-side cookie value, demonstrating why authorisation decisions must never rely on client-controlled data.'
draft: false
---

## Background

Power Cookie is a picoCTF Web Exploitation challenge about cookie-based authorisation bypass. HTTP is stateless — cookies are how web applications maintain context between requests. When an application trusts a cookie value to make access control decisions without server-side validation, an attacker can simply edit the cookie and escalate their privileges. This challenge demonstrates that pattern in its simplest form.

---

## The guest restriction

The challenge loaded an "Online Gradebook" page at `saturn.picoctf.net:57197` with a single button: "Continue as guest."

![Online Gradebook page at saturn.picoctf.net:57197 showing the title "Online Gradebook" in bold serif text and a "Continue as guest" button below it.](/writeups/picoctf-power-cookie/01.png)

Clicking the button redirected to `/check.php`, which responded with a flat denial:

![The /check.php page at saturn.picoctf.net:59966 displaying the message "We apologize, but we have no guest services at the moment."](/writeups/picoctf-power-cookie/02.png)

The application knew the user was a guest and refused access. The question was how it made that determination — and given the challenge name, the answer was obviously in the cookies.

---

## Flipping the cookie

Intercepted the request to `/check.php` in Burp Suite and inspected the headers. The browser was sending a cookie: `isAdmin=0`. The server was reading that value and serving the guest denial when it was `0`. Changed it to `isAdmin=1` and resent the request from Burp Repeater.

![Burp Suite showing the edited GET /check.php request with Cookie: isAdmin=1 on the left, and the server response on the right returning HTTP 200 with an HTML body containing the flag picoCTF{gr4d3_A_c00k1...} in a paragraph element.](/writeups/picoctf-power-cookie/03.png)

The server accepted the modified cookie, treated the request as an admin, and returned the flag in the response body.

---

## What I took from this

The vulnerability here is trusting a client-controlled value for authorisation. Cookies live in the browser — the user can read, modify, and forge them freely using browser DevTools, Burp Suite, or even a simple curl command. An `isAdmin` cookie with a value of `0` or `1` is no different from asking the user "are you an admin?" and trusting their answer. Proper authorisation stores session state server-side (in a database or server-side session store), issues an opaque session token as the cookie, and validates permissions on the server for every request. The cookie should identify the session, not define the user's role.
