---
title: 'Easy Phish'
target: 'Hack The Box — Easy Phish'
difficulty: 'easy'
date: 2025-08-29
summary: 'An OSINT challenge — DNS enumeration of secure-startup.com revealing a misconfigured SPF record (?all) and unenforced DMARC (p=none), with the flag split across both TXT records.'
role: 'soc'
tags: ['osint', 'dns', 'spf', 'dmarc', 'email-authentication', 'dig', 'phishing', 'domain-spoofing']
problem: 'Customers of secure-startup.com are receiving convincing phishing emails from the domain. The task is to investigate DNS email authentication records to determine why spoofed emails pass validation.'
action: 'Enumerated DNS records for secure-startup.com using dig. Queried TXT records and found a misconfigured SPF record using ?all (neutral qualifier) instead of -all (hard fail), with the first half of the flag embedded in the record. Recognised the connection to email authentication and queried the _dmarc subdomain TXT record, finding a DMARC policy set to p=none (no enforcement) with the second half of the flag.'
outcome: 'Recovered the flag HTB{RIP_SPF_Always_2nd_F1ddl3_2_DMARC} split across the SPF and DMARC TXT records. The misconfigured SPF (?all) and unenforced DMARC (p=none) policies explain why phishing emails spoofing the domain pass recipient mail server checks.'
draft: false
---

## Background

The challenge description says customers of secure-startup.com are receiving convincing phishing emails and asks us to figure out why. The word "convincing" is the hint — the emails aren't just well-crafted socially, they're passing technical validation. That points directly at the domain's email authentication configuration.

---

## DNS enumeration

Starting with a `dig` query for TXT records on the domain reveals the SPF configuration — and the first half of the flag embedded in it.

```
dig secure-startup.com TXT
```

```
;; ANSWER SECTION:
secure-startup.com.  1800  IN  TXT  "v=spf1 a mx ?all - HTB{RIP_SPF_Always_2nd"
```

The SPF record uses `?all` — the neutral qualifier — instead of `-all` (hard fail). This means the SPF policy doesn't instruct receiving mail servers to reject messages from unauthorised senders. Any server can send email claiming to be from secure-startup.com and the SPF check will return a neutral result rather than a fail.

---

## DMARC record

SPF alone doesn't tell the full story. DMARC (Domain-based Message Authentication, Reporting and Conformance) is the policy layer that tells receiving servers what to do when SPF and DKIM checks fail. Querying the standard DMARC subdomain reveals the second half.

```
dig _dmarc.secure-startup.com TXT
```

```
;; ANSWER SECTION:
_dmarc.secure-startup.com.  1232  IN  TXT  "v=DMARC1;p=none;_F1ddl3_2_DMARC}"
```

The DMARC policy is set to `p=none` — meaning even if SPF or DKIM checks fail, the receiving server is told to take no action. The email gets delivered regardless. Combined with the neutral SPF qualifier, this domain has effectively no protection against email spoofing.

The complete flag: **HTB{RIP_SPF_Always_2nd_F1ddl3_2_DMARC}**

---

## What I took from this

The challenge is a concise demonstration of why email authentication requires all three layers — SPF, DKIM, and DMARC — configured correctly and with enforcement enabled. An SPF record with `?all` is functionally useless because it never tells receivers to reject anything. A DMARC policy with `p=none` is monitoring-only — it generates reports but doesn't prevent delivery of spoofed emails. Together, they create a domain that looks like it has email authentication configured (the records exist) but provides zero actual protection.

In real-world phishing campaigns, attackers check exactly these records before choosing which domains to spoof. A domain with `?all` or `~all` in SPF and `p=none` in DMARC is an open invitation — spoofed emails will pass through most mail servers without triggering spam filters or authentication warnings. The fix is straightforward: `v=spf1 a mx -all` for hard SPF failure and `v=DMARC1; p=reject` for DMARC enforcement. But the number of organisations still running `p=none` years after deploying DMARC "for monitoring" is higher than it should be.
