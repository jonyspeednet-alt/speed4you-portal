# Generate SSH Key without Passphrase
# This script generates a new ED25519 SSH key without passphrase for automated deployment

Write-Host "🔑 Generating new SSH key without passphrase..." -ForegroundColor Cyan
Write-Host ""

# Backup old keys if they exist
if (Test-Path "deploy_key") {
    Write-Host "📦 Backing up old keys..." -ForegroundColor Yellow
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    Copy-Item "deploy_key" "deploy_key.backup-$timestamp"
    Copy-Item "deploy_key.pub" "deploy_key.pub.backup-$timestamp"
    Write-Host "✅ Backup created: deploy_key.backup-$timestamp" -ForegroundColor Green
    Write-Host ""
}

# Remove old keys
Write-Host "🗑️  Removing old keys..." -ForegroundColor Yellow
Remove-Item "deploy_key" -Force -ErrorAction SilentlyContinue
Remove-Item "deploy_key.pub" -Force -ErrorAction SilentlyContinue
Write-Host "✅ Old keys removed" -ForegroundColor Green
Write-Host ""

# Generate new key using ssh-keygen
Write-Host "⚙️  Generating new ED25519 key..." -ForegroundColor Yellow
Write-Host "Command: ssh-keygen -t ed25519 -f deploy_key -N '' -C 'github-deploy@speed4you'" -ForegroundColor Gray
Write-Host ""

# Run ssh-keygen
ssh-keygen -t ed25519 -f deploy_key -N '' -C 'github-deploy@speed4you' 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ SSH key generated successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Display key info
    Write-Host "📋 Key Information:" -ForegroundColor Cyan
    Write-Host ""
    
    # Get key fingerprint
    Write-Host "Fingerprint:" -ForegroundColor Yellow
    ssh-keygen -l -f deploy_key
    Write-Host ""
    
    # Display public key
    Write-Host "Public Key (deploy_key.pub):" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Get-Content "deploy_key.pub"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host ""
    
    # Display private key (first and last few lines)
    Write-Host "Private Key (deploy_key) - First 3 lines:" -ForegroundColor Yellow
    Get-Content "deploy_key" -TotalCount 3
    Write-Host "..." -ForegroundColor Gray
    Write-Host "Private Key (deploy_key) - Last 2 lines:" -ForegroundColor Yellow
    Get-Content "deploy_key" | Select-Object -Last 2
    Write-Host ""
    
    # Check file permissions
    Write-Host "📁 File Permissions:" -ForegroundColor Cyan
    Get-Item "deploy_key" | Select-Object -Property FullName, Length, LastWriteTime
    Get-Item "deploy_key.pub" | Select-Object -Property FullName, Length, LastWriteTime
    Write-Host ""
    
    Write-Host "✨ Next Steps:" -ForegroundColor Green
    Write-Host "1️⃣  Copy public key content (above) to server ~/.ssh/authorized_keys" -ForegroundColor White
    Write-Host "2️⃣  Update GitHub secret DEPLOY_SSH_KEY with private key content" -ForegroundColor White
    Write-Host "3️⃣  Test connection: ssh -i deploy_key -p 2973 speed4you@203.0.113.2 'echo OK'" -ForegroundColor White
    Write-Host ""
    
} else {
    Write-Host ""
    Write-Host "❌ SSH key generation failed!" -ForegroundColor Red
    Write-Host "Please check if ssh-keygen is installed and available in PATH" -ForegroundColor Red
}
