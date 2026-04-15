#!/usr/bin/env bash
# Interactive web dev runner

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=3000
SERVER_PID=""
LOG_FILE=""
CURRENT_ROWS=0

C_RESET='\033[0m'
C_BAR_BG='\033[48;5;234m'
C_BAR_FG='\033[38;5;244m'
C_NAME='\033[1;38;5;255m'
C_KEY='\033[38;5;75m'
C_SEP='\033[38;5;238m'
C_ERR='\033[38;5;203m'
C_WARN='\033[38;5;221m'

draw_status() {
  local rows
  rows=$(tput lines)
  tput sc
  tput cup $((rows - 1)) 0
  printf "${C_BAR_BG}${C_BAR_FG}  ${C_NAME}web${C_RESET}${C_BAR_BG}${C_BAR_FG}  ${C_SEP}·${C_BAR_FG}  ${C_KEY}[R]${C_BAR_FG} Restart  ${C_KEY}[O]${C_BAR_FG} Open  ${C_KEY}[Q]${C_BAR_FG} Quit  \033[K${C_RESET}"
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
  tput csr 0 $((CURRENT_ROWS - 2))
  draw_status
}

redraw() {
  CURRENT_ROWS=$(tput lines)
  tput csr 0 $((CURRENT_ROWS - 1))
  clear
  tput csr 0 $((CURRENT_ROWS - 2))
  if [[ -f "$LOG_FILE" ]]; then
    tail -n $((CURRENT_ROWS - 2)) "$LOG_FILE" | while IFS= read -r line; do
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

pipe_logs() {
  while IFS= read -r line; do
    colorize_line "$line"
  done
}

trap cleanup EXIT INT TERM
trap redraw WINCH

start() {
  pids=$(lsof -ti tcp:3000 2>/dev/null || true)
  [[ -n "$pids" ]] && kill -9 $pids
  LOG_FILE=$(mktemp /tmp/rele-web-XXXXXX)
  setup_terminal
  set -m
  (cd "$REPO/web" && exec bun run dev) > "$LOG_FILE" 2>&1 &
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
      O) open "http://localhost:$PORT" ;;
      Q) clear; exit 0 ;;
    esac
  fi
done
