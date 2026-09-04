// ─────────────────────────────────────────────────────────────
//  Evidence aggregation.
//
//  The point of this file: a portfolio that says "I know SSRF" is
//  a claim. A portfolio that says "SSRF — 6 documented engagements"
//  and links to all six is evidence. Everything here counts the
//  actual content so the numbers can never drift from the truth.
// ─────────────────────────────────────────────────────────────

import type { CollectionEntry } from 'astro:content';

type Writeup = CollectionEntry<'writeups'>;

/** URL-safe form of a tag. Tags are authored lowercase-hyphenated already. */
export const tagSlug = (t: string) =>
  t.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Human-facing form of a tag: `sql-injection` → `SQL injection`. */
const ACRONYMS = new Set([
  'sql', 'xss', 'ssrf', 'lfi', 'rfi', 'rce', 'xxe', 'ssti', 'csrf', 'idor',
  'jwt', 'smb', 'ldap', 'dns', 'ftp', 'ssh', 'http', 'https', 'tls', 'ssl',
  'api', 'ad', 'dfir', 'ir', 'osint', 'ctf', 'cve', 'ntlm', 'uac', 'wpa',
  'aes', 'rsa', 'xor', 'php', 'elf', 'pcap', 'siem', 'ids', 'ips', 'waf',
  'llm', 'ai', 'ml', 'toctou', 'suid', 'dbus', 'ssrf', 'imap', 'smtp', 'snmp',
]);

export const tagLabel = (t: string) =>
  t
    .split('-')
    .map((w, i) =>
      ACRONYMS.has(w) ? w.toUpperCase() : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w,
    )
    .join(' ');

// ── Capability clusters ──────────────────────────────────────
//  Each cluster is a skill a hiring manager actually searches for.
//  `match` are tag fragments; a writeup counts toward the cluster
//  if any of its tags contains any fragment.
export interface Capability {
  slug: string;
  name: string;
  blurb: string;
  match: string[];
}

export const capabilities: Capability[] = [
  {
    slug: 'web-appsec',
    name: 'Web & API exploitation',
    blurb: 'Injection, access control, and logic flaws in web applications.',
    match: [
      'web-exploitation', 'sql-injection', 'sqli', 'xss', 'ssrf', 'lfi', 'rfi',
      'path-traversal', 'directory-traversal', 'command-injection', 'ssti', 'xxe',
      'idor', 'csrf', 'authentication-bypass', 'auth-bypass', 'nosql-injection',
      'file-upload', 'deserialization', 'jwt', 'cookie', 'session', 'race-condition',
      'open-redirect', 'request-smuggling', 'prototype-pollution', 'graphql',
    ],
  },
  {
    slug: 'privesc',
    name: 'Privilege escalation',
    blurb: 'Getting from a foothold to root or SYSTEM.',
    match: [
      'privilege-escalation', 'privesc', 'sudo', 'suid', 'setuid', 'gtfobins',
      'cron', 'kernel-exploit', 'capabilities', 'linpeas', 'winpeas', 'dirty',
      'path-hijack', 'service-misconfig', 'toctou',
    ],
  },
  {
    slug: 'recon',
    name: 'Recon & enumeration',
    blurb: 'Mapping attack surface before touching it.',
    match: [
      'nmap', 'rustscan', 'gobuster', 'ffuf', 'wfuzz', 'dirb', 'dirbuster',
      'enumeration', 'subdomain', 'vhost', 'snmp', 'nikto', 'masscan', 'whatweb',
      'port-scanning', 'feroxbuster',
    ],
  },
  {
    slug: 'active-directory',
    name: 'Active Directory & Windows',
    blurb: 'Domain attack paths, Kerberos abuse, and Windows internals.',
    match: [
      'active-directory', 'kerberos', 'kerberoasting', 'asreproast', 'impacket',
      'bloodhound', 'mimikatz', 'ntlm', 'smb', 'evil-winrm', 'secretsdump',
      'windows', 'ldap', 'golden-ticket', 'pass-the-hash', 'responder', 'crackmapexec',
    ],
  },
  {
    slug: 'forensics-ir',
    name: 'Forensics & incident response',
    blurb: 'Reconstructing what happened from what was left behind.',
    match: [
      'forensics', 'dfir', 'disk-image', 'memory-forensics', 'volatility', 'autopsy',
      'event-logs', 'evtx', 'timeline', 'sherlock', 'artifact', 'registry',
      'log-analysis', 'incident-response', 'malware-analysis', 'threat-hunting',
      'sysmon', 'yara', 'mft', 'prefetch',
    ],
  },
  {
    slug: 'network-analysis',
    name: 'Network traffic analysis',
    blurb: 'Reading the wire — packet captures, protocols, and C2.',
    match: [
      'wireshark', 'pcap', 'network-forensics', 'tshark', 'tcpdump', 'c2',
      'traffic-analysis', 'protocol', 'zeek', 'suricata', 'network-analysis',
    ],
  },
  {
    slug: 'crypto',
    name: 'Cryptography',
    blurb: 'Breaking weak implementations and recovering keys.',
    match: [
      'cryptography', 'crypto', 'rsa', 'aes', 'xor', 'vigenere', 'cipher',
      'hash-cracking', 'hashcat', 'john', 'ssh2john', 'hashes', 'encryption',
      'des', 'padding-oracle', 'ecb', 'factorization', 'rot13', 'caesar',
      'hashing',
      // deliberately NOT base64 — that's encoding, not cryptography,
      // and folding it in here would pad the number with trivia.
    ],
  },
  {
    slug: 'reversing',
    name: 'Reverse engineering & binary exploitation',
    blurb: 'Static and dynamic analysis of compiled code.',
    match: [
      'reverse-engineering', 'ghidra', 'gdb', 'binary-exploitation', 'pwntools',
      'buffer-overflow', 'assembly', 'elf', 'disassembly', 'radare', 'objdump',
      'binex', 'rop', 'decompile', 'ida',
    ],
  },
  {
    slug: 'llm-security',
    name: 'LLM & AI security',
    blurb: 'The attack surface that does not have good answers yet.',
    match: [
      'llm-security', 'llm', 'prompt-injection', 'jailbreak', 'ai-security',
      'ai', 'model', 'owasp-llm', 'threat-modelling',
    ],
  },
  {
    slug: 'osint',
    name: 'OSINT',
    blurb: 'Open sources, correlated into an identity or a location.',
    match: [
      'osint', 'geolocation', 'social-media', 'twitter', 'google-dorking',
      'imint', 'reverse-image-search', 'metadata', 'exif',
    ],
  },
  {
    slug: 'stego',
    name: 'Steganography & data recovery',
    blurb: 'Pulling payloads out of files that look ordinary.',
    match: [
      'steganography', 'steghide', 'zsteg', 'binwalk', 'exiftool', 'stegsolve',
      'lsb', 'file-carving', 'foremost', 'outguess',
    ],
  },
  {
    slug: 'tooling',
    name: 'Exploit development & tooling',
    blurb: 'Writing the thing that does the job rather than looking for one.',
    match: [
      'python', 'bash', 'scripting', 'exploit-development', 'custom-exploit',
      'automation', 'pwntools', 'requests', 'websocket',
    ],
  },
];

/**
 * Does a tag match a capability fragment?
 *
 * Matching is on whole hyphen/space-delimited tokens, never raw
 * substrings. A plain `includes` looks fine until `path-trave{rsa}l`
 * counts as cryptography and `http2-de{s}ync` counts as DES — both of
 * which it did. Tokens keep `caesar-cipher` matching `cipher` while
 * keeping `cryptocurrency` out of `crypto`.
 */
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const tagMatches = (tag: string, fragment: string) => {
  const a = tokens(tag);
  const b = tokens(fragment);
  if (b.length === 0 || b.length > a.length) return false;
  // Is `b` a contiguous run of tokens inside `a`?
  return a.some((_, i) => b.every((tok, j) => a[i + j] === tok));
};

/** Does this writeup evidence this capability? */
const hits = (w: Writeup, cap: Capability) =>
  w.data.tags.some((t) => cap.match.some((m) => tagMatches(t, m)));

export interface CapabilityCount extends Capability {
  count: number;
  pct: number;
}

/** Capability clusters with real counts, strongest first. */
export function capabilityCounts(all: Writeup[]): CapabilityCount[] {
  const scored = capabilities.map((cap) => ({
    ...cap,
    count: all.filter((w) => hits(w, cap)).length,
    pct: 0,
  }));
  const max = Math.max(1, ...scored.map((c) => c.count));
  return scored
    .filter((c) => c.count > 0)
    .map((c) => ({ ...c, pct: Math.round((c.count / max) * 100) }))
    .sort((a, b) => b.count - a.count);
}

/** Writeups evidencing one capability, newest first. */
export function writeupsFor(all: Writeup[], slug: string): Writeup[] {
  const cap = capabilities.find((c) => c.slug === slug);
  if (!cap) return [];
  return all.filter((w) => hits(w, cap));
}

// ── Tag index ────────────────────────────────────────────────
export interface TagCount {
  tag: string;
  slug: string;
  label: string;
  count: number;
}

/**
 * Every tag with its count. `min` filters the long tail — there are
 * ~800 distinct tags and most appear exactly once, which makes for a
 * useless index and a slow build.
 *
 * Grouping is by SLUG, not by raw tag. Authors spell the same tag
 * several ways across 155 files ('Privilege Escalation',
 * 'privilege-escalation'), and every one of those collapses to the
 * same URL. Counting the raw strings separately produced a page
 * headed "2 writeups" listing 38 of them.
 */
export function tagCounts(all: Writeup[], min = 1): TagCount[] {
  const map = new Map<string, { count: number; sample: string }>();

  for (const w of all) {
    // de-dupe within a single writeup so one entry can't count twice
    const seen = new Set<string>();
    for (const raw of w.data.tags) {
      const slug = tagSlug(raw);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);

      const found = map.get(slug);
      if (found) found.count += 1;
      else map.set(slug, { count: 1, sample: raw.trim().toLowerCase() });
    }
  }

  return [...map.entries()]
    .filter(([, v]) => v.count >= min)
    // Label from the slug, not the sampled spelling, so the heading
    // doesn't change depending on which file happened to be read first.
    .map(([slug, v]) => ({ tag: v.sample, slug, label: tagLabel(slug), count: v.count }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}

/** Writeups carrying a given tag slug. */
export function writeupsByTag(all: Writeup[], slug: string): Writeup[] {
  return all.filter((w) => w.data.tags.some((t) => tagSlug(t) === slug));
}

/**
 * Other writeups sharing the most tags with this one.
 * Ties break toward the more recent entry.
 */
export function related(all: Writeup[], current: Writeup, limit = 3): Writeup[] {
  const mine = new Set(current.data.tags.map((t) => t.toLowerCase()));
  return all
    .filter((w) => w.id !== current.id)
    .map((w) => ({
      w,
      shared: w.data.tags.filter((t) => mine.has(t.toLowerCase())).length,
    }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || b.w.data.date.valueOf() - a.w.data.date.valueOf())
    .slice(0, limit)
    .map((x) => x.w);
}
