#!/bin/sh
set -eu

echo "--- Entrypoint Starting ---"

if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
  echo "ERROR: OPENCLAW_GATEWAY_TOKEN is missing" >&2
  exit 1
fi

CONFIG_DIR="${OPENCLAW_STATE_DIR:-/home/node/.openclaw}"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"

mkdir -p "$CONFIG_DIR" "$CONFIG_DIR/workspace" "$CONFIG_DIR/credentials" "$CONFIG_DIR/agents/main/sessions"
chmod 700 "$CONFIG_DIR" "$CONFIG_DIR/credentials" || true

if [ ! -f "$CONFIG_FILE" ]; then
  echo "No config found, copying template..."
  cp /opt/openclaw/openclaw-template.json "$CONFIG_FILE"
  echo "Default config created at $CONFIG_FILE"
fi

echo "Config ready at $CONFIG_FILE"

echo "Launching Gateway..."
exec node dist/index.js gateway run \
  --allow-unconfigured \
  --bind auto \
  --port 18789 \
  --verbose
