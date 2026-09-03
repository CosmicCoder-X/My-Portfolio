---
title: 'Litter'
target: 'Hack The Box — Litter'
difficulty: 'easy'
date: 2026-02-10
summary: 'An HTB Sherlock — analyzing a PCAP to identify dnscat2 DNS tunneling from 192.168.157.144 to an internal endpoint at 192.168.157.145, decoding hex payloads from DNS subdomain queries to microsofto365.com, and reconstructing the exfiltration of 721 PII records.'
role: 'soc'
tags: ['pcap', 'wireshark', 'network-forensics', 'dns-tunneling', 'dnscat2', 'cyberchef', 'hex-decoding', 'traffic-analysis', 'data-exfiltration', 'pii', 'dfir', 'sherlock']
problem: 'A PCAP from a corporate environment with suspicious DNS activity. The investigation requires identifying the tunneling tool and version, the suspect host, the disguised binary name, the exfiltrated PII file path, and the total record count — all from DNS traffic patterns and hex-encoded subdomain payloads.'
action: 'Opened the PCAP in Wireshark — DNS traffic dominated the capture. Wireshark Conversations statistics showed 192.168.157.144 to 192.168.157.145 as the top conversation (10,901 packets), an anomalous internal-to-internal pair. Filtered to their traffic and found DNS queries with hex-encoded subdomains under microsofto365.com (typo-squatting microsoft365.com) using rotating MX/CNAME/TXT types — the signature of dnscat2. Followed the UDP stream and decoded hex payloads in CyberChef, revealing the first command response "command (DESKTOP-UMNCBE7)" (whoami output). Identified dnscat2 v0.07 renamed to win_installer.exe. The attacker enumerated OneDrive (0 files), then exfiltrated C:\users\test\documents\client data optimisation\user details.csv containing 721 PII records (IDs 0-720) through the DNS tunnel.'
outcome: 'Fully reconstructed a dnscat2 v0.07 DNS tunneling operation — C2 via hex-encoded subdomain queries to microsofto365.com, first command whoami on DESKTOP-UMNCBE7, and exfiltration of 721 PII records from user details.csv through the covert DNS channel.'
draft: false
---

## Background

Litter is a Hack The Box Sherlock — a network forensics investigation built around a single PCAP file from a corporate environment where suspicious activity has been flagged. The evidence is suspicious_traffic.pcap, and the scenario centres on DNS tunneling — one of the more insidious data exfiltration techniques because DNS traffic is almost universally permitted through firewalls and rarely inspected deeply. The tools for this one are Wireshark for packet analysis and CyberChef for decoding the hex-encoded payloads hidden inside DNS queries.

---

## Identifying the suspect protocol

Opening suspicious_traffic.pcap in Wireshark, the first thing that stands out is the sheer volume of DNS traffic. The packet list is dominated by DNS Standard query packets — row after row of them from the internal host 192.168.157.144 to the DNS server at 192.168.157.2. The queries resolve a mix of domains: feed.cn-rtb.com, accounts.google.com, cdn.ocmhood.com, buyadvupfor24.com, nz.mail.yahoo.com. On the surface these look like normal browsing-related DNS resolution, but the ratio is wrong — in a typical capture, DNS queries are brief bursts followed by actual application-layer traffic to the resolved IPs. Here, DNS itself is the dominant protocol, with only the occasional SSDP M-SEARCH or TCP packet breaking the pattern.

![Wireshark packet list showing suspicious_traffic.pcap with DNS protocol column highlighted in red, rows of Standard query packets from 192.168.157.144 to 192.168.157.2 for domains including feed.cn-rtb.com, accounts.google.com, cdn.ocmhood.com, buyadvupfor24.com, and nz.mail.yahoo.com, with frame 1801 showing TCP from 192.168.157.144 to 204.79.197.222 port 443.](/writeups/htb-litter/01.png)

That disproportionate DNS volume is the first indicator that something is off. DNS should be a supporting protocol — a quick lookup before the real communication begins. When DNS itself becomes the primary traffic type, it suggests the protocol is being repurposed as a data channel rather than just a name resolution service.

---

## Mapping the suspect conversation

To move from a visual impression to hard numbers, the next step is opening Statistics → Conversations, which aggregates all communication pairs with their packet counts, byte totals, and durations.

![Wireshark Statistics menu expanded with Conversations option highlighted in red box, packet list visible in background showing DNS queries for wpad.localdomain, clientservices.googleapis.com, and other domains.](/writeups/htb-litter/02.png)

The Conversations window opens to the IPv4 tab showing 244 total conversations. Sorting by Packets immediately surfaces the anomaly: the conversation between 192.168.157.144 and 192.168.157.145 sits at the very top with 10,901 packets — far exceeding every other conversation in the capture. The data volume is 2 MB over stream ID 148, spanning a duration of 2068 seconds (roughly 34 minutes). The second-highest conversation by packet count is 192.168.157.144 to 173.194.129.201 with 7,024 packets across 8 MB, which corresponds to typical Google infrastructure web traffic.

![Wireshark Conversations window showing IPv4 tab with 244 conversations, Packets column highlighted in red box, top conversation between 192.168.157.144 and 192.168.157.145 with 10,901 packets, 2 MB data, stream ID 148, duration 2068.1893 seconds.](/writeups/htb-litter/03.png)

What makes the top conversation stand out is not just the packet count but the destination — 192.168.157.145 is not an external server. It is another host on the same internal subnet. An internal-to-internal conversation carrying 10,901 packets of DNS traffic, more than any external communication in the capture, is a clear indicator that 192.168.157.145 is the suspect host. This machine is acting as a DNS tunnel endpoint, receiving data encoded within DNS queries from the compromised host at 192.168.157.144. In a legitimate network, no internal host should be the top DNS conversation partner — that role belongs to the configured DNS resolver (192.168.157.2 in this case) or external DNS servers.

---

## Filtering the tunnel traffic

With the suspect pair identified, applying a display filter to isolate their communication reveals the full extent of the tunneling. The filter `ip.addr == 192.168.157.144 && ip.dst == 192.168.157.145` strips away all the noise and shows only the traffic flowing from the compromised host to the tunnel endpoint.

![Wireshark with display filter ip.addr == 192.168.157.144 && ip.dst == 192.168.157.145 highlighted in green, filtered packet list showing all DNS queries from .144 to .145, first packet 12184 showing MX query with hex-encoded subdomain 2cea0661b600a0021636f6d6d616e6420284445534b544f502d554d4e434245372900.microsofto365.com, subsequent packets showing MX, CNAME, and TXT queries for subdomains of 1661b600a8981.microsofto365.com.](/writeups/htb-litter/04.png)

The filtered view confirms everything. Every single packet in this conversation is a DNS query, and the domains being queried are not legitimate. The first packet (12184) is an MX query for `2cea0661b600a0021636f6d6d616e6420284445534b544f502d554d4e434245372900.microsofto365.com` — a long hex-encoded string prepended as a subdomain to microsofto365.com. The subsequent packets continue the pattern with MX, CNAME, and TXT queries in rotation, all targeting subdomains under `1661b600a8981.microsofto365.com`.

The domain microsofto365.com is a deliberate typo-squat of microsoft365.com — close enough to survive a cursory log review but clearly attacker-controlled. The rotating use of multiple DNS record types (MX, CNAME, TXT) and the hex-encoded data embedded in subdomain labels are the signature characteristics of dnscat2, a well-known open-source DNS tunneling tool. dnscat2 works by encoding command-and-control traffic and exfiltrated data into the subdomain portion of DNS queries, effectively turning the DNS infrastructure into a bidirectional data pipe. Because DNS queries and responses flow through standard DNS infrastructure, firewalls and network monitors that allow DNS traffic pass the tunneled data through without inspection.

---

## Following the stream and decoding the payload

To extract the raw tunneled content from the DNS conversation, right-clicking on the first filtered packet and selecting Follow → UDP Stream reassembles the entire conversation into a continuous byte stream.

![Wireshark right-click context menu on filtered DNS packet showing Follow submenu expanded with UDP Stream option highlighted in red box, packet list showing continuous DNS queries to microsofto365.com subdomains.](/writeups/htb-litter/05.png)

Wireshark opens the Follow UDP Stream window for udp.stream eq 430, displaying the raw bytes of the DNS tunnel. The very first payload at the top of the stream — highlighted in red — contains the hex string `2cea00661b600a0021636f6d6d616e6420284445534b544f502d554d4e434245372900`.

![Wireshark Follow UDP Stream window (udp.stream eq 430) showing raw tunnel data, top hex string 2cea00661b600a0021636f6d6d616e6420284445534b544f502d554d4e434245372900 highlighted in red, stream content below showing continuous microsofto365.com references with encoded data chunks containing session identifiers like 617d01661b600a8981 and 1270001661b600a8981.](/writeups/htb-litter/06.png)

Taking that hex string into CyberChef and applying the From Hex operation decodes it to: `command (DESKTOP-UMNCBE7)`. This single decoded string confirms two things simultaneously — the compromised machine's hostname is DESKTOP-UMNCBE7, and the first command issued through the DNS tunnel was `whoami`, with the output showing the machine identity as the response. The stream content below the initial handshake shows continuous microsofto365.com references with encoded data chunks, each containing session identifiers like `617d01661b600a8981` — these are dnscat2 session management frames carrying the ongoing C2 traffic back and forth.

---

## Reconstructing the attacker's activity

Continuing to decode the hex payloads from the UDP stream using CyberChef's From Hex operation piece by piece revealed the full scope of the attacker's activities through the tunnel. The dnscat2 protocol metadata in the handshake frames identified the tool version as 0.07. The attacker had taken care to disguise the tool on the compromised machine — the original binary name dnscat2-v0.07-client-win32.exe had been renamed to win_installer.exe, making it look like a generic Windows installer rather than a known tunneling tool. This kind of renaming is a basic but effective evasion against endpoint detection rules that trigger on known malicious filenames.

Through the decoded tunnel commands, the attacker's reconnaissance followed a predictable pattern. They first checked OneDrive cloud storage on the compromised machine, which returned 0 files — an empty cloud drive. With nothing useful in cloud storage, the attacker shifted focus to local files and eventually located `C:\users\test\documents\client data optimisation\user details.csv` — a CSV file containing personally identifiable information.

The exfiltration itself happened through the same DNS tunnel. The CSV data was chunked, hex-encoded, and sent out as a stream of DNS queries to microsofto365.com subdomains — each query carrying a fragment of the stolen data in its subdomain label, reassembled on the attacker's end by the dnscat2 server listening on 192.168.157.145. The stolen records used sequential identifiers starting at 0 and ending at 720, which means 721 individual PII records were exfiltrated through the covert DNS channel.

---

## What I took from this

Litter is a clean demonstration of why DNS monitoring deserves more attention than it typically gets in SOC environments. The attacker's approach was textbook dnscat2 — hex-encoded data in subdomain labels, rotating record types, a typo-squatted domain that looks legitimate at a glance — but the detection methodology is straightforward once you know what to look for. The Conversations statistics view in Wireshark is an underrated starting point: sorting by packet count immediately surfaces abnormal communication patterns that would take much longer to find by scrolling through individual packets. The key takeaway is that DNS is not just a supporting protocol that can be safely ignored in traffic analysis — it is one of the most commonly abused channels for covert communication precisely because most organisations treat it as trusted infrastructure. Statistical anomalies in DNS volume, unusual internal DNS conversation partners, and hex-encoded subdomain labels are all indicators that the protocol is being weaponised rather than used for its intended purpose.
