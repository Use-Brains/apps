import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { createSellerRouter } from './seller.js';

async function createTestServer() {
  const router = createSellerRouter({
    authenticateMiddleware(req, _res, next) {
      req.userId = 'seller-1';
      next();
    },
    requireActiveUserMiddleware(_req, _res, next) {
      next();
    },
    requireXHRMiddleware(_req, _res, next) {
      next();
    },
    checkTrialExpiryMiddleware(_req, _res, next) {
      next();
    },
    requirePlanMiddleware() {
      return (_req, _res, next) => next();
    },
    getFeatureAvailabilityFn() {
      return {
        enabled: false,
        code: 'SELLER_TOOLS_DISABLED',
        message: 'Seller tools are disabled in this deployment.',
      };
    },
    poolInstance: {
      async query() {
        throw new Error('Unexpected pool query in seller shell test');
      },
      async connect() {
        throw new Error('Unexpected pool connect in seller shell test');
      },
    },
    getStripeFn() {
      throw new Error('Unexpected Stripe access in seller shell test');
    },
    trackServerEventFn() {},
  });

  const app = express();
  app.use(express.json());
  app.use('/api/seller', router);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

test('GET /api/seller/dashboard returns a shell payload when seller tools are deferred', async () => {
  const server = await createTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/api/seller/dashboard`);
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.deepEqual(body, {
      status: 'unavailable',
      message: 'Seller tools coming soon',
      shell: true,
      code: 'SELLER_TOOLS_DISABLED',
      detail: 'Seller tools are disabled in this deployment.',
    });
  } finally {
    await server.close();
  }
});
