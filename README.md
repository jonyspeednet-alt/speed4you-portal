# ISP Entertainment Portal

[![GitHub Repo stars](https://img.shields.io/github/stars/jonyspeednet-alt/isp-entertainment-portal?style=social)](https://github.com/jonyspeednet-alt/isp-entertainment-portal)
[![GitHub last commit](https://img.shields.io/github/last-commit/jonyspeednet-alt/isp-entertainment-portal)](https://github.com/jonyspeednet-alt/isp-entertainment-portal/commits/main)
[![GitHub Issues](https://img.shields.io/github/issues/jonyspeednet-alt/isp-entertainment-portal)](https://github.com/jonyspeednet-alt/isp-entertainment-portal/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 📋 Project Overview

ISP Entertainment Portal - A media normalization and streaming platform with frontend and backend components.

## 🚀 Quick Start

### Installation

```bash
npm run install:all
```

Or on Windows, double-click `install-all.bat`.

### Development

Start the development server:

```bash
npm run dev
```

This starts:
- Frontend: `http://127.0.0.1:4173`
- Backend: `http://127.0.0.1:3001`

Or on Windows, double-click `run-dev.bat`.

### Build and Run

```bash
npm run start
```

This will:
1. Build the frontend
2. Start the backend
3. Serve the built frontend from `http://127.0.0.1:3001`

Or on Windows, double-click `build-and-run.bat`.

### One-Click Launch

For everything in one go:
- install dependencies if needed
- build the project
- run it on localhost
- open it in your browser automatically

Double-click `one-click-run.bat`.

## 📁 Project Structure

```
.
├── frontend/              # React + Vite client app
├── backend/               # Express API server
├── .github/workflows/     # GitHub Actions workflows
├── scripts/               # Build and deployment scripts
├── server-deploy/         # Deployment package
├── .gitignore            # Git ignore rules
├── package.json          # Project dependencies
└── README.md            # This file
```

## 🔧 One-by-one Media Normalizer

This worker scans every `scanPath` from `backend/src/data/scanner-roots.json` and processes media files one by one into:

- MP4 container
- H.264 video
- AAC audio
- faststart enabled

Run:

```bash
cd backend
npm run media:normalize-library
```

**Key behavior:**
- Never processes all files at once; each cycle converts only one file
- Keeps running and auto-picks the next file
- Uses full transcode to `H.264 + AAC + faststart`, then validates duration/format before replacing
- Removes original source after successful verified replace (no duplicate copy retained)
- Tries TMDb-based naming for server-friendly title format (fallback to cleaned local naming)
- State/lock files are written under `backend/src/data/`:
  - `media-normalizer-state.json`
  - `media-normalizer.lock`

### Environment Variables

- `MEDIA_NORMALIZER_CRF` (default `19`, lower = better quality/larger file)
- `MEDIA_NORMALIZER_PRESET` (default `medium`)
- `MEDIA_NORMALIZER_MIN_FREE_GB` (default `10`)
- `MEDIA_NORMALIZER_SCAN_INTERVAL_MS` (default `15000`)

## 🚀 Deployment

### GitHub Actions

GitHub Actions workflow is configured at:
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

### Required GitHub Repository Secrets

When deploying to a server, set the following secrets in your GitHub repository settings:

| Secret Name | Description |
|-------------|-------------|
| `DEPLOY_HOST` | Server hostname or IP address |
| `DEPLOY_PORT` | SSH port (usually 22) |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | SSH private key for authentication |
| `JWT_SECRET` | JWT signing secret for authentication |
| `TMDB_API_KEY` | The Movie Database API key for metadata enrichment |

### Deployment Process

1. Push changes to the `main` branch
2. GitHub Actions automatically:
   - Checks out the code
   - Sets up Node.js
   - Installs dependencies for both frontend and backend
   - Builds the frontend
   - Prepares the deployment package
   - Uploads files via SCP
   - Restarts the backend service via SSH

### Manual Deployment

For manual deployment, use the provided scripts:

- `scripts/one-click-deploy.ps1` - PowerShell deployment script
- `one-click-deploy.bat` - One-click local deployment

## ⚙️ SSH Key Setup for GitHub

### Generate SSH Key Pair

If you don't already have an SSH key:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Or use RSA for broader compatibility:

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

When prompted for a file location, press Enter to use the default (`~/.ssh/id_ed25519`).

You can optionally set a passphrase for extra security.

### Add SSH Key to SSH Agent

```bash
# Start the SSH agent in the background
eval "$(ssh-agent -s)"

# Add your SSH private key to the agent
ssh-add ~/.ssh/id_ed25519
```

### Add Public Key to GitHub

1. Copy your public key to the clipboard:

   **macOS/Linux:**
   ```bash
   pbcopy < ~/.ssh/id_ed25519.pub
   ```

   **Windows (PowerShell):**
   ```powershell
   Get-Content ~/.ssh/id_ed25519.pub | Set-Clipboard
   ```

   **Windows (Git Bash):**
   ```bash
   cat ~/.ssh/id_ed25519.pub | clip.exe
   ```

2. Go to your GitHub account settings
3. Navigate to **SSH and GPG keys**
4. Click **New SSH key**
5. Give it a descriptive title (e.g., "My Laptop")
6. Paste your public key
7. Click **Add SSH key**

### Test SSH Connection

```bash
ssh -T git@github.com
```

You should see a message like: `Hi username! You've successfully authenticated, but GitHub does not provide shell access.`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Note:** Replace `<username>` in the badge URLs with your actual GitHub username after creating the repository.