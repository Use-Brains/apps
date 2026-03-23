function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getDatabaseSsl(env = process.env) {
  if (env.DATABASE_SSL_MODE === 'disable') return null;
  return env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : null;
}

export function getDatabaseConfig(env = process.env) {
  return {
    connectionString: env.DATABASE_URL || null,
    directConnectionString: env.DATABASE_URL_DIRECT || env.DATABASE_URL || null,
    ssl: getDatabaseSsl(env),
    max: parseInteger(env.DATABASE_POOL_MAX, 12),
    idleTimeoutMillis: parseInteger(env.DATABASE_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMillis: parseInteger(env.DATABASE_CONNECTION_TIMEOUT_MS, 5000),
  };
}

export function getPoolConfig(env = process.env) {
  const config = getDatabaseConfig(env);

  return {
    connectionString: config.connectionString,
    ...(config.ssl && {
      ssl: config.ssl,
      max: config.max,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
    }),
  };
}

export function getMigrationConfig(env = process.env) {
  const config = getDatabaseConfig(env);

  return {
    connectionString: config.directConnectionString,
    ...(config.ssl && { ssl: config.ssl }),
  };
}
