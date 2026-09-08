#!/bin/sh
set -eu

legacy_dir="$HOME/.pi/agent/tools/review-zen"

if [ -d "$legacy_dir" ]; then
  rm -rf "$legacy_dir"
fi

rmdir "$HOME/.pi/agent/tools" 2>/dev/null || true
