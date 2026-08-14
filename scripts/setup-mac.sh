#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Checking Node.js..."
node -v
npm -v

echo "Installing npm dependencies..."
npm install

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

echo
echo "Setup complete. Browser default: Microsoft Edge"
echo "Next:"
echo "  1) bash scripts/start-edge.sh"
echo "  2) npm start"
echo "Log into ChatGPT + Cursor in the debug Edge window if asked."
echo "(Optional Chrome: set BROWSER=chrome in .env and use bash scripts/start-chrome.sh)"
