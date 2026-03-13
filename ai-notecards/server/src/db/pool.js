import pg from 'pg';

const isProduction = process.env.NODE_ENV === 'production';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isProduction && {
    ssl: { rejectUnauthorized: false },
    max: 12,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  }),
});

export default pool;
