---
title: 'Investigating Windows 2.0'
target: 'TryHackMe — Investigating Windows 2.0'
difficulty: 'medium'
date: 2025-08-27
summary: 'A compromised Windows Server (EC2AMAZ-I8UHO76) with multiple persistence mechanisms, WMI backdoors, and disguised binaries. The investigation uses Task Scheduler, Autoruns, Loki IOC scanner, Process Monitor, and strings analysis to uncover the full scope of the compromise.'
role: 'forensics'
tags: ['windows-forensics', 'incident-response', 'wmi-persistence', 'loki', 'ioc-scanner', 'autoruns', 'process-monitor', 'yara', 'strings-analysis', 'malware-analysis']
problem: 'A Windows Server instance (EC2AMAZ-I8UHO76) has been compromised. Multiple persistence mechanisms are in place — scheduled tasks, registry run keys, WMI event subscriptions — and several binaries on disk are either malicious tools or legitimate utilities masquerading under different names. The goal is to trace every artifact, identify the attack tooling, and answer a structured set of forensic questions about what happened on this box.'
action: 'Walked through the machine methodically: started with Task Scheduler and registry keys to find persistence entry points, moved to Autoruns for a broader view, deployed Loki (an open-source IOC scanner) to sweep the disk for known-bad signatures, used Process Monitor and Process Hacker to observe live behavior, then finished with strings analysis and custom YARA rules to identify binaries Loki missed.'
outcome: 'Mapped the full compromise: a WMI-based backdoor using VBScript and WQL event subscriptions, multiple Sysinternals tools repurposed for lateral movement, a CACTUSTORCH payload hidden in a JavaScript file, and mimikatz renamed and tucked away on disk. Every persistence mechanism and malicious binary was identified and documented.'
draft: false
---

## The setup

This is a blue-team investigation room — no exploitation required. You RDP into a pre-compromised Windows Server (EC2AMAZ-I8UHO76) and work through a set of forensic questions, each one pointing you toward a different artifact or tool. The machine is already infected; the job is to understand what the attacker left behind.

The room is structured as a Q&A walkthrough, and the investigation naturally splits into phases: persistence discovery, IOC scanning, live process analysis, and binary identification.

---

## Persistence mechanisms

### Task Scheduler

The first stop is Task Scheduler. Opening it reveals a suspicious scheduled task named **GameOver** sitting right there in the task library.

![Task Scheduler showing the GameOver scheduled task among the default Windows tasks on EC2AMAZ-I8UHO76.](/writeups/thm-investigating-windows-2/01-task-scheduler-gameover.png)

The task name alone is a red flag — nothing legitimate on a Windows Server is called "GameOver." This is one of the attacker's persistence mechanisms, ensuring something malicious runs on a schedule or at logon.

### Registry persistence — UserInitMprLogonScript

Beyond scheduled tasks, the attacker also planted a registry-based persistence key. The path is:

```
HKCU\Environment\UserInitMprLogonScript
```

![Registry Editor showing the UserInitMprLogonScript value under HKCU\Environment, pointing to a script that runs at every user logon.](/writeups/thm-investigating-windows-2/02-registry-userinitmprlogonscript.png)

This is a classic persistence technique. `UserInitMprLogonScript` runs whatever it points to every time the user logs in — it fires before the desktop loads, making it harder to catch in the act. Attackers love it because it doesn't show up in the usual "Run" or "RunOnce" registry keys that defenders check first.

### Autoruns

To get a broader view of everything configured to run at startup, I opened **Autoruns** (a Sysinternals tool that enumerates every auto-start location on the system). One entry immediately stood out: **mim.exe** configured for persistence.

![Autoruns showing mim.exe among the auto-start entries, flagged with persistence configuration on the compromised machine.](/writeups/thm-investigating-windows-2/03-autoruns-mim-persistence.png)

The name `mim.exe` is a short alias that will come up again later — it's mimikatz, renamed to blend in.

---

## IOC scanning with Loki

### Deploying Loki

Loki is an open-source IOC (Indicator of Compromise) scanner that checks files against known-bad hashes, YARA rules, and suspicious filename patterns. It was already present on the machine in its own directory.

![The Loki directory on the compromised machine, showing the scanner files ready to run.](/writeups/thm-investigating-windows-2/04-loki-directory.png)

### Initial scan warnings

Running Loki immediately produces WMI-related warnings — the scanner flags suspicious WMI event subscriptions before it even gets to the file scan:

![Loki scan output showing multiple WARNING entries related to WMI event filters and suspicious WQL queries.](/writeups/thm-investigating-windows-2/05-loki-wmi-warnings.png)

These warnings are the first hint that the attacker used **WMI persistence** — a more advanced technique than simple scheduled tasks or registry keys. WMI event subscriptions can trigger scripts in response to system events, and they survive reboots without leaving obvious traces in the usual autorun locations.

### The WMI backdoor

Following the WMI trail leads to the actual backdoor script. The attacker placed a file called **WMIBackdoor.ps1** in `C:\TMP`. The script uses **VBScript** as its scripting language within the WMI subscription framework.

![The WMIBackdoor VBScript content showing the event subscription code that establishes persistence through WMI.](/writeups/thm-investigating-windows-2/06-wmibackdoor-vbscript.png)

One of the key pieces inside this backdoor is a WQL (WMI Query Language) query that watches for a specific process to start:

```
SELECT * FROM Win32_ProcessStartTrace WHERE ProcessName = 'procexp64.exe'
```

This is clever — the backdoor triggers whenever someone launches Process Explorer (`procexp64.exe`), which is exactly the tool an investigator would use to look at running processes. The attacker booby-trapped the investigation tool itself.

Decoding the Base64-encoded payload within the script reveals more about what it does:

![Base64 decoder output showing the decoded contents of the WMIBackdoor payload.](/writeups/thm-investigating-windows-2/07-wmibackdoor-base64decoder.png)

The script also references another function called **LaunchBeaconingBackdoor** — a second script within the same backdoor framework that handles command-and-control communication.

Looking up the decoded content online traces it back to a known GitHub repository:

![GitHub page showing the WMIBackdoor project that matches the script found on the compromised machine.](/writeups/thm-investigating-windows-2/08-wmibackdoor-github.png)

The software publisher listed in the decoded binary content is **Motobit Software**, and the associated websites are `http://www.motobit.com` and `http://Motobit.cz`. These are legitimate sites — the attacker embedded a legitimate encoding library (from Motobit) inside the malicious script to handle the Base64 operations.

---

## Live process analysis

### Process Monitor

To see what's actually running and how processes interact, I fired up **Process Monitor** (ProcMon). Filtering for the suspicious binaries revealed two key processes: **mim.exe** and **powershell.exe**, both spawned by **svchost.exe** as their parent process.

![Process Monitor showing mim.exe and powershell.exe processes with their parent-child relationships.](/writeups/thm-investigating-windows-2/09-procmon-processes.png)

The first operation recorded for these processes was **Process Start** — ProcMon captured the exact moment they were spawned.

Clicking into the **Event Properties** dialog for one of these events shows useful forensic detail. The Event tab provides the **Parent PID**, the full **command line** used to launch the process, the **current directory** it ran from, and the **environment** variables in effect at the time.

![Process Monitor Event Properties dialog showing the Parent PID, command line, current directory, and environment details for a captured process event.](/writeups/thm-investigating-windows-2/10-procmon-event-properties.png)

### Process Hacker

I tried switching to **Process Hacker** for a different view of the running processes, but the tool crashed immediately — "Process Hacker has stopped working."

![Process Hacker crash dialog on EC2AMAZ-I8UHO76, showing "A problem caused the program to stop working correctly."](/writeups/thm-investigating-windows-2/11-process-hacker-crash.png)

This crash is not a coincidence. Remember the WMI backdoor's WQL query that watches for `procexp64.exe`? The attacker likely has similar trip-wires for other analysis tools. My machine crashed Process Hacker before I could identify which process was performing disk activity, so that particular question went unanswered — the attacker's anti-forensics worked as intended.

---

## Deep dive with Loki

### Module sequence

Watching Loki's startup sequence, the module that runs right after **Init** (initialization) is **WMIScan** — Loki checks for WMI persistence before it even starts scanning files on disk.

![Loki output showing the Init phase completing and the WMIScan module starting immediately after.](/writeups/thm-investigating-windows-2/12-loki-init-wmiscan.png)

### WMI persistence details

The WMIScan module pulls out the specifics of the WMI event subscriptions. The EventFilter name is **ProcessStartTrigger**, and the WMI class binding it to a consumer is **__FilterToConsumerBinding**.

![Loki WMI persistence scan showing ProcessStartTrigger EventFilter and the __FilterToConsumerBinding class linking it to an ActiveScriptEventConsumer.](/writeups/thm-investigating-windows-2/13-loki-wmi-persistence-detail.png)

This is the full persistence chain: an `__EventFilter` (ProcessStartTrigger) watches for a system event, a `__FilterToConsumerBinding` links that filter to an `ActiveScriptEventConsumer`, and the consumer executes the malicious script whenever the trigger fires. It's a textbook WMI persistence setup.

---

## Binary identification

### Loki file scan results

Once Loki moves past WMI and into file scanning, it flags several binaries:

The binary that triggers a FIRST_BYTES alert (matching the magic bytes `4d5a90...`, the MZ header for a PE executable) is **nbtscan.exe**. Loki's description for this detection falls under **Known Bad / Dual use classics** — tools that are legitimate but commonly abused by attackers for reconnaissance or lateral movement.

Another binary flagged as an **APT Cloaked** file is **p.exe**. Loki matches it against **psexesvc.exe**, the service component of **Sysinternals PsExec**. The attacker renamed it to `p.exe` to avoid casual detection — a single-letter filename for a remote execution tool.

The binary associated with a Windows dump file (`somethingwindows.dmp`) traces back to **schtasks-backdoor.ps1** — another persistence script, this time using the Windows Task Scheduler command-line interface.

An encrypted binary flagged as a trojan is **xCmd.exe** — a remote command execution tool similar to PsExec but from a different developer.

Then there's the masquerading binary: **C:\Users\Public\svchost.exe**. The legitimate `svchost.exe` lives in `C:\Windows\System32` — finding one in `C:\Users\Public` is a dead giveaway. The attacker named their tool after a critical Windows process to hide in plain sight among task manager entries.

### CACTUSTORCH and the hacktool file

Loki also flags a JavaScript file with a YARA rule match. The hacktool file is **en-US.js**, and the matching YARA rule is **CACTUSTORCH** — a known framework for delivering shellcode via script-based execution (JavaScript, VBScript, or VBA).

![Loki scan results showing the CACTUSTORCH YARA match on en-US.js, flagging it as a known hacktool.](/writeups/thm-investigating-windows-2/14-loki-cactustorch-enusjs.png)

The filename `en-US.js` is deliberately innocuous — it looks like a localization file, the kind of thing you'd find in any application's language resources folder.

---

## What Loki missed — custom YARA and strings

### Writing custom YARA rules

Loki is good, but it doesn't catch everything. The binary it missed is **mim.exe** — the renamed mimikatz. To catch it, I needed to write a custom YARA rule targeting strings unique to mimikatz.

![Notepad showing custom YARA rule content designed to detect mimikatz-specific strings in binary files.](/writeups/thm-investigating-windows-2/15-yara-rules-notepad.png)

### Strings analysis

The `strings.exe` utility (another Sysinternals tool) extracts readable ASCII and Unicode strings from binary files. Running it against `mim.exe` confirms what it really is:

![strings.exe usage showing the command-line help and syntax for extracting strings from binary files.](/writeups/thm-investigating-windows-2/16-strings-exe-usage.png)

Running `strings.exe mim.exe | findstr` with targeted search terms pulls out the evidence. The YARA rule strings that match inside `mim.exe` include **mk.ps1** and **mk.exe** — references to mimikatz-related scripts and executables embedded in the binary. The version string **v2.0.50727** (the .NET Framework version the binary was compiled against) is also present in the strings output.

---

## What I took from this

The biggest takeaway from this room is that attackers layer their persistence. They don't rely on a single mechanism — this box had scheduled tasks, registry logon scripts, and WMI event subscriptions all running simultaneously. If a defender finds and removes one, the others keep the attacker's access alive. The WMI persistence was the most sophisticated: it's invisible to basic autoruns checks, triggers on investigator behavior (launching Process Explorer), and uses legitimate encoding libraries to avoid simple signature detection. The other lesson is about tooling — Loki caught most of the malicious binaries through its built-in YARA rules and hash databases, but it missed the renamed mimikatz. No single scanner covers everything, which is why combining automated tools with manual analysis (custom YARA rules, strings extraction) is the standard approach in real incident response work.
