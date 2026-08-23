# Slax staging

Run the CLI's `slax` command. Backlog items precede remote inbox items and retain legacy order. Remote retrieval must paginate and sort by the API's newest-first order. The CLI uses `reader-cli get <id> --markdown`, assesses the Content section, and invokes the repository-pinned local Defuddle for suspect material.

Inspect the resulting report and batch. Materials under 200 visible characters after fallback are `needs_manual`. Materials over 40,000 visible characters are long: leave them staged as `content_quality: long`, categorize as unable to decide, and recommend standalone `$ai-note-review`. Review uses only a deterministic representative excerpt of at most about 6,000 characters. Quality only determines reviewability, never value.

Do not perform knowledge-base comparison during staging.
