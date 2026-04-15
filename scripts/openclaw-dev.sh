#!/usr/bin/env bash
# Interactive openclaw docker dev watcher
# [R] rebuild  [X] delete image  [Q] quit

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="rele-openclaw:latest"
WATCH_DIR="$REPO/openclaw"

trap "kill 0" EXIT INT TERM

status() {
  echo ""
  echo "[R] rebuild  [X] delete image  [Q] quit"
}

build() {
  clear
  echo "Building $IMAGE..."
  if docker build -t "$IMAGE" "$WATCH_DIR"; then
    clear
    echo "Built successfully."
  else
    clear
    echo "Build failed."
  fi
  status
}

delete_image() {
  clear
  if docker rmi "$IMAGE" 2>/dev/null; then
    echo "Deleted $IMAGE."
  else
    echo "Image not found."
  fi
  status
}

# Trigger rebuild on file changes via SIGUSR1
trap 'build' SIGUSR1
SELF=$$
watchexec -w "$WATCH_DIR" --on-busy-update queue --postpone \
  bash -c "kill -USR1 $SELF" &

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
