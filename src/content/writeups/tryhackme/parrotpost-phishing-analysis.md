---
title: 'ParrotPost: Phishing Analysis'
target: 'TryHackMe — ParrotPost: Phishing Analysis'
difficulty: 'easy'
date: 2025-08-29
summary: "A phishing email analysis exercise — inspecting headers to identify spoofed sender details and originating IP, deobfuscating a multi-layered HTML attachment through base64, HTML entity, and JavaScript deobfuscation to reveal a credential harvesting page, then tracing the exfiltration path and recovering stolen credentials."
role: 'soc'
tags: ['phishing', 'email-analysis', 'header-analysis', 'obfuscation', 'base64', 'html-entity', 'credential-harvesting', 'cyberchef', 'deobfuscation', 'social-engineering']
problem: "A suspicious email claiming to be from ParrotPost Webmail carries an HTML attachment with multiple obfuscation layers hiding a credential harvesting page. The task is to analyse the headers, deobfuscate the attachment, and trace the exfiltration mechanism to the attacker server."
action: "Analysed headers with MXToolbox identifying the originating IP in Latvia sent via emkei.lv, and noted the spoofed Reply-To address. Deobfuscated the HTML attachment through successive layers using CyberChef — base64, HTML entities, CSS beautification, and JavaScript deobfuscation — revealing the credential exfiltration URL and redirect mechanism. Submitted fake credentials, captured the GET request in the Network tab, and traced the stolen credential log at /creds.txt."
outcome: "Completed all tasks — traced the phishing origin to Latvia via emkei.lv, deobfuscated all attachment layers, identified the exfiltration endpoint at evilparrot.thm:8080/cred-capture.php, and recovered stolen credentials including Chris Smith's password from the server log."
draft: false
---

## Background

Phishing remains the most common initial access vector, and the sophistication isn't in the social engineering alone — it's in the technical layers attackers use to evade automated analysis. This room walks through a complete phishing email investigation: from header analysis to multi-layered attachment deobfuscation to tracing the credential exfiltration chain. The target is Paul Feathers at flying-sec.thm, who received a fake "urgent account update" from what appears to be ParrotPost Webmail.

---

## Email header analysis

The email headers immediately reveal multiple red flags. Running them through MXToolbox's header analyser shows the message originated from **emkei.lv** — a well-known anonymous email sending service — with IP address **109.205.120.0**. Looking up the IP on VirusTotal confirms the server is located in **Latvia**.

![MXToolbox header analysis showing the email summary — subject "URGENT: ParrotPost Account Update Required," sent from Parrot Post Webmail no-reply@postparrot.thm to Paul Feathers at pfeathers@flying-sec.thm, with the received headers showing hop 2 originating from emkei.lv at IP 109.205.120.0 highlighted in yellow, using TLSv1.3 to mailin005.flying-sec.thm.](/writeups/thm-parrotpost-phishing-analysis/01-email-header-analysis.png)

Opening the raw `.eml` file in a text editor reveals more. The **Reply-To** header is set to `no-reply@postparr0t.thm` — note the zero replacing the letter 'o' — while the **From** address uses the legitimate `postparrot.thm`. This is a classic phishing technique: replies go to the attacker's domain while the display name looks legitimate. The file also contains an `X-Custom-Header` with the first flag, and a `Content-Disposition` header revealing the attached file: `ParrotPostACTIONREQUIRED.htm`.

![The raw email headers showing From as Parrot Post Webmail no-reply@postparrot.thm, Reply-To as no-reply@postparr0t.thm with the zero substitution, and the X-Custom-Header containing THM{y0u_f0und_7h3_h34d3r}.](/writeups/thm-parrotpost-phishing-analysis/02-reply-to-flag.png)

---

## Attachment deobfuscation

The HTML attachment uses multiple obfuscation layers to evade detection.

### Layer 1 — Base64

The attachment's HTML source contains a variable named `b64` holding a massive **base64**-encoded string, followed by `document.write(unescape(atob(b64)))`. The **atob()** function is JavaScript's built-in base64 decoder — it takes the encoded string and converts it back to the original content. The `unescape()` function then handles any percent-encoded characters, and `document.write()` renders the result in the browser.

![The HTML source of the attachment showing an HTML comment containing a base64 string VEhNe2QwdWJsM18zbmMwZDNkfQo= and the JavaScript execution chain document.write(unescape(atob(b64))), with the exfiltration URL evilparrot.thm:8080 partially visible.](/writeups/thm-parrotpost-phishing-analysis/03-base64-html-source.png)

Copying the base64 payload into CyberChef and applying the "From Base64" recipe decodes the full page content. Within the decoded output, an HTML comment contains a second base64-encoded string — `VEhNe2QwdWJsM18zbmMwZDNkfQo=` — which decodes to **THM{d0ubl3_3nc0d3d}**.

![CyberChef with the From HTML Entity recipe applied — the input shows HTML entity encoded CSS and markup, and the output shows the decoded HTML beginning with the DOCTYPE declaration, meta tags, and the page title "ParrotPost Login" with inline CSS styling.](/writeups/thm-parrotpost-phishing-analysis/04-cyberchef-base64-decode.png)

### Layer 2 — HTML entity encoding

After the base64 layer, the decoded content uses HTML entity encoding — characters represented as `&#` numeric codes. Running this through CyberChef's "From HTML Entity" filter reveals the actual HTML, including the `<h1>` tag containing **ParrotPost Secure Webmail Login**.

### Layer 3 — CSS and JavaScript minification

The CSS has been minified — all whitespace and formatting removed to create a dense, unreadable block. The reverse of CSS Minify is **CSS Beautify**. The JavaScript is similarly minified, and beautifying it through Beautifier.io reveals the credential harvesting logic.

![The decoded source code showing the HTML structure — an h1 heading "ParrotPost Secure Webmail Login," a login form with email and password fields pre-filled with pfeathers@flying-sec.thm, and the JavaScript handling form submission.](/writeups/thm-parrotpost-phishing-analysis/05-decoded-source-review.png)

### The exfiltration mechanism

The beautified JavaScript tells the full story. On form submission, the script captures the email and password values, URL-encodes them with `encodeURIComponent()`, constructs a GET request to `http://evilparrot.thm:8080/cred-capture.php` with the credentials as query parameters, and sends it via `XMLHttpRequest`. After exfiltration, `window.location.href` redirects the victim to the real ParrotPost site so they don't suspect anything happened.

![The fully beautified JavaScript showing the credential harvesting logic — form submission handler capturing email and password values, encoding them with encodeURIComponent, building a GET request URL to http://evilparrot.thm:8080/cred-capture.php with email and password as parameters, sending via XMLHttpRequest, and a commented-out redirect to the real ParrotPost site using window.location.href.](/writeups/thm-parrotpost-phishing-analysis/06-js-beautified.png)

---

## Triggering the phishing page

Opening the deobfuscated HTML file in a browser renders a convincing ParrotPost login page, pre-populated with Paul's email address to add legitimacy.

![The rendered phishing page in Firefox showing "ParrotPost Secure Webmail Login" with a clean form containing Email pre-filled with pfeathers@flying-sec.thm, a Password field, a green Login button, and a "Forgot Password?" link — the URL bar showing the local file path ParrotPostACTIONREQUIRED.htm.](/writeups/thm-parrotpost-phishing-analysis/07-phishing-page-rendered.png)

Submitting fake credentials with the Network tab open in DevTools captures the exfiltration in action. The GET request to `/cred-capture.php` carries the credentials as plaintext URL parameters — `email=test@test.com&password=asdasfgas` — visible in the request URL.

![Firefox DevTools Network tab showing the GET request to evilparrot.thm:8080/cred-capture.php with the email and password parameters visible in the URL, returning a 200 OK response of 121 bytes.](/writeups/thm-parrotpost-phishing-analysis/08-network-credential-capture.png)

The response confirms the capture: **THM{c4p7ur3d_y0ur_cr3d5}** along with a message stating credentials have been stolen and appended to `http://evilparrot.thm:8080/creds.txt`.

![The response tab showing THM{c4p7ur3d_y0ur_cr3d5} Status: SUCCESS! Credentials have been stolen and appended to http://evilparrot.thm:8080/creds.txt.](/writeups/thm-parrotpost-phishing-analysis/09-response-flag.png)

Visiting **/creds.txt** on the attacker server reveals the full log of harvested credentials — timestamped entries from multiple victims. Chris Smith's password is **FlyL1ke!A~Bird**.

![The creds.txt file on evilparrot.thm:8080 showing timestamped credential entries from multiple victims including chris.smith@zebramail.com with password FlyL1ke!A~Bird highlighted, along with entries for sara.jackson, mike.wilson, jessica.parker, and others dating from April 2023.](/writeups/thm-parrotpost-phishing-analysis/10-creds-txt.png)

---

## What I took from this

The layered obfuscation is the interesting part of this room. Each layer serves a different evasion purpose: base64 encoding hides the payload from signature-based scanners, HTML entity encoding obscures the page structure, and minification makes manual analysis tedious. None of these are strong obfuscation on their own — CyberChef handles each in seconds — but stacked together they create enough friction to slip past automated tools and discourage quick manual review.

The GET-based exfiltration is a deliberate design choice by the attacker. Credentials sent as URL parameters end up in server access logs, browser history, proxy logs, and any intermediate caching layer — making them easier to harvest and harder for the victim to clean up than POST-based submission. It's also trivially detectable in network monitoring, which is why real-world phishing kits typically use POST with HTTPS to an attacker-controlled domain. The room's use of plaintext GET makes the exfiltration visible in DevTools for learning purposes, but the principle is the same: once the credentials leave the browser, they're in the attacker's log within milliseconds, and no amount of password reset speed will beat that if the attacker is watching in real time.
