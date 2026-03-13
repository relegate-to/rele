#!/bin/bash

CMD=$1
CONFIG_DIR="$(cd "$(dirname "$0")" && pwd)/configuration"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_REPO="https://github.com/relegate-to/configuration"

case $CMD in
  env:push)
    echo "Pushing .env.local files to configuration..."
    find "$ROOT_DIR" -name ".env*" \
      -not -path "*/configuration/*" \
      -not -path "*/node_modules/*" \
      | while read file; do
          relative="${file#$ROOT_DIR/}"
          dest="$CONFIG_DIR/$relative"
          mkdir -p "$(dirname "$dest")"
          cp "$file" "$dest"
          echo "  ✓ $relative"
        done
    echo "Committing and pushing..."
    cd "$CONFIG_DIR"
    git add .
    git commit -m "update env files"
    git push
    echo "Done."
    ;;

  env:pull)
    echo "Pulling latest configuration..."
    cd "$CONFIG_DIR" && git pull
    cd "$ROOT_DIR"
    echo "Applying .env.local files..."
    find "$CONFIG_DIR" -name ".env*" \
      | while read file; do
          relative="${file#$CONFIG_DIR/}"
          dest="$ROOT_DIR/$relative"
          mkdir -p "$(dirname "$dest")"
          cp "$file" "$dest"
          echo "  ✓ $relative"
        done
    echo "Done."
    ;;

  setup)
    echo "Cloning configuration..."
    git clone "$CONFIG_REPO" "$CONFIG_DIR"
    echo "Applying .env.local files..."
    find "$CONFIG_DIR" -name ".env*" \
      | while read file; do
          relative="${file#$CONFIG_DIR/}"
          dest="$ROOT_DIR/$relative"
          mkdir -p "$(dirname "$dest")"
          cp "$file" "$dest"
          echo "  ✓ $relative"
        done
    echo "Cleaning up..."
    rm -rf "$CONFIG_DIR"
    echo "Done."
    ;;

  *)
    echo "Usage: bash dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  setup      Clone configuration, apply env files, and clean up"
    echo "  env:push   Copy .env.local files into configuration/ and push"
    echo "  env:pull   Pull latest configuration and apply .env.local files"
    ;;
esac
