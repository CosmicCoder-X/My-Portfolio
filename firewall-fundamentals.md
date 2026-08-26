---
title: 'Firewall Fundamentals'
target: 'TryHackMe — Firewall Fundamentals'
difficulty: 'easy'
date: 2026-08-26
summary: 'What a firewall actually decides, the four types and where each one sits in the OSI model, and the rule syntax on both Windows Defender Firewall and Linux ufw.'
role: 'soc'
tags: ['Firewalls', 'Network security', 'iptables', 'ufw', 'nftables', 'Windows Defender Firewall']
problem: 'A firewall is the control most people can name and fewest can configure. Knowing that it "blocks traffic" is not the same as knowing what it inspects, at which layer, or why a rule fires in the order it does.'
action: 'Worked through the four firewall types by OSI layer, then built rules by hand on both Windows Defender Firewall and Linux ufw.'
outcome: 'A working model of where each firewall type can and cannot see, and hands-on rule creation on both platforms.'
---

Firewalls are the control everyone can name. Ask what one does and you get "it
blocks bad traffic," which is true in the way that "a doctor helps sick people"
is true. This room is about the layer beneath that: what a firewall can actually
see, what it decides on, and why the answer changes depending on which kind
you're running.

## What a firewall decides

A firewall sits between a device or network and everything outside it, and makes
one decision per packet: does this match a rule, and what does the rule say to do
about it.

The interesting part is the phrase "does this match." A firewall can only match
on what it can see, and what it can see depends entirely on how far up the stack
it inspects. That single constraint explains the differences between every type
below.

Modern firewalls have grown well past packet filtering — intrusion detection,
deep packet inspection, heuristics, threat intelligence feeds. But the core
decision has not changed since the first packet filter.

## The four types, by what they can see

**Stateless firewalls** work at layers 3 and 4. Each packet is judged entirely on
its own — source address, destination address, port, protocol — with no memory of
what came before it.

This is fast, and for high-throughput links that matters. The cost is that a
stateless filter has no idea whether the packet in front of it belongs to a
conversation the network initiated or one an attacker did. A TCP packet with the
ACK flag set looks like a legitimate reply whether or not there was ever a
request. That is the gap.

**Stateful firewalls** work at the same two layers but keep a state table of
active connections. When an internal host opens a connection outward, that gets
recorded, and return traffic matching it is permitted. Traffic claiming to belong
to a session that was never opened is not.

That single change closes most of the hole above, and it is why stateful
inspection became the default rather than an upgrade.

**Proxy firewalls** work at layer 7. Rather than forwarding packets, the proxy
terminates the connection, examines the contents, and makes its own request on
the client's behalf. Because it operates at the application layer it can act on
content rather than addresses — filtering by URL or by what is inside the request
— and it can decrypt TLS to do it. It also hides internal addressing, since the
external server only ever talks to the proxy.

**Next-generation firewalls** span layers 3 through 7. NGFWs fold in intrusion
prevention, heuristic analysis and live threat intelligence, and decrypt TLS so
that encrypted traffic is not a blind spot. In practice this is what enterprise
edge devices are, and the tradeoff is cost and complexity rather than
capability.

The pattern across all four is worth stating plainly: **the higher up the stack a
firewall inspects, the more it can decide on and the more it costs to run.**
Nobody puts a layer 7 proxy in front of everything.

## Rules

A rule matches on some combination of source address, destination address, port,
protocol and direction, and then takes an action.

The three actions:

- **Allow** — the packet passes. Permitting inbound TCP/80 to a web server.
- **Deny** — the packet is dropped. Blocking inbound SSH from anything outside a
  known management range.
- **Forward** — the packet is redirected somewhere else. Sending inbound HTTP on
  to an internal application server.

And the three directions:

- **Inbound** — traffic arriving. This is where most attention goes.
- **Outbound** — traffic leaving. This is where most attention should go and
  usually doesn't. A default-deny outbound policy is what turns a compromised
  host into a contained one, because a beacon that cannot reach its C2 is a
  beacon that never gets tasked.
- **Forward** — traffic being routed between segments rather than to the firewall
  itself.

Order matters. Most firewalls evaluate top down and stop at the first match, so
a permissive rule sitting above a restrictive one silently defeats it. Reading a
ruleset means reading it in sequence, not as a set.

## Windows Defender Firewall

Windows ships with a stateful firewall that most people meet only as a popup.
Under **Advanced Settings** it is a proper rule engine.

Two things worth knowing.

**Network profiles.** Rules are scoped to Domain, Private and Public, and the
active profile changes with the network. A rule that only exists on Private does
nothing on café Wi-Fi. This is a common reason a rule appears not to work.

**Rule construction.** Inbound and outbound rules are separate lists. A rule is
built from a program or port, a protocol, a scope (which remote addresses it
applies to), an action, and the profiles it is active on.

The scope field is the useful one. Blocking inbound SSH outright is one rule;
allowing it from a single administrative address is a second, narrower rule that
takes precedence. That pair — a broad deny plus a narrow allow — is the standard
shape for exposing a service to exactly one place.

**Restore Defaults** wipes every custom rule and returns to baseline. Useful for
undoing a lab, unpleasant if you meant something else.

## Linux

Linux firewalling all sits on **Netfilter**, the packet filtering framework in the
kernel. Everything else is a way of talking to it.

**iptables** is the long-standing interface. Powerful, precise, and verbose,
with separate tables for filtering and NAT and a syntax that does not forgive
much.

**nftables** is its successor. It unifies the separate iptables tools behind one
syntax, handles IPv4 and IPv6 together, and performs better with large rulesets.
On current distributions iptables commands are often translated to nftables
underneath.

**ufw** — Uncomplicated Firewall — is a front end aimed at the common cases,
and it lives up to the name:

```bash
ufw status                    # what is currently in force
ufw status numbered           # same, with rule numbers for deletion
ufw allow 22/tcp              # permit SSH
ufw deny 22/tcp               # block SSH
ufw default deny outgoing     # default-deny for outbound traffic
ufw delete 3                  # remove rule 3
```

Two notes from actually using it. `ufw status numbered` before `ufw delete`,
every time — the numbers shift as rules are removed, and deleting by position
after a change removes the wrong rule. And setting a default-deny outbound
policy on a box you are SSH'd into will, if you have not allowed your own return
traffic first, lock you out of it.

## What I took from this

The layer model is the part that stuck. Once you know that a stateless filter
cannot see a connection and a proxy cannot see anything it hasn't terminated,
the entire type taxonomy stops being a list to memorise and becomes a single
question: how far up the stack does this thing look?

The other thing is outbound rules. Inbound filtering is what everyone
configures, and it is the half that stops the initial intrusion. Outbound
filtering is what limits the damage afterward, and it is almost always the
emptier list. Building an IDS made that concrete for me — most of what looks
alarming in a capture is not the way in, it's the traffic that leaves once
something is already running.
