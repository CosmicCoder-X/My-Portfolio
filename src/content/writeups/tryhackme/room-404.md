---
title: 'Room 404'
target: 'TryHackMe — Room 404'
difficulty: 'easy'
date: 2026-09-16
summary: 'An exposed .git directory on a hotel booking platform''s staging site, reconstructed two different ways to recover a flag left sitting in the README.'
role: 'pentest'
tags: ['Git dumping', 'Gobuster', 'Directory enumeration', 'Information disclosure', 'git-dumper']
problem: 'A hotel "guest experience platform" website with no obvious functionality to attack, every visible button is a dead end with nothing wired up behind it.'
action: 'Enumerated the web server with Gobuster, found an exposed .git directory, and reconstructed the repository two separate ways: a manual wget mirror plus git checkout, and the purpose-built git-dumper tool.'
outcome: 'Full source tree recovered (README.md, app.js, index.html) with the flag sitting in plain text in the README, confirmed identically by both recovery methods.'
draft: false
---

Byte Lotus is a good reminder that a site can look completely locked down on
the surface and still be leaking its own source code one directory over.
There's no login form to brute-force and no input field to inject here:
the entire vulnerability is a `.git` folder someone forgot to strip out of a
staging deploy.

## Reconnaissance

The target serves a hotel booking site on port 8080:

```
http://<MACHINE_IP>:8080
```

![Byte Lotus hotel website homepage, dark theme with a "Reserve a Stay" button](/writeups/thm-room-404/01-byte-lotus-website.png)

Clicking through the nav (Rooms, The App, Concierge, Stay) and the "Reserve
a Stay" button goes nowhere: every link on the page is cosmetic, with
nothing functional wired up behind it. Nothing on the rendered page is worth
attacking directly, so the next step is finding what isn't rendered.

## Directory enumeration

Gobuster against the web root, extended to catch common source and VCS
files:

```bash
gobuster dir \
  -u http://<MACHINE_IP>:8080/ \
  -w /usr/share/wordlists/dirb/common.txt \
  -x html,js,php,txt,git
```

![Gobuster output showing /.git, /.git/HEAD and /app.js all returning HTTP 200](/writeups/thm-room-404/02-gobuster-git-directory.png)

Three results stand out: `/.git` and `/.git/HEAD` both return `200`, meaning
the repository's internal object store is directly browsable over HTTP, and
`/app.js` confirms there's real application code behind the placeholder
front end. An exposed `.git` directory is effectively the entire project
history handed over for free: commits, file contents, and anything anyone
ever committed and later "removed" without actually scrubbing it from
history.

## Recovering the repository

Two different ways to pull it down, both landing on the same result.

### Method 1: wget mirror + git checkout

A plain recursive mirror of the exposed `.git/` folder, followed by
restoring the working tree from what got downloaded:

```bash
wget --mirror -nH -P ~/Desktop/repodump http://<MACHINE_IP>:8080/.git/
cd ~/Desktop/repodump
ls -la
```

![Listing the mirrored .git folder inside ~/Desktop/repodump](/writeups/thm-room-404/03-repodump-ls.png)

`wget --mirror` only grabs the raw objects and refs, not a usable working
directory, so `git checkout .` is what actually reconstructs the real files
from those objects:

```bash
git checkout .
```

That pulls `README.md`, `app.js` and `index.html` out of the repository.
The flag is sitting directly in the README:

```bash
cat README.md
```

![cat README.md showing the Byte Lotus README and the staging flag](/writeups/thm-room-404/04-repodump-readme-flag.png)

### Method 2: git-dumper

The more purpose-built route: **git-dumper**, which handles the object
discovery and reconstruction in one step instead of relying on directory
listing being enabled.

```bash
pip install git-dumper
git-dumper http://<MACHINE_IP>:8080/.git/ bytelotusrepo
cd bytelotusrepo
ls -la
```

![Listing the git-dumper output in bytelotusrepo: .git, README.md, app.js, index.html](/writeups/thm-room-404/05-git-dumper-ls.png)

Same repository, reconstructed a different way, same three files recovered.
Reading the README confirms it:

```bash
cat README.md
```

![cat README.md via the git-dumper recovery, showing the identical flag](/writeups/thm-room-404/06-git-dumper-readme-flag.png)

```
# Byte Lotus — Guest Experience Platform

Internal staging repository for the guest app and concierge personalization
service. Do not deploy this folder to production.

Staging flag (remove before launch): THM{byt3_l0tus_n3v3r_f0rg3ts}
```

**FLAG:** `THM{byt3_l0tus_n3v3r_f0rg3ts}`

## What I took from this

The room's whole lesson is in that README's own warning: "do not deploy
this folder to production," sitting right above a secret in a repository
that got deployed to production anyway. A `.git` folder isn't just a
convenience for developers, it's a complete, browsable history of every
file the project has ever had, including the ones someone thought they'd
quietly removed. Deleting a secret in a later commit doesn't erase it; it's
still sitting in the object store for anyone who can reach `.git/HEAD` over
HTTP.

Running the recovery two different ways was as much about tooling
comparison as it was about the flag. `wget --mirror` plus `git checkout`
works anywhere `wget` and `git` already exist and doesn't need directory
listing to succeed against the raw object paths, while `git-dumper` is
faster to reach for when it's installed, since it handles ref discovery and
object crawling in one command. Worth knowing both: not every box has pip
access, and not every `.git` exposure is quite as forgiving as this one.
