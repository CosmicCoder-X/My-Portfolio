# divyansh404.xyz

Divyansh Agrawal's portfolio, built on a domain won from a CTF competition.

Security writeups, built tools, certifications and a blog, all backed by real
counts computed from the content itself rather than typed by hand. Built with
[Astro](https://astro.build), deployed on Cloudflare Pages.

---

## How to change things

You don't need to install anything. Everything below is done on github.com in
a browser. Every commit triggers a rebuild on Cloudflare Pages, and the live
site updates within a minute or two.

### Change your bio, links, projects, certifications

Open **`src/data/site.ts`** and edit it. That single file holds every piece of
personal text on the site: the hero copy, the bio, projects, education,
experience/roles, credentials, certifications, and profile links. Nothing
else needs touching for a text change.

Profile links live in the `links` array. Set `primary: true` on the ones you
want to appear on the Résumé page's link row; every link appears in the main
footer and on the About page regardless.

The hero illustration is `public/portrait.png`, generated from
`assets/portrait-source.png` by `npm run assets`. To change it, replace the
source file and re-run that command: it cuts a real alpha channel from the
line art (so the strokes sit on the page ground with no visible panel behind
them) and flood-fills the jacket's enclosed cells to solid ink so it reads as
a graphic illustration rather than a sketch. Update `person.portraitAlt` and
the `width`/`height` on the `<img>` in `src/pages/index.astro` to match the
new source's actual pixel dimensions; they're not derived automatically, and
leaving them stale causes a small layout shift when the image loads. Set
`person.portrait` to `''` to remove it; the layout closes up with nothing
missing.

### Publish a writeup

1. Go to `src/content/writeups/` and open the folder for the platform
   (`tryhackme`, `hackthebox`, `picoctf`, `bugbounty`, `otherctf`).
2. **Add file → Create new file**.
3. Name it something like `blue.md`, lowercase, hyphens, ends in `.md`.
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

Screenshots go in the same folder as the writeup. Keep them reasonably sized:
a 2000px-wide PNG straight off a 4K screen renders no better than a resized
one in a ~700px-wide article column, and it makes every page on the site
heavier for no visual benefit. `scripts/optimize-writeup-images.mjs` batches
this for the whole `public/writeups/` tree if it ever needs doing in bulk
(see **Image scripts**, below).

### Tags are load-bearing now

Tags don't just decorate the page. They drive four things:

- **`/skills/`** — capability clusters, each counted from the writeups *and
  projects* whose tags match it (see **Add a project**, below). This is the
  page a recruiter should land on.
- **`/tags/`** — a browsable index. Tags used in 2+ writeups get their own
  page; tags used in 5+ or 10+ stay visible by default, the long tail past
  that is behind a "Show N more" disclosure so the page stays scannable
  instead of turning into a wall of pills.
- **Related work** at the foot of each writeup, ranked by shared tags.
- **The evidence matrix** on the home page, one cell per writeup.

So spell them consistently: lowercase, hyphenated, `sql-injection` not
`SQL Injection`. If a technique you use often isn't landing in the right
capability, add the tag to the matching cluster's `match` list in
`src/lib/evidence.ts`.

### Add a project

Add an entry to the `projects` array in `src/data/site.ts`: `name`, `kind`,
`blurb`, `points`, `stack` (what it's built with, shown as chips), `tags`
(which capability clusters it should count toward on `/skills/`, using the
same tag vocabulary as writeups), and `repo`.

Give it real `tags`, not just a `stack`. A project's tech stack (`Python`,
`React`) doesn't tell `/skills/` what security capability it demonstrates;
its `tags` do (`llm-security`, `network-analysis`). A project with no
matching tags is fine too; not everything has to map to a cluster (a game
dev side project, say), and an empty `tags: []` just means it won't show up
under any capability, which is honest rather than a bug.

### Publish a blog post

Same idea, in `src/content/blog/`. Only needs `title`, `date`, `summary`,
`tags`.

### Hide something you're still working on

Add `draft: true` to the front matter. It disappears from the site until you
remove that line.

### Add a new platform section

Add an entry to `platforms` in `src/data/site.ts`, then create the matching
folder under `src/content/writeups/`.

---

## If the build fails

Cloudflare Pages will show the failed deploy in its dashboard and the live
site keeps serving the last good version; a failed build never takes the
site down.

It's almost always a typo in the front matter. Check, in this order:

- Are both `---` lines there?
- Is `difficulty` one of the four allowed words?
- Is the date `YYYY-MM-DD` with no quotes?
- Does every value with an apostrophe in it sit inside quotes?

The build log in the Cloudflare Pages dashboard names the file and the field.

---

## Before you publish anything

- No live flags.
- No credentials that still work.
- No unsanitised client or program data; bug bounty findings only go up once
  they're disclosed and the program allows it.
- Blur what needs blurring in screenshots before they go in.

---

## Running it locally (optional)

**Node 22.12 or newer is required.** Astro 7 will refuse to start on Node 20.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # writes dist/
npm run preview  # serve the built site
```

### Image scripts

These are one-off tools, run by hand with `node scripts/<name>.mjs` rather
than wired into `package.json`, since they're for occasional bulk cleanup
rather than part of every build:

- **`gen-assets.mjs`** (`npm run assets`) regenerates `public/og.png`,
  the favicons, and `public/portrait.png` from their sources in `assets/`.
  Re-run it after editing `assets/og.svg`, `public/favicon.svg`, or
  `assets/portrait-source.png`. The writeup count baked into `assets/og.svg`
  is typed, not computed; bump it there when it drifts far enough to matter.
- **`optimize-certs.mjs`** re-encodes everything in `public/certifications/`
  as compressed JPEGs in place. Certification scans and CTF certificate
  exports routinely come in at several megabytes each for a page that shows
  them as a grid of thumbnails; Astro's View Transitions snapshot the whole
  page during navigation, so an oversized image payload on one page makes
  *every* transition into or out of it feel slow, not just that page's own
  load.
- **`optimize-writeup-images.mjs`** does the same for `public/writeups/`,
  resizing and re-encoding as palette PNG in place (same filenames, so no
  markdown needs editing). Run it after a bulk import of screenshots, or if
  a particular writeup's images are pushing multiple megabytes.
- **`pdf-to-png.mjs`** rasterizes a certification PDF export to PNG when a
  provider only offers a PDF certificate. Point it at the file; it uses
  pdfjs-dist with the bundled standard fonts and cmaps so embedded text
  renders correctly instead of silently corrupting.

None of these run automatically. If you add certificates or bulk-import
screenshots, re-running the relevant one is on you.

---

## How the site is put together

**Numbers are computed, never typed.** Every count on the site (the stats on
the cover, the capability bars, the platform totals) is derived from the
markdown and from `src/data/site.ts` at build time by `src/lib/evidence.ts`.
They cannot drift from the content, and you never have to remember to
update one.

**Capability clusters** live in `src/lib/evidence.ts`. Each is a list of tag
fragments; a writeup or a project evidences the capability if any of its tags
matches. Tag matching is on whole hyphen-delimited tokens, not raw
substrings; a plain `includes` made `path-trave(rsa)l` count as cryptography.

**Markdown transforms** run at build time in `src/lib/rehype-article.mjs`:
image-only paragraphs become `<figure>` with the alt text as a visible
caption, code blocks get a copy button, and wide tables get a scroll
container. Doing it here rather than in the browser means it all works with
JavaScript off.

**The search and filter** on writeup lists is progressive enhancement. The
full list is always in the HTML; the controls stay hidden until the script
wires itself up, so a visitor without JavaScript sees every entry and no dead
search box. Deep links work: `/writeups/?q=kerberos`, `/writeups/?role=soc`.

**No inline scripts are emitted**, which is why `public/_headers` can set
`script-src 'self'` with no `'unsafe-inline'`. If you ever add an `is:inline`
script, that header has to loosen; don't, if you can avoid it.

**View Transitions, with prefetch.** Navigation swaps the page in place via
Astro's `ClientRouter` instead of a full reload, and `astro.config.mjs`
enables built-in prefetch on a viewport strategy, so the HTML for a link is
usually already fetched by the time it's clicked. View Transitions snapshots
whichever page you're navigating *away from* as well as the one you're going
to, which is why oversized images anywhere on the site show up as a slow
transition somewhere else entirely; see **Image scripts**, above.

**Single theme, on purpose.** A cool near-neutral palette (`--ink #252830`
on `--paper #f5f6f8`), no accent hue at all. Cormorant Garamond for display
type, Inter for UI text, IBM Plex Mono for code and data. The only place a
second visual signal is allowed is the difficulty ramp on writeups, where it
carries real meaning.

**The evidence matrix** on the home page (`src/components/EvidenceGrid.astro`)
draws one cell per published writeup, grouped by platform, ink density keyed
to difficulty. It's generated from the content, so it grows on its own as you
publish; you never touch it.

**A persistent identity rail, not a top bar.** Orientation stays put and the
content column moves. Below 900px it collapses to a compact bar with a
scrolling nav strip.

**Sections have no numbers.** An earlier version numbered each band with a
hex byte offset. They were decoration dressed as structure (the sections are
not a sequence), and with a permanent rail on the left they were a second
competing rail. `Band` still accepts an `offset` prop so callers don't all
need editing, but it's ignored.

## Watch out for OneDrive

This repository lives inside a OneDrive folder. During one build OneDrive
pulled a writeup file out from under the build (`UNKNOWN: unknown error`) and
left it deleted in the working tree; it was restored with `git checkout`. If
a writeup ever vanishes or the build reports an unreadable file, check
`git status` before assuming you deleted it, and consider moving the repo
outside OneDrive.

## Stack

Astro · Content collections (markdown) · Cloudflare Pages · a small amount of
vanilla JS for search, lightbox, copy buttons and caption toggles ·
Cormorant Garamond / Inter / IBM Plex Mono
