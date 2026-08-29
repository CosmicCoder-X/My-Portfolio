---
title: 'The Shadowed Sigil'
target: 'Hack The Box — The Shadowed Sigil'
difficulty: 'medium'
date: 2025-08-29
summary: 'An OSINT challenge — identifying which APT group is associated with the IP address 139.5.177.205 by searching for the IoC on Google, finding the UK National Cyber Security Centre PDF documenting APT28 malware indicators, and confirming the IP is listed as a C2 server for the X-AGENT (CHOPSTICK) RAT used by APT28.'
role: 'soc'
tags: ['osint', 'threat-intelligence', 'apt', 'ioc', 'ip-address', 'ncsc', 'apt28', 'x-agent', 'c2-infrastructure']
problem: 'The IP address 139.5.177.205 is provided as an indicator of compromise linked to multiple malicious incidents. The task is to identify which APT group operates the infrastructure behind this IP address and submit the group designation as the flag.'
action: 'Searched for the IP address 139.5.177.205 on Google in quotes. The results returned IPinfo pages and a PDF from the UK National Cyber Security Centre (NCSC) titled Indicators of Compromise for Malware used by APT28, hosted at ncsc.gov.uk under the filename NCSC_APT28. Opened the PDF and confirmed the IP 139.5.177.205 is listed on page 2 as a C2 server for X-AGENT (also known as CHOPSTICK), a second-stage modular remote access trojan used by APT28.'
outcome: 'Recovered the flag HTB{APT28} by identifying the IP address as APT28 infrastructure through the NCSC IoC report. The solve required a single Google search and verification against an authoritative government threat intelligence publication.'
draft: false
---

## Background

The Shadowed Sigil is a threat intelligence challenge that provides an IP address and asks which APT group it belongs to. The challenge description wraps this in fantasy language about "malicious sigils" and "dark covens", but the task is a standard IoC attribution exercise — the kind of lookup that happens daily in SOC environments when an analyst needs to determine whether a suspicious IP has known associations with threat actors.

---

## Searching the IoC

Searching for `"139.5.177.205"` on Google returns three results: two IPinfo pages with hosting details (AS55720 Gigabit Hosting Sdn Bhd) and a PDF from the **UK National Cyber Security Centre** (NCSC). The PDF's URL contains `NCSC_APT28` in the filename, and the snippet already lists the IP alongside associated domains — `malaytravelgroup.com`, `worldimagebucket.com`, `fundseats.com`, `globaltechengineers.org`. The title reads "Indicators of Compromise for Malware used by" the APT group in question.

![Google search results for 139.5.177.205 in quotes showing IPinfo pages for the IP address and IP range, and a third result from the National Cyber Security Centre at ncsc.gov.uk with the filename NCSC_APT28, titled Indicators of Compromise for Malware used by the APT group, dated October 4 2018, listing the IP alongside associated domains.](/writeups/htb-shadowed-sigil/01-google-search-ip.png)

---

## Confirming in the NCSC report

Opening the PDF confirms the attribution. Page 2 covers **X-AGENT** (also known as CHOPSTICK) — a second-stage modular remote access trojan that runs on Windows, iOS, and Unix-based systems. Its capabilities include key logging, file extraction, and encrypted C2 communications over SSL/TLS. X-AGENT is commonly deployed after first-stage malware like CORESHELL or GAMEFISH and is used in conjunction with XTUNNEL and CompuTrace/Lojack.

The Indicators of Compromise table lists C2 IP addresses and their associated domains. The IP **139.5.177.205** is the first entry, paired with `malaytravelgroup.com`. The full table includes nine IP addresses and nine domains — all part of the C2 infrastructure attributed to **APT28**.

![Page 2 of the NCSC PDF showing the X-AGENT section describing it as a second-stage modular RAT also known as CHOPSTICK, followed by the Indicators of Compromise table listing C2 IP addresses and domains with 139.5.177.205 highlighted in red as the first entry, paired with malaytravelgroup.com, alongside eight other IP and domain pairs.](/writeups/htb-shadowed-sigil/02-ncsc-pdf-iocs.png)

The flag: **HTB{APT28}**

---

## What I took from this

The challenge is a one-step lookup, but the underlying skill — IoC attribution — is fundamental to threat intelligence work. In a real SOC, an analyst who finds a suspicious IP in firewall logs or SIEM alerts runs exactly this kind of search: checking the IP against public threat intelligence feeds, government advisories, and vendor reports to determine if it's associated with a known threat actor.

The NCSC report is worth noting as a source. Government cyber security agencies — the UK's NCSC, the US CISA, Australia's ACSC — publish detailed IoC reports that attribute specific infrastructure to specific APT groups. These reports are authoritative, freely available, and indexed by search engines. Searching an IP or domain in quotes is often enough to surface them. For deeper attribution work, platforms like VirusTotal, AlienVault OTX, and MITRE ATT&CK provide structured databases of IoCs mapped to threat actors, but for a quick check, a quoted Google search against known APT reporting is the fastest path.
