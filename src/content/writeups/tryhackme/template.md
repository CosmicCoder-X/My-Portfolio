---
title: 'How to write a writeup on this site'
target: 'Template'
difficulty: 'easy'
date: 2026-08-26
summary: 'A worked example of the format. Copy this file, change the front matter, replace the body. Delete it once you have real writeups up.'
role: 'pentest'
tags: ['Template', 'Meta']
problem: 'You want to publish a writeup and you have never touched a static site generator.'
action: 'Copy this file, rename it, edit the block at the top and then the text underneath.'
outcome: 'The page below builds itself — listing, difficulty chip, URL and all.'
draft: true
---

This page is a real writeup as far as the site is concerned. It renders exactly
the way a genuine one will. Read it once, then delete it.

## The block at the top

Everything between the two `---` lines is called front matter. It is the only
part with rules. Each field does something visible:

| Field | What it does |
|---|---|
| `title` | The heading and the link text in listings |
| `target` | The room, box or challenge name — shows as a chip |
| `difficulty` | One of `easy`, `medium`, `hard`, `insane`. Sets the chip colour |
| `date` | `YYYY-MM-DD`. Sorts the listings, newest first |
| `summary` | The grey line under the title in listings |
| `role` | One of `pentest`, `soc`, `appsec`, `llm`, `forensics` |
| `tags` | Skills a recruiter might search for |
| `problem` / `action` / `outcome` | The three-line case summary in the box above |
| `draft` | Add `draft: true` to hide a page while you work on it |

If the build fails after you add a file, it is almost always a typo in here — a
missing quote, or a `difficulty` that isn't one of the four allowed words.

## Where the file goes

The folder decides the platform:

```
src/content/writeups/tryhackme/my-room.md    →  /writeups/tryhackme/my-room/
src/content/writeups/hackthebox/my-box.md    →  /writeups/hackthebox/my-box/
src/content/writeups/picoctf/my-chal.md      →  /writeups/picoctf/my-chal/
src/content/writeups/bugbounty/my-find.md    →  /writeups/bugbounty/my-find/
```

The filename becomes the URL, so keep it lowercase with hyphens.

## Writing the body

Below the front matter, write normally. Headings with `##`, lists with `-`,
code in triple backticks:

```bash
nmap -sC -sV -oN scan.txt 10.10.10.10
```

Two things worth holding to, since this is a portfolio and not a blog:

- **Explain the reasoning, not just the command.** Anyone can paste an nmap
  line. The reason a hiring manager keeps reading is the sentence after it that
  says why you ran it and what you expected back.
- **Sanitise.** No live flags, no unredacted client data, no credentials that
  still work. Blur what needs blurring before the screenshot goes in.

## Problem, action, outcome

The box above the walkthrough is the part most people skip and it is the part
most likely to be read. Keep each line to one or two sentences, and write the
outcome as a result rather than a feeling — "escalated to SYSTEM via an
unquoted service path" beats "learned a lot about Windows."
