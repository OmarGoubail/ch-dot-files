#!/bin/bash
# Link the vendored vim-herdr-navigation plugin into herdr's plugin registry.
# Runs once after chezmoi apply; idempotent.

set -euo pipefail

plugin_dir="${HOME}/.config/herdr/plugins/vim-herdr-navigation"

if ! command -v herdr >/dev/null 2>&1; then
  echo "herdr not found, skipping vim-herdr-navigation plugin link" >&2
  exit 0
fi

if command -v jq >/dev/null 2>&1; then
  if herdr plugin list --json 2>/dev/null | jq -e '.result.plugins[]? | select(.id == "vim-herdr-navigation")' >/dev/null 2>&1; then
    echo "vim-herdr-navigation plugin already linked"
    exit 0
  fi
fi

herdr plugin link "$plugin_dir"
