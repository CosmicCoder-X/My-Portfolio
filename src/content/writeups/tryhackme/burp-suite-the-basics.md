---
title: 'Burp Suite: The Basics'
target: 'TryHackMe — Burp Suite: The Basics'
difficulty: 'easy'
date: 2026-08-26
summary: 'Orientation in Burp Community — the editions, the core tools, navigating the settings maze, and using the Site Map to find an unlinked endpoint and read its response.'
role: 'appsec'
tags: ['Burp Suite', 'Proxy', 'Web app testing', 'Site map', 'Recon']
problem: 'Burp is the standard web-testing tool and also a large one — knowing what each tool is for, and where any given setting hides, is half the battle before you test anything.'
action: 'Worked through the editions and core tools, located four settings by search, then used the Site Map to enumerate endpoints and inspect an unusual one.'
outcome: 'A working map of Burp''s layout and a flag pulled from the response of an unlinked endpoint.'
---

Burp Suite is the standard tool for hands-on web and API testing, and this room
is the orientation before the real work: what the editions are, what each tool
does, where the settings live, and how the Site Map turns aimless clicking into a
map of everything a target exposes. It stays in Burp Community throughout.

## Editions and what Burp is for

Burp ships in three editions. The one worth remembering here is **Enterprise** —
it lives on a server and continuously scans target web apps for vulnerabilities,
as opposed to the interactive Professional and Community editions you drive by
hand.

And the phrase the room wants: Burp is the industry-standard tool for testing web
and **mobile** applications, including the APIs behind them.

- Edition that runs on a server for continuous scanning: **Burp Suite Enterprise**
- Burp is used against web and ______ applications: **mobile**

## The core tools

Two tools matter before anything else:

- **Proxy** — sits between you and the target, intercepting and letting you modify
  requests and responses in flight. This is the heart of Burp; everything else
  feeds off traffic the proxy captures.
- **Intruder** — automates sending many requests to an endpoint, for brute-forcing
  logins or fuzzing parameters.

And on the dashboard, the **Event Log** is the quadrant that records what Burp
itself is doing — proxy start, connections made through it — which is the first
place to look when something isn't behaving.

- Feature that intercepts requests to the target: **Proxy**
- Tool to brute-force a login form: **Intruder**
- Menu detailing Burp's own actions and connections: **Event Log**

## Navigating settings

Burp's settings are deep, and the fastest way through them is the search box
rather than clicking down the tree. A few the room asks you to locate:

Searching **Cookie jar** puts it under the **Sessions** category:

![Cookie jar under Sessions](/writeups/thm-burp-basics/01-cookie-jar-sessions.png)

Searching **Updates** shows its parent category is **Suite**:

![Updates under Suite](/writeups/thm-burp-basics/02-updates-suite.png)

The sub-category for changing keybindings is **Hotkeys**, under User interface:

![Hotkeys settings](/writeups/thm-burp-basics/03-hotkeys.png)

And on client-side TLS certificates — yes, they can be overridden per project.
The Client TLS certificates panel has an "Override options for this project only"
toggle:

![Client TLS certificate override toggle](/writeups/thm-burp-basics/04-tls-override.png)

- Category containing "Cookie jar": **Sessions**
- Base category holding "Updates": **Suite**
- Sub-category for shortcut keybindings: **Hotkeys**
- Can client-side TLS certificates be overridden per project: **yes**

One shortcut worth internalising rather than looking up: `Ctrl + Shift + P`
jumps to the **Proxy** tab. The letter is the tab — the same pattern covers the
other tools.

## Site Map: finding what isn't linked

This is the part that's actually testing rather than navigation. The **Target →
Site Map** builds a tree of everything Burp has seen the browser request. The
technique: turn intercept **off**, click around the site normally so the proxy
passively records every GET, then come back to the map.

Among the normal paths — `about`, `assets`, `contact`, `products`, `ticket` —
one endpoint stands out as a string of jumbled characters, which is exactly what
an unlinked or hidden endpoint tends to look like:

![The unusual endpoint in the Site Map](/writeups/thm-burp-basics/05-sitemap-endpoint.png)

Selecting the request shows a clean `200`. But the request line only tells you
the endpoint exists — the flag is in what the server *sent back*. Switching to the
**Response** tab on that entry shows it in the body:

![The flag in the response](/writeups/thm-burp-basics/06-response-flag.png)

Flag: `THM{NmNlZTliNGE1MWU1ZTQzMzgzNmFiNWVk}`

## What I took from this

The Site Map step is the transferable one. Intercept-off browsing turns Burp into
a passive recorder, and the map then shows the whole request surface at a glance —
including the endpoints nothing on the page links to. Those odd-looking paths are
where the interesting things hide, and finding them costs nothing but clicking
around with the proxy running.

The request-versus-response distinction is the other habit to build. A `200` on
the request line says the endpoint is there; it says nothing about what came back.
The content lives in the Response tab, and remembering to look there is the
difference between "found an endpoint" and "read what it holds."
