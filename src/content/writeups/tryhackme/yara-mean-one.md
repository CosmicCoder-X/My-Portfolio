---
title: 'YARA Mean One'
target: 'TryHackMe — YARA Mean One'
difficulty: 'easy'
date: 2025-08-28
summary: 'A practical introduction to YARA rule writing where a custom regex-based rule is crafted to scan a directory of 60 image files for embedded string indicators matching the pattern TBFC: followed by alphanumeric characters. The matching files are identified, the strings are extracted with the Linux strings utility, and the fragments are reassembled into a hidden message.'
role: 'soc'
tags: ['yara', 'pattern-matching', 'strings', 'regex', 'blue-team', 'forensics', 'steganography']
problem: 'A directory contains 60 JPEG image files, some of which have string indicators embedded inside them following a specific pattern — the prefix TBFC: followed by alphanumeric ASCII characters. The task is to write a YARA rule that identifies the matching files, extract the embedded strings, and reconstruct a hidden message from the fragments.'
action: 'Listed the target directory to understand the file set, wrote a YARA rule using a regex pattern /TBFC:[A-Za-z0-9]+/ to match the indicator format, ran the rule recursively against the directory to identify the 5 matching files, used the strings utility piped through grep to extract the embedded values from each file, confirmed the matches and their byte offsets with YARA''s -s flag, and rearranged the extracted fragments into a coherent sentence.'
outcome: 'Identified 5 images containing the TBFC pattern out of 60, extracted the embedded strings (HopSec, me, Find, Island, in), and reconstructed the hidden message: Find me in HopSec Island.'
draft: false
---

## Background

YARA is a pattern-matching tool used primarily by malware analysts and blue teams to classify and identify files based on textual or binary patterns. Rules are written in a domain-specific language that combines string definitions (literal strings, hex patterns, or regular expressions) with boolean conditions. When a rule matches, the file is flagged — making YARA essentially a programmable `grep` for binary files, but with support for complex matching logic across multiple patterns.

This room is a practical exercise in writing and applying a basic YARA rule. The scenario is straightforward: a directory of image files contains hidden string indicators, and the job is to find them, extract them, and reconstruct a message. It's a gentle introduction, but the underlying technique — scanning files for embedded indicators using custom rules — is exactly how YARA is used in production malware analysis.

---

## Exploring the target directory

The target directory at `~/Downloads/easter` contains 60 JPEG image files (easter1.jpg through easter60.jpg) and an `embeds` directory:

```
ubuntu@tryhackme:~/Downloads/easter$ ls
```

![Terminal listing of the easter directory — 60 JPEG files named easter1.jpg through easter60.jpg arranged in columns, plus an embeds directory.](/writeups/thm-yara-mean-one/01-easter-directory-listing.png)

The question is which of these 60 images have strings embedded in them matching the pattern `TBFC:` followed by alphanumeric characters. Checking them one by one with `strings` and `grep` would work but would be tedious — this is exactly what YARA is designed to automate.

---

## Writing the YARA rule

The rule needs to match the literal prefix `TBFC:` followed by one or more ASCII alphanumeric characters. In YARA's rule syntax, this is a single regex string with a boolean condition:

```
rule TBFC_Message {
    strings:
        $tbfc = /TBFC:[A-Za-z0-9]+/
    condition:
        $tbfc
}
```

The `strings` block defines a regex pattern: `TBFC:` as a literal prefix, `[A-Za-z0-9]+` matching one or more ASCII letters or digits. The `condition` block says the rule matches if the pattern appears anywhere in the file. Saved as `tbfc.yar`.

The regex itself — `/TBFC:[A-Za-z0-9]+/` — is the answer to the room's second question. The character class `[A-Za-z0-9]` covers all ASCII alphanumeric characters, and the `+` quantifier requires at least one character after the colon.

---

## Running the scan

Scanning the directory recursively with the YARA rule:

```
ubuntu@tryhackme:~/Downloads/easter$ yara -r tbfc.yar .
```

Five files match:

```
TBFC_Message ./easter46.jpg
TBFC_Message ./easter16.jpg
TBFC_Message ./easter10.jpg
TBFC_Message ./easter52.jpg
TBFC_Message ./easter25.jpg
```

Out of 60 images, **5** contain the embedded pattern.

---

## Extracting the hidden message

With the matching files identified, `strings` piped through `grep` pulls out the exact embedded values from each one:

```
ubuntu@tryhackme:~/Downloads/easter$ strings easter46.jpg | grep TBFC
TBFC:HopSec

ubuntu@tryhackme:~/Downloads/easter$ strings easter16.jpg | grep TBFC
TBFC:me

ubuntu@tryhackme:~/Downloads/easter$ strings easter10.jpg | grep TBFC
TBFC:Find

ubuntu@tryhackme:~/Downloads/easter$ strings easter52.jpg | grep TBFC
TBFC:Island

ubuntu@tryhackme:~/Downloads/easter$ strings easter25.jpg | grep TBFC
TBFC:in
```

Running YARA again with the `-s` flag (show matching strings) and `-r` (recursive) confirms the matches and displays the byte offset where each pattern occurs inside the file:

![Terminal showing strings output for each matching file and YARA scan with -r -s flags — easter46.jpg contains TBFC:HopSec at offset 0x2f78a, easter10.jpg contains TBFC:Find at offset 0x137da8, easter16.jpg contains TBFC:me at offset 0x3bb7f7, easter52.jpg contains TBFC:Island at offset 0x2a2ad2, and easter25.jpg contains TBFC:in at offset 0x42c778.](/writeups/thm-yara-mean-one/02-strings-yara-scan-results.png)

Stripping the `TBFC:` prefix from each match gives five words: HopSec, me, Find, Island, in. Rearranged into a coherent sentence, the hidden message is:

```
Find me in HopSec Island
```

---

## What I took from this

The room is simple by design, but the workflow it teaches scales directly to real-world use. YARA rules in production malware analysis work exactly the same way — define patterns (strings, hex sequences, regex), set conditions (all of them, any of them, a minimum count, combined with file size or header checks), and scan. The difference is complexity: a production rule might match on specific byte sequences from a malware family's encryption routine, combined with PE header characteristics and file size constraints, rather than a simple string prefix.

The `strings` utility is worth knowing well for this kind of work. It extracts printable character sequences from binary files — anything that looks like ASCII (or Unicode, with the `-e` flag) text of a minimum length. Combined with `grep`, it's the fastest way to check what human-readable content is hiding inside a binary file. The embedded `TBFC:` strings in these images are trivial examples, but the same technique surfaces hardcoded URLs, IP addresses, API keys, debug messages, and other artifacts in malware samples routinely.

The YARA `-s` flag showing byte offsets is a small but useful detail. In a real investigation, knowing *where* in a file a pattern matches matters — is it in the PE header, in a resource section, appended after the file's logical end, or embedded in image metadata? The offset tells you what kind of embedding technique was used and guides further analysis.
