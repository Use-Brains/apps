import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate } from './migrator.js';
import { getMigrationConfig } from './runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  const pool = new pg.Pool(getMigrationConfig());

  try {
    await migrate(pool);
    console.log('All legacy migrations applied successfully.');
  } catch (error) {
    console.error('Legacy migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
