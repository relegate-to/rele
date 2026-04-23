#!/usr/bin/env bash
# Interactive openclaw docker dev watcher

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="rele-openclaw:latest"
WATCH_DIR="$REPO/openclaw"
MENU_NAME="openclaw"
MENU_KEYS="  [R] Rebuild  [X] Delete containers  [Q] Quit  "

source "$REPO/scripts/lib/menu.sh"

image_container_ids() {
  docker ps -q 2>/dev/null \
    | xargs -r docker inspect --format '{{if eq .Config.Image "'"$IMAGE"'"}}{{.ID}}{{end}}' 2>/dev/null \
    | grep .
}

show_instances() {
  local ids filter_args=() rows="" cols sep
  cols=$(tput cols 2>/dev/null || echo 80)
  sep=$(printf '─%.0s' $(seq 1 $((cols / 2 - 1))))
  ids=$(image_container_ids)
  local count
  count=$(echo "$ids" | grep -c . 2>/dev/null || true)
  if [[ -n "$ids" ]]; then
    while read -r id; do filter_args+=(--filter "id=$id"); done <<< "$ids"
    rows=$(docker ps "${filter_args[@]}" --format "{{.Names}}" 2>/dev/null)
  fi
  printf "\n${C_DIM}%s${C_RESET}\n" "$sep"
  if [[ "$count" -eq 0 ]]; then
    printf "${C_DIM}No running containers.${C_RESET}\n"
  else
    printf "${C_OK}%s running container(s)${C_RESET}\n" "$count"
    printf "${C_DIM}%s${C_RESET}\n" "$rows"
  fi
  printf "${C_DIM}%s${C_RESET}\n\n" "$sep"
  draw_status
}

build() {
  setup_terminal
  printf "${C_DIM}Building ${IMAGE}...${C_RESET}\n"
  if output=$(docker build --progress=plain -t "$IMAGE" "$WATCH_DIR" 2>&1); then
    printf "${C_OK}Built successfully.${C_RESET}\n"
  else
    printf "${C_ERR}%s${C_RESET}\n" "$output"
    printf "${C_ERR}Build failed.${C_RESET}\n"
  fi
  show_instances
}

delete_containers() {
  setup_terminal
  local ids
  ids=$(image_container_ids)
  if [[ -n "$ids" ]]; then
    docker stop $ids >/dev/null 2>&1
    docker rm $ids >/dev/null 2>&1
    printf "${C_WARN}Stopped and removed containers.${C_RESET}\n"
  else
    printf "${C_DIM}No running containers.${C_RESET}\n"
  fi
  show_instances
}

instance_watcher() {
  local prev=""
  while true; do
    local current
    current=$(image_container_ids 2>/dev/null || true)
    if [[ "$current" != "$prev" ]]; then
      prev="$current"
      kill -USR2 "$SELF" 2>/dev/null
    fi
    sleep 2
  done
}

trap 'build' SIGUSR1
trap 'show_instances' SIGUSR2
trap 'setup_terminal; show_instances' WINCH
trap 'kill "$WATCHER_PID" 2>/dev/null; clear' EXIT
SELF=$$

watchexec -w "$WATCH_DIR" --on-busy-update queue --postpone \
  /bin/kill -USR1 $SELF &

instance_watcher &
WATCHER_PID=$!

setup_terminal
build

while true; do
  if IFS= read -r -s -n 1 key < /dev/tty 2>/dev/null; then
    case "$(echo "$key" | tr '[:lower:]' '[:upper:]')" in
      R) build ;;
      X) delete_containers ;;
      Q) exit 0 ;;
    esac
  fi
done
