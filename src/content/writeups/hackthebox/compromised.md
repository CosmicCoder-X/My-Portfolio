---
title: 'Compromised'
target: 'Hack The Box — Compromised'
difficulty: 'easy'
date: 2026-02-10
summary: 'An HTB Sherlock — PCAP analysis of a compromised host using Wireshark, tracing initial access through HTTP payload delivery (Pikabot DLL disguised as image/gif), C2 communications over non-standard ports with self-signed TLS certificates, and DNS tunneling exfiltration via sequential TXT queries to steasteel.net.'
role: 'soc'
tags: ['pcap', 'wireshark', 'network-forensics', 'pikabot', 'malware', 'virustotal', 'tls', 'self-signed-certificate', 'dns-tunneling', 'http-export', 'traffic-analysis', 'dfir', 'sherlock']
problem: 'A PCAP from a SOC environment where an internal machine has been compromised and data stolen. The investigation requires tracing the full attack chain — initial payload delivery, malware identification via VirusTotal, C2 infrastructure mapping through TLS certificate inspection, and discovery of the data exfiltration channel.'
action: 'Opened the PCAP in Wireshark and traced the first TCP SYN from 172.16.1.191 to 162.252.172.54:80, followed by an HTTP GET for /9GQ5A8/6ctf5JL. Exported the HTTP object (1288 kB, claimed image/gif) and submitted its SHA-256 hash to VirusTotal — identified as a Win32 DLL, trojan.pikabot/mikey, first seen in the wild 2023-05-19. Analysed IPv4 Statistics to map C2 infrastructure — multiple external IPs on non-standard ports (2078, 2222, 8080). Inspected the TLS certificate from 45.85.235.39:2078 — fabricated subject fields including localityName Pyopneumopericardium, self-signed with notBefore 2023-05-14. Applied DNS filter and discovered sequential TXT queries to incrementing subdomains of dns.steasteel.net (aaa.h.dns, baa.h.dns, caa.h.dns) — textbook DNS tunneling for data exfiltration.'
outcome: 'Reconstructed the full compromise chain from network evidence: Pikabot DLL delivery via HTTP from 162.252.172.54, C2 over non-standard ports with self-signed TLS certificates (localityName Pyopneumopericardium), and DNS tunneling exfiltration through sequential TXT queries to steasteel.net.'
draft: false
---

## Background

Compromised is a Hack The Box Sherlock — a network forensics investigation built around a single PCAP capture file from a SOC environment. The scenario is straightforward: a machine on the internal network has been compromised and data has been stolen. The evidence is entirely network-level — no disk images, no event logs, no memory dumps. Everything has to be reconstructed from the packets alone, which makes this an exercise in reading traffic patterns, correlating indicators across protocols, and understanding how modern malware communicates once it lands on a host. The tools are Wireshark for packet analysis and VirusTotal for threat intelligence correlation.

---

## Tracing the initial access

Opening capture.pcap in Wireshark and scrolling to the first significant traffic from the internal host reveals the beginning of the compromise. The internal machine at 172.16.1.191 initiates a TCP three-way handshake with 162.252.172.54 on port 80 — packet 113 is the SYN, followed by SYN-ACK and ACK. Immediately after the handshake completes, an HTTP GET request goes out for the path `/9GQ5A8/6ctf5JL HTTP/1.1`.

![Wireshark packet list showing TCP SYN from 172.16.1.191 to 162.252.172.54 on port 80 at packet 113, followed by SYN-ACK, ACK, and HTTP GET /9GQ5A8/6ctf5JL HTTP/1.1, then a rapid sequence of PSH-ACK data transfers with 1376-1460 byte payloads all being reassembled into TCP PDU at packet 1238.](/writeups/htb-compromised/01.png)

What follows the GET request is a rapid burst of PSH-ACK data transfers — the server pushing 1376–1460 byte chunks back to the client, all being reassembled into a single large TCP PDU (packet 1238). This is a file download in progress. The random-looking URL path, the bare IP address instead of a domain name, and the volume of data being transferred all point toward malware delivery rather than legitimate web browsing.

---

## Exporting the malicious payload

To extract the downloaded file from the capture, Wireshark's built-in HTTP object export provides a clean way to carve out complete HTTP transactions. Navigating to File → Export Objects → HTTP opens a dialogue listing every HTTP object transferred during the capture.

![Wireshark File menu expanded with Export Objects submenu showing HTTP option highlighted, packet list visible in background showing traffic between 184.168.98.68, 172.16.1.191, and 162.252.172.54.](/writeups/htb-compromised/02.png)

The HTTP object list surfaces the payload immediately. Packet 1238 from hostname 162.252.172.54 shows content type image/gif, size 1288 kB, filename 6ctf5JL. A 1.2 MB GIF fetched from a random path on a bare IP address — this is a common evasion technique where malware delivery infrastructure masquerades payloads under innocent MIME types to bypass basic content filtering. The object list also shows a legitimate Sectigo RSA Domain Validation certificate fetch from crt.segigo.com at packet 24056, which is standard certificate infrastructure traffic and not part of the malicious activity.

![Wireshark HTTP object list showing packet 1238 from hostname 162.252.172.54 with Content-Type image/gif, Size 1288 kB, Filename 6ctf5JL selected at the top, followed by packet 24056 from crt.segigo.com with SectigoRSADomainValidationSecureServerCA.crt, and numerous smaller objects with sizes ranging from 457 to 1460 bytes.](/writeups/htb-compromised/03.png)

Saving this object to disk and computing its SHA-256 hash yields: `9b8ffdc8ba2b2caa485cca56a82b2dcbd251f65fb30bc88f0ac3da6704e4d3c6`.

---

## Identifying the malware through VirusTotal

Submitting the SHA-256 hash to VirusTotal immediately returns a match. The Details tab reveals the true nature of the file — despite the server claiming image/gif, this is actually a **Win32 DLL**: a PE32 executable (DLL) (GUI) Intel 80386, compiled with Microsoft Visual C/C++ (2013) [DLL32], file size 1.23 MB (1288212 bytes). The hash details confirm the full set of file identifiers: MD5 `2bf6280ce1a1ec314e08b988ed8c8050`, SHA-1 `1be1785a3e4a1aeda89bc2a5b26df7edc7fe1430`.

![VirusTotal Details tab showing the file's basic properties including MD5 2bf6280ce1a1ec314e08b988ed8c8050, SHA-1 1be1785a3e4a1aeda89bc2a5b26df7edc7fe1430, SHA-256 9b8ffdc8ba2b2caa485cca56a82b2dcbd251f65fb30bc88f0ac3da6704e4d3c6, File type Win32 DLL with tags executable, windows, win32, pe, pedll, Magic showing PE32 executable (DLL) (GUI) Intel 80386, DetectItEasy identifying Microsoft Visual C/C++ (2013) [DLL32], and File size 1.23 MB.](/writeups/htb-compromised/04.png)

The Detection tab delivers the verdict: popular threat label **trojan.pikabot/mikey**, threat category trojan, with family labels pikabot, mikey, and qakbot. Pikabot is a modular malware loader that emerged in early 2023 as a successor to QakBot (QBot) following the FBI's Operation Duck Hunt takedown. It uses a two-component architecture — a loader DLL that decrypts and injects the core module, which then establishes C2 communications for delivering additional payloads including ransomware and Cobalt Strike beacons.

![VirusTotal Detection tab showing Popular threat label trojan.pikabot/mikey with a red warning icon, Threat categories listing trojan, and Family labels showing three tags: pikabot, mikey, and qakbot.](/writeups/htb-compromised/05.png)

The History section pins down the timeline of this specific sample. Creation Time: 2023-05-17 09:38:43 UTC. First Seen In The Wild: **2023-05-19 14:01:21** UTC. First Submission to VirusTotal: 2023-05-17 19:04:23 UTC. The two-day gap between creation and first wild sighting suggests the sample was compiled and submitted by a researcher or sandbox almost immediately, but took another two days to appear in actual malware campaigns.

![VirusTotal History section showing Creation Time 2023-05-17 09:38:43 UTC, First Seen In The Wild 2023-05-19 14:01:21 UTC, First Submission 2023-05-17 19:04:23 UTC, Last Submission 2024-11-23 02:35:31 UTC, and Last Analysis 2024-11-22 14:43:46 UTC.](/writeups/htb-compromised/06.png)

---

## Mapping the C2 infrastructure

With the malware identified as Pikabot, the next step is understanding where it was phoning home after execution. Wireshark's IPv4 Statistics under Statistics → Destinations and Ports aggregates all destination addresses with their associated ports and packet counts across the entire capture. The total capture contained 39106 packets.

![Wireshark IPv4 Statistics Destinations and Ports window showing 39106 total packets. Key destinations include 94.199.173.6 on port 2222 with 53 packets, 45.85.235.39 on port 2078 with 68 packets, 23.163.0.37 on port 8080 with 3188 packets at 8.15 percent, 193.122.200.171 on port 2078 with 61 packets, 185.87.148.132 on port 1194 with 60 packets, and 184.168.98.68 on port 443 with 35 packets.](/writeups/htb-compromised/07.png)

Several external destinations stand out for their use of non-standard HTTPS ports: 94.199.173.6 on port 2222 (53 packets), 45.85.235.39 on port 2078 (68 packets), 193.122.200.171 on port 2078 (61 packets), and 185.87.148.132 on port 1194 (60 packets). The heaviest external communication was with 23.163.0.37 on port 8080 (3188 packets, 8.15% of all traffic) — a substantial volume suggesting active C2 data exchange. Ports 2078, 2222, and 32999 are characteristic of Pikabot C2 infrastructure, which deliberately uses non-standard ports to evade signature-based detection that monitors standard HTTPS on port 443. The legitimate traffic to 184.168.98.68 on port 443 (35 packets) corresponds to the webmasterdev.com domain resolved in the DNS queries visible at the start of the capture.

---

## Inspecting the self-signed TLS certificate

Applying a `tls` display filter isolates all TLS-encrypted traffic for closer inspection. The filter reveals two distinct encrypted conversations: an initial TLSv1.2 exchange with 184.168.98.68 (legitimate webmasterdev.com traffic) carrying standard Application Data, and then a new TLS handshake beginning at packet 1246 with 45.85.235.39 — one of the C2 servers identified from the port statistics. The handshake follows the standard sequence: Client Hello (1246), Server Hello (1248), Certificate with Server Key Exchange and Server Hello Done (1249), then Client Key Exchange with Change Cipher Spec (1252).

![Wireshark with tls display filter applied showing TLSv1.2 Application Data exchanges with 184.168.98.68 in the earlier packets, then a new TLS handshake initiating at packet 1246 with 45.85.235.39 via Client Hello, followed by Server Hello at 1248, Certificate and Server Key Exchange and Server Hello Done at 1249 highlighted in blue, and Client Key Exchange at 1252.](/writeups/htb-compromised/08.png)

Expanding packet 1249 to inspect the server certificate reveals fabricated subject fields that are a dead giveaway for a self-signed C2 certificate. The subject's rdnSequence contains six items, each more obviously fake than the last: commonName (CN) votation.bzh, countryName (C) SX (Sint Maarten), stateOrProvinceName (ST) KI, organizationName (O) Uneared Inc., organizationalUnitName (OU) Undelightful, and the standout — localityName (L) **Pyopneumopericardium**. That last value is a rare veterinary medical term for a condition involving pus and air in the pericardial sac of cattle. Threat actors sometimes use absurdly long, obscure words like this to generate unique certificate fingerprints that are essentially impossible to collide with any legitimate certificate authority's output. The subjectPublicKeyInfo confirms RSA encryption with a public exponent of 65537 — the standard value.

![Wireshark packet 1249 certificate details showing the subject rdnSequence expanded with six RDN items: countryName SX, stateOrProvinceName KI highlighted in blue, organizationName Uneared Inc., organizationalUnitName Undelightful, localityName Pyopneumopericardium highlighted in blue, and commonName votation.bzh. Below, the subjectPublicKeyInfo shows rsaEncryption algorithm with publicExponent 65537.](/writeups/htb-compromised/09.png)

The certificate's validity period cements the connection to the campaign. The notBefore date is **2023-05-14 08:36:52** UTC and notAfter is 2024-05-13 08:36:52 UTC — a one-year validity period starting exactly three days before the malware's creation date of 2023-05-17. This timing alignment confirms the certificate and the Pikabot DLL were prepared as part of the same campaign infrastructure deployment. The certificate is version v3 with serialNumber `0x5651c79bfe60a17bc97bcb437c0f3ec25f7f6ec5` and uses sha256WithRSAEncryption for its signature algorithm.

![Wireshark packet 1249 showing the Handshake Protocol Certificate expanded with version v3, serialNumber 0x5651c79bfe60a17bc97bcb437c0f3ec25f7f6ec5, signature sha256WithRSAEncryption, and validity section showing notBefore utcTime 2023-05-14 08:36:52 UTC highlighted in blue, notAfter utcTime 2024-05-13 08:36:52 UTC, and the beginning of the subject rdnSequence confirming the same certificate with localityName Pyopneumopericardium.](/writeups/htb-compromised/10.png)

---

## Discovering the DNS tunneling exfiltration channel

The final piece of the investigation is identifying how data was being exfiltrated from the compromised machine. Applying a `dns` display filter to the capture immediately reveals the answer.

![Wireshark with dns display filter applied showing packet 1 as a DNS A record query for webmasterdev.com from 172.16.1.191, packet 2 with the response resolving to 184.168.98.68, packets 1432-1433 querying twitter.com, then starting at packet 1639 a rapid sequence of DNS TXT record queries for incrementing subdomains of dns.steasteel.net including aaa.h.dns.steasteel.net, baa.h.dns.steasteel.net, caa.h.dns.steasteel.net, daa.h.dns.steasteel.net and their responses.](/writeups/htb-compromised/11.png)

The first two DNS queries are normal — packet 1 resolves webmasterdev.com to 184.168.98.68 (an A record), and packets 1432–1433 query for twitter.com. But starting at packet 1639, an entirely different pattern takes over: a rapid-fire sequence of DNS TXT record queries for incrementally named subdomains of **dns.steasteel.net** — aaa.h.dns.steasteel.net, baa.h.dns.steasteel.net, caa.h.dns.steasteel.net, daa.h.dns.steasteel.net, and so on in a clear alphabetical progression.

This is textbook DNS tunneling. The technique encodes stolen data into DNS queries — either in the subdomain labels or in the TXT record responses — and routes them to an attacker-controlled authoritative DNS server. Because DNS traffic is almost universally allowed through firewalls and rarely subjected to deep inspection, it serves as one of the most reliable covert channels for data exfiltration even from heavily monitored networks. The sequential alphabetical pattern of the subdomain prefixes (aaa, baa, caa, daa) indicates an automated tool methodically chunking and transmitting data, with each query carrying a portion of the exfiltrated information. The domain steasteel.net serves as the tunnel endpoint — the attacker controls its authoritative nameserver and receives every DNS query directed at any subdomain under it, effectively turning the global DNS resolution infrastructure into a data exfiltration pipeline.

---

## What I took from this

Compromised is a clean demonstration of how much can be reconstructed from network evidence alone. A single PCAP captured every stage of the attack: the initial payload delivery over HTTP disguised as an image file, the malware establishing encrypted C2 channels on non-standard ports with self-signed certificates carrying obviously fabricated metadata, and the data exfiltration tunneled through DNS TXT queries to avoid detection. Each protocol layer told part of the story, and cross-referencing the indicators — the timing alignment between the certificate's creation date and the malware's compilation date, the non-standard port patterns matching known Pikabot infrastructure, the DNS query naming convention revealing automated tunneling — built the complete picture. The investigation reinforced that effective network forensics isn't about any single packet; it's about understanding how the protocols interact and how threat actors abuse legitimate infrastructure (HTTP content types, TLS encryption, DNS resolution) to hide malicious activity inside normal traffic patterns.
