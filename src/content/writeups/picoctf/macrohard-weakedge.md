---
title: 'MacroHard WeakEdge'
target: "picoCTF — MacroHard WeakEdge"
difficulty: 'easy'
date: 2026-07-22
summary: "A picoCTF Forensics challenge where a macro-enabled PowerPoint file contained a VBA red herring and a hidden base64-encoded flag buried in the ZIP archive structure under ppt/slideMasters/hidden."
role: 'forensics'
tags: ['forensics', 'pptm', 'zip', 'base64', 'vba', 'macro', 'office', 'picoctf']
problem: "A .pptm (macro-enabled PowerPoint) file. The flag is hidden somewhere within it."
action: "Identified the file as PowerPoint 2007+, inspected VBA macros in LibreOffice (red herring), unzipped the pptm as a ZIP archive to explore the internal XML structure, found a suspicious hidden file under ppt/slideMasters/, and base64-decoded its contents to retrieve the flag."
outcome: 'Decoded the base64 string from the hidden file to retrieve the flag.'
draft: false
---

## Background

MacroHard WeakEdge is a picoCTF Forensics challenge that plays on Microsoft's names — "MacroHard" for macros, "WeakEdge" for PowerPoint. The challenge provides a `.pptm` file and expects the solver to dig past an obvious VBA macro decoy to find data hidden in the underlying ZIP structure that all modern Office formats are built on.

---

## Downloading and identifying the file

Downloaded `Forensics is fun.pptm` from the challenge server:

![Kali terminal showing wget downloading Forensics is fun.pptm from mercury.picoctf.net. The file is 98K in size and downloads successfully.](/writeups/picoctf-macrohard-weakedge/01.png)

Running `file` confirmed it was a Microsoft PowerPoint 2007+ presentation:

![Kali terminal showing the file command output identifying Forensics is fun.pptm as Microsoft PowerPoint 2007+.](/writeups/picoctf-macrohard-weakedge/02.png)

The `.pptm` extension indicates a macro-enabled presentation — the "m" suffix distinguishes it from a standard `.pptx`. This was the first hint that macros might be relevant.

---

## Inspecting the VBA macro

Opened the file in LibreOffice and navigated to the Basic IDE to inspect the embedded VBA code:

![LibreOffice Basic IDE showing Module1 containing a Sub procedure named not_flag. The subroutine sets the variable not_flag to the string value "sorry_but_this_isn't_it".](/writeups/picoctf-macrohard-weakedge/03.png)

The macro contained a single subroutine — `not_flag()` — that returned the string `"sorry_but_this_isn't_it"`. A deliberate red herring. The challenge name hinted at macros, but the actual macro was a dead end designed to waste time.

---

## Unzipping the Office archive

All Office 2007+ formats (`.docx`, `.xlsx`, `.pptx`, `.pptm`) are ZIP archives containing XML files, media, and metadata. Unzipped the `.pptm` to examine its internal structure:

![Terminal showing ll -la * on the unzipped pptm contents. The top level contains Content_Types.xml, a _rels directory, a docProps directory, and a ppt directory. The ppt directory contains presentation.xml, presProps.xml, tableStyles.xml, viewProps.xml, vbaProject.bin, and subdirectories for slideLayouts, slideMasters, slides, and theme.](/writeups/picoctf-macrohard-weakedge/04.png)

The standard Office XML structure was visible — `[Content_Types].xml`, `_rels/`, `docProps/`, and `ppt/` with its subdirectories for slides, layouts, masters, and themes. The `vbaProject.bin` file was the binary container for the VBA macro code. Examining it with `cat` confirmed it held the same `not_flag` decoy:

![Terminal showing cat output of vbaProject.bin. The binary content contains readable strings including "not_flag", "sorry_but_this_isn't_it", VBA project metadata, and Module1 references amid binary data.](/writeups/picoctf-macrohard-weakedge/05.png)

Nothing new — the binary VBA project contained the same dead-end macro. But one file in the directory listing did not belong in a standard PowerPoint archive: `ppt/slideMasters/hidden`.

---

## Decoding the hidden file

The `ppt/slideMasters/` directory normally contains only XML files defining slide master layouts. A file simply named `hidden` was suspicious. Reading it revealed a base64-encoded string:

![Terminal showing cat ./ppt/slideMasters/hidden outputting the base64 string ZmxhZzogcGljb0NURntEMWRfdV9rbjB3X3BwdHNfcl96MXA1fQ.](/writeups/picoctf-macrohard-weakedge/06.png)

Decoding the base64:

```
$ echo "ZmxhZzogcGljb0NURntEMWRfdV9rbjB3X3BwdHNfcl96MXA1fQ" | base64 -d
flag: picoCTF{D1d_u_kn0w_ppts_r_z1p5}
```

`picoCTF{D1d_u_kn0w_ppts_r_z1p5}`

---

## What I took from this

This challenge illustrated that modern Office documents are not opaque binaries — they are ZIP archives with a well-defined XML structure, and anything can be tucked into that structure alongside the legitimate content. The `ppt/slideMasters/hidden` file was not referenced by any of the XML relationships, so PowerPoint would never load or display it, but it survived intact inside the archive. In a real-world context, this is a known data exfiltration vector: an attacker can embed arbitrary files inside an Office document's ZIP structure without affecting the document's functionality, and most users and even some security tools will never inspect the archive contents beyond the rendered slides or pages. The VBA macro was a well-placed distraction — a solver who focused only on the macro angle could spend considerable time analysing the `vbaProject.bin` without realising the flag was elsewhere entirely.
