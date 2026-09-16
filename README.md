# divyansh404.xyz

[![Live site](https://img.shields.io/badge/live-divyansh404.xyz-252830)](https://divyansh404.xyz)

Divyansh Agrawal's portfolio: security writeups, built tools, certifications
and a blog, on a domain won from a CTF competition. Built with
[Astro](https://astro.build), deployed on [Cloudflare Pages](https://pages.cloudflare.com).

## What it does differently

Most portfolio sites are a skills list someone typed once and never revisited.
This one treats every number as a claim that has to be backed by the content
itself:

- **Nothing is hand-counted.** The stats on the homepage, the capability bars
  on `/skills/`, the platform totals: all of it is computed at build time
  from the actual markdown in `src/content/writeups/`, not typed into a
  config file that quietly drifts out of date.
- **Capabilities are evidence, not a checklist.** `/skills/` clusters
  writeups *and* projects by the tags they actually carry, matched on whole
  tokens rather than raw substrings (a naive `includes` once counted
  `path-trave(rsa)l` as cryptography). Click a skill, see the exact work
  that backs it.
- **`/tags/`** is a full browsable index across every writeup, long tail
  collapsed behind a disclosure instead of dumped as a wall of text.

## Stack

Astro 7 · content collections (markdown) · Cloudflare Pages · a small amount
of vanilla JS for search, a lightbox, copy buttons and caption toggles ·
Cormorant Garamond / Inter / IBM Plex Mono

## Notable engineering decisions

**Numbers are computed, never typed.** Every count on the site is derived
from the markdown at build time by `src/lib/evidence.ts`. They cannot drift
from the content.

**Tag matching is token-based, not substring.** Capability clusters in
`src/lib/evidence.ts` match whole hyphen-delimited tokens specifically
because a plain `includes` check produced real false positives (see above).

**Markdown transforms run at build time**, in `src/lib/rehype-article.mjs`:
image-only paragraphs become `<figure>` elements with the alt text as a
visible caption, code blocks get a copy button, wide tables get a scroll
container. Doing this at build time rather than in the browser means it all
still works with JavaScript disabled.

**Search and filtering on writeup lists is progressive enhancement.** The
full list is always present in the HTML; the interactive controls stay
hidden until the script wires itself up, so a visitor without JavaScript
still sees every entry rather than a dead search box. Deep links work:
`/writeups/?q=kerberos`, `/writeups/?role=soc`.

**No inline scripts are emitted anywhere on the site**, which is what lets
`public/_headers` set `script-src 'self'` with no `'unsafe-inline'` in the
CSP.

**Navigation uses View Transitions with prefetch.** Astro's `ClientRouter`
swaps pages in place instead of a full reload, and built-in prefetch
(viewport strategy) means the HTML for a link is usually already fetched
before it's clicked. View Transitions snapshots the page being navigated
*away from* as well as the one being navigated to, which turned out to
matter: oversized images on one page were making transitions slow on
completely unrelated pages, which is why `scripts/optimize-*.mjs` exist to
keep every image payload in check.

**Single deliberate visual theme.** A cool near-neutral palette
(`--ink #252830` on `--paper #f5f6f8`), no accent hue at all. The only place
a second visual signal is allowed is the difficulty ramp on writeups, where
it carries real meaning rather than decoration.

**The evidence matrix on the homepage** (`src/components/EvidenceGrid.astro`)
draws one cell per published writeup, grouped by platform, ink density keyed
to difficulty. It's generated from the content, so it grows on its own.

## Running it locally

Node 22.12 or newer is required (Astro 7 won't start on Node 20).

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # writes dist/
npm run preview  # serve the built site
```
