require('dotenv').config();

const { ensureContentStore, listItems } = require('../src/data/store');
const db = require('../src/config/database');

async function main() {
  await ensureContentStore();
  const { items, total } = await listItems({}, 0, 1);
  const sampleId = items[0]?.id || null;

  console.log(JSON.stringify({
    ok: true,
    database: process.env.DB_NAME || 'isp_entertainment',
    totalItems: total,
    sampleId,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end().catch(() => {});
  });
