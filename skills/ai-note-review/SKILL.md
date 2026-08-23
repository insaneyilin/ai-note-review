---
name: ai-note-review
description: Review one new Obsidian note for duplication, knowledge gain, long-term value, classification, tags, and meaningful links by following the active ai-note-protocol in the vault. Use when the user invokes $ai-note-review, asks whether an incoming note is worth keeping, asks where a new note belongs, or asks to audit an inbox note before modifying the knowledge base.
---

# AI Note Review

Review one incoming Obsidian note through an available Obsidian MCP server. Treat the vault's active protocol as authoritative.

## Load the vault protocol

1. Find notes whose frontmatter has `type: ai-note-protocol` and `status: active` using metadata or indexed search. Do not scan every note body.
2. Require exactly one active protocol. If none exists, tell the user to install and configure `templates/AI_NOTE_PROTOCOL.md`. If several exist, stop and list them for the user to resolve.
3. Read the protocol in full before reading or analyzing the target.
4. Treat the protocol as read-only unless the user explicitly asks to edit it.

## Resolve the input

1. Accept a vault-relative path, filename, or unambiguous note title.
2. For a bare filename, look first under the protocol's `inbox_folder`. Add `.md` when needed.
3. Use indexed filename search if the path is still unresolved; do not guess among multiple matches.
4. Reject the active protocol itself as review input.
5. Confirm the target exists before continuing.

## Run the review

1. Read the target and distinguish external source claims from the user's comments.
2. Follow the protocol's candidate-search sequence:
   - search exact title, source URL, distinctive phrases, names, and core claims;
   - run semantic searches for the main ideas;
   - apply `exclude_folders`, except when the task needs personal history or chronology.
3. Merge and deduplicate candidates. Exclude the target and protocol from comparison.
4. Inspect relevant excerpts first. Read complete candidate notes only when claim-level comparison requires it.
5. Compare actual claims, evidence, boundaries, methods, and personal judgments. Never decide from similarity scores alone.
6. Return exactly one decision category using the protocol's current output template.

## Preserve the approval boundary

Treat invocation as review-only unless the user explicitly authorizes changes. Do not edit, move, rename, merge, delete, tag, link, or update MOCs during review.

When the user approves changes, execute only the confirmed scope.

## Protect paths and mutations

Never use mutation tools that depend on the currently active Obsidian file. This includes active-file update, patch, append, delete, command, and UI actions.

Use path-specific tools and pass an exact vault-relative path for every mutation.

Before the first write:

1. Restate the source, destination, every file to edit, and each operation.
2. Re-read every file to be modified and retain its original content until verification passes.
3. Confirm the destination is absent and its parent directory exists before moving or renaming.

During execution:

1. Apply writes sequentially when they touch the same file.
2. Stop after the first unexpected result.
3. Scope bulk or regex writes to the confirmed files and preview before applying.
4. Never modify the protocol while processing another note.

After execution, verify:

1. The source is absent when a move or deletion was requested.
2. The destination contains the intended body and frontmatter.
3. The protocol still has `type: ai-note-protocol`, `status: active`, and the `# AI Note Protocol` heading.
4. Every added wiki-link and embed resolves through Obsidian metadata.

If a heading link fails, use a resolved file-level link and mention the section in prose. If verification fails, stop, disclose it, and restore retained content only when restoration is unambiguous and cannot overwrite newer user changes.

Report exact final paths, changes, verification results, and whether deleted content is recoverable.

## Handle unavailable capabilities

The workflow requires path-specific reads, indexed text search, semantic search, metadata lookup, and link resolution. Mutation requests additionally require path-specific write, move, and delete tools.

If a required capability is unavailable, stop and report it. Do not replace semantic comparison with a full-vault filesystem scan and do not silently fall back to active-file mutations.
