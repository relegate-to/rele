#!/usr/bin/env bash
# Interactive gate dev runner

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MENU_NAME="gate"
MENU_KEYS="  [R] Restart  [Q] Quit  "

source "$REPO/scripts/lib/menu.sh"

start() {
  local pids
  pids=$(lsof -ti tcp:3001 2>/dev/null || true)
  [[ -n "$pids" ]] && kill -9 $pids
  [[ -n "$LOG_FILE" ]] && rm -f "$LOG_FILE"
  LOG_FILE=$(mktemp /tmp/rele-gate-XXXXXX)
  setup_terminal
  set -m
  (cd "$REPO/gate" && exec bun run dev) > "$LOG_FILE" 2>&1 &
  set +m
  SERVER_PID=$!
  tail -f "$LOG_FILE" | pipe_logs &
}

restart() {
  if [[ -n "$SERVER_PID" ]]; then
    kill -- -"$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null
  fi
  [[ -n "$LOG_FILE" ]] && rm -f "$LOG_FILE"
  start
}

start

while true; do
  if IFS= read -r -s -n 1 key < /dev/tty 2>/dev/null; then
    case "$(echo "$key" | tr '[:lower:]' '[:upper:]')" in
      R) restart ;;
      Q) clear; exit 0 ;;
    esac
  fi
done
