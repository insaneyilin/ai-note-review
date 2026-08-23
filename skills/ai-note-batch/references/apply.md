# Apply approved entries

Parse only `[x]` entries in `_review.md`; `[ ]` means waiting. Ignore a checked `needs_manual` entry and report why. A non-empty `人工修改意见` overrides the AI recommendation.

Translate checked entries and human overrides into apply manifest v2. Allowed operations are `create_source_card`, `append_source_reference`, `create_card_pending_permanent`, `discard`, and `acknowledge_existing`. Run `ai-note-batch apply <batch-id> --manifest <file> --vault <vault>` first and show its dry-run. Only then repeat with `--execute`.

Before any write, the CLI verifies that Obsidian is already running, the official `obsidian` CLI is enabled, the active Vault path exactly matches `--vault`, all staged/target/link paths resolve, and no unmarked target conflicts exist. A failed preflight writes nothing. The CLI then executes sequentially using official `read/create/append/delete/links` commands.

- A new Literature Note is a minimal source card: source metadata, original URL, one to three content hints, related notes, and a blank human整理 section. Do not copy the full source from Slax.
- Merge only appends a title, URL, one-line relation, and hidden Slax marker under a 相关来源 heading. Never rewrite the target body.
- A Permanent candidate creates the same minimal Literature card plus an unchecked “待人工提炼 Permanent Note” task. Do not write the user's viewpoint.
- Delete staged material with CLI `delete` without `permanent`, so it uses Obsidian trash.
- 暂时无法判断 does nothing unless the human comment explicitly says it was handled or specifies an action.

Every write includes a hidden Slax marker. For each entry, verify the target body and links before updating state to `applied`, or `discarded` for an approved 不保留. A rerun recognizes an already-written marker and settles state without duplicating content. Stop immediately on the first unexpected result; do not process later checked entries.

Never update a MOC automatically. Report exact final paths and whether removed material is recoverable.
