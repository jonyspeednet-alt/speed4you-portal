const fs = require('fs');
const { db, ensureContentStore } = require('./base');
const { JUNK_REGEX, MIN_EPISODE_SIZE, MIN_MOVIE_SIZE } = require('./constants');
const { normalizeItem, normalizeTitleKey, extractTypedColumns, attachDuplicateMetadata } = require('./helpers');
const { scoreSearchResult } = require('./helpers-search');

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

async function allocateNextCatalogId() {
  await ensureContentStore();
  const pool = await db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const [stateResult, maxIdResult] = await Promise.all([
      client.query(`SELECT value FROM app_state WHERE key = 'catalog_meta' LIMIT 1 FOR UPDATE`),
      client.query('SELECT COALESCE(MAX(id), 0)::bigint AS max_id FROM content_catalog'),
    ]);
    const currentMeta = stateResult.rows[0]?.value || { nextId: 1 };
    const currentNextId = Number(currentMeta.nextId || 1);
    const maxId = Number(maxIdResult.rows[0]?.max_id || 0);
    const nextId = Math.max(currentNextId, maxId + 1, 1);
    await client.query(
      `INSERT INTO app_state (key, value, updated_at)
       VALUES ('catalog_meta', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify({ nextId: nextId + 1 })],
    );
    await client.query('COMMIT');
    return nextId;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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

  if (filters.tag) {
    clauses.push(`COALESCE(payload->'tags', '[]'::jsonb) ? ${push(String(filters.tag))}`);
  }
  if (filters.genre) {
    clauses.push(`payload->>'genre' = ${push(String(filters.genre))}`);
  }

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

async function getDuplicateGroupsForItems(items = []) {
  if (!items.length) return new Map();
  await ensureContentStore();
  const keys = [...new Set(items.map((item) => `${item.type}:${item.titleKey || normalizeTitleKey(item.title)}`))];
  const conditions = [];
  const params = [];

  keys.forEach((key) => {
    const colonIndex = key.indexOf(':');
    const type = key.slice(0, colonIndex);
    const titleKey = key.slice(colonIndex + 1);
    params.push(type);
    const typeIndex = params.length;
    params.push(titleKey);
    const titleKeyIndex = params.length;
    conditions.push(`(content_type = $${typeIndex} AND title_key = $${titleKeyIndex})`);
  });

  const result = await db.query(`SELECT payload FROM content_catalog WHERE ${conditions.join(' OR ')}`, params);
  const groups = new Map();
  result.rows.forEach((row) => {
    const item = normalizeItem(row.payload);
    const key = `${item.type}:${item.titleKey || normalizeTitleKey(item.title)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

async function listItems(filters = {}, offset = 0, limit = null, sort = 'latest', includeDuplicates = true) {
  await ensureContentStore();
  const params = [];
  const clauses = buildCatalogFilterClauses(filters, params);
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM content_catalog ${whereClause}`, params);
  const total = Number(countResult.rows[0]?.count || 0);

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

  const result = await db.query(`SELECT payload FROM content_catalog ${whereClause} ${orderClause} ${pagingClause}`, listParams);
  const items = result.rows.map((row) => normalizeItem(row.payload));
  if (!includeDuplicates) return { items, total };

  const duplicateGroups = await getDuplicateGroupsForItems(items);
  return { items: items.map((item) => attachDuplicateMetadata(item, duplicateGroups)), total };
}

async function getItemById(idOrSlug) {
  await ensureContentStore();
  const numericId = Number(idOrSlug);
  let result;
  if (Number.isFinite(numericId) && numericId > 0) {
    result = await db.query('SELECT payload FROM content_catalog WHERE id = $1 LIMIT 1', [numericId]);
  } else {
    result = await db.query("SELECT payload FROM content_catalog WHERE payload->>'slug' = $1 LIMIT 1", [String(idOrSlug)]);
  }
  const payload = result.rows[0]?.payload;
  if (!payload) return null;
  const item = normalizeItem(payload);
  const duplicateGroups = await getDuplicateGroupsForItems([item]);
  return attachDuplicateMetadata(item, duplicateGroups);
}

async function getItemsByIds(ids = []) {
  const numericIds = [...new Set(ids.map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (!numericIds.length) return new Map();
  await ensureContentStore();
  const result = await db.query('SELECT payload FROM content_catalog WHERE id = ANY($1::bigint[])', [numericIds]);
  const itemsMap = new Map();
  for (const row of result.rows) {
    const item = normalizeItem(row.payload);
    itemsMap.set(Number(item.id), item);
  }
  return itemsMap;
}

async function createItem(payload) {
  const now = new Date().toISOString();
  const item = normalizeItem({
    id: await allocateNextCatalogId(),
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
     ) VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
    [item.id, JSON.stringify(item), now, now, cols.status, cols.content_type, cols.title, cols.title_key, cols.language, cols.category, cols.collection, cols.source_type, cols.source_root_id, cols.last_scan_run_id, cols.year, cols.rating, cols.featured, cols.featured_order, cols.trending_score, cols.duplicate_count, cols.metadata_status, cols.published_at, cols.released_at]
  );
  return getItemById(item.id);
}

async function updateItem(id, payload) {
  const current = await getItemById(id);
  if (!current) return null;
  const updated = normalizeItem({ ...current, ...payload, id: current.id, titleKey: normalizeTitleKey(payload.title || current.title), updatedAt: new Date().toISOString() });
  const cols = extractTypedColumns(updated);
  await db.query(
    `UPDATE content_catalog SET payload = $2::jsonb, updated_at = NOW(), status = $3, content_type = $4, title = $5, title_key = $6, language = $7, category = $8, collection = $9, source_type = $10, source_root_id = $11, last_scan_run_id = $12, year = $13, rating = $14, featured = $15, featured_order = $16, trending_score = $17, duplicate_count = $18, metadata_status = $19, published_at = $20, released_at = $21 WHERE id = $1`,
    [updated.id, JSON.stringify(updated), cols.status, cols.content_type, cols.title, cols.title_key, cols.language, cols.category, cols.collection, cols.source_type, cols.source_root_id, cols.last_scan_run_id, cols.year, cols.rating, cols.featured, cols.featured_order, cols.trending_score, cols.duplicate_count, cols.metadata_status, cols.published_at, cols.released_at]
  );
  return getItemById(updated.id);
}

async function deleteItem(id) {
  await ensureContentStore();
  const result = await db.query('DELETE FROM content_catalog WHERE id = $1', [Number(id)]);
  return result.rowCount > 0;
}

async function searchItems(query, filters = {}) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return { items: [], total: 0 };
  await ensureContentStore();
  const searchFilters = { ...filters, status: filters.status || 'published', search: normalizedQuery };
  const params = [];
  const clauses = buildCatalogFilterClauses(searchFilters, params);
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await db.query(`SELECT payload FROM content_catalog ${whereClause} LIMIT 500`, params);
  const items = result.rows.map((row) => normalizeItem(row.payload));
  const duplicateGroups = await getDuplicateGroupsForItems(items);
  // scoreSearchResult and search logic here...
  // (Moving scoreSearchResult to helpers or keeping here)
  const scoredItems = items
    .map((item) => ({ ...attachDuplicateMetadata(item, duplicateGroups), searchScore: scoreSearchResult(item, normalizedQuery) }))
    .filter((item) => item.searchScore > 0)
    .sort((left, right) => right.searchScore - left.searchScore || (right.trendingScore || 0) - (left.trendingScore || 0));
  return { items: scoredItems, total: scoredItems.length };
}

async function getSuggestions(query, limit = 8) {
  const result = await searchItems(query, { status: 'published' });
  return (result.items || []).slice(0, limit).map((item) => ({ id: item.id, title: item.title, type: item.type, year: item.year, language: item.language, genre: item.genre }));
}

async function pruneCatalog() {
  await ensureContentStore();
  const { items } = await listItems({}, 0, null, 'latest', false);
  const toDelete = [];
  for (const item of items) {
    const isJunk = JUNK_REGEX.test(item.title) || (item.sourcePath && JUNK_REGEX.test(item.sourcePath));
    if (isJunk) { toDelete.push(item.id); continue; }
    if (item.sourcePath && fs.existsSync(item.sourcePath)) {
      try {
        const stats = fs.statSync(item.sourcePath);
        const minSize = item.type === 'series' ? MIN_EPISODE_SIZE : MIN_MOVIE_SIZE;
        if (stats.size < minSize) toDelete.push(item.id);
      } catch {}
    } else if (item.sourcePath) { toDelete.push(item.id); }
  }
  if (toDelete.length) await db.query('DELETE FROM content_catalog WHERE id = ANY($1)', [toDelete]);
  return { deletedCount: toDelete.length };
}

async function vacuumDatabase() {
  await ensureContentStore();
  if (!db.isInMemory) {
    try {
      await db.query('VACUUM ANALYZE content_catalog');
      await db.query('VACUUM ANALYZE app_state');
      await db.query('VACUUM ANALYZE scanner_runs');
      return { success: true };
    } catch (err) {
      console.error('Vacuum failed:', err);
      return { success: false, error: err.message };
    }
  }
  return { success: true };
}

async function getLibraryOrganization(filters = {}) {
  await ensureContentStore();
  const params = [];
  const clauses = buildCatalogFilterClauses(filters, params);
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const totalsPromise = db.query(`SELECT COUNT(*)::int AS items, COUNT(DISTINCT collection)::int AS collections FROM content_catalog ${whereClause}`, params);
  const categoriesPromise = db.query(`SELECT category AS label, COUNT(*)::int AS count FROM content_catalog ${whereClause} GROUP BY label ORDER BY count DESC, label ASC LIMIT 200`, params);
  const languagesPromise = db.query(`SELECT language AS label, COUNT(*)::int AS count FROM content_catalog ${whereClause} GROUP BY label ORDER BY count DESC, label ASC LIMIT 200`, params);
  const collectionsPromise = db.query(`SELECT collection AS label, COUNT(*)::int AS count FROM content_catalog ${whereClause ? whereClause + '\n    AND' : 'WHERE'} collection <> '' GROUP BY label ORDER BY count DESC, label ASC LIMIT 200`, params);
  const rootsPromise = db.query(`SELECT COALESCE(NULLIF(payload->>'sourceRootLabel', ''), source_root_id) AS label, COUNT(*)::int AS count FROM content_catalog ${whereClause} GROUP BY label ORDER BY count DESC, label ASC LIMIT 100`, params);
  const tagsPromise = db.query(`SELECT tag AS label, COUNT(*)::int AS count FROM (SELECT payload->'tags' AS tags FROM content_catalog ${whereClause}) AS filtered, jsonb_array_elements_text(COALESCE(filtered.tags, '[]'::jsonb)) AS tag GROUP BY label ORDER BY count DESC, label ASC LIMIT 200`, params);
  const [totalsRes, categoriesRes, languagesRes, collectionsRes, rootsRes, tagsRes] = await Promise.all([totalsPromise, categoriesPromise, languagesPromise, collectionsPromise, rootsPromise, tagsPromise]);
  return { totals: { items: totalsRes.rows[0]?.items || 0, collections: totalsRes.rows[0]?.collections || 0, tags: tagsRes.rows.length }, collections: collectionsRes.rows, tags: tagsRes.rows, categories: categoriesRes.rows, languages: languagesRes.rows, roots: rootsRes.rows.filter((r) => r.label !== null) };
}

module.exports = {
  getCatalogMeta,
  setCatalogMeta,
  allocateNextCatalogId,
  getItems,
  listItems,
  getItemById,
  getItemsByIds,
  createItem,
  updateItem,
  deleteItem,
  searchItems,
  getSuggestions,
  pruneCatalog,
  vacuumDatabase,
  getLibraryOrganization,
  getDuplicateGroupsForItems,
};
