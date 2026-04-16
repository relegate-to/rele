#!/usr/bin/env bash
# Interactive openclaw docker dev watcher

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="rele-openclaw:latest"
WATCH_DIR="$REPO/openclaw"
MENU_NAME="openclaw"
MENU_KEYS="  [R] Rebuild  [X] Delete containers  [Q] Quit  "

source "$REPO/scripts/lib/menu.sh"

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

delete_containers() {
  setup_terminal
  local ids
  ids=$(docker ps -aq --filter "ancestor=$IMAGE")
  if [[ -n "$ids" ]]; then
    docker stop $ids >/dev/null 2>&1
    docker rm $ids >/dev/null 2>&1
    printf "${C_WARN}Stopped and removed containers.${C_RESET}\n"
  else
    printf "${C_DIM}No running containers.${C_RESET}\n"
  fi
  draw_status
}

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
      X) delete_containers ;;
      Q) clear; exit 0 ;;
    esac
  fi
done
