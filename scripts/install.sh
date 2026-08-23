#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(dirname -- "$script_dir")
source_dir="$repo_dir/skills/ai-note-review"
codex_root=${CODEX_HOME:-"$HOME/.codex"}
destination="$codex_root/skills/ai-note-review"
mode=copy

if [ "${1:-}" = "--link" ]; then
  mode=link
elif [ -n "${1:-}" ]; then
  echo "Usage: $0 [--link]" >&2
  exit 2
fi

if [ -e "$destination" ] || [ -L "$destination" ]; then
  echo "Refusing to overwrite existing skill: $destination" >&2
  exit 1
fi

mkdir -p "$(dirname -- "$destination")"

if [ "$mode" = link ]; then
  ln -s "$source_dir" "$destination"
else
  cp -R "$source_dir" "$destination"
fi

echo "Installed ai-note-review at $destination ($mode mode)"
