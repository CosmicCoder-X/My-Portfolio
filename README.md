# divyansh404.xyz

My portfolio, built on a domain I won from a CTF competition.

Security writeups, projects, and a blog. Built with [Astro](https://astro.build),
deployed on Netlify.

---

## How to change things

You don't need to install anything. Everything below is done on github.com in a
browser. Every commit triggers a rebuild on Netlify, and the live site updates
about a minute later.

### Change your bio, links, projects, certifications

Open **`src/data/site.ts`** and edit it. That single file holds every piece of
personal text on the site. Nothing else needs touching.

### Publish a writeup

1. Go to `src/content/writeups/` and open the folder for the platform
   (`tryhackme`, `hackthebox`, `picoctf`, `bugbounty`).
2. **Add file → Create new file**.
3. Name it something like `blue.md` — lowercase, hyphens, ends in `.md`.
   That name becomes the URL: `/writeups/tryhackme/blue/`.
4. Paste this at the top and fill it in:

```yaml
---
title: 'Blue'
target: 'TryHackMe — Blue'
difficulty: 'easy'
date: 2026-09-01
summary: 'One sentence a recruiter could read alone and still get it.'
role: 'pentest'
tags: ['Windows', 'SMB', 'EternalBlue']
problem: 'What was in front of you.'
action: 'What you did about it.'
outcome: 'What it produced.'
---
```

5. Write the walkthrough underneath it. Commit.

`difficulty` must be one of `easy`, `medium`, `hard`, `insane`.
`role` must be one of `pentest`, `soc`, `appsec`, `llm`, `forensics`.

There's a filled-in example at `src/content/writeups/tryhackme/template.md`.
Read it once, then delete it.

### Publish a blog post

Same idea, in `src/content/blog/`. Only needs `title`, `date`, `summary`, `tags`.

### Hide something you're still working on

Add `draft: true` to the front matter. It disappears from the site until you
remove that line.

### Add a new platform section

Add an entry to `platforms` in `src/data/site.ts`, then create the matching
folder under `src/content/writeups/`.

---

## If the build fails

Netlify will email you and the live site will keep serving the last good
version — a failed build never takes the site down.

It's almost always a typo in the front matter. Check, in this order:

- Are both `---` lines there?
- Is `difficulty` one of the four allowed words?
- Is the date `YYYY-MM-DD` with no quotes?
- Does every value with an apostrophe in it sit inside quotes?

The build log on Netlify names the file and the field.

---

## Before you publish anything

- No live flags.
- No credentials that still work.
- No unsanitised client or program data — bug bounty findings only go up once
  they're disclosed and the program allows it.
- Blur what needs blurring in screenshots before they go in.

---

## Running it locally (optional)

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # writes dist/
```

## Stack

Astro · Content collections (markdown) · no client-side JavaScript ·
Archivo / Source Serif 4 / IBM Plex Mono
