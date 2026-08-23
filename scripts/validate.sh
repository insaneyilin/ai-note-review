#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(dirname -- "$script_dir")
skill_dir="$repo_dir/skills/ai-note-review"
batch_skill_dir="$repo_dir/skills/ai-note-batch"

test -f "$skill_dir/SKILL.md"
test -f "$skill_dir/agents/openai.yaml"
test -f "$batch_skill_dir/SKILL.md"
test -f "$batch_skill_dir/agents/openai.yaml"
test -f "$repo_dir/templates/AI_NOTE_PROTOCOL.md"

grep -q '^name: ai-note-review$' "$skill_dir/SKILL.md"
grep -q '^description:' "$skill_dir/SKILL.md"
grep -q '^name: ai-note-batch$' "$batch_skill_dir/SKILL.md"
grep -q '^type: ai-note-protocol$' "$repo_dir/templates/AI_NOTE_PROTOCOL.md"
grep -q '^status: active$' "$repo_dir/templates/AI_NOTE_PROTOCOL.md"
grep -q '^# AI Note Protocol$' "$repo_dir/templates/AI_NOTE_PROTOCOL.md"

if grep -R -E '/Users/|127\.0\.0\.1|bearer|token' "$repo_dir/skills" "$repo_dir/templates" "$repo_dir/examples" >/dev/null 2>&1; then
  echo "Validation failed: personal paths, local endpoints, or secrets vocabulary found in reusable files" >&2
  exit 1
fi

node --test "$repo_dir/test"/*.test.js
validator_python=${QUICK_VALIDATE_PYTHON:-python3}
if ! "$validator_python" -c 'import yaml' >/dev/null 2>&1; then
  validator_deps=$(mktemp -d "${TMPDIR:-/tmp}/ai-note-validate.XXXXXX")
  trap 'rm -rf "$validator_deps"' EXIT HUP INT TERM
  "$validator_python" -m pip install --quiet --target "$validator_deps" PyYAML
  PYTHONPATH="$validator_deps${PYTHONPATH:+:$PYTHONPATH}"
  export PYTHONPATH
fi
"$validator_python" "${SKILL_CREATOR_DIR:-$HOME/.codex/skills/.system/skill-creator}/scripts/quick_validate.py" "$skill_dir"
"$validator_python" "${SKILL_CREATOR_DIR:-$HOME/.codex/skills/.system/skill-creator}/scripts/quick_validate.py" "$batch_skill_dir"

echo "Repository validation passed"
