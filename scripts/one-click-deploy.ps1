Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Import-EnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return $false
  }

  foreach ($rawLine in Get-Content -LiteralPath $Path) {
    $line = $rawLine.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
      continue
    }

    $separatorIndex = $line.IndexOf('=')
    if ($separatorIndex -lt 1) {
      continue
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }

  return $true
}

function Initialize-DeploySettings {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
  )

  $searchRoots = [System.Collections.Generic.List[string]]::new()
  $searchRoots.Add($ProjectRoot)

  $parent = Split-Path -Parent $ProjectRoot
  while (-not [string]::IsNullOrWhiteSpace($parent) -and $parent -ne $ProjectRoot) {
    if (Test-Path -LiteralPath (Join-Path $parent '.git')) {
      $searchRoots.Add($parent)
      break
    }

    $ProjectRoot = $parent
    $parent = Split-Path -Parent $ProjectRoot
  }

  foreach ($searchRoot in $searchRoots) {
    $candidatePaths = @(
      (Join-Path $searchRoot '.env.deploy.local'),
      (Join-Path $searchRoot '.env.deploy'),
      (Join-Path $searchRoot 'backend\.env.deploy'),
      (Join-Path $searchRoot 'backend\.env.deploy.local')
    )

    foreach ($candidatePath in $candidatePaths) {
      if (Import-EnvFile -Path $candidatePath) {
        Write-Host "Loaded deploy settings from $candidatePath"
        return
      }
    }
  }
}

function Get-RequiredSetting {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required environment variable: $Name"
  }

  return $value
}

function Get-OptionalSetting {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$DefaultValue
  )

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $DefaultValue
  }

  return $value
}

function Get-DefaultPublicHealthUrl {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PortalUrl
  )

  try {
    $portalUri = [Uri]$PortalUrl
    return "$($portalUri.Scheme)://$($portalUri.Authority)/portal-api/health"
  } catch {
    throw "Could not derive DEPLOY_PUBLIC_HEALTH_URL from DEPLOY_PUBLIC_PORTAL_URL: $PortalUrl"
  }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
Initialize-DeploySettings -ProjectRoot $projectRoot

$deployConfig = @{
  Host = Get-RequiredSetting 'DEPLOY_HOST'
  Port = [int](Get-RequiredSetting 'DEPLOY_PORT')
  User = Get-RequiredSetting 'DEPLOY_USER'
  Password = Get-RequiredSetting 'DEPLOY_PASSWORD'
  HostKey = Get-RequiredSetting 'DEPLOY_HOST_KEY'
  RemoteFrontendPath = Get-RequiredSetting 'DEPLOY_REMOTE_FRONTEND_PATH'
  RemoteBackendPath = Get-RequiredSetting 'DEPLOY_REMOTE_BACKEND_PATH'
  RemotePidFile = Get-OptionalSetting 'DEPLOY_REMOTE_PID_FILE' '/home/deploy/backend.pid'
  RemotePort = [int](Get-RequiredSetting 'DEPLOY_REMOTE_PORT')
  RemoteStagingBase = Get-OptionalSetting 'DEPLOY_REMOTE_STAGING_BASE' '/home/deploy/portal-deploy-staging'
  RemoteBackupBase = Get-OptionalSetting 'DEPLOY_REMOTE_BACKUP_BASE' '/home/deploy/portal-deploy-backups'
  SudoPassword = Get-RequiredSetting 'DEPLOY_SUDO_PASSWORD'
  RemoteServiceName = Get-OptionalSetting 'DEPLOY_REMOTE_SERVICE_NAME' 'isp-portal.service'
  RemoteCorsAllowedOrigins = Get-RequiredSetting 'DEPLOY_REMOTE_CORS_ALLOWED_ORIGINS'
  RemotePlayerCacheRoot = Get-RequiredSetting 'DEPLOY_REMOTE_PLAYER_CACHE_ROOT'
  PublicPortalUrl = Get-RequiredSetting 'DEPLOY_PUBLIC_PORTAL_URL'
  PublicHealthUrl = Get-OptionalSetting 'DEPLOY_PUBLIC_HEALTH_URL' (Get-DefaultPublicHealthUrl -PortalUrl (Get-RequiredSetting 'DEPLOY_PUBLIC_PORTAL_URL'))
}

$plink = 'C:\Program Files\PuTTY\plink.exe'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'

function Invoke-RemoteCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  $normalizedCommand = $Command -replace "`r`n", "`n" -replace "`r", "`n"
  $tempScriptPath = [System.IO.Path]::GetTempFileName()

  try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tempScriptPath, $normalizedCommand, $utf8NoBom)

    & $plink `
      -batch `
      -hostkey $deployConfig.HostKey `
      -P $deployConfig.Port `
      -pw $deployConfig.Password `
      -m $tempScriptPath `
      "$($deployConfig.User)@$($deployConfig.Host)"

    if ($LASTEXITCODE -ne 0) {
      throw "Remote command failed: $Command"
    }
  } finally {
    if (Test-Path $tempScriptPath) {
      Remove-Item -LiteralPath $tempScriptPath -Force -ErrorAction SilentlyContinue
    }
  }
}

function Copy-ToRemote {
  param(
    [Parameter(Mandatory = $true)]
    [string]$LocalPath,
    [Parameter(Mandatory = $true)]
    [string]$RemotePath
  )

  & $pscp `
    -batch `
    -r `
    -hostkey $deployConfig.HostKey `
    -P $deployConfig.Port `
    -pw $deployConfig.Password `
    $LocalPath `
    "$($deployConfig.User)@$($deployConfig.Host):$RemotePath"

  if ($LASTEXITCODE -ne 0) {
    throw "Upload failed for $LocalPath"
  }
}

function Invoke-WebRequestWithRetry {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [int]$MaxAttempts = 5,
    [int]$TimeoutSec = 20
  )

  $attempt = 0
  $lastError = $null

  while ($attempt -lt $MaxAttempts) {
    $attempt++

    try {
      return Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec $TimeoutSec
    } catch {
      $lastError = $_
      $response = $_.Exception.Response
      $statusCode = $null
      $retryAfter = $null

      if ($response) {
        try {
          $statusCode = [int]$response.StatusCode
        } catch {
          $statusCode = $null
        }

        try {
          $retryAfterHeader = $response.Headers['Retry-After']
          if ($retryAfterHeader) {
            $retryAfter = [int]$retryAfterHeader
          }
        } catch {
          $retryAfter = $null
        }
      }

      $isRetryable = $statusCode -in @(429, 500, 502, 503, 504)
      if (-not $isRetryable -or $attempt -ge $MaxAttempts) {
        throw
      }

      $sleepSeconds = if ($retryAfter -and $retryAfter -gt 0) {
        [Math]::Min($retryAfter, 30)
      } else {
        [Math]::Min(5 * $attempt, 15)
      }

      Write-Host "Verification for $Uri returned status $statusCode. Retrying in $sleepSeconds seconds... (attempt $attempt/$MaxAttempts)"
      Start-Sleep -Seconds $sleepSeconds
    }
  }

  if ($lastError) {
    throw $lastError
  }
}

Write-Host 'Building frontend...'
Push-Location (Join-Path $projectRoot 'frontend')
npm run build
if ($LASTEXITCODE -ne 0) {
  throw 'Frontend build failed.'
}
Pop-Location

Write-Host 'Preparing deploy package...'
node (Join-Path $projectRoot 'scripts\prepare-deploy.cjs')
if ($LASTEXITCODE -ne 0) {
  throw 'Deploy package preparation failed.'
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stagingRoot = "$($deployConfig.RemoteStagingBase)/$timestamp"
$remoteDistPath = "$stagingRoot/dist"
$remoteBackendUploadPath = "$stagingRoot/backend"
$localDistPath = Join-Path $projectRoot 'server-deploy\frontend\dist'
$localBackendPath = Join-Path $projectRoot 'server-deploy\backend'
$localDeployEnvPath = Join-Path $projectRoot 'backend\.env.deploy'

Write-Host 'Creating remote staging folders...'
Invoke-RemoteCommand "mkdir -p '$stagingRoot'"

Write-Host 'Uploading frontend bundle...'
Copy-ToRemote -LocalPath $localDistPath -RemotePath $stagingRoot

Write-Host 'Uploading backend package...'
Copy-ToRemote -LocalPath $localBackendPath -RemotePath $stagingRoot

$remoteEnvWrite = @"
if [ -f '$($deployConfig.RemoteBackendPath)/.env' ]; then
  echo 'Keeping existing remote .env'
else
  cat > '$($deployConfig.RemoteBackendPath)/.env' <<'EOF'
PORT=$($deployConfig.RemotePort)
CORS_ALLOWED_ORIGINS=$($deployConfig.RemoteCorsAllowedOrigins)
PLAYER_CACHE_ROOT=$($deployConfig.RemotePlayerCacheRoot)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=isp_entertainment
DB_USER=postgres
DB_PASSWORD=postgres
EOF
fi

if ! grep -Eq '^[[:space:]]*CORS_ALLOWED_ORIGINS=' '$($deployConfig.RemoteBackendPath)/.env'; then
  printf '\nCORS_ALLOWED_ORIGINS=$($deployConfig.RemoteCorsAllowedOrigins)\n' >> '$($deployConfig.RemoteBackendPath)/.env'
  echo 'Added missing CORS_ALLOWED_ORIGINS to remote .env'
fi

if ! grep -Eq '^[[:space:]]*PLAYER_CACHE_ROOT=' '$($deployConfig.RemoteBackendPath)/.env'; then
  printf 'PLAYER_CACHE_ROOT=$($deployConfig.RemotePlayerCacheRoot)\n' >> '$($deployConfig.RemoteBackendPath)/.env'
  echo 'Added missing PLAYER_CACHE_ROOT to remote .env'
fi

if ! grep -Eq '^[[:space:]]*FFMPEG_PATH=' '$($deployConfig.RemoteBackendPath)/.env'; then
  printf 'FFMPEG_PATH=/usr/bin/ffmpeg\n' >> '$($deployConfig.RemoteBackendPath)/.env'
  echo 'Added missing FFMPEG_PATH to remote .env'
fi

if ! grep -Eq '^[[:space:]]*FFPROBE_PATH=' '$($deployConfig.RemoteBackendPath)/.env'; then
  printf 'FFPROBE_PATH=/usr/bin/ffprobe\n' >> '$($deployConfig.RemoteBackendPath)/.env'
  echo 'Added missing FFPROBE_PATH to remote .env'
fi

if ! grep -Eq '^[[:space:]]*DB_HOST=' '$($deployConfig.RemoteBackendPath)/.env'; then
  printf 'DB_HOST=localhost\n' >> '$($deployConfig.RemoteBackendPath)/.env'
  echo 'Added missing DB_HOST to remote .env'
fi

if ! grep -Eq '^[[:space:]]*DB_PORT=' '$($deployConfig.RemoteBackendPath)/.env'; then
  printf 'DB_PORT=5432\n' >> '$($deployConfig.RemoteBackendPath)/.env'
  echo 'Added missing DB_PORT to remote .env'
fi

if ! grep -Eq '^[[:space:]]*DB_NAME=' '$($deployConfig.RemoteBackendPath)/.env'; then
  printf 'DB_NAME=isp_entertainment\n' >> '$($deployConfig.RemoteBackendPath)/.env'
  echo 'Added missing DB_NAME to remote .env'
fi

if ! grep -Eq '^[[:space:]]*DB_USER=' '$($deployConfig.RemoteBackendPath)/.env'; then
  printf 'DB_USER=postgres\n' >> '$($deployConfig.RemoteBackendPath)/.env'
  echo 'Added missing DB_USER to remote .env'
fi

if ! grep -Eq '^[[:space:]]*DB_PASSWORD=' '$($deployConfig.RemoteBackendPath)/.env'; then
  printf 'DB_PASSWORD=postgres\n' >> '$($deployConfig.RemoteBackendPath)/.env'
  echo 'Added missing DB_PASSWORD to remote .env'
fi
"@
if (Test-Path $localDeployEnvPath) {
  $deployEnvContent = Get-Content $localDeployEnvPath -Raw
  $remoteEnvWrite = @"
cat > '$($deployConfig.RemoteBackendPath)/.env' <<'EOF'
$deployEnvContent
EOF
"@
}

$remoteScript = @'
set -e
BACKEND_PATH='__REMOTE_BACKEND_PATH__'
FRONTEND_PATH='__REMOTE_FRONTEND_PATH__'
PID_FILE='__REMOTE_PID_FILE__'
BACKUP_BASE='__REMOTE_BACKUP_BASE__'
STAGING_ROOT='__REMOTE_STAGING_ROOT__'
BACKUP_ROOT="__REMOTE_BACKUP_BASE__/__TIMESTAMP__"
SUDO_PASSWORD='__SUDO_PASSWORD__'
SERVICE_NAME='__REMOTE_SERVICE_NAME__'

run_sudo() {
  printf '%s\n' "$SUDO_PASSWORD" | sudo -S -p '' "$@"
}

resolve_service_name() {
  for candidate in "$SERVICE_NAME" 'isp-portal-backend.service' 'isp-portal-backend' 'isp-portal.service' 'isp-portal'; do
    if [ -n "$candidate" ] && systemctl list-unit-files --type=service --all 2>/dev/null | grep -Fq "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

wait_for_port_release() {
  for _ in $(seq 1 20); do
    if command -v ss >/dev/null 2>&1; then
      if ! run_sudo ss -ltnp "( sport = :__REMOTE_PORT__ )" 2>/dev/null | grep -q ":__REMOTE_PORT__"; then
        return 0
      fi
    elif command -v lsof >/dev/null 2>&1; then
      if ! run_sudo lsof -iTCP:__REMOTE_PORT__ -sTCP:LISTEN >/dev/null 2>&1; then
        return 0
      fi
    else
      sleep 1
      return 0
    fi

    sleep 1
  done

  return 1
}

stop_backend_processes() {
  if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
      kill "$OLD_PID" || true
      sleep 2
      kill -9 "$OLD_PID" 2>/dev/null || true
    fi
  fi

  if command -v fuser >/dev/null 2>&1; then
    run_sudo fuser -k __REMOTE_PORT__/tcp || true
  elif command -v lsof >/dev/null 2>&1; then
    PORT_PIDS=$(run_sudo lsof -t -iTCP:__REMOTE_PORT__ -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$PORT_PIDS" ]; then
      run_sudo kill $PORT_PIDS || true
      sleep 2
      run_sudo kill -9 $PORT_PIDS || true
    fi
  fi

  wait_for_port_release || true
}

print_service_diagnostics() {
  SERVICE_TO_REPORT="$1"
  if [ -z "$SERVICE_TO_REPORT" ]; then
    return 0
  fi

  echo "=== systemctl status ($SERVICE_TO_REPORT) ===" >&2
  run_sudo systemctl status "$SERVICE_TO_REPORT" --no-pager -l >&2 || true

  echo "=== journalctl ($SERVICE_TO_REPORT, last 50 lines) ===" >&2
  run_sudo journalctl -u "$SERVICE_TO_REPORT" --no-pager -n 50 >&2 || true
}

mkdir -p "$BACKUP_ROOT/frontend" "$BACKUP_ROOT/backend-data"

if [ -d "$FRONTEND_PATH" ]; then
  run_sudo cp -r "$FRONTEND_PATH/." "$BACKUP_ROOT/frontend/" || true
fi

for file in catalog.json scanner-log.json scanner-roots.json scanner-runtime.json scanner-state.json; do
  if [ -f "$BACKEND_PATH/src/data/$file" ]; then
    cp -a "$BACKEND_PATH/src/data/$file" "$BACKUP_ROOT/backend-data/$file"
  fi
done

run_sudo mkdir -p "$FRONTEND_PATH"
run_sudo find "$FRONTEND_PATH" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
run_sudo cp -r "$STAGING_ROOT/dist/." "$FRONTEND_PATH/"
run_sudo chown -R www-data:www-data "$FRONTEND_PATH"

mkdir -p "$BACKEND_PATH"
cp "$STAGING_ROOT/backend/package.json" "$BACKEND_PATH/package.json"
cp "$STAGING_ROOT/backend/package-lock.json" "$BACKEND_PATH/package-lock.json"
rm -rf "$BACKEND_PATH/src"
rm -rf "$BACKEND_PATH/scripts"
rm -rf "$BACKEND_PATH/migrations"
cp -a "$STAGING_ROOT/backend/src" "$BACKEND_PATH/src"
if [ -d "$STAGING_ROOT/backend/scripts" ]; then
  cp -a "$STAGING_ROOT/backend/scripts" "$BACKEND_PATH/scripts"
fi
if [ -d "$STAGING_ROOT/backend/migrations" ]; then
  cp -a "$STAGING_ROOT/backend/migrations" "$BACKEND_PATH/migrations"
fi

for file in catalog.json scanner-log.json scanner-roots.json scanner-runtime.json scanner-state.json; do
  if [ -f "$BACKUP_ROOT/backend-data/$file" ]; then
    cp -a "$BACKUP_ROOT/backend-data/$file" "$BACKEND_PATH/src/data/$file"
  fi
done

cd "$BACKEND_PATH"
npm ci --omit=dev

__REMOTE_ENV_WRITE__

stop_backend_processes

if command -v systemctl >/dev/null 2>&1; then
  RESOLVED_SERVICE_NAME=$(resolve_service_name || true)
else
  RESOLVED_SERVICE_NAME=''
fi

if [ -n "$RESOLVED_SERVICE_NAME" ]; then
  run_sudo systemctl daemon-reload
  run_sudo systemctl stop "$RESOLVED_SERVICE_NAME" || true
  stop_backend_processes
  if ! run_sudo systemctl start "$RESOLVED_SERVICE_NAME"; then
    print_service_diagnostics "$RESOLVED_SERVICE_NAME"
    exit 1
  fi
  sleep 5
else
  stop_backend_processes
  nohup /usr/bin/node src/index.js > "$BACKEND_PATH/server.log" 2> "$BACKEND_PATH/server.err.log" < /dev/null &
  echo $! > "$PID_FILE"
  sleep 5
fi

HEALTH_OK=0
for attempt in $(seq 1 60); do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS http://127.0.0.1:__REMOTE_PORT__/health; then
      HEALTH_OK=1
      break
    fi
  else
    if wget -qO- http://127.0.0.1:__REMOTE_PORT__/health; then
      HEALTH_OK=1
      break
    fi
  fi

  echo "Waiting for backend to start (attempt $attempt/60)..."
  sleep 3
done

if [ "$HEALTH_OK" -ne 1 ]; then
  echo "Backend health check failed after restart." >&2
  echo "=== Server error log (last 20 lines) ===" >&2
  tail -20 "$BACKEND_PATH/server.err.log" 2>/dev/null || echo "No error log found" >&2
  echo "=== Server output log (last 20 lines) ===" >&2
  tail -20 "$BACKEND_PATH/server.log" 2>/dev/null || echo "No output log found" >&2
  exit 1
fi

rm -rf "$STAGING_ROOT"
'@

$remoteScript = $remoteScript.Replace('__REMOTE_BACKEND_PATH__', $deployConfig.RemoteBackendPath)
$remoteScript = $remoteScript.Replace('__REMOTE_FRONTEND_PATH__', $deployConfig.RemoteFrontendPath)
$remoteScript = $remoteScript.Replace('__REMOTE_PID_FILE__', $deployConfig.RemotePidFile)
$remoteScript = $remoteScript.Replace('__REMOTE_BACKUP_BASE__', $deployConfig.RemoteBackupBase)
$remoteScript = $remoteScript.Replace('__REMOTE_STAGING_ROOT__', $stagingRoot)
$remoteScript = $remoteScript.Replace('__REMOTE_PORT__', [string]$deployConfig.RemotePort)
$remoteScript = $remoteScript.Replace('__TIMESTAMP__', $timestamp)
$remoteScript = $remoteScript.Replace('__SUDO_PASSWORD__', $deployConfig.SudoPassword)
$remoteScript = $remoteScript.Replace('__REMOTE_SERVICE_NAME__', $deployConfig.RemoteServiceName)
$remoteScript = $remoteScript.Replace('__REMOTE_ENV_WRITE__', $remoteEnvWrite)

Write-Host 'Applying release and restarting backend...'
Invoke-RemoteCommand $remoteScript

Write-Host 'Verifying public site and backend health...'
try {
  $portalResponse = Invoke-WebRequestWithRetry -Uri $deployConfig.PublicPortalUrl
  $healthResponse = Invoke-WebRequestWithRetry -Uri $deployConfig.PublicHealthUrl
  Write-Host "Portal status: $($portalResponse.StatusCode)"
  Write-Host "Health status: $($healthResponse.StatusCode)"
} catch {
  throw "Deploy finished, but public verification failed: $($_.Exception.Message)"
}

Write-Host 'One-click deploy completed successfully.'
