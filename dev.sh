#!/usr/bin/env bash
# Usage: ./dev.sh
# Opens a new Ghostty window:
#   left (big) — claude code
#   right col  — web (top) / gate (mid) / openclaw build (bot)

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v gx &>/dev/null; then
  echo "gx not found — install from https://github.com/ashsidhu/gx-ghostty" >&2
  exit 1
fi


# Use the current focused pane for claude
CLAUDE_UUID=$(gx list | awk '/\*/{print $NF}')
if [[ -z "$CLAUDE_UUID" ]]; then
  echo "Could not resolve focused pane — run: gx list" >&2
  exit 1
fi

# Split right column (left/right)
WEB_UUID=$(gx split "$CLAUDE_UUID" -h | awk '{print $NF}')

# Stack gate and openclaw below web in the right column (top/bottom)
GATE_UUID=$(gx split "$WEB_UUID" -v | awk '{print $NF}')
OPENCLAW_UUID=$(gx split "$GATE_UUID" -v | awk '{print $NF}')

# Fire commands
gx send "$CLAUDE_UUID"   "cd '$REPO' && printf '\033]0;claude\007' && clear && claude"
gx send "$WEB_UUID"      "cd '$REPO' && printf '\033]0;web\007' && clear && bun run dev:web"
gx send "$GATE_UUID"     "cd '$REPO' && printf '\033]0;gate\007' && clear && bun run dev:gate"
gx send "$OPENCLAW_UUID" "cd '$REPO' && printf '\033]0;openclaw\007' && { docker info &>/dev/null || { echo 'Starting Docker...'; open -a Docker; until docker info &>/dev/null; do sleep 2; done; }; } && clear && bun run dev:openclaw"

echo "rele dev launched — claude / web / gate / openclaw"
