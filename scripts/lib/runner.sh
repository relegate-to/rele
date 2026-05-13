#!/usr/bin/env bash
# Event-driven dev runner library.
#
# Architecture: a single renderer subprocess owns all terminal output. Every
# producer (child stdout, signal handlers, key actions, watchers) emits tagged
# events through a fifo. The renderer consumes them serially, so concurrent
# producers can never interleave writes.
#
# Public API (callers use only these):
#
#   runner_init NAME KEYS_HINT          start the renderer, set up terminal
#   runner_on KEY FN                    register a keypress handler
#   runner_loop                         main key-read loop (blocks)
#   runner_set_keys NEW_HINT            change the status bar key hint
#
#   runner_log MSG                      one log line (colorized by content)
#   runner_info MSG / runner_ok MSG     semantic single lines
#   runner_warn MSG / runner_err MSG
#   runner_clear                        clear log area, keep status bar
#   runner_log_pipe                     pipe-friendly variant: cmd | runner_log_pipe
#
#   runner_spawn cmd args...            spawn in its own pgroup, echo pid
#   runner_track PID                    register pid for cleanup at exit
#   runner_kill PID                     kill a tracked pid's pgroup, untrack
#
# Optional hook callers may define:
#   _runner_tick                        called every loop iteration (~0.5s)

# ---- internal state ---------------------------------------------------------

RUNNER_FIFO=""
RUNNER_FD=3                     # fixed fd; macOS ships bash 3.2 (no {var}<> syntax)
RUNNER_RENDERER_PID=""
RUNNER_NAME=""
RUNNER_KEYS=""
RUNNER_TRACKED_PIDS=()
# Key handlers stored as dynamic vars RUNNER_KEY_FN_<KEY>; bash 3.2 has no
# associative arrays, so we use indirect expansion (${!var}) instead.

# ---- colours ---------------------------------------------------------------

C_RESET=$'\033[0m'
C_BAR_BG=$'\033[48;5;234m'
C_BAR_FG=$'\033[38;5;244m'
C_NAME=$'\033[1;38;5;255m'
C_SEP=$'\033[38;5;238m'
C_ERR=$'\033[38;5;203m'
C_WARN=$'\033[38;5;221m'
C_OK=$'\033[38;5;114m'
C_DIM=$'\033[38;5;240m'

# ---- renderer (background subprocess) --------------------------------------

_runner_setup_scroll() {
  local rows
  rows=$(tput lines 2>/dev/null) || rows=24
  tput csr 0 $((rows - 3))
  tput cup $((rows - 3)) 0
}

_runner_clear_log_area() {
  local rows i
  rows=$(tput lines 2>/dev/null) || rows=24
  tput cup 0 0
  for ((i = 0; i < rows - 2; i++)); do
    printf '\033[K\n'
  done
  tput cup 0 0
}

_runner_draw_status() {
  local rows keys="$1"
  rows=$(tput lines 2>/dev/null) || rows=24
  tput sc
  tput cup $((rows - 2)) 0
  printf '\033[K'
  tput cup $((rows - 1)) 0
  printf '%s%s  %s%s%s%s  %s·%s%s\033[K%s' \
    "$C_BAR_BG" "$C_BAR_FG" \
    "$C_NAME" "$RUNNER_NAME" "$C_RESET" \
    "$C_BAR_BG$C_BAR_FG" \
    "$C_SEP" "$C_BAR_FG" "$keys" \
    "$C_RESET"
  tput rc
}

_runner_colorize_log() {
  local text="$1"
  if [[ "$text" =~ [Ee][Rr][Rr][Oo][Rr]|[Ff][Aa][Ii][Ll][Ee][Dd] ]]; then
    printf '%s%s%s\n' "$C_ERR" "$text" "$C_RESET"
  elif [[ "$text" =~ [Ww][Aa][Rr][Nn] ]]; then
    printf '%s%s%s\n' "$C_WARN" "$text" "$C_RESET"
  else
    printf '%s\n' "$text"
  fi
}

_runner_renderer() {
  local event arg current_keys="$RUNNER_KEYS"
  while IFS=$'\t' read -r event arg; do
    case "$event" in
      LOG)    _runner_colorize_log "$arg" ;;
      INFO)   printf '%s%s%s\n' "$C_DIM"  "$arg" "$C_RESET" ;;
      OK)     printf '%s%s%s\n' "$C_OK"   "$arg" "$C_RESET" ;;
      WARN)   printf '%s%s%s\n' "$C_WARN" "$arg" "$C_RESET" ;;
      ERR)    printf '%s%s%s\n' "$C_ERR"  "$arg" "$C_RESET" ;;
      STATUS) current_keys="$arg"; _runner_draw_status "$current_keys" ;;
      CLEAR)  _runner_clear_log_area; _runner_draw_status "$current_keys" ;;
      RESIZE) _runner_setup_scroll;   _runner_draw_status "$current_keys" ;;
      QUIT)   break ;;
    esac
  done
}

# ---- producer API ----------------------------------------------------------

# Writes shorter than PIPE_BUF (>=4KB on every UNIX) are atomic on a fifo,
# so each event lands as one consumer read with no interleaving.
_runner_emit() {
  printf '%s\t%s\n' "$1" "$2" >&"$RUNNER_FD" 2>/dev/null || true
}

runner_log()  { _runner_emit LOG  "$1"; }
runner_info() { _runner_emit INFO "$1"; }
runner_ok()   { _runner_emit OK   "$1"; }
runner_warn() { _runner_emit WARN "$1"; }
runner_err()  { _runner_emit ERR  "$1"; }

runner_clear() { printf 'CLEAR\n' >&"$RUNNER_FD" 2>/dev/null || true; }

runner_set_keys() {
  RUNNER_KEYS="$1"
  _runner_emit STATUS "$1"
}

runner_log_pipe() {
  local line
  while IFS= read -r line; do
    _runner_emit LOG "$line"
  done
}

# ---- process tracking ------------------------------------------------------

runner_spawn() {
  set -m
  "$@" &
  local pid=$!
  set +m
  printf '%s' "$pid"
}

runner_track() {
  RUNNER_TRACKED_PIDS+=("$1")
}

runner_kill() {
  local pid="$1"
  [[ -z "$pid" ]] && return 0
  kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  runner_untrack "$pid"
}

runner_untrack() {
  local pid="$1" i
  for i in "${!RUNNER_TRACKED_PIDS[@]}"; do
    [[ "${RUNNER_TRACKED_PIDS[i]}" == "$pid" ]] && unset 'RUNNER_TRACKED_PIDS[i]'
  done
}

# ---- key registration & main loop ------------------------------------------

runner_on() {
  local key="$1" fn="$2"
  eval "RUNNER_KEY_FN_${key}=\"\$fn\""
}

runner_loop() {
  local key upper var fn
  while true; do
    # bash 3.2's read -t only accepts integer seconds; fractional is a 4.0+ feature.
    if IFS= read -r -s -n 1 -t 1 key < /dev/tty 2>/dev/null; then
      upper=$(printf '%s' "$key" | tr '[:lower:]' '[:upper:]')
      var="RUNNER_KEY_FN_${upper}"
      fn="${!var:-}"
      [[ -n "$fn" ]] && "$fn"
    fi
    declare -F _runner_tick >/dev/null && _runner_tick
  done
}

# ---- lifecycle -------------------------------------------------------------

_runner_on_winch() {
  printf 'RESIZE\n' >&"$RUNNER_FD" 2>/dev/null || true
}

runner_exit() {
  trap - EXIT INT TERM WINCH
  local pid
  for pid in "${RUNNER_TRACKED_PIDS[@]}"; do
    [[ -n "$pid" ]] && kill -- -"$pid" 2>/dev/null
  done
  for pid in "${RUNNER_TRACKED_PIDS[@]}"; do
    [[ -n "$pid" ]] && wait "$pid" 2>/dev/null
  done
  printf 'QUIT\n' >&"$RUNNER_FD" 2>/dev/null || true
  exec 3>&-
  [[ -n "$RUNNER_RENDERER_PID" ]] && wait "$RUNNER_RENDERER_PID" 2>/dev/null
  [[ -n "$RUNNER_FIFO" && -e "$RUNNER_FIFO" ]] && rm -f "$RUNNER_FIFO"
  local rows
  rows=$(tput lines 2>/dev/null) || rows=24
  tput csr 0 $((rows - 1))
  tput cup $((rows - 1)) 0
  printf '\033[0m\n'
  clear
}

runner_init() {
  RUNNER_NAME="$1"
  RUNNER_KEYS="$2"
  RUNNER_FIFO=$(mktemp -u /tmp/rele-runner-XXXXXX)
  mkfifo "$RUNNER_FIFO" || { echo "mkfifo failed" >&2; exit 1; }
  # Hold the fifo open r/w in the parent so producers never see EPIPE and
  # the renderer never sees EOF until we explicitly send QUIT.
  exec 3<>"$RUNNER_FIFO"
  # Prepare the terminal synchronously in the parent before spawning the
  # renderer, so initial state is deterministic.
  _runner_setup_scroll
  _runner_clear_log_area
  _runner_draw_status "$RUNNER_KEYS"
  _runner_renderer <"$RUNNER_FIFO" &
  RUNNER_RENDERER_PID=$!
  trap _runner_on_winch WINCH
  trap runner_exit EXIT INT TERM
}
