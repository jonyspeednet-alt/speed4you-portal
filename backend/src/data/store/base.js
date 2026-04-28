const fs = require('fs');
const db = require('../../config/database');
const { runMigrations } = require('../migrations');
const {
  catalogPath,
  scannerRootsPath,
  scannerLogPath,
  scannerStatePath,
  scannerRuntimePath,
  MAX_SCANNER_RUNS,
  IS_PRODUCTION,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD_HASH,
  APP_STATE_DEFAULTS,
  DEVELOPMENT_SEED_ITEMS,
} = require('./constants');

const appStateCache = new Map();

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function shouldImportLegacyState(key, currentValue, fallbackValue) {
  if (currentValue === null || currentValue === undefined) {
    return true;
  }
  if (key === 'scanner_roots') {
    return Array.isArray(currentValue) && currentValue.length === 0;
  }
  if (key === 'scanner_log') {
    return Array.isArray(currentValue?.runs) && currentValue.runs.length === 0;
  }
  if (key === 'scanner_state') {
    return Object.keys(currentValue?.roots || {}).length === 0;
  }
  if (key === 'scanner_runtime') {
    return !currentValue?.currentJob && Array.isArray(currentValue?.queue) && currentValue.queue.length === 0;
  }
  return JSON.stringify(currentValue) === JSON.stringify(fallbackValue);
}

// These helpers are needed by ensureContentStore but will be defined in helpers.js or locally.
// To avoid circular dependency, I'll define them here or import them later.
// For now, I'll put them in helpers.js and import them here.

let contentStoreReadyPromise = null;

async function ensureContentStore() {
  // We'll need normalizeItem and extractTypedColumns here.
  // Since they are complex, I'll require them inside the function to avoid circularity if needed,
  // or just move them to base.js if they are fundamental.
  const { normalizeItem, extractTypedColumns, rowToScannerRoot, rowToScannerRun } = require('./helpers');

  if (!contentStoreReadyPromise) {
    contentStoreReadyPromise = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS content_catalog (
          id BIGINT PRIMARY KEY,
          payload JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      const hasStatusCol = await db.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'content_catalog' AND column_name = 'status'
      `);

      if (hasStatusCol.rows.length === 0) {
        await db.query(`ALTER TABLE content_catalog ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'`);
      }

      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'movie'`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS title_key TEXT NOT NULL DEFAULT ''`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT ''`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT ''`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS collection TEXT NOT NULL DEFAULT ''`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual'`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS source_root_id TEXT NOT NULL DEFAULT ''`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS last_scan_run_id TEXT NOT NULL DEFAULT ''`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS year INT`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS rating NUMERIC(4,2)`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS featured_order INT NOT NULL DEFAULT 0`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS trending_score INT NOT NULL DEFAULT 0`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS duplicate_count INT NOT NULL DEFAULT 0`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS metadata_status TEXT NOT NULL DEFAULT 'pending'`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ`);
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ`);
      
      if (!db.isInMemory) {
        await db.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        await db.query('CREATE INDEX IF NOT EXISTS idx_content_catalog_payload_gin ON content_catalog USING GIN (payload)');
        await db.query("CREATE INDEX IF NOT EXISTS idx_content_catalog_search ON content_catalog USING GIN (LOWER(COALESCE(payload->>'title', '') || ' ' || COALESCE(payload->>'genre', '') || ' ' || COALESCE(payload->>'language', '') || ' ' || COALESCE(payload->>'category', '') || ' ' || COALESCE(payload->>'description', '') || ' ' || COALESCE(payload->>'originalTitle', '') || ' ' || COALESCE(payload->>'year', '')) gin_trgm_ops)");
      }
      await db.query('CREATE INDEX IF NOT EXISTS idx_content_catalog_status ON content_catalog (status)');
      await db.query('CREATE INDEX IF NOT EXISTS idx_content_catalog_type ON content_catalog (content_type)');
      await db.query('CREATE INDEX IF NOT EXISTS idx_content_catalog_language ON content_catalog (language)');
      await db.query('CREATE INDEX IF NOT EXISTS idx_content_catalog_collection ON content_catalog (collection)');
      await db.query('CREATE INDEX IF NOT EXISTS idx_content_catalog_duplicates ON content_catalog (content_type, title_key)');
      await db.query("CREATE INDEX IF NOT EXISTS idx_content_catalog_updated_at ON content_catalog (updated_at DESC)");

      await db.query(`
        CREATE TABLE IF NOT EXISTS app_state (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id BIGSERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'admin',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_login TIMESTAMPTZ
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          external_id TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS watchlist_entries (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content_type TEXT NOT NULL,
          content_id BIGINT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, content_type, content_id)
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS watch_progress (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content_type TEXT NOT NULL,
          content_id BIGINT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          duration INTEGER NOT NULL DEFAULT 0,
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, content_type, content_id)
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS scanner_roots (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL DEFAULT '',
          scan_path TEXT NOT NULL DEFAULT '',
          public_base_url TEXT NOT NULL DEFAULT '',
          type TEXT NOT NULL DEFAULT 'movie',
          language TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT '',
          max_depth INT,
          batch_size INT,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          discovered BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS scanner_runs (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'completed',
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          root_ids JSONB NOT NULL DEFAULT '[]',
          roots_requested INT NOT NULL DEFAULT 0,
          roots_scanned INT NOT NULL DEFAULT 0,
          total_created INT NOT NULL DEFAULT 0,
          total_updated INT NOT NULL DEFAULT 0,
          total_deleted INT NOT NULL DEFAULT 0,
          total_unchanged INT NOT NULL DEFAULT 0,
          total_duplicate_drafts INT NOT NULL DEFAULT 0,
          skipped JSONB NOT NULL DEFAULT '[]',
          errors JSONB NOT NULL DEFAULT '[]',
          root_results JSONB NOT NULL DEFAULT '[]',
          error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      if (IS_PRODUCTION && (!DEFAULT_ADMIN_USERNAME || !DEFAULT_ADMIN_PASSWORD_HASH)) {
        throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD_HASH must be configured in production.');
      }
      await db.query(`
        INSERT INTO admin_users (username, password_hash, role, updated_at)
        VALUES ($1, $2, 'super_admin', NOW())
        ON CONFLICT (username) DO NOTHING
      `, [DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD_HASH]);

      const stateResult = await db.query(`SELECT value FROM app_state WHERE key = 'catalog_meta' LIMIT 1`);
      if (!stateResult.rows.length) {
        await db.query(
          `INSERT INTO app_state (key, value) VALUES ('catalog_meta', $1::jsonb)
           ON CONFLICT (key) DO NOTHING`,
          [JSON.stringify({ nextId: 1 })],
        );
      }

      const countResult = await db.query('SELECT COUNT(*)::int AS count FROM content_catalog');
      if (Number(countResult.rows[0]?.count || 0) === 0) {
        const legacyCatalog = readJson(catalogPath, { nextId: 1, items: [] });
        const legacyItems = Array.isArray(legacyCatalog.items) && legacyCatalog.items.length
          ? legacyCatalog.items
          : (!IS_PRODUCTION ? DEVELOPMENT_SEED_ITEMS : []);
        if (legacyItems.length) {
          for (const item of legacyItems) {
            const normalizedItem = normalizeItem(item);
            const cols = extractTypedColumns(normalizedItem);
            await db.query(
              `INSERT INTO content_catalog (
                 id, payload,
                 status, content_type, title, title_key, language, category, collection,
                 source_type, source_root_id, last_scan_run_id,
                 year, rating, featured, featured_order, trending_score, duplicate_count,
                 metadata_status, published_at, released_at,
                 created_at, updated_at
               )
               VALUES (
                 $1, $2::jsonb,
                 $3, $4, $5, $6, $7, $8, $9,
                 $10, $11, $12,
                 $13, $14, $15, $16, $17, $18,
                 $19, $20, $21,
                 NOW(), NOW()
               )
               ON CONFLICT (id) DO UPDATE SET
                 payload = EXCLUDED.payload,
                 status = EXCLUDED.status,
                 content_type = EXCLUDED.content_type,
                 title = EXCLUDED.title,
                 title_key = EXCLUDED.title_key,
                 language = EXCLUDED.language,
                 category = EXCLUDED.category,
                 collection = EXCLUDED.collection,
                 source_type = EXCLUDED.source_type,
                 source_root_id = EXCLUDED.source_root_id,
                 last_scan_run_id = EXCLUDED.last_scan_run_id,
                 year = EXCLUDED.year,
                 rating = EXCLUDED.rating,
                 featured = EXCLUDED.featured,
                 featured_order = EXCLUDED.featured_order,
                 trending_score = EXCLUDED.trending_score,
                 duplicate_count = EXCLUDED.duplicate_count,
                 metadata_status = EXCLUDED.metadata_status,
                 published_at = EXCLUDED.published_at,
                 released_at = EXCLUDED.released_at,
                 updated_at = NOW()`,
              [
                normalizedItem.id,
                JSON.stringify(normalizedItem),
                cols.status, cols.content_type, cols.title, cols.title_key, cols.language, cols.category, cols.collection,
                cols.source_type, cols.source_root_id, cols.last_scan_run_id,
                cols.year, cols.rating, cols.featured, cols.featured_order, cols.trending_score, cols.duplicate_count,
                cols.metadata_status, cols.published_at, cols.released_at,
              ],
            );
          }
        }

        const nextId = Number(legacyCatalog.nextId || 1);
        await db.query(
          `INSERT INTO app_state (key, value, updated_at)
           VALUES ('catalog_meta', $1::jsonb, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [JSON.stringify({ nextId: Math.max(nextId, legacyItems.reduce((max, item) => Math.max(max, Number(item.id || 0) + 1), 1)) })],
        );
      }

      const stateKeys = Object.keys(APP_STATE_DEFAULTS);
      for (const key of stateKeys) {
        const fallbackValue = APP_STATE_DEFAULTS[key];
        const existing = await db.query('SELECT value FROM app_state WHERE key = $1 LIMIT 1', [key]);
        let initialValue = fallbackValue;
        if (key === 'scanner_roots') {
          initialValue = readJson(scannerRootsPath, fallbackValue);
        } else if (key === 'scanner_log') {
          initialValue = readJson(scannerLogPath, fallbackValue);
        } else if (key === 'scanner_state') {
          initialValue = readJson(scannerStatePath, fallbackValue);
        } else if (key === 'scanner_runtime') {
          initialValue = readJson(scannerRuntimePath, fallbackValue);
        }

        if (existing.rows.length) {
          const existingValue = existing.rows[0].value;
          const finalValue = shouldImportLegacyState(key, existingValue, fallbackValue) && JSON.stringify(initialValue) !== JSON.stringify(fallbackValue)
            ? initialValue
            : existingValue;

          if (finalValue !== existingValue) {
            await db.query(
              `UPDATE app_state SET value = $2::jsonb, updated_at = NOW() WHERE key = $1`,
              [key, JSON.stringify(finalValue)],
            );
          }
          appStateCache.set(key, finalValue);
          continue;
        }

        await db.query(
          `INSERT INTO app_state (key, value, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (key) DO NOTHING`,
          [key, JSON.stringify(initialValue)],
        );
        appStateCache.set(key, initialValue);
      }

      if (!db.isInMemory) {
        await runMigrations();
      }

      const [dbRootsRes, dbRunsRes] = await Promise.all([
        db.query('SELECT * FROM scanner_roots ORDER BY created_at ASC'),
        db.query('SELECT * FROM scanner_runs ORDER BY created_at DESC LIMIT $1', [MAX_SCANNER_RUNS]),
      ]);
      appStateCache.set('scanner_roots', dbRootsRes.rows.map(rowToScannerRoot));
      appStateCache.set('scanner_log', { runs: dbRunsRes.rows.map(rowToScannerRun) });
    })().catch((error) => {
      contentStoreReadyPromise = null;
      throw error;
    });
  }

  return contentStoreReadyPromise;
}

async function getAppState(key, fallback = null) {
  await ensureContentStore();
  if (appStateCache.has(key)) {
    return appStateCache.get(key);
  }
  const result = await db.query('SELECT value FROM app_state WHERE key = $1 LIMIT 1', [key]);
  const value = result.rows[0]?.value ?? fallback;
  appStateCache.set(key, value);
  return value;
}

async function setAppState(key, value) {
  await ensureContentStore();
  appStateCache.set(key, value);
  await db.query(
    `INSERT INTO app_state (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value)],
  );
  return value;
}

module.exports = {
  db,
  appStateCache,
  readJson,
  writeJson,
  ensureContentStore,
  getAppState,
  setAppState,
  closePool: db.closePool,
};
