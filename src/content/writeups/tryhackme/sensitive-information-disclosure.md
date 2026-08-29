---
title: 'Sensitive Information Disclosure'
target: 'TryHackMe — Sensitive Information Disclosure'
difficulty: 'easy'
date: 2025-08-29
summary: 'A hands-on exploration of OWASP LLM02 — demonstrating how RAG retrieval pipelines leak confidential data through overly broad similarity search, semantic collisions between public and private documents, logging exposure of retrieved chunks, and how metadata filtering applied before retrieval prevents disclosure. The practical simulates an internal AI assistant at Meridian Health where salary bands, CEO compensation, and employee HR records are exposed through a shared vector index without access controls.'
role: 'llm'
tags: ['owasp-llm-top-10', 'llm-security', 'rag', 'information-disclosure', 'vector-database', 'access-control', 'embeddings', 'data-segmentation', 'metadata-filtering']
problem: 'RAG-powered AI assistants retrieve context from vector databases using semantic similarity — but similarity search has no concept of authorization. When public and confidential documents share a vector index without access controls, any query whose embedding lands close to sensitive content will pull that content into the LLM context window. The task is to understand how retrieval-layer architecture creates disclosure risks, demonstrate the failure modes in a live lab, and apply the controls that prevent them.'
action: 'Studied OWASP LLM02 threat categories and how they differ from prompt injection and data poisoning. Examined RAG retrieval mechanics — similarity search, top-k parameters, cosine distance — and how they become security boundaries. Reviewed vector database attack surfaces including embedding inversion, membership inference, and multi-tenant risks. Explored access control models (per-tenant, per-role, metadata filtering) and defensive safeguards (redaction, retention policies, logging minimisation). Completed the four-phase practical lab demonstrating broad retrieval disclosure of salary and compensation data, logging exposure of confidential document chunks, semantic collision between public benefits info and private HR records, and remediation through metadata-based access controls.'
outcome: 'Completed all tasks — identified LLM02 as the OWASP category, similarity as the retrieval mechanism, top-k as the parameter controlling retrieval breadth, EchoLeak as the zero-click prompt injection CVE, cosine as the similarity metric, inversion as the text reconstruction attack, namespace as the vector database grouping, per-tenant as the strongest isolation model, deterministic as pre-computation enforcement, redaction and retention as key safeguards. In the practical, demonstrated broad retrieval and semantic collision as disclosure vectors and metadata filtering as the mitigation.'
draft: false
---

## Background

This room addresses OWASP LLM02 — Sensitive Information Disclosure — with a focus that's different from most LLM security content. The vulnerability here isn't in the model itself. It's in the retrieval architecture that feeds the model. RAG systems pull documents from vector databases based on semantic similarity, and similarity search doesn't understand authorization. If a confidential salary document and a public job posting both contain the word "engineer" in similar contexts, their embeddings will be close in vector space, and a query about engineering roles will retrieve both. The room builds from theory through attack taxonomy to a practical lab that makes the failure mode visceral.

---

## How retrieval becomes a security boundary

When a user submits a query to a RAG system, it's converted into an embedding — a numerical vector capturing its semantic meaning. The system then performs **similarity** search against stored document embeddings, typically using **cosine** distance as the metric, and returns the closest matches. The **top-k** parameter controls how many documents come back — a higher value means more context for the LLM but also a wider attack surface.

The critical insight is that none of this respects access control. The retrieval step is purely mathematical — whichever documents are closest in vector space get returned, regardless of whether the querying user should see them. This is why retrieval is a security boundary, not just a performance parameter.

The room also covers **EchoLeak**, a CVE that demonstrated zero-click prompt injection through retrieved content — malicious text embedded in documents could influence model behaviour simply by being retrieved, without the user doing anything beyond asking a normal question.

---

## Vector database attack surface

Embeddings themselves are attack targets. **Inversion** attacks attempt to reconstruct the original text from stored vectors — the embeddings aren't encrypted, and research has shown that meaningful text fragments can be recovered from them. **Membership inference** determines whether a specific document was included in the training or retrieval corpus, which itself can be sensitive information. Multi-tenant vector stores compound these risks — if multiple organisations share infrastructure without proper isolation, cross-tenant retrieval becomes possible.

The strongest isolation model is **per-tenant** indexing, where each tenant gets a dedicated vector index. Per-role indexing groups documents by access level. Metadata filtering applies authorisation constraints at query time. The key distinction the room emphasises is between **deterministic** enforcement (applied before retrieval computation) and post-hoc filtering (applied after). Filtering after retrieval is too late — the documents have already been processed and potentially logged.

A **namespace** is the logical grouping inside a vector database that separates datasets, and proper namespace design is the foundation of any access control strategy in RAG deployments.

---

## Defensive safeguards

The room covers several layers of defence. **Redaction** removes sensitive data before embeddings are ever created — if the information isn't in the vector store, it can't be retrieved. **Retention** policies ensure that when documents are deleted from primary storage, their embeddings are also purged from vector databases — a gap here means "deleted" documents remain retrievable indefinitely. Logging minimisation avoids storing full prompts and retrieved document chunks, which would create a secondary disclosure channel. Monitoring for abnormal retrieval patterns — unusual query volumes, cross-namespace access attempts — provides detection capability.

---

## Practical — Meridian Health AI assistant

The lab simulates an internal AI assistant at Meridian Health. The environment intentionally stores both public and confidential documents in a shared vector index without access controls — a configuration that's disturbingly common in early RAG deployments.

### Phase 1 — Broad retrieval

Querying "What are the salary ranges for engineering roles?" returns confidential salary band data — Junior Engineer through Director, with specific dollar ranges — because the salary documents are semantically similar to the query and nothing prevents their retrieval.

![The AI assistant responding to a salary range query with confidential 2026 salary bands — Junior Engineer at $75,000-$95,000 through Director at $220,000-$280,000 — data that should be restricted to HR and management.](/writeups/thm-sensitive-information-disclosure/01-salary-ranges.png)

Asking "What is the CEO's compensation package?" escalates further — the assistant discloses Julia Fang's base salary ($340,000), bonus ($85,000), and stock options (12,000). This is executive compensation data that in most organisations would be restricted to the board and senior HR.

![The AI assistant disclosing the CEO's full compensation package — Julia Fang receiving a base salary of $340,000, a bonus of $85,000, and 12,000 stock options — all retrieved from the shared vector index without authorisation checks.](/writeups/thm-sensitive-information-disclosure/02-ceo-compensation.png)

The root cause is **broad retrieval** — the system performs similarity search across the entire shared index without enforcing any access controls on what documents are eligible for retrieval.

### Phase 2 — Logging exposure

Running `SHOW RETRIEVAL LOG` reveals all document chunks that were retrieved to answer previous queries. The logs contain confidential document fragments marked as sensitive — creating a secondary disclosure channel. Even if the retrieval issue were fixed, anyone with access to the logs would still be able to read the confidential data.

### Phase 3 — Semantic collision

The most subtle failure mode. Asking "Tell me about employee benefits enrollment" returns both the public benefits policy and confidential HR data belonging to Employee #2201 Tom Russo, whose record was flagged for a dependent eligibility audit.

![The AI assistant responding to a benefits enrollment query with both public policy information — health insurance, dental, vision, 401(k) match up to 4%, open enrollment November 1-15 — and confidential HR data showing Employee #2201 Tom Russo flagged for dependent eligibility audit.](/writeups/thm-sensitive-information-disclosure/03-benefits-semantic-collision.png)

This is a **semantic collision** — both documents contain overlapping terminology about benefits and enrollment, so their embeddings are positioned close together in vector space. The query is completely innocent, but the retrieval mechanism can't distinguish between "public benefits policy" and "private employee benefits record" because both are semantically similar to the query. The user never asked about Tom Russo — his data was pulled in as collateral because the embeddings were neighbours.

### Phase 4 — Access controls

Sending `ENABLE ACCESS CONTROL` activates metadata filtering on the retrieval pipeline.

![The AI assistant confirming that access control has been enabled — retrieval is now restricted to PUBLIC documents only.](/writeups/thm-sensitive-information-disclosure/04-access-control-enabled.png)

After enabling controls, repeating the same queries produces fundamentally different results. Salary data is blocked. CEO compensation is blocked. Tom Russo's HR record no longer appears alongside benefits information. Public information remains accessible. The fix is **metadata filtering** — tagging documents with access levels and filtering before similarity search runs, so confidential documents are never candidates for retrieval regardless of how semantically similar they are to the query.

---

## What I took from this

The room drives home that AI confidentiality failures are architectural, not model-related. The LLM in this lab behaved exactly as designed — it summarised whatever context it received. The problem was that the retrieval layer handed it documents the user shouldn't have seen. This is a pattern that repeats across enterprise RAG deployments: teams focus on prompt engineering and model guardrails while the retrieval pipeline operates as a flat, unfiltered similarity search across everything in the vector store.

The semantic collision demonstration is the most important takeaway. Broad retrieval is obvious — you asked about salaries, you got salaries. But semantic collision means a completely benign query about benefits policy can surface an individual employee's HR record because the documents happen to share vocabulary. There's no malicious intent, no crafted prompt, no adversarial behaviour — just mathematical proximity in embedding space doing exactly what it's supposed to do, with consequences nobody anticipated because they were thinking about the model's behaviour rather than the retrieval layer's. That's the lesson: in RAG systems, retrieval is the security boundary, and treating it as a pure information retrieval problem rather than an access control problem is how organisations end up with their CEO's compensation package one natural-language question away from anyone with access to the chatbot.
