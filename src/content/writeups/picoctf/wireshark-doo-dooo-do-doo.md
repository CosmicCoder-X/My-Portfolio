---
title: 'Wireshark doo dooo do doo...'
target: "picoCTF — Wireshark doo dooo do doo..."
difficulty: 'easy'
date: 2026-07-22
summary: "A picoCTF Forensics challenge where a PCAP file contained an HTTP response with ROT13-encoded flag text, found by following TCP streams in Wireshark and decoding the obfuscated body."
role: 'forensics'
tags: ['forensics', 'pcap', 'wireshark', 'rot13', 'http', 'tcp-stream', 'picoctf']
problem: "A PCAP file (shark1.pcapng) containing captured network traffic. The flag is hidden somewhere in the packet data."
action: "Opened the PCAP in Wireshark, filtered for HTTP traffic and identified a 200 OK response, followed the TCP stream (stream 5) to view the full HTTP conversation, and found a ROT13-encoded flag in the response body which was decoded to reveal the actual flag."
outcome: 'Decoded the ROT13 text from the HTTP response body to retrieve the flag.'
draft: false
---

## Background

Wireshark doo dooo do doo... is a picoCTF Forensics challenge about basic packet capture analysis. The challenge provides a PCAP file — `shark1.pcapng` — and the objective is to find the flag hidden within the captured network traffic. The challenge name is a playful reference to the "Baby Shark" song, with "Wireshark" substituted in. The solution involves following TCP streams to find HTTP content and recognising a simple text cipher.

---

## Examining the PCAP in Wireshark

Opened `shark1.pcapng` in Wireshark and filtered the traffic. Among the various TCP connections, one HTTP exchange stood out — a `GET /` request from `192.168.38.104` to `18.222.37.134` on port 80, followed by an `HTTP/1.1 200 OK` response containing `text/html` content:

![Wireshark main window showing shark1.pcapng filtered with tcp.stream eq 5. The packet list shows a TCP three-way handshake (SYN, SYN-ACK, ACK) between 192.168.38.104 and 18.222.37.134, followed by an HTTP GET request (501 bytes) and an HTTP 200 OK response (384 bytes, text/html). The selected packet (frame 827) shows the protocol dissection: Ethernet II, Internet Protocol Version 4 from 18.222.37.134 to 192.168.38.104, TCP from source port 80 to destination port 64093, Hypertext Transfer Protocol, and line-based text data (1 line). The right panel shows Ethernet and IPv4 header structure diagrams.](/writeups/picoctf-wireshark-doo-dooo-do-doo/01.png)

The HTTP response at frame 827 was 384 bytes and contained `text/html` content. To see the full request-response conversation in readable form, right-clicked the packet and chose Analyze → Follow → TCP Stream.

---

## Following the TCP stream

The Follow TCP Stream dialog showed the complete HTTP conversation on stream 5:

![Wireshark Follow TCP Stream window showing stream 5. The client request (red text) is a GET / HTTP/1.1 to Host 18.222.37.134 with a Chrome User-Agent on Windows NT 10.0. The server response (blue text) is HTTP/1.1 200 OK from Apache/2.4.29 (Ubuntu), dated Mon 10 Aug 2020 01:51:45 GMT, with Content-Length 47 and Content-Type text/html. The response body reads "Gur synt vf cvpbPGS{c33xno00_1_f33_h_qrnqorrs}" highlighted in an orange box. The stream selector in the bottom right shows Stream 5, also highlighted in an orange box. The conversation totals 777 bytes with 1 client packet and 1 server packet.](/writeups/picoctf-wireshark-doo-dooo-do-doo/02.png)

The server was running Apache/2.4.29 on Ubuntu. The response body contained a single line:

```
Gur synt vf cvpbPGS{c33xno00_1_f33_h_qrnqorrs}
```

This was immediately recognisable as ROT13 — a simple substitution cipher that shifts each letter 13 positions in the alphabet. The telltale signs were the structure (`Gur synt vf` for "The flag is") and the `PGS` inside what should be `CTF`. ROT13 is its own inverse — applying the same transformation twice returns the original text — so decoding was straightforward.

Applying ROT13 to the response body:

- `Gur synt vf` → `The flag is`
- `cvpbPGS` → `picoCTF`
- `{c33xno00_1_f33_h_qrnqorrs}` → `{p33kab00_1_s33_u_deadbeef}`

`picoCTF{p33kab00_1_s33_u_deadbeef}`

---

## What I took from this

This challenge introduced the fundamental workflow of PCAP analysis: open the capture in Wireshark, identify interesting traffic (HTTP requests and responses are usually the first thing to check), follow the TCP stream to see the full conversation in readable form, and examine the content for hidden or obfuscated data. The Follow TCP Stream feature is one of Wireshark's most useful tools for forensic analysis — it reassembles the fragmented TCP segments into a continuous conversation, colour-codes client (red) and server (blue) traffic, and displays the data in ASCII, which makes it easy to spot readable content.

The ROT13 encoding was trivial but illustrative of a broader principle: data in network captures is often obfuscated rather than encrypted. ROT13, base64, XOR with a simple key, and URL encoding are all common techniques used in CTF challenges and in real-world malware communications to avoid plaintext detection by intrusion detection systems. The key skill is pattern recognition — learning to spot encoded text by its structure and character distribution. In this case, `PGS` in place of `CTF` and `Gur` for "The" were dead giveaways to anyone familiar with ROT13, which is one of the most common encoding schemes encountered in CTF forensics.
