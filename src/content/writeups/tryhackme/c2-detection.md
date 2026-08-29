---
title: 'C2 Detection'
target: 'TryHackMe — C2 Detection'
difficulty: 'easy'
date: 2025-08-28
summary: 'A blue-team exercise using RITA (Real Intelligence Threat Analytics) to detect command and control traffic in network captures. PCAPs are converted to Zeek logs, imported into RITA for automated beacon detection, and the results are analyzed through RITA''s TUI — examining beacon scores, connection durations, rare signatures, prevalence metrics, and non-standard ports to identify AsyncRAT C2 infrastructure and a fictional malhare.net threat actor.'
role: 'soc'
tags: ['rita', 'zeek', 'c2-detection', 'beacon-analysis', 'network-forensics', 'threat-hunting', 'pcap', 'blue-team']
problem: 'Network traffic captures from a monitored environment need to be analyzed for command and control communication patterns. The raw PCAPs must be converted into a format suitable for automated analysis, and the results must be interpreted to identify C2 beacons, suspicious long connections, non-standard ports, and known indicators of compromise across multiple threat actor destinations.'
action: 'Converted PCAPs to Zeek logs using the zeek readpcap command, imported the structured logs into RITA for automated analysis, navigated RITA''s terminal interface to examine beacon scores and connection metadata, identified a malicious Cloudflare tunnel domain and a known-bad IP through VirusTotal cross-referencing, analyzed threat modifiers including rare signatures and prevalence metrics, and used RITA''s search filters to query specific destinations by beacon score and connection duration for the challenge questions.'
outcome: 'Identified two C2 indicators in the AsyncRAT dataset — a trycloudflare.com tunnel domain and a flagged IP on non-standard ports — and completed the challenge PCAP analysis against malhare.net infrastructure, answering all questions on host prevalence, connection counts, search filter syntax, and port usage.'
draft: false
---

## Background

This room is a guided introduction to **RITA** — Real Intelligence Threat Analytics, an open-source framework by Active Countermeasures designed to detect command and control communication in network traffic. The workflow is straightforward: capture network traffic as a PCAP, convert it to Zeek logs (structured network metadata), import those logs into RITA, and let its analytics modules flag suspicious patterns like periodic beaconing, long connections, DNS tunneling, and data exfiltration. The room walks through this pipeline with a real-world AsyncRAT sample before handing over a challenge PCAP to analyze independently.

For anyone coming from a penetration testing background, this is the other side of the coin — instead of establishing C2 and evading detection, the job here is to spot the patterns that C2 traffic inevitably creates, even when the payload is encrypted and the infrastructure is rotating.

---

## Setting up — PCAP to Zeek to RITA

### Converting PCAPs to Zeek logs

Zeek (formerly Bro) is a network security monitor that converts raw packet captures into structured, enriched logs. RITA only accepts Zeek logs as input, so the first step is always conversion. The VM comes with PCAPs in `~/pcaps/` and a `~/zeek_logs/` directory ready for output:

```
zeek readpcap pcaps/AsyncRAT.pcap zeek_logs/asyncrat
```

This produces a set of structured logs in `~/zeek_logs/asyncrat/` — `conn.log`, `dns.log`, `http.log`, `ssl.log`, `x509.log`, and others. Each log type covers a different protocol layer, though for RITA's purposes the tool handles the correlation internally. The log names are self-descriptive: `conn.log` tracks all connections, `dns.log` captures DNS queries and responses, `ssl.log` records TLS handshake details, and so on.

### Importing into RITA

With the Zeek logs ready, importing them into RITA creates an analyzed database:

```
rita import --logs ~/zeek_logs/asyncrat/ --database asyncrat
```

RITA parses each log file, correlates the data across connection records, and runs its analysis modules — beacon detection, DNS tunneling checks, long connection flagging, threat intel lookups, and prevalence scoring. The output is a structured database that can be queried through RITA's terminal interface.

### Viewing the results

```
rita view asyncrat
```

This opens RITA's TUI (terminal user interface), which has three main elements: a search bar at the top, a results pane showing all analyzed connections, and a details pane on the right showing metadata for the selected entry.

![RITA results view — two entries visible in the results pane. Source 10.3.14.101 connecting to sunshine-bizrate-inc-software (truncated Cloudflare domain) with 12.90% beacon score and 2m49s duration, and to 91.134.150.150 with 22.90% beacon score and 15m29s duration. Both show severity None, 0 subdomains, and no threat intel hits. The details pane on the right shows SRC 10.3.14.101, DST 91.134.150... with prevalence 1/2 (50%), first seen 0 minutes ago, connection count 5, total bytes 1.52 MiB, and ports 7000:tcp and 3232:tcp:ssl.](/writeups/thm-c2-detection/01-rita-results-overview.png)

The results pane shows two connections from the internal host `10.3.14.101` — one to a long Cloudflare tunnel domain and one to a raw IP. The details pane for the selected entry (the IP `91.134.150.150`) shows connection metadata: 5 connections, 1.52 MiB total, communicating over non-standard ports 7000/tcp and 3232/tcp with SSL.

---

## Understanding RITA's interface

### The search utility

Pressing `/` activates the search bar. Entering `?` while in search mode brings up the full reference for search fields and syntax:

![RITA search help — left side shows search examples including filter by column (severity:high, src:192.168.5.2, beacon:>80, threat_intel:true, duration:2h45m) and sort by column (sort:severity-asc, sort:beacon-desc). Right side shows supported search fields table: Severity (critical/high/medium/low), Source (src, IP address), Destination (dst, IP or FQDN), Beacon Score (beacon, whole number with comparison operators), Duration (duration, string like 2h45m), Subdomains (subdomains, whole number), Threat Intel (threat_intel, true/false). Bottom shows example combining multiple criteria: src:192.168.88.2 dst:165.225.88.16 beacon:>=90 sort:duration-desc.](/writeups/thm-c2-detection/02-rita-search-help.png)

The search supports filtering by severity level, source/destination IP or FQDN, beacon score with comparison operators, connection duration, subdomain count, and threat intel matches. Multiple filters can be combined in a single query, and results can be sorted by any column in ascending or descending order. This becomes essential for the challenge section where specific queries need to be constructed.

### The details pane — threat modifiers and connection info

Selecting an entry in the results pane populates the details pane with two categories of information.

**Threat Modifiers** are the criteria RITA uses to calculate severity: MIME type/URI mismatches (HTTP header doesn't match the requested resource), rare signatures (unusual TLS handshake patterns or user agent strings), prevalence (percentage of internal hosts talking to this destination — low prevalence is more suspicious), first seen timestamp, missing host headers, large outgoing data volumes, and absence of direct connections.

**Connection Info** covers the raw metadata: connection count (high counts suggest beaconing), total bytes transferred (high values suggest exfiltration), and port/protocol/service details (non-standard ports and lack of SSL warrant investigation).

---

## Analyzing the AsyncRAT sample

### The Cloudflare tunnel domain

Selecting the first entry reveals its full destination: `sunshine-bizrate-inc-software.trycloudflare.com`.

![RITA details for the Cloudflare tunnel entry — SRC 10.3.14.101, DST sunshine-bizrate-inc-software.trycloudflare.com. Prevalence 2/2 (100%), first seen 1 minute ago, rare signature 3c293bdf2a25c07559b560ba86debc77, connection count 5, total bytes 39.13 MiB, port 443:tcp:ssl.](/writeups/thm-c2-detection/03-rita-cloudflare-details.png)

Several things stand out here. The domain itself is a dead giveaway — `trycloudflare.com` is Cloudflare's free tunnel service, which attackers frequently abuse to proxy C2 traffic through legitimate infrastructure. The domain name `sunshine-bizrate-inc-software` is the kind of randomly generated string that tunnel services produce. A quick search on VirusTotal confirms the domain is flagged as malicious.

![Close-up of the RITA details pane — same entry showing SRC 10.3.14.101, DST sunshine-bizrate-inc-software.trycloudflare.com, prevalence 2/2 (100%), first seen 1 minute ago, rare signature hash, connection count 5, total bytes 39.13 MiB, port 443:tcp:ssl.](/writeups/thm-c2-detection/04-rita-cloudflare-details-close.png)

RITA flagged this connection with the **rare signature** threat modifier, meaning the TLS handshake parameters for this connection are unusual compared to the rest of the network's HTTPS traffic. This is a common tell for malware C2 — even when the traffic is encrypted over port 443 with valid SSL, the TLS fingerprint (certificate details, cipher suites, extensions) often differs from what legitimate browsers produce. Tools like JA3/JA3S fingerprinting exploit exactly this pattern.

The connection metadata shows 39.13 MiB of data transferred over 5 connections on port 443 with SSL — the volume is notable for what should be a brief interaction with a Cloudflare tunnel endpoint.

### The raw IP entry

The second entry, `91.134.150.150`, is equally suspicious. VirusTotal flags the IP as malicious. The connection details show non-standard ports (7000/tcp and 3232/tcp with SSL), a 15-minute connection duration, and a 22.90% beacon score. Non-standard ports combined with long connection durations are classic C2 indicators — legitimate services rarely maintain persistent connections on obscure ports.

---

## Challenge — hunting malhare.net

The room provides a second PCAP (`~/pcaps/rita_challenge.pcap`) for independent analysis. The workflow is identical: convert with Zeek, import into RITA, and query the results.

```
zeek readpcap pcaps/rita_challenge.pcap zeek_logs/rita_challenge
rita import --logs ~/zeek_logs/rita_challenge/ --database rita_challenge
rita view rita_challenge
```

The challenge questions target a fictional threat actor operating from `malhare.net` infrastructure:

**How many hosts are communicating with malhare.net?** Selecting the `malhare.net` entries and checking the prevalence metric in the details pane shows the answer: **6** internal hosts.

**Which Threat Modifier tells us the number of hosts communicating to a certain destination?** That's **prevalence** — it shows the ratio of internal hosts connecting to a given external destination out of the total internal host count.

**What is the highest number of connections to rabbithole.malhare.net?** Filtering for `rabbithole.malhare.net` and examining the connection count across all source hosts, the highest value is **40** connections.

**Which search filter would you use to search for all entries that communicate to rabbithole.malhare.net with a beacon score greater than 70% and sorted by connection duration (descending)?** Following the search syntax from the help page:

```
dst:rabbithole.malhare.net beacon:>=70 sort:duration-desc
```

**Which port did the host 10.0.0.13 use to connect to rabbithole.malhare.net?** Filtering for `src:10.0.0.13 dst:rabbithole.malhare.net` and checking the connection info reveals port **80**.

---

## What I took from this

RITA fills a specific gap in the blue-team toolkit: the space between raw packet captures and actionable intelligence about C2 activity. The individual indicators it surfaces — beacon scores, connection durations, rare TLS signatures, prevalence metrics — aren't revolutionary on their own. Any analyst could manually grep through Zeek logs for long connections or periodic intervals. What RITA does is automate the correlation and present it in a format where patterns jump out immediately. Two entries in the AsyncRAT analysis, and both were confirmed malicious within seconds of looking at them.

The beacon detection is the most interesting module conceptually. C2 frameworks need to check in periodically — that's what makes them command and control rather than one-shot payloads. But periodicity creates a statistical fingerprint: regular intervals between connections, consistent data volumes per check-in, and stable connection durations. Even with jitter (randomized delays that C2 frameworks add to avoid detection), the underlying pattern is detectable with enough data points. The AsyncRAT sample had relatively low beacon scores (12.9% and 22.9%), which makes sense for a small dataset — beacon detection improves with larger capture windows because the statistical confidence increases.

The Cloudflare tunnel abuse is worth noting as a trend. Legitimate tunnel services — Cloudflare, ngrok, and similar — give attackers free, encrypted, CDN-fronted infrastructure that doesn't require registering domains or maintaining servers. The traffic goes to a trusted CDN IP, uses valid certificates, and runs on standard ports. Traditional blocklist approaches struggle with this because blocking `trycloudflare.com` breaks legitimate use. RITA's approach — flagging the connection based on its TLS fingerprint and behavioural characteristics rather than just the destination — is a more sustainable detection strategy for this kind of infrastructure abuse.
