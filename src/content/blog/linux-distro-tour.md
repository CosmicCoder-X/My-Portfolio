---
title: "A Tour of Linux's Weirdest and Most Wonderful Family Tree"
date: 2026-09-15
summary: "Linux isn't one operating system. It's a kernel that a few thousand completely different groups of people have wrapped in wildly different clothes: a friendly desktop for your grandmother, a toolbox with three thousand hacking tools bolted on, a government surveillance apparatus, and one that was built entirely by a single man who genuinely believed God was giving him instructions. This is a tour through that family, and it gets stranger the further you go."
tags: ['Linux', 'Operating Systems', 'Open Source', 'Kali Linux', 'TempleOS']
draft: false
---

People say "Linux" like it's one thing, and that's always bugged me a little, because it isn't. Linux, strictly, is just the kernel: the part that talks to your hardware. Everything sitting on top of it is somebody's choice, made by a completely different group of people with a completely different philosophy about what a computer is even for. Put a few hundred of those choices side by side and you get something closer to a family reunion than a product lineup: the responsible ones, the tinkerers, the paranoid ones, the state-sponsored ones, and, genuinely, this is real, we're getting there, the one guy who thought he was building God a temple.

Let's actually walk the whole family.

## The ones that just want to be your desktop

**Debian** is where a lot of this story actually starts. It was founded in 1993 by Ian Murdock, and the name is literally a mashup of his and his then-girlfriend's names: Deb and Ian. Debian's whole personality, three decades on, is still "stability above almost everything else." New software goes through a long, deliberately unglamorous testing pipeline before it's trusted enough to ship, which is exactly why so many *other* distros, including a couple further down this list, just build on top of Debian instead of starting from scratch.

**Ubuntu** is the distro that took Debian and asked "okay, but what if a normal human being had to install this." Backed by a UK company called Canonical, founded by Mark Shuttleworth, Ubuntu's entire reason for existing was smoothing off Debian's rough, developer-facing edges (better hardware detection, a real installer, sane defaults), and it worked well enough that for a huge number of people, Ubuntu basically *was* their introduction to Linux existing at all.

**Fedora** takes the opposite bet from Debian's caution: it ships newer, less battle-tested software faster, and functions as the public proving ground for Red Hat: yes, that Red Hat, the enterprise Linux company IBM bought for $34 billion. Whatever survives and stabilizes in Fedora eventually filters down into Red Hat's paid enterprise product. It's simultaneously a community hobbyist OS and a corporate R&D pipeline, which is a strange but genuinely functional arrangement.

**Linux Mint** exists because a chunk of the Ubuntu community, at various points, felt Ubuntu had wandered off in a direction they didn't love (interface changes, mostly), and Mint quietly became the "no, just give me a normal-looking desktop that works" option. Its Cinnamon desktop environment is deliberately unadventurous in the best way: it looks like a desktop from 2010 in the sense that it looks like a *desktop*, task bar and start menu and all, and that's exactly the point.

## Arch: the one that makes you build it yourself

**Arch Linux** sits in a completely different emotional category from all four of those. Nothing gets installed for you by default: no desktop environment, often not even a lot of what you'd consider basic, and you're expected to assemble the whole system piece by piece from the command line, guided by what's widely regarded as some of the best documentation in the entire open-source world, the Arch Wiki. It runs on a rolling release model, meaning there's no such thing as "Arch 12" or "Arch 13"; you just keep updating forever, one package at a time.

The payoff for the extra effort is the **Arch User Repository (AUR)**, a genuinely enormous, community-maintained collection of install scripts for software that isn't in Arch's official repos at all. "I use Arch, btw" became a whole internet joke for a reason: there's a real, if occasionally insufferable, pride in having built the thing yourself instead of clicking through an installer.

## The offensive-security trio

This is where things start looking a lot more like my day job than my desktop.

**Kali Linux** is the one basically everyone in security has at least booted once. It's maintained by Offensive Security and traces its lineage back through **BackTrack** (the dominant pentesting distro before Kali existed) all the way to a 2004 project called Whoppix ("WhiteHat Knoppix"). Kali properly launched in 2013 as a full rebuild on top of Debian rather than BackTrack's older, more ad-hoc base, and today it ships with **over 600 pre-installed tools** covering everything from wireless attacks to forensics to reverse engineering. It's less "an operating system" and more "a toolbox that happens to boot."

**Parrot OS**, also Debian-based, comes out of Palermo, Italy, built by Lorenzo "Palinuro" Faletra and first released in April 2013, the exact same year as Kali, developed entirely independently. Parrot leans harder into privacy and anonymity alongside the offensive tooling, and its interface has genuinely earned a reputation as the more polished-looking of the two. Same job, different taste. ([The Security Noob](https://thesecuritynoob.com/interviews/about-parrot-os-and-interview-with-its-founder-lorenzo-palinuro-faletra/))

**BlackArch**, true to its name, is built on Arch rather than Debian, meaning you inherit all of Arch's "assemble it yourself" philosophy, except the toolbox you're assembling from is absurd: **over 2,800 penetration testing tools**, more than Kali and Parrot combined. It's not really meant to be a daily driver. It's meant to be the drawer you open when you specifically know which one of 2,800 tools you need.

## Tails: the one built to disappear

**Tails**, The Amnesic Incognito Live System, plays a different game entirely. You don't install it to a hard drive; you boot it fresh off a USB stick every single time, it routes every scrap of network traffic through Tor by design, and when you shut the machine down, it takes its own memory with it. Nothing persists unless you deliberately configure an encrypted, opt-in persistent volume. It exists for exactly one kind of person: someone who needs the computer they're using right now to leave behind no evidence that they ever used it at all: journalists, activists, abuse survivors, and, less nobly, whoever else has a reason to want the same thing.

## Two governments, two completely different reasons to build their own

Here's where the family tree gets genuinely strange, because two different governments have built their own Linux distributions for reasons that could not be more opposite.

**Astra Linux** is Russia's. Built by a company called RusBITech on a Debian base, it's been formally certified by Russia's Ministry of Defense, the FSB, and the Federal Service for Technical and Export Control, cleared to handle information up to and including **"top secret"** under Russia's classification system. It's actively replacing Windows across the Russian military, and it's spread well past the army into state institutions and into major state-linked industry: Gazprom, Rosatom, the national railway operator RZD. The whole project reads as a direct, deliberate answer to one question: what happens to a country's most sensitive computing infrastructure the day it decides it can no longer trust an American operating system vendor. ([Security Affairs](https://securityaffairs.com/86407/security/astra-linux-russia-army.html))

**Red Star OS** is North Korea's, and it is a genuinely different animal: built on an old version of Fedora and deliberately skinned to look almost exactly like macOS, right down to the dock. It's not built for military hardening. It's built to watch its own citizens. Security researchers who got their hands on it and presented their findings at the Chaos Communication Congress found that Red Star silently **watermarks every file that touches a USB drive**: it grabs the machine's hard disk serial number, encrypts it, and stamps it invisibly into the file itself, so that if that file is later found circulating, the authorities can trace exactly which computers it passed through and in what order. On top of that, it ships a hidden antivirus-style background process, one that, notably, **not even the machine's root user is allowed to access or disable**, capable of deleting files the state doesn't want existing, on command. One researcher's summary of the whole thing has stuck with me since I first read it: "the wet dream of a surveillance state dictator." ([The Register](https://www.theregister.com/security/2015/12/29/north-korean-operating-system-is-a-surveillance-states-tour-de-force/913901))

Same starting material (Linux, repackaged by a government), and one country built a security-hardened OS to keep its secrets in, while the other built a surveillance apparatus to keep its own people from getting anything out. Same tree, genuinely opposite branch.

## TempleOS: one man, one God, one operating system

And then there's the one I honestly don't know how to introduce casually, because it deserves better than a punchline.

**Terry A. Davis** was a real, formally trained systems programmer: an electrical engineering background, real professional chops, someone who by every account actually understood computer architecture at a level most working programmers never reach. In his late twenties he was diagnosed first with bipolar disorder and later with schizophrenia, and over the years that followed his life included repeated hospitalizations and periods of homelessness. Starting in 2003, genuinely believing he was building it on direct instruction from God, Davis began work on what would eventually become **TempleOS**, describing it, without irony, as "God's third temple."

What makes this impossible to wave off as just a sad footnote is that he actually *built the entire thing, alone*: his own 64-bit kernel, his own bootloader, his own filesystem, his own compiler, his own text editor, his own graphics system, and his own programming language from scratch, which he named **HolyC**. It runs at a deliberately fixed 640×480 resolution in 16 colors, gives every program full, unrestricted access to the whole machine with no memory protection at all: a genuine, considered design decision reflecting his belief in radical simplicity, not a limitation he failed to overcome. People who actually dug into the source code, including working kernel engineers, came away impressed by real chunks of it, mental illness and religious framing notwithstanding. He wasn't a hobbyist rambling about an OS he never shipped. He shipped it. Solo.

Davis died in August 2018 at age 48, struck by a train in Oregon; nobody has ever been able to say with certainty whether it was an accident or not. ([OSNews](https://www.osnews.com/story/30710/creator-of-templeos-terry-davis-has-passed-away/))

I think about TempleOS every time someone tells me "one person can't build a real operating system anymore." One person built an entire one, compiler and all, while living through something none of the rest of us on this list had to survive to finish our work.

## What this whole family tree actually shows

Debian wants stability. Ubuntu wants your grandmother to be comfortable. Fedora wants to try things first. Mint just wants a desktop that looks like a desktop. Arch wants you to earn it. Kali, Parrot and BlackArch want to break into things. Tails wants to have never existed. Astra wants to keep Russia's secrets. Red Star wants to watch North Korea's people. And TempleOS wanted, as far as I can tell, to talk to God.

Same kernel, every single time. It's never really been about the code underneath. It's about what somebody (a company, a government, one guy who never stopped believing) actually wanted a computer to *be*.
