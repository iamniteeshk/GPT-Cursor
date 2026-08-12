# Start Chrome with remote debugging for GPT↔Cursor automation (Windows / NUC).
# Newer Chrome requires a NON-default user-data-dir for remote debugging.

param(
  [int]$Port = 9222,
  [string]$ProfileDirectory = "Default",
  [switch]$NoAutoQuit,
  [switch]$NoSyncProfile
)

$ErrorActionPreference = "Stop"

function Find-Chrome {
  $paths = @(
    "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
    "${env:PROGRAMFILES(X86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )
  foreach ($p in $paths) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

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

$chrome = Find-Chrome
if (-not $chrome) {
  Write-Error @"
Google Chrome not found.
Install Chrome first: https://www.google.com/chrome/
Then rerun this script.
"@
  exit 1
}

$realUserDataDir = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
$debugUserDataDir = if ($env:GPT_CURSOR_CHROME_DIR) {
  $env:GPT_CURSOR_CHROME_DIR
} else {
  Join-Path $env:USERPROFILE ".gpt-cursor-chrome"
}

Write-Host "Chrome: $chrome"
Write-Host "Real profile:  $realUserDataDir"
Write-Host "Debug profile: $debugUserDataDir"

if (Test-ChromeRunning) {
  if ($NoAutoQuit) {
    Write-Error "Chrome is already running. Quit it fully, then rerun."
    exit 1
  }
  Write-Host "Quitting existing Chrome..."
  Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 2
  if (Test-ChromeRunning) {
    Write-Error "Chrome is still running. End chrome.exe in Task Manager, then rerun."
    exit 1
  }
}

if (Test-CdpReady) {
  Write-Host "Port $Port already has CDP. OK — run: npm start"
  exit 0
}

if (-not $NoSyncProfile) {
  $srcProfile = Join-Path $realUserDataDir $ProfileDirectory
  $dstProfile = Join-Path $debugUserDataDir $ProfileDirectory
  New-Item -ItemType Directory -Force -Path $debugUserDataDir | Out-Null
  if (Test-Path $srcProfile) {
    Write-Host "Seeding debug profile from your Chrome profile..."
    $localState = Join-Path $realUserDataDir "Local State"
    if (Test-Path $localState) {
      Copy-Item $localState (Join-Path $debugUserDataDir "Local State") -Force
    }
    if (Test-Path $dstProfile) { Remove-Item $dstProfile -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $dstProfile | Out-Null
    & robocopy $srcProfile $dstProfile /E /XD Cache "Code Cache" GPUCache DawnCache ShaderCache GrShaderCache "Service Worker\CacheStorage" /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    Get-ChildItem $dstProfile -Filter "Singleton*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $dstProfile "LockFile") -Force -ErrorAction SilentlyContinue
    Write-Host "Profile seed complete."
  } else {
    Write-Host "No existing Chrome profile found. A fresh debug profile will be used."
    Write-Host "Log into ChatGPT + Cursor once in the debug Chrome window."
    New-Item -ItemType Directory -Force -Path $dstProfile | Out-Null
  }
}

Write-Host "Starting debug Chrome on port $Port ..."
Start-Process -FilePath $chrome -ArgumentList @(
  "--remote-debugging-port=$Port",
  "--remote-allow-origins=*",
  "--user-data-dir=`"$debugUserDataDir`"",
  "--profile-directory=$ProfileDirectory",
  "--no-first-run",
  "--no-default-browser-check",
  "https://chatgpt.com",
  "https://cursor.com/agents"
)

$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-CdpReady) { $ready = $true; break }
}

if (-not $ready) {
  Write-Error "Chrome started but port $Port never opened."
  exit 1
}

Write-Host ""
Write-Host "CDP is ready at http://127.0.0.1:$Port"
Write-Host "SUCCESS. Next:"
Write-Host "  npm start"
Write-Host "You will be asked for GPT + Cursor links in the terminal."
