#!/bin/sh

echo "--- Entrypoint Starting ---"

# Validation
if [ -z "$OPENCLAW_GATEWAY_TOKEN" ]; then
  echo "ERROR: OPENCLAW_GATEWAY_TOKEN is missing" >&2
  exit 1
fi

# State directory — Fly volumes mount here for persistence
export OPENCLAW_STATE_DIR="/home/node/.openclaw"
mkdir -p "$OPENCLAW_STATE_DIR"

export OPENCLAW_NO_RESPAWN=1
export NODE_OPTIONS="--max-old-space-size=1536"

echo "Launching Gateway..."
exec node dist/index.js gateway \
  --allow-unconfigured \
  --bind 0.0.0.0 \
  --port 18789 \
  --auth token \
  --token "$OPENCLAW_GATEWAY_TOKEN" \
  --verbose
