# GitHub Secrets Setup Guide

আপনার GitHub repository-তে এই secrets যোগ করুন:

## Steps:
1. GitHub repository যান → Settings → Secrets and variables → Actions
2. "New repository secret" ক্লিক করুন
3. নিচের secrets যোগ করুন:

## Required Secrets:

### DEPLOY_HOST
```
203.0.113.2
```

### DEPLOY_PORT
```
2973
```

### DEPLOY_USER
```
speed4you
```

### DEPLOY_SSH_KEY
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

### DEPLOY_ENV_FILE_CONTENT
আপনার backend এর .env file এর content (যেমন database URL, API keys ইত্যাদি)

### DEPLOY_SUDO_PASSWORD
```
Speed##ftpsn
```

### DEPLOY_REMOTE_CORS_ALLOWED_ORIGINS
```
https://data.speed4you.net
```

### DEPLOY_REMOTE_PLAYER_CACHE_ROOT
```
/home/speed4you/cache
```

## Environment Variables (Workflow file এ set করা আছে):
- DEPLOY_REMOTE_BACKEND_PATH: /home/speed4you/backend
- DEPLOY_REMOTE_FRONTEND_PATH: /home/speed4you/frontend
- DEPLOY_REMOTE_PID_FILE: /home/speed4you/backend.pid
- DEPLOY_REMOTE_BACKUP_BASE: /home/speed4you/backups
- DEPLOY_REMOTE_SERVICE_NAME: speed4you-portal.service
- DEPLOY_REMOTE_PORT: 5000

## কীভাবে কাজ করবে:
1. আপনি `main` branch-এ code push করবেন
2. GitHub Actions স্বয়ংক্রিয়ভাবে trigger হবে
3. Frontend build হবে
4. Server-এ SSH দিয়ে deploy হবে
5. Service restart হবে

## Testing:
```bash
git push origin main
```

এরপর GitHub repository → Actions tab-এ গিয়ে deployment status দেখতে পারবেন।
