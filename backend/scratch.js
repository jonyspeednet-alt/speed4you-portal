require('dotenv').config();
const { Pool } = require('pg');

async function checkRoots() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    const result = await pool.query("SELECT value FROM app_state WHERE key = 'scanner_roots' LIMIT 1;");
    console.log(JSON.stringify(result.rows[0]?.value, null, 2));
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

checkRoots();
