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
  location: 'Prayagraj, India',
  email: 'divyanshagrawal121ag@gmail.com',

  // One line. This is what shows up in search results and on shared links.
  tagline:
    'Offensive security — web, network, Active Directory, and the LLM attack surface. I build the tooling I test with.',

  // Shown as the status line in the sidebar. Set to '' to hide it.
  availability: 'Available for hire',

  // Optional portrait for the cover. Drop a square-ish photo into
  // public/ (e.g. '/portrait.jpg') and it appears beside the hero;
  // leave it '' and the layout closes up with nothing missing.
  portrait: '',

  // Where you'll work. Recruiters filter on this hard.
  openTo: 'Security engineering · Penetration testing · India & remote / relocation',

  // The 100–150 word first-person story. Recruiters read this.
  statement: `I'm a fourth-year engineering student at NIT Allahabad who spends
    most of his time somewhere he wasn't assigned: breaking things on purpose.
    I work offensive security — web and network penetration testing, Active
    Directory, and lately the attack surface nobody has good answers for yet,
    which is LLM applications. I'm in the top 1% globally on TryHackMe and I
    hunt on HackerOne, Bugcrowd and Intigriti. What I care about more than the
    ranking is that I build the tooling I test with: an IDS with an anomaly
    model behind it, a prompt-injection fuzzer, a phishing simulator for
    awareness training. I'm looking for a security engineering or penetration
    testing role where the work is hands on keyboard.`,
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
  { k: 'Subject', v: 'Divyansh Agrawal — Divyansh404' },
  { k: 'Focus', v: 'Offensive security, LLM security, detection engineering' },
  { k: 'Standing', v: 'Top 1% globally, TryHackMe' },
  { k: 'Programs', v: 'HackerOne · Bugcrowd · Intigriti' },
  { k: 'Based', v: 'Prayagraj, India — open to relocation' },
  { k: 'Status', v: 'Open to security roles' },
];

// ── Projects ─────────────────────────────────────────────────
export const projects = [
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
    repo: 'https://github.com/CosmicCoder-X/TrafficLens',
  },
  {
    name: 'PromptProbe',
    kind: 'LLM security',
    blurb: `A prompt-injection testing framework for LLM applications. Attack
      suites are defined in JSON, findings are scored with regex rules, and it
      runs against OpenAI, Gemini and Claude behind one interface. Reports come
      out as HTML, JSON or CSV so they can go straight into a ticket.`,
    points: [
      'JSON-defined attack suites mapped to the OWASP LLM Top 10.',
      'Provider adapters for OpenAI, Gemini, Claude and any plain HTTP endpoint, behind one interface.',
      'HTML, JSON and CSV reporting so a finding can be filed without re-typing it.',
    ],
    stack: ['Python', 'OWASP LLM Top 10', 'Multi-provider'],
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
    repo: 'https://github.com/CosmicCoder-X/Phishing-Simulator',
  },
  {
    name: 'Crypt Raider',
    kind: 'Game development',
    blurb: `A physics-driven puzzle game in Unreal Engine 5. Not security work —
      it's here because writing gameplay systems in C++ taught me more about
      memory, state and engine internals than any tutorial did.`,
    points: [
      'Grab-and-carry physics interaction system written in C++.',
      'The reason I read memory layout and object lifetime problems fluently.',
    ],
    stack: ['Unreal Engine 5', 'C++', 'Physics simulation'],
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
];

// ── Experience ───────────────────────────────────────────────
export const experience = [
  {
    role: 'Coordinator, Cybersecurity Club',
    org: 'MNNIT Allahabad',
    period: 'Current',
    points: [
      'Run workshops and mentor members through CTF strategy.',
      'Mentored project teams across robotics, aeromodelling and astronomy.',
    ],
  },
  {
    role: 'Intern',
    org: 'PPGCL Bara',
    period: '2025',
    points: [
      'Studied the control logic driving physical plant — valves, pumps, filtration.',
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
      { name: 'Athena CTF 2026', issuer: 'Athena CTF', year: '2026', image: '/certifications/Athena CTF_26 certification.png' },
      { name: "CyberGeek'26 CTF", issuer: 'CyberGeek', year: '2026', image: "/certifications/CyberGeek'26 CTF Certificate.png" },
      { name: 'Kaspersky CTF 2025', issuer: 'Kaspersky', year: '2025', image: '/certifications/KasperskyCTF_2025_certificate.png' },
      { name: 'Kaspersky CTF 2026', issuer: 'Kaspersky', year: '2026', image: '/certifications/KasperskyCTF_2026_certificate.png' },
      { name: 'NexHUNT CTF', issuer: 'NexHUNT', year: '', image: '/certifications/NexHUNT CTF Certificate.png' },
      { name: 'World Wide CTF', issuer: 'WWCTF', year: '', image: '/certifications/World Wide CTF Certificate.png' },
      { name: 'scriptCTF 2026', issuer: 'scriptCTF', year: '2026', image: '/certifications/scriptCTF_26 Certificate.png' },
    ],
  },
  {
    slug: 'pathway',
    name: 'Pathway Certificates',
    blurb: 'Certificates earned by completing structured learning paths and roadmaps.',
    items: [
      { name: 'Junior Penetration Tester', issuer: 'TryHackMe', year: '', image: '' },
      { name: 'Blue Team Junior Analyst', issuer: 'Security Blue Team', year: '', image: '' },
    ],
  },
  {
    slug: 'professional',
    name: 'Professional Certifications',
    blurb: 'Industry certifications and structured coursework.',
    items: [
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
