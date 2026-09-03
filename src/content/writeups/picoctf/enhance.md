---
title: 'Enhance!'
target: "picoCTF — Enhance!"
difficulty: 'easy'
date: 2026-07-22
summary: "A picoCTF Forensics challenge where the flag was split across multiple SVG text elements with near-invisible styling, and running strings on the file revealed the individual characters spread across tspan elements."
role: 'forensics'
tags: ['forensics', 'svg', 'strings', 'xml', 'steganography', 'picoctf']
problem: "An SVG image file created with Inkscape. The flag is hidden within the file but not visible when the image is rendered normally."
action: "Ran strings on the SVG file to dump its XML content as readable text, then identified flag fragments scattered across tspan elements at the bottom of the output and concatenated them."
outcome: 'Assembled the flag from the fragmented tspan text content in the SVG source.'
draft: false
---

## Background

Enhance! is a picoCTF Forensics challenge that provides an SVG image file — `drawing.flag.svg` — and asks the solver to extract a hidden flag from it. SVG (Scalable Vector Graphics) is an XML-based vector image format, which means the entire image is described in human-readable markup rather than binary pixel data. This makes it fundamentally different from raster formats like PNG or JPEG — any hidden content can potentially be found by reading the source directly.

---

## Examining the file

Running `strings` on the SVG file dumped its XML content as readable text. Since SVG is XML, `strings` effectively printed the entire file:

![Kali terminal showing strings drawing.flag.svg output. The top of the file shows XML declaration, an Inkscape creation comment, SVG namespace declarations, document dimensions (width 210mm, height 297mm, viewBox 0 0 210 297), Inkscape version 0.92.5, and Sodipodi named view metadata including page colour, border colour, zoom level, and window dimensions. Below that, RDF metadata with Creative Commons licensing and Dublin Core format declarations.](/writeups/picoctf-enhance/01.png)

The file header confirmed it was created with Inkscape 0.92.5, an open-source vector graphics editor. The document was A4-sized (210mm × 297mm) with Sodipodi namespace extensions — standard Inkscape metadata. The SVG namespace declarations, Creative Commons RDF metadata, and Inkscape-specific attributes were all normal boilerplate.

Scrolling to the bottom of the `strings` output revealed the interesting part — the text elements where the flag was hidden:

![Kali terminal showing the bottom of the strings output. Multiple tspan elements are visible with tiny font sizes (font-size:0.00352781px) and white fill colour (fill:#ffffff). One tspan with id tspan3762 contains ">T ", another with id tspan3764 contains ">F { 3 n h 4 n", and a third with id tspan3752 contains ">c 3 d _ d 0 a 7 5 7 b f }". The SVG closes with closing g and svg tags.](/writeups/picoctf-enhance/02.png)

The flag was split across multiple `<tspan>` elements — SVG's equivalent of inline text spans. Each span carried the same styling: a font size of `0.00352781px` (effectively invisible at any normal zoom level) and a fill colour of `#ffffff` (white on a white page background). This was a double concealment: the text was too small to see and was the same colour as the background, making it invisible when the SVG was rendered in a browser or image viewer.

The fragments visible in the tspan content were: `p`, `i`, `c`, `o`, `C`, `T`, `F`, `{ 3 n h 4 n`, `c 3 d _ d 0 a 7 5 7 b f }`. Concatenating them and removing the spaces that SVG used to separate individual characters within each tspan produced the flag:

`picoCTF{3nh4nc3d_d0a757bf}`

---

## What I took from this

This challenge demonstrated that SVG files are fundamentally text documents masquerading as images. Unlike binary image formats where hidden data requires specialised tools to extract (steganography detectors, hex editors, metadata parsers), SVG content is fully readable with basic text tools like `strings`, `cat`, or any text editor. The concealment technique here — microscopically small, white-on-white text — would defeat visual inspection of the rendered image, but it cannot survive even the most basic examination of the file's source.

The specific technique of splitting the flag across multiple `<tspan>` elements with spaces between characters added a layer of obfuscation that made it slightly harder to spot in a wall of XML — you had to recognise the pattern of single characters separated by spaces and mentally concatenate them. In a real-world context, this mirrors how data can be hidden in document formats that support rich markup: Office documents (which are ZIP archives of XML files), HTML pages, PDF files with invisible text layers, and SVG images can all contain text that is present in the source but invisible when rendered. Forensic analysis of these formats always starts with examining the raw source, because rendering engines are designed to show you what the author intended — not everything that is actually there.
