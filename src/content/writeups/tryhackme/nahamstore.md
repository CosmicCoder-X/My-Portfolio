---
title: 'NahamStore'
target: 'TryHackMe — NahamStore'
difficulty: 'medium'
date: 2026-08-27
summary: 'A black-box web app engagement against an e-commerce site that went from default credentials on an admin panel to a reverse shell, plus 18 other findings across SQLi, XXE, SSRF, LFI, IDOR, CSRF, XSS, and open redirect — every major web vulnerability class in one box.'
role: 'appsec'
tags: ['Burp Suite', 'SQLi', 'XXE', 'SSRF', 'LFI', 'IDOR', 'CSRF', 'XSS', 'Open redirect', 'RCE', 'sqlmap', 'Web app testing']
problem: 'NahamStore is a mock e-commerce application designed to contain vulnerabilities from every major web application security category. The goal is a comprehensive black-box assessment — find and demonstrate as many vulnerability classes as possible, from injection flaws to access control issues, treating the engagement like a real bug bounty target.'
action: 'Performed full-scope web app testing using Burp Suite Professional as the primary tool. Achieved RCE through an admin panel running on port 8000 with default credentials, then systematically identified SQLi in product search, XXE in a stock-check XML endpoint, SSRF via parameter manipulation to reach an internal API, LFI through path traversal, IDOR in a PDF generator, CSRF on password and email change endpoints, stored and reflected XSS, and open redirect — 19 confirmed findings in total.'
outcome: 'Complete compromise of the web application with a www-data reverse shell via RCE, plus 18 additional findings spanning every OWASP Top 10 category. The engagement demonstrated how a single web app can expose an entire organisation when multiple vulnerability classes are present simultaneously.'
draft: false
---

NahamStore is a TryHackMe room that puts an entire e-commerce application
in front of you and asks you to break it in every way you can. It's not a
single-exploit box — it's a web app assessment where the target has
vulnerabilities from nearly every major category: injection, broken access
control, XXE, SSRF, and more. The room is rated medium, but the breadth of
what it covers makes it one of the most complete web app testing exercises
on the platform.

The target is `nahamstore.thm`, running on Linux Ubuntu with Nginx 1.14.0
and MySQL 5.6 behind it. Burp Suite Professional was the primary tool
throughout.

## Remote code execution — admin panel default credentials

The most critical finding came from an admin panel running on port 8000.
Navigating to `nahamstore.thm:8000` revealed a marketing campaign manager
with a login page. Default credentials `admin:admin` granted access — no
lockout, no MFA, no complexity requirement.

The campaign editor at `/admin/{campaign-id}` included a **Code** field
that accepted arbitrary input and rendered it server-side. Pasting a PHP
reverse shell (pentestmonkey's `php-reverse-shell`) into the Code field
and clicking Update executed the payload:

![Admin panel Edit Campaign page with PHP reverse shell code in the Code field](/writeups/thm-nahamstore/01-admin-panel-php-shell.png)

The shell connected back as `www-data` — full remote code execution from
a feature that was meant for marketing HTML templates. The combination of
default credentials and unrestricted code execution in an admin feature is
about as critical as web vulnerabilities get.

## SQL injection — product search

The `product` endpoint accepted an `id` parameter that went straight into
a SQL query with no parameterisation. Testing with a single quote confirmed
the injection, and sqlmap automated the extraction:

```bash
sqlmap -u "http://nahamstore.thm/product?id=2" --dump
```

![sqlmap output showing nahamstore database dump with sqli_one flag and product table](/writeups/thm-nahamstore/02-sqlmap-database-dump.png)

sqlmap identified the backend as **MySQL 5.6** on **Linux Ubuntu** behind
**Nginx 1.14.0**, and used a UNION-based injection with 5 columns. The
`nahamstore` database contained two tables: `sqli_one` held the flag
`{d890234e20be48ff96a2f9caab0de55c}`, and `product` held the store's
inventory — two items (Hoodie + Tee at $25.00, Sticker Pack at $15.00)
with image hashes that doubled as potential password hashes (sqlmap flagged
them as "recognized possible password hashes in column 'image'").

## XXE — stock check XML endpoint

The subdomain `stock.nahamstore.thm` exposed an XML endpoint for product
stock checks. Sending a POST to `/product/1/.xml` with a crafted DTD
entity read arbitrary files from the server:

```http
POST /product/1/.xml HTTP/1.1
Host: stock.nahamstore.thm
Content-Type: application/x-www-form-urlencoded
Content-Length: 132

<?xml version="1.0"?>
  <!DOCTYPE test [<!ENTITY example SYSTEM "file:///etc/passwd" >]>
  <data>
    <X-Token>
        &example;
    </X-Token>
  </data>
```

![Burp Repeater showing XXE attack with DTD entity injection and /etc/passwd contents in the response](/writeups/thm-nahamstore/03-xxe-etc-passwd.png)

The response came back as `application/xml` with the full contents of
`/etc/passwd` embedded in the `<error>` element. The file showed standard
system accounts plus application-specific users — `www-data`, `backup`,
`gnats`, and service accounts for `systemd-network`, `systemd-resolve`,
and `systemd-timesync`. The `X-Token` field in the request was the
injection point; the server parsed the XML, resolved the external entity,
and reflected the file contents back in the error response.

## SSRF — internal API access

The stock check endpoint also accepted a `server` parameter that could be
manipulated to reach internal services. Using the `@` trick to redirect
the request:

```http
POST /stockcheck HTTP/1.1
Host: nahamstore.thm
Content-Type: application/x-www-form-urlencoded

product_id=4dbc5171642b649f524e1cd4437a5f5a&server=stock.nahamstore.thm&server=internal-api.nahamstore.thm/orders
```

![Burp Repeater showing SSRF via server parameter reaching internal API with leaked order data](/writeups/thm-nahamstore/04-ssrf-internal-api.png)

The server followed the redirect to `internal-api.nahamstore.thm/orders`
and returned customer order data that should never be externally
accessible: customer name (**Rita Miles**), email
(`rita.miles969@gmail.com`), phone (`816-719-7115`), full shipping address
(3914 Charles Street, Farmington Hills, Michigan 48335), and payment
details (Mastercard ending in a visible number, expiry 05/2024, CVV
`010`). This is a textbook SSRF — the application trusts user-controlled
input to determine where it makes internal requests, and the internal API
has no authentication of its own.

## LFI — path traversal

The `/product/picture` endpoint was vulnerable to local file inclusion via
a double-encoded path traversal pattern:

```http
GET /product/picture?file=....//....//....//....//....//....//lfi/flag.txt HTTP/1.1
Host: nahamstore.thm
```

![Burp Repeater showing LFI path traversal reading lfi/flag.txt with flag in response](/writeups/thm-nahamstore/05-lfi-flag.png)

The `file....//....//` pattern bypassed the basic traversal filter — the
application stripped `../` once, but the doubled dots and slashes survived
the filter and resolved to a valid path. The response returned the flag
`{7e960e74b711f4c3a1fdf5a131ebf6fc33}` with a `Content-Type` of
`image/jpeg`, meaning the endpoint was designed to serve product images
but never validated that the resolved path stayed within the intended
directory.

## IDOR — PDF generator

The `/pdf-generator` endpoint accepted a POST with `what=order&id=1` and
generated a PDF receipt. Adding `user_id=1` to the request body returned
another user's order:

```http
POST /pdf-generator HTTP/1.1
Host: nahamstore.thm
Content-Type: application/x-www-form-urlencoded

what=order&id=1%26user_id%3d1
```

![Burp Repeater showing IDOR in PDF generator with user_id injection and raw PDF response](/writeups/thm-nahamstore/06-idor-pdf-raw.png)

The `user_id` parameter was URL-encoded (`%26user_id%3d1`) to inject it
as an additional parameter. The response was a raw PDF document:

![PDF order report showing Order #1 for Rita Miles with shipping address and Sticker Pack purchase](/writeups/thm-nahamstore/07-idor-pdf-rendered.png)

The rendered PDF showed **Order #1** for **Rita Miles** — the same
customer whose data leaked through the SSRF. Shipping address (3914
Charles Street, Farmington Hills, Michigan 48335), order date
(22/02/2021), and purchase details (Sticker Pack, $15.00) were all
exposed. The vulnerability is a straightforward IDOR: the application
doesn't verify that the requesting user owns the order being generated.

## CSRF — password change

The password change endpoint at `/account/settings/password` accepted a
POST with no CSRF token at all:

```http
POST /account/settings/password HTTP/1.1
Host: nahamstore.thm
Content-Type: application/x-www-form-urlencoded

change_password=test123
```

![Burp Repeater showing CSRF password change with no token and Password has been updated response](/writeups/thm-nahamstore/08-csrf-password-change.png)

The response confirmed "Password has been updated" — no token, no
confirmation of the current password, no re-authentication. An attacker
could craft a page that auto-submits this form and change any
authenticated user's password silently.

## CSRF — email change

The email change endpoint at `/account/settings/email` did include a
`csrf_protect` parameter, but stripping or emptying it still allowed the
request to succeed:

```http
POST /account/settings/email HTTP/1.1
Host: nahamstore.thm
Content-Type: application/x-www-form-urlencoded

csrf_protect=&change_email=test12%40test.com
```

![Burp Repeater showing CSRF email change with emptied token and Email Changed response](/writeups/thm-nahamstore/09-csrf-email-change.png)

The response confirmed "Email Changed" despite the `csrf_protect` field
being empty. The token was present in the form but never validated
server-side — a common implementation failure where the developer added
the CSRF field to the HTML but forgot (or never implemented) the
server-side check.

## Stored XSS — User-Agent header

The `/basket` endpoint stored the `User-Agent` header from POST requests
and reflected it back without sanitisation. Injecting a script tag in the
header:

```http
POST /basket HTTP/1.1
Host: nahamstore.thm
User-Agent: <script>alert("XSS")</script>
Content-Type: application/x-www-form-urlencoded

address_id=5&card_no=1234123412341234
```

![Burp Proxy showing stored XSS via User-Agent header in POST to /basket](/writeups/thm-nahamstore/10-stored-xss-useragent.png)

The `User-Agent` value was stored server-side and rendered in any
subsequent page that displayed basket or order activity. This is stored
XSS — the payload persists and executes for every user who views the
affected page, not just the one who injected it. The attack surface is
unusual (User-Agent rather than a form field), which means WAF rules that
only inspect body parameters would miss it entirely.

## Reflected XSS — product search

The same `product?id` parameter that was vulnerable to SQLi also reflected
unsanitised input into the page:

```
http://nahamstore.thm/product?id=<script>alert("XSS")</script>
```

![Browser showing reflected XSS alert popup from product?id parameter on nahamstore.thm](/writeups/thm-nahamstore/11-reflected-xss-alert.png)

The alert fired immediately — the `id` parameter value was inserted
directly into the HTML response with no encoding. This is a reflected XSS
that could be weaponised via a crafted link sent to a victim.

## Open redirect

The root URL accepted an `r` parameter that redirected to any URL without
validation:

```
http://nahamstore.thm/?r=http://google.com
```

![Browser URL bar showing nahamstore.thm/?r=http://google.com with NahamStore page loading](/writeups/thm-nahamstore/12-open-redirect-url.png)

![Browser showing Google.com loaded after the open redirect](/writeups/thm-nahamstore/13-open-redirect-google.png)

The redirect worked with no restrictions — any URL passed in the `r`
parameter was followed. On its own this is low severity, but chained with
the XSS or CSRF findings it becomes a reliable phishing vector: a link
that starts on the legitimate `nahamstore.thm` domain but lands the
victim on an attacker-controlled page.

## What I took from this

NahamStore is the closest thing TryHackMe has to a real bug bounty
target, and the lesson isn't any single vulnerability — it's that real web
apps don't have one bug, they have layers of them. The RCE via the admin
panel was the most critical finding, but it wasn't the most interesting.
The SSRF and IDOR both leaked the same customer's data through completely
different paths, which is exactly how real-world data breaches compound:
fix one leak and the data is still flowing through another. The CSRF email
change was a good reminder to always test what happens when you strip or
empty a token, not just when you remove the field — the server-side
validation was simply never implemented despite the token being present in
the form. And the stored XSS via User-Agent is the kind of finding that
separates a thorough test from a surface scan: nobody checks headers
unless they're specifically thinking about what the application logs and
where it renders those logs.
