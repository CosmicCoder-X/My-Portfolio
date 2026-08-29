---
title: 'HTTP/2 Request Smuggling'
target: 'TryHackMe — HTTP/2 Request Smuggling'
difficulty: 'hard'
date: 2025-08-27
summary: 'An educational deep-dive into HTTP/2 request smuggling techniques covering H2.CL and H2.TE desync vectors, CRLF injection through header values and header names, pseudo-header abuse for ambiguous host and path routing, URL prefix injection via the :scheme pseudo-header, and request line injection — all demonstrated through PortSwigger Web Security Academy labs and documented real-world cases affecting Verizon, Netlify, and AOL/HuffPost infrastructure.'
role: 'appsec'
tags: ['http2', 'request-smuggling', 'h2-desync', 'crlf-injection', 'burp-suite', 'portswigger', 'web-exploitation']
problem: 'HTTP/2 introduces binary framing and pseudo-headers that redefine how requests are structured, but most backend infrastructure still speaks HTTP/1.1. When a frontend proxy downgrades HTTP/2 requests to HTTP/1.1, mismatches in how the two protocols handle message boundaries, header encoding, and request routing create smuggling opportunities that bypass security controls and poison request pipelines.'
action: 'Worked through the full taxonomy of HTTP/2 request smuggling techniques: exploited H2.CL desync by injecting a Content-Length header that the HTTP/2 frontend ignores but the HTTP/1.1 backend honours, exploited H2.TE desync by injecting Transfer-Encoding: chunked via CRLF sequences in header values and header names to bypass frontend sanitisation, abused duplicate :authority pseudo-headers to route requests to unintended hosts, injected arbitrary URLs into the :scheme pseudo-header to override the request line during downgrade, and demonstrated request line injection through newline characters in pseudo-header values — all using Burp Suite''s HTTP/2 Inspector.'
outcome: 'Completed all associated PortSwigger labs and documented each technique with annotated Burp Suite captures. Mapped the attack surface from basic Content-Length mismatches through protocol-level pseudo-header abuse, covering both the theoretical framework and real-world impact through documented cases against production infrastructure.'
draft: false
---

## Background

HTTP/2 changes the wire format of HTTP fundamentally — requests and responses are multiplexed as binary frames over a single connection, headers are compressed with HPACK, and pseudo-headers (`:method`, `:path`, `:scheme`, `:authority`) replace the HTTP/1.1 request line and Host header. But the backends behind most reverse proxies and CDNs still speak HTTP/1.1, which means the frontend has to downgrade every HTTP/2 request into an HTTP/1.1 equivalent before forwarding it. That translation step — from a binary protocol with strict framing to a text protocol where message boundaries depend on headers like `Content-Length` and `Transfer-Encoding` — is where the entire attack surface lives.

This writeup covers the full taxonomy of HTTP/2 request smuggling techniques, working through PortSwigger's Web Security Academy labs and referencing the real-world discoveries by James Kettle that brought these issues into the spotlight. The techniques escalate from straightforward Content-Length mismatches to protocol-level abuse of pseudo-headers that most developers don't even know exist.

One thing worth noting upfront: none of these attacks target bugs in HTTP/2 itself. The protocol is well-designed. The vulnerabilities exist in the *translation layer* — the code that converts HTTP/2 into HTTP/1.1 — and in the assumptions that frontends and backends make about each other's behaviour.

---

## H2.CL desync — Content-Length mismatch

The simplest HTTP/2 smuggling vector. In HTTP/2, message boundaries are defined by the binary framing layer — `DATA` frames carry the body, and their lengths are explicit in the frame headers. `Content-Length` is technically redundant and many HTTP/2 implementations ignore it entirely. But when the frontend downgrades to HTTP/1.1, it faithfully copies the `Content-Length` header into the downstream request. If the backend reads the body based on `Content-Length` rather than the actual data received, a mismatch occurs: the backend stops reading at the declared length, and any remaining bytes are treated as the start of the *next* request.

This is the classic desync primitive. Send an HTTP/2 request with a `Content-Length` that's shorter than the actual body. The frontend forwards everything (the framing layer knows exactly how much data there is), but the backend stops reading at `Content-Length` bytes and interprets the remainder as a new request. That "remainder" is attacker-controlled — a smuggled request that bypasses the frontend's security checks entirely.

The key enabler is that HTTP/2 frontends often don't validate `Content-Length` against the actual frame data because the header is meaningless in HTTP/2 context. It only becomes dangerous when it's preserved across the protocol boundary.

---

## H2.TE desync — injecting Transfer-Encoding

If the frontend strips or rejects `Transfer-Encoding` headers in HTTP/2 requests (as many do, since chunked encoding doesn't exist in HTTP/2), the attacker needs another way to get `Transfer-Encoding: chunked` into the downgraded HTTP/1.1 request. This is where CRLF injection comes in.

### CRLF injection via header values

HTTP/2 headers are binary — they can contain bytes that would be illegal in HTTP/1.1 headers, including carriage return and line feed characters (`\r\n`). If the frontend doesn't sanitise these before downgrading, a header value containing `\r\n` followed by a new header name and value will be interpreted as two separate headers by the HTTP/1.1 backend.

The technique: create a header with a name like `Foo` and a value like `Bar \r\n Transfer-Encoding: chunked`. In HTTP/2, this is one header. After downgrade, the backend sees:

```
Foo: Bar
Transfer-Encoding: chunked
```

Two headers. The `Transfer-Encoding: chunked` is now part of the HTTP/1.1 request, and the backend will parse the body as chunked — reading until a `0\r\n\r\n` terminator and treating anything after it as the next request.

![Burp Suite Inspector — header name "Foo" with value containing \r\n and "Transfer-Encoding: chunked" on the next line. The body contains a chunked-encoded smuggled GET /sdgdfvd request. The response is HTTP/2 404 Not Found with body "Not Found" — confirming the backend processed the smuggled request.](/writeups/thm-http2-request-smuggling/01-burp-crlf-injection-header.png)

The 404 response for `/sdgdfvd` (a path that doesn't exist) confirms the smuggled request was processed — the backend parsed the chunked body, hit the `0\r\n\r\n` terminator, and treated the `GET /sdgdfvd` that followed as a separate request.

Weaponising this to actually do something useful — smuggling a POST with a `search=hacker` body through the same CRLF injection technique, this time targeting a real endpoint:

![Burp Suite — smuggled POST request with search=hacker body via H2.TE CRLF injection. The response is HTTP/2 200 OK with page title "HTTP/2 request smuggling via CRLF injection" and Content-Length: 8747 — the lab page confirming the smuggled search executed successfully.](/writeups/thm-http2-request-smuggling/02-burp-crlf-smuggled-search.png)

The 200 response with the lab's full HTML confirms the smuggled POST was processed as a legitimate request. The `Content-Length: 8747` in the response is the search results page, not an error — the smuggled `search=hacker` parameter was accepted and executed.

### CRLF injection via header names

Some frontends sanitise header *values* for CRLF sequences but don't check header *names*. HTTP/2 allows colons in header names (pseudo-headers use them), and if the frontend passes the name through without validation, a header name containing `\r\n` achieves the same injection.

The variant: set the header name to `Foo:Bar \r\n Transfer-Encoding` with the value `chunked`. After downgrade, the backend sees:

```
Foo:Bar
Transfer-Encoding: chunked
```

![Burp Suite Inspector — header name field contains "Foo:Bar \r\n Transfer-Encoding" with value "chunked". The CRLF sequence in the name field splits into two headers during HTTP/1.1 downgrade.](/writeups/thm-http2-request-smuggling/04-burp-header-name-injection.png)

A subtler variation puts the entire `Transfer-Encoding: chunked` string into the header name field with an empty value:

![Burp Suite Inspector — header name field contains "Transfer-Encoding: chunked" with an empty value. The colon and space in the name become the header delimiter during downgrade, producing a valid Transfer-Encoding header.](/writeups/thm-http2-request-smuggling/05-burp-header-name-splitting.png)

During downgrade, `Transfer-Encoding: chunked` in the name field (with the colon already in place) becomes a syntactically valid HTTP/1.1 header without the frontend ever seeing a `Transfer-Encoding` header in its own HTTP/2 representation. This bypasses sanitisation that only checks for known header names as discrete fields.

---

## Pseudo-header injection — ambiguous hosts and paths

HTTP/2 pseudo-headers (`:method`, `:path`, `:scheme`, `:authority`) are special — they replace the request line and are supposed to appear exactly once each. But some frontends don't enforce this uniqueness constraint, and the behaviour when duplicate pseudo-headers exist is undefined by the spec. Different implementations handle it differently: some use the first value, some use the last, and some concatenate.

### Duplicate :authority for host ambiguity

Adding a second `:authority` pseudo-header creates a request where the frontend and backend may disagree about which host the request is for. If the frontend routes based on the first `:authority` but the backend uses the second (or vice versa), the request ends up at an unintended destination:

![Burp Suite Inspector — request headers showing :scheme https, :method POST, :path /, :authority netlify.com, content-type application/x-www-form-urlencoded, and a second :authority highlighted in green with value "vulnerable-website.com". The duplicate creates host ambiguity during downgrade.](/writeups/thm-http2-request-smuggling/03-burp-duplicate-authority-headers.png)

In this case, the first `:authority` is `netlify.com` and the second is `vulnerable-website.com`. If the frontend routes to `netlify.com` but the downgraded HTTP/1.1 request reaches the backend with `Host: vulnerable-website.com` (because the backend takes the last value), the request is processed as if it were intended for the vulnerable site — bypassing any host-based access controls on the frontend.

This was part of James Kettle's real-world research: the Netlify CDN was vulnerable to exactly this pattern, and the Firefox start page (`start.mozilla.org`) was served through Netlify infrastructure, meaning a smuggled request could target Firefox's start page through the CDN's routing logic.

---

## URL prefix injection via :scheme

The `:scheme` pseudo-header normally contains `http` or `https`. During downgrade, frontends construct the HTTP/1.1 request line by combining the pseudo-headers — and some implementations naively concatenate `:scheme` + `://` + `:authority` + `:path` to build an absolute-form request URL. If the `:scheme` value isn't validated, injecting a full URL into it can override the entire request target.

Setting `:scheme` to `http://start.mozilla.org/xyz?` causes the downgraded request line to become something like:

```
GET http://start.mozilla.org/xyz?://vulnerable-website.com/path HTTP/1.1
```

![Burp Suite Inspector — :scheme pseudo-header with value "http://start.mozilla.org/xyz?" instead of the expected "http" or "https". During downgrade, this overrides the request target in the HTTP/1.1 request line.](/writeups/thm-http2-request-smuggling/06-burp-url-prefix-injection.png)

The backend sees an absolute-form request pointing to `start.mozilla.org` — the original `:authority` and `:path` values are pushed into the query string and effectively neutralised. This is another technique from Kettle's research that affected real-world infrastructure: Verizon's `id.b2b.oath.com` was vulnerable to request line injection through `:method`, and the AOL/HuffPost infrastructure at `accounts.athena.aol.com` was exploitable through similar pseudo-header abuse.

---

## Request line injection

The most direct form of pseudo-header abuse. If the frontend doesn't sanitise newline characters in pseudo-header values, injecting `\r\n` into `:method`, `:path`, or `:authority` allows the attacker to control the entire HTTP/1.1 request line — and anything after it. A `:path` value of `/legitimate\r\nGET /admin HTTP/1.1\r\nHost: internal` would produce:

```
GET /legitimate
GET /admin HTTP/1.1
Host: internal
```

The backend sees two requests. The first one is malformed (no HTTP version on the first line), but some backends are lenient enough to process it — and even if they reject it, the *second* request (the smuggled one) is syntactically valid and gets processed normally. Combined with the `:method` injection variant (where the HTTP version and a smuggled request are injected through the method pseudo-header), this gives the attacker full control over what the backend sees.

---

## Host header bypass techniques

Beyond HTTP/2-specific smuggling, there's a related category of attacks that exploit inconsistencies in how frontends and backends handle the `Host` header. These are simpler than the HTTP/2 techniques but follow the same principle — the frontend and backend disagree about the request's intended destination:

- **Duplicate Host headers** — sending two `Host` headers where the frontend checks the first but the backend uses the last (or vice versa).
- **Absolute URL override** — using an absolute URL in the request line (`GET https://target.com/ HTTP/1.1`) with a different `Host` header. Some backends prioritise the URL's host over the header.
- **Line wrapping** — injecting a space or tab before the `Host` value (` Host: evil.com`) to exploit inconsistent whitespace parsing.
- **Host override headers** — `X-Forwarded-Host`, `X-Host`, `X-Original-URL`, `X-Rewrite-URL`, and similar headers that some backends trust for routing decisions without the frontend validating them.

These aren't HTTP/2-specific, but they compound with the smuggling techniques above: if a smuggled request can also manipulate the Host header, the attacker controls both *what* the backend processes and *where* it thinks the request came from.

---

## What I took from this

The core lesson across all of these techniques is the same one that drives HTTP/1.1 request smuggling: when two systems interpret the same data differently, the gap between their interpretations is the vulnerability. HTTP/2 makes this worse, not better, because the protocol gap is wider — binary framing versus text parsing, pseudo-headers versus request lines, strict message boundaries versus Content-Length/Transfer-Encoding ambiguity. Every translation step is a potential desync point.

What I found most interesting was how the pseudo-header attacks work. CRLF injection through header values and names is conceptually similar to HTTP/1.1 header injection — it's a sanitisation failure, and the fix is straightforward (strip or reject CRLF in HTTP/2 headers before downgrading). But the `:scheme` and `:authority` attacks are structural: they exploit the *design* of the downgrade process, not a sanitisation oversight. The fact that a frontend constructs an HTTP/1.1 request line by concatenating pseudo-header values means that any pseudo-header it doesn't validate becomes an injection point for the entire request line. That's not a bug in any specific implementation — it's a consequence of bridging two fundamentally different protocol models.

The real-world cases make this concrete. Kettle's research hit Verizon, Netlify, AOL, and infrastructure serving the Firefox start page — not small targets. These are organisations with dedicated security teams and mature infrastructure, and the vulnerabilities existed because the HTTP/2-to-HTTP/1.1 translation layer is complex enough that edge cases slip through even careful implementations. The takeaway for anyone operating a reverse proxy or CDN: if you're terminating HTTP/2 and forwarding HTTP/1.1, every header and pseudo-header value needs to be validated against the HTTP/1.1 grammar before it crosses the protocol boundary.
