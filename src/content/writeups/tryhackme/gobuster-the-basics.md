---
title: 'Gobuster: The Basics'
target: 'TryHackMe — Gobuster: The Basics'
difficulty: 'easy'
date: 2026-08-26
summary: 'Gobuster across its three main modes — directory, DNS subdomain, and vhost enumeration — against offensivetools.thm, including the resolver workaround the room needs to work at all.'
role: 'pentest'
tags: ['Gobuster', 'Enumeration', 'Directory brute-force', 'DNS', 'Vhost', 'Recon']
problem: 'Content that isn''t linked anywhere — hidden directories, undiscovered subdomains, virtual hosts sharing one IP — is invisible to a browser but often where the interesting attack surface lives.'
action: 'Ran Gobuster in dir, dns and vhost modes against the target, working around the room''s broken DNS with a manual resolver, and followed the directory chain down to a flag.'
outcome: 'A hidden .js flag file three directories deep, four subdomains, and four status-200 vhosts.'
---

Gobuster is a brute-forcer for the parts of a target nobody links to. Point it at
a wordlist and it will find directories, files, subdomains and virtual hosts that
never appear in a page's HTML. This room walks its three main modes against
`offensivetools.thm`, and — as is traditional for TryHackMe network rooms — the
DNS doesn't work out of the box, so part of the exercise is making it resolve at
all.

## Setup: making the target resolve

The room's domain won't resolve until you point your box at the room's nameserver.
Set it as the first nameserver in the dnsmasq resolv file and restart the service:

```bash
/etc/init.d/dnsmasq restart
cat /etc/resolv-dnsmasq
```

![Setting the nameserver and restarting dnsmasq](/writeups/thm-gobuster/01-resolv-dnsmasq.png)

The `nameserver 10.201.26.173` line confirms it took. Skip this and every mode
below fails with resolution errors that look like Gobuster's fault but aren't.

## Directory mode

Directory mode requests each wordlist entry as a path and reports what comes back.
The core flags are `-u` for the target URL and `-w` for the wordlist.

One flag worth knowing before you need it: `--no-tls-validation` (short form `-k`)
skips certificate checking on HTTPS targets, which you'll want against the
self-signed certs these boxes usually carry.

A note the room buries: its example uses a hostname that won't resolve for you.
Substitute the target machine IP directly. The `-r` flag follows redirects, which
keeps 301s from hiding content:

```bash
gobuster dir -u "http://10.201.12.254" -w /root/Desktop/Tools/wordlists/dirbuster/directory-list-2.3-medium.txt -r
```

![First-level directory enumeration](/writeups/thm-gobuster/02-dir-enum.png)

That returns a spread of 200s — `/forum`, `/store`, `/example`, `/joomla`,
`/wordpress` — plus a 403 on `/server-status`. One directory is the one worth
chasing (redacted in the screenshot above).

Descend into it and add `-x .js` to pull JavaScript files specifically, since the
flag lives in one:

```bash
gobuster dir -u "http://10.201.12.254/DIRECTORY" -w /root/Desktop/Tools/wordlists/dirbuster/directory-list-2.3-medium.txt -x .js
```

![Second level: /content and /uploads](/writeups/thm-gobuster/03-dir-js-content-uploads.png)

That surfaces two more directories, `/content` and `/uploads`, both 301s. Follow
`/content` down the same way:

![The flag file, /flag.js](/writeups/thm-gobuster/04-dir-flag-js.png)

`/flag.js` — a 200 at 22 bytes. Gobuster found the path; to read the contents you
still have to request it. `curl -s` fetches it quietly:

```bash
curl -s 'http://10.201.12.254/DIRECTORY/content/flag.js'
```

![Retrieving the flag with curl](/writeups/thm-gobuster/05-curl-flag.png)

The request returned the flag.

That last step is the one the room assumes you remember from an earlier lab and
doesn't spell out: Gobuster tells you a file *exists*, but reading it is a
separate request. Finding is not fetching.

## Answers so far

- Flag to specify the target URL: `-u`
- Subcommand for subdomain enumeration: `dns`
- Long flag to skip TLS verification: `--no-tls-validation`

## DNS subdomain mode

DNS mode brute-forces subdomains against a resolver. It needs `-d` for the domain
and `-w` for the wordlist at minimum.

Same DNS problem as before, solved two ways. Either add the target to
`/etc/hosts`, or skip that and pass `--resolver` directly — the cleaner option:

```bash
gobuster dns -d offensivetools.thm -w /usr/share/wordlists/SecLists/Discovery/DNS/subdomains-top1million-5000.txt --resolver 10.201.12.254
```

![DNS subdomain enumeration](/writeups/thm-gobuster/06-dns-subdomains.png)

Four subdomains come back beyond the bare `www`: `forum`, `store`, `WWW` and
`primary`, all under `offensivetools.thm`.

- Shorthand flag required alongside `dns` and `-w`: `-d`
- Subdomains configured for the domain: **4**

## Vhost mode

Virtual host enumeration is a different thing from DNS subdomains, and the
distinction matters. Multiple sites can share one IP, served by the Host header
rather than by separate DNS records — so a vhost can exist with no DNS entry at
all. Vhost mode brute-forces the Host header and watches for responses that differ
from the baseline.

```bash
gobuster vhost -u "http://10.201.12.254" --domain offensivetools.thm -w /usr/share/wordlists/SecLists/Discovery/DNS/subdomains-top1million-5000.txt --append-domain --exclude-length 250-320
```

![Vhost enumeration](/writeups/thm-gobuster/07-vhost-enum.png)

`--append-domain` tacks the domain onto each wordlist entry, and
`--exclude-length` filters out the noise of identical-length "not found" pages so
only real hits show. Four reply 200: `forum`, `store`, `www` — and `secret`,
which is the one that didn't turn up in DNS mode. That's the whole reason to run
vhost mode after DNS: `secret.offensivetools.thm` has no DNS record, so subdomain
enumeration never sees it, but it's there on the Host header.

- Vhosts replying with status 200: **4**

## What I took from this

Two things worth keeping. First, enumeration is layered — the flag here was three
directories deep, and each level needed the previous one's result before it made
sense to run. You don't brute-force the whole tree at once; you find a door, walk
through it, and brute-force again from there.

Second, DNS mode and vhost mode are not the same tool with different names. DNS
finds names the resolver knows about. Vhost finds names the *web server* answers
to, whether or not DNS has ever heard of them — which is exactly where something
called `secret` tends to live.
