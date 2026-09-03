---
title: 'AI Threat Modelling'
target: 'TryHackMe — AI Threat Modelling'
difficulty: 'medium'
date: 2025-08-29
summary: "A defender-focused threat modelling exercise against MegaCorp AI chatbot architecture — identifying AI-specific assets, adapting STRIDE for AI failure modes, enriching findings with MITRE ATLAS technique IDs, and mapping OWASP LLM Top 10 vulnerabilities to architectural components in a three-phase interactive assessment."
role: 'llm'
tags: ['ai-security', 'threat-modelling', 'owasp-llm-top-10', 'stride', 'mitre-atlas', 'llm-security', 'rag', 'supply-chain', 'data-poisoning', 'red-teaming']
problem: "MegaCorp has deployed an AI chatbot with a RAG pipeline, a recommendation engine, and an automated fraud detection system. The CISO needs a threat assessment identifying AI-specific attack surfaces, supply chain risks, and OWASP LLM Top 10 vulnerabilities mapped to architectural components with severity ratings."
action: "Identified AI-specific assets and traced supply chain attack vectors to the data collection stage. Adapted STRIDE for AI contexts and mapped MITRE ATLAS technique IDs to attack patterns. Completed the interactive OWASP LLM Top 10 assessment by mapping five vulnerabilities to architectural components across trust boundaries with justified criticality ratings."
outcome: "Completed the three-phase threat assessment with a perfect 75/75 score — correctly mapped prompt injection, improper output handling, data poisoning, supply chain vulnerabilities, and vector embedding weaknesses to their respective architectural components with appropriate criticality ratings. Flag: THM{AI_THREAT_MODEL_COMPLETE}."
draft: false
---

## Background

This room shifts perspective from the attacker's side of AI security to the defender's. Where rooms like LLM Pentesting and LLMborghini focus on how to exploit LLM-powered applications, this one focuses on how to systematically identify, categorise, and prioritise the threats those applications face before an attacker gets to them. The scenario is built around MegaCorp, a company that has deployed AI across three business functions — a customer-facing chatbot with a RAG pipeline, a recommendation engine processing sensitive customer data, and an automated fraud detection system making real-time financial decisions — and the task is to deliver a structured threat assessment for the CISO.

The room layers three frameworks on top of each other: STRIDE for threat categorisation, MITRE ATLAS for AI-specific attack techniques, and OWASP LLM Top 10 for mapping risks to architectural components. Each framework adds a different dimension. STRIDE gives you the vocabulary to classify what type of threat you're looking at. ATLAS gives you the specific techniques an attacker would use and how to mitigate them. OWASP LLM Top 10 tells you where in the architecture each risk lives and how severe it is. The culmination is a three-phase interactive exercise where you select vulnerabilities, map them to components on an architecture diagram, and justify why each mapping is correct.

---

## AI-specific assets and the expanded attack surface

Traditional threat modelling deals with familiar assets — databases, APIs, user credentials, network segments. AI systems introduce asset types that don't exist in conventional applications and that require their own threat analysis. **Embedding vectors** are the numerical representations that a RAG system uses to retrieve relevant context at query time — they encode the semantic meaning of documents, and poisoning or manipulating them corrupts the retrieval mechanism that feeds the LLM. **Model registries** store the trained model artifacts and version history — an attacker who gains access to the registry and swaps the production model for a modified version has compromised the core decision-making component without touching the application code. **Training data**, **system prompts**, and **feature stores** each represent additional surfaces that traditional threat models don't account for.

The AI data supply chain introduces its own attack vectors. An attacker who injects crafted data points into the **data collection** stage — the earliest point in the pipeline — can gradually shift model decision boundaries over months of training cycles. This is a particularly insidious attack because the poisoning happens far upstream of where the model is deployed, making it difficult to detect at inference time.

---

## Adapting STRIDE for AI systems

STRIDE — Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege — maps to AI systems, but not cleanly. Some categories need AI-specific interpretation, and some traditional mappings break down entirely.

**Tampering** is the category that struggles most with AI-specific threats. Training data poisoning is technically a form of tampering — someone is modifying inputs to alter system behaviour — but the traditional STRIDE conception of tampering assumes immediate, observable effects. Poisoning a training pipeline produces delayed, diffuse effects that manifest only after the model has been retrained and redeployed, potentially months after the initial injection. The temporal disconnect between the tampering event and its observable impact makes traditional tampering analysis insufficient for capturing the full threat.

**Information Disclosure** takes on a distinct AI-specific form through **model extraction** — an attacker who can query a model's API enough times can reconstruct a functional copy of the model, effectively stealing the intellectual property and training investment embedded in the weights. This goes beyond traditional data leakage; the model itself becomes the exfiltrated asset.

**Elevation of Privilege** maps to **jailbreaking** — an attacker crafting prompts that cause an LLM to bypass its safety guidelines and content restrictions is essentially escalating their privilege level from "constrained user" to "unrestricted operator," gaining access to capabilities the system was explicitly designed to deny them.

---

## MITRE ATLAS — from categories to techniques

Where STRIDE gives you the what, MITRE ATLAS (Adversarial Threat Landscape for Artificial-Intelligence Systems) gives you the how. ATLAS is the AI-specific counterpart to ATT&CK, cataloguing adversarial techniques with IDs, descriptions, documented case studies, and mitigations.

**Model extraction** carries technique ID **AML.T0024** — this is the formalised version of the information disclosure threat, with documented methods ranging from API-based model stealing to side-channel attacks that infer model architecture from timing information.

The ATLAS case study that best illustrates the convergence of multiple threat categories is **Morris II** — a self-replicating prompt injection worm that spread between AI agents via RAG email systems. Named after the original Morris worm, it demonstrated that prompt injection isn't just a single-interaction vulnerability: in agentic systems where AI assistants read and process each other's outputs, a single injected prompt can propagate autonomously across an entire network of agents. This is the kind of compound threat that only becomes visible when you combine STRIDE categorisation with ATLAS technique analysis.

---

## OWASP LLM Top 10 — mapping risks to architecture

The OWASP LLM Top 10 is the framework that turns abstract threat categories into actionable architectural analysis. Each entry maps to specific components in an AI deployment, and the room's interactive exercise tests exactly this mapping capability.

The architecture under assessment is MegaCorp's AI chatbot, structured across three trust boundaries. **Trust Boundary A (External Access)** contains the Web Frontend and API Gateway — the components exposed to untrusted user input. **Trust Boundary B (Internal Services)** contains the LLM Inference endpoint, the Model Registry, the Vector Database, and the Knowledge Base — the core AI infrastructure. **ML Operations** contains the Training Pipeline — the component responsible for producing the models that everything else depends on.

A key structural question the room poses: how many OWASP LLM Top 10 entries affect the LLM Inference endpoint? The answer is **6** — the inference endpoint is the convergence point where prompt injection payloads execute, where sensitive information gets disclosed, where output is generated before downstream handling, where excessive agency manifests, and where supply chain compromises and vector weaknesses ultimately have their effect. It's the component with the highest risk density in any LLM architecture.

Two specific mappings worth noting from the Q&A: an organisation whose chatbot renders LLM output directly in the browser without sanitisation is facing **Improper Output Handling** (LLM05), and the component that needs primary hardening against data and model supply chain risks is the **Training Pipeline**, because that's where compromised data or models enter the system and where integrity checks have the most leverage.

---

## The interactive threat assessment

The exercise runs in three phases, each building on the previous one. Phase 1 is vulnerability selection — choosing which five OWASP LLM Top 10 entries are most relevant to MegaCorp's architecture. Phase 2 is architectural mapping — dragging each selected vulnerability to the component where it presents the greatest risk. Phase 3 is justification — for each mapping, explaining why the vulnerability applies at that specific component and assigning a criticality rating.

### Phase 1 — Selection

The five vulnerabilities selected for the assessment were **LLM01: Prompt Injection**, **LLM03: Supply Chain Vulnerabilities**, **LLM04: Data & Model Poisoning**, **LLM05: Improper Output Handling**, and **LLM08: Vector & Embedding Weaknesses**. These five cover the full architecture from the external-facing frontend through the internal AI services to the ML operations pipeline.

![Phase 1 of the OWASP LLM Top 10 Threat Assessment showing 5 of 5 vulnerabilities selected — Prompt Injection, Supply Chain Vulnerabilities, Improper Output Handling, Vector and Embedding Weaknesses, and Data and Model Poisoning — with the vulnerability sidebar listing all ten OWASP categories from LLM01 through LLM10 and a Confirm Selection button.](/writeups/thm-ai-threat-modelling/01-phase1-selection.png)

### Phase 2 — Assignment

The architecture diagram lays out the trust boundaries and data flows. The task is to map each vulnerability to the component where the risk is highest — not where the vulnerability might theoretically apply, but where the threat is most direct and where controls need to be strongest.

![Phase 2 showing the MegaCorp AI chatbot architecture diagram with three trust boundaries — Trust Boundary A (External Access) containing Web Frontend and API Gateway, Trust Boundary B (Internal Services) containing LLM Inference, Model Registry, Vector Database, and Knowledge Base, and ML Operations containing the Training Pipeline — with the five selected vulnerabilities in the sidebar ready to be mapped to components.](/writeups/thm-ai-threat-modelling/02-phase2-architecture.png)

The mappings: LLM01 to the Web Frontend (node 1), LLM05 to the API Gateway (node 5), LLM03 to the Model Registry (node 3), LLM08 to the Vector Database (node 8), and LLM04 to the Training Pipeline (node 4).

### Phase 3 — Justification

Each mapping requires selecting the correct explanation for why the vulnerability applies at that component, then assigning a criticality rating. The assessment scored 75/75 — a perfect pass — confirming that every mapping, justification, and criticality assignment was correct.

**LLM01: Prompt Injection → Web Frontend** (Medium criticality). The web frontend is where user input fields serve as the entry point for injected prompts before any server-side validation occurs. The correct justification is that the frontend is where the attack surface exists — user-controlled text flows directly into the system from this point. The two distractors — that the frontend stores model weights or executes SQL queries the LLM rewrites — describe vulnerabilities that belong to other components.

![Phase 3 assessment for LLM01 Prompt Injection mapped to the Web Frontend — the correct justification highlighted in green states that user input fields on the frontend are the entry point for injected prompts before any server-side validation occurs, with Medium criticality selected, scoring 75 out of 75 points with PASSED status.](/writeups/thm-ai-threat-modelling/03-llm01-prompt-injection.png)

**LLM05: Improper Output Handling → API Gateway** (Medium criticality). The API gateway is the component responsible for sanitising and validating model output before passing it downstream — failure here means unsafe content propagates to every consuming service. The key insight is that the gateway is the last checkpoint before LLM-generated content reaches users or other systems, making it the critical control point for output validation.

![Phase 3 assessment for LLM05 Improper Output Handling mapped to the API Gateway — the correct justification highlighted in green explains that the gateway is responsible for sanitising and validating model output before passing it downstream and failure here lets unsafe content propagate to every consuming service, with Medium criticality selected, 75 out of 75 PASSED.](/writeups/thm-ai-threat-modelling/04-llm05-output-handling.png)

**LLM04: Data & Model Poisoning → Training Pipeline** (High criticality). Poisoned training data fed into the pipeline causes the model to learn manipulated behaviours or backdoors that persist after deployment. This is rated High because the effects are systemic — a poisoned model affects every inference it makes, and the poisoning is embedded in the model weights themselves, not in a configuration that can be easily reverted.

![Phase 3 assessment for LLM04 Data and Model Poisoning mapped to the Training Pipeline — the correct justification highlighted in green states that poisoned training data fed into the pipeline causes the model to learn manipulated behaviours or backdoors that persist after deployment, with High criticality selected, 75 out of 75 PASSED.](/writeups/thm-ai-threat-modelling/05-llm04-data-poisoning.png)

**LLM03: Supply Chain Vulnerabilities → Model Registry** (High criticality). A compromised or backdoored model uploaded to the registry gets served directly to production without integrity verification. The model registry is the component where supply chain attacks materialise — it's the storage and distribution point for model artifacts, and if an attacker can insert a modified model here, every downstream consumer trusts and executes it.

![Phase 3 assessment for LLM03 Supply Chain Vulnerabilities mapped to the Model Registry — the correct justification highlighted in green explains that a compromised or backdoored model uploaded to the registry gets served directly to production without integrity verification, with High criticality selected, 75 out of 75 PASSED.](/writeups/thm-ai-threat-modelling/06-llm03-supply-chain.png)

**LLM08: Vector & Embedding Weaknesses → Vector Database** (High criticality). Adversarially crafted embeddings stored in the vector database manipulate similarity search results, causing the model to retrieve attacker-chosen content instead of legitimate documents. This is the RAG-specific attack surface — the vector database is where the retrieval step happens, and corrupting it means the LLM receives poisoned context without any direct interaction with the model itself.

![Phase 3 assessment for LLM08 Vector and Embedding Weaknesses mapped to the Vector Database — the correct justification highlighted in green explains that adversarially crafted embeddings stored in the vector DB manipulate similarity search results causing the model to retrieve attacker-chosen content, with High criticality selected, 75 out of 75 PASSED.](/writeups/thm-ai-threat-modelling/07-llm08-vector-embedding.png)

### Assessment complete

![Assessment Complete dialog showing a perfect score of 75 out of 75 points with PASSED status, confirming successful completion of the OWASP LLM Top 10 threat assessment of MegaCorp AI chatbot architecture, with the flag THM{AI_THREAT_MODEL_COMPLETE} displayed.](/writeups/thm-ai-threat-modelling/08-assessment-complete.png)

The flag is **THM{AI_THREAT_MODEL_COMPLETE}**.

---

## What I took from this

The room's most valuable contribution is the layered framework approach. Using STRIDE alone for AI systems leaves gaps — the tampering category can't adequately capture training data poisoning's delayed effects, and traditional information disclosure doesn't map cleanly to model extraction. Using OWASP LLM Top 10 alone gives you a risk catalogue but no threat categorisation methodology. Using ATLAS alone gives you technique IDs but no architectural mapping. The three frameworks together are what make the assessment comprehensive: STRIDE classifies the threat type, ATLAS provides the specific technique and its mitigations, and OWASP LLM Top 10 tells you which architectural component needs which controls.

The interactive exercise reinforces something that theoretical study doesn't — the difference between knowing that a vulnerability exists and knowing where it lives in an architecture. Prompt injection exists as a concept, but mapping it specifically to the web frontend rather than the LLM inference endpoint forces a more precise understanding: the vulnerability's entry point is where user input first touches the system, not where the model processes it. Similarly, improper output handling belongs at the API gateway, not at the model — the model generates the output, but the gateway is where validation must happen before that output reaches consumers. That component-level precision is what turns a threat assessment from a list of scary possibilities into an actionable engineering document with specific hardening recommendations for specific teams.

The criticality assignments also carry a pattern worth noting. The externally-facing components — Web Frontend and API Gateway — received Medium ratings, while the internal infrastructure components — Training Pipeline, Model Registry, and Vector Database — all received High. This reflects a real architectural truth: external-facing components have more defensive options available (input validation, output filtering, WAF rules), while the internal components represent systemic risks where a single compromise affects every downstream operation. A poisoned model or corrupted vector database doesn't just affect one request — it corrupts every inference the system makes until the compromise is discovered and remediated.
