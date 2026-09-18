---
title: 'The Red Team Tool That Got Handed to Ransomware Gangs for Free'
date: 2025-12-29
summary: "Brute Ratel C4 was built specifically to slip past the EDR tools its own creator used to work on. It worked so well that state-linked hackers were caught abusing it before the public even knew it existed, and then a Russian cracking group blew the whole thing wide open, and ransomware gangs like Black Basta and BlackCat just... helped themselves."
tags: ['Ransomware', 'Red Team Tools', 'Cybercrime History', 'EDR Evasion', 'APT29']
draft: false
---

Here's a genuinely uncomfortable idea for anyone building offensive security tools: what happens when the thing you built specifically to sneak past antivirus and EDR gets stolen and handed to the actual criminals you were training defenders against? That's not hypothetical. That's exactly what happened to Brute Ratel C4.

## Built by someone who used to be on the other side

Brute Ratel C4 (BRC4 for short) first showed up in December 2020, built by an Indian security researcher named **Chetan Nayak**, who goes by "Paranoid Ninja" online. And here's the detail that makes the whole story land differently: Nayak wasn't some outsider guessing at how EDR works. He'd previously worked as a detection engineer at **both CrowdStrike and Mandiant**, two of the biggest names in exactly the kind of endpoint detection technology BRC4 was built to slip past. He built the tool other red teamers use to simulate attackers, using firsthand knowledge of how the defenders actually catch people.

It worked. Really well, actually: well enough that it started showing up in places nobody had licensed it for, before most of the security industry had even heard its name.

## Spotted in the wild before the leak even happened

In July 2022, a full two months before the crack that's the main event of this story, Palo Alto Networks' Unit 42 found a BRC4 sample sitting on VirusTotal that dodged detection from **56 different antimalware vendors**. What made it notable wasn't just that it evaded everything; it was *how* it was packaged. The sample was bundled as a self-contained ISO file containing a malicious Windows shortcut, a payload DLL, and a legitimate copy of Microsoft's OneDrive updater: a delivery pattern that lined up closely with known techniques from **APT29**, the Russian state-linked group also known as Cozy Bear. ([Unit 42](https://unit42.paloaltonetworks.com/brute-ratel-c4-tool/))

So before the tool was even public knowledge to most defenders, it was already apparently in the hands of a nation-state hacking crew. Not a great sign for how contained this thing actually was.

## The crack that broke the dam

Then, on September 13, 2022, an archive called `bruteratel_1.2.2.Scandinavian_Defense.tar.gz` got uploaded to VirusTotal. A Russian-speaking cracking group calling themselves **"Molecules"** got hold of it, reverse-engineered the license verification, and stripped it out entirely. From there it moved through private Telegram channels first, and within weeks it was sitting in the open on **BreachForums, CryptBB, RAMP, Exploit.in, and XSS.is**: basically a tour of every major English- and Russian-language cybercrime forum at once. ([SANS](https://www.sans.org/blog/cracked-brute-ratel-c4-framework-proliferates-across-the-cybercriminal-underground))

Nayak, understandably furious, initially accused a different security firm, MdSec, of being the source of the leak: a claim that turned out to be unfounded and was walked back. Nobody's ever definitively pinned down who actually uploaded the original file to VirusTotal in the first place. Which is its own small mystery sitting inside the bigger one.

## What ransomware crews actually did with it

Once a cracked, license-free copy of a legitimate EDR-evasion C2 framework is floating around cybercrime forums for free, it's not really a question of *if* ransomware operators pick it up, just which ones, and how fast.

**Black Basta** is one of the clearest documented cases. Security researchers at Trend Micro tracked an infection chain where a **Qakbot** malware infection was used to drop Brute Ratel onto a compromised network, which was then used for the lateral movement and persistence work that eventually led to a full **Black Basta ransomware** deployment: a textbook access-broker-to-ransomware handoff, just with a stolen red-team tool doing the middle step instead of a bespoke one. Unit 42's own incident response work on a telecom provider attack traced the same pattern: phishing email in, Brute Ratel for the foothold, Black Basta as the payload. ([Unit 42](https://unit42.paloaltonetworks.com/threat-assessment-black-basta-ransomware/))

**BlackCat** (also known as ALPHV) was documented doing the same thing: deploying Brute Ratel as part of its own intrusion toolkit rather than building or licensing something from scratch. Two of the more prolific ransomware operations of the era, both reaching for the same cracked pentest framework once it was sitting there for free. ([Infosecurity Magazine](https://www.infosecurity-magazine.com/news/blackcat-ransomware-group-pen-test/))

The appeal for a ransomware operator is exactly the appeal Nayak built the tool around in the first place: it's specifically engineered to not look like Cobalt Strike to the detection signatures everyone had already gotten good at spotting Cobalt Strike with. A cracked copy handed the exact same evasion advantage red teams paid for to whoever grabbed it off a forum.

## The tool is still around, and still legitimate, if you can prove it

Brute Ratel didn't fold after any of this. It's still actively developed and sold today: version 2.3, codenamed "Flux," shipped in October 2025 with a full rebuild of its implant using a custom compiler aimed at reducing its memory footprint and improving operational security even further. ([Brute Ratel C4](https://bruteratel.com/release/2025/05/15/Release-Rinnegan/))

What changed is who's allowed to buy it. The company now only accepts payment by bank wire transfer specifically so they can verify who's actually paying, and licenses are sold only to registered businesses with verifiable domains and business history: no more anonymous crypto payments to a security tool vendor, which is exactly the kind of lesson you'd expect a company to learn the hard way after watching a cracked copy of their product end up inside a ransomware gang's toolkit. The tool's still exactly as good at evading EDR as it ever was. Getting your hands on a legitimate copy is just a lot harder than it used to be, on purpose.
