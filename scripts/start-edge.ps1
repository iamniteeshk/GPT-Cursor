# Start Microsoft Edge with remote debugging for GPT-Cursor automation (Windows / NUC).
# Uses a copy of your existing Edge profile in %USERPROFILE%\.gpt-cursor-edge
# (Edge blocks remote debugging on the default profile directory).

param(
  [int]$Port = 9222,
  [string]$ProfileDirectory = "Default",
  [switch]$NoAutoQuit,
  [switch]$NoSyncProfile
)

$ErrorActionPreference = "Stop"

function Find-Edge {
  $paths = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
  )
  foreach ($p in $paths) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Test-EdgeRunning {
  return $null -ne (Get-Process -Name "msedge" -ErrorAction SilentlyContinue)
}

function Test-CdpReady {
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json/version" -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

$edge = Find-Edge
if (-not $edge) {
  Write-Error @"
Microsoft Edge not found.
Install/repair Edge, then rerun this script.
"@
  exit 1
}

$realUserDataDir = Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data"
$debugUserDataDir = if ($env:GPT_CURSOR_BROWSER_DIR) {
  $env:GPT_CURSOR_BROWSER_DIR
} elseif ($env:GPT_CURSOR_CHROME_DIR) {
  $env:GPT_CURSOR_CHROME_DIR
} else {
  Join-Path $env:USERPROFILE ".gpt-cursor-edge"
}

Write-Host "Edge: $edge"
Write-Host "Real profile:  $realUserDataDir"
Write-Host "Debug profile: $debugUserDataDir"

if (Test-EdgeRunning) {
  if ($NoAutoQuit) {
    Write-Error "Edge is already running. Quit it fully, then rerun."
    exit 1
  }
  Write-Host "Quitting existing Edge..."
  Get-Process -Name "msedge" -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 2
  if (Test-EdgeRunning) {
    Write-Error "Edge is still running. End msedge.exe in Task Manager, then rerun."
    exit 1
  }
}

if (Test-CdpReady) {
  Write-Host "Port $Port already has CDP. OK - run: npm start"
  exit 0
}

if (-not $NoSyncProfile) {
  $srcProfile = Join-Path $realUserDataDir $ProfileDirectory
  $dstProfile = Join-Path $debugUserDataDir $ProfileDirectory
  New-Item -ItemType Directory -Force -Path $debugUserDataDir | Out-Null
  if (Test-Path $srcProfile) {
    Write-Host "Seeding debug profile from your Edge profile..."
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
    Write-Host "No existing Edge profile found. A fresh debug profile will be used."
    Write-Host "Log into ChatGPT + Cursor once in the debug Edge window."
    New-Item -ItemType Directory -Force -Path $dstProfile | Out-Null
  }
}

Write-Host "Starting debug Edge on port $Port ..."
Start-Process -FilePath $edge -ArgumentList @(
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
  Write-Error "Edge started but port $Port never opened."
  exit 1
}

Write-Host ""
Write-Host "CDP is ready at http://127.0.0.1:$Port"
Write-Host "SUCCESS. Next:"
Write-Host "  npm start"
Write-Host "You will be asked for GPT + Cursor links in the terminal."
Write-Host "If ChatGPT/Cursor ask you to log in in this Edge window, log in once."
