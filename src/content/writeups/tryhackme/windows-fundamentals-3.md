---
title: 'Windows Fundamentals 3'
target: 'TryHackMe — Windows Fundamentals 3'
difficulty: 'easy'
date: 2026-08-26
summary: 'The built-in tools that keep a Windows device secure — Windows Update, the Windows Security dashboard, firewall profiles, TPM and device security, BitLocker, and Volume Shadow Copy.'
role: 'soc'
tags: ['Windows', 'Windows Security', 'BitLocker', 'TPM', 'Firewall', 'Defender', 'VSS']
problem: 'Windows ships with a stack of built-in security controls, and knowing what each one does — and what it looks like when it is misconfigured — is baseline knowledge for both defending and attacking Windows hosts.'
action: 'Walked the native security tooling on a Windows VM: update history, the Security dashboard status colours, firewall profiles, device security and TPM, BitLocker, and VSS.'
outcome: 'A working map of the defensive controls built into Windows and how their state is surfaced to the user.'
---

Part 3 of the Windows Fundamentals module is the defensive half — the tools
Microsoft builds in to keep a device secure. No exploitation here; it's about
knowing what these controls do, because you can't attack or defend a Windows host
without understanding the protections already sitting on it.

## Windows Update

The first control is the least glamorous and the most important: patching. Update
history lives under **Settings → Update & Security → View update history**, split
into categories including Definition Updates (the antivirus signature updates).

On the room's VM, the two definition updates were installed on **5/3/2021**.
Reading update history matters beyond the trivia — a host that hasn't pulled
updates in months is a host with known, unpatched holes, and the history is where
you confirm that.

## Windows Security dashboard

The Windows Security app is the single pane for the device's protection status,
and it communicates state through colour:

- **Green** — protected, no action needed.
- **Yellow** — a recommendation to review.
- **Red** — something needs immediate attention.

On the VM, **Virus & threat protection** was red — the area demanding immediate
attention.

## Virus & threat protection

Drilling into that red item, the specific problem was that **Real-time
protection** was turned off. Real-time protection is the piece that scans files as
they're accessed rather than only on a scheduled sweep, so with it disabled the
machine isn't being actively watched — exactly the state an attacker would want to
leave a box in, and exactly the kind of thing a defender should alert on.

## Firewall & network protection

Windows Firewall runs three profiles — Domain, Private and Public — and the active
one changes with the network. Public is the default for untrusted networks, and
it's the most restrictive.

So connected to **airport Wi-Fi**, the active profile would be **Public network** —
which is the correct, locked-down default for a hotspot you don't trust. This is
the same profile mechanism that trips people up when a firewall rule "doesn't
work": it was scoped to the wrong profile.

## Device security and TPM

Device security surfaces hardware-backed protections, the central one being the
**TPM — Trusted Platform Module**. The TPM is a dedicated chip that stores
cryptographic keys in hardware, which is what lets features like BitLocker bind
encryption to a specific machine rather than just a password.

## BitLocker

BitLocker is full-volume encryption, and it leans on the TPM to seal the
encryption key to the hardware. But not every machine has one — on a device
**without TPM version 1.2 or later**, the user must insert a **USB Startup Key**
that holds the key material instead, supplying at boot what the TPM would
otherwise provide.

The security point underneath: BitLocker protects data at rest. A stolen laptop
with an encrypted drive is a brick; the same laptop unencrypted is an open filing
cabinet.

## Volume Shadow Copy Service

**VSS — Volume Shadow Copy Service** creates point-in-time snapshots of volumes,
which is what backs Windows restore points and shadow copies. Worth knowing from
both sides: it's a recovery feature defensively, and offensively those same shadow
copies are a well-known place to recover files or extract things like the SAM
database that are locked while Windows is running.

## What I took from this

This room is a catalogue, but the useful framing is that every one of these
controls has two faces. Real-time protection off is a defender's alert and an
attacker's goal. BitLocker is data-at-rest protection and, for anyone with
physical access, the wall they have to get around. VSS is backup and a
credential-recovery path. Knowing the built-in Windows security stack isn't just
blue-team hygiene — it's the map of what's in your way, or on your side, on every
Windows host you'll touch.
