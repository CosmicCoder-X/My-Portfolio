---
title: 'Infiltration'
target: 'Hack The Box — Infiltration'
difficulty: 'easy'
date: 2025-08-29
summary: 'An OSINT challenge — enumerating Evil Corp LLC employees across social media, navigating past two deliberate rabbit holes on LinkedIn and Twitter, and finding the flag on an employee badge visible in an Instagram photo.'
role: 'soc'
tags: ['osint', 'social-media', 'linkedin', 'twitter', 'instagram', 'reconnaissance', 'rabbit-holes', 'employee-enumeration']
problem: 'Investigate Evil Corp LLC across social media, enumerate employees, and find the flag hidden in their digital footprint. Two deliberate rabbit holes test persistence before the real flag.'
action: 'Found the Evil Corp LLC LinkedIn page with a base64-encoded fake flag in the tagline (decoded to "You can do this keep going"). Enumerated employees — Alia Mccarty on Twitter had a D&D tweet baiting HTB{ class names, another rabbit hole. Found Eryn Mcmahon on Instagram (eryn_mcmahon12) whose desk photo showed an E Corp employee badge with the real flag below the barcode.'
outcome: 'Flag HTB{Y0ur_Enum3rat10n_1s_Str0ng_Y0ung_0ne} recovered from an employee badge in an Instagram photo after navigating past two deliberate rabbit holes on LinkedIn and Twitter.'
draft: false
---

## Background

Infiltration is an OSINT challenge built around employee enumeration and social media reconnaissance against a fictional company. The challenge description is straightforward — investigate Evil Corp LLC and find something useful. What makes this challenge interesting isn't the final find (a flag in a photo) but the path to it, which includes two deliberate rabbit holes designed to waste time and test whether you keep digging after finding something that looks like progress.

---

## LinkedIn — the first rabbit hole

Searching for "Evil Corp LLC" leads to a LinkedIn company page. The company is listed under Information Technology and Services with an E CORP logo and 53 employees. The tagline immediately catches the eye: `HTB{WW91IGNhbiBkbyB0aGlzLCBrZWVwIGdvaW5nISEh}`.

![LinkedIn company page for Evil Corp LLC showing the E CORP logo, Information Technology and Services category, the string HTB{WW91IGNhbiBkbyB0aGlzLCBrZWVwIGdvaW5nISEh} underlined in red below the company name, a Follow button, and View all 53 employees.](/writeups/htb-infiltration/01-linkedin-evil-corp.png)

It looks like a flag, but the content inside the braces is base64. Decoding it reveals: **"You can do this, keep going!!!"** — a deliberate fake flag designed to mislead. The challenge authors embedded it in the most obvious place (the company page tagline) knowing that anyone doing OSINT on a company would check LinkedIn first.

---

## Twitter — the second rabbit hole

Enumerating Evil Corp LLC employees across social media turns up **Alia Mccarty** (@mccarty_alia) on Twitter. Her bio reads "Internal Communications Designer at Evil Corp LLC, secret nerd, loves role playing - it's all about communication!" — joined March 2019 with 17 following and 32 followers.

![Twitter profile of Alia Mccarty @mccarty_alia showing the bio Internal Communications Designer at Evil Corp LLC secret nerd loves role playing, joined March 2019, 17 Following, 32 Followers, with the Media tab selected.](/writeups/htb-infiltration/02-twitter-alia-mccarty.png)

Checking her Media tab reveals a tweet that reads **"What Clas-ERR HTB{s are you?"** — posted alongside D&D class icons (Cleric, Barbarian, Druid, Monk, Warlock, Bard, Wizard, Ranger, Paladin, Sorcerer). The "ERR HTB{" in the text is designed to make you think the flag is one of the class names. Trying `HTB{Cleric}`, `HTB{Barbarian}`, and so on leads nowhere — another rabbit hole.

![Tweet by Alia Mccarty reading What Clas-ERR HTB{s are you with an image showing ten D&D class icons — Cleric, Barbarian, Druid, Monk, Warlock, Bard, Wizard, Ranger, Paladin, Sorcerer — posted March 25 2019 via Twitter Web Client.](/writeups/htb-infiltration/03-twitter-dnd-tweet.png)

---

## Instagram — finding the real flag

Continuing to enumerate Evil Corp LLC employees across platforms turns up **Eryn Mcmahon** on Instagram (eryn_mcmahon12). Her bio describes her as a "Passionate Relational Factors Analyst working at Evil Corp LLC" and includes a link to her LinkedIn profile.

![Instagram profile of eryn_mcmahon12 showing Eryn Mcmahon, Passionate Relational Factors Analyst working at Evil Corp LLC, with a LinkedIn link to www.linkedin.com/in/eryn-mcmahon-4a7b98181, 10 posts, 66 followers, 8 following.](/writeups/htb-infiltration/04-instagram-eryn-mcmahon.png)

Her LinkedIn had nothing useful, but browsing her Instagram posts reveals a photo of her desk — a MacBook with a spreadsheet on screen, a phone, a pen, and an **E Corp employee badge** on a lanyard. The badge shows her name (Eryn Mcmahon), her title (Relational Factors Analyst), a barcode, and below the barcode — the flag in small text.

![Instagram photo posted by Eryn Mcmahon showing a desk with a MacBook Pro displaying a spreadsheet, a black phone, a pen, and an E Corp employee badge on a lanyard showing the name Eryn Mcmahon, title Relational Factors Analyst, a barcode, and text below the barcode containing the flag.](/writeups/htb-infiltration/05-instagram-badge-flag.png)

The flag: **HTB{Y0ur_Enum3rat10n_1s_Str0ng_Y0ung_0ne}**

---

## What I took from this

The challenge is as much about persistence as it is about OSINT technique. The two rabbit holes — the base64 fake flag on LinkedIn and the D&D class bait on Twitter — are deliberately placed at the points where most people would stop looking. Finding something that looks like a flag creates a psychological stopping point, and the challenge tests whether you validate your findings before submitting and keep enumerating when the first results don't pan out.

The flag name reinforces the message — **Y0ur_Enum3rat10n_1s_Str0ng**. Thorough enumeration means checking every employee across every platform, not stopping at the first promising lead. In real-world OSINT and social engineering reconnaissance, the most useful information is rarely on the company page itself. It's in the personal accounts of employees who post photos of their workspaces, badge photos, internal documents on screen, or other details they don't realise are sensitive. Eryn's Instagram post is a textbook example — a casual desk photo that exposes an employee badge, which in a real engagement could provide enough information to clone a badge, craft a phishing pretext, or impersonate an employee.
