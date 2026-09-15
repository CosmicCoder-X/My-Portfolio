---
title: 'xDedic: The Marketplace That Sold Access to Your Own Servers'
date: 2026-09-15
summary: "xDedic didn't sell drugs or stolen cards — it sold logins. Specifically, working remote-desktop logins to over 70,000 hacked servers, including government machines going for as little as $6 a pop. A security firm exposed the whole operation in 2016. The market just shrugged, moved to Tor, and kept growing anyway."
tags: ['Dark Web', 'RDP', 'Cybercrime History', 'Data Breach', 'xDedic']
draft: false
---

Most of the markets I've covered so far sell something you can picture — drugs, stolen card numbers, malware logs. xDedic sold something weirder and, honestly, more unsettling: **working remote access to servers that weren't theirs.** Not stolen data pulled off a server. The server itself, still running, still doing its job, with someone else now holding the keys and renting them out.

## What you were actually buying

The product was Remote Desktop Protocol access — RDP, the same thing IT admins use to log into a Windows server from anywhere. xDedic's operators (or the vendors supplying them) would brute-force or otherwise crack weak RDP credentials across the internet, confirm the access worked, and then list it for sale on the marketplace like a product catalog. Buyers could filter listings by country, operating system, even by what software was installed on the box — because knowing a hacked server already has point-of-sale or accounting software running on it is worth paying extra for if you're planning to abuse exactly that.

And the prices were absurdly low for what you were getting. According to Kaspersky's original research, access to some **EU government servers went for as little as $6**. On the higher end, listings ran up toward $10,000 depending on what the server was worth to the right buyer. ([Securelist](https://securelist.com/xdedic-the-shady-world-of-hacked-servers-for-sale/75027/))

## How big this actually got

Kaspersky Lab blew the lid off xDedic in June 2016, and the numbers were startling for the time: **70,624 hacked servers** for sale, from **416 distinct sellers**, spanning **173 countries**. That wasn't a snapshot of some fringe operation — it was a carefully maintained, actively growing catalog; three months earlier, in March 2016, the count had been around 55,000. Whoever ran this thing was treating it like a real business with real inventory management.

Buried in that catalog were **453 servers specifically running point-of-sale software**, spread across 67 countries — exactly the kind of machine you'd target if your plan was to install credit-card-skimming malware like Backoff and start harvesting card numbers straight off the till.

## Getting publicly exposed didn't kill it — it just adapted

Here's the part that genuinely surprised me researching this: Kaspersky's report was a big deal, it made headlines, security teams around the world scrambled to check whether their own servers were on the list — and xDedic barely blinked. The operation moved deeper onto Tor and, instead of shrinking under the spotlight, kept growing. By later counts from threat intel firm Flashpoint, the number of listed servers had climbed past **85,000**. Getting exposed by one of the biggest security research firms on the planet turned out to be a speed bump, not an ending.

That ending took law enforcement instead — and it took a while to fully arrive.

## The takedown, and the much longer cleanup after it

On January 24, 2019, authorities seized xDedic's domains and shut the infrastructure down for good, in a joint operation spanning the US, Belgium, Germany, Ukraine and the Netherlands, coordinated with Europol and Eurojust support. Investigators put the total fraud enabled through the marketplace at somewhere around **$68 million**. ([DOJ](https://www.justice.gov/usao-mdfl/pr/xdedic-marketplace-website-involved-illicit-sale-compromised-computer-credentials-and))

But taking the site offline wasn't the same as finishing the case. It took the Justice Department **five more years** to actually wrap up prosecutions against everyone involved. The full accounting, announced in January 2024, landed on **19 individuals charged** — administrators, developers, buyers, and even customer service reps who'd helped run the operation day to day. ([The Hacker News](https://thehackernews.com/2024/01/doj-charges-19-worldwide-in-68-million.html))

The two site administrators give a good sense of how long this actually dragged out. **Pavlo Kharmanskyi**, a Ukrainian national, was arrested back in 2019 — caught trying to enter the United States — and eventually got 30 months. **Alexandru Habasescu**, a Moldovan national, wasn't arrested until **2022**, picked up in Spain's Canary Islands, three years after the site itself had already been dark; he was sentenced to 41 months. By the time the DOJ closed the book on the whole case, 12 of the 19 had already been sentenced, five more were waiting on sentencing, and two were still sitting in the UK awaiting extradition. ([BleepingComputer](https://www.bleepingcomputer.com/news/security/us-charged-19-suspects-linked-to-xdedic-cybercrime-marketplace/))

## Why this one's worth remembering differently

Silk Road, AlphaBay and Hydra were all selling something you'd instinctively call contraband. xDedic sold *access* — quiet, working, legitimate-looking access to machines that belonged to real governments, real businesses, real hospitals for all anyone knew, repackaged and resold to whoever wanted a launchpad. It's the same idea as a stolen-car chop shop, except the car never left the driveway and the owner had no idea anyone else had a set of keys. Getting exposed publicly didn't stop it. It took an actual multinational law enforcement operation to shut the doors — and years more after that to actually put hands on everyone who'd been running it.
