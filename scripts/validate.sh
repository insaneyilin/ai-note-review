#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(dirname -- "$script_dir")
skill_dir="$repo_dir/skills/ai-note-review"

test -f "$skill_dir/SKILL.md"
test -f "$skill_dir/agents/openai.yaml"
test -f "$repo_dir/templates/AI_NOTE_PROTOCOL.md"

grep -q '^name: ai-note-review$' "$skill_dir/SKILL.md"
grep -q '^description:' "$skill_dir/SKILL.md"
grep -q '^type: ai-note-protocol$' "$repo_dir/templates/AI_NOTE_PROTOCOL.md"
grep -q '^status: active$' "$repo_dir/templates/AI_NOTE_PROTOCOL.md"
grep -q '^# AI Note Protocol$' "$repo_dir/templates/AI_NOTE_PROTOCOL.md"

if grep -R -E '/Users/|127\.0\.0\.1|bearer|token' "$skill_dir" "$repo_dir/templates" "$repo_dir/examples" >/dev/null 2>&1; then
  echo "Validation failed: personal paths, local endpoints, or secrets vocabulary found in reusable files" >&2
  exit 1
fi

echo "Repository validation passed"
