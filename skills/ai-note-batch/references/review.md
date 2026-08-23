# Batch review

Read the active protocol once. Parse `_review.md`, then process each staged or repaired `needs_manual` note independently. Run `ai-note-batch review <batch-id> --vault <vault>` to obtain bounded review inputs.

1. Read the title, source, structure, and CLI-provided representative excerpt (at most about 6,000 characters). If Original Material remains under 200 visible characters, keep `needs_manual` and do no knowledge search. Route very long sources to standalone `$ai-note-review`.
2. Search exact full Slax ID, normalized URL, and normalized title first. Exclude the current and all other AI Inbox/batch notes. An exact duplicate may be recommended as 不保留 without semantic search.
3. Otherwise perform exactly one semantic retrieval. Retain at most three useful candidates and read only the relevant passages, never their complete bodies.
4. Choose exactly one: 合并, 新建 Literature Note, 提炼 Permanent Note, 不保留, 暂时无法判断.
5. Produce review manifest v2 with `decision`, `target_path`, one to three `content_hint` sentences, reusable `tags`, at most three `{path, relation}` links, and a very short reason. Apply it with `ai-note-batch review <batch-id> --manifest <file> --vault <vault>`. Review output belongs only in `_review.md`; do not add verbose AI review text to staged notes.
6. Mark a successful item `reviewed`; one failure does not stop later reviews.

Never treat batch notes or any AI Inbox note as existing knowledge.
