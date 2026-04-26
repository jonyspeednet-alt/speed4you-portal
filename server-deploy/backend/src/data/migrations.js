/**
 * migrations.js — lightweight auto-migration runner
 *
 * Reads SQL files from backend/migrations/ in alphabetical order and applies
 * any that have not yet been recorded in the schema_migrations table.
 * Idempotent: safe to call every time the server starts.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const db   = require('../config/database');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

async function runMigrations() {
  // Ensure the tracking table exists (runs before any migration)
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL      PRIMARY KEY,
      filename    TEXT        NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Collect *.sql files, sorted alphabetically (001_… 002_… etc.)
  let files;
  try {
    files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch {
    // No migrations directory yet — nothing to do
    return;
  }

  for (const filename of files) {
    const { rows } = await db.query(
      'SELECT id FROM schema_migrations WHERE filename = $1',
      [filename],
    );

    if (rows.length) {
      continue; // already applied
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');

    try {
      await db.query(sql);
      await db.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
        [filename],
      );
      console.log(`[migrations] Applied: ${filename}`);
    } catch (err) {
      console.error(`[migrations] FAILED on ${filename}:`, err.message);
      throw err; // abort startup — data integrity must be guaranteed
    }
  }
}

module.exports = { runMigrations };
