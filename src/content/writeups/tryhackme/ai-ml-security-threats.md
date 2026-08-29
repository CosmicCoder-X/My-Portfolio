---
title: 'AI/ML Security Threats'
target: 'TryHackMe — AI/ML Security Threats'
difficulty: 'easy'
date: 2025-08-29
summary: 'An introductory room covering the AI/ML security landscape — from the building blocks of machine learning, neural networks, and LLMs through AI-specific vulnerabilities mapped to MITRE ATLAS (prompt injection, data poisoning, model theft, privacy leakage, model drift) and AI-enhanced attack capabilities (deepfakes, AI-generated phishing), to defensive AI applications and a hands-on practical using an AI assistant as a cybersecurity co-pilot for log analysis, regex generation, and threat hunting.'
role: 'llm'
tags: ['ai-security', 'machine-learning', 'llm-security', 'mitre-atlas', 'data-poisoning', 'prompt-injection', 'deepfakes', 'threat-hunting', 'defensive-ai']
problem: 'AI and ML are reshaping cybersecurity from both sides — defenders are adopting AI for detection and response while adversaries use the same capabilities to scale attacks, improve social engineering realism, and lower the barrier to writing malicious tooling. The task is to build foundational understanding of how AI systems work, where their security vulnerabilities lie, how attackers leverage AI offensively, and how defenders can adopt AI responsibly while securing it against adversarial manipulation.'
action: 'Studied the ML lifecycle from data collection through training, evaluation, and deployment, with emphasis on overfitting as a security-relevant failure mode. Examined neural network architecture (input, hidden, output layers) and how transformers with attention mechanisms enabled modern LLMs. Mapped AI-specific vulnerabilities — prompt injection, data poisoning, model theft, privacy leakage, and model drift — to the MITRE ATLAS framework. Reviewed AI-enhanced attack capabilities including deepfakes and AI-generated phishing. Explored defensive AI applications for log analysis, threat hunting, and automated triage. Completed the practical by interacting with an embedded AI assistant to demonstrate defensive use cases and extract flag components.'
outcome: 'Built a structured understanding of the AI security threat landscape across both offensive and defensive dimensions, mapped AI-specific vulnerabilities to the MITRE ATLAS framework, and completed the practical AI assistant exercise extracting the flag thm{443/60/16384} by querying the assistant for DoH port (443), SYN flood timeout (60), and ephemeral port range size (16384).'
draft: false
---

## Background

This room is the conceptual foundation that rooms like LLM Pentesting and AI Threat Modelling build on. It doesn't assume a data science background — instead, it walks through the chain from basic AI/ML concepts through the security implications on both sides of the offensive/defensive divide. The structure moves from "how does this technology work" to "how does it break" to "how do we use it defensively," which is the right order for anyone entering AI security.

---

## The building blocks

The room builds up the conceptual stack methodically. **Machine learning** is the subfield of AI where systems learn patterns from data rather than being explicitly programmed — instead of writing rules for spam detection, you feed the system examples and let it learn the statistical boundaries. The ML lifecycle is iterative: define the problem, collect and clean data, engineer features, train, evaluate, deploy, then monitor and retrain as environments change. **Overfitting** — where a model memorises training data including noise and performs poorly on unseen data — is the first security-relevant concept: a detection model that memorises old attack patterns will fail against new variations.

**Neural networks** consist of an **input layer** that receives raw data, hidden layers that process patterns, and an output layer that produces predictions. The weighted connections between nodes simulate **synapses** in the human brain. **Deep learning** refers to neural networks with multiple layers that can learn features automatically from raw, unstructured data without requiring human-defined feature engineering. **Semi-supervised learning** combines both labelled and unlabelled data, sitting between fully supervised and fully unsupervised approaches.

**Large language models** are deep learning models built on **transformer** neural networks, introduced by Google in 2017. Transformers enabled parallel text processing and better context understanding through attention mechanisms — the ability to weight which tokens in a sequence matter most for predicting the next one. After **pre-training** on massive text corpora, models go through RLHF (Reinforcement Learning from Human Feedback) where human reviewers rank outputs to align the model with helpfulness and safety objectives.

---

## AI-specific vulnerabilities

The room maps AI security threats using **ATLAS** (Adversarial Threat Landscape for Artificial-Intelligence Systems), MITRE's AI-focused counterpart to ATT&CK. The vulnerabilities fall into two categories: new risks introduced by adopting AI, and existing attacks enhanced by AI capabilities.

**Prompt injection** overrides or bypasses system instructions through crafted input to leak restricted information or generate disallowed content. **Data poisoning** manipulates training data so models learn wrong patterns — a spam filter that misclassifies spam as legitimate, or a detection model that ignores attacker behaviour. **Model theft** clones a model by querying its API repeatedly and training a replica from the outputs, stealing intellectual property and enabling offline adversarial experimentation. **Privacy leakage** occurs when models unintentionally reveal sensitive training data. **Model drift** degrades performance over time as environments change — a major operational risk in cybersecurity where threat patterns evolve continuously.

On the enhanced-attacks side, **deepfakes** can replicate voice and appearance with enough realism to threaten authentication and enable advanced social engineering. AI-generated **phishing** produces fluent, contextualised, personalised messages at scale with fewer obvious red flags — making the traditional "look for grammar mistakes" advice increasingly inadequate.

---

## Defensive AI

The defensive applications are where AI earns its place in the security stack. ML excels at pattern recognition at scale and speed, making it effective for log analysis, anomaly detection, and alert triage. IBM's research found that AI helps identify and contain breaches **108** days faster. LLMs can summarise incident reports, cross-reference threat intelligence, generate detection queries, and support **threat hunting** by helping analysts imagine attacker behaviours they might not consider. Securing AI deployments requires access control (RBAC, MFA, least privilege), treating training data as sensitive, adopting established frameworks, monitoring for drift and adversarial manipulation, and using explainability tools like SHAP and LIME for **model monitoring**.

---

## Practical — the AI assistant

The practical section provides an embedded AI assistant running as a cybersecurity co-pilot. The interface is a chat-based web application labelled "AI Assistant v1.0.0 PROD" that supports log analysis, regex generation, encoding/decoding, and factual cybersecurity queries.

![The AI Assistant v1.0.0 PROD interface showing the initial interaction — the user asks "Hello, can you help me with cyber security tasks?" and the assistant responds listing its capabilities including analysing log files, generating regular expressions, encoding or decoding data, and answering cybersecurity questions.](/writeups/thm-ai-ml-security-threats/01-ai-assistant-intro.png)

The first demonstration is log analysis. Feeding the assistant a syslog line — `Apr 22 11:45:09 ubuntu sshd[1245]: Failed password for invalid user admin from 203.0.113.55 port 56231 ssh2` — produces an immediate breakdown: the entry indicates a failed login attempt for the user `admin` from IP address `203.0.113.55` on port 56231, with the system rejecting the login because the provided password is invalid. This is the kind of rapid triage that makes AI assistants useful in a SOC context — instead of manually parsing syslog format and checking whether "invalid user" means the username doesn't exist versus the password was wrong, the assistant explains both the syntax and the security implication in seconds.

![The AI assistant analysing an SSH log entry — the user provides a syslog line showing a failed password attempt for invalid user admin from 203.0.113.55 port 56231 ssh2, and the assistant explains it as a failed login attempt with the system rejecting the login because the provided password is invalid.](/writeups/thm-ai-ml-security-threats/02-log-analysis.png)

The flag is assembled from three values the assistant provides when queried: the DNS over HTTPS (DoH) port is **443**, the SYN flood timeout is **60** seconds, and the ephemeral port range size is **16384**. Combined in the required format: **thm{443/60/16384}**.

---

## What I took from this

The room's value is in establishing the vocabulary and mental model that makes the more advanced AI security content accessible. Understanding that LLMs are transformer-based deep learning models performing next-token prediction explains why prompt injection works — the model can't distinguish between system instructions and user input because both are just sequences of tokens being processed by the same attention mechanism. Understanding the ML lifecycle explains why data poisoning is so dangerous — it attacks the earliest stage of the pipeline, and the effects only manifest after retraining and redeployment, potentially months later. Understanding model drift explains why "deploy and forget" is a security risk, not just a performance issue.

The defensive AI section is the most immediately practical. For SOC analysts, the assistant demonstration shows a concrete workflow: paste a log line, get an explanation, pivot to regex generation for detection rules, then use the assistant for threat hunting brainstorming. The key is treating AI as an accelerator for human analysis rather than a replacement — the analyst still needs to validate the output, understand the context, and make the final judgment call, but the time from "I see something suspicious" to "I understand what it means" compresses dramatically.
