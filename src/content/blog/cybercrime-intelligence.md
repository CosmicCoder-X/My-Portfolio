---
title: 'Inside Cybercrime Intelligence: Tools, Law, and Tradecraft'
date: 2026-07-07
summary: "Cybercrime intelligence work sits at the intersection of tooling, law and personal risk in a way most intel disciplines don't — a DOJ guidance document draws the line between standard practice and a federal crime, and the same OPSEC mistake that burns a source can put an investigator's real identity in front of the people they're investigating."
tags: ['Threat Intelligence', 'OSINT', 'OPSEC', 'Legal', 'Sock Puppets', 'Dark Web', 'Cybercrime']
draft: false
---

Cybercrime intelligence work sits at the intersection of tooling, law and personal risk in a way most intel disciplines don't. The tooling is the easy part to learn. The other two are where the discipline actually lives.

## The tooling layer

Threat Intelligence Platforms — ThreatConnect, Anomali ThreatStream, MISP, OpenCTI, EclecticIQ — exist to aggregate indicators of compromise from multiple feeds into one place, enrich them with additional context, and push the result into security controls automatically. They're the plumbing.

Vendor intelligence platforms sit a layer above that, and it's worth knowing where each one specializes: Mandiant Advantage and Flashpoint lean toward the adversary and victim side, Team Cymru and Recorded Future toward infrastructure and capability — the same four questions the Diamond Model asks, just split across different commercial products with different visibility into the underground. Before signing with any of them, the questions that actually matter are about the data itself: what sources feed it (OSINT, SOCMINT, HUMINT, malware telemetry, dark web, netflow), how current it stays, whether it maps to your organization's actual Priority Intelligence Requirements, and — the one that gets skipped — whether it's usable enough that analysts will actually open it. A platform with perfect data nobody logs into isn't intelligence, it's a subscription.

## The legal line

In February 2020, the Justice Department's Cybersecurity Unit published [formal guidance on this exact question](https://www.justice.gov/criminal/criminal-ccips/page/file/1252341/dl?inline=) — *Legal Considerations when Gathering Online Cyber Threat Intelligence and Purchasing Data from Illicit Sources* — specifically because "is this legal" turns out to have a real, non-obvious answer that depends heavily on the specific action:

| Activity | Standard practice, or a problem? |
|---|---|
| Accessing a site through unauthorized means (exploiting a vuln, stolen creds) | A crime — CFAA exposure |
| Accessing a cybercrime forum under a fake identity | Standard practice |
| Scraping information from a cybercrime site | Standard practice |
| Using someone else's real identity in a forum | Can be, without their written consent |
| Communicating directly with cybercriminals | Depends — consult legal counsel |

The throughline is that passive collection under a persona is normal and expected; anything that starts to look like unauthorized access, impersonation of a real person, or direct engagement needs a second opinion before it happens, not after. Doxxing carries its own, separate legal exposure on top of this — publishing someone's PII, even a confirmed cybercriminal's, can cross into harassment or privacy law depending on jurisdiction, and getting the identification wrong or publishing prematurely can actively obstruct a law enforcement investigation that was already in progress.

One risk in this work isn't a legal question at all. Investigators researching cybercrime forums and dark web markets will, sometimes, encounter CSAM. The professional standard here is unambiguous: never preserve, store, or transmit it — not even for documentation purposes. Save the URL only, notify your legal department, notify law enforcement, and report the incident to NCMEC. There's no version of "just this once, for the report" that's acceptable.

## Staying attributable to no one

OPSEC in this field starts from an uncomfortable premise: in a worst case, something that started in cyberspace follows you into physical space. Threat modeling for it is the same exercise as any other threat model — what needs protecting (personal data, investigative findings, the org's own sensitive material), who the threats are (the cybercriminals being investigated, competitors, the malware sitting on the forum you're browsing), and what mitigates the risk (VPNs, Tor, end-to-end-encrypted messaging, and just as importantly, consistent behavior).

Consistency is the part that's easy to get wrong. A VPN hides your real IP, but if your persona "Dmitri" is supposed to be Russian, Dmitri needs a Russian exit node *every single session* — not just when you remember. The failure mode isn't usually a technical leak; VPNs don't prevent behavioral leaks at all, and a persona with a Russian name, a European timezone, and text that reads like a native English speaker is a correlation problem waiting to be noticed, by exactly the same kind of pattern-matching this piece has spent the rest of its length describing investigators doing to *targets*. Correlation fingerprinting — IP, timezone, language, word choice, stitched together — is a real deanonymization technique, and it runs both directions.

Tails and Whonix exist as turnkey answers to the infrastructure half of this problem: Tails is a live, amnesic OS that forces all traffic through Tor and leaves no trace on the host machine after a session; Whonix does the same through a two-VM architecture, isolating the workstation from the network gateway so a workstation compromise can't leak the real IP even if something goes wrong. Both trade speed for the guarantee that nothing escapes the Tor tunnel by accident. On the commercial side, managed-attribution platforms like Authentic8's Silo take a different approach — routing an entire browsing session through infrastructure procured for a specific persona's claimed location, with screenshot, translation and multi-site search tooling built in, so the platform itself enforces the discipline a human might forget under pressure.

## Requirements drive everything upstream

Cybercrime falls into two categories worth keeping distinct: cyber-*dependent* crime, which can only exist because the fifth domain does — DDoS, ransomware — and cyber-*enabled* crime, traditional crime (fraud, theft) that technology happens to have made easier and faster. Criminal Intelligence generally, and cybercrime intelligence as its digital-domain instance, exists to proactively collect and interpret both, aiming to anticipate and intervene rather than just document after the fact.

What actually gets collected should never be arbitrary — it's driven by Priority Intelligence Requirements, and those requirements look completely different depending on whose desk you're sitting at. The UK's NCA might be focused on organized crime rings operating out of London; the FBI's terrorism program is watching for something else entirely; a bank's fraud team cares about stolen cards moving through underground markets; a crypto exchange cares about threat actors trying to launder stolen funds specifically through *their* platform. Same underlying discipline, completely different collection plan, because the questions being asked aren't the same. Once collected, raw data moves through the standard funnel — operational environment to data to information to intelligence — and finished intelligence gets shared back out using the Traffic Light Protocol, a simple originator-controlled label (TLP:RED through TLP:CLEAR) that says exactly how far a given piece of information is allowed to travel before it's shared further.

## Why the persona has to exist before the collection does

Sock puppet accounts aren't an optional extra — they're a foundational requirement of the collection phase, full stop. Research conducted under an identity tied to your real life is research that's already compromised the moment anyone on the other end looks you up, and the same accounts frequently do double duty backstopping a persona used in social-engineering or red-team pretexting. Once a persona exists, the actual hunt for collection sources runs through a predictable set of channels: general search engines and subreddits pointing at `.onion` links, hidden-service directories like dark.fail that maintain curated lists, hidden-service search engines like Ahmia and Torch that attempt to index the dark web the way Google indexes the clear web, and purpose-built crawlers for automating the visits at scale.

Whatever gets pulled back through those channels needs sorting into three related but distinct categories: selectors are simply anything identifiable used to filter data during collection; identifiers are the subset of selectors that distinguish one unique digital entity from another — an IP, an email; indicators are the subset that specifically signal compromise or attack — IOCs and IOAs. All indicators are selectors, but not all selectors are indicators, and keeping that distinction straight is what stops a collection plan from drowning in noise that merely identifies something, without ever telling you anything happened.

## The layer underneath all of it

None of this stays separable from cryptocurrency for long, because cryptocurrency is how almost everything downstream of a cybercrime forum eventually gets paid for. A wallet is functionally an email account, a key is the password, an address is where the mail gets delivered — and which chain that address belongs to is readable straight off its shape: Bitcoin's legacy addresses start with `1`, SegWit with `bc1q`; Ethereum addresses are 40-character hex strings starting `0x`; Monero addresses run 95 characters and start with `4`. That last one matters more than it looks: Monero's stealth addresses obscure the source, amount and destination of every transaction by design, which is exactly why an investigation that hits a Monero wallet has to stop looking for an on-chain answer and start looking for an off-chain one instead.
