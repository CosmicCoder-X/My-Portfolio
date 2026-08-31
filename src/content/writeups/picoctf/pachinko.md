---
title: 'Pachinko'
target: 'picoCTF — Pachinko'
difficulty: 'medium'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge — a NAND Simulator web application where the intended path was to solve the circuit logic, but intercepting the POST /check endpoint with Burp Suite revealed the server accepts JSON describing circuit connections as {"circuit":[{"input1":N,"input2":N,"output":N},...]} and responds with a success/failure status, making it possible to brute-force the correct node values by fuzzing each input1, input2, and output field with Burp Intruder''s Sniper attack using a numeric payload range 0–100, where a successful combination returned a longer response (302 bytes vs the standard 282) containing the flag picoCTF{p4ch1nk0_f146_0n3_e947b9d7} in the JSON body — bypassing the need to understand NAND gate logic entirely.'
role: 'appsec'
tags: ['web-exploitation', 'burp-suite', 'intruder', 'fuzzing', 'api-abuse', 'json', 'brute-force', 'picoctf']
problem: 'Pachinko is a picoCTF Web Exploitation challenge presenting a NAND Simulator — an interactive web interface with numbered nodes (1 through 8) that can be connected to form a circuit, then submitted to the server for validation. The challenge description states there are two flags (this writeup covers flag one). The intended approach appears to be understanding NAND gate logic and constructing the correct circuit, but the real question is whether the server-side validation can be bypassed or brute-forced by manipulating the API directly.'
action: 'Accessed the challenge at http://activist-birds.picoctf.net:56704 which presented a NAND Simulator with an interactive canvas containing eight numbered nodes and four buttons: Reset Circuit, Add Intermediate Node, Play Animation, and Submit Circuit. Started by manually connecting a few nodes to understand the interface — dragging connections between nodes like 1→6, 6→5, 7→2, 7→3. Clicking Submit Circuit sent the configuration for server-side validation and got back a failure response, which was expected for a random configuration. Briefly tested for reflected XSS by injecting payloads into the URL, but nothing fired — the application was not vulnerable to client-side injection, confirming this was a logic-based challenge rather than a classic web vulnerability. Launched Burp Suite and turned on interception, then clicked Submit Circuit again to capture the request. The intercepted POST request to /check revealed the entire circuit representation: the server expected a JSON body with a circuit array containing objects with input1, input2, and output integer fields — for example {"circuit":[{"input1":5,"input2":6,"output":1},{"input1":6,"input2":7,"output":2}]}. This was the critical insight: the server was validating specific numeric combinations, and the search space was small enough to brute-force. Sent the request to Burp Intruder and configured a Sniper attack. Wrapped each numeric value (input1, input2, output in each circuit element) with payload position markers, then set the payload list to numbers ranging from 0 to 100. The Sniper attack type cycles through each marked position one at a time while holding the others at their original values, which is efficient for identifying which specific value in a multi-parameter request triggers a different response. Launched the attack and monitored the results table. Most responses came back with Status 200 and a consistent Length of 282 bytes — the standard "wrong" response. But one request stood out immediately: Position 1, Payload 1 returned Status 200 with a Length of 302 bytes — 20 bytes longer than every other response. That length differential is the classic indicator in Intruder that a payload triggered a different code path on the server. Clicked on that response to inspect it and the Response tab showed the JSON body: {"status":"success","flag":"picoCTF{p4ch1nk0_f146_0n3_e947b9d7}\n"}. The correct payload value at that position was the key to unlocking the circuit validation. One request in the Intruder table also returned Status 400 (Payload 0, Length 154) — the server rejected 0 as an invalid node identifier, which makes sense since the visible nodes started at 1. Every other payload from 2 through 7 (and beyond) returned the standard 282-byte failure, confirming the correct value was uniquely identifiable through response length alone.'
outcome: 'Captured the flag picoCTF{p4ch1nk0_f146_0n3_e947b9d7} by bypassing the NAND circuit logic entirely through API-level brute-forcing. The challenge demonstrated a common pattern in CTF web challenges: when a server validates structured input and the parameter space is small, direct fuzzing of the API is often faster than reverse-engineering the intended logic. The key indicators were the JSON circuit format revealed through traffic interception and the response length differential (302 vs 282 bytes) that made the successful payload trivially identifiable in Burp Intruder''s results. The approach also highlighted the importance of monitoring both status codes and content length during fuzzing — the status code alone (200) was identical for both success and failure, but the 20-byte length difference gave away the winning combination immediately.'
draft: false
---

## Background

Pachinko is a picoCTF Web Exploitation challenge built around a NAND Simulator — an interactive web application where you connect numbered nodes to form a digital logic circuit and submit it for server-side validation. The challenge description mentions two flags (this writeup covers flag one, with flag two belonging to a separate "Pachinko Revisited" submission). The intended path is presumably to understand NAND gate truth tables and construct the correct circuit configuration, but as with many web challenges, the interesting question is whether the validation itself can be attacked rather than solved.

---

## Playing with the simulator

The challenge instance loaded at `http://activist-birds.picoctf.net:56704` presented a clean interface: a dark canvas with eight numbered nodes (1 through 8) arranged across the space, and four control buttons — Reset Circuit, Add Intermediate Node, Play Animation, and Submit Circuit. The nodes could be connected by clicking and dragging between them, creating yellow lines representing circuit connections.

![NAND Simulator web interface at activist-birds.picoctf.net:56704 showing a dark canvas with eight numbered nodes, nodes 1 and 6 connected to node 5 at the bottom, nodes 6 and 7 connected, and node 7 connected down to nodes 2 and 3, with node 4 and 8 sitting unconnected on the right side. Four buttons across the top: Reset Circuit (red), Add Intermediate Node (white), Play Animation (green), Submit Circuit (yellow).](/writeups/picoctf-pachinko/01.png)

I started by manually wiring up a few nodes to get a feel for the interface — connecting 1→6, 6→5, 7→2, 7→3, and a few others. Clicking Submit Circuit popped up a result saying the configuration was wrong, which was expected for a random wiring. Before digging into the logic, I did a quick check for reflected XSS by injecting `<script>alert(1)</script>` into the URL — nothing fired. The application was sanitising its inputs on the client side, so this was going to be a logic or API challenge rather than a classic injection.

---

## Intercepting the submission

With manual guessing off the table (the search space for connecting eight nodes in valid NAND configurations is large enough to make random clicking impractical), I launched Burp Suite and turned on interception to see exactly what the Submit Circuit button was sending to the server.

The intercepted request was a POST to `/check` with a JSON body:

```
{"circuit":[{"input1":5,"input2":6,"output":1},{"input1":6,"input2":7,"output":2}]}
```

![Burp Suite request editor showing POST /check HTTP/1.1 to activist-birds.picoctf.net:56704 with Content-Type application/json, the JSON body containing a circuit array with two gate objects each having input1, input2, and output fields with payload position markers around the numeric values.](/writeups/picoctf-pachinko/02.png)

This was the breakthrough. The server was expecting a simple JSON structure — an array of gate definitions, each with `input1`, `input2`, and `output` as integer node identifiers. The client-side GUI was just a visual wrapper for constructing this JSON. More importantly, the integers were small (node IDs 1 through 8, possibly with intermediate nodes), which meant the parameter space was finite and brute-forceable. Rather than working out the NAND logic to determine which combination of inputs and outputs would satisfy the circuit, I could let Burp Intruder try every value and watch for the response that looked different.

---

## Fuzzing with Intruder

I sent the captured request to Burp Intruder and set up a Sniper attack. Each numeric value in the JSON body — the `input1`, `input2`, and `output` fields — was wrapped with payload position markers. The payload list was set to numbers from 0 to 100, covering well beyond the visible node range to account for any hidden intermediate nodes or edge cases.

The Sniper attack type was the right choice here: it iterates through each marked position independently while holding the others at their default values. This is efficient for isolating which specific parameter value triggers a different server response, rather than trying every possible combination simultaneously (which a Cluster Bomb attack would do, but with an exponentially larger request count).

The attack fired off and the results populated the Intruder table. The pattern was immediately obvious. Most responses returned Status 200 with a Length of 282 bytes — the standard failure response. One request returned Status 400 with Length 154 — that was Payload 0, which the server rejected as an invalid node identifier (nodes start at 1, so 0 is out of range). But one row stood out with a different colour in the results table: Position 1, Payload 1 came back with Status 200 and a Length of 302 bytes. That 20-byte difference from the standard 282 was the signal.

![Burp Suite Intruder results table showing requests numbered 0-8 with Position 1 and Payloads 0-7, all returning Status 200 with Length 282 except row 1 (Payload 0) with Status 400 and Length 154, and row 2 (Payload 1) highlighted in blue with Status 200 and Length 302. The Response panel below shows HTTP/1.1 200 OK with X-Powered-By Express, Content-Type application/json, and the JSON body containing status success and flag picoCTF{p4ch1nk0_f146_0n3_e947b9d7}.](/writeups/picoctf-pachinko/03.png)

Clicking on that response revealed the payload:

```json
{
    "status": "success",
    "flag": "picoCTF{p4ch1nk0_f146_0n3_e947b9d7}"
}
```

The flag was sitting right there in the JSON response. The correct value at that particular payload position was 1 — and that single correct value was enough to satisfy the server's circuit validation and return the flag.

---

## What I took from this

This challenge was a good reminder that web exploitation is not always about finding injection points or authentication bypasses — sometimes it is about recognising that a server-side validation with a small parameter space is an invitation to brute-force. The NAND Simulator's visual interface was designed to make you think in terms of logic gates, but the actual vulnerability was at the API level: the `/check` endpoint accepted numeric node IDs with no rate limiting, and the correct combination was discoverable through response length analysis alone. The status code (200) was identical for both success and failure responses — only the 20-byte content length difference separated the winning payload from every losing one. That length differential pattern is something worth watching for in any fuzzing scenario: when you are throwing payloads at an endpoint, sorting the results by response size is often the fastest way to spot the outlier that hit a different code path on the server.
