#!/bin/bash

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

case $1 in
  up)
    docker compose -f "$ROOT_DIR/supabase/supabase.yml" --env-file "$ROOT_DIR/supabase/.env" --project-name supabase up -d
    docker compose -f "$ROOT_DIR/docker-compose.yml" up "${@:2}"
    ;;

  down)
    docker compose -f "$ROOT_DIR/docker-compose.yml" down "${@:2}"
    docker compose -f "$ROOT_DIR/supabase/supabase.yml" --project-name supabase down "${@:2}"
    ;;

  *)
    echo "Usage: bash compose.sh <command>"
    echo ""
    echo "Commands:"
    echo "  up [args]    Start supabase (detached) then web/gate (foreground)"
    echo "  down [args]  Stop web/gate then supabase"
    ;;
esac
