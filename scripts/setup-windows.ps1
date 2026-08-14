# One-time setup for a fresh Windows NUC (Edge by default)
$ErrorActionPreference = "Stop"

Write-Host "Checking Node.js..."
node -v
npm -v

Write-Host "Installing npm dependencies..."
npm install

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

Write-Host ""
Write-Host "Setup complete. Browser default: Microsoft Edge"
Write-Host "Next:"
Write-Host "  1) .\scripts\start-edge.ps1"
Write-Host "  2) npm start"
Write-Host "Log into ChatGPT + Cursor in the debug Edge window if asked."
Write-Host "(Optional Chrome: set BROWSER=chrome in .env and use .\scripts\start-chrome.ps1)"
