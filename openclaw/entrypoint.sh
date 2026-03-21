#!/bin/sh
# Removed set -e to prevent silent crashes; we'll handle errors manually.

echo "--- Entrypoint Starting ---"

# Validation
if [ -z "$OPENCLAW_GATEWAY_TOKEN" ]; then
  echo "ERROR: OPENCLAW_GATEWAY_TOKEN is missing" >&2
  exit 1
fi

CONFIG_DIR="/home/node/.openclaw"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"

echo "Setting up directories..."
mkdir -p "$CONFIG_DIR/workspace" "$CONFIG_DIR/agents/main/sessions"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "No config found, copying template..."
  cp /opt/openclaw/openclaw-template.json "$CONFIG_FILE" || echo "Warning: Template copy failed"
fi

echo "Patching configuration..."
# This version is safer: it checks if the file exists before trying to read it
node -e "
  const fs = require('fs');
  try {
    const data = fs.readFileSync('$CONFIG_FILE', 'utf8');
    const cfg = JSON.parse(data);
    cfg.gateway = cfg.gateway || {};
    cfg.gateway.bind = '0.0.0.0';
    cfg.gateway.mode = 'cloud';
    fs.writeFileSync('$CONFIG_FILE', JSON.stringify(cfg, null, 2));
    console.log('Config patched successfully');
  } catch (e) {
    console.error('Patching failed:', e.message);
    process.exit(1);
  }
" || exit 1

export OPENCLAW_NO_RESPAWN=1

echo "Launching Gateway..."
# On Fly.io, you MUST use --allow-insecure-sidecar because Fly's proxy
# talks to your app over plain HTTP/WS internally.
exec node dist/index.js gateway --verbose --allow-insecure-sidecar
