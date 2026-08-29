# Daily Slax Inbox

The active board defaults to `0-AI-Inbox/今日待整理.md`; history defaults to `0-AI-Inbox/_daily`. Read optional `daily_inbox_path` and `daily_history_folder` from the active protocol and pass both to every daily CLI command. Full source bodies remain in Slax and must never be written to the board, state ledger, a temporary Vault note, or the final source card.

## Sync

Run `ai-note-batch sync` with the exact Vault and protocol paths. The deterministic pull writes every unseen Slax Inbox URL to the board, retries short content three times, and supplies only representative excerpts capped near 6,000 characters. Codex runs read-only, checks exact full Slax ID, normalized URL, and normalized title before exactly one semantic retrieval, reads at most three relevant candidate passages, and returns daily review manifest v3. The CLI validates and commits it.

If Obsidian/MCP is unavailable, keep the placeholder and let the next scheduled run retry. Never launch Obsidian automatically. Sources over 40,000 visible characters remain `暂时无法判断` and point to standalone `$ai-note-review`.

At a date change, archive the complete prior board under the history folder and carry only unresolved items into the new active board. Preserve approvals, retry selections, human comments, capture times, and final result links. A board or history conflict stops before overwrite.

## Apply today

Run `daily-apply-input`, translate only checked ready entries and their current human comments into apply manifest v3, then invoke `apply today` without `--execute` and show the exact plan. Repeat with `--execute` within the same explicit user request. Analysis-pending, failed, unchecked, and `needs_manual` items never execute. `暂时无法判断` needs an explicit human action.

Daily discard settles only the local ledger and board; it never deletes or archives the Slax bookmark. Completed entries remain visible and are permanently retained in the dated history after rollover.

## Automation

The default interval is 5,400 seconds. `automation install` is opt-in and separate from Skill installation. Dry-run first, display the resolved Vault, LaunchAgent, interval, executable, and log paths, then use `--execute`. The installed job runs through a login shell, does not store credentials, skips overlapping executions, and calls Codex only when review inputs exist.
