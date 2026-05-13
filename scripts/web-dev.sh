#!/usr/bin/env bash
# Interactive web dev runner

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=3000

source "$REPO/scripts/lib/runner.sh"

LOG_PUMP_PID=""

start() {
  local pids
  pids=$(lsof -ti tcp:$PORT 2>/dev/null || true)
  [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null
  set -m
  ( cd "$REPO/web" && exec bun run dev 2>&1 ) | runner_log_pipe &
  LOG_PUMP_PID=$!
  set +m
  runner_track "$LOG_PUMP_PID"
}

restart() {
  if [[ -n "$LOG_PUMP_PID" ]]; then
    runner_kill "$LOG_PUMP_PID"
    LOG_PUMP_PID=""
  fi
  runner_clear
  runner_info "Restarting web..."
  start
}

open_browser() {
  open "http://localhost:$PORT" 2>/dev/null || true
}

quit() { exit 0; }

runner_init "web" "  [R] Restart  [O] Open  [Q] Quit  "
runner_on R restart
runner_on O open_browser
runner_on Q quit

start
runner_loop
