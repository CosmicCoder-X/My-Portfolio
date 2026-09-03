---
title: 'Phantom Check'
target: 'Hack The Box — Phantom Check'
difficulty: 'easy'
date: 2026-02-01
summary: 'An HTB Sherlock — analysing PowerShell event logs from DESKTOP-M3AKJSD to reconstruct anti-VM reconnaissance. The attacker queried Win32_ComputerSystem and MSAcpi_ThermalZoneTemperature via WMI, loaded the Nishang Check-VM script to fingerprint hypervisors through registry services and process enumeration, and the script detected both Hyper-V and VMware.'
role: 'soc'
tags: ['powershell', 'event-logs', 'virtualization-detection', 'sandbox-evasion', 'wmi', 'nishang', 'registry', 'hyper-v', 'vmware', 'virtualbox', 'anti-analysis', 'dfir', 'evtx', 'sherlock', 'operation-blackout']
problem: 'Two PowerShell event log files from a workstation where a threat actor performed anti-VM checks. Requires identifying WMI classes used for hardware fingerprinting, the VM detection script and function name, registry paths for hypervisor service enumeration, VirtualBox detection processes, and which platforms were ultimately detected.'
action: 'Two event logs: Microsoft-Windows-Powershell.evtx (567 events, Event ID 800 pipeline execution) and Windows-Powershell-Operational.evtx (631 events, Event ID 4104 scriptblock text). Searched Event ID 800 for Get-WmiObject -- found Win32_ComputerSystem model query at 14:49:10 and MSAcpi_ThermalZoneTemperature thermal sensor query at 14:50:12. Event ID 4104 scriptblocks revealed the Nishang Check-VM function from samratashok/nishang, which enumerates HKLM:\SYSTEM\ControlSet001\Services for Hyper-V services (vmicheartbeat, vmicvss, vmicshutdown, vmicexchange), VMware services (vmdebug, vmmouse, VMTools, VMMEMCTL), and uses Get-Process to check for VirtualBox processes (vboxservice.exe, vboxtray.exe). Event 800 output at 14:50:57 confirmed detection of both Hyper-V and VMware.'
outcome: 'Reconstructed the full anti-VM reconnaissance chain: WMI hardware fingerprinting, thermal zone detection, and Nishang Check-VM script execution. The script detected both Hyper-V and VMware on DESKTOP-M3AKJSD via registry service enumeration and process checks.'
draft: false
---

## Background

Phantom Check is a Hack The Box Sherlock from the Operation Blackout 2025 series — a guided DFIR investigation focused on how attackers detect virtualised environments to evade sandbox analysis. The scenario involves a compromised workstation where a threat actor ran anti-virtualisation checks, and the evidence comes in the form of two Windows PowerShell event log files. Virtualisation detection is a critical technique in the attacker's toolkit — modern malware analysis almost universally relies on sandboxed virtual machines, so sophisticated malware will check whether it's running inside a VM and alter its behaviour (or refuse to execute entirely) if it detects one. Understanding these detection techniques from the defender's perspective is essential for building sandbox environments that resist fingerprinting and for writing detection rules that flag this kind of reconnaissance when it happens on production systems.

---

## Event log artifacts and initial review

The investigation begins with two event log files extracted from the challenge archive:

**Microsoft-Windows-Powershell.evtx** contains 567 events, primarily Event ID 800 entries recording Pipeline Execution Details. Every time a PowerShell pipeline executes — whether it's a simple cmdlet, a one-liner, or a pipeline chain — Event ID 800 captures the full command line along with execution metadata including the host application path, user context, and the pipeline output. This log is the record of what PowerShell actually ran and what it produced.

**Windows-Powershell-Operational.evtx** contains 631 events, including Event ID 4104 entries that record scriptblock text. Where Event ID 800 captures pipeline execution summaries, Event ID 4104 captures the actual source code of scripts before they execute — every function definition, every conditional block, every variable assignment. When an attacker loads and runs a PowerShell script, 4104 logging preserves the entire script body, making it invaluable for understanding not just what commands ran but the full logic behind them.

Both logs originate from **DESKTOP-M3AKJSD** and are dated 09-04-2025. The events cluster around 14:49 to 14:50, indicating a short, focused reconnaissance session rather than a prolonged operation. The PowerShell host application is `C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe` — the 32-bit version of PowerShell running through the WoW64 subsystem, which is sometimes preferred by attackers because certain offensive tools are compiled for x86.

---

## WMI hardware fingerprinting

The first line of investigation targets WMI (Windows Management Instrumentation) queries — one of the most common methods attackers use to fingerprint whether a system is physical or virtual. WMI exposes a vast amount of system information through standardised classes, and several of those classes return values that differ predictably between physical and virtual machines. Opening the Microsoft-Windows-Powershell log and searching for `Get-WmiObject` — the standard PowerShell cmdlet for querying WMI — immediately surfaces the attacker's reconnaissance.

The first hit appears at 14:49:10 in an Event 800 entry. The pipeline execution details show the command:

```powershell
$Model = Get-WmiObject -Class Win32_ComputerSystem | select-object -expandproperty "Model"
```

The **Win32_ComputerSystem** WMI class is the primary source of system identity information — it returns the computer's manufacturer, model, domain, total physical memory, and number of processors. The attacker is specifically extracting the Model property because virtual machines report distinctive model strings that immediately reveal their hypervisor. A Hyper-V guest reports "Virtual Machine," a VMware guest reports "VMware Virtual Platform" or "VMware7,1," and a VirtualBox guest reports "VirtualBox." A physical machine reports the actual hardware model from the BIOS, like "ThinkPad T14s" or "PowerEdge R740." One WMI query, one property, and the attacker knows exactly what they're dealing with.

![Event Viewer showing Microsoft-Windows-Powershell log with 567 events. A Find dialog searches for "Get-WmiObject". The selected Event 800 at 14:49:10 shows Pipeline execution details for command line: $Model = Get-WmiObject -Class Win32_ComputerSystem |select-object -expandproperty "Model" with Win32_ComputerSystem highlighted in green. Context Information shows DetailSequence=1. Computer is DESKTOP-M3AKJSD.](/writeups/htb-phantom-check/01.png)

Continuing the search for `Get-WmiObject` reveals a second, more subtle query at 14:50:12:

```powershell
Get-WmiObject -Query "SELECT * FROM MSAcpi_ThermalZoneTemperature" -ErrorAction SilentlyContinue
```

This is a cleverer detection technique. The **MSAcpi_ThermalZoneTemperature** WMI class queries the ACPI thermal zone — the hardware temperature sensors built into physical motherboards that report CPU and chassis temperatures. Physical machines have these sensors and return real temperature readings. Most virtual machines do not implement thermal zone emulation because there's no physical hardware to measure — the query either fails outright or returns empty results. The `-ErrorAction SilentlyContinue` flag is deliberate: it suppresses error output when the query fails on a VM, allowing the script to use the absence of data as a detection signal without generating conspicuous error messages in the console. If the query returns temperature data, the machine is likely physical; if it returns nothing, it's almost certainly virtual. Additional metadata in this event shows the HostVersion as 5.1.26100.2161 and the HostApplication confirming the SysWOW64 PowerShell path, with SequenceNumber 53 placing it in the sequence of reconnaissance commands.

![Event Viewer showing Microsoft-Windows-Powershell log with Find dialog searching "Get-WmiObject". The selected Event 800 at 14:50:12 shows Pipeline execution details for command line: Get-WmiObject -Query "SELECT * FROM MSAcpi_ThermalZoneTemperature" -ErrorAction SilentlyContinue with the query highlighted in green. Below shows UserId=DESKTOP-M3AKJSD\User, HostName=ConsoleHost, HostVersion=5.1.26100.2161, HostApplication=C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe.](/writeups/htb-phantom-check/02.png)

---

## Identifying the VM detection script

Beyond individual WMI queries, the attacker loaded a complete virtualisation detection script. Switching to the Windows-Powershell-Operational log and filtering for Event ID 4104 — scriptblock logging — reveals the full source code. Event 4104 with Task Category "Execute a Remote Command" at 14:50:53 captures the script header, and the content immediately identifies it as a Nishang framework tool. The synopsis reads: "Nishang script which detects whether it is in a known virtual machine." The description elaborates: "This script uses known parameters or 'fingerprints' of Hyper-V, VMWare, Virtual PC, Virtual Box, Xen and QEMU for detecting the environment."

The example usage line shows `PS > Check-VM`, confirming the function name is **Check-VM**. The script's `.LINK` section points to two URLs — a blog post at `labofapenetrationtester.com` and the GitHub repository at `github.com/samratashok/nishang`. Nishang is a well-known offensive PowerShell framework created by Nikhil "SamratAshok" Mittal, widely used in penetration testing for tasks ranging from privilege escalation to data exfiltration. The Check-VM function is one of its reconnaissance utilities, designed to systematically fingerprint every major hypervisor platform. The fact that the attacker loaded a publicly available pentest framework rather than writing custom detection code is typical — established tools are reliable, well-tested, and faster to deploy than bespoke scripts.

![Event Viewer showing Windows-Powershell-Operational log with 631 events. The selected Event 4104 at 14:50:53 with Level Verbose shows the script header with synopsis "Nishang script which detects whether it is in a known virtual machine", description mentioning fingerprints of Hyper-V, VMWare, Virtual PC, Virtual Box, Xen and QEMU, example usage PS > Check-VM highlighted in green, and links to labofapenetrationtester.com and github.com/samratashok/nishang. Log Name is Microsoft-Windows-PowerShell/Operational, Task Category is Execute a Remote Command, User is S-1-5-21-3999086100-42697.](/writeups/htb-phantom-check/03.png)

---

## Registry-based hypervisor detection

With the script identified, the next step is tracing its detection logic through subsequent Event 4104 entries. Each scriptblock fragment is logged as a separate event, so scrolling through the 4104 entries reveals the Check-VM function's source code in sequence.

The Hyper-V detection block shows the core registry enumeration technique. The script uses:

```powershell
$hyperv = Get-ChildItem HKLM:\SYSTEM\ControlSet001\Services
```

The registry key **HKLM:\SYSTEM\ControlSet001\Services** is the canonical location where Windows stores service registrations — every installed service, driver, and kernel module has a subkey here. The script enumerates all entries under this key and then runs them through a pattern match:

```powershell
if (($hyperv -match "vmicheartbeat") -or ($hyperv -match "vmicvss") -or ($hyperv -match "vmicshutdown") -or ($hyperv -match "vmicexchange"))
```

These four service names — `vmicheartbeat`, `vmicvss`, `vmicshutdown`, and `vmicexchange` — are the Hyper-V Integration Services installed automatically in every Hyper-V guest. vmicheartbeat monitors the guest's health status and reports to the host, vmicvss enables Volume Shadow Copy coordination for consistent backups, vmicshutdown allows the host to gracefully shut down the guest, and vmicexchange handles key-value pair data exchange between host and guest. None of these services exist on physical hardware or under other hypervisors, so their presence is a definitive Hyper-V indicator. If any match is found, `$hypervm` is set to `$true`.

![Event Viewer showing Windows-Powershell-Operational log with Event 4104 at 14:50:53. The script code shows the if ($hypervm) block, then $hyperv = Get-ChildItem HKLM:\SYSTEM\ControlSet001\Services highlighted in green, followed by the conditional checking for vmicheartbeat, vmicvss, vmicshutdown, and vmicexchange matches. If any match, $hypervm is set to $true. Below shows another if ($hypervm) block. Task Category is Execute a Remote Command on DESKTOP-M3AKJSD.](/writeups/htb-phantom-check/04.png)

---

## VirtualBox process detection

The VirtualBox detection takes a different approach from the registry-based hypervisor checks. Instead of looking for services in the registry, the script enumerates running processes:

```powershell
$vb = Get-Process
if (($vb -eq "vboxservice.exe") -or ($vb -match "vboxtray.exe"))
```

The script section is clearly marked with a `#Virtual Box` comment. It uses `Get-Process` to capture a snapshot of all running processes and checks for two specific executables: **vboxservice.exe** and **vboxtray.exe**. VBoxService.exe is the VirtualBox Guest Additions service — a background daemon that handles host-guest integration features including time synchronisation, shared folders, drag-and-drop, and seamless window mode. VBoxTray.exe is the system tray application that manages display auto-resizing and clipboard sharing between host and guest. Both processes are installed by VirtualBox Guest Additions, which are present in virtually every VirtualBox guest used for analysis because analysts need the integration features for practical workflow. If VirtualBox is running without Guest Additions (which would make it harder to use as a sandbox), neither process would be present and this check would fail — but that's an unusual configuration.

The code then continues into a secondary VirtualBox check using registry and ACPI table inspection, with `$vb = Get-ChildItem HKLM:\HARDWARE\ACPI\FADT` looking for entries matching "vbox_" in the firmware tables, providing a fallback detection method that works even without Guest Additions installed.

![Event Viewer showing Windows-Powershell-Operational log with Event 4104 at 14:50:53. The script code shows the section marked #Virtual Box, with $vb = Get-Process followed by the conditional if (($vb -eq "vboxservice.exe") -or ($vb -match "vboxtray.exe")) with both process names highlighted in green boxes. If matched, $vbvm is set to $true. Below shows a secondary check using $vb = Get-ChildItem HKLM:\HARDWARE\ACPI\FADT with a match for "vbox_". Task Category is Execute a Remote Command.](/writeups/htb-phantom-check/05.png)

---

## VMware detection and script output

The VMware detection mirrors the Hyper-V approach, again querying the services registry:

```powershell
$vmware = Get-ChildItem HKLM:\SYSTEM\ControlSet001\Services
if (($vmware -match "vmdebug") -or ($vmware -match "vmmouse") -or ($vmware -match "VMTools") -or ($vmware -match "VMMEMCTL"))
```

The four VMware-specific services are: `vmdebug` (VMware debugging driver), `vmmouse` (VMware mouse driver that enables seamless cursor movement between host and guest), `VMTools` (the VMware Tools service that provides guest-host integration), and `VMMEMCTL` (the VMware memory control driver, also known as the balloon driver, which manages memory allocation between guest and host). Like the Hyper-V integration services, these are VMware-specific components that only exist on VMware guests with VMware Tools installed.

The same Event 4104 entry also reveals the Hyper-V output logic — when `$hypervm` evaluates to true, the script outputs the string "This is a Hyper-V machine." using the standard output pipeline.

![Event Viewer showing Windows-Powershell-Operational log with Event 4104 at 14:50:53. The script code shows the if ($hypervm) block outputting "This is a Hyper-V machine." in green, then the #VMWARE section with $vmware = Get-ChildItem HKLM:\SYSTEM\ControlSet001\Services and the conditional checking for vmdebug, vmmouse, VMTools, and VMMEMCTL matches. If any match, $vmwarevm is set to $true. Task Category is Execute a Remote Command on DESKTOP-M3AKJSD.](/writeups/htb-phantom-check/06.png)

The final piece of evidence comes from the Microsoft-Windows-Powershell log, where Event ID 800 captures the actual pipeline output of the Check-VM script. Searching for "this is a" in the log locates an Event 800 entry at 14:50:57 — seven seconds after the script began executing. The pipeline execution details show the Out-Default commandlet processing two output values:

```
ParameterBinding(Out-Default): name="InputObject"; value="This is a Hyper-V machine."
ParameterBinding(Out-Default): name="InputObject"; value="This is a VMWare machine."
```

The script detected both **Hyper-V** and **VMWare** on DESKTOP-M3AKJSD. Detecting two hypervisors simultaneously is actually common in nested virtualisation scenarios — a VMware workstation running on a Hyper-V host will have both sets of indicators present, as the Hyper-V integration services come from the physical host's hypervisor layer while the VMware services come from the immediate VM environment. The additional event metadata shows the PipelineId as 43, the RunspaceId as 2aeeba59-d0f6-4ce7-b41c-e07625b3beec, and empty ScriptName and CommandLine fields because the output came from the pipeline of the loaded Check-VM function rather than a direct command-line invocation.

![Event Viewer showing Microsoft-Windows-Powershell log with Find dialog searching "this is a". The selected Event 800 at 14:50:57 shows Pipeline execution details with HostVersion=5.1.26100.2161, RunspaceId, PipelineId=43, and empty ScriptName and CommandLine fields. The Details section shows CommandInvocation(Out-Default): "Out-Default" followed by two ParameterBinding entries — InputObject value "This is a Hyper-V machine." with Hyper-V highlighted and InputObject value "This is a VMWare machine." with VMWare highlighted in green. Computer is DESKTOP-M3AKJSD.](/writeups/htb-phantom-check/07.png)

---

## What I took from this

Phantom Check is a short, focused Sherlock, but it covers an important topic that sits at the intersection of offensive and defensive security. Virtualisation detection is one of those techniques that matters in both directions — attackers use it to evade sandboxes, and defenders need to understand it to build resilient analysis environments and write detection rules for this kind of reconnaissance.

The PowerShell event logging was the hero of this investigation. Event ID 800 (Pipeline Execution Details) and Event ID 4104 (Scriptblock Logging) together provided complete visibility into the attacker's activities — not just the commands they ran, but the full source code of the scripts they loaded, the logic branches they followed, and the output they produced. This is exactly why enabling PowerShell scriptblock logging and module logging is one of the highest-value defensive configurations on Windows systems. Without Event ID 4104, the Check-VM script would have been invisible — all that would remain would be the individual WMI queries in Event ID 800, with no context for what framework they came from or what logic connected them.

The detection techniques themselves form a layered approach: WMI queries for hardware fingerprinting (model strings, thermal sensors), registry enumeration for hypervisor-specific services (integration services that are installed automatically and often overlooked by sandbox hardeners), and process enumeration for guest tools (VBoxService, VBoxTray). Each technique has its own strengths and blind spots — WMI model strings are the easiest to spoof in a hardened sandbox, thermal zone queries are harder to fake because they require actually implementing ACPI thermal zone emulation, and service-based detection is reliable but can be defeated by removing guest tools (at the cost of sandbox usability). A comprehensive detection script like Check-VM stacks all of these methods to minimise the chance of a false negative.
