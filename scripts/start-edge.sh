#!/usr/bin/env bash
# Start Microsoft Edge with remote debugging for GPT↔Cursor automation.
# Seeds ~/.gpt-cursor-edge from your real Edge profile.

set -euo pipefail

PORT="${1:-9222}"
PROFILE_DIRECTORY="${2:-Default}"
AUTO_QUIT="${AUTO_QUIT_EDGE:-1}"
SYNC_PROFILE="${SYNC_PROFILE:-1}"
DEBUG_USER_DATA_DIR="${GPT_CURSOR_BROWSER_DIR:-${GPT_CURSOR_CHROME_DIR:-$HOME/.gpt-cursor-edge}}"

detect_edge() {
  if [[ -x "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" ]]; then
    echo "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  elif command -v microsoft-edge >/dev/null 2>&1; then
    command -v microsoft-edge
  elif command -v microsoft-edge-stable >/dev/null 2>&1; then
    command -v microsoft-edge-stable
  else
    return 1
  fi
}

edge_running() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    pgrep -x "Microsoft Edge" >/dev/null 2>&1 && return 0
    pgrep -f "Microsoft Edge.app/Contents/MacOS/Microsoft Edge" >/dev/null 2>&1 && return 0
    return 1
  fi
  pgrep -f "microsoft-edge|msedge" >/dev/null 2>&1
}

quit_edge() {
  echo "Quitting existing Edge so the profile can be copied / debug Edge can start..."
  if [[ "$(uname -s)" == "Darwin" ]]; then
    osascript -e 'tell application "Microsoft Edge" to quit' >/dev/null 2>&1 || true
    for _ in $(seq 1 20); do
      edge_running || break
      sleep 0.5
    done
    if edge_running; then
      pkill -9 -x "Microsoft Edge" >/dev/null 2>&1 || true
      pkill -9 -f "Microsoft Edge" >/dev/null 2>&1 || true
      sleep 1
    fi
  else
    pkill -TERM -f "microsoft-edge|msedge" >/dev/null 2>&1 || true
    sleep 2
    pkill -KILL -f "microsoft-edge|msedge" >/dev/null 2>&1 || true
  fi

  if edge_running; then
    echo "ERROR: Edge is still running. Quit it fully, then rerun." >&2
    exit 1
  fi
  echo "Edge quit."
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

real_edge_user_data_dir() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "$HOME/Library/Application Support/Microsoft Edge"
  else
    echo "${EDGE_USER_DATA_DIR:-$HOME/.config/microsoft-edge}"
  fi
}

sync_profile_from_real_edge() {
  local src
  src="$(real_edge_user_data_dir)"
  local src_profile="$src/$PROFILE_DIRECTORY"
  local dst_profile="$DEBUG_USER_DATA_DIR/$PROFILE_DIRECTORY"

  if [[ ! -d "$src_profile" ]]; then
    echo "WARNING: Real Edge profile not found at: $src_profile" >&2
    echo "Will start a fresh debug profile. Log in to ChatGPT + Cursor once." >&2
    mkdir -p "$dst_profile"
    return 0
  fi

  echo "Seeding debug profile from your Edge profile..."
  echo "  from: $src_profile"
  echo "  to:   $dst_profile"

  mkdir -p "$DEBUG_USER_DATA_DIR"
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

EDGE="$(detect_edge)" || {
  echo "Microsoft Edge not found." >&2
  exit 1
}

if edge_running; then
  if [[ "$AUTO_QUIT" == "1" ]]; then
    quit_edge
  else
    echo "ERROR: Edge is already running. Quit it and rerun." >&2
    exit 1
  fi
fi

if curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  echo "Port ${PORT} already has a CDP server. Reusing it."
  curl -fsS "http://127.0.0.1:${PORT}/json/version"
  echo
  echo "OK — now run: npm start"
  exit 0
fi

if [[ "$SYNC_PROFILE" == "1" ]]; then
  sync_profile_from_real_edge
else
  mkdir -p "$DEBUG_USER_DATA_DIR/$PROFILE_DIRECTORY"
fi

echo "Starting debug Edge with remote debugging on port $PORT"
echo "Debug profile: $DEBUG_USER_DATA_DIR"
echo "Keep this Edge window open while automation runs."

"$EDGE" \
  --remote-debugging-port="$PORT" \
  --remote-allow-origins=* \
  --user-data-dir="$DEBUG_USER_DATA_DIR" \
  --profile-directory="$PROFILE_DIRECTORY" \
  --no-first-run \
  --no-default-browser-check \
  "https://chatgpt.com" \
  "https://cursor.com/agents" \
  >/tmp/gpt-cursor-edge.log 2>&1 &

EDGE_PID=$!
echo "Edge PID: $EDGE_PID"

if wait_for_cdp; then
  echo
  echo "CDP is ready at http://127.0.0.1:${PORT}"
  curl -fsS "http://127.0.0.1:${PORT}/json/version"
  echo
  echo
  echo "SUCCESS. Next:"
  echo "  npm start"
  echo "You will be asked for GPT + Cursor links in the terminal."
  echo "If ChatGPT/Cursor ask you to log in in this Edge window, log in once."
else
  echo
  echo "ERROR: Edge started but port ${PORT} never opened." >&2
  echo "Last Edge log lines:" >&2
  tail -n 60 /tmp/gpt-cursor-edge.log 2>/dev/null || true
  exit 1
fi
