#!/bin/sh
set -e

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

mkdir -p "$CONFIG_DIR/workspace"

# Only copy template if config doesn't already exist (preserve user changes)
if [ ! -f "$CONFIG_FILE" ]; then
  cp /opt/openclaw/openclaw-template.json "$CONFIG_FILE"
  echo "Config initialized from template"
fi

echo "Starting OpenClaw gateway..."
exec node dist/index.js gateway
