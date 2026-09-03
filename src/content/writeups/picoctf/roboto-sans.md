---
title: 'Roboto Sans'
target: 'picoCTF — Roboto Sans'
difficulty: 'easy'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where the challenge name hinted at robots.txt, which contained base64-encoded strings — one decoding to js/myfile.txt — and navigating to that path on the server returned the flag.'
role: 'appsec'
tags: ['web-exploitation', 'robots-txt', 'base64', 'enumeration', 'picoctf']
problem: 'A web application where the flag is hidden somewhere on the server, not necessarily on the visible website. The challenge name hints at the robots exclusion protocol.'
action: 'Recognised the "Roboto Sans" name as a reference to robots.txt, found base64 strings in the file, decoded them to discover the path js/myfile.txt, and navigated there to retrieve the flag.'
outcome: 'Retrieved picoCTF{Who_D03sN7_L1k5_90B0T5_718c9043} from a text file hidden at a path that was base64-encoded inside robots.txt.'
draft: false
---

## Background

Roboto Sans is a picoCTF Web Exploitation challenge. The description is minimal — "The flag is somewhere on this web application not necessarily on the website. Find it." — but the challenge name itself is the biggest hint: "Roboto Sans" is a play on the Roboto font and robots.txt, the file that instructs web crawlers which paths to index or ignore. The challenge is about looking where the site tells bots not to look.

---

## The application and robots.txt

The challenge URL loaded a yoga studio website called "Flexed" — a polished landing page with navigation links (Home, About, Yoga, Pricing, Yoga Online, Contact us), a hero section reading "Gather New Body Energy", and a CONTACT US button. Nothing on the visible page pointed to a flag.

![Flexed yoga studio website at saturn.picoctf.net:65352 showing an orange-accented header with Email: demo@gmail.com and Contact: +71 71234567, navigation bar with Home/About/Yoga/Pricing/Yoga Online/Contact us, and a hero image of a woman meditating by a lake with the text "Gather New Body Energy" and a CONTACT US button.](/writeups/picoctf-roboto-sans/01.png)

The challenge name pointed straight at `robots.txt`, so navigating to `/robots.txt` was the first move. The file contained the standard `User-agent: *` directive with two disallowed paths — `/cgi-bin/` and `/wp-admin/` — both of which returned 404 when visited. More interesting were several base64-encoded strings scattered in the file. Decoding them revealed:

- `ZmxhZzEudHh0` decoded to `flag1.txt`
- `anMvbXlmaWxlLnR4dA==` decoded to `js/myfile.txt`

The other strings decoded to garbage, but `js/myfile.txt` was a clean, plausible server path.

---

## Following the decoded path

Navigated to `saturn.picoctf.net:65352/js/myfile.txt` and the flag was sitting there in plain text.

![Browser showing saturn.picoctf.net:65352/js/myfile.txt with the flag displayed as plain text: picoCTF{Who_D03sN7_L1k5_90B0T5_718c9043}.](/writeups/picoctf-roboto-sans/02.png)

`picoCTF{Who_D03sN7_L1k5_90B0T5_718c9043}`

---

## What I took from this

Roboto Sans is a gentle introduction to web reconnaissance. The lesson is that `robots.txt` is not a security mechanism — it is a polite request to crawlers, and it is publicly readable by anyone. Listing sensitive paths in `robots.txt` to keep them out of search engines actually advertises those paths to anyone who checks the file. The base64 encoding added a thin layer of obfuscation, but base64 is an encoding scheme, not encryption — it is trivially reversible and offers zero security. In real-world assessments, `robots.txt` is one of the first files to check during reconnaissance because developers frequently list admin panels, staging environments, and internal tools there, inadvertently creating a roadmap for attackers.
