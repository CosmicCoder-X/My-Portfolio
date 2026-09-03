---
title: 'KaffeeSec — SoMeSINT'
target: 'TryHackMe — KaffeeSec — SoMeSINT'
difficulty: 'medium'
date: 2025-08-29
summary: "An OSINT investigation starting from a single social media profile, spiralling outward through Twitter, Reddit, reverse image searches, follower analysis, Wayback Machine snapshots, and cached Pastebin links to uncover a target's hidden identity and personal secrets."
role: 'soc'
tags: ['osint', 'social-media', 'twitter', 'reddit', 'wayback-machine', 'reverse-image-search', 'pastebin', 'social-engineering', 'reconnaissance']
problem: "Given a target named Thomas with a public social media presence, map his digital footprint through open-source intelligence — extracting personal details, identifying connected individuals, pivoting across platforms, and recovering deleted content through web archives."
action: "Extracted biographical details from Thomas's public posts and identified his fiancee through Twitter follower analysis. Pivoted to her account for relationship details and used reverse image search to identify vacation locations. Used the Wayback Machine to recover deleted Reddit content, traced cached Pastebin links, cracked a password-protected document, and followed the trail to uncover a hidden relationship and email address."
outcome: "Mapped the complete social graph including Thomas's fiancee Francesca, their vacation to Koblenz, his coworker in Nuuk Greenland, cached Pastebin content, a cracked document password, and his hidden relationship with Emilia Moller."
draft: false
---

## Background

This room is a social media OSINT exercise built around a fictional character named Thomas. The premise is simple — you're given a starting point and asked to extract as much information as possible using nothing but publicly available data — but the investigation chain gets progressively deeper, moving from surface-level bio scraping through cross-platform correlation and eventually into web archive forensics and password-protected documents. It's a good representation of how real OSINT investigations work: each answer opens a new thread to pull, and the final picture only comes together after following every connection to its end.

The room is structured in phases that mirror a real investigation's natural progression. The early tasks establish the target's identity and immediate social circle. The middle section expands outward through relationship mapping and reverse image searches. The final section digs into deleted content and cached links — the kind of material people think disappears when they delete a post, but which the Wayback Machine and search engine caches quietly preserve.

---

## Establishing the target — Thomas's profile

The investigation begins with Thomas's social media presence. His Twitter bio is the first source of structured intelligence, and two answers come directly from it.

His **favourite holiday is Christmas** — listed in his bio as "X-mas," which is common shorthand on social media profiles where people share seasonal preferences. This kind of detail seems trivial, but in a real OSINT context, holiday preferences feed into social engineering pretexts and can help narrow down cultural and religious background.

His **birth date is 12-20-1990**, pulled from a Reddit post where he mentions it directly. Cross-referencing birth dates across platforms is one of the most reliable ways to confirm that two accounts belong to the same person — people rarely lie about their birthday consistently across every platform, and even when they do, the inconsistency itself becomes a data point.

His **Twitter background picture is of Buddha**, which contributes to building a profile of his interests and beliefs. Background images, unlike profile pictures, are often overlooked during OSINT investigations, but they frequently reveal affiliations, interests, or travel history that the subject didn't consciously think of as "sharing."

---

## Mapping the social circle — Francesca

The next pivot point is Thomas's fiancee. Examining his Twitter followers and following list reveals her handle: **@FHodgelink**. Follower analysis is one of the most productive early moves in any social media investigation — people's closest relationships are almost always reflected in their follower graphs, and a fiancee or partner is typically among the first accounts that follow and interact with a target.

Francesca's own Twitter account becomes a rich secondary source. Her tweets and interactions with Thomas surface several personal details about their shared life.

**Their vacation destination was Koblenz, Germany.** Francesca posted a photo from the trip, and while the location wasn't explicitly tagged, a reverse image search identified the distinctive cityscape — Koblenz sits at the confluence of the Rhine and Moselle rivers, and its architecture is recognisable enough that image search engines match it reliably. The flag format (City, Country with 7 letters each) also served as a useful constraint to confirm the answer. Reverse image search is one of the most underused tools in OSINT — people post vacation photos assuming the location is only obvious to people who were there, forgetting that Google Images, TinEye, and Yandex can geolocate a skyline in seconds.

**Francesca's mother's birthday is December 25th.** This came from a tweet where Francesca mentioned it — family milestones are frequently shared on social media, and they're valuable in OSINT because they expand the investigation's social graph to include family members who might have their own digital footprints worth examining.

**Their cat's name is Gotank**, mentioned in a tweet (specifically the one at `twitter.com/FHodgelink/status/1343023195855736837`). Pet names are a classic OSINT data point — they're frequently used as security question answers, password components, or Wi-Fi network names.

**Francesca's favourite show is 90 Day Fiancee**, shared in one of her tweets. Media preferences feed into the broader profile and can also serve as social engineering vectors — knowing someone's favourite show gives you conversation starters, phishing pretexts, and even potential password hints.

---

## Turning back the clock — Wayback Machine and deleted content

This is where the investigation shifts from surface-level OSINT to forensic recovery. The room's final section asks questions that can't be answered from current, live social media profiles — the content has been deleted or modified since the investigation's timeline. This is where the Wayback Machine becomes essential.

**Thomas's coworker is minik hans.** This answer required checking the Wayback Machine for a snapshot of Thomas's Reddit activity from around December 21, 2020. The live profile no longer contained the relevant interaction, but the archived version preserved it. The Wayback Machine's value in OSINT cannot be overstated — it captures periodic snapshots of public web pages, and deleted posts, removed comments, and modified profiles often survive in its archives long after they've been scrubbed from the live web.

**His coworker lives in Nuuk, Greenland.** Thomas himself is based in Nuuk according to his profile, and examining minik hans's Reddit post history confirmed he lives in the same city. The fact that both are in Nuuk, Greenland — a city with a population of roughly 19,000 — makes the coworker connection plausible and suggests they likely know each other outside of Reddit as well.

**The Pastebin paste ID is ks{ww4ju}.** Hans's archived Reddit profile at `web.archive.org/web/20210104143852/https://old.reddit.com/user/minikhans` contained a link to a Pastebin paste. Running the Wayback Machine against the March 23rd snapshot of that profile surfaced the paste ID. Pastebin is a common dead-drop for sharing sensitive information — its paste IDs are short, easy to share in DMs or comments, and the pastes themselves can be set to expire, making archived snapshots the only way to recover them after expiration.

**The password for the next link is ks{1qaz2wsx}.** The Pastebin content led to another link that required a password. The password itself — `1qaz2wsx` — is a well-known keyboard-walk pattern (the first two columns of a QWERTY keyboard typed top-to-bottom), which is exactly the kind of "clever" password that people use thinking it's secure because it's not a dictionary word. In practice, keyboard walks are in every password cracking wordlist.

**Thomas's mistress is Emilia Moller.** Entering the password from the previous step into the protected URL revealed this information — the entire chain of Pastebin links and passwords was essentially a breadcrumb trail leading to something Thomas wanted hidden. In a real investigation, this kind of multi-hop discovery chain is common: people hide sensitive information behind layers of indirection, but each layer only needs one weak link to unravel.

**Thomas's email address is straussmanthom@mail.com**, found in the body of the document that the password unlocked. An email address is often the single most valuable OSINT artifact — it can be used to search breach databases, registration records, and other platform accounts, making it a pivot point for expanding the investigation far beyond social media.

---

## What I took from this

The room demonstrates a principle that defines real OSINT work: intelligence compounds. A Twitter bio gives you a name. The name gives you followers. The followers give you a fiancee's handle. The handle gives you tweets. The tweets give you a vacation photo. The photo gives you a city. Each individual piece of information is mundane on its own — a holiday preference, a pet's name, a background image — but chained together they build a comprehensive profile that the target never intended to make public.

The Wayback Machine section is the most instructive part. People delete posts and assume they're gone, but web archives, search engine caches, and even browser caches on shared machines can preserve content indefinitely. The fact that a deleted Reddit comment from December 2020 led through an archived Pastebin link to a password-protected document revealing a hidden relationship demonstrates exactly why OPSEC is so difficult — you don't just need to secure your current footprint, you need to account for every snapshot, cache, and archive that might have captured it before you cleaned it up. For SOC analysts, this is valuable context for understanding how threat actors research their targets before launching social engineering campaigns: the same techniques used in this room are exactly what an attacker runs through before crafting a spearphishing email.
