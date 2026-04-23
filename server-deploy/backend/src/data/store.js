const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const catalogPath = path.resolve(__dirname, 'catalog.json');
const scannerRootsPath = path.resolve(__dirname, 'scanner-roots.json');
const scannerLogPath = path.resolve(__dirname, 'scanner-log.json');
const scannerStatePath = path.resolve(__dirname, 'scanner-state.json');
const scannerRuntimePath = path.resolve(__dirname, 'scanner-runtime.json');
const MAX_SCANNER_RUNS = 30;
const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2a$10$ejyljPiCt5J0tvO68DS99OnzyystXkHwgn9pN44txXcxGs/XLlKtK';
const APP_STATE_DEFAULTS = {
  scanner_roots: [],
  scanner_log: { runs: [] },
  scanner_state: { roots: {} },
  scanner_runtime: { currentJob: null, queue: [] },
  media_normalizer_state: null,
  media_normalizer_log: { lines: [] },
};
const appStateCache = new Map();

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
      await db.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await db.query(`
        CREATE TABLE IF NOT EXISTS content_catalog (
          id BIGINT PRIMARY KEY,
          payload JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
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
        const legacyItems = Array.isArray(legacyCatalog.items) ? legacyCatalog.items : [];
        if (legacyItems.length) {
          for (const item of legacyItems) {
            const normalizedItem = normalizeItem(item);
            await db.query(
              `INSERT INTO content_catalog (id, payload, created_at, updated_at)
               VALUES ($1, $2::jsonb, NOW(), NOW())
               ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
              [normalizedItem.id, JSON.stringify(normalizedItem)],
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

  if (filters.status) {
    clauses.push(`payload->>'status' = ${push(String(filters.status))}`);
  }

  if (filters.type) {
    clauses.push(`payload->>'type' = ${push(String(filters.type))}`);
  }

  if (filters.source) {
    clauses.push(`payload->>'sourceType' = ${push(String(filters.source))}`);
  }

  if (filters.sourceRootId) {
    clauses.push(`payload->>'sourceRootId' = ${push(String(filters.sourceRootId))}`);
  }

  if (filters.scanRunId) {
    clauses.push(`payload->>'lastScanRunId' = ${push(String(filters.scanRunId))}`);
  }

  if (filters.language) {
    clauses.push(`payload->>'language' = ${push(String(filters.language))}`);
  }

  if (filters.category) {
    clauses.push(`payload->>'category' = ${push(String(filters.category))}`);
  }

  if (filters.collection) {
    clauses.push(`payload->>'collection' = ${push(String(filters.collection))}`);
  }

  if (filters.tag) {
    clauses.push(`COALESCE(payload->'tags', '[]'::jsonb) ? ${push(String(filters.tag))}`);
  }

  if (filters.search) {
    const term = `%${String(filters.search).trim().toLowerCase()}%`;
    const placeholder = push(term);
    clauses.push(`LOWER(CONCAT_WS(' ',
      payload->>'title',
      payload->>'genre',
      payload->>'language',
      payload->>'category',
      payload->>'description',
      payload->>'originalTitle',
      payload->>'year'
    )) LIKE ${placeholder}`);
  }

  return clauses;
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
    conditions.push(`((payload->>'type' = $${typeIndex}) AND (COALESCE(payload->>'titleKey', '') = $${titleKeyIndex}))`);
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

async function listItems(filters = {}, offset = 0, limit = null) {
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
     ORDER BY COALESCE((payload->>'updatedAt')::timestamptz, updated_at) DESC, id DESC
     ${pagingClause}`,
    listParams,
  );

  const items = result.rows.map((row) => normalizeItem(row.payload));
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
    return [];
  }

  let { items } = await listItems({ status: filters.status || 'published' });

  if (filters.type) {
    items = items.filter((item) => item.type === filters.type);
  }

  if (filters.language) {
    items = items.filter((item) => item.language === filters.language);
  }

  if (filters.genre) {
    items = items.filter((item) => String(item.genre || '').toLowerCase().includes(String(filters.genre).toLowerCase()));
  }

  return items
    .filter((item) => [
      item.title,
      item.genre,
      item.language,
      item.category,
      item.description,
      item.collection,
      item.originalTitle,
      item.year,
    ].join(' ').toLowerCase().includes(normalizedQuery.toLowerCase()))
    .map((item) => ({
      ...item,
      searchScore: scoreSearchResult(item, normalizedQuery),
    }))
    .filter((item) => item.searchScore > 0)
    .sort((left, right) => right.searchScore - left.searchScore || (right.trendingScore || 0) - (left.trendingScore || 0));
}

async function getSuggestions(query, limit = 8) {
  const matches = (await searchItems(query, { status: 'published' })).slice(0, limit);
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

  await db.query(
    `INSERT INTO content_catalog (id, payload, created_at, updated_at)
     VALUES ($1, $2::jsonb, $3, $4)`,
    [item.id, JSON.stringify(item), now, now],
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

  await db.query(
    `UPDATE content_catalog
     SET payload = $2::jsonb, updated_at = NOW()
     WHERE id = $1`,
    [updated.id, JSON.stringify(updated)],
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

    await db.query(
      `INSERT INTO content_catalog (id, payload, created_at, updated_at)
       VALUES ($1, $2::jsonb, $3, $4)`,
      [item.id, JSON.stringify(item), now, now],
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

  await db.query(
    `UPDATE content_catalog
     SET payload = $2::jsonb, updated_at = NOW()
     WHERE id = $1`,
    [item.id, JSON.stringify(item)],
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
       WHERE payload->>'sourceType' = $1
         AND payload->>'sourceRootId' = $2
         AND COALESCE(payload->>'scanSignature', '') <> ALL($3::text[])`,
      ['scanner', rootId, signatures],
    );
  } else {
    result = await db.query(
      `DELETE FROM content_catalog
       WHERE payload->>'sourceType' = $1
         AND payload->>'sourceRootId' = $2`,
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
      await db.query(
        `INSERT INTO content_catalog (id, payload, created_at, updated_at)
         VALUES ($1, $2::jsonb, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
        [item.id, JSON.stringify(normalizeItem(item))],
      );
    }
  }

  return { updatedItems, updatedEpisodes };
}

async function getStats() {
  const { items } = await listItems();
  const published = items.filter((item) => item.status === 'published');
  const drafts = items.filter((item) => item.status === 'draft');
  const movies = items.filter((item) => item.type === 'movie');
  const series = items.filter((item) => item.type === 'series');
  const scannerDrafts = items.filter((item) => item.sourceType === 'scanner' && item.status === 'draft');
  const duplicateDrafts = scannerDrafts.filter((item) => item.duplicateCount > 0);

  return {
    totalContent: items.length,
    publishedContent: published.length,
    draftContent: drafts.length,
    totalMovies: movies.length,
    totalSeries: series.length,
    scannerDrafts: scannerDrafts.length,
    duplicateDrafts: duplicateDrafts.length,
  };
}

async function getRecentItems(limit = 10) {
  const { items } = await listItems();
  return items.slice(0, limit);
}

function loadScannerRoots() {
  return appStateCache.get('scanner_roots') || [];
}

async function saveScannerRoots(payload) {
  return setAppState('scanner_roots', payload);
}

async function recordScannerRun(entry) {
  const log = loadScannerLog();
  const runs = [entry, ...(log.runs || [])].slice(0, MAX_SCANNER_RUNS);
  await saveScannerLog({ runs });
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
  getItemByScanSignature,
  getMediaNormalizerLog,
  getMediaNormalizerState,
  getRecentItems,
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
  recordScannerRun,
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
  const { items } = await listItems(filters, 0, null);
  const summarize = (values) => Object.entries(values)
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  const collections = {};
  const tags = {};
  const categories = {};
  const languages = {};
  const roots = {};

  items.forEach((item) => {
    if (item.collection) {
      collections[item.collection] = (collections[item.collection] || 0) + 1;
    }
    if (item.category) {
      categories[item.category] = (categories[item.category] || 0) + 1;
    }
    if (item.language) {
      languages[item.language] = (languages[item.language] || 0) + 1;
    }
    if (item.sourceRootLabel || item.sourceRootId) {
      const key = item.sourceRootLabel || item.sourceRootId;
      roots[key] = (roots[key] || 0) + 1;
    }
    item.tags.forEach((tag) => {
      tags[tag] = (tags[tag] || 0) + 1;
    });
  });

  return {
    totals: {
      items: items.length,
      collections: Object.keys(collections).length,
      tags: Object.keys(tags).length,
    },
    collections: summarize(collections),
    tags: summarize(tags),
    categories: summarize(categories),
    languages: summarize(languages),
    roots: summarize(roots),
  };
}
