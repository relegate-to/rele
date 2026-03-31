#!/bin/sh
set -eu

echo "--- Entrypoint Starting ---"

if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
  echo "ERROR: OPENCLAW_GATEWAY_TOKEN is missing" >&2
  exit 1
fi

if [ -z "${NEON_AUTH_URL:-}" ]; then
  echo "ERROR: NEON_AUTH_URL is missing" >&2
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

# Inject the gateway token into the config file
sed -i "s|OPENCLAW_GATEWAY_TOKEN_PLACEHOLDER|$OPENCLAW_GATEWAY_TOKEN|" "$CONFIG_FILE"

# Inject the public URL so OpenClaw generates correct webhook URLs
if [ -n "${FLY_APP_NAME:-}" ]; then
  PUBLIC_URL="https://${FLY_APP_NAME}.fly.dev"
  echo "Setting gateway.remote.url to $PUBLIC_URL"
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
    cfg.gateway.remote = { url: '$PUBLIC_URL' };
    fs.writeFileSync('$CONFIG_FILE', JSON.stringify(cfg, null, 2) + '\n');
  "
fi

echo "Config ready at $CONFIG_FILE"

# Start auth proxy (port 80 → OpenClaw on 18789, validates JWT)
echo "Starting auth proxy..."
node /opt/openclaw/auth-server.mjs &

echo "Launching Gateway..."
exec node dist/index.js gateway run
