// ─────────────────────────────────────────────────────────────
//  EVERYTHING PERSONAL LIVES HERE.
//  To change text on the site, edit this file. Nothing else.
//
//  Set `portrait` below once you have a photo you want on the site;
//  everything else here is confirmed.
// ─────────────────────────────────────────────────────────────

export const person = {
  name: 'Divyansh Agrawal',
  handle: 'Divyansh404',
  role: 'Security researcher',
  location: 'India',
  email: 'divyanshagrawal121ag@gmail.com',

  // One line. This is what shows up in search results and on shared links.
  tagline:
    'Offensive security: web, network, infrastructure, and the LLM attack surface. I build the tooling I test with.',

  // Shown as the status line in the sidebar. Set to '' to hide it.
  availability: 'Available for hire',

  // Illustration beside the hero. Generated from assets/portrait-source.png
  // by `npm run assets`, which cuts a real alpha channel so the strokes sit
  // on the page ground with no visible panel behind them. Set to '' and the
  // layout closes up with nothing missing.
  portrait: '/portrait.png',
  portraitAlt: 'Line-art portrait of Divyansh Agrawal.',

  // Where you'll work. Recruiters filter on this hard.
  openTo: 'Security roles · Penetration testing · India & remote / relocation',

  // The first-person story, written conversationally rather than as a
  // resume restated in prose. Recruiters read this.
  statement: `Hi, I'm Divyansh. I break web applications, networks,
    infrastructure, and lately the language models everyone's shipping
    without testing them properly. I'm energized by the parts most people
    skip: reading the actual protocol spec instead of the summary, building
    the tool instead of downloading someone else's, chasing a bug until the
    repro is boring and repeatable. I do my best work somewhere between a
    terminal and a half-written exploit.

    I'm a fourth-year engineering student at NIT Allahabad, currently top 1%
    globally on TryHackMe, and I hunt on HackerOne, Bugcrowd and Intigriti. I
    built this site with Claude, but every writeup on it is mine: what broke,
    what I tried, what actually worked. I'm looking for security roles or
    penetration testing work where the job is hands on keyboard.`,
};

// ── Links ────────────────────────────────────────────────────
// All confirmed by Divyansh. `primary: true` picks the handful shown
// in the sidebar; every one of them appears in the footer and on the
// About page regardless.
export const links = [
  { label: 'GitHub', url: 'https://github.com/CosmicCoder-X', primary: true },
  { label: 'LinkedIn', url: 'https://linkedin.com/in/divyansh-agrawal1337', primary: true },
  { label: 'TryHackMe', url: 'https://tryhackme.com/p/Divyansh404', primary: true },
  { label: 'Hack The Box', url: 'https://app.hackthebox.com/public/users/2193965', primary: true },
  { label: 'HackerOne', url: 'https://hackerone.com/divyansh404', primary: false },
  { label: 'Bugcrowd', url: 'https://bugcrowd.com/h/Divyansh404', primary: false },
  { label: 'Intigriti', url: 'https://app.intigriti.com/profile/divyansh_404', primary: false },
  { label: 'Cylab Academy', url: 'https://learn.cylabacademy.org/users/Divyansh404', primary: false },
];

// ── Cover metadata (the report header on the homepage) ────────
export const cover = [
  { k: 'Subject', v: 'Divyansh Agrawal · Divyansh404' },
  { k: 'Focus', v: 'Offensive security, defensive security, LLM security' },
  { k: 'Standing', v: 'Top 1% globally, TryHackMe' },
  { k: 'Programs', v: 'HackerOne · Bugcrowd · Intigriti' },
  { k: 'Based', v: 'India · open to relocation' },
  { k: 'Status', v: 'Open to security roles' },
];

// ── Projects ─────────────────────────────────────────────────
export const projects = [
  {
    name: 'ransomprint',
    kind: 'Ransomware triage',
    blurb: `Ransomware family fingerprinting and recovery triage. Point it at a
      folder that's already been hit and it tells you two things honestly:
      what probably did this, and whether that's actually recoverable,
      rather than the false hope or blanket pessimism most "decrypt my
      files" search results land on.`,
    points: [
      'Fingerprints ransom notes and encrypted-file evidence against a curated family database, then gives a confidence-ranked recovery verdict per family: solved outright (a public master key exists), solved for some victims only (a law-enforcement seizure or a code path like WannaCry\'s un-rebooted-machine requirement), not solved, or not actually ransomware at all (NotPetya was a wiper, so paying could never have produced a key).',
      'Implements one real recovery technique itself rather than faking more: keystream-reuse recovery, exploiting the historically real bug class where a stream cipher reuses the same key and nonce across files, letting a known plaintext/ciphertext pair recover every other file under that key, verified by checking the output\'s entropy rather than trusting a blind guess.',
      'Ships an explicit "honest limitations" section admitting where it can mislead: entropy-based detection false-positives on already-compressed formats, the family database is a curated starting set rather than an authoritative feed, the same rigor the tool asks of a ransom note.',
    ],
    stack: ['Python', 'Entropy analysis', 'Keystream recovery'],
    tags: ['malware-analysis', 'cryptography', 'python'],
    repo: 'https://github.com/CosmicCoder-X/ransomprint',
  },
  {
    name: 'Canary',
    kind: 'Deception engineering',
    blurb: `A self-hosted honeytoken generator. It mints tripwire artifacts:
      files and links designed to look like something worth stealing, and
      fires an alert the instant one gets touched, turning an attacker's own
      curiosity into the detection signal.`,
    points: [
      'Seven token types, each a real artifact rather than a stub: invisible web bugs, booby-trapped PDF and DOCX files, fake .env and kubeconfig credentials, and a TCP listener that speaks the actual MySQL wire protocol and replies to a connection attempt with a real handshake.',
      'GeoIP enrichment and browser fingerprinting on every trigger, with a 15-minute Redis dedup window per token/source pair so a curious attacker reloading the page does not spam the alert channel.',
      'Self-hostable behind a single justfile command: Go backend, React/TypeScript frontend, Postgres and Redis in Docker Compose, with an optional Cloudflare Tunnel overlay so it can go live without opening a port.',
    ],
    stack: ['Go', 'React · TypeScript', 'PostgreSQL · Redis', 'Docker'],
    tags: ['incident-response'],
    repo: 'https://github.com/CosmicCoder-X/canary-token-generator',
  },
  {
    name: 'Palisade',
    kind: 'MCP security',
    blurb: `A security scanner for Model Context Protocol servers. It reads what a
      server advertises (its tools, prompts and schemas) rather than trusting it,
      and reports the ways that surface can be used to manipulate the agent connected
      to it. It pins what it saw on first use, so a server that behaves during review
      and changes afterwards gets caught.`,
    points: [
      '25 pattern-based detection rules: hidden-Unicode payloads, homoglyph impersonation, cross-server tool-name collisions, and rug pulls (an approved tool definition that quietly changes later).',
      'An opt-in semantic layer sends the surface to Claude or Gemini to judge intent rather than vocabulary, with every returned quote checked against the actual surface before a finding is trusted. The judge is deliberately given no tools and a schema-constrained response, so text designed to manipulate it can change what it says, not what it does.',
      'SARIF output with a --fail-on threshold for CI, so a poisoned MCP server fails a pipeline instead of shipping.',
    ],
    stack: ['Python', 'MCP', 'Claude · Gemini', 'SARIF / CI'],
    tags: ['llm-security', 'python'],
    repo: 'https://github.com/CosmicCoder-X/mcp-palisade',
  },
  {
    name: 'TrafficLens',
    kind: 'Detection engineering',
    blurb: `A real-time network intrusion detection system. Signature matching
      catches the known-bad; an anomaly scoring model flags the rest. Incidents
      log to JSONL and surface on a browser dashboard so you can actually watch
      traffic rather than grep it after the fact.`,
    points: [
      'Live packet capture through Scapy and Npcap, parsed and scored inline.',
      'Rule-based signatures plus online anomaly scoring, tuned to cut the false-positive noise that makes most home-grown IDS unusable.',
      'JSONL incident log and a browser dashboard for triage.',
    ],
    stack: ['Python', 'Scapy', 'Npcap', 'ML anomaly scoring'],
    tags: ['network-analysis', 'threat-hunting', 'python'],
    repo: 'https://github.com/CosmicCoder-X/TrafficLens',
  },
  {
    name: 'PromptProbe',
    kind: 'LLM security',
    blurb: `A prompt-injection testing framework for LLM applications. Attack
      suites are JSON-defined and matrix-expand, so a handful of templated
      cases generate dozens of concrete payload variants automatically. It
      ships with real SDK adapters for OpenAI, Gemini and Claude plus a
      generic HTTP adapter for anything else, and includes vulnerable and
      hardened demo targets so a report is an actual before/after, not just
      a score.`,
    points: [
      'JSON-defined attack suites that matrix-expand: one templated case with a few variables generates dozens of concrete payload variants.',
      'Real SDK adapters for OpenAI, Gemini and Claude, plus a generic HTTP adapter for any other endpoint, all behind one interface.',
      'Weighted regex checks scored by severity, concurrent multi-worker runs, and HTML/JSON/CSV reports, validated against shipped vulnerable and hardened demo targets.',
    ],
    stack: ['Python', 'Matrix-expanded suites', 'Multi-provider'],
    tags: ['llm-security', 'prompt-injection', 'python'],
    repo: 'https://github.com/CosmicCoder-X/PromptProbe',
  },
  {
    name: 'Phishing Simulator',
    kind: 'Security awareness',
    blurb: `A platform for running controlled phishing scenarios against a
      willing organisation. Built to demonstrate how ordinary the successful
      lures look, and to give awareness training something concrete to point at.`,
    points: [
      'Campaign setup, delivery and click-through tracking in a Flask app.',
      'CSV reporting designed to be handed to whoever runs the training.',
      'Built for consented, in-scope awareness exercises only.',
    ],
    stack: ['Flask', 'Python', 'CSV reporting'],
    tags: ['social-engineering', 'python'],
    repo: 'https://github.com/CosmicCoder-X/Phishing-Simulator',
  },
  {
    name: 'Crypt Raider',
    kind: 'Game development',
    blurb: `A physics-driven puzzle game in Unreal Engine 5. Not security work:
      it's here because writing gameplay systems in C++ taught me more about
      memory, state and engine internals than any tutorial did.`,
    points: [
      'Grab-and-carry physics interaction system written in C++.',
      'The reason I read memory layout and object lifetime problems fluently.',
    ],
    stack: ['Unreal Engine 5', 'C++', 'Physics simulation'],
    tags: [],
    repo: '',
  },
];

// ── Education ────────────────────────────────────────────────
export const education = [
  {
    school: 'Motilal Nehru National Institute of Technology, Allahabad',
    qualification: 'B.Tech, Chemical Engineering',
    period: 'Expected 2027',
    detail: `Process thinking is the transferable part: you learn to read a system
      as a chain of dependencies where the failure is rarely where the alarm goes off.`,
  },
  {
    school: 'Ewing Christian Public Senior Secondary School, Allahabad',
    qualification: 'CBSE, Class 12',
    period: '2022',
    detail: '96.4%.',
  },
  {
    school: 'Ewing Christian Public Senior Secondary School, Allahabad',
    qualification: 'CBSE, Class 10',
    period: '2020',
    detail: '97.6%.',
  },
];

// ── Experience ───────────────────────────────────────────────
export const experience = [
  {
    role: 'Coordinator, Cybersecurity Club',
    org: 'MNNIT Allahabad',
    period: 'Current',
    points: [
      'Run workshops and mentor members through CTF strategy.',
    ],
  },
  {
    role: 'Technical Project Mentor',
    org: 'Astro Club, Aerodynamics Club & Robotics Club, MNNIT Allahabad',
    period: 'Current',
    points: [
      'Mentor student project teams across astronomy, aerodynamics and robotics builds.',
    ],
  },
  {
    role: 'Coordinator',
    org: 'Astro Club & Aeromodelling Club, MNNIT Allahabad',
    period: 'Current',
    points: [
      'Coordinate club activities and events for both clubs.',
    ],
  },
  {
    role: 'Content Team Coordinator',
    org: "Institute's Innovation Council, MNNIT Allahabad",
    period: 'Current',
    points: [
      'Coordinate the content team and have organized events featuring invited external speakers.',
    ],
  },
  {
    role: 'Coordinator, Music Club',
    org: 'MNNIT Allahabad',
    period: 'Current',
    points: [
      'Coordinate band logistics and rehearsal schedules for the club, playing synthesizer myself.',
    ],
  },
  {
    role: 'Intern',
    org: 'PPGCL Bara',
    period: '2025',
    points: [
      'Studied the control logic driving physical plant: valves, pumps, filtration.',
      'Watching a command travel from a screen to industrial hardware is the clearest lesson in why OT security matters that I could have asked for.',
    ],
  },
];

// ── Credentials ──────────────────────────────────────────────
export const credentials = [
  { name: 'Junior Penetration Tester', issuer: 'TryHackMe', kind: 'Path' },
  { name: 'Blue Team Junior Analyst', issuer: 'Security Blue Team', kind: 'Pathway' },
  { name: 'Ethical Hacking', issuer: 'Cisco', kind: 'Certification' },
  { name: 'FOR589 — Cybercrime Investigations', issuer: 'SANS curriculum', kind: 'Self-study' },
  { name: 'AI Hacking 101', issuer: 'Self-study', kind: 'Applied in PromptProbe' },
];

// ── Certification categories (for /certifications/ page) ────
// To add a new cert: copy a line, change name/issuer/year/image.
// image: path relative to public/ — upload PNG/PDF to public/certifications/ on GitHub.
// For PDFs: convert to PNG first (screenshot or export), or link the PDF in image field
// and the page will show a placeholder tile with a download link.
export const certCategories = [
  {
    slug: 'ctf',
    name: 'CTF Certificates',
    blurb: 'Certificates earned from capture-the-flag competitions.',
    items: [
      { name: 'Athena CTF 2026', issuer: 'Athena CTF', year: '2026', image: '/certifications/Athena CTF_26 certification.jpg' },
      { name: "CyberGeek'26 CTF", issuer: 'CyberGeek', year: '2026', image: "/certifications/CyberGeek'26 CTF Certificate.jpg" },
      { name: 'Kaspersky CTF 2025', issuer: 'Kaspersky', year: '2025', image: '/certifications/KasperskyCTF_2025_certificate.jpg' },
      { name: 'Kaspersky CTF 2026', issuer: 'Kaspersky', year: '2026', image: '/certifications/KasperskyCTF_2026_certificate.jpg' },
      { name: 'NexHUNT CTF', issuer: 'NexHUNT', year: '2025', image: '/certifications/NexHUNT CTF Certificate.jpg' },
      { name: 'World Wide CTF', issuer: 'WWCTF', year: '2025', image: '/certifications/World Wide CTF Certificate.jpg' },
      { name: 'scriptCTF 2026', issuer: 'scriptCTF', year: '2026', image: '/certifications/scriptCTF_26 Certificate.jpg' },
      { name: 'Advent of Cyber 2025', issuer: 'TryHackMe', year: '2025', image: '/certifications/advent-of-cyber-2025.jpg' },
      { name: 'Hacker Holidays', issuer: 'TryHackMe', year: '2026', image: '/certifications/hacker-holidays.jpg' },
    ],
  },
  {
    slug: 'pathway',
    name: 'Pathway Certificates',
    blurb: 'Certificates earned by completing structured learning paths and roadmaps.',
    items: [
      { name: 'Cyber Security 101', issuer: 'TryHackMe', year: '2025', image: '/certifications/cybersecurity-101-pathway.jpg' },
      { name: 'Junior Penetration Tester', issuer: 'TryHackMe', year: '2025', image: '/certifications/junior-penetration-tester-pathway.jpg' },
      { name: 'Web Fundamentals', issuer: 'TryHackMe', year: '2025', image: '/certifications/web-fundamentals-learning-path.jpg' },
      { name: 'Blue Team Junior Analyst', issuer: 'Security Blue Team', year: '2026', image: '/certifications/blue-team-junior-analyst.jpg' },
      { name: 'Web Application Pentesting', issuer: 'TryHackMe', year: '2026', image: '/certifications/web-pentesting-pathway.jpg' },
    ],
  },
  {
    slug: 'professional',
    name: 'Professional Certifications',
    blurb: 'Industry certifications and structured coursework.',
    items: [
      { name: 'Web App Pentester Level 1 (WEB1)', issuer: 'TryHackMe', year: '2026', image: '/certifications/web1-professional-certification.jpg' },
      { name: 'Ethical Hacking', issuer: 'Cisco', year: '', image: '' },
      { name: 'FOR589 — Cybercrime Investigations', issuer: 'SANS curriculum', year: '', image: '' },
      { name: 'AI Hacking 101', issuer: 'Self-study', year: '', image: '' },
    ],
  },
];

// ── Toolkit ──────────────────────────────────────────────────
export const toolkit = [
  {
    group: 'Offensive',
    items: ['Burp Suite', 'Metasploit', 'SQLMap', 'Nmap', 'Mimikatz', 'John the Ripper', 'Aircrack-ng', 'LinPEAS'],
  },
  {
    group: 'Defensive',
    items: ['Wireshark', 'Nessus', 'SIEM', 'Suricata-style detection', 'Incident response'],
  },
  {
    group: 'Domains',
    items: ['OWASP Web / API / LLM', 'Active Directory', 'Wireless', 'AWS security', 'Privilege escalation'],
  },
  {
    group: 'Building',
    items: ['Python', 'Bash', 'C++', 'Rust', 'JavaScript', 'Unreal Engine 5', 'OpenCV'],
  },
];

export const platforms = [
  { slug: 'tryhackme', name: 'TryHackMe', blurb: 'Rooms, paths, and the top 1% climb.' },
  { slug: 'hackthebox', name: 'Hack The Box', blurb: 'Machines and challenge chains.' },
  { slug: 'picoctf', name: 'picoCTF', blurb: 'Competition challenges.' },
  { slug: 'bugbounty', name: 'Bug bounty', blurb: 'Disclosed findings, sanitised.' },
  { slug: 'otherctf', name: 'Other CTFs', blurb: 'Standalone competitions and one-off events.' },
];

export const roles: Record<string, string> = {
  pentest: 'Penetration testing',
  soc: 'SOC / detection',
  appsec: 'Application security',
  llm: 'LLM security',
  forensics: 'Forensics / IR',
};

export const difficulties = ['easy', 'medium', 'hard', 'insane'] as const;
