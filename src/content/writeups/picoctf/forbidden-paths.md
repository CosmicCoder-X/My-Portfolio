---
title: 'Forbidden Paths'
target: 'picoCTF — Forbidden Paths'
difficulty: 'easy'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where a file-reading application filtered absolute paths but allowed relative traversal, so entering ../../../../flag.txt from the webroot at /usr/share/nginx/html/ walked up to / and read the flag.'
role: 'appsec'
tags: ['web-exploitation', 'path-traversal', 'directory-traversal', 'lfi', 'nginx', 'picoctf']
problem: 'A "Web eReader" application that reads text files from the server. The flag is at /flag.txt but the application filters absolute file paths. The webroot is /usr/share/nginx/html/.'
action: 'Noted the webroot was four directories deep from /, entered ../../../../flag.txt to traverse up to the root and read the flag file.'
outcome: 'Retrieved picoCTF{7h3_p47h_70_5ucc355_6db46514} by bypassing the absolute path filter with relative directory traversal.'
draft: false
---

## Background

Forbidden Paths is a picoCTF Web Exploitation challenge about directory traversal. The application reads files from the server and blocks absolute paths (those starting with `/`), but the filter does not account for relative paths that use `../` to walk up the directory tree. The challenge description tells you exactly where the files live (`/usr/share/nginx/html/`) and where the flag is (`/flag.txt`), so the only question is how to get from one to the other without using an absolute path.

---

## The eReader interface

The challenge loaded a "Web eReader" application on a light blue page. It listed three text files — `divine-comedy.txt`, `oliver-twist.txt`, and `the-happy-prince.txt` — with a text input labelled "Filename" and a Read button. The `..` link at the top of the list was a visual clue that directory navigation was in play.

![Web eReader application showing a light blue page with the heading "Web eReader", a ".." link, three listed files (divine-comedy.txt, oliver-twist.txt, the-happy-prince.txt), a Filename text input, and a Read button.](/writeups/picoctf-forbidden-paths/01.png)

The description confirmed that the webroot was `/usr/share/nginx/html/` and the flag was at `/flag.txt`. Entering `/flag.txt` directly would be blocked by the absolute path filter. But since the application was serving files relative to the webroot, using `../` sequences to climb up the directory tree would work — as long as the filter only checked for a leading `/`.

---

## Traversing to the flag

The webroot `/usr/share/nginx/html/` is four directories deep from the filesystem root. Each `../` moves up one level: `html/` to `nginx/`, `nginx/` to `share/`, `share/` to `usr/`, `usr/` to `/`. So the traversal path is `../../../../flag.txt`.

![The Filename input field containing ../../../../flag.txt with the Read button below it.](/writeups/picoctf-forbidden-paths/02.png)

Entered `../../../../flag.txt` and clicked Read. The application concatenated the input with the webroot path, producing `/usr/share/nginx/html/../../../../flag.txt`, which the filesystem resolved to `/flag.txt`. The filter never saw a leading `/` in the input, so it passed through.

`picoCTF{7h3_p47h_70_5ucc355_6db46514}`

---

## What I took from this

Directory traversal is one of the oldest web vulnerabilities and it keeps showing up because developers focus on the wrong thing — blocking specific characters or patterns instead of enforcing a proper allowlist. This application blocked absolute paths (leading `/`) but allowed `../`, which achieves the same result. The correct defence is to resolve the final path and verify it falls within the intended directory before reading the file. In most languages this means canonicalising the path (Python's `os.path.realpath()`, Java's `getCanonicalPath()`, Node's `path.resolve()`) and checking that it starts with the allowed base directory. Alternatively, mapping user input to a fixed set of filenames rather than using it as a path component eliminates traversal entirely.
