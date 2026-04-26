const { Pool } = require('pg');

const nodeEnv = String(process.env.NODE_ENV || 'development').toLowerCase();
const isProduction = nodeEnv === 'production';

if (isProduction) {
  if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
    throw new Error('DB_USER and DB_PASSWORD must be set in production.');
  }
  if (!process.env.DB_NAME) {
    throw new Error('DB_NAME must be set in production.');
  }
}

const connectionConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'isp_entertainment',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: Number(process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
  allowExitOnIdle: false,
};

function createInMemoryPool() {
  const { newDb } = require('pg-mem');
  const mem = newDb({ autoCreateForeignKeyIndices: true });

  mem.public.registerFunction({
    name: 'version',
    returns: 'text',
    implementation: () => 'pg-mem',
  });

  const adapter = mem.adapters.createPg();
  const pool = new adapter.Pool();
  pool.totalCount = 1;
  pool.idleCount = 1;
  pool.waitingCount = 0;

  return pool;
}

let activePool = null;
let usingInMemory = false;
let initPromise = null;

async function getPool() {
  if (activePool) {
    return activePool;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const pool = new Pool(connectionConfig);
      pool.on('error', (err) => {
        console.error('Unexpected error on idle DB client', err);
      });

      try {
        await pool.query('SELECT 1');
        activePool = pool;
        usingInMemory = false;
        return activePool;
      } catch (error) {
        await pool.end().catch(() => {});
        if (isProduction) {
          throw error;
        }

        console.warn('[database] PostgreSQL unavailable. Falling back to in-memory pg-mem store.');
        activePool = createInMemoryPool();
        usingInMemory = true;
        return activePool;
      }
    })().finally(() => {
      initPromise = null;
    });
  }

  return initPromise;
}

async function query(text, params) {
  const pool = await getPool();
  return pool.query(text, params);
}

const poolStats = {
  get totalCount() {
    return activePool?.totalCount ?? 0;
  },
  get idleCount() {
    return activePool?.idleCount ?? 0;
  },
  get waitingCount() {
    return activePool?.waitingCount ?? 0;
  },
};

module.exports = {
  query,
  pool: poolStats,
  getPool,
  get isInMemory() {
    return usingInMemory;
  },
};
