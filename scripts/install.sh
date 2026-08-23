#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(dirname -- "$script_dir")
codex_root=${CODEX_HOME:-"$HOME/.codex"}
mode=copy

if ! command -v obsidian >/dev/null 2>&1; then
  echo "Obsidian CLI is required: enable Settings -> General -> Command line interface" >&2
  exit 1
fi

if [ "${1:-}" = "--link" ]; then
  mode=link
elif [ -n "${1:-}" ]; then
  echo "Usage: $0 [--link]" >&2
  exit 2
fi

for skill_name in ai-note-review ai-note-batch; do
  source_dir="$repo_dir/skills/$skill_name"
  destination="$codex_root/skills/$skill_name"
  if [ -e "$destination" ] || [ -L "$destination" ]; then
    echo "Refusing to overwrite existing skill: $destination" >&2
    exit 1
  fi
done

mkdir -p "$codex_root/skills"
npm install --global "$repo_dir"
for skill_name in ai-note-review ai-note-batch; do
  source_dir="$repo_dir/skills/$skill_name"
  destination="$codex_root/skills/$skill_name"
  if [ "$mode" = link ]; then ln -s "$source_dir" "$destination"; else cp -R "$source_dir" "$destination"; fi
  echo "Installed $skill_name at $destination ($mode mode)"
done
