# Start Chrome with remote debugging so the automation can reuse your logged-in profile.
# If Chrome is already running, Windows reuses that session and ignores --remote-debugging-port.
# This script closes Chrome first, then relaunches with debugging enabled.

param(
  [int]$Port = 9222,
  [string]$ProfileDirectory = "Default",
  [switch]$NoAutoQuit
)

$ErrorActionPreference = "Stop"

$chromePaths = @(
  "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
  "${env:PROGRAMFILES(X86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) {
  Write-Error "Google Chrome not found. Install Chrome or edit this script with the correct path."
  exit 1
}

$userDataDir = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"

function Test-ChromeRunning {
  return $null -ne (Get-Process -Name "chrome" -ErrorAction SilentlyContinue)
}

function Test-CdpReady {
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json/version" -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

if (Test-ChromeRunning) {
  if ($NoAutoQuit) {
    Write-Error "Chrome is already running. Quit it fully, then rerun this script."
    exit 1
  }
  Write-Host "Quitting existing Chrome so remote debugging can attach..."
  Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 2
  if (Test-ChromeRunning) {
    Write-Error "Chrome is still running. End all chrome.exe tasks in Task Manager, then rerun."
    exit 1
  }
  Write-Host "Chrome quit."
}

if (Test-CdpReady) {
  Write-Host "Port $Port already has a CDP server. Reusing it."
  Write-Host "OK — now run: npm run check-login"
  exit 0
}

Write-Host "Starting Chrome with remote debugging on port $Port"
Write-Host "Profile: $userDataDir ($ProfileDirectory)"
Write-Host "Keep this Chrome open while automation runs."

Start-Process -FilePath $chrome -ArgumentList @(
  "--remote-debugging-port=$Port",
  "--remote-allow-origins=*",
  "--user-data-dir=`"$userDataDir`"",
  "--profile-directory=$ProfileDirectory",
  "--no-first-run",
  "--no-default-browser-check",
  "https://chatgpt.com",
  "https://cursor.com/agents"
)

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-CdpReady) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  Write-Error @"
Chrome started but port $Port never opened.
Quit Chrome fully from Task Manager, then rerun:
  .\scripts\start-chrome.ps1
"@
  exit 1
}

Write-Host ""
Write-Host "CDP is ready at http://127.0.0.1:$Port"
Write-Host ""
Write-Host "SUCCESS. Next:"
Write-Host "  npm run check-login"
Write-Host "  npm start"
