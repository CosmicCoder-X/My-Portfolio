---
title: 'Event Viewing'
target: 'picoCTF — Event Viewing'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Forensics challenge where three base64-encoded flag fragments were hidden across Windows Event Log entries — an MsiInstaller event (1033), a registry modification event (4657), and a shutdown event (1074) — and decoding all three pieces reconstructed the flag."
role: 'forensics'
tags: ['forensics', 'windows', 'event-logs', 'evtx', 'base64', 'picoctf']
problem: "A Windows .evtx event log file capturing a suspicious sequence: software was installed, the software ran and appeared to do nothing, and now the computer shuts down immediately after every login. The flag is split into three pieces across the log entries for each of these events."
action: "Opened the .evtx file in Windows Event Viewer, filtered by Event ID 1033 (MsiInstaller) to find the installation event with the first flag fragment in the Manufacturer field, Event ID 4657 (registry audit) to find a Run key persistence mechanism with the second fragment in the Object Value Name, and Event ID 1074 (User32 shutdown) to find the forced shutdown with the third fragment in the Comment field. Decoded each base64 fragment and concatenated them."
outcome: 'Decoded all three base64 fragments from the event log entries and assembled the complete flag.'
draft: false
---

## Background

Event Viewing is a picoCTF Forensics challenge about Windows Event Log analysis. The challenge provides an `.evtx` file — the Windows XML Event Log format introduced in Windows Vista — and describes a scenario where someone installed software from the internet, ran it (and it appeared to do nothing), and now every time they boot and log in, a black command prompt flashes open and the computer shuts down instantly. The task is to find evidence of each of these three events in the logs and retrieve the flag, which is split into three pieces across the corresponding log entries.

The three events mapped directly to specific Windows Event IDs: software installation is logged by MsiInstaller as Event ID 1033, registry changes (specifically the persistence mechanism) are logged as Event ID 4657 in the Security log, and system shutdowns are logged by User32 as Event ID 1074 in the System log.

---

## Part 1: The installation — Event ID 1033

Filtering the event log for Event ID 1033 (MsiInstaller) revealed the software installation event:

![Windows Event Properties dialog for Event 1033, MsiInstaller. The description reads "Windows Installer installed the product. Product Name: Totally_Legit_Software. Product Version: 1.3.3.7. Product Language: 0. Manufacturer: cGljb0NURntFdjNudF92aTN3djNyXw==. Installation success or error status: 0." The Log Name is Application, Source is MsiInstaller, Logged date is 15/7/2024 11:55:57 PM, Level is Information, and Computer is DESKTOP-EKVR84B.](/writeups/picoctf-event-viewing/01.png)

The product name — `Totally_Legit_Software` — was an obvious red flag. The version number `1.3.3.7` (leet for "LEET") reinforced this. The Manufacturer field contained the first base64 fragment: `cGljb0NURntFdjNudF92aTN3djNyXw==`.

Decoding it: `picoCTF{Ev3nt_vi3wv3r_`

---

## Part 2: The persistence mechanism — Event ID 4657

The scenario described a program that runs on every boot — the classic behavior of a Run key persistence mechanism. Event ID 4657 logs registry value modifications in the Security log when object access auditing is enabled. Filtering for this event revealed the registry change:

![Windows Event Properties dialog for Event 4657, Microsoft Windows security auditing. The Object section shows the registry key REGISTRY\MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Run with Object Value Name "Immediate Shutdown" and the value highlighted in blue: MXNfYV9wcjN0dHlfdXMzZnVsXw==. The Operation Type is "New registry value created". Process Information shows the Process Name as C:\Program Files (x86)\Totally_Legit_Software\Totally_Legit_Software.exe. Change Information shows the New Value Type as REG_SZ and New Value as C:\Program Files (x86)\Totally_Legit_Software\custom_shutdown.exe.](/writeups/picoctf-event-viewing/02.png)

This event told the full story of the persistence mechanism. The `Totally_Legit_Software.exe` process (PID 0x1bd0) created a new registry value named "Immediate Shutdown" under `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` — the standard Windows autorun key. The value pointed to `custom_shutdown.exe` in the same installation directory. This is why the computer shut down on every login: Windows executed `custom_shutdown.exe` from the Run key as soon as the user logged in.

The Object Value Name field contained the second base64 fragment: `MXNfYV9wcjN0dHlfdXMzZnVsXw==`.

Decoding it: `1s_a_pr3tty_us3ful_`

---

## Part 3: The shutdown — Event ID 1074

Event ID 1074 is logged by User32 in the System log whenever the system is shut down or restarted, recording which process initiated the shutdown. Filtering for this event revealed the forced shutdown:

![Windows Event Properties dialog for Event 1074, User32. The description reads "The process C:\Windows\system32\shutdown.exe (DESKTOP-EKVR84B) has initiated the shutdown of computer DESKTOP-EKVR84B on behalf of user DESKTOP-EKVR84B\user for the following reason: No title for this reason could be found. Reason Code: 0x800000ff. Shutdown Type: shutdown. Comment: dDAwbF84MWJhM2ZlOX0=" highlighted in blue. The Log Name is System, Logged date is 16/7/2024 1:01:05 AM.](/writeups/picoctf-event-viewing/03.png)

The shutdown was triggered by `shutdown.exe` with a reason code of `0x800000ff` — a custom/undefined reason, consistent with a programmatic shutdown call rather than a user-initiated one. The Comment field contained the third base64 fragment: `dDAwbF84MWJhM2ZlOX0=`.

Decoding it: `t00l_81ba3fe9}`

---

## Assembling the flag

Concatenating the three decoded fragments produced the complete flag:

`picoCTF{Ev3nt_vi3wv3r_1s_a_pr3tty_us3ful_t00l_81ba3fe9}`

---

## What I took from this

This challenge walked through the forensic reconstruction of a malware infection chain using nothing but Windows Event Logs. The three Event IDs corresponded to three distinct phases of a real attack lifecycle: initial access and installation (Event ID 1033 logging the MSI package), persistence establishment (Event ID 4657 recording the Run key modification), and impact (Event ID 1074 documenting the forced shutdown). In real-world incident response, these same Event IDs are critical. Event ID 1033 reveals what software was installed and when. Event ID 4657 — when registry object access auditing is enabled — catches persistence mechanisms being planted in autorun keys, services, scheduled tasks, and other registry locations that attackers commonly target. Event ID 1074 documents unexpected shutdowns or restarts that may indicate ransomware, destructive malware, or an attacker covering their tracks. The challenge also demonstrated a common technique for hiding data in event logs: embedding base64-encoded strings in fields that accept arbitrary text (Manufacturer, value names, shutdown comments). In a real investigation, unusual base64 strings in these fields would be immediate indicators of compromise. The broader lesson is that Windows Event Logs are a rich source of forensic evidence — they record system activity at a level of detail that survives reboots, file deletions, and most anti-forensic techniques, and learning to filter and correlate events by their IDs is an essential skill for anyone doing Windows forensics or SOC analysis.
