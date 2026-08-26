---
title: 'Hydra'
target: 'TryHackMe — Hydra'
difficulty: 'easy'
date: 2026-08-26
summary: 'Brute-forcing two services on one host with THC-Hydra — a POST web login and SSH — including the DevTools recon needed to build the http-post-form string correctly.'
role: 'pentest'
tags: ['Hydra', 'Brute force', 'http-post-form', 'SSH', 'Password attacks', 'rockyou']
problem: 'A login form and an SSH service, one known username (molly), and no credentials. The question is whether either service is weak to an online password attack.'
action: 'Captured the login POST in DevTools to build the http-post-form string, then ran Hydra against both the web form and SSH with rockyou.txt.'
outcome: 'Two valid passwords for molly — one per service — and two flags.'
---

Hydra is an online brute-forcer: it throws username/password guesses at a live
service and watches for the one that behaves differently. This room runs it
against the same host twice — once at a web login form, once at SSH — and the
useful part is the web attack, because getting Hydra to recognise success on a
POST form depends entirely on recon you do first.

Target: `10.201.107.194`. Wordlist throughout is `rockyou.txt`, the standard Kali
list at `/usr/share/wordlists/rockyou.txt`.

## Recon: reading the login request

Hydra can't attack a web form until you tell it three things: where the form
posts, what fields it sends, and how to tell a failed login from a successful
one. All three come from watching a single real attempt.

Open the target in a browser, open **DevTools → Network**, and submit one
deliberately wrong login. The captured request gives up everything:

- **POST path:** `/login`
- **Body fields:** `username` and `password`
- **Failure string:** `Your username or password is incorrect.`

That failure string is the key. Hydra fires thousands of requests and can't
"see" the page — it decides success by whether that failure text is absent from
the response. Get this string wrong and every attempt reads as a failure,
including the correct one.

## Web brute force

With the three pieces above, the `http-post-form` argument is
`path:body:failure_condition`:

```bash
hydra -l molly -P /usr/share/wordlists/rockyou.txt 10.201.107.194 http-post-form "/login:username=^USER^&password=^PASS^:F=Your username or password is incorrect." -V -t 4
```

Breaking that down:

- `-l molly` — single known username. (`-L` would take a username list.)
- `-P rockyou.txt` — password list.
- `^USER^` / `^PASS^` — placeholders Hydra substitutes on each attempt.
- `F=...` — the failure condition. Any response containing this string is a
  failed login; the response that lacks it is the hit.
- `-V` — verbose, shows each attempt.
- `-t 4` — four parallel tasks. Worth keeping low on these boxes; too many
  threads against a flaky target produces false negatives.

Hydra returns:

```
[80][http-post-form] host: 10.201.107.194  login: molly  password: sunshine
```

Logging into the web app as `molly:sunshine` reveals the first flag.

Flag 1: `THM{2673a7dd116de68e85c48ec0b1f2612e}`

## SSH brute force

SSH is simpler — no form string to build, since the protocol handles auth
directly. Same username, same wordlist, `ssh` as the service:

```bash
hydra -l molly -P /usr/share/wordlists/rockyou.txt 10.201.107.194 -t 4 ssh -V
```

Hydra returns a different password from the web one:

```
[22][ssh] host: 10.201.107.194  login: molly  password: butterfly
```

Worth noting: `molly` reused nothing between services — `sunshine` on the web,
`butterfly` on SSH. Convenient for the room, and a reminder that a credential
found on one service is a lead to try elsewhere, not a guarantee.

Log in and read the second flag:

```bash
ssh molly@10.201.107.194
# password: butterfly
pwd
ls -la
cat flag2.txt
```

Flag 2: `THM{c8eeb0468febbadea859baeb33b2541b}`

## What I took from this

The SSH attack is the easy half and the web attack is the one that teaches
something. Hydra against a form is only as good as the `http-post-form` string,
and that string is built from a real captured request, not guessed. The failure
condition especially — it's the entire mechanism Hydra uses to know it won.

The other thing this room quietly demonstrates is why online brute force is loud
and slow. Every guess is a live request hitting a real service, rate-limited by
the network and the target. `rockyou` worked here because the passwords were near
the top of it; a password deep in the list, or any real lockout policy, would
have made this attack impractical. That's the honest limitation — online brute
force finds weak passwords, not strong ones.
