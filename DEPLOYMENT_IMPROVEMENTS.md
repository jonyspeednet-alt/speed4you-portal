# Deployment Improvements - 504 Gateway Timeout Fix

## Problem Summary

The portal was experiencing **504 Gateway Timeout** errors because of a port mismatch:
- **Nginx** was configured to proxy to `http://127.0.0.1:4100/`
- **GitHub deployment workflow** was setting `PORT=3001` in the backend `.env` file
- This caused nginx to fail connecting to the backend, resulting in 504 errors

## Root Cause Analysis

1. The live server's `.env` file had `PORT=4100` configured manually
2. The GitHub Actions workflow (`github-deploy.yml`) was hardcoding `PORT=3001`
3. On each deployment, the workflow would overwrite the `.env` file with the wrong port
4. The backend would start on port 3001, but nginx was looking for port 4100

## Changes Made

### 1. Updated GitHub Deployment Workflow (`github-deploy.yml`)
- Changed `PORT=3001` to `PORT=4100` in the environment setup
- Added support for PM2 ecosystem configuration
- Improved PM2 restart logic to use ecosystem config when available

### 2. Created PM2 Ecosystem Configuration (`server-deploy/backend/ecosystem.config.js`)
- Provides robust process management
- Auto-restart on failure
- Memory limit protection (1GB)
- Graceful shutdown handling
- Centralized configuration for PM2

### 3. Updated Environment Examples
- `backend/.env.example` - Updated to PORT=4100
- `server-deploy/backend/.env.deploy.example` - Updated to PORT=4100

## Benefits

1. **No more 504 errors** - Port configuration is now consistent
2. **Better process management** - PM2 ecosystem config provides:
   - Automatic restart on crashes
   - Memory limit protection
   - Better logging
   - Graceful shutdown
3. **Easier maintenance** - All configuration in one place
4. **Deployment consistency** - Same port across all environments

## Server Setup Instructions

If you need to setup PM2 on the server for the first time:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Navigate to backend directory
cd /home/speed4you/portal-app/backend

# Start using ecosystem config
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
# (Run the command it outputs with sudo)
```

## Verification

After deployment, verify everything is working:

```bash
# Check backend health
curl http://localhost:4100/health

# Check via nginx
curl https://data.speed4you.net/portal-api/health

# Check PM2 status
pm2 status

# View logs
pm2 logs isp-portal-backend
```

## Future Considerations

1. **Add a DEPLOY_PORT secret** - Instead of hardcoding port in workflow, use a GitHub secret
2. **Health check in deployment** - Add a step to verify backend is running after deployment
3. **Rollback mechanism** - Keep previous version ready for quick rollback
4. **Monitoring** - Consider adding uptime monitoring (e.g., UptimeRobot, Better Uptime)

## Files Modified

- `github-deploy.yml` - Updated PORT and PM2 logic
- `server-deploy/backend/ecosystem.config.js` - New file
- `server-deploy/backend/.env.deploy.example` - Updated PORT
- `backend/.env.example` - Updated PORT