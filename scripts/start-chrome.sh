#!/usr/bin/env bash
# Start Chrome with remote debugging so automation can reuse your logged-in profile.
# If Chrome is already running WITHOUT remote debugging, macOS reuses that session and
# ignores --remote-debugging-port (you see: "Opening in existing browser session").
# This script quits Chrome first, then relaunches with debugging enabled.

set -euo pipefail

PORT="${1:-9222}"
PROFILE_DIRECTORY="${2:-Default}"
AUTO_QUIT="${AUTO_QUIT_CHROME:-1}"

detect_chrome() {
  if [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
    echo "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  elif command -v google-chrome >/dev/null 2>&1; then
    command -v google-chrome
  elif command -v google-chrome-stable >/dev/null 2>&1; then
    command -v google-chrome-stable
  elif command -v chromium >/dev/null 2>&1; then
    command -v chromium
  elif command -v chromium-browser >/dev/null 2>&1; then
    command -v chromium-browser
  else
    return 1
  fi
}

chrome_running() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    pgrep -x "Google Chrome" >/dev/null 2>&1 && return 0
    pgrep -f "Google Chrome.app" >/dev/null 2>&1 && return 0
    return 1
  fi
  pgrep -f "chrome|chromium" >/dev/null 2>&1
}

quit_chrome() {
  echo "Quitting existing Chrome so remote debugging can attach..."
  if [[ "$(uname -s)" == "Darwin" ]]; then
    osascript -e 'tell application "Google Chrome" to quit' >/dev/null 2>&1 || true
    # Force-kill leftovers if still alive after a few seconds.
    for _ in $(seq 1 20); do
      if ! chrome_running; then
        break
      fi
      sleep 0.5
    done
    if chrome_running; then
      echo "Chrome did not quit cleanly. Force killing..."
      pkill -9 -x "Google Chrome" >/dev/null 2>&1 || true
      pkill -9 -f "Google Chrome" >/dev/null 2>&1 || true
      sleep 1
    fi
  else
    pkill -TERM -f "google-chrome|chromium" >/dev/null 2>&1 || true
    sleep 2
    pkill -KILL -f "google-chrome|chromium" >/dev/null 2>&1 || true
  fi

  if chrome_running; then
    echo "ERROR: Chrome is still running. Quit it fully (Cmd+Q), then rerun:" >&2
    echo "  bash scripts/start-chrome.sh" >&2
    exit 1
  fi
  echo "Chrome quit."
}

wait_for_cdp() {
  local tries=30
  local i
  for i in $(seq 1 "$tries"); do
    if curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  return 1
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

if chrome_running; then
  if [[ "$AUTO_QUIT" == "1" ]]; then
    quit_chrome
  else
    echo "ERROR: Chrome is already running." >&2
    echo "Remote debugging only works if Chrome is started WITH --remote-debugging-port." >&2
    echo "Quit Chrome fully (Cmd+Q on Mac), then run this script again." >&2
    echo "Or rerun with auto-quit: AUTO_QUIT_CHROME=1 bash scripts/start-chrome.sh" >&2
    exit 1
  fi
fi

# Free the port if something else holds it.
if curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  echo "Port ${PORT} already has a CDP server. Reusing it."
  curl -fsS "http://127.0.0.1:${PORT}/json/version"
  echo
  echo "OK — now run: npm run check-login"
  exit 0
fi

echo "Starting Chrome with remote debugging on port $PORT"
echo "Profile: $USER_DATA_DIR ($PROFILE_DIRECTORY)"
echo "Keep this Chrome open while automation runs."

"$CHROME" \
  --remote-debugging-port="$PORT" \
  --remote-allow-origins=* \
  --user-data-dir="$USER_DATA_DIR" \
  --profile-directory="$PROFILE_DIRECTORY" \
  --no-first-run \
  --no-default-browser-check \
  "https://chatgpt.com" \
  "https://cursor.com/agents" \
  >/tmp/gpt-cursor-chrome.log 2>&1 &

CHROME_PID=$!
echo "Chrome PID: $CHROME_PID"

if wait_for_cdp; then
  echo
  echo "CDP is ready at http://127.0.0.1:${PORT}"
  curl -fsS "http://127.0.0.1:${PORT}/json/version"
  echo
  echo
  echo "SUCCESS. Next:"
  echo "  npm run check-login"
  echo "  npm start"
else
  echo
  echo "ERROR: Chrome started but port ${PORT} never opened." >&2
  echo "Last Chrome log lines:" >&2
  tail -n 40 /tmp/gpt-cursor-chrome.log 2>/dev/null || true
  echo >&2
  echo "Common cause: Chrome reattached to an old session." >&2
  echo "Fix: Cmd+Q Chrome, confirm Activity Monitor has no Google Chrome, then rerun." >&2
  exit 1
fi
