---
title: 'Masterminds'
target: 'TryHackMe — Masterminds'
difficulty: 'medium'
date: 2025-01-15
summary: 'Incident-response triage of three compromised workstations at Pfeffer PLC using Brim (Zui) to analyse pcap traffic, identify C2 infrastructure, and attribute each infection to a known malware family.'
role: 'soc'
tags: ['brim', 'zui', 'pcap', 'network-forensics', 'emotet', 'redline-stealer', 'phorphiex', 'incident-response', 'virustotal', 'urlhaus']
problem: 'Three machines on the same corporate network were compromised within a short window. The SOC team has packet captures from each host and needs to determine how the infections started, what the attackers downloaded, and which malware families are involved — fast enough to contain the spread.'
action: 'Loaded all three pcaps into Brim, used its Zeek-based query language to isolate unique connections, rank traffic by volume, enumerate DNS lookups, and extract HTTP request details. Cross-referenced suspicious domains and IPs against VirusTotal and URLhaus to fingerprint the malware families.'
outcome: 'Attributed Infection 1 to Emotet (via phishing redirectors and a dropped executable), Infection 2 to RedLine Stealer (binary pulled from a known distribution domain), and Infection 3 to the Phorphiex/Trik worm (bulk binary downloads from a Russian C2). Documented full IOC chains for each case.'
draft: false
---

## Environment & tooling

The room provides three packet captures — `Infection1.pcap`, `Infection2.pcap`, and `Infection3.pcapng` — representing traffic from three compromised machines at **Pfeffer PLC**. The scenario says the initial compromise came through phishing and an infected USB drive; our job is to figure out exactly what happened on each host.

The primary tool is **Brim** (now called Zui), a desktop app that indexes pcaps using Zeek and lets you query the resulting logs with a pipeline syntax similar to `zq`. I also used VirusTotal and URLhaus for threat-intel lookups.

---

## Infection 1 — Emotet dropper

### Mapping the connections

Opening `Infection1.pcap` in Brim and running the **Unique Network Connections** query immediately shows the victim IP:

```
_path="conn" | cut id.orig_h, id.resp_p, id.resp_h | sort | uniq
```

![Unique connections from Infection1.pcap — the victim is 192.168.75.249, reaching out on ports 53, 67, 80, 137, and more.](/writeups/thm-masterminds/01-infection1-unique-connections.png)

The victim is **192.168.75.249**. Every outbound connection originates from this host. There are multiple port-80 connections to external IPs, which is where the interesting traffic will be.

### Ranking by volume

To find which connections moved the most data I added `total_bytes` as a computed field and sorted descending:

```
_path="conn" | put total_bytes := orig_bytes + resp_bytes | sort -r total_bytes | cut uid, id, orig_bytes, resp_bytes, total_bytes
```

![Connections sorted by total_bytes — 160.153.253.42 tops the list at 47,019 bytes.](/writeups/thm-masterminds/02-infection1-total-bytes-sorted.png)

The largest transfer went to **160.153.253.42** on port 80 — about 47 KB of response data. The next one, **151.106.5.57**, transferred roughly 29.5 KB. Both are worth investigating.

### DNS queries

Counting DNS queries by domain reveals where the host was trying to resolve:

```
_path="dns" | count() by query | sort -r
```

![DNS query counts — CAB.MYKFN.COM leads with 6, IE-BEST.NET with 3, then a long tail of single-query domains.](/writeups/thm-masterminds/03-infection1-dns-query-counts.png)

**cab.mykfn.com** dominates with 6 queries (plus 1 for the lowercase variant, totalling **7**). The remaining domains each appear once or twice — several of them will show up in the HTTP logs next.

### HTTP requests and the redirect chain

Extracting HTTP traffic shows the full picture of what the victim's browser was hitting:

```
_path="http" | cut id.orig_h, id.resp_h, id.resp_p, method, host, uri | uniq -c
```

![HTTP requests — GETs to cambiasuhistoria.growlab.es, www.letscompareonline.com, ww25.gocphongthe.com, gocphongthe.com, vanddnabhargave.com, bhaktivrind.com, and hdmilg.xyz.](/writeups/thm-masterminds/04-infection1-http-requests.png)

Two of these domains returned **404** errors: `cambiasuhistoria.growlab.es` and `www.letscompareonline.com`. The successful download came from **ww25.gocphongthe.com** at IP **199.59.242.153**, which returned a response body of 1,309 bytes.

The URI on `bhaktivrind.com` was `/cgi-bin/JBbb8/` — a callback path typical of Emotet's infrastructure.

At the bottom of the list, the host at **185.239.243.112** served `hdmilg.xyz/catzx.exe` — that is the dropped executable, **catzx.exe**.

### Attribution

Searching VirusTotal for `cambiasuhistoria.growlab.es` confirms the link:

![VirusTotal — 8/88 vendors flag the domain as malicious. Community comments from tines_bot tag it #emotet, referencing Weekend Emotet IOCs from January 2021.](/writeups/thm-masterminds/05-virustotal-emotet-domain.png)

8 out of 88 security vendors flagged this domain, and the community comments tag it **#emotet** with references to Emotet Epoch 2 IOCs. The malware behind Infection 1 is **Emotet**.

---

## Infection 2 — RedLine Stealer

### Mapping the connections

Switching to `Infection2.pcap` and running the same Unique Network Connections query:

```
_path="conn" | cut id.orig_h, id.resp_p, id.resp_h | sort | uniq
```

![Unique connections from Infection2.pcap — the victim is 192.168.75.146, connecting to 5.181.156.252, 45.95.203.28, 168.61.215.74, and others.](/writeups/thm-masterminds/06-infection2-unique-connections.png)

The victim here is **192.168.75.146**. Two external IPs stand out on port 80: `5.181.156.252` and `45.95.203.28`.

### HTTP requests and the binary download

Filtering for HTTP traffic and extracting the server-side details:

```
_path="http" | cut id.resp_h, host, uri, mime_type | uniq
```

![HTTP requests — two entries: 5.181.156.252 serving root (/), and 45.95.203.28 serving hypercustom.top at /jollion/apines.exe.](/writeups/thm-masterminds/07-infection2-http-requests.png)

The victim made **POST** requests to **5.181.156.252** (3 connections total — likely beaconing or exfiltration). Then it pulled a binary from **hypercustom.top** at URI `/jollion/apines.exe`, hosted on IP **45.95.203.28**.

The Suricata alerts in this capture fire on connections between the victim (**192.168.75.146**) and **45.95.203.28**.

### Attribution

Searching URLhaus for `hypercustom.top` identifies the threat:

![URLhaus results for hypercustom.top — multiple entries tagged RedLineStealer, including /jollion/apines.exe, /jollion/apines1.exe, /jollion/lipster.exe, and /holler/rollerkind.exe.](/writeups/thm-masterminds/08-urlhaus-redline-stealer.png)

Every binary served from this domain is tagged **RedLineStealer**. The malware behind Infection 2 is **RedLine Stealer** — an infostealer that harvests credentials, browser data, and cryptocurrency wallets.

---

## Infection 3 — Phorphiex worm

### Mapping the connections

`Infection3.pcapng` is the largest capture at 296 KB / 11 minutes. The Unique Network Connections query:

```
_path="conn" | cut id.orig_h, id.resp_p, id.resp_h | sort | uniq
```

![Unique connections from Infection3.pcapng — two internal hosts visible: 192.168.75.232 and 192.168.75.133, both reaching 192.168.75.2 on ports 3, 53, and others.](/writeups/thm-masterminds/09-infection3-unique-connections.png)

This capture has two internal hosts: **192.168.75.232** and **192.168.75.133**. The bulk of the traffic flows through the local DNS resolver at 192.168.75.2.

### DNS activity

Filtering DNS for the main C2 domain:

```
_path="dns" | count() by query | sort -r | efhoahegue.ru
```

![DNS count for efhoahegue.ru — 2 queries.](/writeups/thm-masterminds/10-infection3-dns-efhoahegue.png)

There are **2** DNS queries for `efhoahegue.ru`. The room also asks about related C2 domains — listed from earliest to latest they are: **efhoahegue.ru**, **afhoahegue.ru**, and **xfhoahegue.ru**, resolving to IPs **162.217.98.146**, **199.21.76.77**, and **63.251.106.25** respectively.

### HTTP downloads and the bulk binary pull

Filtering HTTP traffic for the C2 domain shows a clear pattern:

```
_path="http" | efhoahegue.ru | cut uri, user_agent | uniq -c
```

![HTTP requests to efhoahegue.ru — URIs /s/5.exe, /s/4.exe, /s/3.exe, /s/2.exe, /s/1.exe, and /s/VNEW=1, all with the same spoofed user-agent string.](/writeups/thm-masterminds/11-infection3-http-downloads.png)

The victim downloaded **5** binaries from efhoahegue.ru: `/s/5.exe` through `/s/1.exe`, plus a check-in at `/s/VNEW=1`. Every request used the same spoofed user-agent:

```
Mozilla/5.0 (Macintosh; Intel Mac OS X 10.9; rv:25.0) Gecko/20100101 Firefox/25.0
```

That Macintosh user-agent on a Windows corporate network is a dead giveaway — the malware is impersonating a legitimate browser.

The total DNS connection count across the entire capture is **986**, reflecting the worm's aggressive scanning behaviour.

### Attribution

Googling `"efhoahegue"` ties it all together:

![Google results for "efhoahegue" — Triage behavioral report and AppRiver blog post about Phorphiex/Trik Botnet Campaign Leads to Multiple Infections.](/writeups/thm-masterminds/12-google-phorphiex-botnet.png)

The AppRiver blog post title says it plainly: **Phorphiex/Trik Botnet Campaign Leads to Multiple Infections**. The Triage sandbox report confirms `efhoahegue.ru/s/VNEW=1` as a known Phorphiex callback. The malware behind Infection 3 is **Phorphiex** (also known as Trik).

---

## What I took from this

The biggest lesson here was how much mileage you get from a handful of Brim queries applied consistently across captures. The same four-query workflow — unique connections, sort by volume, DNS counts, HTTP extraction — gave me enough to identify the victim, trace the kill chain, and narrow down the malware family in each case. The actual attribution step was almost anticlimactic: once you have a suspicious domain or binary name, a single lookup on VirusTotal or URLhaus usually closes the loop. The skill is in getting to that one IOC efficiently.
