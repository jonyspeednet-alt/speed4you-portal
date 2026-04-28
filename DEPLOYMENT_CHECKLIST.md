# Automated Deployment Setup Checklist

## ✅ কী করা হয়েছে:
- [x] GitHub Actions workflow updated (`deploy.yml`)
- [x] Server details configured (203.0.113.2:2973)
- [x] SSH key pair ready (deploy_key)
- [x] Setup scripts created

## 📋 এখন আপনাকে করতে হবে:

### Step 1: Server-এ SSH Key Setup করুন
আপনার server-এ (Putty দিয়ে) এই command run করুন:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat >> ~/.ssh/authorized_keys << 'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKJOmk9rXcDxfUS+rUYAOfldhRPNDYLFEiiTwMa1AdKs \isp-entertainment-deploy\
EOF
chmod 600 ~/.ssh/authorized_keys
```

### Step 2: GitHub Repository Settings এ Secrets যোগ করুন

GitHub → Your Repository → Settings → Secrets and variables → Actions

এই secrets যোগ করুন:

| Secret Name | Value |
|---|---|
| `DEPLOY_HOST` | `203.0.113.2` |
| `DEPLOY_PORT` | `2973` |
| `DEPLOY_USER` | `speed4you` |
| `DEPLOY_SSH_KEY` | (deploy_key file এর content - নিচে দেখুন) |
| `DEPLOY_SUDO_PASSWORD` | `Speed##ftpsn` |
| `DEPLOY_ENV_FILE_CONTENT` | আপনার backend .env file এর content |
| `DEPLOY_REMOTE_CORS_ALLOWED_ORIGINS` | `https://data.speed4you.net` |
| `DEPLOY_REMOTE_PLAYER_CACHE_ROOT` | `/home/speed4you/cache` |

### DEPLOY_SSH_KEY এর Value:
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABAM3Jl+fC
hUViLkUGtgFO3KAAAAGAAAAAEAAAAzAAAAC3NzaC1lZDI1NTE5AAAAIKJOmk9rXcDxfUS+
rUYAOfldhRPNDYLFEiiTwMa1AdKsAAAAoM2ASat6k+yN/Xf4+Iw/bCMKUBOg2hnRoJYlwd
MBmtxdzrQdx2/bZPvfNtEiHin+2A1illIBaylKKsultL7PV7RVtdTaBl4+Pqplxtk5EO/3
92YDpl4/qSkgYoTWgpBrFa86qlLDSz97fOGOTgVvwq72xrJU6LMghyJwxIuyuJm6uyUPF2
8dPrWtzlJ2zKF2/vYfWS98uznLNdSwdDZg1qc=
-----END OPENSSH PRIVATE KEY-----
```

### Step 3: Server-এ Deployment Directories তৈরি করুন

```bash
mkdir -p /home/speed4you/portal-deploy-staging
mkdir -p /home/speed4you/backups
mkdir -p /home/speed4you/cache
chmod 755 /home/speed4you/portal-deploy-staging
chmod 755 /home/speed4you/backups
chmod 755 /home/speed4you/cache
```

### Step 4: Test করুন

```bash
# Local machine থেকে SSH test করুন
ssh -i deploy_key -p 2973 speed4you@203.0.113.2 "echo 'SSH Connection Successful!'"
```

### Step 5: Deploy করুন

```bash
git add .
git commit -m "Setup automated deployment"
git push origin main
```

এরপর GitHub → Actions tab-এ গিয়ে deployment status দেখুন।

## 🔍 Troubleshooting:

### SSH Connection Failed?
- Server-এ SSH key properly add হয়েছে কিনা check করুন
- Port 2973 open আছে কিনা check করুন
- Firewall settings check করুন

### Deployment Failed?
- GitHub Actions logs দেখুন (Actions tab)
- Server-এ directories exist করে কিনা check করুন
- .env file content properly set আছে কিনা check করুন

### Deploy Script Not Found?
- `scripts/deploy.sh` file exist করে কিনা check করুন
- `scripts/prepare-deploy.cjs` file exist করে কিনা check করুন

## 📊 Deployment Flow:

```
GitHub Push (main branch)
    ↓
GitHub Actions Triggered
    ↓
Build Frontend (npm install + npm run build)
    ↓
Prepare Deployment Package
    ↓
Copy Files to Server (SCP)
    ↓
Execute Deploy Script on Server
    ↓
Service Restart
    ↓
Live at https://data.speed4you.net/portal/
```

## ✨ এরপর:
প্রতিবার আপনি `main` branch-এ push করলে স্বয়ংক্রিয়ভাবে deploy হবে!
