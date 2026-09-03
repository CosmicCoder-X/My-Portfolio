---
title: 'Beep'
target: 'Hack The Box — Beep'
difficulty: 'easy'
date: 2025-09-15
summary: 'An HTB machine — heavily-serviced CentOS box with 12 open ports including Elastix/FreePBX 2.8.1.4 on HTTPS and Webmin on 10000. Exploited CVE-2012-4869 (FreePBX pre-auth RCE) after enumerating SIP extension 233, caught a shell as asterisk, then escalated to root via sudo nmap --interactive shell escape.'
role: 'pentest'
tags: ['nmap', 'elastix', 'freepbx', 'gobuster', 'sip', 'voip', 'sippts', 'svwar', 'cve-2012-4869', 'rce', 'reverse-shell', 'sudo', 'nmap-interactive', 'privilege-escalation']
problem: 'CentOS machine with 12 open ports including Elastix/FreePBX 2.8.1.4 on HTTPS (requiring legacy TLS), SIP on 5060, and Webmin on 10000. FreePBX is vulnerable to CVE-2012-4869 pre-auth RCE via callme_page.php, requiring a valid SIP extension. The asterisk user has passwordless sudo on nmap with its interactive mode shell escape.'
action: 'Nmap revealed 12 open ports. Fixed Firefox TLS (security.tls.version.min=1) to access the Elastix login page. Gobuster found /admin (FreePBX 2.8.1.4) and /recordings. Enumerated SIP on port 5060 with sippts (Asterisk PBX) and brute-forced extensions with svwar, finding extension 233. Ran CVE-2012-4869 exploit (FreePBX callme_page.php pre-auth RCE) with extension 233 and caught a reverse shell as asterisk. Found 14 passwordless sudo commands including nmap — used sudo nmap --interactive then !sh for root.'
outcome: 'Gained root via FreePBX pre-auth RCE (CVE-2012-4869) requiring SIP extension enumeration for initial access, followed by nmap interactive mode sudo escape for privilege escalation.'
draft: false
---

## Background

Beep is an easy-rated Linux machine that stands out for its sheer attack surface — twelve open ports running everything from a PBX system to a mail server to a web-based system administration tool. The abundance of services creates genuine rabbit holes; it's easy to spend time poking at Webmin, testing default credentials on Elastix, or chasing MySQL without ever finding the actual path forward. The intended route cuts through the noise by focusing on the Elastix/FreePBX stack — a pre-authenticated RCE exploit that requires understanding VoIP enough to enumerate a SIP extension. The privilege escalation is a classic: nmap's long-removed interactive mode provides a trivial shell escape when it's available through sudo.

---

## Enumeration

An nmap scan against the target reveals a heavily-serviced box with twelve open ports:

![Nmap scan report for 10.129.229.183 showing Host is up with 0.044s latency, 988 closed tcp ports. Open ports: 22/tcp SSH OpenSSH 4.3 with DSA and RSA host keys, 25/tcp SMTP (couldn't establish connection), 80/tcp HTTP Apache 2.2.3 CentOS redirecting to HTTPS, 110/tcp POP3, 111/tcp RPC rpcbind v2 with rpcinfo showing portmapper and status services, 143/tcp IMAP, 443/tcp SSL/HTTP Apache 2.2.3 CentOS with SSL cert for localhost.localdomain/SomeOrganization valid 2017-2018, http-title Elastix Login page, 993/tcp IMAPS.](/writeups/htb-beep/01-nmap-scan-1.png)

![Continuation of nmap scan showing 993/tcp IMAPS, 995/tcp POP3S, 3306/tcp MySQL, 4445/tcp upnotify, 10000/tcp HTTP MiniServ 1.570 (Webmin httpd) with no title and Charset iso-8859-1, Service Info Host 127.0.0.1, clock-skew 10s. Scan completed in 522.41 seconds.](/writeups/htb-beep/02-nmap-scan-2.png)

SSH, SMTP, HTTP/HTTPS with Apache 2.2.3 on CentOS, POP3, RPC, IMAP with their SSL variants, MySQL, and Webmin on port 10000. The HTTPS title identifies the application as **Elastix** — a unified communications platform built on top of Asterisk PBX and FreePBX.

---

## TLS compatibility and initial recon

Attempting to browse to the HTTPS site fails immediately — the server's TLS configuration is too old for modern Firefox. The fix is setting `security.tls.version.min` to `1` in Firefox's `about:config` to allow TLSv1.0 connections:

![Firefox about:config page filtered to security.tls.version showing security.tls.version.enable-deprecated (false), security.tls.version.fallback-limit (4), security.tls.version.max (4), and security.tls.version.min set to 1, with Boolean radio button selected at the bottom for a new entry.](/writeups/htb-beep/03-tls-fix.png)

With TLS fixed, the Elastix login page loads, but default credentials don't work. Port 10000 hosts a **Webmin** instance (MiniServ 1.570) with its own login page:

![Webmin login page at 10.129.229.183:10000/session_login.cgi showing Login failed Please try again message, Login to Webmin header, instruction to enter username and password to login to the Webmin server on 10.129.229.183, Username field containing admin, empty Password field, Remember login permanently checkbox, and Login/Clear buttons. Advanced Preferences about:config panel visible in the corner.](/writeups/htb-beep/04-webmin-login.png)

Default credentials fail here too. With two login pages and no quick wins, directory enumeration is the next step.

---

## Directory enumeration — FreePBX revealed

Running gobuster against the HTTPS site with the `-k` flag to skip certificate validation:

```bash
sudo gobuster dir -u https://10.129.229.183 -w /usr/share/wordlists/dirb/big.txt -o gobust -k
```

![Gobuster v3.8.2 output against https://10.129.229.183 with 10 threads and /usr/share/wordlists/dirb/big.txt wordlist, showing results: .htaccess (403, 291 bytes), .htpasswd (403, 291 bytes), admin (301 redirecting to /admin/), cgi-bin/ (403, 290 bytes), configs (301 to /configs/), favicon.ico (200, 894 bytes), help (301 to /help/), images (301 to /images/), lang (301 to /lang/), libs (301 to /libs/), mail (301 to /mail/), modules (301 to /modules/), panel (301 to /panel/), recordings (301 to /recordings/), robots.txt (200, 28 bytes), static (301 to /static/). Progress at 17306/20469 (84.55%).](/writeups/htb-beep/05-gobuster.png)

The `/admin` directory leads to a FreePBX administration login page that reveals the version: **FreePBX 2.8.1.4**. The `/recordings` directory is also significant — it's the FreePBX call recordings module, and it's the entry point for the exploit.

---

## CVE-2012-4869 — FreePBX/Elastix pre-authenticated RCE

Searching for Elastix and FreePBX vulnerabilities leads to CVE-2012-4869 on Exploit-DB — a pre-authenticated remote code execution targeting the `callme_page.php` script in the recordings module:

![Exploit-DB page at www.exploit-db.com/exploits/18650 showing FreePBX 2.10.0 / Elastix 2.2.0 - Remote Code Execution, CVE 2012-4869, Author MUTS, Type WEBAPPS, Platform PHP, Date 2012-03-23, EDB Verified checkmark. Bottom shows it is a Python script titled FreePBX / Elastix pre-authenticated remote code execution exploit.](/writeups/htb-beep/06-exploit-db.png)

The exploit works by injecting a reverse shell payload into the `callmenum` parameter of `callme_page.php`, which passes attacker-controlled input directly to the system shell. However, it requires a valid SIP extension number to construct the payload — without a real extension, the call setup fails and the injected command never executes.

---

## SIP enumeration — finding the extension

The SIP service runs on port 5060 (UDP). Using `sippts enumerate` to fingerprint the VoIP stack:

![sippts enumerate output against 10.129.229.183:5060/UDP showing SIP method responses — SUBSCRIBE returns 404 Not Found (User-Agent FPBX-2.8.1(1.8.7.0)), REGISTER returns 100 Trying / 401 Unauthorized (FPBX-2.8.1(1.8.7.0), fingerprinted as Asterisk PBX), PUBLISH returns 489 Bad Event, MESSAGE returns 415 Unsupported Media Type, NOTIFY returns 200 OK, OPTIONS returns 200 OK, UPDATE/CANCEL return 481 Call leg/transaction does not exist, REFER returns 603 Declined, PRACK returns 481, INVITE returns 100 Trying / 200 OK, INFO/ACK/BYE return Timeout. Summary table shows all methods with FPBX-2.8.1(1.8.7.0) User-Agent, REGISTER fingerprinted as Asterisk PBX, all others Too many matches. Time elapsed 5 seconds.](/writeups/htb-beep/07-sippts-enumerate.png)

The `REGISTER` method fingerprints the service as **Asterisk PBX** with the `FPBX-2.8.1(1.8.7.0)` User-Agent. The `INVITE` method returns `200 OK`, confirming that call initiation is possible. Using `svwar` to brute-force extensions 100-500 with the INVITE method:

```bash
sudo svwar 10.129.229.183 -p 5060 -e 100-500 -m INVITE
```

![Terminal showing sudo svwar 10.129.229.183 -p 5060 -e 100-500 -m INVITE with WARNING TakeASip using an INVITE scan on an endpoint. Results table showing Extension 233 with Authentication reqauth. Tmux status bar visible at bottom with sessions.](/writeups/htb-beep/08-svwar-extension.png)

Extension **233** is active and requires authentication. This is the value needed for the exploit.

---

## Exploiting CVE-2012-4869 — reverse shell

The exploit script targets the `callme_page.php` endpoint on the recordings module, injecting a reverse shell through the `callmenum` parameter. The script needed a small modification — the extension value set to 233, and the attacker's IP and port configured. Running it with `python2` (the script uses the older `urllib` module) while a netcat listener waits:

![Split terminal — left side shows cat test.py displaying the exploit script with import urllib, import ssl, rhost 10.129.229.183, lhost 10.10.14.146, lport 9001, extension 233, ssl._create_default_https_context set to ssl._create_unverified_context, reverse shell payload URL targeting /recordings/misc/callme_page.php with action=c and callmenum parameter containing the injected shell command. First attempt with python3 fails with AttributeError module urllib has no attribute urlopen. Second attempt with python2 succeeds. Right side shows nc -lvp 9001 listening on any 9001, then connect to 10.10.14.146 from UNKNOWN 10.129.229.183 port 37540 confirming the reverse shell was caught.](/writeups/htb-beep/09-reverse-shell.png)

The first attempt with `python3` fails because the script uses the Python 2 `urllib` API. Running with `python2` works — the reverse shell connects back as the `asterisk` user. The user flag was retrieved from here.

---

## Privilege escalation — nmap interactive mode

Checking sudo privileges for the `asterisk` user reveals an unusually generous configuration:

![Terminal showing sudo -l output for asterisk user with Matching Defaults entries env_reset, env_keep preserving COLORS DISPLAY HOSTNAME HISTSIZE INPUTRC KDEDIR LS_COLORS MAIL PS1 PS2 QTDIR USERNAME LANG and various LC_ locale variables and XAUTHORITY. User asterisk may run the following commands with (root) NOPASSWD: /sbin/shutdown, /usr/bin/nmap, /usr/bin/yum, /bin/touch, /bin/chmod, /bin/chown, /sbin/service, /sbin/init, /usr/sbin/postmap, /usr/sbin/postfix, /usr/sbin/saslpasswd2, /usr/sbin/hardware_detector, /sbin/chkconfig, /usr/sbin/elastix-helper.](/writeups/htb-beep/10-sudo-privs.png)

Fourteen commands available as root without a password — shutdown, nmap, yum, touch, chmod, chown, service, init, postmap, postfix, saslpasswd2, hardware_detector, chkconfig, and elastix-helper. Several of these are exploitable, but `nmap` is the most straightforward. Nmap 4.11 (installed on this CentOS box) includes an interactive mode that was removed in later versions. It provides a command prompt where `!` prefixes execute shell commands with nmap's privileges:

```bash
sudo nmap --interactive
```

![Terminal showing ls -lah /root with total 16M, files including anaconda-ks.cfg, .bash_history symlinked to /dev/null, .bash_logout, .bash_profile, .bashrc, .cshrc, elastix-pr-2.2-1.i386.rpm (186K), install.log, install.log.syslog, postnochroot, root.txt (33 bytes), .tcshrc, and webmin-1.570-1.noarch.rpm (16M). Then sudo nmap --interactive starting Nmap V. 4.11, Welcome to Interactive Mode press h for help, nmap prompt with !sh command, then whoami returning root.](/writeups/htb-beep/11-root-shell.png)

`nmap --interactive` drops into Nmap's interactive shell, and `!sh` spawns a root shell. Both flags were retrieved.

---

## What I took from this

Beep is a box that tests patience and prioritization as much as technical skill. Twelve open ports with multiple login pages, mail services, MySQL, RPC, and Webmin create genuine decision paralysis — do you chase the Webmin login, try to enumerate MySQL, attempt SMTP user enumeration, or focus on the web application? The answer is always to map the entire surface first and then pursue the path with the most specific vulnerability. The Elastix/FreePBX stack with a known CVE is a more promising lead than brute-forcing Webmin credentials, but only if you've done enough research to find CVE-2012-4869 and understand its requirements.

The SIP enumeration step is what makes this box educational rather than just a CVE lookup exercise. The exploit doesn't work without a valid extension number, and finding that extension requires understanding enough about VoIP to know that SIP exists, that it runs on port 5060, and that tools like `svwar` can enumerate extensions by method. It's a good introduction to VoIP pentesting concepts — SIP methods (INVITE, REGISTER, OPTIONS), extension brute-forcing, and how PBX systems expose their internals through protocol-level responses.

The nmap interactive mode escalation is a relic of an older era — Nmap removed the `--interactive` flag after version 5.0 precisely because of this abuse potential. But it's a perfect illustration of why sudo allowlists need careful auditing. Allowing nmap as root seems reasonable on the surface — a sysadmin might need to run privileged scans. But any binary with a shell escape, a file write capability, or an arbitrary command execution feature becomes a privilege escalation vector when it runs as root. The same applies to `yum` (which can install arbitrary RPMs containing scripts), `chmod`/`chown` (which can make any file writable or owned by the attacker), and `service`/`init` (which can start attacker-controlled services). Nearly every binary in that sudo list is independently exploitable — the box chose nmap because it's the most instructive example.
