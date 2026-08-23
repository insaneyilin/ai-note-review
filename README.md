# ai-note-review

A reusable Codex Skill for reviewing one incoming Obsidian note before it enters a long-lived knowledge base.

It compares the note with a small set of indexed candidates, judges genuine knowledge gain, and recommends whether to discard, merge, retain as a Literature Note, or extract a Permanent Note. Reviews are read-only until the user explicitly approves changes.

## Requirements

- Codex with personal Skills support.
- An Obsidian MCP server available to Codex.
- MCP capabilities for path-specific reads, indexed text search, semantic search, metadata lookup, and outgoing-link resolution.
- Path-specific write, move, and delete capabilities if approved changes should be executed.

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

The installer refuses to replace an existing installation. Remove or rename an older copy deliberately before installing this one.

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

Git tags freeze released behavior. `v1.0.0` is the first stable single-note workflow. The protocol's `version` field describes its configuration schema and is versioned independently from repository releases.
