import test from 'node:test';
import assert from 'node:assert/strict';

import { getDatabaseConfig, getMigrationConfig, getPoolConfig } from './index.js';

test('getDatabaseConfig exposes pooled and direct connection strings', () => {
  const config = getDatabaseConfig({
    DATABASE_URL: 'postgres://pooled.example/db',
    DATABASE_URL_DIRECT: 'postgres://direct.example/db',
    NODE_ENV: 'production',
  });

  assert.equal(config.connectionString, 'postgres://pooled.example/db');
  assert.equal(config.directConnectionString, 'postgres://direct.example/db');
  assert.deepEqual(config.ssl, { rejectUnauthorized: false });
});

test('getPoolConfig keeps production pool tuning and supports overrides', () => {
  const config = getPoolConfig({
    DATABASE_URL: 'postgres://pooled.example/db',
    NODE_ENV: 'production',
    DATABASE_POOL_MAX: '20',
    DATABASE_IDLE_TIMEOUT_MS: '45000',
    DATABASE_CONNECTION_TIMEOUT_MS: '9000',
  });

  assert.equal(config.connectionString, 'postgres://pooled.example/db');
  assert.equal(config.max, 20);
  assert.equal(config.idleTimeoutMillis, 45000);
  assert.equal(config.connectionTimeoutMillis, 9000);
  assert.deepEqual(config.ssl, { rejectUnauthorized: false });
});

test('getMigrationConfig prefers the direct url and falls back to pooled url', () => {
  const directConfig = getMigrationConfig({
    DATABASE_URL: 'postgres://pooled.example/db',
    DATABASE_URL_DIRECT: 'postgres://direct.example/db',
  });
  assert.equal(directConfig.connectionString, 'postgres://direct.example/db');

  const fallbackConfig = getMigrationConfig({
    DATABASE_URL: 'postgres://pooled.example/db',
  });
  assert.equal(fallbackConfig.connectionString, 'postgres://pooled.example/db');
});
