---
title: 'Snyk Open Source'
target: 'TryHackMe — Snyk Open Source'
difficulty: 'easy'
date: 2025-08-29
summary: 'A walkthrough of Snyk Open Source for dependency vulnerability scanning — forking a deliberately vulnerable Node.js project on GitHub, connecting it to Snyk via SSO-authenticated GitHub integration, interpreting vulnerability results including a high-severity lodash prototype pollution (CVE, CVSS 7.5), understanding transitive dependency risk, and integrating Snyk into CI/CD pipelines through CircleCI orbs, GitHub Actions YAML configs, and ChatOps-driven DevSecOps workflows.'
role: 'appsec'
tags: ['snyk', 'open-source', 'dependency-scanning', 'supply-chain', 'vulnerability-management', 'nodejs', 'npm', 'prototype-pollution', 'lodash', 'cvss', 'ci-cd', 'devsecops']
problem: 'Modern applications depend heavily on open-source packages, and each dependency brings its own transitive dependency tree — code the developer never explicitly chose but that ships in the final build. A single vulnerable package buried three levels deep in the dependency graph can expose the entire application to exploitation. The task is to use Snyk Open Source to scan a Node.js project with known vulnerable dependencies, interpret the results, understand the severity scoring, and learn how to embed this scanning into CI/CD pipelines so vulnerabilities are caught before they reach production.'
action: 'Forked the snyk-workshops/THM-Snyk-Open-Source repository containing a deliberately vulnerable Node.js application with five direct dependencies (colors 1.2.4, express 3.4.8, lodash 2.4.2, mongoose 5.9.7, request 2.88.2). Connected the fork to Snyk using the GitHub SSO integration, then analysed the vulnerability results — focusing on a high-severity prototype pollution in lodash@2.4.2 (CWE-1321, CVSS 7.5, fix available in lodash@4.17.17). Reviewed Snyk fix capabilities including bulk versus selective remediation, and studied CI/CD integration patterns using CircleCI orbs, GitHub Actions YAML configurations, and ChatOps practices for collaborative DevSecOps.'
outcome: 'Completed all tasks — identified package.json as the manifest file, counted 5 direct dependencies, distinguished transitive dependencies as indirect packages pulled in by direct ones, confirmed Snyk authenticates via single sign-on, pinpointed lodash@2.4.2 as the vulnerable package with prototype pollution, expanded CVSS as Common Vulnerability Scoring System, determined that bulk-fixing all vulnerabilities was not possible (n), identified orb as the CircleCI standardisation mechanism, yaml as the GitHub Actions config format, and ChatOps as the collaborative DevOps practice.'
draft: false
---

## Background

Snyk Open Source is one arm of the Snyk platform — focused specifically on finding and fixing known vulnerabilities in open-source dependencies. Where traditional vulnerability scanning targets the code you write, Snyk Open Source targets the code you import. For a Node.js project, that means parsing `package.json` and the resolved dependency tree, matching every package version against Snyk's vulnerability database, and reporting what's exposed along with fix paths. This room walks through the full workflow: forking a vulnerable project, connecting it to Snyk, reading the results, and understanding how to integrate scanning into CI/CD.

---

## The vulnerable project

The target is a Node.js application called `patch-chat-app` with five direct dependencies declared in its `package.json`: colors 1.2.4, express 3.4.8, lodash 2.4.2, mongoose 5.9.7, and request 2.88.2. These are deliberately outdated versions chosen to demonstrate a range of vulnerability types and severities.

![The package.json file for patch-chat-app showing 5 dependencies — colors at version 1.2.4, express at 3.4.8, lodash at 2.4.2, mongoose at 5.9.7, and request at 2.88.2, with each dependency circled and numbered 1 through 5.](/writeups/thm-snyk-open-source/01-package-json-dependencies.png)

The manifest file for a Node.js project is **package.json** — this is what Snyk parses to understand what dependencies the project uses and at what versions. The five listed packages are the direct dependencies, but each of those pulls in its own dependencies, which pull in theirs, and so on. These downstream packages are called **transitive dependencies** — they're the invisible bulk of any modern application's dependency tree, and they're where many of the most dangerous vulnerabilities hide because developers don't even know they're there.

---

## Forking and connecting to Snyk

The first step is forking the `snyk-workshops/THM-Snyk-Open-Source` repository to your own GitHub account. The repo contains the vulnerable application along with example files for directory traversal and prototype pollution demonstrations.

![The GitHub repository page for snyk-workshops/THM-Snyk-Open-Source showing the Fork button circled with 26 existing forks, and the repository contents including README.md, directory-traversal-example.js, package.json, and prototype-pollution-example.js.](/writeups/thm-snyk-open-source/02-github-repo-fork.png)

![The GitHub Create a new fork dialog for h3x3h0g/THM-Snyk-Open-Source with the Create fork button circled.](/writeups/thm-snyk-open-source/03-create-fork-dialog.png)

With the fork in place, the next step is connecting it to Snyk. Snyk authenticates through **single sign-on** — you log in with your GitHub (or GitLab, Bitbucket, Google, etc.) account rather than creating separate Snyk credentials. From the Snyk dashboard, clicking "Add projects" and selecting GitHub as the integration pulls up a list of your repositories.

![The Snyk web interface showing the Projects page with the Add projects button highlighted and the GitHub integration option circled, with existing targets jscalc and a composer.lock file already listed.](/writeups/thm-snyk-open-source/04-snyk-add-projects.png)

![The Snyk repository selection screen showing THM-Snyk-Open-Source checked under the h3x3h0g account with the Add selected repositories button highlighted at the bottom.](/writeups/thm-snyk-open-source/05-snyk-select-repo.png)

Once the repository is added, Snyk automatically scans the `package.json`, resolves the full dependency tree, and matches every package version against its vulnerability database. The results come back within seconds.

---

## Reading the vulnerability results

Snyk identifies multiple vulnerabilities across the dependency tree. The one the room focuses on is a **prototype pollution** vulnerability in **lodash@2.4.2** — classified under CWE-1321 with a CVSS score of 7.5 (HIGH severity). The Snyk priority score is 696, reflecting the combination of CVSS severity, exploit maturity, and other risk factors. The exploit maturity is listed as "Proof of Concept," meaning working exploit code exists publicly.

![Snyk vulnerability detail for lodash Prototype Pollution — CWE-1321, CVSS 7.5 HIGH severity, Snyk priority score 696, introduced through lodash@2.4.2, fixed in lodash@4.17.17, with exploit maturity listed as Proof of Concept.](/writeups/thm-snyk-open-source/06-lodash-prototype-pollution.png)

Prototype pollution is a JavaScript-specific vulnerability class where an attacker can inject properties into an object's prototype, affecting all objects that inherit from it. In lodash's case, certain utility functions that recursively merge or set object properties didn't properly guard against `__proto__` or `constructor.prototype` manipulation. The fix path is clear — upgrading from lodash@2.4.2 to lodash@4.17.17 or later resolves this specific vulnerability.

**CVSS** — the **Common Vulnerability Scoring System** — is the industry-standard framework for rating vulnerability severity on a 0–10 scale. The 7.5 score here reflects network-accessible exploitation without authentication, which is what pushes it into the HIGH category.

One important detail from the room: when Snyk identifies multiple vulnerabilities across a project, it's not always possible to bulk-fix all of them at once. Some fixes conflict with each other, some require major version bumps that could break the application, and some vulnerabilities simply don't have fixes available yet. For this project, the answer to whether you can fix all vulnerabilities in bulk is **no**.

---

## CI/CD integration

Scanning vulnerabilities in a dashboard is useful, but the real value comes from embedding scanning into the development pipeline so vulnerabilities are caught before they merge. The room covers three integration patterns.

**CircleCI** uses the concept of an **orb** — a reusable, shareable package of CircleCI configuration that standardises how common tools are integrated into pipelines. Snyk provides an official orb that adds dependency scanning as a pipeline step with minimal configuration.

**GitHub Actions** uses **YAML** configuration files (stored in `.github/workflows/`) to define pipeline steps. YAML — "YAML Ain't Markup Language" — is the human-readable serialisation format that has become the standard for CI/CD configuration across most modern platforms.

![A Google search result for yaml file showing the definition from Red Hat — a human-readable data serialization language that is often used for writing configuration files.](/writeups/thm-snyk-open-source/07-yaml-search-result.png)

The third pattern is **ChatOps** — the practice of bringing development operations into team chat platforms like Slack or Microsoft Teams. Instead of switching between dashboards, developers can trigger scans, review results, and approve fixes directly in their communication tools. This collaborative approach keeps security visibility high without forcing developers to leave their primary workflow.

---

## What I took from this

The room's core lesson is about visibility into the dependency supply chain. Most developers can name their direct dependencies, but few can describe the full transitive tree — and that tree is where the attack surface actually lives. A project with five direct dependencies easily has dozens or hundreds of transitive ones, each a potential entry point for a known vulnerability.

The lodash prototype pollution example illustrates the pattern well. Lodash is one of the most widely used JavaScript utility libraries, so a vulnerability in it has enormous blast radius across the npm ecosystem. The fix existed — upgrade to 4.17.17 — but between the vulnerability disclosure and widespread adoption of the fix, every application pinned to an older version was exposed. Tools like Snyk compress the window between "a vulnerability exists" and "I know I'm affected" from days or weeks to seconds, which is the fundamental value proposition of automated dependency scanning. The CI/CD integration takes it further by making that check a gate rather than a report — vulnerabilities block the merge instead of appearing in a dashboard someone might not check.
