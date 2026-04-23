Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RequiredSetting {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [string]$DefaultValue = ''
  )

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    if (-not [string]::IsNullOrWhiteSpace($DefaultValue)) {
      return $DefaultValue
    }

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

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$deployConfig = @{
  Host = Get-RequiredSetting 'DEPLOY_HOST' '203.0.113.2'
  Port = [int](Get-RequiredSetting 'DEPLOY_PORT' '2973')
  User = Get-RequiredSetting 'DEPLOY_USER' 'speed4you'
  Password = Get-RequiredSetting 'DEPLOY_PASSWORD' 'Speed##ftpsn'
  HostKey = Get-RequiredSetting 'DEPLOY_HOST_KEY' 'ssh-ed25519 255 SHA256:RVa4r61dsjHbh52j0eIllF0yCj6rJebnPKnj7x3JXco'
  RemoteFrontendPath = Get-RequiredSetting 'DEPLOY_REMOTE_FRONTEND_PATH' '/var/www/html/portal'
  RemoteBackendPath = Get-RequiredSetting 'DEPLOY_REMOTE_BACKEND_PATH' '/home/speed4you/portal-app/backend'
  RemotePidFile = Get-OptionalSetting 'DEPLOY_REMOTE_PID_FILE' '/home/speed4you/backend.pid'
  RemotePort = [int](Get-RequiredSetting 'DEPLOY_REMOTE_PORT' '4100')
  RemoteStagingBase = Get-OptionalSetting 'DEPLOY_REMOTE_STAGING_BASE' '/home/speed4you/portal-deploy-staging'
  RemoteBackupBase = Get-OptionalSetting 'DEPLOY_REMOTE_BACKUP_BASE' '/home/speed4you/portal-deploy-backups'
  SudoPassword = Get-RequiredSetting 'DEPLOY_SUDO_PASSWORD' 'Speed##ftpsn'
  RemoteServiceName = Get-OptionalSetting 'DEPLOY_REMOTE_SERVICE_NAME' 'isp-portal.service'
  RemoteCorsAllowedOrigins = Get-RequiredSetting 'DEPLOY_REMOTE_CORS_ALLOWED_ORIGINS' 'https://data.speed4you.net'
  RemotePlayerCacheRoot = Get-RequiredSetting 'DEPLOY_REMOTE_PLAYER_CACHE_ROOT' '/var/www/html/Extra_Storage/portal-media-cache'
  JwtSecret = Get-RequiredSetting 'DEPLOY_JWT_SECRET' 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef12'
  AdminUsername = Get-RequiredSetting 'DEPLOY_ADMIN_USERNAME' 'admin'
  AdminPasswordHash = Get-RequiredSetting 'DEPLOY_ADMIN_PASSWORD_HASH' '$2a$10$ejyljPiCt5J0tvO68DS99OnzyystXkHwgn9pN44txXcxGs/XLlKtK'
  PublicPortalUrl = Get-RequiredSetting 'DEPLOY_PUBLIC_PORTAL_URL' 'https://data.speed4you.net/portal'
  PublicApiUrl = Get-RequiredSetting 'DEPLOY_PUBLIC_API_URL' 'https://data.speed4you.net/portal-api/api/content/latest?limit=1'
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
JWT_SECRET=$($deployConfig.JwtSecret)
ADMIN_USERNAME=$($deployConfig.AdminUsername)
ADMIN_PASSWORD_HASH=$($deployConfig.AdminPasswordHash)
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

if ! grep -Eq '^[[:space:]]*JWT_SECRET=' '$($deployConfig.RemoteBackendPath)/.env'; then
  printf 'JWT_SECRET=$($deployConfig.JwtSecret)\n' >> '$($deployConfig.RemoteBackendPath)/.env'
  echo 'Added missing JWT_SECRET to remote .env'
fi

if ! grep -Eq '^[[:space:]]*ADMIN_USERNAME=' '$($deployConfig.RemoteBackendPath)/.env'; then
  printf 'ADMIN_USERNAME=$($deployConfig.AdminUsername)\n' >> '$($deployConfig.RemoteBackendPath)/.env'
  echo 'Added missing ADMIN_USERNAME to remote .env'
fi

if ! grep -Eq '^[[:space:]]*ADMIN_PASSWORD_HASH=' '$($deployConfig.RemoteBackendPath)/.env'; then
  printf 'ADMIN_PASSWORD_HASH=$($deployConfig.AdminPasswordHash)\n' >> '$($deployConfig.RemoteBackendPath)/.env'
  echo 'Added missing ADMIN_PASSWORD_HASH to remote .env'
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
cp -a "$STAGING_ROOT/backend/src" "$BACKEND_PATH/src"
if [ -d "$STAGING_ROOT/backend/scripts" ]; then
  cp -a "$STAGING_ROOT/backend/scripts" "$BACKEND_PATH/scripts"
fi

for file in catalog.json scanner-log.json scanner-roots.json scanner-runtime.json scanner-state.json; do
  if [ -f "$BACKUP_ROOT/backend-data/$file" ]; then
    cp -a "$BACKUP_ROOT/backend-data/$file" "$BACKEND_PATH/src/data/$file"
  fi
done

cd "$BACKEND_PATH"
npm ci --omit=dev

__REMOTE_ENV_WRITE__

if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" || true
    sleep 2
  fi
fi

if command -v fuser >/dev/null 2>&1; then
  fuser -k __REMOTE_PORT__/tcp || true
  sleep 2
fi

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "$SERVICE_NAME" >/dev/null 2>&1; then
  run_sudo systemctl daemon-reload
  run_sudo systemctl restart "$SERVICE_NAME"
  sleep 5
else
  pkill -f "portal-app/backend/src/index.js" || true
  nohup /usr/bin/node src/index.js > "$BACKEND_PATH/server.log" 2> "$BACKEND_PATH/server.err.log" < /dev/null &
  echo $! > "$PID_FILE"
  sleep 3
fi

HEALTH_OK=0
for attempt in 1 2 3 4 5; do
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

  sleep 2
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

Write-Host 'Verifying public site and API...'
try {
  $portalResponse = Invoke-WebRequest -Uri $deployConfig.PublicPortalUrl -UseBasicParsing -TimeoutSec 20
  $apiResponse = Invoke-WebRequest -Uri $deployConfig.PublicApiUrl -UseBasicParsing -TimeoutSec 20
  Write-Host "Portal status: $($portalResponse.StatusCode)"
  Write-Host "API status: $($apiResponse.StatusCode)"
} catch {
  throw "Deploy finished, but public verification failed: $($_.Exception.Message)"
}

Write-Host 'One-click deploy completed successfully.'
