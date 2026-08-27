---
title: 'Sakura'
target: 'TryHackMe — Sakura'
difficulty: 'easy'
date: 2025-08-27
summary: 'A pure OSINT investigation that chains image metadata extraction, PGP key analysis, GitHub commit history, cryptocurrency tracing on Etherscan, deep web paste lookups, wireless network geolocation via WiGLE, and reverse image searching to build a complete profile on a target persona.'
role: 'soc'
tags: ['osint', 'metadata', 'pgp', 'github', 'cryptocurrency', 'etherscan', 'reverse-image-search', 'wigle', 'geolocation', 'social-media', 'dark-web']
problem: 'A series of OSINT challenges requires building a profile on a target individual using only publicly available information. Starting from a single image, the investigation must uncover the target''s identity, email, social media presence, cryptocurrency transactions, physical location, and digital footprint across the surface and dark web.'
action: 'Decoded binary strings from a source image via ASCII table lookup, extracted metadata from the page source to find a Linux username, traced PGP keys on GitHub to reveal an email address through base64 decoding, identified a Twitter account, tracked Ethereum wallet transactions through GitHub commit history and Etherscan, located a deep web paste via an onion link, used WiGLE to geolocate a wireless access point by BSSID, and performed reverse image searches across multiple platforms to identify real-world locations including a landmark and a lake.'
outcome: 'Completed the full OSINT profile across all six tasks — identity, digital footprint, cryptocurrency trail, dark web presence, and physical geolocation. Documented every technique used from metadata analysis through blockchain tracing to satellite imagery correlation.'
draft: false
---

## Background

For anyone unfamiliar with OSINT, the concept is straightforward: **Open Source Intelligence** — gathering information about a target using only publicly accessible sources. No exploitation, no scanning, no shells. Just search engines, public databases, social media, and the ability to connect dots across platforms. This room is a guided exercise in exactly that, structured as a series of investigative tasks that build on each other.

One note before diving in: I spent more time than I'd like to admit going down wrong paths on several of these. OSINT challenges reward patience and lateral thinking more than technical skill, and some of the techniques here — particularly the PGP key analysis and the WiGLE lookup — were completely new to me.

---

## Task 1 — Introduction

Nothing technical here. The room sets the stage: a cybercriminal has left traces across the internet, and the job is to follow them. Agree and move on.

---

## Task 2 — TIP-OFF

The task starts with a binary string. I initially went deep trying to figure out what the binary represented as a file or encoded object — that was a waste of time. The answer is much simpler: convert the binary to decimal values, then map each decimal to the ASCII table. The decoded message reads:

> *"A picture worth 1000 words but metadata is worth far more"*

That's the hint. The room provides an image, and viewing the page source reveals its metadata. Metadata is information *about* information — in this case, the image file carries embedded details beyond what's visible in the picture itself. Inspecting the source reveals a path under `/home/`, and if you're familiar with Linux filesystem conventions, you know that `/home/` contains user directories. The directory name under `/home/` is the target's username — the first piece of the profile.

---

## Task 3 — RECONNAISSANCE

### Q1 — Finding the email

This one was tricky, and I'll admit I needed a nudge from another writeup to learn the technique. My first instinct was to search for a LinkedIn profile tied to the username from Task 2, hoping to find a professional email address. That went nowhere.

The actual path: the username leads to a **GitHub account**. Browsing through the account's public activity, what caught my attention was a **PGP key** associated with the profile. PGP (Pretty Good Privacy) keys are used for encrypting and signing communications, and they typically embed the owner's name and email address in the key metadata.

The key data on GitHub contained a base64-encoded string. Decoding it through Burp Suite's Decoder (or any base64 tool) revealed the target's email address in plain text. This was a genuinely useful technique I hadn't encountered before — PGP keys are a reliable OSINT vector because people publish them intentionally for others to verify their identity, which means the embedded information is usually accurate and current.

### Q2 — Social media presence

With the username and real name established, finding the target's **Twitter handle** was straightforward. The account contained posts that provided additional context for later tasks — including an image that becomes relevant in Task 6.

---

## Task 4 — UNVEIL

### Q1 — Identifying the cryptocurrency

Back on the target's GitHub profile, one of the repositories is named **ETH** — a dead giveaway for anyone familiar with cryptocurrency. ETH is the ticker symbol for **Ethereum**, the second-largest cryptocurrency by market capitalisation. The repository's contents relate to Ethereum wallet operations.

### Q2 — The wallet address

The current state of the ETH repository doesn't contain the wallet address directly — but Git never forgets. Navigating to the **commit history** reveals previous versions of the files, and one of the earlier commits contains the target's Ethereum wallet address in a field labelled `ethwallet`. This is a common OSINT pattern with Git repositories: people commit sensitive data, realise their mistake, and update the file — but the original data persists in the commit history unless the repository is force-pushed with a rewritten history.

### Q3 — Tracing the transaction

With the wallet address in hand, the next step is blockchain analysis. Ethereum is a public ledger — every transaction is permanently recorded and queryable by anyone. Searching the wallet address on **Etherscan** (etherscan.io) displays the complete transaction history.

The question asks which mining pool sent a transaction on a specific date. Scrolling through the transaction list and filtering by the target date reveals an incoming transfer from **Ethermine**, one of the largest Ethereum mining pools. The sender address is publicly labelled on Etherscan, so no additional lookup is needed.

### Q4 — Following the money

The same Etherscan transaction history shows where funds were sent. Examining the outgoing transactions reveals a transfer to **Tether** (USDT) — a stablecoin pegged to the US dollar. Converting volatile cryptocurrency to a stablecoin is a common pattern for cashing out or preserving value, and it's exactly the kind of financial behaviour that blockchain analysis is designed to surface.

---

## Task 5 — TAUNT

### Q1 — Surface web presence

This one was straightforward — a direct lookup based on information already gathered from the target's social media posts. The posts themselves contained enough identifying details to answer the question without any new techniques.

### Q2 — The deep web paste

The target left a trail on the dark web as well. Using the screenshots provided in the room's hints (I didn't have Tor set up and didn't want to spend the time configuring it for a single lookup), the paste is hosted on a `.onion` site. The full URL, including the MD5 hash that identifies the specific paste, is:

```
http://deepv2w7p33xa4pwxzwi2ps4j62gfxpyp44ezjbmpttxz3owlsp4ljid.onion/show.php?md5=b2b37b3c106eb3f86e2340a3050968e2
```

An important detail here: the answer requires the **full URL including the MD5 hash parameter**. Submitting just the onion domain won't be accepted.

### Q3 — Wireless network geolocation

This task introduces **WiGLE** (wigle.net) — a database of wireless networks mapped by wardriving contributors worldwide. If you've gone through OSINT resources or books, WiGLE comes up frequently as the go-to tool for looking up SSIDs (network names) and BSSIDs (the MAC address that uniquely identifies a specific access point).

The room provides an SSID to search. After creating a free WiGLE account (the free tier has limited daily queries, so precision matters), entering the SSID with default settings and hitting Query returns a single result. The **Net ID** (BSSID) in that result is the answer — it's the hardware-level identifier that distinguishes this specific router from every other router broadcasting the same network name.

---

## Task 6 — HOMEBOUND

### Q1 — Identifying the landmark

Time for reverse image searching. The target posted an image on social media, and the question asks for the real-world location it depicts. I used **Google Image Search** and this one took a solid 20-25 minutes of digging.

The trick was narrowing down what to focus on in the image. I went through several subsections of the picture before zeroing in on a distinctive chimney-like structure near the centre of the frame. Cropping the image to isolate that structure and running the reverse search again produced much more targeted results. A quick follow-up search on the structure identified the landmark — the **Washington Monument** area — and from there, the specific location.

### Q2 — Identifying the location from a second image

Another image from the target's Twitter feed required the same treatment. Running it through Google Image Search with some creative cropping led to identifying the location. The answer involved a location code that could be confirmed with a straightforward search.

### Q3 — Finding the lake

This was the geolocation challenge that required the most patience. The target posted an image showing a body of water near a distinctive landmass. I used **earth3dmap.com** (specifically the 3D globe view at `https://earth3dmap.com/3d-globe/`) to try to match the terrain.

The key identifying feature was an **S-shaped island or landmass** visible on the left side of the target image. After scanning potential matches on the 3D globe and cross-referencing with the Twitter image, I found a match. On the right side of the matched area, an oval dark-blue patch stood out — that's the lake. Zooming in revealed its name.

### Q4 — The city

This one circled back to the dark web access points page from Task 5. The same page that provided the paste URL also listed geographic information, including the **city name** where the target's wireless access point was located. No guessing required — the answer was right there on the page.

---

## What I took from this

OSINT is deceptively simple in concept and surprisingly time-consuming in practice. The individual techniques here — metadata extraction, reverse image search, blockchain analysis, PGP key inspection — are all straightforward once you know they exist. The hard part is knowing *which* technique to apply and *where* to look, which is something that only comes from doing exercises like this one.

The two techniques I found most valuable were the PGP key email extraction and the WiGLE wireless lookup. PGP keys are published deliberately as a trust mechanism, which makes them one of the more reliable OSINT sources — people don't usually put fake emails in keys they intend others to use for encrypted communication. WiGLE is the kind of tool that's obvious in hindsight but completely invisible if nobody points you to it: the idea that a global database of wireless networks exists, mapped by volunteers driving around with laptops, sounds absurd until you search an SSID and get a single precise result with GPS coordinates.

The Git commit history trick in Task 4 is worth internalising too. Every `git commit` is permanent by default, and even when sensitive data is removed in a later commit, the original version is one `git log` away. This applies well beyond CTF challenges — leaked API keys, passwords, and wallet addresses in public repositories are a real and common attack surface.
