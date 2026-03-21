import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { createMarketplaceRouter } from './marketplace.js';

async function createTestServer() {
  const router = createMarketplaceRouter({
    authenticateMiddleware(req, _res, next) {
      req.userId = 'buyer-1';
      next();
    },
    requireActiveUserMiddleware(_req, _res, next) {
      next();
    },
    requireXHRMiddleware(_req, _res, next) {
      next();
    },
    poolInstance: {
      async query() {
        throw new Error('Unexpected pool query in purchase placeholder test');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api/marketplace', router);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

test('POST /api/marketplace/:id/purchase returns the handoff placeholder payload', async () => {
  const server = await createTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/api/marketplace/listing-123/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: '{}',
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, {
      status: 'unavailable',
      message: 'Deck purchases coming soon',
      listingId: 'listing-123',
    });
  } finally {
    await server.close();
  }
});
