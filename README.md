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

Profile links live in the `links` array. Set `primary: true` on the few you
want in the sidebar; every link appears in the footer and on the About page
either way.

The hero illustration is `public/portrait.png`, generated from
`assets/portrait-source.jpg` by `npm run assets`. To change it, replace the
source file and re-run that command — it cuts a real alpha channel from the
line art so the strokes sit on the cream with no visible panel behind them.
Set `person.portrait` to `''` to remove it; the layout closes up with nothing
missing.

### Publish a writeup

1. Go to `src/content/writeups/` and open the folder for the platform
   (`tryhackme`, `hackthebox`, `picoctf`, `bugbounty`, `otherctf`).
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
It is marked `draft: true`, so it does not appear on the live site. Delete it
whenever you like.

### Tags are load-bearing now

Tags no longer just decorate the page. They drive three things:

- **`/skills/`** — capability clusters, each counted from the writeups whose
  tags match it. This is the page a recruiter should land on.
- **`/tags/`** — a browsable index. Tags used in 2+ writeups get their own page.
- **Related work** at the foot of each writeup, ranked by shared tags.

So spell them consistently: lowercase, hyphenated, `sql-injection` not
`SQL Injection`. If a technique you use often isn't landing in the right
capability, add the tag to the matching cluster's `match` list in
`src/lib/evidence.ts`.

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

**Node 22.12 or newer is required** — Astro 7 will refuse to start on Node 20.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # writes dist/
npm run preview  # serve the built site
```

### Regenerating the social card and icons

`public/og.png`, `public/apple-touch-icon.png` and `public/favicon-32.png` are
committed. Re-run this only after editing `assets/og.svg` or
`public/favicon.svg`:

```bash
npm run assets
```

The writeup count is baked into `assets/og.svg` — bump it there when it drifts
far enough to matter. Netlify never runs this script.

---

## How the site is put together

**Numbers are computed, never typed.** Every count on the site — the stats on
the cover, the capability bars, the platform totals — is derived from the
markdown at build time by `src/lib/evidence.ts`. They cannot drift from the
content, and you never have to remember to update one.

**Capability clusters** live in `src/lib/evidence.ts`. Each is a list of tag
fragments; a writeup evidences the capability if any of its tags matches. Tag
matching is on whole hyphen-delimited tokens, not raw substrings — a plain
`includes` made `path-trave(rsa)l` count as cryptography.

**Markdown transforms** run at build time in `src/lib/rehype-article.mjs`:
image-only paragraphs become `<figure>` with the alt text as a visible caption,
code blocks get a copy button, and wide tables get a scroll container. Doing it
here rather than in the browser means it all works with JavaScript off.

**The search and filter** on writeup lists is progressive enhancement. The full
list is always in the HTML; the controls stay hidden until the script wires
itself up, so a visitor without JavaScript sees every entry and no dead search
box. Deep links work: `/writeups/?q=kerberos`, `/writeups/?role=soc`.

**No inline scripts are emitted**, which is why `netlify.toml` can set
`script-src 'self'` with no `'unsafe-inline'`. If you ever add an
`is:inline` script, that header has to loosen — don't, if you can avoid it.

**Single theme, on purpose.** Cream ground, warm ink, one oxblood accent. The
only place a second hue is allowed is the difficulty ramp, where the colour
carries real meaning.

**The evidence matrix** on the home page (`src/components/EvidenceGrid.astro`)
draws one cell per published writeup, grouped by platform, ink density keyed
to difficulty. It is generated from the content, so it grows on its own as you
publish — you never touch it.

**A persistent identity rail, not a top bar.** Orientation stays put and the
content column moves. Below 62rem it collapses to a compact bar with a
scrolling nav strip.

**Adding a photo.** Set `person.portrait` in `src/data/site.ts` to something
like `'/portrait.jpg'` after dropping the file in `public/`. It appears beside
the hero; left empty, the layout closes up with nothing missing.

**Sections have no numbers.** An earlier version numbered each band with a hex
byte offset. They were decoration dressed as structure — the sections are not
a sequence — and with a permanent rail on the left they were a second
competing rail. `Band` still accepts an `offset` prop so callers don't all
need editing, but it is ignored.

## Watch out for OneDrive

This repository lives inside a OneDrive folder. During one build OneDrive
pulled `src/content/writeups/tryhackme/include.md` out from under the build
(`UNKNOWN: unknown error`) and left it deleted in the working tree; it was
restored with `git checkout`. If a writeup ever vanishes or the build reports
an unreadable file, check `git status` before assuming you deleted it —
and consider moving the repo outside OneDrive.

## Stack

Astro · Content collections (markdown) · ~9 KB of vanilla JS for search,
lightbox, copy buttons and caption toggles · Archivo / Source Serif 4 /
IBM Plex Mono
