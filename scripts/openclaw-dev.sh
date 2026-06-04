#!/usr/bin/env bash
# Interactive openclaw docker dev watcher

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="rele-openclaw:latest"
WATCH_DIR="$REPO/openclaw"
POLL_INTERVAL=2

source "$REPO/scripts/lib/runner.sh"

BUILD_REQUESTED=0
BUILD_PID=""
BUILD_STATUS_FILE=""
LAST_CONTAINERS=""
LAST_POLL=0

image_container_ids() {
  docker ps -q 2>/dev/null \
    | xargs -I{} docker inspect --format '{{if eq .Config.Image "'"$IMAGE"'"}}{{.ID}}{{end}}' {} 2>/dev/null \
    | grep .
}

show_instances() {
  local ids count names
  ids=$(image_container_ids || true)
  count=$(printf '%s' "$ids" | grep -c . 2>/dev/null || true)
  runner_info "────────────────────────"
  if [[ "${count:-0}" -eq 0 ]]; then
    runner_info "No running containers."
  else
    runner_ok "$count running container(s)"
    while IFS= read -r id; do
      [[ -z "$id" ]] && continue
      names=$(docker ps --filter "id=$id" --format "{{.Names}}" 2>/dev/null)
      [[ -n "$names" ]] && runner_info "  $names"
    done <<< "$ids"
  fi
  runner_info "────────────────────────"
}

# Start an async docker build. Its output streams through runner_log_pipe so
# the key-read loop stays responsive throughout the build. Exit status is
# written to a temp file by the subshell so we can pick it up on completion.
start_build() {
  if [[ -n "$BUILD_PID" ]] && kill -0 "$BUILD_PID" 2>/dev/null; then
    return
  fi
  runner_clear
  runner_info "Building $IMAGE..."
  BUILD_STATUS_FILE=$(mktemp /tmp/rele-openclaw-build-XXXXXX)
  set -m
  ( docker build --progress=plain -t "$IMAGE" "$WATCH_DIR" </dev/null 2>&1; \
    printf '%s' $? > "$BUILD_STATUS_FILE" ) | runner_log_pipe &
  BUILD_PID=$!
  set +m
  runner_track "$BUILD_PID"
}

finalize_build() {
  local status=1
  [[ -f "$BUILD_STATUS_FILE" ]] && status=$(cat "$BUILD_STATUS_FILE" 2>/dev/null || echo 1)
  rm -f "$BUILD_STATUS_FILE"
  BUILD_STATUS_FILE=""
  runner_untrack "$BUILD_PID"
  BUILD_PID=""
  if [[ "$status" -eq 0 ]]; then
    runner_ok "Built successfully."
  else
    runner_err "Build failed (exit $status)."
  fi
  show_instances
}

delete_containers() {
  runner_clear
  local ids
  ids=$(image_container_ids || true)
  if [[ -n "$ids" ]]; then
    docker stop $ids >/dev/null 2>&1
    docker rm   $ids >/dev/null 2>&1
    runner_warn "Stopped and removed containers."
  else
    runner_info "No running containers."
  fi
  show_instances
}

rebuild() { BUILD_REQUESTED=1; }
quit()    { exit 0; }

# Deferred work, polled ~1Hz by runner_loop. Nothing here touches the terminal
# directly — all output flows through runner_* event emitters.
_runner_tick() {
  if (( BUILD_REQUESTED )) && [[ -z "$BUILD_PID" ]]; then
    BUILD_REQUESTED=0
    start_build
  fi
  if [[ -n "$BUILD_PID" ]] && ! kill -0 "$BUILD_PID" 2>/dev/null; then
    wait "$BUILD_PID" 2>/dev/null
    finalize_build
  fi
  if (( SECONDS - LAST_POLL >= POLL_INTERVAL )); then
    LAST_POLL=$SECONDS
    local current
    current=$(image_container_ids 2>/dev/null || true)
    if [[ "$current" != "$LAST_CONTAINERS" ]]; then
      LAST_CONTAINERS="$current"
      show_instances
    fi
  fi
}

# watchexec → SIGUSR1 → flag → tick starts a build serially.
trap 'BUILD_REQUESTED=1' SIGUSR1

runner_init "openclaw" "  [R] Rebuild  [X] Delete containers  [Q] Quit  "
runner_on R rebuild
runner_on X delete_containers
runner_on Q quit

# Spawn watchexec inline with all tty handles detached so it can't interfere
# with our key reader. </dev/null in particular keeps it off the controlling tty.
set -m
watchexec -w "$WATCH_DIR" --on-busy-update queue --postpone \
  /bin/kill -USR1 $$ </dev/null >/dev/null 2>&1 &
WATCHEXEC_PID=$!
set +m
runner_track "$WATCHEXEC_PID"

# Trigger the initial build via the same async path used for rebuilds.
BUILD_REQUESTED=1

runner_loop
