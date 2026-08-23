---
name: ai-note-batch
description: Batch-review Slax Reader bookmarks into an Obsidian vault with migration, content-quality gates, duplicate checks, an approval board, and verified application. Use for $ai-note-batch migrate-index, slax, review, or apply workflows; use ai-note-review instead for one standalone note.
---

# AI Note Batch

Process Slax Reader bookmarks in bounded, user-approved Obsidian batches. V2 is connection-first: the repository CLI performs deterministic ingestion and state work, MCP performs one semantic retrieval and reads only relevant candidate passages, and the official Obsidian CLI performs all note mutations and verification.

## Load configuration

Find and read exactly one active `ai-note-protocol` as described by `$ai-note-review`. Protocol version 2 adds `batch_folder` and `state_folder`; accept version 1 with defaults `0-AI-Inbox/_batches` and `.ai-note-review`.

Use the installed `ai-note-batch` CLI. Run it with `--vault <vault-root>` and pass `--batch-folder` from the protocol when staging. Never infer a Vault from whichever file is active.

## Route the command

- `migrate-index <path>`: read [references/migration.md](references/migration.md), then invoke the CLI. This only writes the Vault-local state ledger.
- `slax --limit N`: read [references/staging.md](references/staging.md). Before authenticated CLI access, run `reader-cli whoami --json`. Default to 15.
- `review <batch-id>`: read [references/review.md](references/review.md) and review eligible staged notes.
- `apply <batch-id>`: read [references/apply.md](references/apply.md). This is an explicit mutation request, but apply only checked entries and show the exact operation plan before the first write.

Never change Slax tags/archive state, the legacy index, MOCs, unchecked entries, or background schedules.

## State invariants

Treat `.ai-note-review/state.json` as machine state, not a note. Legal statuses are `pending`, `ignored`, `staged`, `reviewed`, `needs_manual`, `applied`, and `discarded`. Do not put article bodies in it.

Identify sources by full Slax ID and normalized source URL. Skip any item already staged, reviewed, applied, discarded, ignored, or otherwise assigned to a batch. A failure in one review does not prevent other reviews; an apply failure stops the remaining apply operations.

`needs_manual` cannot be applied. After the user repairs its Original Material section, `review` may reassess it. Preserve image embeds, manual comments, and everything between `<!-- ORIGINAL:START -->` and `<!-- ORIGINAL:END -->`; a re-review replaces only the AI review boundary.

New boards use `board_schema_version: 2`; accept legacy boards during apply. Do not upgrade the state ledger or Protocol schema. Review/apply manifests use schema version 2 and the fixed operations documented in the references.
