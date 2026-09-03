---
title: 'Rogue Tower'
target: 'picoCTF — Rogue Tower'
difficulty: 'hard'
date: 2026-07-22
summary: "A picoCTF Forensics challenge involving a PCAP of rogue cell tower traffic, where analysing UDP broadcasts to find the cell ID, tracing HTTP User-Agent headers to extract a device IMSI, reassembling fragmented base64 data from POST requests, and XOR-decrypting with the correct portion of the IMSI revealed the flag."
role: 'forensics'
tags: ['forensics', 'pcap', 'wireshark', 'xor', 'cyberchef', 'cellular', 'picoctf']
problem: "A PCAP file capturing traffic from a rogue cell tower. The challenge requires identifying the unauthorized network, finding the victim device, extracting exfiltrated data split across multiple HTTP POST requests, and decrypting it using a key derived from the device IMSI."
action: "Opened the PCAP in Wireshark, filtered UDP traffic and found an unauthorized test network broadcast with a cell ID on stream 8, traced the cell ID through HTTP User-Agent headers to extract the victim device IMSI, collected fragmented base64 data from multiple HTTP POST streams, concatenated and decoded it in CyberChef, then XOR-decrypted with the varying portion of the IMSI after trial and error with key selection."
outcome: 'Decrypted the exfiltrated data to recover the flag after identifying the correct IMSI-derived XOR key.'
draft: false
---

## Background

Rogue Tower is a picoCTF Forensics challenge about analysing network traffic from a rogue cell tower — a fake base station (also called an IMSI catcher or Stingray) that impersonates a legitimate cellular tower to intercept mobile device communications. The challenge provides a PCAP file (`rogue_tower.pcap`) and a series of hints that guide the investigation through identifying the rogue network, finding the victim device, extracting exfiltrated data, and decrypting it. The tools needed are Wireshark for packet analysis and CyberChef for decoding and decryption.

---

## Finding the unauthorized network broadcast

The first hint pointed toward unauthorized test network broadcasts on UDP port 55000. Applied a UDP filter in Wireshark, selected the relevant packets, and followed UDP streams by right-clicking and choosing Follow → UDP Stream. Iterated through the streams using the stream index selector in the bottom right corner.

Stream 8 contained the rogue tower's broadcast:

![Wireshark Follow UDP Stream window showing stream 8 from rogue_tower.pcap. The stream content reads "UNAUTHORIZED-TEST-NETWORK PLMN=00101 CELLID=90461" in red text on a dark background. The status bar shows 1 client packet, 0 server packets, 0 turns, with the conversation displayed as ASCII.](/writeups/picoctf-rogue-tower/01.png)

The message read `UNAUTHORIZED-TEST-NETWORK PLMN=00101 CELLID=90461`. The PLMN (Public Land Mobile Network) code `00101` is a well-known test network identifier, and the cell ID `90461` was the identifier for this rogue tower. This cell ID became the key for linking the rogue tower to the device it intercepted.

---

## Tracing the victim device through HTTP headers

The next hint directed toward HTTP User-Agent headers to find the device that connected to the rogue tower. Filtered HTTP traffic, followed the HTTP streams, and searched for the cell ID `90461`.

TCP stream 4 contained the match:

![Wireshark Follow HTTP Stream window showing TCP stream 4. The request is GET /api/register HTTP/1.1 to Host: network.carrier.com. The User-Agent header reads "MobileDevice/1.0 (IMSI:310410337059687; CELL:90461)" with Accept: */* and Connection: close.](/writeups/picoctf-rogue-tower/02.png)

The User-Agent header read `MobileDevice/1.0 (IMSI:310410337059687; CELL:90461)`. The device had registered with the rogue tower's cell ID, confirming it was the intercepted victim. The IMSI (International Mobile Subscriber Identity) — `310410337059687` — was the critical piece, because one of the hints stated that the encryption key was derived from it.

---

## Extracting the exfiltrated data

Another hint indicated that the exfiltrated data was split across multiple HTTP POST requests. Following each HTTP stream individually revealed fragments of base64 data being uploaded to `198.51.100.247` via `POST /upload`:

![HTTP POST request to 198.51.100.247 with Content-Type application/octet-stream and Content-Length 9. The body contains the base64 fragment "BQ1QXAEAS".](/writeups/picoctf-rogue-tower/03.png)

![HTTP POST request to 198.51.100.247 with Content-Type application/octet-stream and Content-Length 9. The body contains the base64 fragment "JQQtFbAQB".](/writeups/picoctf-rogue-tower/04.png)

Each POST carried a small fragment — 9 bytes at a time. Collecting all the fragments across the streams and concatenating them in order produced the complete base64 string:

```
Q15TWnpifkxBB1dACmlbBF9bb0EJQQtFbAQBBQ1QXAEASg==
```

---

## Decoding and decryption — the wrong key

The first attempt in CyberChef applied a From Base64 operation to the concatenated string. The output was raw bytes — not readable text — confirming the data was encrypted, not just encoded.

![CyberChef with From Base64 recipe applied to the input string Q15TWnpifkxBB1dACmlbBF9bb0EJQQtFbAQBBQ1QXAEASg==. The output shows garbled binary characters that are not readable text.](/writeups/picoctf-rogue-tower/05.png)

Since the hint said the encryption key was derived from the IMSI, tried XOR decryption with the full IMSI `310410337059687` as the key in UTF-8 format:

![CyberChef with From Base64 followed by XOR recipe. The XOR key is set to "31041033705968" in UTF-8 with Standard scheme. The output reads "pocnKRM...v7by..." — still garbled, not a valid flag.](/writeups/picoctf-rogue-tower/06.png)

The output was still gibberish. The full IMSI was not the correct key.

---

## Re-evaluating the key derivation

Looking more carefully at the IMSI values across multiple streams revealed a pattern. The first portion — `310410` — was the Mobile Country Code (310 = United States) and Mobile Network Code (410), which are constant identifiers for the carrier. The remaining digits — `337059687` — were the subscriber-specific portion (MSIN) that varied between devices.

The initial assumption had been to use the full IMSI as the key. But the constant carrier prefix would be the same for every device on that network, making it useless as a per-device encryption key. The varying portion — the subscriber-specific digits — was the actual key material.

The correct XOR key was `37059687`.

---

## Successful decryption

Re-ran the CyberChef recipe with From Base64 followed by XOR using `37059687` as the UTF-8 key:

![CyberChef with From Base64 followed by XOR recipe. The XOR key is set to "37059687" in UTF-8 with Standard scheme. The output reads "picoCTF{r0gu3_c3ll_t0w3r_3104fd63}" — the flag.](/writeups/picoctf-rogue-tower/07.png)

The flag decoded cleanly.

`picoCTF{r0gu3_c3ll_t0w3r_3104fd63}`

---

## What I took from this

This challenge modelled the workflow of investigating an IMSI catcher — a real threat in mobile security where attackers deploy fake base stations to intercept device communications. The investigation followed a logical chain: identify the rogue infrastructure (the unauthorized test network broadcast on UDP), find the victim (correlating the cell ID through HTTP User-Agent headers to a specific IMSI), extract the stolen data (reassembling fragments split across multiple HTTP POST requests), and decrypt it (using knowledge of the IMSI structure to derive the correct key). The key derivation step was the hardest part — understanding that an IMSI has a fixed structure (MCC + MNC + MSIN) and that only the subscriber-specific portion made sense as a per-device key required knowledge of how cellular identifiers work, not just generic crypto skills. The fragmentation of exfiltrated data across multiple small POST requests is also a realistic exfiltration technique — splitting data into small chunks across separate connections makes it harder for network monitoring tools to detect the transfer, since each individual request looks innocuous. In real-world incident response, analysts regularly reconstruct exfiltrated data from fragmented network captures like this, and understanding how to correlate identifiers across protocol layers (UDP broadcasts, HTTP headers, POST bodies) is a core traffic analysis skill.
