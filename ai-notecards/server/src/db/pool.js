import pg from 'pg';

const isProduction = process.env.NODE_ENV === 'production';

// Lazy-init pool to avoid ES module import hoisting issue with dotenv.
// All imports execute before dotenv.config(), so process.env.DATABASE_URL
// may be undefined at module evaluation time. Defer pool creation to first use.
let _pool;

function getPool() {
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ...(isProduction && {
        ssl: { rejectUnauthorized: false },
        max: 12,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }),
    });
  }
  return _pool;
}

// Proxy object that forwards all method calls to the lazily-created pool
const pool = new Proxy({}, {
  get(_, prop) {
    const p = getPool();
    const val = p[prop];
    return typeof val === 'function' ? val.bind(p) : val;
  },
});

export default pool;
