# Start Chrome with remote debugging for GPT↔Cursor automation.
# Newer Chrome refuses remote debugging on the default profile directory, so we use
# a dedicated debug profile (seeded from your real Chrome profile).

param(
  [int]$Port = 9222,
  [string]$ProfileDirectory = "Default",
  [switch]$NoAutoQuit,
  [switch]$NoSyncProfile
)

$ErrorActionPreference = "Stop"

$chromePaths = @(
  "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
  "${env:PROGRAMFILES(X86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) {
  Write-Error "Google Chrome not found."
  exit 1
}

$realUserDataDir = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
$debugUserDataDir = if ($env:GPT_CURSOR_CHROME_DIR) {
  $env:GPT_CURSOR_CHROME_DIR
} else {
  Join-Path $env:USERPROFILE ".gpt-cursor-chrome"
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

function Sync-Profile {
  $srcProfile = Join-Path $realUserDataDir $ProfileDirectory
  $dstProfile = Join-Path $debugUserDataDir $ProfileDirectory

  if (-not (Test-Path $srcProfile)) {
    Write-Host "WARNING: Real Chrome profile not found at $srcProfile"
    New-Item -ItemType Directory -Force -Path $dstProfile | Out-Null
    return
  }

  Write-Host "Seeding debug profile from your Chrome profile..."
  Write-Host "  from: $srcProfile"
  Write-Host "  to:   $dstProfile"

  New-Item -ItemType Directory -Force -Path $debugUserDataDir | Out-Null
  $localState = Join-Path $realUserDataDir "Local State"
  if (Test-Path $localState) {
    Copy-Item $localState (Join-Path $debugUserDataDir "Local State") -Force
  }

  if (Test-Path $dstProfile) {
    Remove-Item $dstProfile -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $dstProfile | Out-Null

  # robocopy copies profile data; exit codes 0-7 are success-ish
  & robocopy $srcProfile $dstProfile /E /XD Cache "Code Cache" GPUCache DawnCache ShaderCache GrShaderCache "Service Worker\CacheStorage" /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  Get-ChildItem $dstProfile -Filter "Singleton*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $dstProfile "LockFile") -Force -ErrorAction SilentlyContinue
  Write-Host "Profile seed complete."
}

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
  Write-Host "Port $Port already has a CDP server. Reusing it."
  Write-Host "OK — now run: npm run check-login"
  exit 0
}

if (-not $NoSyncProfile) {
  Sync-Profile
} else {
  New-Item -ItemType Directory -Force -Path (Join-Path $debugUserDataDir $ProfileDirectory) | Out-Null
}

Write-Host "Starting debug Chrome with remote debugging on port $Port"
Write-Host "Debug profile: $debugUserDataDir"

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
  if (Test-CdpReady) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  Write-Error "Chrome started but port $Port never opened. Check whether antivirus blocked debugging."
  exit 1
}

Write-Host ""
Write-Host "CDP is ready at http://127.0.0.1:$Port"
Write-Host "SUCCESS. Next:"
Write-Host "  npm run check-login"
Write-Host "  npm start"
Write-Host "If this debug Chrome asks you to log in, do that once, then rerun check-login."
