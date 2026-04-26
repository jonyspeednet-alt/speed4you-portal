const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { runMigrations } = require('./migrations');

const catalogPath = path.resolve(__dirname, 'catalog.json');
const scannerRootsPath = path.resolve(__dirname, 'scanner-roots.json');
const scannerLogPath = path.resolve(__dirname, 'scanner-log.json');
const scannerStatePath = path.resolve(__dirname, 'scanner-state.json');
const scannerRuntimePath = path.resolve(__dirname, 'scanner-runtime.json');
const MAX_SCANNER_RUNS = 30;
const NODE_ENV = String(process.env.NODE_ENV || 'development').toLowerCase();
const IS_PRODUCTION = NODE_ENV === 'production';
const MIN_MOVIE_SIZE = Number(process.env.SCANNER_MIN_MOVIE_SIZE || 104857600); // 100MB
const MIN_EPISODE_SIZE = Number(process.env.SCANNER_MIN_EPISODE_SIZE || 31457280); // 30MB
const JUNK_REGEX = /sample|trailer|extras|promo|short|clip|preview|teaser/i;
const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || (IS_PRODUCTION ? '' : 'admin');
const DEFAULT_ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || (IS_PRODUCTION ? '' : '$2a$10$ejyljPiCt5J0tvO68DS99OnzyystXkHwgn9pN44txXcxGs/XLlKtK');
const APP_STATE_DEFAULTS = {
  scanner_roots: [],
  scanner_log: { runs: [] },
  scanner_state: { roots: {} },
  scanner_runtime: { currentJob: null, queue: [] },
  media_normalizer_state: null,
  media_normalizer_log: { lines: [] },
};
const appStateCache = new Map();
const DEVELOPMENT_SEED_ITEMS = [
  {
    id: 1001,
    title: 'The Journey Begins',
    type: 'movie',
    status: 'published',
    genre: 'Action',
    year: 2024,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400',
    backdrop: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200',
    rating: 8.2,
    duration: 142,
    description: 'An epic adventure film filled with action and mystery.',
    featured: true,
    featuredOrder: 10,
    trendingScore: 95,
  },
  {
    id: 1002,
    title: 'Heart of Gold',
    type: 'movie',
    status: 'published',
    genre: 'Drama',
    year: 2023,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400',
    backdrop: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200',
    rating: 7.9,
    duration: 128,
    description: 'A touching story about love, loss, and redemption.',
    trendingScore: 84,
  },
  {
    id: 1003,
    title: 'Laugh Track',
    type: 'movie',
    status: 'published',
    genre: 'Comedy',
    year: 2024,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1495997622626-f1fbb8e068aa?w=400',
    backdrop: 'https://images.unsplash.com/photo-1495997622626-f1fbb8e068aa?w=1200',
    rating: 7.1,
    duration: 95,
    description: 'A hilarious comedy about everyday life mishaps.',
    trendingScore: 71,
  },
  {
    id: 1004,
    title: 'Midnight Terror',
    type: 'movie',
    status: 'published',
    genre: 'Horror',
    year: 2024,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400',
    backdrop: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200',
    rating: 7.4,
    duration: 105,
    description: 'A chilling horror experience that will keep you on edge.',
    trendingScore: 77,
  },
  {
    id: 1005,
    title: 'Love in Paris',
    type: 'movie',
    status: 'published',
    genre: 'Romance',
    year: 2023,
    language: 'French',
    poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400',
    backdrop: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200',
    rating: 8,
    duration: 112,
    description: 'A romantic tale set in the city of love.',
    trendingScore: 68,
  },
  {
    id: 2001,
    title: 'Tech Titans',
    type: 'series',
    status: 'published',
    genre: 'Thriller',
    year: 2024,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1574609644844-fcf46c1e1e2c?w=400',
    backdrop: 'https://images.unsplash.com/photo-1574609644844-fcf46c1e1e2c?w=1200',
    rating: 8.5,
    description: 'Follow the rise of ambitious tech entrepreneurs in Silicon Valley.',
    seasons: 2,
    episodes: 24,
    trendingScore: 98,
  },
  {
    id: 2002,
    title: 'Mystery Island',
    type: 'series',
    status: 'published',
    genre: 'Adventure',
    year: 2023,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400',
    backdrop: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200',
    rating: 8.3,
    description: 'A group of friends must solve the mysteries of an uncharted island.',
    seasons: 1,
    episodes: 10,
    trendingScore: 86,
  },
  {
    id: 2003,
    title: 'Legal Minds',
    type: 'series',
    status: 'published',
    genre: 'Drama',
    year: 2024,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    backdrop: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200',
    rating: 8.1,
    description: 'High-stakes legal battles and personal drama in a prestigious law firm.',
    seasons: 3,
    episodes: 36,
    trendingScore: 83,
  },
];

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

let contentStoreReadyPromise = null;

async function ensureContentStore() {
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
      await db.query(`ALTER TABLE content_catalog ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'`);
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

      // Run SQL migrations (idempotent — only unapplied files are executed)
      if (!db.isInMemory) {
        await runMigrations();
      }

      // After migrations, prime scanner caches from their proper relational tables.
      // Migration 002 populates scanner_roots / scanner_runs from app_state data,
      // so this always reflects the authoritative post-migration state.
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

async function getCatalogMeta() {
  await ensureContentStore();
  const result = await db.query(`SELECT value FROM app_state WHERE key = 'catalog_meta' LIMIT 1`);
  return result.rows[0]?.value || { nextId: 1 };
}

async function setCatalogMeta(value) {
  await ensureContentStore();
  await db.query(
    `INSERT INTO app_state (key, value, updated_at)
     VALUES ('catalog_meta', $1::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(value)],
  );
}

async function getItems() {
  await ensureContentStore();
  const result = await db.query('SELECT payload FROM content_catalog ORDER BY id ASC');
  return result.rows.map((row) => row.payload);
}

function buildCatalogFilterClauses(filters = {}, params = []) {
  const clauses = [];
  const push = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  // Use typed columns where available — avoids expression evaluation on every row
  if (filters.status)       clauses.push(`status = ${push(String(filters.status))}`);
  if (filters.type)         clauses.push(`content_type = ${push(String(filters.type))}`);
  if (filters.source)       clauses.push(`source_type = ${push(String(filters.source))}`);
  if (filters.sourceRootId) clauses.push(`source_root_id = ${push(String(filters.sourceRootId))}`);
  if (filters.scanRunId)    clauses.push(`last_scan_run_id = ${push(String(filters.scanRunId))}`);
  if (filters.language)     clauses.push(`language = ${push(String(filters.language))}`);
  if (filters.category)     clauses.push(`category = ${push(String(filters.category))}`);
  if (filters.collection)   clauses.push(`collection = ${push(String(filters.collection))}`);
  if (filters.year)         clauses.push(`year = ${push(Number(filters.year))}`);
  if (filters.featured)     clauses.push(`featured = true`);
  if (filters.duplicatesOnly) clauses.push(`duplicate_count > 0`);

  // Tags and genre still live in JSONB (array / multi-value fields)
  if (filters.tag) {
    clauses.push(`COALESCE(payload->'tags', '[]'::jsonb) ? ${push(String(filters.tag))}`);
  }
  if (filters.genre) {
    clauses.push(`payload->>'genre' = ${push(String(filters.genre))}`);
  }

  // Full-text search still uses the GIN trgm index on the payload expression
  if (filters.search) {
    const term = `%${String(filters.search).trim().toLowerCase()}%`;
    const placeholder = push(term);
    clauses.push(
      `LOWER(COALESCE(payload->>'title', '') || ' ' || COALESCE(payload->>'genre', '') || ' '` +
      ` || COALESCE(payload->>'language', '') || ' ' || COALESCE(payload->>'category', '') || ' '` +
      ` || COALESCE(payload->>'description', '') || ' ' || COALESCE(payload->>'originalTitle', '')` +
      ` || ' ' || COALESCE(payload->>'year', '')) LIKE ${placeholder}`,
    );
  }

  return clauses;
}

async function pruneCatalog() {
  await ensureContentStore();
  const { items } = await listItems({}, 0, null, 'latest', false);
  const toDelete = [];

  for (const item of items) {
    const isJunk = JUNK_REGEX.test(item.title) || (item.sourcePath && JUNK_REGEX.test(item.sourcePath));
    if (isJunk) {
      toDelete.push(item.id);
      continue;
    }

    if (item.sourcePath && fs.existsSync(item.sourcePath)) {
      try {
        const stats = fs.statSync(item.sourcePath);
        const minSize = item.type === 'series' ? MIN_EPISODE_SIZE : MIN_MOVIE_SIZE;
        if (stats.size < minSize) {
          toDelete.push(item.id);
        }
      } catch {
        // Skip if stat fails
      }
    } else if (item.sourcePath) {
      // Path defined but missing
      toDelete.push(item.id);
    }
  }

  if (toDelete.length) {
    await db.query('DELETE FROM content_catalog WHERE id = ANY($1)', [toDelete]);
  }

  return { deletedCount: toDelete.length };
}

async function getDuplicateGroupsForItems(items = []) {
  if (!items.length) {
    return new Map();
  }

  await ensureContentStore();
  const keys = [...new Set(items.map((item) => `${item.type}:${item.titleKey || normalizeTitleKey(item.title)}`))];
  const conditions = [];
  const params = [];

  keys.forEach((key) => {
    const [type, titleKey] = key.split(':');
    params.push(type);
    const typeIndex = params.length;
    params.push(titleKey);
    const titleKeyIndex = params.length;
    conditions.push(`(content_type = $${typeIndex} AND title_key = $${titleKeyIndex})`);
  });

  const result = await db.query(
    `SELECT payload
     FROM content_catalog
     WHERE ${conditions.join(' OR ')}`,
    params,
  );

  const groups = new Map();
  result.rows.forEach((row) => {
    const item = normalizeItem(row.payload);
    const key = `${item.type}:${item.titleKey || normalizeTitleKey(item.title)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  });

  return groups;
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

function loadScannerLog() {
  return appStateCache.get('scanner_log') || { runs: [] };
}

async function saveScannerLog(payload) {
  return setAppState('scanner_log', payload);
}

function loadScannerState() {
  return appStateCache.get('scanner_state') || { roots: {} };
}

async function saveScannerState(payload) {
  return setAppState('scanner_state', payload);
}

function loadScannerRuntime() {
  return appStateCache.get('scanner_runtime') || { currentJob: null, queue: [] };
}

async function saveScannerRuntime(payload) {
  return setAppState('scanner_runtime', payload);
}

function normalizeTitleKey(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\b(1080p|720p|480p|2160p|web[- ]?dl|bluray|brrip|x264|x265|hdrip|dvdrip|proper|uncut)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized) {
    return normalized;
  }

  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// ── Helpers for typed-column persistence ─────────────────────────────────────

function parseISODate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Extract the typed column values that must be kept in sync alongside the
 * JSONB payload so that WHERE / ORDER BY / GROUP BY can use fast indexes.
 */
function extractTypedColumns(item) {
  return {
    status:           item.status           || 'draft',
    content_type:     item.type             || 'movie',
    title:            item.title            || '',
    title_key:        item.titleKey         || '',
    language:         item.language         || '',
    category:         item.category         || '',
    collection:       item.collection       || '',
    source_type:      item.sourceType       || 'manual',
    source_root_id:   item.sourceRootId     || '',
    last_scan_run_id: item.lastScanRunId    || '',
    year:             item.year   ? Number(item.year)   : null,
    rating:           item.rating ? Number(item.rating) : null,
    featured:         Boolean(item.featured),
    featured_order:   Number(item.featuredOrder  || 0),
    trending_score:   Number(item.trendingScore  || 0),
    duplicate_count:  Number(item.duplicateCount || 0),
    metadata_status:  item.metadataStatus  || 'pending',
    published_at:     parseISODate(item.publishedAt),
    released_at:      parseISODate(item.releasedAt),
  };
}

function rowToScannerRun(row) {
  return {
    id:              row.id,
    status:          row.status,
    startedAt:       row.started_at   ? row.started_at.toISOString()   : null,
    completedAt:     row.completed_at ? row.completed_at.toISOString() : null,
    rootIds:         row.root_ids     || [],
    rootsRequested:  row.roots_requested,
    rootsScanned:    row.roots_scanned,
    created:         row.total_created,
    updated:         row.total_updated,
    deleted:         row.total_deleted,
    unchanged:       row.total_unchanged,
    duplicateDrafts: row.total_duplicate_drafts,
    skipped:         row.skipped      || [],
    errors:          row.errors       || [],
    rootResults:     row.root_results || [],
    error:           row.error        || null,
  };
}

function toSafeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowToScannerRoot(row) {
  return {
    id:            row.id,
    label:         row.label,
    scanPath:      row.scan_path,
    publicBaseUrl: row.public_base_url,
    type:          row.type,
    language:      row.language,
    category:      row.category,
    maxDepth:      row.max_depth  ?? undefined,
    batchSize:     row.batch_size ?? undefined,
    enabled:       row.enabled,
    discovered:    row.discovered,
  };
}

function normalizeRuntimeMinutes(value, fallbackSeconds = null) {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    if (numericValue > 400) {
      return Math.max(1, Math.round(numericValue / 60));
    }

    return Math.round(numericValue);
  }

  const fallbackValue = Number(fallbackSeconds);
  if (Number.isFinite(fallbackValue) && fallbackValue > 0) {
    return Math.max(1, Math.round(fallbackValue / 60));
  }

  return null;
}

function normalizeDurationSeconds(value, fallbackMinutes = null) {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    if (numericValue <= 400) {
      return Math.round(numericValue * 60);
    }

    return Math.round(numericValue);
  }

  const fallbackValue = Number(fallbackMinutes);
  if (Number.isFinite(fallbackValue) && fallbackValue > 0) {
    return Math.round(fallbackValue * 60);
  }

  return 0;
}

function normalizeEpisodes(episodes = []) {
  if (!Array.isArray(episodes)) {
    return [];
  }

  return (episodes || []).map((episode, index) => {
    const durationSeconds = normalizeDurationSeconds(episode.duration, episode.runtimeMinutes || episode.runtime || null);
    const runtimeMinutes = normalizeRuntimeMinutes(episode.runtimeMinutes || episode.runtime || episode.duration, durationSeconds);

    return {
      ...episode,
      id: episode.id || index + 1,
      number: Number(episode.number || episode.id || index + 1),
      durationSeconds,
      runtimeMinutes,
    };
  });
}

function normalizeSeasons(seasons = []) {
  if (!Array.isArray(seasons)) {
    return [];
  }

  return (seasons || []).map((season, index) => ({
    ...season,
    id: season.id || index + 1,
    number: Number(season.number || season.id || index + 1),
    episodes: normalizeEpisodes(season.episodes || []),
  }));
}

function resolveDisplayGenres(item) {
  if (Array.isArray(item.genres) && item.genres.length) {
    return item.genres;
  }

  if (typeof item.genre === 'string' && item.genre.trim()) {
    return item.genre.split(',').map((entry) => entry.trim()).filter(Boolean);
  }

  return [];
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeItem(item) {
  const genres = resolveDisplayGenres(item);
  const updatedAt = item.updatedAt || item.metadataUpdatedAt || item.createdAt || '';
  const metadataConfidence = Number(item.metadataConfidence || 0);
  const rating = item.rating ? Number(item.rating) : null;
  const recencyDate = updatedAt ? new Date(updatedAt) : null;
  const recencyDays = recencyDate && !Number.isNaN(recencyDate.getTime())
    ? Math.max(0, (Date.now() - recencyDate.getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  const recencyBoost = clampNumber(30 - recencyDays, 0, 30);
  const ratingBoost = rating ? rating * 8 : 0;
  const confidenceBoost = metadataConfidence / 5;
  const duplicatePenalty = Number(item.duplicateCount || 0) > 0 ? 12 : 0;
  const reviewPenalty = item.metadataStatus === 'needs_review' ? 18 : item.metadataStatus === 'not_found' ? 28 : 0;
  const trendingScore = Math.round(Math.max(0, recencyBoost + ratingBoost + confidenceBoost - duplicatePenalty - reviewPenalty));
  const runtimeMinutes = normalizeRuntimeMinutes(item.runtime, item.duration);
  const durationSeconds = normalizeDurationSeconds(item.duration, runtimeMinutes);

  return {
    ...item,
    genres,
    genre: item.genre || genres.join(', '),
    type: item.type || 'movie',
    status: item.status || 'draft',
    featured: Boolean(item.featured),
    year: item.year ? Number(item.year) : null,
    rating: item.rating ? Number(item.rating) : null,
    runtime: runtimeMinutes,
    runtimeMinutes,
    durationSeconds,
    seasonCount: item.seasonCount ? Number(item.seasonCount) : 0,
    episodeCount: item.episodeCount ? Number(item.episodeCount) : 0,
    seasons: normalizeSeasons(item.seasons || []),
    description: item.description || '',
    tmdbId: item.tmdbId ? Number(item.tmdbId) : null,
    imdbId: item.imdbId || '',
    originalTitle: item.originalTitle || '',
    originalLanguage: item.originalLanguage || '',
    metadataStatus: item.metadataStatus || 'pending',
    metadataProvider: item.metadataProvider || '',
    metadataConfidence,
    metadataUpdatedAt: item.metadataUpdatedAt || '',
    metadataError: item.metadataError || '',
    parsedTitle: item.parsedTitle || '',
    titleKey: item.titleKey || normalizeTitleKey(item.title),
    duplicateCandidates: Array.isArray(item.duplicateCandidates) ? item.duplicateCandidates : [],
    duplicateCount: Number(item.duplicateCount || 0),
    trendingScore,
    collection: item.collection || '',
    tags: normalizeStringList(item.tags),
    adminNotes: item.adminNotes || '',
    editorialScore: Number(item.editorialScore || 0),
    featuredOrder: Number(item.featuredOrder || 0),
  };
}

function enrichDuplicateMetadata(items) {
  const groups = new Map();

  items.forEach((item) => {
    const key = `${item.type}:${item.titleKey || normalizeTitleKey(item.title)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  });

  return items.map((item) => {
    const key = `${item.type}:${item.titleKey || normalizeTitleKey(item.title)}`;
    const matches = (groups.get(key) || [])
      .filter((candidate) => candidate.id !== item.id)
      .map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        status: candidate.status,
        year: candidate.year,
        sourceType: candidate.sourceType,
        sourcePath: candidate.sourcePath || '',
      }));

    return {
      ...item,
      duplicateCandidates: matches,
      duplicateCount: matches.length,
    };
  });
}

function buildDuplicateGroups(items) {
  const groups = new Map();

  items.forEach((item) => {
    const key = `${item.type}:${item.titleKey || normalizeTitleKey(item.title)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  });

  return groups;
}

function attachDuplicateMetadata(item, groups) {
  const key = `${item.type}:${item.titleKey || normalizeTitleKey(item.title)}`;
  const matches = (groups.get(key) || [])
    .filter((candidate) => candidate.id !== item.id)
    .map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      status: candidate.status,
      year: candidate.year,
      sourceType: candidate.sourceType,
      sourcePath: candidate.sourcePath || '',
    }));

  return {
    ...item,
    duplicateCandidates: matches,
    duplicateCount: matches.length,
  };
}

async function listItems(filters = {}, offset = 0, limit = null, sort = 'latest', includeDuplicates = true) {
  await ensureContentStore();
  const params = [];
  const clauses = buildCatalogFilterClauses(filters, params);
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM content_catalog
     ${whereClause}`,
    params,
  );
  const total = Number(countResult.rows[0]?.count || 0);

  // ORDER BY uses typed columns — no runtime JSONB casting / regex
  let orderClause = '';
  if (sort === 'popular' || sort === 'rating') {
    orderClause = 'ORDER BY rating DESC NULLS LAST, id DESC';
  } else if (sort === 'trending') {
    orderClause = 'ORDER BY trending_score DESC, id DESC';
  } else if (sort === 'featured') {
    orderClause = 'ORDER BY featured_order DESC NULLS LAST, CASE WHEN featured THEN 1 ELSE 0 END DESC, id DESC';
  } else {
    orderClause = 'ORDER BY COALESCE(published_at, released_at, updated_at) DESC NULLS LAST, id DESC';
  }

  const listParams = [...params];
  let pagingClause = '';
  if (limit !== null && Number(limit) > 0) {
    listParams.push(Number(limit));
    pagingClause += ` LIMIT $${listParams.length}`;
  }
  if (offset > 0) {
    listParams.push(Number(offset));
    pagingClause += ` OFFSET $${listParams.length}`;
  }

  const result = await db.query(
    `SELECT payload
     FROM content_catalog
     ${whereClause}
     ${orderClause}
     ${pagingClause}`,
    listParams,
  );

  const items = result.rows.map((row) => normalizeItem(row.payload));
  
  if (!includeDuplicates) {
    return { items, total };
  }

  const duplicateGroups = await getDuplicateGroupsForItems(items);
  return { items: items.map((item) => attachDuplicateMetadata(item, duplicateGroups)), total };
}

function scoreSearchResult(item, query) {
  const normalizedQuery = normalizeTitleKey(query);
  const titleKey = normalizeTitleKey(item.title);
  const originalTitleKey = normalizeTitleKey(item.originalTitle);
  const categoryKey = normalizeTitleKey(item.category);
  const genreKey = normalizeTitleKey(item.genre);
  const languageKey = normalizeTitleKey(item.language);
  const collectionKey = normalizeTitleKey(item.collection);
  const descriptionKey = normalizeTitleKey(item.description);
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const titleTokens = titleKey.split(' ').filter(Boolean);
  let score = 0;

  if (titleKey === normalizedQuery) score += 120;
  else if (titleKey.startsWith(normalizedQuery)) score += 90;
  else if (titleKey.includes(normalizedQuery)) score += 70;
  if (originalTitleKey === normalizedQuery) score += 110;
  else if (originalTitleKey.startsWith(normalizedQuery)) score += 84;
  else if (originalTitleKey.includes(normalizedQuery)) score += 64;

  queryTokens.forEach((token) => {
    if (titleTokens.includes(token)) {
      score += 20;
    } else if (titleTokens.some((entry) => entry.startsWith(token))) {
      score += 12;
    }

    if (originalTitleKey.includes(token)) score += 10;
    if (categoryKey.includes(token)) score += 8;
    if (genreKey.includes(token)) score += 7;
    if (languageKey.includes(token)) score += 6;
    if (collectionKey.includes(token)) score += 6;
    if (descriptionKey.includes(token)) score += 3;
  });

  if (categoryKey.includes(normalizedQuery)) score += 28;
  if (genreKey.includes(normalizedQuery)) score += 22;
  if (languageKey.includes(normalizedQuery)) score += 18;
  if (collectionKey.includes(normalizedQuery)) score += 18;
  if (descriptionKey.includes(normalizedQuery)) score += 12;
  score += Number(item.trendingScore || 0);
  score += Number(item.rating || 0) * 4;
  if (item.metadataStatus === 'matched') score += 8;
  if (item.metadataStatus === 'needs_review') score -= 8;
  if (item.metadataStatus === 'not_found') score -= 14;

  return score;
}

async function searchItems(query, filters = {}) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    return { items: [], total: 0 };
  }

  await ensureContentStore();
  const searchFilters = { 
    ...filters, 
    status: filters.status || 'published',
    search: normalizedQuery 
  };
  
  const params = [];
  const clauses = buildCatalogFilterClauses(searchFilters, params);
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT payload
     FROM content_catalog
     ${whereClause}
     LIMIT 500`,
    params,
  );

  const items = result.rows.map((row) => normalizeItem(row.payload));
  const duplicateGroups = await getDuplicateGroupsForItems(items);
  
  const scoredItems = items
    .map((item) => ({
      ...attachDuplicateMetadata(item, duplicateGroups),
      searchScore: scoreSearchResult(item, normalizedQuery),
    }))
    .filter((item) => item.searchScore > 0)
    .sort((left, right) => right.searchScore - left.searchScore || (right.trendingScore || 0) - (left.trendingScore || 0));

  return { items: scoredItems, total: scoredItems.length };
}

async function getSuggestions(query, limit = 8) {
  const result = await searchItems(query, { status: 'published' });
  const matches = (result.items || []).slice(0, limit);
  return matches.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    year: item.year,
    language: item.language,
    genre: item.genre,
  }));
}

async function getItemById(idOrSlug) {
  await ensureContentStore();
  const numericId = Number(idOrSlug);

  let result;
  if (Number.isFinite(numericId) && numericId > 0) {
    result = await db.query('SELECT payload FROM content_catalog WHERE id = $1 LIMIT 1', [numericId]);
  } else {
    result = await db.query('SELECT payload FROM content_catalog WHERE payload->>\'slug\' = $1 LIMIT 1', [String(idOrSlug)]);
  }

  const payload = result.rows[0]?.payload;
  if (!payload) {
    return null;
  }

  const item = normalizeItem(payload);
  const duplicateGroups = await getDuplicateGroupsForItems([item]);
  return attachDuplicateMetadata(item, duplicateGroups);
}

async function getItemsByIds(ids = []) {
  const numericIds = [...new Set(ids.map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (!numericIds.length) {
    return new Map();
  }

  await ensureContentStore();
  const result = await db.query(
    'SELECT payload FROM content_catalog WHERE id = ANY($1::bigint[])',
    [numericIds],
  );

  const itemsMap = new Map();
  for (const row of result.rows) {
    const item = normalizeItem(row.payload);
    itemsMap.set(Number(item.id), item);
  }

  return itemsMap;
}

async function getItemByScanSignature(scanSignature) {
  await ensureContentStore();
  const result = await db.query(
    'SELECT payload FROM content_catalog WHERE payload->>\'scanSignature\' = $1 LIMIT 1',
    [String(scanSignature || '')],
  );
  const payload = result.rows[0]?.payload;
  return payload ? normalizeItem(payload) : null;
}

async function createItem(payload) {
  const meta = await getCatalogMeta();
  const now = new Date().toISOString();
  const item = normalizeItem({
    id: meta.nextId,
    createdAt: now,
    updatedAt: now,
    sourceType: payload.sourceType || 'manual',
    ...payload,
    titleKey: normalizeTitleKey(payload.title),
  });

  const cols = extractTypedColumns(item);
  await db.query(
    `INSERT INTO content_catalog (
       id, payload, created_at, updated_at,
       status, content_type, title, title_key, language, category, collection,
       source_type, source_root_id, last_scan_run_id, year, rating, featured,
       featured_order, trending_score, duplicate_count, metadata_status,
       published_at, released_at
     ) VALUES (
       $1, $2::jsonb, $3, $4,
       $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16, $17,
       $18, $19, $20, $21,
       $22, $23
     )`,
    [
      item.id, JSON.stringify(item), now, now,
      cols.status, cols.content_type, cols.title, cols.title_key, cols.language, cols.category, cols.collection,
      cols.source_type, cols.source_root_id, cols.last_scan_run_id, cols.year, cols.rating, cols.featured,
      cols.featured_order, cols.trending_score, cols.duplicate_count, cols.metadata_status,
      cols.published_at, cols.released_at,
    ],
  );
  await setCatalogMeta({ nextId: meta.nextId + 1 });
  return getItemById(item.id);
}

async function updateItem(id, payload) {
  const current = await getItemById(id);
  if (!current) {
    return null;
  }

  const updated = normalizeItem({
    ...current,
    ...payload,
    id: current.id,
    titleKey: normalizeTitleKey(payload.title || current.title),
    updatedAt: new Date().toISOString(),
  });

  const cols = extractTypedColumns(updated);
  await db.query(
    `UPDATE content_catalog
     SET payload          = $2::jsonb,
         updated_at       = NOW(),
         status           = $3,
         content_type     = $4,
         title            = $5,
         title_key        = $6,
         language         = $7,
         category         = $8,
         collection       = $9,
         source_type      = $10,
         source_root_id   = $11,
         last_scan_run_id = $12,
         year             = $13,
         rating           = $14,
         featured         = $15,
         featured_order   = $16,
         trending_score   = $17,
         duplicate_count  = $18,
         metadata_status  = $19,
         published_at     = $20,
         released_at      = $21
     WHERE id = $1`,
    [
      updated.id, JSON.stringify(updated),
      cols.status, cols.content_type, cols.title, cols.title_key, cols.language, cols.category, cols.collection,
      cols.source_type, cols.source_root_id, cols.last_scan_run_id, cols.year, cols.rating, cols.featured,
      cols.featured_order, cols.trending_score, cols.duplicate_count, cols.metadata_status,
      cols.published_at, cols.released_at,
    ],
  );
  return getItemById(updated.id);
}

async function deleteItem(id) {
  await ensureContentStore();
  const result = await db.query('DELETE FROM content_catalog WHERE id = $1', [Number(id)]);
  return result.rowCount > 0;
}

async function deleteItemsByScanSignatures(scanSignatures = []) {
  const signatures = new Set((scanSignatures || []).filter(Boolean));
  if (!signatures.size) {
    return 0;
  }

  await ensureContentStore();
  const result = await db.query(
    'DELETE FROM content_catalog WHERE payload->>\'scanSignature\' = ANY($1::text[])',
    [[...signatures]],
  );
  return result.rowCount || 0;
}

async function upsertScannedItem(payload) {
  const now = new Date().toISOString();
  await ensureContentStore();
  const existing = await db.query(
    'SELECT id, payload FROM content_catalog WHERE payload->>\'scanSignature\' = $1 LIMIT 1',
    [payload.scanSignature],
  );
  const current = existing.rows[0]?.payload || null;

  if (!current) {
    const meta = await getCatalogMeta();
    const item = normalizeItem({
      id: meta.nextId,
      createdAt: now,
      updatedAt: now,
      sourceType: 'scanner',
      ...payload,
      titleKey: normalizeTitleKey(payload.title),
      status: payload.status || process.env.SCANNER_DEFAULT_STATUS || 'draft',
      lastScanRunId: payload.lastScanRunId || '',
      lastScanRunAt: payload.lastScanRunAt || now,
    });

    const insertCols = extractTypedColumns(item);
    await db.query(
      `INSERT INTO content_catalog (
         id, payload, created_at, updated_at,
         status, content_type, title, title_key, language, category, collection,
         source_type, source_root_id, last_scan_run_id, year, rating, featured,
         featured_order, trending_score, duplicate_count, metadata_status,
         published_at, released_at
       ) VALUES (
         $1, $2::jsonb, $3, $4,
         $5, $6, $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, $17,
         $18, $19, $20, $21,
         $22, $23
       )`,
      [
        item.id, JSON.stringify(item), now, now,
        insertCols.status, insertCols.content_type, insertCols.title, insertCols.title_key,
        insertCols.language, insertCols.category, insertCols.collection,
        insertCols.source_type, insertCols.source_root_id, insertCols.last_scan_run_id,
        insertCols.year, insertCols.rating, insertCols.featured,
        insertCols.featured_order, insertCols.trending_score, insertCols.duplicate_count,
        insertCols.metadata_status, insertCols.published_at, insertCols.released_at,
      ],
    );
    await setCatalogMeta({ nextId: meta.nextId + 1 });
    return { item: await getItemById(item.id), created: true, updated: false };
  }

  const item = normalizeItem({
    ...current,
    ...payload,
    id: current.id,
    sourceType: 'scanner',
    titleKey: normalizeTitleKey(payload.title || current.title),
    status: payload.status || current.status || 'draft',
    createdAt: current.createdAt || now,
    updatedAt: now,
    lastScanRunId: payload.lastScanRunId || current.lastScanRunId || '',
    lastScanRunAt: payload.lastScanRunAt || now,
  });

  const updateCols = extractTypedColumns(item);
  await db.query(
    `UPDATE content_catalog
     SET payload          = $2::jsonb,
         updated_at       = NOW(),
         status           = $3,
         content_type     = $4,
         title            = $5,
         title_key        = $6,
         language         = $7,
         category         = $8,
         collection       = $9,
         source_type      = $10,
         source_root_id   = $11,
         last_scan_run_id = $12,
         year             = $13,
         rating           = $14,
         featured         = $15,
         featured_order   = $16,
         trending_score   = $17,
         duplicate_count  = $18,
         metadata_status  = $19,
         published_at     = $20,
         released_at      = $21
     WHERE id = $1`,
    [
      item.id, JSON.stringify(item),
      updateCols.status, updateCols.content_type, updateCols.title, updateCols.title_key,
      updateCols.language, updateCols.category, updateCols.collection,
      updateCols.source_type, updateCols.source_root_id, updateCols.last_scan_run_id,
      updateCols.year, updateCols.rating, updateCols.featured,
      updateCols.featured_order, updateCols.trending_score, updateCols.duplicate_count,
      updateCols.metadata_status, updateCols.published_at, updateCols.released_at,
    ],
  );
  return { item: await getItemById(item.id), created: false, updated: true };
}

async function deleteScannerItemsNotInSignatures(sourceRootId, scanSignatures = []) {
  const rootId = String(sourceRootId || '').trim();
  if (!rootId) {
    return 0;
  }

  const signatures = [...new Set((scanSignatures || []).filter(Boolean))];

  let result;
  if (signatures.length) {
    result = await db.query(
      `DELETE FROM content_catalog
       WHERE source_type = $1
         AND source_root_id = $2
         AND COALESCE(payload->>'scanSignature', '') <> ALL($3::text[])`,
      ['scanner', rootId, signatures],
    );
  } else {
    result = await db.query(
      `DELETE FROM content_catalog
       WHERE source_type = $1
         AND source_root_id = $2`,
      ['scanner', rootId],
    );
  }

  return Number(result.rowCount || 0);
}

async function refreshCatalogReferencesForNormalizedFile(payload = {}) {
  const previousSourcePath = String(payload.previousSourcePath || '').trim();
  const nextSourcePath = String(payload.nextSourcePath || '').trim();
  const previousVideoUrl = String(payload.previousVideoUrl || '').trim();
  const nextVideoUrl = String(payload.nextVideoUrl || '').trim();

  if (!previousSourcePath || !nextSourcePath) {
    return { updatedItems: 0, updatedEpisodes: 0 };
  }

  const items = await getItems();
  let updatedItems = 0;
  let updatedEpisodes = 0;
  let mutated = false;
  const now = new Date().toISOString();

  const nextItems = items.map((item) => {
    let changed = false;
    const nextItem = { ...item };

    if (nextItem.sourcePath === previousSourcePath) {
      nextItem.sourcePath = nextSourcePath;
      changed = true;
    }

    if (previousVideoUrl && nextItem.videoUrl === previousVideoUrl) {
      nextItem.videoUrl = nextVideoUrl;
      changed = true;
    }

    if (previousVideoUrl && nextItem.sourcePublicPath === previousVideoUrl) {
      nextItem.sourcePublicPath = nextVideoUrl;
      changed = true;
    }

    if (Array.isArray(nextItem.seasons) && nextItem.seasons.length) {
      let seasonChanged = false;
      nextItem.seasons = nextItem.seasons.map((season) => {
        if (!Array.isArray(season?.episodes) || !season.episodes.length) {
          return season;
        }

        let episodeChanged = false;
        const episodes = season.episodes.map((episode) => {
          let localChanged = false;
          const nextEpisode = { ...episode };

          if (nextEpisode.sourcePath === previousSourcePath) {
            nextEpisode.sourcePath = nextSourcePath;
            localChanged = true;
          }

          if (previousVideoUrl && nextEpisode.videoUrl === previousVideoUrl) {
            nextEpisode.videoUrl = nextVideoUrl;
            localChanged = true;
          }

          if (localChanged) {
            updatedEpisodes += 1;
            episodeChanged = true;
          }

          return localChanged ? nextEpisode : episode;
        });

        if (!episodeChanged) {
          return season;
        }

        seasonChanged = true;
        return {
          ...season,
          episodes,
        };
      });

      if (seasonChanged) {
        changed = true;
      }
    }

    if (!changed) {
      return item;
    }

    updatedItems += 1;
    mutated = true;
    return normalizeItem({
      ...nextItem,
      updatedAt: now,
    });
  });

  if (mutated) {
    for (const item of nextItems) {
      const refItem = normalizeItem(item);
      const refCols = extractTypedColumns(refItem);
      await db.query(
        `INSERT INTO content_catalog (
           id, payload, created_at, updated_at,
           status, content_type, title, title_key, language, category, collection,
           source_type, source_root_id, last_scan_run_id, year, rating, featured,
           featured_order, trending_score, duplicate_count, metadata_status,
           published_at, released_at
         ) VALUES ($1, $2::jsonb, NOW(), NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
         ON CONFLICT (id) DO UPDATE SET
           payload          = EXCLUDED.payload,
           updated_at       = NOW(),
           status           = EXCLUDED.status,
           content_type     = EXCLUDED.content_type,
           title            = EXCLUDED.title,
           title_key        = EXCLUDED.title_key,
           language         = EXCLUDED.language,
           category         = EXCLUDED.category,
           collection       = EXCLUDED.collection,
           source_type      = EXCLUDED.source_type,
           source_root_id   = EXCLUDED.source_root_id,
           last_scan_run_id = EXCLUDED.last_scan_run_id,
           year             = EXCLUDED.year,
           rating           = EXCLUDED.rating,
           featured         = EXCLUDED.featured,
           featured_order   = EXCLUDED.featured_order,
           trending_score   = EXCLUDED.trending_score,
           duplicate_count  = EXCLUDED.duplicate_count,
           metadata_status  = EXCLUDED.metadata_status,
           published_at     = EXCLUDED.published_at,
           released_at      = EXCLUDED.released_at`,
        [
          refItem.id, JSON.stringify(refItem),
          refCols.status, refCols.content_type, refCols.title, refCols.title_key,
          refCols.language, refCols.category, refCols.collection,
          refCols.source_type, refCols.source_root_id, refCols.last_scan_run_id,
          refCols.year, refCols.rating, refCols.featured,
          refCols.featured_order, refCols.trending_score, refCols.duplicate_count,
          refCols.metadata_status, refCols.published_at, refCols.released_at,
        ],
      );
    }
  }

  return { updatedItems, updatedEpisodes };
}

async function getStats() {
  await ensureContentStore();
  const res = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'published')::int              AS published,
      COUNT(*) FILTER (WHERE status = 'draft')::int                  AS drafts,
      COUNT(*) FILTER (WHERE content_type = 'movie')::int            AS movies,
      COUNT(*) FILTER (WHERE content_type = 'series')::int           AS series,
      COUNT(*) FILTER (WHERE source_type = 'scanner' AND status = 'draft')::int AS scanner_drafts,
      COUNT(*) FILTER (WHERE source_type = 'scanner' AND status = 'draft' AND duplicate_count > 0)::int AS duplicate_drafts
    FROM content_catalog
  `);

  const row = res.rows[0];
  return {
    totalContent: row.total,
    publishedContent: row.published,
    draftContent: row.drafts,
    totalMovies: row.movies,
    totalSeries: row.series,
    scannerDrafts: row.scanner_drafts,
    duplicateDrafts: row.duplicate_drafts,
  };
}

async function getRecentItems(limit = 10) {
  const { items } = await listItems({}, 0, limit);
  return items;
}

function loadScannerRoots() {
  return appStateCache.get('scanner_roots') || [];
}

async function saveScannerRoots(roots) {
  await ensureContentStore();
  const rootsArray = Array.isArray(roots) ? roots : [];
  const incomingIds = rootsArray.map((r) => String(r.id || '')).filter(Boolean);

  // Delete roots that are no longer in the list
  if (incomingIds.length) {
    await db.query('DELETE FROM scanner_roots WHERE id <> ALL($1::text[])', [incomingIds]);
  } else {
    await db.query('DELETE FROM scanner_roots');
  }

  // Upsert each root into the relational table
  for (const root of rootsArray) {
    await db.query(
      `INSERT INTO scanner_roots (
         id, label, scan_path, public_base_url, type, language, category,
         max_depth, batch_size, enabled, discovered, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (id) DO UPDATE SET
         label           = EXCLUDED.label,
         scan_path       = EXCLUDED.scan_path,
         public_base_url = EXCLUDED.public_base_url,
         type            = EXCLUDED.type,
         language        = EXCLUDED.language,
         category        = EXCLUDED.category,
         max_depth       = EXCLUDED.max_depth,
         batch_size      = EXCLUDED.batch_size,
         enabled         = EXCLUDED.enabled,
         discovered      = EXCLUDED.discovered,
         updated_at      = NOW()`,
      [
        String(root.id || ''),
        String(root.label || ''),
        String(root.scanPath || ''),
        String(root.publicBaseUrl || ''),
        String(root.type || 'movie'),
        String(root.language || ''),
        String(root.category || ''),
        root.maxDepth  != null ? Number(root.maxDepth)  : null,
        root.batchSize != null ? Number(root.batchSize) : null,
        root.enabled !== false,
        Boolean(root.discovered),
      ],
    );
  }

  appStateCache.set('scanner_roots', rootsArray);
  return rootsArray;
}

async function recordScannerRun(entry) {
  await ensureContentStore();
  await db.query(
    `INSERT INTO scanner_runs (
       id, status, started_at, completed_at, root_ids,
       roots_requested, roots_scanned,
       total_created, total_updated, total_deleted, total_unchanged, total_duplicate_drafts,
       skipped, errors, root_results, error, created_at
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17)
     ON CONFLICT (id) DO UPDATE SET
       status                 = EXCLUDED.status,
       completed_at           = EXCLUDED.completed_at,
       roots_scanned          = EXCLUDED.roots_scanned,
       total_created          = EXCLUDED.total_created,
       total_updated          = EXCLUDED.total_updated,
       total_deleted          = EXCLUDED.total_deleted,
       total_unchanged        = EXCLUDED.total_unchanged,
       total_duplicate_drafts = EXCLUDED.total_duplicate_drafts,
       skipped                = EXCLUDED.skipped,
       errors                 = EXCLUDED.errors,
       root_results           = EXCLUDED.root_results,
       error                  = EXCLUDED.error`,
    [
      String(entry.id || ''),
      String(entry.status || 'completed'),
      entry.startedAt   || null,
      entry.completedAt || null,
      JSON.stringify(entry.rootIds     || []),
      toSafeInteger(entry.rootsRequested),
      toSafeInteger(entry.rootsScanned),
      toSafeInteger(entry.created),
      toSafeInteger(entry.updated),
      toSafeInteger(entry.deleted),
      toSafeInteger(entry.unchanged),
      toSafeInteger(entry.duplicateDrafts),
      JSON.stringify(entry.skipped     || []),
      JSON.stringify(entry.errors      || []),
      JSON.stringify(entry.rootResults || []),
      entry.error || null,
      entry.startedAt || new Date().toISOString(),
    ],
  );

  // Keep in-memory cache in sync (newest first, capped at MAX_SCANNER_RUNS)
  const current = appStateCache.get('scanner_log') || { runs: [] };
  const runs = [entry, ...(current.runs || []).filter((r) => r.id !== entry.id)].slice(0, MAX_SCANNER_RUNS);
  appStateCache.set('scanner_log', { runs });
  return entry;
}

function getScannerRuns(limit = 10) {
  return (loadScannerLog().runs || []).slice(0, limit);
}

async function findAdminByUsername(username) {
  await ensureContentStore();
  const result = await db.query(
    'SELECT id, username, password_hash, role, created_at, updated_at, last_login FROM admin_users WHERE username = $1 LIMIT 1',
    [String(username || '').trim()],
  );
  return result.rows[0] || null;
}

async function touchAdminLogin(id) {
  await ensureContentStore();
  await db.query('UPDATE admin_users SET last_login = NOW(), updated_at = NOW() WHERE id = $1', [Number(id)]);
}

async function ensureUser(externalId) {
  await ensureContentStore();
  const normalized = String(externalId || 'guest').trim() || 'guest';
  const inserted = await db.query(
    `INSERT INTO users (external_id, updated_at)
     VALUES ($1, NOW())
     ON CONFLICT (external_id) DO UPDATE SET updated_at = NOW()
     RETURNING id, external_id`,
    [normalized],
  );
  return inserted.rows[0];
}

async function getWatchlistEntries(externalUserId) {
  const user = await ensureUser(externalUserId);
  const result = await db.query(
    `SELECT id, content_type, content_id, created_at
     FROM watchlist_entries
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC`,
    [user.id],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    userId: user.external_id,
    contentType: row.content_type,
    contentId: Number(row.content_id),
    addedAt: row.created_at,
  }));
}

async function addWatchlistEntry(externalUserId, contentType, contentId) {
  const user = await ensureUser(externalUserId);
  const result = await db.query(
    `INSERT INTO watchlist_entries (user_id, content_type, content_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, content_type, content_id) DO NOTHING
     RETURNING id, created_at`,
    [user.id, String(contentType), Number(contentId)],
  );
  if (!result.rows.length) {
    return null;
  }
  return {
    id: Number(result.rows[0].id),
    userId: user.external_id,
    contentType: String(contentType),
    contentId: Number(contentId),
    addedAt: result.rows[0].created_at,
  };
}

async function removeWatchlistEntry(externalUserId, entryId) {
  const user = await ensureUser(externalUserId);
  const result = await db.query('DELETE FROM watchlist_entries WHERE id = $1 AND user_id = $2', [Number(entryId), user.id]);
  return result.rowCount > 0;
}

async function getWatchProgressEntries(externalUserId, { incompleteOnly = false, contentType = '', contentId = null } = {}) {
  const user = await ensureUser(externalUserId);
  const conditions = ['user_id = $1'];
  const params = [user.id];

  if (incompleteOnly) {
    conditions.push('completed = FALSE');
  }
  if (contentType) {
    params.push(String(contentType));
    conditions.push(`content_type = $${params.length}`);
  }
  if (contentId !== null && contentId !== undefined) {
    params.push(Number(contentId));
    conditions.push(`content_id = $${params.length}`);
  }

  const result = await db.query(
    `SELECT id, content_type, content_id, position, duration, completed, updated_at
     FROM watch_progress
     WHERE ${conditions.join(' AND ')}
     ORDER BY updated_at DESC, id DESC`,
    params,
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    userId: user.external_id,
    contentType: row.content_type,
    contentId: Number(row.content_id),
    position: Number(row.position || 0),
    duration: Number(row.duration || 0),
    completed: Boolean(row.completed),
    updatedAt: row.updated_at,
    last_position: Number(row.position || 0),
  }));
}

async function upsertWatchProgress(externalUserId, { contentType, contentId, position = 0, duration = 0, completed = false }) {
  const user = await ensureUser(externalUserId);
  const result = await db.query(
    `INSERT INTO watch_progress (user_id, content_type, content_id, position, duration, completed, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id, content_type, content_id)
     DO UPDATE SET position = EXCLUDED.position, duration = EXCLUDED.duration, completed = EXCLUDED.completed, updated_at = NOW()
     RETURNING id, content_type, content_id, position, duration, completed, updated_at`,
    [user.id, String(contentType), Number(contentId), Number(position || 0), Number(duration || 0), Boolean(completed)],
  );
  const row = result.rows[0];
  return {
    id: Number(row.id),
    userId: user.external_id,
    contentType: row.content_type,
    contentId: Number(row.content_id),
    position: Number(row.position || 0),
    duration: Number(row.duration || 0),
    completed: Boolean(row.completed),
    updatedAt: row.updated_at,
    last_position: Number(row.position || 0),
  };
}

async function markWatchProgressComplete(externalUserId, { contentType, contentId }) {
  return upsertWatchProgress(externalUserId, { contentType, contentId, position: 0, duration: 0, completed: true });
}

function buildRecentSearchKey(externalUserId) {
  return `recent_searches:${String(externalUserId || 'guest').trim() || 'guest'}`;
}

async function recordRecentSearch(externalUserId, query, metadata = {}) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return [];
  }

  const key = buildRecentSearchKey(externalUserId);
  const current = await getAppState(key, { items: [] });
  const items = Array.isArray(current?.items) ? current.items : [];
  const now = new Date().toISOString();
  const normalizedType = String(metadata.type || '').trim();
  const normalizedGenre = String(metadata.genre || '').trim();
  const normalizedLanguage = String(metadata.language || '').trim();
  const normalizedYear = String(metadata.year || '').trim();

  const nextItems = [
    {
      query: normalizedQuery,
      type: normalizedType,
      genre: normalizedGenre,
      language: normalizedLanguage,
      year: normalizedYear,
      searchedAt: now,
    },
    ...items.filter((item) => String(item.query || '').trim().toLowerCase() !== normalizedQuery.toLowerCase()),
  ].slice(0, 20);

  await setAppState(key, { items: nextItems });
  return nextItems;
}

async function getRecentSearches(externalUserId, limit = 10) {
  const key = buildRecentSearchKey(externalUserId);
  const state = await getAppState(key, { items: [] });
  const items = Array.isArray(state?.items) ? state.items : [];
  return items.slice(0, Math.max(1, Number(limit) || 10));
}

async function getMediaNormalizerState() {
  return getAppState('media_normalizer_state', null);
}

async function saveMediaNormalizerState(payload) {
  return setAppState('media_normalizer_state', payload);
}

function getMediaNormalizerLog(limit = 25) {
  const lines = appStateCache.get('media_normalizer_log')?.lines || [];
  return lines.slice(-Math.max(1, limit));
}

async function appendMediaNormalizerLog(lines = []) {
  const current = appStateCache.get('media_normalizer_log')?.lines || [];
  const next = [...current, ...lines.map((line) => String(line))].slice(-500);
  return setAppState('media_normalizer_log', { lines: next });
}

module.exports = {
  addWatchlistEntry,
  appendMediaNormalizerLog,
  createItem,
  deleteItemsByScanSignatures,
  deleteScannerItemsNotInSignatures,
  deleteItem,
  ensureContentStore,
  ensureUser,
  findAdminByUsername,
  getItemById,
  getItemsByIds,
  getItemByScanSignature,
  getMediaNormalizerLog,
  getMediaNormalizerState,
  getRecentItems,
  getRecentSearches,
  getScannerRuns,
  getSuggestions,
  getStats,
  getWatchProgressEntries,
  getWatchlistEntries,
  listItems,
  loadScannerRoots,
  loadScannerRuntime,
  loadScannerState,
  markWatchProgressComplete,
  normalizeTitleKey,
  pruneCatalog,
  recordScannerRun,
  recordRecentSearch,
  refreshCatalogReferencesForNormalizedFile,
  removeWatchlistEntry,
  saveMediaNormalizerState,
  saveScannerRoots,
  saveScannerRuntime,
  saveScannerState,
  searchItems,
  touchAdminLogin,
  upsertWatchProgress,
  updateItem,
  upsertScannedItem,
  getLibraryOrganization,
};

async function getLibraryOrganization(filters = {}) {
  await ensureContentStore();
  const params = [];
  const clauses = buildCatalogFilterClauses(filters, params);
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  // All GROUP BY queries now use typed columns — no JSONB expression evaluation
  const totalsPromise = db.query(`
    SELECT
      COUNT(*)::int                    AS items,
      COUNT(DISTINCT collection)::int  AS collections
    FROM content_catalog
    ${whereClause}
  `, params);

  const categoriesPromise = db.query(`
    SELECT category AS label, COUNT(*)::int AS count
    FROM content_catalog
    ${whereClause}
    GROUP BY label
    ORDER BY count DESC, label ASC
    LIMIT 200
  `, params);

  const languagesPromise = db.query(`
    SELECT language AS label, COUNT(*)::int AS count
    FROM content_catalog
    ${whereClause}
    GROUP BY label
    ORDER BY count DESC, label ASC
    LIMIT 200
  `, params);

  const collectionsPromise = db.query(`
    SELECT collection AS label, COUNT(*)::int AS count
    FROM content_catalog
    ${whereClause ? whereClause + '\n    AND' : 'WHERE'} collection <> ''
    GROUP BY label
    ORDER BY count DESC, label ASC
    LIMIT 200
  `, params);

  const rootsPromise = db.query(`
    SELECT COALESCE(NULLIF(payload->>'sourceRootLabel', ''), source_root_id) AS label,
           COUNT(*)::int AS count
    FROM content_catalog
    ${whereClause}
    GROUP BY label
    ORDER BY count DESC, label ASC
    LIMIT 100
  `, params);

  // Tags live in JSONB arrays — filter rows first in a subquery so the lateral
  // expansion only touches matching rows, not the entire table.
  const tagsPromise = db.query(`
    SELECT tag AS label, COUNT(*)::int AS count
    FROM (
      SELECT payload->'tags' AS tags
      FROM content_catalog
      ${whereClause}
    ) AS filtered,
    jsonb_array_elements_text(COALESCE(filtered.tags, '[]'::jsonb)) AS tag
    GROUP BY label
    ORDER BY count DESC, label ASC
    LIMIT 200
  `, params);

  const [totalsRes, categoriesRes, languagesRes, collectionsRes, rootsRes, tagsRes] = await Promise.all([
    totalsPromise,
    categoriesPromise,
    languagesPromise,
    collectionsPromise,
    rootsPromise,
    tagsPromise,
  ]);

  return {
    totals: {
      items: totalsRes.rows[0]?.items || 0,
      collections: totalsRes.rows[0]?.collections || 0,
      tags: tagsRes.rows.length,
    },
    collections: collectionsRes.rows,
    tags: tagsRes.rows,
    categories: categoriesRes.rows,
    languages: languagesRes.rows,
    roots: rootsRes.rows.filter((r) => r.label !== null),
  };
}
