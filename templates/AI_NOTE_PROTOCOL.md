---
type: ai-note-protocol
version: 2
status: active
inbox_folder: 0-AI-Inbox
batch_folder: 0-AI-Inbox/_batches
state_folder: .ai-note-review
fleeting_folder: 001-Fleeting_Notes
literature_folder: 002-Literature_Notes
permanent_folder: 003-Permanent_Notes
moc_folder: 004-MOC_Notes
exclude_folders:
  - Daily Notes
  - Templates
  - Attachments
---

# AI Note Protocol

This file defines how an AI agent maintains this Obsidian vault. Keep exactly one protocol with `status: active`.

## Core principles

- Be selective: not every input deserves permanent storage.
- Judge knowledge gain relative to existing notes.
- Use indexed candidate retrieval instead of scanning every note body.
- Add links only when they express a meaningful knowledge relationship.
- Explain decisions and uncertainty.

## Default approval boundary

Before explicit user approval, analyze and recommend only. Do not edit, move, rename, merge, delete, tag, link, or update MOCs.

After approval, list the exact files and operations, execute only that scope, and verify the result.

## Review sequence

1. Read this protocol and the specified incoming note.
2. Extract its source, subject, claims, evidence, methods, and user commentary.
3. Search exact titles, URLs, distinctive phrases, names, and claims.
4. Search semantically for the core ideas.
5. Deduplicate candidates and compare the most relevant 5–10 notes at claim level.
6. Choose one decision category and explain it.

Use `exclude_folders` by default. Include chronological notes only when personal history, habits, or retrospectives make them relevant.

## Knowledge-gain test

Count these as meaningful gain:

- a new claim or explanatory model;
- new evidence for an existing claim;
- a counterexample or boundary condition;
- a more actionable method;
- a revised personal judgment;
- a meaningful connection between topics.

Usually do not count paraphrases, generic advice, unsupported claims, minor context changes, low-relevance news, or emotional stimulation without reusable insight.

## Decision categories

Choose exactly one:

- **Discard**: substantively duplicate or lacks reusable value.
- **Merge**: contains a small, explicit increment suited to an existing note.
- **New Literature Note**: an external source contains enough independent value.
- **Extract Permanent Note**: the user has formed a durable judgment, model, or synthesis.
- **Unable to decide**: important evidence or comparison context is missing; state what is needed.

## Classification

Folders represent source and maturity. Tags and MOCs represent stable subjects.

| Content | Folder property |
|---|---|
| Awaiting AI review | `inbox_folder` |
| Personal undeveloped thought | `fleeting_folder` |
| External source note | `literature_folder` |
| Personal model or synthesis | `permanent_folder` |
| Topic index | `moc_folder` |

Prefer 1–3 existing tags. Do not invent new top-level tags without approval.

## Links

Suggest 1–3 strong links when available. Useful relationships include support, contradiction, model-to-example, reasoning sequence, source-to-synthesis, and explicit MOC membership. Explain each relationship. Do not update backlinks or MOCs automatically.

## Review output

```markdown
# New note review: <title>

## Decision

- Recommendation:
- Confidence: high / medium / low
- One-sentence reason:

## Core content

- Main claims:
- Important evidence or methods:
- User's own judgment:

## Comparison with existing notes

| Existing note | Overlap | Genuine addition | Relationship |
|---|---|---|---|

## Value assessment

- New ideas:
- New evidence, counterexamples, or boundaries:
- Action value:
- Worth retaining long term:

## Filing recommendation

- Target folder:
- Merge target:
- Suggested tags:
- Suggested links:

## Operations awaiting approval

- [ ] Retain and move
- [ ] Merge additions
- [ ] Add tags
- [ ] Add links
- [ ] Discard

> The vault has not been modified. Waiting for user approval.
```

Return the review in conversation unless the user explicitly asks to save it in the vault.
