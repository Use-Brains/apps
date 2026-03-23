import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getLegacyMigrationsDir, migrate } from './migrator.js';

test('getLegacyMigrationsDir points at the legacy migration chain', () => {
  assert.match(getLegacyMigrationsDir(), /server\/db\/legacy-migrations$/);
});

test('migrate applies only unapplied sql files from the provided directory', async () => {
  const migrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'polsia-legacy-migrator-'));
  fs.writeFileSync(path.join(migrationsDir, '001_first.sql'), 'SELECT 1;');
  fs.writeFileSync(path.join(migrationsDir, '002_second.sql'), 'SELECT 2;');

  const appliedVersions = [{ version: 1 }];
  const queries = [];
  const clientQueries = [];
  let releases = 0;

  const pool = {
    async query(sql) {
      queries.push(sql.trim());

      if (sql.includes('SELECT version FROM schema_migrations')) {
        return { rows: appliedVersions };
      }

      return { rows: [] };
    },
    async connect() {
      return {
        async query(sql, params) {
          clientQueries.push({
            sql: sql.trim(),
            params,
          });
        },
        release() {
          releases += 1;
        },
      };
    },
  };

  try {
    await migrate(pool, { migrationsDir });
  } finally {
    fs.rmSync(migrationsDir, { recursive: true, force: true });
  }

  assert.equal(releases, 1);
  assert.deepEqual(queries, [
    'CREATE TABLE IF NOT EXISTS schema_migrations (\n      version INTEGER PRIMARY KEY,\n      filename TEXT NOT NULL,\n      applied_at TIMESTAMPTZ DEFAULT NOW()\n    )',
    'SELECT version FROM schema_migrations ORDER BY version',
  ]);
  assert.deepEqual(clientQueries, [
    { sql: 'BEGIN', params: undefined },
    { sql: 'SELECT 2;', params: undefined },
    {
      sql: 'INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)',
      params: [2, '002_second.sql'],
    },
    { sql: 'COMMIT', params: undefined },
  ]);
});
