#!/bin/sh
set -e

echo "--- Entrypoint Starting ---"

if [ -z "${NEON_AUTH_URL:-}" ]; then
  echo "ERROR: NEON_AUTH_URL is missing" >&2
  exit 1
fi

CONFIG_DIR="${OPENCLAW_STATE_DIR:-/home/node/.openclaw}"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"
LOOPBACK_PW_FILE="$CONFIG_DIR/credentials/loopback-password"

# This runs as root. The Fly volume is mounted at $CONFIG_DIR by the platform
# and its ownership is independent of anything in the image, so we have to
# chown it on every boot before the rele user can touch it.
mkdir -p "$CONFIG_DIR" "$CONFIG_DIR/workspace" "$CONFIG_DIR/credentials" "$CONFIG_DIR/agents/main/sessions" "$CONFIG_DIR/canvas"
chmod 700 "$CONFIG_DIR" "$CONFIG_DIR/credentials" || true
chown -R rele:rele "$CONFIG_DIR"

# Seed canvas placeholder (never overwrite if the agent has put real content there)
if [ ! -f "$CONFIG_DIR/canvas/index.html" ]; then
  cp /opt/openclaw/canvas-placeholder.html "$CONFIG_DIR/canvas/index.html"
  chown rele:rele "$CONFIG_DIR/canvas/index.html"
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "No config found, copying template..."
  cp /opt/openclaw/openclaw-template.json "$CONFIG_FILE"
  chown rele:rele "$CONFIG_FILE"
  echo "Default config created at $CONFIG_FILE"
fi

# Loopback password: trusted-proxy mode rejects direct (non-proxied) connections,
# which breaks internal callers (node host, CLI, agent tools, status probes).
# openclaw/openclaw#73034 adds a password fallback for loopback-only callers.
# Generate once and persist so internal processes reading the same config agree.
if [ ! -s "$LOOPBACK_PW_FILE" ]; then
  head -c 32 /dev/urandom | base64 | tr -d '\n=+/ ' >"$LOOPBACK_PW_FILE"
fi
chmod 600 "$LOOPBACK_PW_FILE"
chown rele:rele "$LOOPBACK_PW_FILE"
LOOPBACK_PW=$(cat "$LOOPBACK_PW_FILE")

# Inject runtime values into config (always, so existing configs stay up to date)
node -e "
  const fs = require('fs');
  const cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));

  // Trusted-proxy auth: sidecar (same host) authenticates the user via JWT and
  // forwards identity as x-forwarded-user. Gateway binds loopback so the only
  // path in is via the sidecar.
  cfg.gateway.trustedProxies = ['127.0.0.1', '::1'];
  cfg.gateway.auth = {
    mode: 'trusted-proxy',
    trustedProxy: {
      userHeader: 'x-forwarded-user',
      allowLoopback: true,
    },
    // Loopback-only password fallback for internal callers that don't go
    // through the sidecar (see openclaw/openclaw#73034).
    password: '${LOOPBACK_PW}',
  };

  // Public URL so OpenClaw generates correct webhook/callback URLs
  const remoteUrl = '${GATEWAY_REMOTE_URL:-}';
  if (remoteUrl) {
    cfg.gateway.remote = { url: remoteUrl };
  }

  // Heartbeat: isolate into a hidden session
  const agent = (cfg.agents.list || []).find(a => a.default || a.id === 'main');
  if (agent) {
    agent.heartbeat = agent.heartbeat || {};
    if (!agent.heartbeat.session) agent.heartbeat.session = '.heartbeat';
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
chown rele:rele "$CONFIG_FILE"
echo "Runtime config values injected"

echo "Config ready at $CONFIG_FILE"

# Drop to rele for the long-running processes. HOME is set so brew, npm, go,
# and anything the agent runs land in /home/rele rather than /root.
#
# Re-apply cap_net_bind_service at boot: the build-time setcap can be stripped
# by image transport (registries / runtimes that don't preserve security.capability
# xattrs), which manifests on Fly as "Permission denied (os error 13)" when the
# unprivileged sidecar tries to bind :80.
setcap 'cap_net_bind_service=+ep' /opt/openclaw/sidecar

echo "Starting sidecar..."
gosu rele env HOME=/home/rele /opt/openclaw/sidecar &

echo "Launching Gateway..."
while true; do
  _fifo=$(mktemp -u /tmp/gw.XXXXXX)
  mkfifo "$_fifo"
  chown rele:rele "$_fifo"
  gosu rele env HOME=/home/rele node dist/index.js gateway run >"$_fifo" 2>&1 &
  _node_pid=$!
  while IFS= read -r _line; do
    printf '%s\n' "$_line"
    case "$_line" in
      *"spawned pid "*)
        _spawned=$(printf '%s\n' "$_line" | sed 's/.*spawned pid \([0-9]*\).*/\1/')
        kill "$_spawned" 2>/dev/null && echo "Killed self-spawned gateway pid $_spawned, restarting cleanly" || true
        ;;
    esac
  done <"$_fifo"
  wait "$_node_pid"
  exit_code=$?
  rm -f "$_fifo"

  if [ $exit_code -eq 0 ]; then
    echo "Gateway exited cleanly (restart requested), restarting..."
    sleep 1
  else
    echo "Gateway exited with error code $exit_code, shutting down"
    exit $exit_code
  fi
done
