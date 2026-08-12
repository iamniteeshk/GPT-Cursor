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
echo "Setup complete."
echo "Next:"
echo "  1) bash scripts/start-chrome.sh"
echo "  2) npm start"
echo "Log into ChatGPT + Cursor in the debug Chrome if asked."
