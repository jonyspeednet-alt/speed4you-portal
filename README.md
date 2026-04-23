# ISP Entertainment Portal

Project structure is now organized into two separate folders:

- `frontend/` - React + Vite client app
- `backend/` - Express API server

## First-time setup

```bash
npm run install:all
```

Or on Windows, double-click `install-all.bat`.

## Run in dev mode

```bash
npm run dev
```

This starts:

- Frontend: `http://127.0.0.1:4173`
- Backend: `http://127.0.0.1:3001`

Or on Windows, double-click `run-dev.bat`.

## Build and run from one command

```bash
npm run start
```

This will:

1. Build the frontend
2. Start the backend
3. Serve the built frontend from `http://127.0.0.1:3001`

Or on Windows, double-click `build-and-run.bat`.

## Full One-Click Launch

If you want everything in one go:

- install dependencies if needed
- build the project
- run it on localhost
- open it in your browser automatically

Double-click `one-click-run.bat`.

## Manual folder commands

Frontend:

```bash
cd frontend
npm run dev
```

Backend:

```bash
cd backend
npm run dev
```

## One-by-one media normalization worker

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

Key behavior:

- Never processes all files at once; each cycle converts only one file.
- Keeps running and auto-picks the next file.
- Uses full transcode to `H.264 + AAC + faststart`, then validates duration/format before replacing.
- Removes original source after successful verified replace (no duplicate copy retained).
- Tries TMDb-based naming for server-friendly title format (fallback to cleaned local naming).
- State/lock files are written under `backend/src/data/`:
  - `media-normalizer-state.json`
  - `media-normalizer.lock`

Optional env tuning:

- `MEDIA_NORMALIZER_CRF` (default `19`, lower = better quality/larger file)
- `MEDIA_NORMALIZER_PRESET` (default `medium`)
- `MEDIA_NORMALIZER_MIN_FREE_GB` (default `10`)
- `MEDIA_NORMALIZER_SCAN_INTERVAL_MS` (default `15000`)

## Server Notes

- Deployment/access notes are documented in [SERVER_WORKFLOW.md](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\SERVER_WORKFLOW.md).
- UX upgrade continuation plan is documented in [UX_MODERNIZATION_PLAN.md](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\UX_MODERNIZATION_PLAN.md).
- To enable automatic metadata enrichment during scanner runs, set `TMDB_API_KEY` for the backend environment.

## CI/CD

- GitHub Actions workflow: [.github/workflows/deploy.yml](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\.github\workflows\deploy.yml)
- Deploy package builder: [scripts/prepare-deploy.cjs](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\scripts\prepare-deploy.cjs)
- One-click local deploy: [one-click-deploy.bat](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\one-click-deploy.bat)
- Local deploy script: [scripts/one-click-deploy.ps1](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\scripts\one-click-deploy.ps1)
- Required GitHub repository secrets:
  - `DEPLOY_HOST`
  - `DEPLOY_PORT`
  - `DEPLOY_USER`
  - `DEPLOY_SSH_KEY`
  - `JWT_SECRET`
  - `TMDB_API_KEY`
