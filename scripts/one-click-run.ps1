$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Ensure-Dependencies {
  $frontendNodeModules = Join-Path $root 'frontend\node_modules'
  $backendNodeModules = Join-Path $root 'backend\node_modules'

  if (-not (Test-Path -LiteralPath $frontendNodeModules) -or -not (Test-Path -LiteralPath $backendNodeModules)) {
    Write-Host 'Installing project dependencies...'
    & npm.cmd run install:all
    if ($LASTEXITCODE -ne 0) {
      throw 'Dependency installation failed.'
    }
  }
}

function Kill-PortProcess {
  param([int]$Port)
  $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
  if ($connections) {
    $uniquePids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $uniquePids) {
      $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
      if ($proc -and $proc.ProcessName -ne 'powershell') {
        Write-Host "Killing existing process $p on port $Port..."
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
      }
    }
  }
}

function Start-AppProcess {
  $command = "cd /d `"$root`" && npm.cmd run start"
  return Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $command -PassThru -WindowStyle Normal
}

function Wait-ForApp {
  $healthUrl = 'http://127.0.0.1:3001/health'

  for ($i = 0; $i -lt 60; $i++) {
    try {
      $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  return $false
}

Write-Host 'Checking for existing processes on port 3001...'
Kill-PortProcess -Port 3001

Ensure-Dependencies

Write-Host 'Starting project on localhost...'
$process = Start-AppProcess

if (Wait-ForApp) {
  Write-Host 'Opening browser at http://127.0.0.1:3001/portal'
  Start-Process 'http://127.0.0.1:3001/portal'
  exit 0
}

if ($process -and -not $process.HasExited) {
  Write-Host 'App process is running, but localhost did not respond in time.'
} else {
  Write-Host 'App process stopped before localhost became ready.'
}

exit 1
