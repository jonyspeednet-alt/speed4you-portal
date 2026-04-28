require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

async function checkPaths() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    const result = await pool.query("SELECT payload->>'videoUrl' as v, payload->>'sourcePath' as s FROM content_catalog WHERE id = 153102;");
    console.log(JSON.stringify(result.rows[0], null, 2));
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

checkPaths();
