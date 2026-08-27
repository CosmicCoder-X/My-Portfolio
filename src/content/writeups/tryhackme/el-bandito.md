---
title: 'El Bandito'
target: 'TryHackMe — El Bandito'
difficulty: 'hard'
date: 2025-08-27
summary: 'A multi-service target running a Python web app and an nginx-proxied Spring Boot backend. SSRF through a service status checker is chained with a rogue WebSocket upgrade to smuggle requests past nginx and reach internal endpoints, leaking admin credentials. HTTP/2 request desync then exploits a Content-Length mismatch to intercept another user''s authenticated request and steal their session cookie containing the final flag.'
role: 'appsec'
tags: ['ssrf', 'http-request-smuggling', 'http2-desync', 'websocket', 'spring-boot', 'burp-suite', 'nmap', 'gobuster', 'web-exploitation']
problem: 'A target machine runs a Python-based web application on port 80 and an nginx reverse proxy on port 8080 fronting a Spring Boot backend. Internal endpoints on port 8080 — including /admin-creds and /admin-flag — are blocked by nginx. A separate user periodically logs into the port 80 application. The goal is to reach the internal endpoints and intercept the other user''s session to retrieve two flags.'
action: 'Enumerated both services with Nmap and Gobuster, identified Spring Boot Actuator endpoints behind nginx on port 8080, found an SSRF vector in a JavaScript service status checker on port 80, set up a rogue HTTP server returning a 101 Switching Protocols response to trick nginx into establishing a raw tunnel, smuggled GET requests through the tunnel to reach the internal /admin-creds and /admin-flag endpoints, logged into the chat application with the leaked credentials, analysed the sendMessage function to understand the POST body format, exploited an HTTP/2-to-HTTP/1.1 request desync by setting Content-Length: 0 in an HTTP/2 POST to smuggle a second request that intercepted another user''s login, and extracted the flag from their captured cookie.'
outcome: 'Retrieved the first flag from the internal /admin-flag endpoint via WebSocket smuggling and the second flag THM{!RIGHT_ASCENSION_12h_36m_25.46s!} from an intercepted user login request via HTTP/2 desync. Documented both smuggling techniques end to end.'
draft: false
---

## Reconnaissance

### Nmap scan

Starting with a full port scan against the target:

```
sudo nmap -sS -p- -T4 10.10.177.82
```

![Nmap scan results — port 22 running SSH, port 80 running HTTP, port 631 running IPP, port 8080 running http-proxy. All TCP, all open.](/writeups/thm-el-bandito/01-nmap-scan-ports.png)

Four ports open: **SSH on 22**, **HTTP on 80**, **IPP on 631**, and **HTTP-proxy on 8080**. Running a service version scan against the interesting ports fills in the details:

![Nmap service details — port 631 running CUPS 2.4 with IPP/2.1 headers, port 8080 running nginx.](/writeups/thm-el-bandito/02-nmap-service-details.png)

Port 631 is **CUPS 2.4** (a print service — not relevant to the attack path), and port 8080 is **nginx** acting as a reverse proxy. The HTTP service on port 80 is the main web application — labelled "El Bandito Server" in its response headers, as later requests will confirm.

### Directory enumeration — port 80

Running Gobuster against the main web application:

```
gobuster dir -u http://10.10.62.73 -w /usr/share/wordlists/SecLists/Discovery/Web-Content/directory-list-2.3-medium.txt
```

![Gobuster results for port 80 — /login (405), /static (301 redirecting to /static/), /access (200), /messages (302 redirecting to /), /logout (302 redirecting to /), /save (405), /ping (200).](/writeups/thm-el-bandito/03-gobuster-port80.png)

The application has authentication endpoints (`/login`, `/logout`), a `/messages` route that redirects without a session, a `/save` endpoint, and two interesting 200s: `/access` (the login page) and `/ping` (which returns a simple response — useful later for testing smuggling). The `/save` endpoint accepting POST requests will become part of the final exploit chain.

### Directory enumeration — port 8080

Enumerating the nginx proxy:

```
gobuster dir -u http://10.10.62.73:8080 -w /usr/share/wordlists/SecLists/Discovery/Web-Content/directory-list-2.3-medium.txt
```

![Gobuster results for port 8080 — /info (200), /admin (403), /health (200), /assets (200), /token (200), and many paths returning 403 including /admins, /admin_images, /administrator, /metrics, /env, /dump, /traces, and various admin-prefixed paths.](/writeups/thm-el-bandito/04-gobuster-port8080.png)

The 403s are the tell here. Paths like `/admin`, `/admins`, `/administrator`, `/metrics`, `/env`, `/dump`, and `/traces` are all blocked by nginx — but the fact that they return 403 instead of 404 means the backend knows about them. The `/info`, `/health`, and `/token` endpoints return 200, which is consistent with a **Spring Boot** application exposing Actuator endpoints.

### Spring Boot Actuator confirmation

Running Nmap's `http-enum` script against port 8080 confirms the framework:

![Nmap http-enum results — /configprops/, /health/, and /mappings/ identified as Spring Boot Actuator endpoints.](/writeups/thm-el-bandito/05-nmap-spring-boot-actuator.png)

Spring Boot Actuator endpoints like `/configprops`, `/health`, and `/mappings` are management interfaces that expose application internals. Nginx is blocking most of the sensitive ones, but the backend itself is a full Spring Boot service — and if there's a way to bypass nginx, those internal endpoints (and the `/admin-creds`, `/admin-flag` paths suggested by the 403 pattern) become reachable.

---

## WebSocket smuggling — bypassing nginx

### The WebSocket clue

Browsing the application on port 80 reveals a cryptocurrency-themed site called "Bandit Coin." Inspecting the page source and watching the browser console shows a failed WebSocket connection attempt:

![Browser console — "Firefox can't establish a connection to the server at ws://10.10.62.36:8080/ws." followed by "This service is not working on purpose ;)" and a WebSocket error object. A 404 for jquery-1.10.2.min.js on port 8080 is also visible.](/writeups/thm-el-bandito/07-websocket-error-console.png)

The application tries to open a WebSocket to port 8080 at `/ws`, but the server deliberately rejects it with a playful message. The WebSocket connection fails, but the fact that the application *attempts* it means nginx is configured to handle WebSocket upgrades on this path. That's a significant detail.

### The SSRF vector

Digging into the JavaScript source reveals the `checkServiceStatus()` function:

![JavaScript source — checkServiceStatus() iterates over serviceURLs array containing "http://bandito.websocket.thm" and "http://bandito.public.thm", calling fetch('/isOnline?url=${serviceUrl}') for each. The response sets the output element's innerHTML to ONLINE or OFFLINE.](/writeups/thm-el-bandito/08-javascript-ssrf-source.png)

The function calls `/isOnline?url=<target>` for each service URL — the server fetches whatever URL is passed in the `url` parameter and reports whether it's reachable. That's a textbook **Server-Side Request Forgery** vector: instead of pointing it at the intended services, it can be aimed at internal endpoints, including the Spring Boot backend on port 8080.

### The WebSocket upgrade request

Before exploiting the SSRF, it's worth understanding what the WebSocket upgrade looks like. Capturing the browser's attempt in Burp:

![WebSocket upgrade request — GET /ws HTTP/1.1 to 10.10.62.73:8080 with Connection: keep-alive, Upgrade; Sec-WebSocket-Version: 13; Sec-WebSocket-Key header; Upgrade: websocket.](/writeups/thm-el-bandito/06-websocket-upgrade-request.png)

A standard WebSocket handshake: the client sends `Upgrade: websocket` and `Connection: Upgrade`, and the server is expected to respond with `101 Switching Protocols` to complete the upgrade. Once the 101 is received, nginx treats the connection as a raw TCP tunnel and stops inspecting the traffic — it just passes bytes between client and backend. That behaviour is the key to the entire smuggling attack.

### The rogue server trick

The SSRF on `/isOnline` makes the *server* issue the request, so the plan is: point the SSRF at a rogue HTTP server under my control that always responds with `101 Switching Protocols`. When nginx sees the 101, it thinks a WebSocket tunnel has been established and stops parsing HTTP. From that point, any additional data sent on the same connection is forwarded directly to the backend — bypassing nginx's access controls entirely.

The rogue server is a simple Python script (credit to TryHackMe for the template):

```python
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

if len(sys.argv)-1 != 1:
    print("""Usage: {} <port>""".format(sys.argv[0]))
    sys.exit()

class Redirect(BaseHTTPRequestHandler):
   def do_GET(self):
       self.protocol_version = "HTTP/1.1"
       self.send_response(101)
       self.end_headers()

HTTPServer(("", int(sys.argv[1])), Redirect).serve_forever()
```

Running this on the attack box on port 5555, then crafting the smuggling request in Burp: a GET to `/isOnline?url=http://10.13.91.64:5555` on port 8080 with WebSocket upgrade headers, followed immediately by a smuggled `GET /admin-creds` request on the same connection:

![Burp Suite request and response — GET /isOnline?url=http://10.13.91.64:5555 HTTP/1.1 to port 8080 with Sec-WebSocket-Version: 13, Connection: Upgrade, Upgrade: websocket headers. Below the blank line, a smuggled GET /admin-creds HTTP/1.1 with Host: 10.10.62.73:8080. The response shows HTTP/1.1 101 from the rogue server, followed by HTTP/1.1 200 with Content-Type: text/plain and body "username:hAckLIEN password:YouCanCatchUsInYourDreams404".](/writeups/thm-el-bandito/09-burp-ssrf-websocket-smuggling.png)

The chain works perfectly. The SSRF hits the rogue server, which returns 101. Nginx establishes the "tunnel." The smuggled `GET /admin-creds` request passes through the tunnel directly to the Spring Boot backend, which responds with plaintext credentials: `hAckLIEN` / `YouCanCatchUsInYourDreams404`.

Using the same technique to smuggle a request to `/admin-flag` retrieves the first flag.

---

## HTTP/2 desync — intercepting user requests

### The chat application

Logging into the port 80 application at `/access` with the stolen credentials (`hAckLIEN` / `YouCanCatchUsInYourDreams404`) reveals a chat interface with two contacts — **Jack** and **Oliver**:

![Chat interface — dark-themed messaging app with Jack and Oliver in the contact list. Jack's conversation shows three messages about "Galactic Enforcement's quantum sniffers" tracing blockchain exploits, predictive analytics, and a message about needing to "jump now" and close the portal. A message input field and Send button at the bottom, with a LOGOUT button in the lower left.](/writeups/thm-el-bandito/10-chat-interface.png)

The in-character messages hint at the room's theme, but the real interest is how messages are sent. Inspecting the JavaScript source for the `sendMessage()` function:

![JavaScript source — sendMessage() reads the message input, constructs a messageData object, and sends a POST to /send_message with Content-Type: application/x-www-form-urlencoded and body "data="+messageText.](/writeups/thm-el-bandito/11-javascript-sendmessage-source.png)

Messages are sent as a POST to `/send_message` with the body format `data=<message>`. The `Content-Type` is `application/x-www-form-urlencoded`. This endpoint and body format will be the vehicle for the desync attack — if a smuggled request can POST to `/send_message` with a `data=` parameter that captures another user's request, that captured data will appear in the chat messages.

### Proving the desync

HTTP/2 request smuggling exploits a mismatch between how the frontend (nginx) and backend handle `Content-Length`. In HTTP/2, the framing layer defines message boundaries, so `Content-Length` is technically redundant — but if the backend downgrades the request to HTTP/1.1 internally, it may honour the `Content-Length` header. Setting `Content-Length: 0` on an HTTP/2 POST tells the frontend the body is empty, but any body data included is still forwarded. The backend, reading HTTP/1.1, sees the body as the start of a *new* request.

Testing with a smuggled `GET /ping`:

![Burp Suite — POST /send_message HTTP/2 to 10.10.142.148:80 with session cookie, Content-Length: 0, followed by a blank line and "GET /ping HTTP/1.1" with "Foo: x" header. Response: HTTP/2 200 OK with body {"status":"Message received and stored successfully"}.](/writeups/thm-el-bandito/12-burp-h2-desync-smuggle.png)

The server responds with "Message received and stored successfully" — it processed the POST to `/send_message` normally. But the smuggled `GET /ping` after the body should have been processed as a separate request by the backend. Sending the same request again and checking the response confirms it:

![Burp Suite — same POST /send_message HTTP/2 request with Content-Length: 0 and smuggled GET /ping HTTP/1.1. Response: HTTP/2 200 OK with Content-Type: text/html, Content-Length: 4, body "pong".](/writeups/thm-el-bandito/13-burp-smuggled-ping-pong.png)

The second time, the response is `pong` — the backend processed the smuggled `GET /ping` as its own request and returned the result in place of the next response. The desync is confirmed: the frontend and backend are out of sync on request boundaries.

### Weaponising the desync

The goal is to intercept another user's request — specifically their login request, which will contain their session cookie. The technique: smuggle a `POST /send_message` request with a `data=` parameter but an inflated `Content-Length` (larger than the actual smuggled body). The backend reads the smuggled POST, sees that the body is shorter than the declared `Content-Length`, and waits for more data. When the next user's request arrives on the same connection, the backend appends it to the smuggled body — effectively capturing the victim's entire HTTP request as the `data` parameter value, which gets stored as a chat message.

Crafting the payload in Burp:

![Burp Suite — POST /save HTTP/2 to 10.10.142.148:80 with session cookie, Content-Length: 0. Below, a smuggled POST /send_message HTTP/1.1 with the same host and cookie, Content-Length: 900, Content-Type: application/x-www-form-urlencoded, and body "data=". Response: HTTP/2 200 OK with "Content saved successfully".](/writeups/thm-el-bandito/14-burp-smuggled-send-message.png)

The outer request is `POST /save` with `Content-Length: 0` — nginx thinks the body is empty. The smuggled inner request is `POST /send_message` with `Content-Length: 900` and `data=` as the start of the body. The backend reads the inner POST, sees only a few bytes of body but expects 900, and waits. The next request that arrives on this connection — from any user — gets appended to `data=` and stored as a chat message.

### Catching the flag

After sending the smuggling payload every 5-10 seconds and checking `/getMessages` for captured data:

![Burp Suite — GET /getMessages HTTP/2 request to 10.10.142.148:80 with session cookie, Accept: */*, and Referer: https://10.10.142.148:80/messages.](/writeups/thm-el-bandito/15-burp-getmessages-request.png)

The response to `/getMessages` contains the intercepted request — another user's `POST /login` to `bandito.public.thm:80`, complete with their headers, cookies, and the flag embedded in a cookie value:

![Burp Suite response — the intercepted POST /login request visible as a stored message, showing the victim's full HTTP request including headers (Chrome/122, HeadlessChrome), and a cookie containing "flag=THM{RIGHT_ASCENSION_12h_36m_25.46s!}" with encoded special characters.](/writeups/thm-el-bandito/16-burp-intercepted-flag.png)

The captured cookie contains the second flag:

```
THM{!RIGHT_ASCENSION_12h_36m_25.46s!}
```

---

## What I took from this

This room is one of the more technically demanding ones I've done, and what makes it interesting is that both flags require exploiting how intermediaries (nginx, HTTP/2 frontends) interpret protocol transitions differently from the backends behind them. The WebSocket smuggling attack doesn't exploit a bug in nginx or in the Spring Boot backend individually — it exploits the *trust relationship* between them. Nginx is designed to stop inspecting traffic after a 101 Switching Protocols response because that's the correct behaviour for a legitimate WebSocket upgrade. The vulnerability is that the SSRF lets an attacker control what returns the 101, and a rogue server can trigger the tunnel without the backend ever participating in the handshake.

The HTTP/2 desync is a similar class of problem but at a different protocol layer. HTTP/2's binary framing makes `Content-Length` redundant for message boundaries, but when the frontend proxies to an HTTP/1.1 backend, that header regains its meaning — and a mismatch between what the frontend considers "one request" and what the backend considers "one request" creates the desync window. The ability to capture another user's full HTTP request, including cookies and authentication headers, by simply leaving a "dangling" body that absorbs the next request on the connection is a powerful primitive. The fix is straightforward in principle — don't forward `Content-Length` across protocol boundaries when the framing layer already defines boundaries — but in practice, proxy chains involving mixed HTTP/1.1 and HTTP/2 are common, and the edge cases are subtle.
