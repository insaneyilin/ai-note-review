# ai-note-review

A reusable Codex Skill for reviewing one incoming Obsidian note before it enters a long-lived knowledge base.

It also includes `$ai-note-batch`, a Slax Reader → Obsidian incremental Inbox and compatible batch workflow. The older `slax-reader-export` remains an independent backup tool and is not required.

It compares the note with a small set of indexed candidates, judges genuine knowledge gain, and recommends whether to discard, merge, retain as a Literature Note, or extract a Permanent Note. Reviews are read-only until the user explicitly approves changes.

## Requirements

- Codex with personal Skills support.
- An Obsidian MCP server for indexed/semantic retrieval and relevant candidate passages.
- Obsidian 1.12.7+ installer with **Settings → General → Command line interface** enabled; Obsidian must be running for apply.
- Node.js 20+ and `reader-cli` 0.2.0 for the batch workflow.

The repository contains no Vault data, credentials, fixed local endpoint, or personal directory layout.

## Install the Skill

Copy it into the current Codex home:

```sh
./scripts/install.sh
```

During development, install it as a symbolic link:

```sh
./scripts/install.sh --link
```

The installer installs the `ai-note-batch` executable with npm and refuses to replace an existing Skill installation. Remove or rename an older Skill copy deliberately before installing this one.

## Configure a Vault

1. Copy `templates/AI_NOTE_PROTOCOL.md` into the Vault.
2. Edit its frontmatter folder mappings and exclusions.
3. Keep exactly one note with both:

```yaml
type: ai-note-protocol
status: active
```

The protocol can live anywhere in the Vault. The Skill finds it through an indexed Dataview metadata query rather than a hard-coded path. If Dataview is unavailable, the MCP server must provide an equivalent indexed metadata query.

The Chinese example in `examples/AI_NOTE_PROTOCOL.zh-CN.example.md` demonstrates a different folder layout and a shorter localized policy.

## Use

Place a note in the configured Inbox and invoke:

```text
$ai-note-review note-name.md
```

The first response is an audit only. To apply a recommendation, explicitly confirm the desired edit, move, merge, or deletion in a follow-up message.

### One-time Slax migration

```text
$ai-note-batch migrate-index /absolute/path/to/20260804_index.md
```

Checked legacy rows become `ignored`; unchecked or malformed rows become ordered `pending` backlog entries. Migration writes only `.ai-note-review/state.json` in the selected Vault and is idempotent. It never modifies or copies the old index/exports.

### Daily batches

```text
$ai-note-batch slax --limit 15
$ai-note-batch review <batch-id>
$ai-note-batch apply <batch-id>
```

Backlog is consumed first, followed by the paginated Slax inbox newest-first. The pinned local Defuddle fallback is used when Slax content fails the quality gate. Batch notes and `_review.md` live under the protocol's `batch_folder`. V2 review caps source excerpts near 6,000 characters, performs exact duplicate checks before one semantic retrieval, and keeps at most three related notes. On the board, checked means approved, unchecked means waiting, and non-empty human instructions override the AI suggestion.

Apply uses the official Obsidian CLI. It first prints an exact dry-run and refuses all writes if Obsidian is not running, the Vault differs, a target conflicts, or a link is unresolved. New notes are minimal source cards; merge only appends a source reference; Permanent candidates remain human tasks. Hidden Slax markers make retries idempotent.

### Incremental daily Inbox

中文使用说明：[AI Note Batch V3 中文使用指南](docs/AI_NOTE_BATCH_V3.zh-CN.md)

V3 keeps a single active approval board at `0-AI-Inbox/今日待整理.md`. Every unseen Slax Inbox link appears there, while Codex adds a compact recommendation, target, content hints, and up to three meaningful connections. Full article text remains only in Slax.

Run a one-shot sync or apply the checked items:

```text
$ai-note-batch sync
$ai-note-batch apply today
```

Completed results remain linked from the board. On the next local date the complete board is archived under `0-AI-Inbox/_daily`, while unresolved entries carry forward.

Background sync is explicit and separate from Skill installation. The default is every 90 minutes; install, inspect, trigger, or remove it with:

```text
$ai-note-batch automation install
$ai-note-batch automation status
$ai-note-batch automation run
$ai-note-batch automation uninstall
```

Installation first shows a dry-run and then installs a per-Vault macOS LaunchAgent. It never starts Obsidian, stores credentials, changes Slax state, or applies knowledge-note operations. If Obsidian/MCP is unavailable, capture placeholders remain on the board and analysis retries later.

The executable core can also be run directly after `npm install`:

```sh
node bin/ai-note-batch.js migrate-index /path/to/index.md --vault /path/to/vault
node bin/ai-note-batch.js slax --limit 15 --vault /path/to/vault
```

## Safety model

- One note per review.
- Indexed candidate retrieval instead of full-Vault body scans.
- No mutation before explicit approval.
- No active-file mutation tools.
- Exact paths and preflight checks before writes.
- Post-write verification of paths, protocol integrity, frontmatter, and links.

## Validate

Run the repository checks:

```sh
./scripts/validate.sh
```

The Skill also follows Codex's standard Skill structure and can be checked with the `quick_validate.py` utility distributed with the system `skill-creator` Skill.

## Versioning

Git tags freeze released behavior. `v1.0.0` is the first stable single-note workflow; `v1.1.0` adds Slax batch review; `v1.2.0` adds connection-first review and minimal, idempotent Obsidian CLI apply; `v1.3.0` adds the incremental daily Inbox and opt-in background sync. Protocol version 2 remains compatible and gains optional daily path settings.
