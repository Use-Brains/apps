import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

import { getMigrationConfig } from '../src/db/runtime.js';

const handoffMigrationFilename = '001_initial.sql';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../.env') });

async function migrateHandoff(pool) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const { rows: applied } = await pool.query(
    'SELECT version, filename FROM schema_migrations ORDER BY version'
  );

  const hasLegacyHistory = applied.some(({ version, filename }) => version > 1 || filename !== handoffMigrationFilename);
  if (hasLegacyHistory) {
    throw new Error(
      'Refusing to run handoff migration against a database with legacy migration history. Use a fresh database or the legacy migrator.'
    );
  }

  const appliedVersions = new Set(applied.map((row) => row.version));

  for (const file of files) {
    const version = Number.parseInt(file.split('_')[0], 10);
    if (appliedVersions.has(version)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)',
        [version, file]
      );
      await client.query('COMMIT');
      console.log(`Applied handoff migration: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

async function run() {
  const pool = new pg.Pool(getMigrationConfig());

  try {
    await migrateHandoff(pool);
    console.log('Handoff migration flow completed successfully.');
  } catch (error) {
    console.error('Handoff migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
