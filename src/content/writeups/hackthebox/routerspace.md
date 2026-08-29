---
title: 'RouterSpace'
target: 'Hack The Box — RouterSpace'
difficulty: 'easy'
date: 2025-08-29
summary: 'An easy Linux box — downloading an Android APK from a website promoting RouterSpace, performing static analysis with MobSF to extract the hostname, installing the APK on a Genymotion emulator with BurpSuite proxy interception to capture API traffic, exploiting command injection in the /api/v4/monitoring/router/dev/check/deviceAccess endpoint to read the user flag and plant an SSH key, then escalating to root via CVE-2021-3156 (Baron Samedit sudo heap overflow).'
role: 'pentest'
tags: ['android', 'apk', 'mobsf', 'burpsuite', 'command-injection', 'genymotion', 'adb', 'ssh-key-injection', 'cve-2021-3156', 'sudo', 'privilege-escalation']
problem: 'A Linux machine hosting a website that distributes an Android APK for a router management application. The APK communicates with a backend API that is vulnerable to command injection. Gaining initial access requires setting up an Android emulator with proxy interception to capture and manipulate the API traffic. Privilege escalation requires exploiting a vulnerable sudo version.'
action: 'Scanned the target with Nmap finding SSH on port 22 and HTTP on port 80. Downloaded the RouterSpace APK from the website, performed static analysis with MobSF to extract the routerspace.htb hostname from the signer certificate, installed the APK on a Genymotion emulator with ADB, configured BurpSuite proxy interception through ADB reverse port forwarding and emulator proxy settings, intercepted the POST request to /api/v4/monitoring/router/dev/check/deviceAccess, discovered command injection in the ip parameter by appending shell commands with semicolons, confirmed execution as paul via whoami, read the user flag from /home/paul/user.txt, generated an SSH keypair and injected the public key into paul authorized_keys via the command injection, SSH-ed in as paul, identified sudo version 1.8.31 as vulnerable to CVE-2021-3156 (Baron Samedit), and executed the pre-compiled exploit to gain a root shell.'
outcome: 'Rooted the box — retrieved the user flag from /home/paul/user.txt via command injection and the root flag after escalating through CVE-2021-3156. The attack chain moved from APK analysis through API command injection to sudo exploitation.'
draft: false
---

## Background

RouterSpace is a box that front-loads its difficulty in the setup rather than the exploitation. The actual vulnerabilities — command injection and a known sudo CVE — are straightforward, but reaching the injectable endpoint requires downloading an Android APK, setting up an emulator, configuring proxy interception, and capturing the API traffic. It's the kind of box that tests patience and environment configuration as much as technical skill.

---

## Enumeration

Nmap identifies two open ports: SSH on 22 and HTTP on 80. The service scan reveals some interesting details — the SSH banner identifies itself as "RouterSpace Packet Filtering V1", and the HTTP responses include custom headers `X-Powered-By: RouterSpace` and `X-Cdn: RouterSpace-*`. Attempting to fuzz for directories triggers a suspicious activity alert.

```
nmap -sV -sC -Pn -v -oN nmap-report -p 22,80 10.10.11.148
```

```
PORT   STATE SERVICE VERSION
22/tcp open  ssh     (protocol 2.0)
|   NULL:
|_    SSH-2.0-RouterSpace Packet Filtering V1
80/tcp open  http
|     X-Powered-By: RouterSpace
|     X-Cdn: RouterSpace-46080
```

---

## Website and APK download

The website on port 80 is a landing page promoting a mobile application called RouterSpace, with a download button that serves an APK file.

![The RouterSpace website showing a blue landing page with the tagline Connect Your Router With RouterSpace, two phone mockups, and a Download button highlighted in the top-right corner.](/writeups/htb-routerspace/01-routerspace-website.png)

---

## APK static analysis

Loading the downloaded APK into MobSF for static analysis reveals the hostname **routerspace.htb** in the APK signer certificate details — set as the organisation field under both Subject and Issuer.

![The APK signer certificate showing Subject and Issuer both with O=routerspace.htb highlighted, along with ST=Colombo, L=Colombo, C=SL, and validity dates from 2021 to 2049.](/writeups/htb-routerspace/02-apk-certificate-hostname.png)

Adding `routerspace.htb` to `/etc/hosts` didn't reveal any new content on the website. The next step was to install the APK on an emulator and intercept its traffic.

---

## Emulator setup and traffic interception

The APK was installed on a Genymotion emulator using ADB. The application lets you check router status, but connecting to the server requires intercepting the traffic through BurpSuite. The setup involved configuring BurpSuite to listen on all interfaces on port 8081, using `adb reverse tcp:8081 tcp:8081` to forward traffic between the emulator and the attacking machine, and setting the emulator's WiFi proxy to point at the BurpSuite listener.

![The Android emulator WiFi proxy settings showing Proxy set to Manual, Proxy hostname 192.168.63.103, and Proxy port 8081.](/writeups/htb-routerspace/03-emulator-proxy-settings.png)

An older Android API version on the emulator was needed to get the interception working — newer versions had issues connecting through the proxy.

---

## Command injection

With the proxy working, tapping the "Check Status" button in the app sends a POST request to `/api/v4/monitoring/router/dev/check/deviceAccess` with a JSON body containing an `ip` parameter set to `"0.0.0.0"`.

![The intercepted POST request to /api/v4/monitoring/router/dev/check/deviceAccess showing headers including user-agent RouterSpaceAgent, Host routerspace.htb, and the JSON body with ip set to 0.0.0.0.](/writeups/htb-routerspace/04-api-post-request.png)

Sending the request to BurpSuite's Repeater and appending a semicolon followed by a shell command to the IP value confirms command injection. Setting the ip to `"0.0.0.0;ls"` returns a directory listing showing `index.js`, `node_modules`, `package.json`, `package-lock.json`, and `static`.

![BurpSuite Repeater showing the request with ip set to 0.0.0.0;ls and the response returning a directory listing including index.js, node_modules, package.json, package-lock.json, and static.](/writeups/htb-routerspace/05-command-injection-ls.png)

Running `whoami` through the injection confirms execution as **paul**.

![BurpSuite Repeater showing the request with ip set to 0.0.0.0;whoami and the response returning paul.](/writeups/htb-routerspace/06-whoami-paul.png)

Reading the user flag is a matter of injecting `cat /home/paul/user.txt`.

![BurpSuite Repeater showing the request with ip set to 0.0.0.0;cat /home/paul/user.txt and the response returning the user flag.](/writeups/htb-routerspace/07-user-flag.png)

---

## SSH access via key injection

Reverse shell attempts using standard payloads all failed, likely due to firewall rules. However, paul's home directory contains a `.ssh` folder. Generating a fresh SSH keypair with `ssh-keygen -o` and using the command injection to write the public key into paul's `authorized_keys` file provides a proper SSH session.

![BurpSuite Repeater showing the request with ip set to 0.0.0.0;echo followed by an SSH public key redirected into /home/paul/.ssh/authorized_keys, with the server returning a 200 OK response.](/writeups/htb-routerspace/08-ssh-key-injection.png)

Setting the correct permissions on the `authorized_keys` file with `chmod 700` through a second injection.

![BurpSuite Repeater showing the request with ip set to 0.0.0.0;chmod 700 /home/paul/.ssh/authorized_keys and the server returning a 200 OK response.](/writeups/htb-routerspace/09-chmod-authorized-keys.png)

With the key in place, SSH-ing in as paul works cleanly.

```
ssh paul@10.10.11.148 -i id_rsa
```

---

## Privilege escalation — CVE-2021-3156

Once logged in via SSH, paul's home directory contains an exploit script referencing **CVE-2021-3156** — the Baron Samedit vulnerability, a heap-based buffer overflow in sudo. Checking the sudo version confirms it's vulnerable.

```
paul@routerspace:~$ sudo -V
Sudo version 1.8.31
```

Sudo 1.8.31 falls within the affected range for CVE-2021-3156 (versions 1.8.2 through 1.8.31p2 and 1.9.0 through 1.9.5p1). A pre-compiled version of the exploit was already present on the machine. Executing it provided a root shell, and the root flag was retrieved.

---

## What I took from this

The box's real challenge is the setup, not the exploitation. Command injection with semicolons into an unsanitised input field is about as basic as it gets, and CVE-2021-3156 is a well-documented public exploit. But getting to the injectable endpoint requires a working Android emulator, ADB configuration, BurpSuite proxy setup, and enough patience to troubleshoot when the emulator's Android API version doesn't cooperate with the proxy.

The command injection itself is worth noting because of where it sits — inside a mobile application's API. The developers presumably assumed that because the request originates from a compiled APK rather than a browser, the input would always be a valid IP address. But any request that reaches a server can be intercepted and modified, regardless of the client that generated it. Mobile APIs are subject to the same input validation requirements as web APIs, and this box is a clean demonstration of what happens when that's overlooked.
