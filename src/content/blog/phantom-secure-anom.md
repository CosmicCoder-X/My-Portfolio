---
title: "The FBI Built a Phone Company for Criminals, and Criminals Bought It"
date: 2026-09-15
summary: "The FBI took down one encrypted-phone company selling to cartels, and then, instead of stopping there, quietly stood up its own replacement, seeded it into the exact criminal trust networks the first company had built, and spent three years reading every message on it. 12,000 devices, 300 syndicates, 27 million messages, and a legal routing trick clever enough that it deserves its own explanation."
tags: ['FBI', 'ANOM', 'Encrypted Communications', 'Law Enforcement', 'Cybercrime History']
draft: false
---

Most law enforcement takedowns end a story. This one is the rare case where the takedown was actually just chapter one, and the FBI spent the next three years quietly writing chapter two themselves: as a company, selling phones, to the exact people they were investigating.

## What Phantom Secure actually was

Before any of this, there was **Phantom Secure**, a Vancouver-based company run by a Canadian named **Vincent Ramos**, selling what were essentially privacy phones with the "privacy" dialed all the way up to "built for people who cannot afford to be tracked." Ramos and his team took ordinary BlackBerry and Android devices and physically gutted them: pulled the GPS, ripped out the camera and microphone hardware, stripped internet browsing entirely, then loaded them with custom encrypted messaging software that routed everything through servers sitting in countries with famously strict privacy laws, specifically chosen to make legal requests for the data slow, expensive, or simply unanswerable.

It worked exactly as advertised, for exactly the clientele you'd expect. Phantom Secure's customer base ran well past 10,000 devices, and its confirmed clients included the **Sinaloa Cartel** and the **Hells Angels** in Australia, the latter reportedly using the phones to coordinate actual killings. This wasn't a privacy company that happened to attract some bad actors. Criminal organizations were, by a wide margin, who the product was built for.

## How it came apart

The FBI arrested Ramos on March 7, 2018, in Bellingham, Washington, and the case that followed was historically significant for a specific reason: it was the first time US prosecutors treated an encrypted-communications company itself as a criminal racketeering enterprise, rather than treating the technology as neutral and only going after whoever misused it. Ramos pleaded guilty to RICO conspiracy, agreed to forfeit **$80 million**, and in May 2019 was sentenced to nine years in federal prison. He served about five before his release in November 2024, when he was deported back to Canada. ([Wikipedia](https://en.wikipedia.org/wiki/Phantom_Secure), [404 Media](https://www.404media.co/vincent-ramos-ceo-of-encrypted-phone-company-that-sold-to-sinaloa-cartel-freed-from-prison/))

Phantom Secure going dark left an actual market gap: thousands of criminal organizations who'd just lost their trusted communications provider and needed a new one immediately. Which is exactly the gap the FBI decided to fill themselves.

## The FBI doesn't build a competitor. It recruits one that's already being built.

Here's the genuinely clever part, and it starts with something most people get slightly wrong about this story: the FBI didn't invent ANOM from scratch to compete with Phantom Secure. During the Phantom Secure investigation, they found someone connected to that world who was *already* developing the next generation of exactly this kind of device: a hardened, encrypted phone built for the same underground market. Instead of shutting that project down too, the FBI flipped its developer into a **Confidential Human Source** and had him keep building it, on Google Pixel hardware, with one addition nobody else would ever know about: every single message sent through it would also, silently, go straight to law enforcement. ([Engadget](https://www.engadget.com/2018-10-04-phantom-secure-ceo-pleads-guilty-encrypted-cartel-phones.html))

That's the whole trick in one sentence: don't compete with the criminal trust network. Become the next node in it.

## Why criminals actually trusted the thing

This is the part that makes the operation worth studying as *tradecraft*, not just as a sting. ANOM was never advertised anywhere. There was no marketing, no app store listing, no website you could stumble onto. The only way to get a device was through the CHS's own existing distributor network: people who'd already sold Phantom Secure phones and who criminal buyers already trusted personally. And the FBI built an explicit gatekeeping rule into how those distributors operated: you could only buy an ANOM device if you already had a real criminal relationship with the seller, or a reputation in that world solid enough to vouch for you.

In other words, the product's entire credibility came from **word of mouth inside a closed social network that already trusted itself**: the identical mechanism that makes an invite-only darknet forum feel safer than an open one, just running through physical human distributors instead of a website's registration form. Nobody had to be convinced ANOM was secure through marketing copy. They were convinced because the guy handing them the phone was the same guy, or trusted by the same guy, who used to hand them a Phantom Secure.

It worked. Over roughly three years, ANOM grew to more than **12,000 devices**, used by upward of **300 separate criminal syndicates** across more than 100 countries, all of them genuinely believing they were using the most secure phone on the market. ([Wikipedia](https://en.wikipedia.org/wiki/Operation_Trojan_Shield))

## The legal trick that made reading it all possible

Here's the part most retellings skip, and it's honestly the cleverest piece of the entire operation: **how do you legally read the messages of thousands of people across a hundred countries, including some inside the US, without it collapsing into a Fourth Amendment and Wiretap Act nightmare the moment it reaches a courtroom?**

The answer was a genuinely careful piece of jurisdictional engineering. Every message sent through ANOM generated a hidden, encrypted blind-carbon-copy. If a device's mobile country code flagged it as US-based, the FBI **geo-fenced it away entirely**: that copy never routed anywhere the FBI itself could decrypt it, specifically so the Bureau never directly touched the content of a domestic target's messages. Everything else (the non-US traffic) got mirrored instead to a server sitting in an undisclosed **third country**, neither the US nor wherever the message originated, which decrypted and re-encrypted it using a key the FBI already knew. That third country then used **its own court order, under its own domestic law**, to intercept that traffic and forward it on to the FBI through a Mutual Legal Assistance Treaty channel, without the US ever needing prior judicial review to receive it, because the interception itself was never an American legal act in the first place. For the narrow edge case of messages that did originate inside the US and got swept up anyway, the **Australian Federal Police**, not the FBI, screened those separately, specifically for imminent threats to life, under their own procedures rather than a US wiretap standard. ([Lawfare](https://www.lawfaremedia.org/article/legal-tetris-and-fbis-anom-program))

Three separate legal regimes, three separate justifications, stitched together so that no single piece of the operation had to individually satisfy the toughest standard in the room. That's not a loophole anyone stumbled into. That's a structure built deliberately, in advance, specifically to survive the legal challenge everyone involved knew was coming the moment this ever went public.

## The reveal

It stayed running for roughly three years before it all came down at once, on June 7, 2021: a single coordinated global operation across more than 16 countries. By the time the dust settled, the FBI and its partners had quietly decrypted and read more than **27 million messages**, and the public reveal came with over **800 arrests** and a wave of seizures hitting Albanian organized crime networks, the Italian mafia, outlaw biker gangs, and international drug and arms trafficking operations all at once, all of them, until that exact morning, still believing ANOM was the safest phone money could buy. ([GlobalSecurity.org](https://www.globalsecurity.org/security/library/news/2021/06/sec-210608-voa02.htm))

## Why this one actually worked

Strip away the scale and the number, and the whole operation comes down to two separate kinds of cleverness stacked on top of each other. One is social: don't build trust from zero, inherit it: become the successor inside a criminal distribution network that already vouches for itself, rather than trying to out-market an underground economy that doesn't respond to marketing at all. The other is legal: don't ask one jurisdiction to carry the whole weight of an operation this size: split the interception across three separate legal authorities, each individually defensible, so the structure as a whole survives scrutiny that any single piece of it might not have. Phantom Secure got taken down because Vincent Ramos built a company. ANOM worked because the FBI built a *relationship*, with an informant, with a network of criminal distributors, and with three different countries' courts, and let all three of those relationships do the work that a single raid never could have.
