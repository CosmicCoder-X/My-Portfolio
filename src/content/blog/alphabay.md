---
title: "AlphaBay: The Dark Web Market That Was 10x Silk Road (and Died Because of a Hotmail Address)"
date: 2026-09-15
summary: "AlphaBay made Silk Road look small — ten times the size, hundreds of thousands of listings, a founder worth $23 million living it up in Bangkok. It took a coordinated international sting, a fake marketplace the Dutch police secretly ran for 27 days, and one genuinely baffling email header mistake to bring it down. Then it came back from the dead once, and even that didn't last."
tags: ['Dark Web', 'AlphaBay', 'Cybercrime History', 'Bitcoin', 'Tor']
draft: false
---

So if Silk Road was the dark web's first real marketplace, AlphaBay was the one that looked at Silk Road and said "cute, now watch this." By the time it got taken down, it was roughly **ten times the size** of Silk Road at its peak. Same basic idea — anonymous drugs-and-worse marketplace, Tor for hiding, crypto for paying — just run by someone who apparently had zero chill about scaling it up.

## Who built this thing

The guy behind it was a Canadian named **Alexandre Cazes**, operating under the handle "Alpha02." He soft-launched the site in November 2014 and had it fully up and running by December 22, 2014. And then he just... let it grow. And grow. And grow.

By the time DOJ finally caught up with it in 2017, AlphaBay had **over 200,000 users and more than 40,000 vendors**. The listings breakdown alone tells you how far past "just drugs" this had gotten: over **250,000 listings for drugs and toxic chemicals**, plus more than **100,000 listings** for stolen ID documents, counterfeit goods, malware, hacking tools, and firearms. This wasn't a niche corner of the internet anymore. This was a full-blown illegal Amazon with a working search bar. ([DOJ](https://www.justice.gov/archives/opa/pr/alphabay-largest-online-dark-market-shut-down))

## The mistake that ended it (and it's a genuinely wild one)

Okay so here's the thing about running the biggest illegal marketplace on the planet: you'd think the guy at the top would be paranoid about every single detail. Cazes was not.

AlphaBay sent out a standard welcome email to new users and vendors when they signed up. Totally normal, every site does this. Except the email header on AlphaBay's version had a **Hotmail address** baked into it. And that Hotmail address led investigators straight to Cazes's actual **LinkedIn and MySpace accounts**. The guy running a marketplace worth tens of millions of dollars got got by an email header — the digital equivalent of leaving your wallet on the counter of the bank you just robbed.

From there it was just a matter of building the case and moving. Thai police arrested Cazes in Bangkok on July 5, 2017. He'd apparently been living there for seven or eight years under the cover of being "a computer programmer," which, technically, sure, not wrong.

## What they found when they grabbed him

The guy was loaded, and not subtly. When Thai police seized his assets, the haul included **four Lamborghinis and a Porsche**, papers for **three houses**, and **eight bank accounts** — the whole pile valued around 400 million Thai baht. On top of that, Thai authorities had already seized **911 Bitcoin** from him and handed it over to US authorities. DOJ put his total worth at somewhere north of **$23 million**. Not bad for running a website, if you ignore the federal drug trafficking and money laundering charges waiting for him back in the States. ([Bangkok Post](https://www.bangkokpost.com/thailand/general/1285923/dead-canadian-fugitive-lived-in-thai-luxury), [SCMP](https://www.scmp.com/news/world/united-states-canada/article/2103704/his-death-thai-prison-cell-canadian-darknet))

He never made it to that extradition, by the way. More on that in a second, because the takedown itself deserves its own spotlight first — it might be the single cleverest law enforcement operation in dark web history.

## The Hansa honeypot, or: how cops ran a drug market for 27 days

This is genuinely one of my favorite law enforcement stories, full stop, not even just in the cybercrime category.

Here's what happened. There was another major marketplace at the time called **Hansa Market**. In June 2017, German police arrested its two administrators. Now, here's the clever part — running Hansa as a covert police-operated honeypot afterward would've been illegal under German law, so the Germans handed the whole operation over to Dutch police, who *could* legally do that. The Dutch quietly took over Hansa, kept it running exactly as before, and just... waited.

Then, a few weeks later, US and Thai authorities took down AlphaBay. Publicly. Loudly. And exactly as predicted, AlphaBay's hundreds of thousands of displaced users scrambled to find a new home — and a massive wave of them landed on Hansa, having absolutely no idea it was now a police-run sting operation. Europol recorded something like an **eightfold jump** in new Hansa registrations, so many that the "administrators" (cops) had to temporarily shut off new signups because the servers couldn't handle the load.

For **27 days**, Dutch police ran what was effectively the busiest drug marketplace in Europe. They collected real IP addresses off vendors, quietly reset security settings to expose buyer locations, recorded every single password in plaintext (which meant they could try those same passwords on *other* dark web markets, because password reuse is timeless), and even modified the site's PGP encryption feature to secretly keep a plaintext copy of every "encrypted" message. They logged roughly **27,000 transactions** as evidence before finally shutting it down too. ([Krebs on Security](https://krebsonsecurity.com/2017/07/exclusive-dutch-cops-on-alphabay-refugees/))

Two of the biggest markets on the dark web, taken down within weeks of each other, and one of them was secretly a trap the whole back half of its life. That's the kind of operation that ends up in law enforcement training slides forever.

## The part where it gets dark, literally

While all that was unfolding, Cazes was sitting in a Thai detention cell awaiting extradition to the US. On July 12, 2017 — just days after his arrest, hours before a scheduled deportation hearing — guards found him dead. He'd hanged himself with a towel tied to the toilet door. Officially ruled a suicide.

That's it. That's the end of Alexandre Cazes's story. No trial, no verdict, no extradition. The guy who built a $1-billion-scale criminal marketplace never actually faced a courtroom for it.

## It came back from the dead, once

Here's a twist Silk Road never got: AlphaBay actually **came back**.

In August 2021, someone using the handle **"DeSnake"** announced on dark web forums that AlphaBay was relaunching — and claimed to have been the original site's security administrator and co-founder, the guy who ran operations alongside Cazes and was never caught. To back it up, DeSnake signed the announcement with the *same PGP key* the original AlphaBay had used back in its heyday, which multiple longtime users independently verified. That's about as close to a cryptographic signature as "trust me, it's actually me" gets in this world. ([BleepingComputer](https://www.bleepingcomputer.com/news/security/notorious-alphabay-darknet-market-comes-back-to-life/))

AlphaBay 2.0 came with some notable new rules, presumably learned the hard way: no fentanyl, no firearms, no COVID-19 vaccines, and no targeting former Soviet states — the last one being a pretty standard "don't attract the wrong kind of government attention" move in this world. They even built something called **AlphaGuard**, tech that let the whole server infrastructure self-destruct if anything about it changed unexpectedly, presumably so nobody could pull a Hansa on them twice.

It didn't last, though. AlphaBay 2.0 just went dark in February 2023 — no announcement, no goodbye post, nothing. It never came back after that.

## What's left of the name today

As of right now, there's no real AlphaBay. The brand exists mostly as **phishing bait** — scam pages floating around dark web forums and clearnet lists that copy the old login screen, purely to harvest credentials and drain whatever crypto people try to deposit. So the most enduring legacy of one of the biggest drug marketplaces in internet history is, fittingly, other criminals using its corpse to scam people who are nostalgic for it.

Ten times the size of Silk Road, a founder worth $23 million, taken down alongside possibly the cleverest sting operation the dark web has ever seen, dead within a week of arrest under circumstances nobody fully explains, resurrected once by a ghost from its own past, and now surviving only as a name scammers borrow. If Silk Road's story reads like a true-crime documentary, AlphaBay's reads like the sequel that somehow got even weirder.
