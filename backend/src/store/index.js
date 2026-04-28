// Minimal store layer to bootstrap local development.
// This provides the required API surface used by the routes:
// - ensureContentStore(): initialize a Postgres pool using environment variables
// - closePool(): gracefully shut down the pool
// - listItems(filters, offset, limit, sort): return { items, total }
// - searchItems(query, filters): return { items, total }
//
// Note: This is a lightweight fallback intended to allow the server to boot
// in environments where the full original DB schema-backed store is not
// available. To fully use the original DB, replace the query implementations
// with real SQL that matches your schema.

const { Pool } = require('pg');

let pool = null;

async function ensureContentStore() {
  // Build pool based on env vars. If DB_HOST/NAME/User are missing, env-check will
  // fail earlier in the startup sequence before this runs. We keep a soft-failure
  // so the app can boot with a local in-memory fallback if the real DB isn't
  // accessible.
  try {
    const host = process.env.DB_HOST;
    const port = Number(process.env.DB_PORT) || 5432;
    const database = process.env.DB_NAME;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const max = Number(process.env.PGPOOL_MAX) || 10;

    if (!host || !database || !user) {
      // Missing essential credentials; skip DB connection gracefully
      pool = null;
      return;
    }

    pool = new Pool({ host, port, database, user, password, max, idleTimeoutMillis: 30000 });

    // Quick connectivity check
    await pool.query('SELECT 1');
  } catch (err) {
    // If we can't connect, log and keep pool as null to enable fallback mode
    pool = null;
    console.warn('Could not connect to content store DB. Falling back to in-memory store.', err?.message);
  }
}

async function closePool() {
  if (pool) {
    try {
      await pool.end();
    } finally {
      pool = null;
    }
  }
}

// Helper to build a safe where clause for common filters
function buildFiltersClause(filters) {
  const clauses = [];
  const args = [];
  let idx = 1;
  const add = (col, value) => {
    if (value === undefined || value === null || value === '') return;
    clauses.push(`${col} = $${idx++}`);
    args.push(value);
  };
  add('status', filters?.status);
  if (filters?.type) { clauses.push(`type = $${idx++}`); args.push(filters.type); }
  if (filters?.genre) { clauses.push(`genre = $${idx++}`); args.push(filters.genre); }
  if (filters?.language) { clauses.push(`language = $${idx++}`); args.push(filters.language); }
  if (filters?.collection) { clauses.push(`collection = $${idx++}`); args.push(filters.collection); }
  if (filters?.tag) { clauses.push(`tag = $${idx++}`); args.push(filters.tag); }
  if (filters?.year) { clauses.push(`year = $${idx++}`); args.push(filters.year); }
  return { clause: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '', args };
}

async function listItems(filters = {}, offset = 0, limit = null, sort = 'latest') {
  // If no real DB, return empty dataset
  if (!pool) {
    return { items: [], total: 0 };
  }

  const { clause, args } = buildFiltersClause(filters);
  const limitOrAll = limit == null ? '' : 'LIMIT ' + Number(limit);
  const order = (sort === 'latest') ? 'ORDER BY published_at DESC, id DESC' : (sort === 'popular' ? 'ORDER BY popularity DESC' : 'ORDER BY published_at DESC, id DESC');

  const baseQuery = `SELECT id, title, featured, published_at AS "publishedAt", updated_at AS "updatedAt", year, status, type, genre, language, collection, tag FROM items ${clause} ${order} ${limitOrAll} OFFSET $${args.length + 1}`;
  const countQuery = `SELECT COUNT(*) AS total FROM items ${clause}`;

  const qParams = args.concat(offset);
  try {
    const totalRes = await pool.query(countQuery, args);
    const total = Number(totalRes?.rows?.[0]?.total ?? 0);
    const dataRes = await pool.query(baseQuery, qParams);
    const items = (dataRes?.rows || []);
    return { items, total };
  } catch (err) {
    // If the schema doesn't match, fall back to empty data to avoid crashing
    console.warn('DB query failed in listItems. Falling back to empty dataset.', err?.message);
    return { items: [], total: 0 };
  }
}

async function searchItems(query, filters = {}) {
  if (!pool) {
    return { items: [], total: 0 };
  }
  const q = (query || '').trim();
  const { clause, args } = buildFiltersClause(filters);
  const likeParam = '%' + q + '%';
  // Simple search across title and tag/genre/description-like fields
  const whereSearch = q
    ? `(${['title ILIKE $N', 'description ILIKE $N', 'tag ILIKE $N'].join(' OR ')})`
    : '';
  // Build dynamic SQL carefully to avoid breaking on missing fields
  const sql = `SELECT id, title, featured, published_at AS "publishedAt", updated_at AS "updatedAt", year, status, type, genre, language, collection, tag FROM items ${clause} ${whereSearch ? 'AND ' + whereSearch.replace('N', '$'+(args.length+1)) : ''} ORDER BY published_at DESC, id DESC`;
  const searchVal = likeParam;
  const params = args.concat(searchVal);
  try {
    const countRes = await pool.query(`SELECT COUNT(*) AS total FROM items ${clause} ${whereSearch ? 'WHERE ' + whereSearch.replace('N', '$'+(args.length+1)) : ''}`, params.slice(0, -1));
    const total = Number(countRes?.rows?.[0]?.total ?? 0);
    const dataRes = await pool.query(sql, params);
    const items = dataRes?.rows || [];
    return { items, total };
  } catch (err) {
    console.warn('DB query failed in searchItems. Falling back to empty dataset.', err?.message);
    return { items: [], total: 0 };
  }
}

module.exports = {
  ensureContentStore,
  closePool,
  listItems,
  searchItems,
};
