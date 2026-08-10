# Start Chrome with remote debugging so the automation can reuse your logged-in profile.
# Close ALL Chrome windows first, then run this script.

param(
  [int]$Port = 9222,
  [string]$ProfileDirectory = "Default"
)

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
Write-Host "Starting Chrome with remote debugging on port $Port"
Write-Host "Profile: $userDataDir ($ProfileDirectory)"
Write-Host "Close this Chrome window only when automation is finished."

Start-Process -FilePath $chrome -ArgumentList @(
  "--remote-debugging-port=$Port",
  "--user-data-dir=`"$userDataDir`"",
  "--profile-directory=$ProfileDirectory",
  "--no-first-run",
  "--no-default-browser-check",
  "https://chatgpt.com",
  "https://cursor.com/agents"
)
