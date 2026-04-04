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

# Inject runtime values into config (always, so existing configs stay up to date)
node -e "
  const fs = require('fs');
  const cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));

  // Gateway token
  cfg.gateway.auth = cfg.gateway.auth || {};
  cfg.gateway.auth.mode = 'token';
  cfg.gateway.auth.token = '$OPENCLAW_GATEWAY_TOKEN';

  // Public URL so OpenClaw generates correct webhook/callback URLs
  const remoteUrl = '${GATEWAY_REMOTE_URL:-}';
  if (remoteUrl) {
    cfg.gateway.remote = { url: remoteUrl };
  }

  // In production, restrict allowed origins to the production domain only
  const appName = '${FLY_APP_NAME:-}';
  if (appName) {
    if (cfg.gateway.controlUi) {
      cfg.gateway.controlUi.allowedOrigins = ['https://rele.to', 'http://localhost:18789', 'http://127.0.0.1:18789'];
    }
  }

  fs.writeFileSync('$CONFIG_FILE', JSON.stringify(cfg, null, 2) + '\n');
"
echo "Runtime config values injected"

echo "Config ready at $CONFIG_FILE"

# Start auth proxy (port 80 → OpenClaw on 18789, validates JWT)
echo "Starting auth proxy..."
node /opt/openclaw/auth-server.mjs &

echo "Launching Gateway..."
while true; do
  node dist/index.js gateway run
  exit_code=$?
  if [ $exit_code -eq 0 ]; then
    echo "Gateway exited cleanly (restart requested), restarting..."
    sleep 1
  else
    echo "Gateway exited with error code $exit_code, shutting down"
    exit $exit_code
  fi
done
