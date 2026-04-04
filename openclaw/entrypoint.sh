#!/bin/sh
set -e

echo "--- Entrypoint Starting ---"

if [ -z "${NEON_AUTH_URL:-}" ]; then
  echo "ERROR: NEON_AUTH_URL is missing" >&2
  exit 1
fi

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

# Map our env var name to the one OpenClaw reads for the remote URL
export OPENCLAW_GATEWAY_URL="${GATEWAY_REMOTE_URL:-}"

# Start auth proxy (port 80 → OpenClaw on 18789, validates JWT)
echo "Starting auth proxy..."
node /opt/openclaw/auth-server.mjs &

echo "Launching Gateway..."
exec node dist/index.js gateway run
