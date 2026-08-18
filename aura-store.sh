#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Start backend server if not already running on port 3001
if ! ss -tulpn 2>/dev/null | grep -q ":3001"; then
  (cd "$DIR" && node server/index.js >/dev/null 2>&1) &
  sleep 1
fi

# 2. Start frontend dev server if not already running on port 5173
if ! ss -tulpn 2>/dev/null | grep -q ":5173"; then
  (cd "$DIR" && npm run dev >/dev/null 2>&1) &
  sleep 1.5
fi

# 3. Launch dedicated standalone desktop app window
if command -v brave >/dev/null 2>&1; then
  exec brave --app="http://localhost:5173" --user-data-dir="$HOME/.config/aura-store-app" --class="aura-store" --name="Aura Store" "$@"
elif command -v google-chrome-stable >/dev/null 2>&1; then
  exec google-chrome-stable --app="http://localhost:5173" --user-data-dir="$HOME/.config/aura-store-app" --class="aura-store" "$@"
elif command -v chromium >/dev/null 2>&1; then
  exec chromium --app="http://localhost:5173" --user-data-dir="$HOME/.config/aura-store-app" --class="aura-store" "$@"
else
  xdg-open "http://localhost:5173"
fi
