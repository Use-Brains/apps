import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export async function migrate(pool) {
  // Ensure schema_migrations table exists (original schema)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER NOT NULL,
      filename TEXT NOT NULL DEFAULT '',
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add filename column if missing (very old schema)
  const { rows: filenameCols } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'schema_migrations' AND column_name = 'filename'
  `);
  if (filenameCols.length === 0) {
    await pool.query("ALTER TABLE schema_migrations ADD COLUMN filename TEXT NOT NULL DEFAULT ''");
  }

  // Add version_tag column to support sub-versions like 005b
  const { rows: tagCols } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'schema_migrations' AND column_name = 'version_tag'
  `);
  if (tagCols.length === 0) {
    await pool.query('ALTER TABLE schema_migrations ADD COLUMN version_tag TEXT');
  }

  // Track applied migrations by filename (handles sub-versions)
  const { rows: applied } = await pool.query(
    'SELECT version, version_tag, filename FROM schema_migrations'
  );
  const appliedFiles = new Set(applied.map((r) => r.filename).filter(Boolean));
  // Also track by integer version for backwards compat with old rows that have empty filename
  const appliedVersions = new Set(applied.map((r) => r.version));

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    // Skip if already applied (check by filename first, then by version for old entries)
    if (appliedFiles.has(file)) continue;

    // Extract version: "005_name.sql" → 5, "005b_name.sql" → 5 with tag "005b"
    const prefix = file.split('_')[0];
    const version = parseInt(prefix, 10);
    const versionTag = /[a-z]/i.test(prefix) ? prefix : null;

    // For non-tagged files (001, 002, etc.), also check old integer-only tracking
    if (!versionTag && appliedVersions.has(version)) continue;

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
