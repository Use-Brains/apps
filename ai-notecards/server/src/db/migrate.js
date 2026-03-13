import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { migrate } from './migrator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

async function run() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const pool = new pg.Pool({ connectionString });
  try {
    await migrate(pool);
    console.log('All migrations applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
