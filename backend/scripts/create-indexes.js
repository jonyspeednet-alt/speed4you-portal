const db = require('../src/config/database');

async function createIndexes() {
  const indexes = [
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catalog_status_type ON content_catalog ((payload->>'status'), (payload->>'type'))`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catalog_status_type_time ON content_catalog ((payload->>'status'), (payload->>'type'), COALESCE((payload->>'updatedAt')::timestamptz, updated_at))`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catalog_gin ON content_catalog USING GIN (payload jsonb_path_ops)`
  ];

  for (const sql of indexes) {
    try {
      await db.query(sql);
      console.log(`✅ ${sql.substring(0, 60)}...`);
    } catch (err) {
      console.error(`❌ ${sql.substring(0, 60)}...`, err.message);
    }
  }
  console.log('✅ Indexes created! Run ANALYZE content_catalog;');
}

createIndexes().catch(console.error);

