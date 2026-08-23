# Legacy index migration

Run `ai-note-batch migrate-index <absolute-index-path> --vault <vault-root>`. Report declared article count, parsed links, checkbox count, unique exports, ignored, pending, and every warning.

`[x]` becomes `ignored`; `[ ]` becomes `pending`. A linked row without a recognizable trailing checkbox becomes `pending` with a warning. Preserve original order as `backlog_order`. Read linked export frontmatter for the full Slax ID and canonical URL; never edit or copy the legacy files. A repeated migration must say `validation` and must not duplicate or reset state.
