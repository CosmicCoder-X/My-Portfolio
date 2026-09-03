---
title: 'Inspect HTML'
target: 'picoCTF — Inspect HTML'
difficulty: 'easy'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where viewing the page source of a simple HTML page about Histiaeus revealed the flag hidden inside an HTML comment at the bottom of the document.'
role: 'appsec'
tags: ['web-exploitation', 'view-source', 'html-comment', 'inspection', 'picoctf']
problem: 'A web page at saturn.picoctf.net with a story about Histiaeus. The challenge name and description hint at inspecting the HTML source to find the flag.'
action: 'Visited the page, noted the visible content was just a historical paragraph, then viewed the page source where the flag was embedded in an HTML comment on line 20.'
outcome: 'Retrieved picoCTF{1n5p3t0r_0f_h7ml_1fd8425b} from an HTML comment in the page source.'
draft: false
---

## Background

Inspect HTML is a 100-point picoCTF Web Exploitation challenge. The description says "Can you get the flag? Go to this website and see what you can discover." The challenge name is the entire hint — inspect the HTML.

---

## The page

The challenge URL loaded a simple page titled "On Histiaeus" with a single paragraph about the ancient Greek tyrant who tattooed a secret message on a slave's shaved head and waited for the hair to grow back before sending him as a messenger. Below the story was a source attribution: "Source: Wikipedia on Histiaeus." Nothing else was visible on the rendered page.

![Web page at saturn.picoctf.net:50920 titled "On Histiaeus" displaying a paragraph about Histiaeus shaving a slave's head to tattoo a secret message, with "Source: Wikipedia on Histiaeus" below it.](/writeups/picoctf-inspect-html/01.png)

The story itself was a thematic clue — Histiaeus hid a message beneath the surface, and the challenge was asking to do the same with the HTML.

---

## Viewing the source

Right-clicked the page and selected View Page Source. The HTML was minimal — a standard document with a heading, a paragraph, and a source attribution. But on line 20, after the visible content and just before the closing `</body>` tag, the flag was sitting in an HTML comment:

```html
<!--picoCTF{1n5p3t0r_0f_h7ml_1fd8425b}-->
```

![View-source of saturn.picoctf.net:50920 showing the full HTML document — DOCTYPE, head with charset/viewport/title, body with an h1, a paragraph about Histiaeus, and on line 20 the HTML comment containing the flag: picoCTF{1n5p3t0r_0f_h7ml_1fd8425b}.](/writeups/picoctf-inspect-html/02.png)

`picoCTF{1n5p3t0r_0f_h7ml_1fd8425b}`

---

## What I took from this

The simplest possible web challenge, but the principle is one that matters at every level: the rendered page is not the whole story. HTML comments, hidden form fields, JavaScript variables, metadata tags, and inline scripts all live in the source but never appear on screen. Viewing source is the first step in any web assessment, and developers routinely leave debug information, internal notes, API keys, and test credentials in comments that ship to production. Browser DevTools (Elements, Network, Console) extend this further, but View Source remains the fastest way to see exactly what the server sent.
