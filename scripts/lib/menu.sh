#!/usr/bin/env bash
# Shared TUI menu library for dev runner scripts.
#
# Callers must set before sourcing:
#   MENU_NAME  — display name shown in the status bar (e.g. "web")
#   MENU_KEYS  — key hint string (e.g. "  [R] Restart  [Q] Quit  ")
#
# Managed by callers as needed:
#   LOG_FILE   — path to current log file (used by pipe_logs / redraw)
#   SERVER_PID — PID of the background server process

LOG_FILE=""
CURRENT_ROWS=0
SERVER_PID=""

C_RESET='\033[0m'
C_BAR_BG='\033[48;5;234m'
C_BAR_FG='\033[38;5;244m'
C_NAME='\033[1;38;5;255m'
C_KEY='\033[38;5;75m'
C_SEP='\033[38;5;238m'
C_ERR='\033[38;5;203m'
C_WARN='\033[38;5;221m'
C_OK='\033[38;5;114m'
C_DIM='\033[38;5;240m'

draw_status() {
  local rows
  rows=$(tput lines 2>/dev/null) || return
  tput sc
  tput cup $((rows - 2)) 0
  printf '\033[K'
  tput cup $((rows - 1)) 0
  printf "${C_BAR_BG}${C_BAR_FG}  ${C_NAME}${MENU_NAME}${C_RESET}${C_BAR_BG}${C_BAR_FG}  ${C_SEP}·${C_BAR_FG}${MENU_KEYS}\033[K${C_RESET}"
  tput rc
}

colorize_line() {
  local line="$1"
  if [[ "$line" =~ [Ee][Rr][Rr][Oo][Rr]|[Ff][Aa][Ii][Ll][Ee][Dd] ]]; then
    printf "${C_ERR}%s${C_RESET}\n" "$line"
  elif [[ "$line" =~ [Ww][Aa][Rr][Nn] ]]; then
    printf "${C_WARN}%s${C_RESET}\n" "$line"
  else
    printf '%s\n' "$line"
  fi
}

setup_terminal() {
  CURRENT_ROWS=$(tput lines)
  tput csr 0 $((CURRENT_ROWS - 1))
  clear
  tput csr 0 $((CURRENT_ROWS - 3))
  draw_status
}

redraw() {
  CURRENT_ROWS=$(tput lines)
  tput csr 0 $((CURRENT_ROWS - 1))
  clear
  tput csr 0 $((CURRENT_ROWS - 3))
  if [[ -n "$LOG_FILE" ]] && [[ -f "$LOG_FILE" ]]; then
    tail -n $((CURRENT_ROWS - 3)) "$LOG_FILE" | while IFS= read -r line; do
      colorize_line "$line"
    done
  fi
  draw_status
}

cleanup() {
  local rows
  rows=$(tput lines)
  tput csr 0 $((rows - 1))
  tput cup $((rows - 1)) 0
  printf '\033[0m\n'
  [[ -n "$LOG_FILE" ]] && rm -f "$LOG_FILE"
  kill 0
}

# Reads log lines from stdin, colorizes, and redraws the status bar after
# each line. Truncating to terminal width prevents long lines from wrapping
# into the protected status bar row. This is the sole background writer to
# the terminal, so there is no concurrent draw_status racing against it.
pipe_logs() {
  local line cols
  while IFS= read -r line; do
    cols=$(tput cols 2>/dev/null || echo 9999)
    colorize_line "${line:0:$cols}"
    draw_status
  done
}

trap cleanup EXIT INT TERM
trap redraw WINCH
