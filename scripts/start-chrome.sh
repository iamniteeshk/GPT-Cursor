#!/usr/bin/env bash
# Start Chrome/Chromium with remote debugging so automation can reuse your logged-in profile.
# Close ALL Chrome windows first, then run this script.

set -euo pipefail

PORT="${1:-9222}"
PROFILE_DIRECTORY="${2:-Default}"

detect_chrome() {
  if command -v google-chrome >/dev/null 2>&1; then
    echo "google-chrome"
  elif command -v google-chrome-stable >/dev/null 2>&1; then
    echo "google-chrome-stable"
  elif command -v chromium >/dev/null 2>&1; then
    echo "chromium"
  elif command -v chromium-browser >/dev/null 2>&1; then
    echo "chromium-browser"
  elif [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
    echo "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  else
    return 1
  fi
}

CHROME="$(detect_chrome)" || {
  echo "Google Chrome / Chromium not found." >&2
  exit 1
}

if [[ "$(uname -s)" == "Darwin" ]]; then
  USER_DATA_DIR="$HOME/Library/Application Support/Google/Chrome"
else
  USER_DATA_DIR="${CHROME_USER_DATA_DIR:-$HOME/.config/google-chrome}"
fi

echo "Starting Chrome with remote debugging on port $PORT"
echo "Profile: $USER_DATA_DIR ($PROFILE_DIRECTORY)"
echo "Close this Chrome window only when automation is finished."

exec "$CHROME" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$USER_DATA_DIR" \
  --profile-directory="$PROFILE_DIRECTORY" \
  --no-first-run \
  --no-default-browser-check \
  "https://chatgpt.com" \
  "https://cursor.com/agents"
