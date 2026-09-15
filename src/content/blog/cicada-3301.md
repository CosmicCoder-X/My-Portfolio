---
title: "Cicada 3301: The Puzzle Nobody Has Ever Finished"
date: 2026-09-15
summary: "In January 2012, someone posted a single image to 4chan with a hidden message challenging the internet to find them. Three years, three puzzle rounds, steganography, book ciphers, physical posters in a dozen countries, and a 74-page book written in a runic alphabet nobody had ever seen before — and more than a decade later, most of it is still unsolved."
tags: ['Cicada 3301', 'Cryptography', 'Puzzles', 'Internet Mystery', 'Steganography']
draft: false
---

Most internet mysteries fall apart the moment someone actually looks closely. Cicada 3301 is the opposite. The harder people looked — and thousands of very capable people did look, for years — the more real it turned out to be, and the less anyone understood why it existed at all.

## It started with a duck

On January 4, 2012, an image showing white text on a black background appeared on 4chan's /x/ board. It read: "Hello. We are looking for highly intelligent individuals. To find them, we have devised a test. There is a message hidden in this image. Find it, and it will lead you on the road to finding us. We look forward to meeting the few that will make it all the way through. Good luck." It was signed **3301**.

Buried in the image's raw data, viewable in a plain text editor, was a Caesar-shifted string that decoded to a URL. That page led to a picture of a duck — a visual nudge toward the word "outguess," a real steganography tool built for hiding data inside images. Running the original image through OutGuess pulled out a second hidden payload: a link to a Reddit post containing 75 pairs of numbers and two more images. The numbers turned out to be **Mayan numerals**, and matching them against the characters of the subreddit's own name revealed the next step in the chain. ([Boxentriq](https://www.boxentriq.com/guides/cicada-3301-first-puzzle-walkthrough))

From there the 2012 puzzle kept escalating: a book cipher keyed to a Welsh legend printed in Bulfinch's *Mythology*, a phone number that answered with a recording setting a prime-number task, a second book cipher run against William Gibson's poem *Agrippa (A Book of the Dead)*, and — for the first time — a **PGP-signed message**, so that once genuine, every future 3301 post could be verified against a known key and every copycat could be told apart from the real thing. People who made it far enough eventually got a private email. What was in it, nobody who received one has ever fully disclosed. ([Cybereason](https://www.cybereason.com/blog/malicious-life-podcast-the-mystery-of-cicada-3301))

## This wasn't only happening on a screen

What separated Cicada 3301 from a normal alternate-reality game was that some of its clues weren't online at all. Solvers who cracked certain stages were handed GPS coordinates, and those coordinates pointed at physical, printed posters — a lamppost in Seattle, a street sign in Warsaw, a telephone pole in Seoul, plus confirmed drops in Paris, Miami, and several more cities across the US, Poland, South Korea, and Australia. Each poster carried a QR code that, scanned, pushed the solver forward exactly one more step. ([Uncovering Cicada Wiki](https://uncovering-cicada.fandom.com/wiki/Map_of_all_locations_of_3301s_posters))

Pulling that off means someone with real logistics — not one bored person with a laptop — physically printed and placed matching posters on multiple continents, on the same puzzle, in the same window of time. It's one of the strongest pieces of evidence that whoever was behind this had actual resources and actual coordination, whatever their actual goal turned out to be.

## Joel Eriksson and the puzzle that repeated itself

A second round launched exactly a year later, January 4, 2013, following a similar shape — steganography, ciphers, a fresh hunt — and drew in Swedish security researcher **Joel Eriksson**, who documented his own run through it in detail. His account is one of the clearest first-hand records of what actually solving a Cicada stage step-by-step looks like, rather than a retrospective summary. ([ClevCode](https://clevcode.org/cicada-3301/))

The following January, on January 4, 2014, a third round arrived — and this is the one that produced the artifact people are still fighting with today.

## The book nobody can finish reading

The 2014 puzzle ended by releasing something genuinely unlike anything the earlier rounds had produced: the **Liber Primus**, Latin for "First Book" — a 74-page manuscript written entirely in an unfamiliar runic alphabet. Solvers eventually mapped that alphabet to Latin letters and numbers and named the resulting key the **Gematria Primus**, a 29-symbol system built from a mix of Anglo-Saxon runes.

Cracking the alphabet turned out to be the easy part. Once the runes could be transliterated into Latin letters, most pages still didn't read as plain text — some are enciphered again on top with Vigenère-style keys, others with shifted or reversed alphabets, others against streams built from prime numbers, and some by methods nobody has identified at all. Community solving efforts over the following decade have chipped away at it page by page, and as of the most recent public tallies, a solid majority of the book remains genuinely unread. ([Boxentriq — Liber Primus Guide](https://www.boxentriq.com/guides/cicada-3301-liber-primus))

Think about what that actually means: a puzzle designed in 2014, using cryptographic techniques anyone could in principle throw a computer at, has successfully resisted a global crowd of cryptographers, security researchers, and hobbyists for over ten straight years.

## Marcus Wanner and the small handful who admit anything

Almost everyone who has ever reached deep into Cicada's later stages has stayed anonymous — the puzzle's own instructions, from the very first image, implied that secrecy was part of what 3301 was actually testing for. **Marcus Wanner** is the rare exception. He solved the 2012 puzzle as a home-schooled 15-year-old in Copper Hill, Virginia, and unlike almost every other far-stage solver, put his real name behind his account of it in interviews with mainstream outlets, later going on to study computer science and work in network security. ([Virginia Tech Magazine](https://www.archive.vtmag.vt.edu/sum15/ology.html))

What people who did reach the final stages describe, consistently, is receiving a private email confirming they'd made it through, followed by nothing further that's ever been made public. No one who received that email has published what came after it. Whether that's because there genuinely wasn't anything more, or because whoever runs Cicada asked them not to and they've simply honored that for over a decade, is still an open question. ([CBS News](https://www.cbsnews.com/news/cicada-3301-code-breaking-scavenger-hunt-has-the-internet-mystified/))

## So who actually built this

Nobody knows, and that's not for lack of trying. The leading theories split roughly three ways: an intelligence or signals-intelligence agency running an unconventional recruitment funnel (not as far-fetched as it sounds — GCHQ has genuinely run public cryptographic puzzles for exactly that purpose), a private cybersecurity or cryptography collective looking to build an invite-only community of people who'd already proven they could do the work, or some kind of large-scale collaborative art project with no recruitment angle at all. Every one of those theories has circumstantial support. None of them has ever been confirmed, by Cicada or by anyone else. ([Wikipedia](https://en.wikipedia.org/wiki/Cicada_3301))

A public puzzle briefly resurfaced via Cicada's Twitter account in January 2016 confirming the account was still controlled by whoever originally ran it, but it never grew into a full fourth round the way 2012, 2013, and 2014 had. ([Yahoo Finance](https://finance.yahoo.com/news/over-silence-mysterious-online-puzzle-220615265.html)) Since then, silence — aside from an entirely unrelated ransomware crew that started calling itself "Cicada3301" in 2024, which security researchers have been clear has no connection to the original puzzle beyond having stolen a recognizable name.

## Why it's still worth caring about

Most viral internet puzzles get solved within days because the creator wants them solved — the mystery is the marketing, and the answer is the payoff. Cicada 3301 inverted that completely. Whoever built it seemingly didn't want a large audience; they wanted a very small, very specific one, and built a filter precise enough to lose almost everyone else along the way. Thirteen-plus years on, the filter is apparently still working. The Liber Primus is still sitting there, in an alphabet the whole internet already knows how to read, saying something almost nobody has actually been able to hear.

That's the part that keeps people coming back to it. Not the mystery of who's behind it — plenty of things online have anonymous creators. It's that the puzzle itself is still, genuinely, unbeaten.
