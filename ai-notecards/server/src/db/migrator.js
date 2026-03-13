import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export async function migrate(pool) {
  // Support both integer versions (001, 002) and string versions (005b)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER,
      version_tag TEXT,
      filename TEXT NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT schema_migrations_pk PRIMARY KEY (COALESCE(version_tag, version::text))
    )
  `);

  // Migrate old integer-only PK to new schema if needed
  const { rows: cols } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'schema_migrations' AND column_name = 'version_tag'
  `);
  if (cols.length === 0) {
    await pool.query('ALTER TABLE schema_migrations DROP CONSTRAINT IF EXISTS schema_migrations_pkey');
    await pool.query('ALTER TABLE schema_migrations ADD COLUMN version_tag TEXT');
    await pool.query(`ALTER TABLE schema_migrations ADD CONSTRAINT schema_migrations_pk
      PRIMARY KEY (COALESCE(version_tag, version::text))`);
  }

  const { rows: applied } = await pool.query(
    'SELECT version, version_tag, filename FROM schema_migrations'
  );
  const appliedFiles = new Set(applied.map((r) => r.filename));

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedFiles.has(file)) continue;

    // Extract version: "005_name.sql" → 5, "005b_name.sql" → 5 with tag "005b"
    const prefix = file.split('_')[0];
    const version = parseInt(prefix, 10);
    const versionTag = prefix !== String(version).padStart(3, '0') ? prefix : null;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (version, version_tag, filename) VALUES ($1, $2, $3)',
        [version, versionTag, file]
      );
      await client.query('COMMIT');
      console.log(`Applied migration: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
}
