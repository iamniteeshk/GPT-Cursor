#!/usr/bin/env bash
# Start Chrome with remote debugging for GPT↔Cursor automation.
#
# Newer Chrome refuses:
#   DevTools remote debugging requires a non-default data directory
# so we use ~/.gpt-cursor-chrome (seeded from your real Chrome profile).

set -euo pipefail

PORT="${1:-9222}"
PROFILE_DIRECTORY="${2:-Default}"
AUTO_QUIT="${AUTO_QUIT_CHROME:-1}"
SYNC_PROFILE="${SYNC_PROFILE:-1}"
DEBUG_USER_DATA_DIR="${GPT_CURSOR_CHROME_DIR:-$HOME/.gpt-cursor-chrome}"

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
    pgrep -f "Google Chrome.app/Contents/MacOS/Google Chrome" >/dev/null 2>&1 && return 0
    return 1
  fi
  pgrep -f "chrome|chromium" >/dev/null 2>&1
}

quit_chrome() {
  echo "Quitting existing Chrome so the profile can be copied / debug Chrome can start..."
  if [[ "$(uname -s)" == "Darwin" ]]; then
    osascript -e 'tell application "Google Chrome" to quit' >/dev/null 2>&1 || true
    for _ in $(seq 1 20); do
      chrome_running || break
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
    echo "ERROR: Chrome is still running. Quit it fully (Cmd+Q), then rerun." >&2
    exit 1
  fi
  echo "Chrome quit."
}

wait_for_cdp() {
  local i
  for i in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

real_chrome_user_data_dir() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "$HOME/Library/Application Support/Google/Chrome"
  else
    echo "${CHROME_USER_DATA_DIR:-$HOME/.config/google-chrome}"
  fi
}

sync_profile_from_real_chrome() {
  local src
  src="$(real_chrome_user_data_dir)"
  local src_profile="$src/$PROFILE_DIRECTORY"
  local dst_profile="$DEBUG_USER_DATA_DIR/$PROFILE_DIRECTORY"

  if [[ ! -d "$src_profile" ]]; then
    echo "WARNING: Real Chrome profile not found at: $src_profile" >&2
    echo "Will start a fresh debug profile. Log in to ChatGPT + Cursor once." >&2
    mkdir -p "$dst_profile"
    return 0
  fi

  echo "Seeding debug profile from your Chrome profile..."
  echo "  from: $src_profile"
  echo "  to:   $dst_profile"

  mkdir -p "$DEBUG_USER_DATA_DIR"
  # Local State helps Chrome find profile settings.
  if [[ -f "$src/Local State" ]]; then
    cp "$src/Local State" "$DEBUG_USER_DATA_DIR/Local State"
  fi

  mkdir -p "$dst_profile"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a \
      --delete \
      --exclude='Singleton*' \
      --exclude='LockFile' \
      --exclude='lockfile' \
      --exclude='RunningChromeVersion' \
      --exclude='Cache/**' \
      --exclude='Code Cache/**' \
      --exclude='GPUCache/**' \
      --exclude='Service Worker/CacheStorage/**' \
      --exclude='ShaderCache/**' \
      --exclude='DawnCache/**' \
      --exclude='GrShaderCache/**' \
      "$src_profile/" "$dst_profile/"
  else
    rm -rf "$dst_profile"
    mkdir -p "$dst_profile"
    cp -R "$src_profile/." "$dst_profile/"
    rm -f "$dst_profile/SingletonLock" "$dst_profile/SingletonCookie" "$dst_profile/SingletonSocket" "$dst_profile/LockFile" 2>/dev/null || true
  fi

  # Remove lock files so this copy is free to start.
  rm -f \
    "$DEBUG_USER_DATA_DIR/SingletonLock" \
    "$DEBUG_USER_DATA_DIR/SingletonCookie" \
    "$DEBUG_USER_DATA_DIR/SingletonSocket" \
    "$dst_profile/SingletonLock" \
    "$dst_profile/SingletonCookie" \
    "$dst_profile/SingletonSocket" \
    "$dst_profile/LockFile" 2>/dev/null || true

  echo "Profile seed complete."
}

CHROME="$(detect_chrome)" || {
  echo "Google Chrome / Chromium not found." >&2
  exit 1
}

if chrome_running; then
  if [[ "$AUTO_QUIT" == "1" ]]; then
    quit_chrome
  else
    echo "ERROR: Chrome is already running. Quit it (Cmd+Q) and rerun." >&2
    exit 1
  fi
fi

if curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  echo "Port ${PORT} already has a CDP server. Reusing it."
  curl -fsS "http://127.0.0.1:${PORT}/json/version"
  echo
  echo "OK — now run: npm run check-login"
  exit 0
fi

if [[ "$SYNC_PROFILE" == "1" ]]; then
  sync_profile_from_real_chrome
else
  mkdir -p "$DEBUG_USER_DATA_DIR/$PROFILE_DIRECTORY"
fi

echo "Starting debug Chrome with remote debugging on port $PORT"
echo "Debug profile (non-default, required by Chrome): $DEBUG_USER_DATA_DIR"
echo "Keep this Chrome open while automation runs."

"$CHROME" \
  --remote-debugging-port="$PORT" \
  --remote-allow-origins=* \
  --user-data-dir="$DEBUG_USER_DATA_DIR" \
  --profile-directory="$PROFILE_DIRECTORY" \
  --no-first-run \
  --no-default-browser-check \
  --disable-features=DevToolsDebuggingRestrictions \
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
  echo
  echo "If ChatGPT/Cursor ask you to log in in this debug Chrome window, log in once."
  echo "The script will wait, or you can rerun check-login after logging in."
else
  echo
  echo "ERROR: Chrome started but port ${PORT} never opened." >&2
  echo "Last Chrome log lines:" >&2
  tail -n 60 /tmp/gpt-cursor-chrome.log 2>/dev/null || true
  exit 1
fi
