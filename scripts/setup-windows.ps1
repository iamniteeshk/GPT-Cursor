# One-time setup for a fresh Windows NUC
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
Write-Host "Setup complete."
Write-Host "Next:"
Write-Host "  1) .\scripts\start-chrome.ps1"
Write-Host "  2) npm start"
Write-Host "Log into ChatGPT + Cursor in the debug Chrome if asked."
