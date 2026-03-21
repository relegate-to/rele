#!/bin/sh
set -e

# Validation
if [ -z "$OPENCLAW_GATEWAY_TOKEN" ]; then
  echo "ERROR: OPENCLAW_GATEWAY_TOKEN is required" >&2
  exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
  echo "ERROR: ANTHROPIC_API_KEY or OPENAI_API_KEY must be set" >&2
  exit 1
fi

CONFIG_DIR="/home/node/.openclaw"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"

mkdir -p "$CONFIG_DIR/workspace" "$CONFIG_DIR/agents/main/sessions"

if [ ! -f "$CONFIG_FILE" ]; then
  cp /opt/openclaw/openclaw-template.json "$CONFIG_FILE"
fi

# 1. We use 'lan' instead of '0.0.0.0' because OpenClaw's Zod validator
#    often rejects the raw IP but accepts the 'lan' alias.
# 2. We set mode to 'cloud' so it expects external proxy traffic.
node -e "
  const fs = require('fs');
  const cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
  cfg.gateway = cfg.gateway || {};
  cfg.gateway.bind = 'lan';
  cfg.gateway.mode = 'cloud';
  fs.writeFileSync('$CONFIG_FILE', JSON.stringify(cfg, null, 2));
"

# Run doctor to ensure the DB and folders are ready
node dist/index.js doctor --fix

export OPENCLAW_NO_RESPAWN=1

echo "Starting OpenClaw gateway on Fly.io..."
# Added --allow-insecure-sidecar: Fly terminates SSL (WSS) at their edge,
# so the traffic hits your container as plain WS. OpenClaw blocks this
# by default for security; this flag allows the 'insecure' local hop.
exec node dist/index.js gateway --verbose --allow-insecure-sidecar
