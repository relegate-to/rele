#!/usr/bin/env bash
# Interactive openclaw docker dev watcher

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="rele-openclaw:latest"
WATCH_DIR="$REPO/openclaw"

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
  rows=$(tput lines)
  tput sc
  tput cup $((rows - 1)) 0
  printf "${C_BAR_BG}${C_BAR_FG}  ${C_NAME}openclaw${C_RESET}${C_BAR_BG}${C_BAR_FG}  ${C_SEP}·${C_BAR_FG}  ${C_KEY}[R]${C_BAR_FG} Rebuild  ${C_KEY}[X]${C_BAR_FG} Delete image  ${C_KEY}[Q]${C_BAR_FG} Quit  \033[K${C_RESET}"
  tput rc
}

setup_terminal() {
  CURRENT_ROWS=$(tput lines)
  tput csr 0 $((CURRENT_ROWS - 1))
  clear
  tput csr 0 $((CURRENT_ROWS - 2))
  draw_status
}

cleanup() {
  local rows
  rows=$(tput lines)
  tput csr 0 $((rows - 1))
  tput cup $((rows - 1)) 0
  printf '\033[0m\n'
  kill 0
}

on_resize() {
  CURRENT_ROWS=$(tput lines)
  tput csr 0 $((CURRENT_ROWS - 1))
  clear
  tput csr 0 $((CURRENT_ROWS - 2))
  draw_status
}

trap cleanup EXIT INT TERM
trap on_resize WINCH

build() {
  setup_terminal
  printf "${C_DIM}Building ${IMAGE}...${C_RESET}\n"
  if output=$(docker build --progress=plain -t "$IMAGE" "$WATCH_DIR" 2>&1); then
    printf "${C_OK}Built successfully.${C_RESET}\n"
  else
    printf "${C_ERR}%s${C_RESET}\n" "$output"
    printf "${C_ERR}Build failed.${C_RESET}\n"
  fi
  draw_status
}

delete_image() {
  setup_terminal
  if docker rmi "$IMAGE" 2>&1 >/dev/null; then
    printf "${C_WARN}Deleted ${IMAGE}.${C_RESET}\n"
  else
    printf "${C_DIM}Image not found.${C_RESET}\n"
  fi
  draw_status
}

# Trigger rebuild on file changes via SIGUSR1
trap 'build' SIGUSR1
SELF=$$
watchexec -w "$WATCH_DIR" --on-busy-update queue --postpone \
  /bin/kill -USR1 $SELF &

setup_terminal
build

while true; do
  if IFS= read -r -s -n 1 key < /dev/tty 2>/dev/null; then
    case "$(echo "$key" | tr '[:lower:]' '[:upper:]')" in
      R) build ;;
      X) delete_image ;;
      Q) clear; exit 0 ;;
    esac
  fi
done
