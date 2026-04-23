# Server Workflow Notes

## Access

- Host: `203.0.113.2`
- SSH port: `2973`
- Username: `speed4you`
- Local helper: [connect-server.bat](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\connect-server.bat)
- Local upload helper: [upload-backend.bat](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\upload-backend.bat)

## Deploy Flow

1. Build frontend locally from project root:
   - `npm run start` for local build-and-run, or build frontend separately before upload.
2. Upload frontend build:
   - Local source: `server-deploy/frontend/dist/*`
   - Remote target: `/var/www/html/portal/`
3. Upload backend files:
   - Local source: `server-deploy/backend/*`
   - Remote target: `/home/speed4you/isp-portal-backend/`
4. Restart backend on server after upload if code changed.
5. Verify:
   - Public site: `https://data.speed4you.net/portal`
   - Public API: `https://data.speed4you.net/portal-api/api/content/latest?limit=10`

## CI/CD Automation

- GitHub Actions workflow file: [.github/workflows/deploy.yml](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\.github\workflows\deploy.yml)
- Push to `main` can build and deploy automatically after GitHub Secrets are configured.
- Backend deploy package is prepared by: [scripts/prepare-deploy.cjs](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\scripts\prepare-deploy.cjs)
- Suggested repository secrets:
  - `DEPLOY_HOST=203.0.113.2`
  - `DEPLOY_PORT=2973`
  - `DEPLOY_USER=speed4you`
  - `DEPLOY_SSH_KEY=<private key for server access>`
  - `JWT_SECRET=<backend jwt secret>`
  - `TMDB_API_KEY=<tmdb api key>`
- Recommended: use SSH key auth for CI/CD, not password auth.

## Current Public Data Behavior

- Public portal reads from `/portal-api/api/...`
- Frontend homepage loads:
  - `/api/content/featured`
  - `/api/content/latest`
  - `/api/content/popular`
- In this codebase, public listing only needs `status: "published"` to appear in API results.
- Scanner content often has empty `poster` and `backdrop`; that can make a published item look blank or less visible in the homepage UI.

## Why A Published Item May Not Feel Visible

- `featured` hero shows only one item, not every newly published item.
- Homepage rails are visual; if `poster` is empty, a card can look blank.
- `popular` depends on rating order, so newly published items with no rating may not appear there.
- `latest` is the most likely place a newly published scanner item should appear first.

## Checked On Live Server

- Date checked: `2026-04-20`
- Public API already contains:
  - `Stand by Me Doraemon 2 (2020) {Dual Audio} [Hindi+ English]`
- Live API response shows:
  - `status: "published"`
  - category `Animation Movies`
  - source type `scanner`
- Conclusion: publish worked on backend; visibility issue is homepage presentation, not publish status.

## Data / Database Notes

- This local project currently uses JSON catalog storage for content listing:
  - [backend/src/data/store.js](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\backend\src\data\store.js)
  - [backend/src/data/catalog.json](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\backend\src\data\catalog.json)
- There is also PostgreSQL config present here:
  - [backend/src/config/database.js](c:\Users\Speed Net IT\Documents\codex local ai test\isp-entertainment-portal\backend\src\config\database.js)
- For this publish flow, the active content API logic is coming from the JSON store routes unless the server has been customized separately.

## Metadata Enrichment

- Scanner can enrich media metadata automatically from TMDb when backend env var `TMDB_API_KEY` is set.
- Enrichment fills fields like `description`, `poster`, `backdrop`, `genre`, `rating`, `runtime`, `tmdbId`, `imdbId`, `metadataStatus`, and `metadataConfidence`.
- If `TMDB_API_KEY` is missing, scan still works and enrichment is skipped safely.

## Safe Update Checklist

- Before deploy, confirm whether live server is using JSON files, PostgreSQL, or both.
- Keep a backup of live catalog/data files before replacing backend files.
- After upload, verify one published item through API first, then through homepage UI.
- For scanner-imported movies, add poster/backdrop if you want them to stand out on the portal homepage.
