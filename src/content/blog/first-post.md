---
title: 'Starting this thing'
date: 2026-03-17
summary: 'A placeholder first post. Rewrite it in your own voice or delete it, the site works either way.'
tags: ['Meta']
# Placeholder scaffolding, not a real post: kept in the repo for
# reference but hidden from the live site.
draft: true
---

This post exists so the blog listing has something in it on day one. Replace the
text with something you actually want to say, or delete the file and the section
goes quiet until you fill it.

## Adding a post

Drop a `.md` file into `src/content/blog/`. The front matter needs four things:

```yaml
---
title: 'Your title'
date: 2026-09-01
summary: 'The line that shows under the title in listings.'
tags: ['Something']
---
```

Then write below it. Add `draft: true` while a post is unfinished and it stays
off the site until you remove that line.

## What to put here

Writeups cover what you did. This is the place for the things that don't fit
that shape: a pattern you keep seeing across bug bounty programs, an argument
about why some class of vulnerability is underrated, notes from building a tool,
or what it's actually like learning offensive security alongside a degree in
something else entirely.

Posts here are also the part of a portfolio that shows you can write, which,
for anyone who has read enough pentest reports, is not a small thing.
