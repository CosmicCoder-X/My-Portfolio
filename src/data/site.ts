// ─────────────────────────────────────────────────────────────
//  EVERYTHING PERSONAL LIVES HERE.
//  To change text on the site, edit this file. Nothing else.
// ─────────────────────────────────────────────────────────────

export const person = {
  name: 'Divyansh Agrawal',
  handle: 'Divyansh404',
  role: 'Security researcher',
  location: 'Prayagraj, India',
  email: 'divyanshagrawal121ag@gmail.com',

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
// TODO(Divyansh): confirm each of these resolves to your profile.
// The ones marked VERIFY are guesses based on your handle.
export const links = [
  { label: 'GitHub', url: 'https://github.com/CosmicCoder-X', note: '' },
  { label: 'LinkedIn', url: 'https://linkedin.com/in/divyansh-agrawal1337', note: '' },
  { label: 'TryHackMe', url: 'https://tryhackme.com/p/Divyansh404', note: 'VERIFY' },
  { label: 'HackTheBox', url: 'https://app.hackthebox.com/profile/overview', note: 'VERIFY' },
  { label: 'HackerOne', url: 'https://hackerone.com/divyansh404', note: 'VERIFY' },
  { label: 'Bugcrowd', url: 'https://bugcrowd.com/divyansh404', note: 'VERIFY' },
  { label: 'Intigriti', url: 'https://app.intigriti.com/researcher/divyansh404', note: 'VERIFY' },
];

// ── Cover metadata (the report header on the homepage) ────────
export const cover = [
  { k: 'Subject', v: 'Divyansh Agrawal — Divyansh404' },
  { k: 'Focus', v: 'Offensive security, LLM security, detection engineering' },
  { k: 'Standing', v: 'Top 1% globally, TryHackMe' },
  { k: 'Programs', v: 'HackerOne · Bugcrowd · Intigriti' },
  { k: 'Based', v: 'Prayagraj, India' },
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
    stack: ['Python', 'Scapy', 'Npcap', 'ML anomaly scoring'],
    repo: '',
  },
  {
    name: 'PromptProbe',
    kind: 'LLM security',
    blurb: `A prompt-injection testing framework for LLM applications. Attack
      suites are defined in JSON, findings are scored with regex rules, and it
      runs against OpenAI, Gemini and Claude behind one interface. Reports come
      out as HTML, JSON or CSV so they can go straight into a ticket.`,
    stack: ['Python', 'OWASP LLM Top 10', 'Multi-provider'],
    repo: '',
  },
  {
    name: 'Phishing Simulator',
    kind: 'Security awareness',
    blurb: `A platform for running controlled phishing scenarios against a
      willing organisation. Built to demonstrate how ordinary the successful
      lures look, and to give awareness training something concrete to point at.`,
    stack: ['Flask', 'Python', 'CSV reporting'],
    repo: '',
  },
  {
    name: 'Crypt Raider',
    kind: 'Game development',
    blurb: `A physics-driven puzzle game in Unreal Engine 5. Not security work —
      it's here because writing gameplay systems in C++ taught me more about
      memory, state and engine internals than any tutorial did.`,
    stack: ['Unreal Engine 5', 'C++', 'Physics simulation'],
    repo: '',
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
