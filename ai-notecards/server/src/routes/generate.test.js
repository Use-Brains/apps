import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { createGenerateRouter } from './generate.js';

async function createTestServer({
  visionImpl = async () => [{ front: 'Q1', back: 'A1' }],
  textImpl = async () => [{ front: 'T1', back: 'A1' }],
  fileTypeFromBufferImpl = async () => ({ mime: 'image/jpeg' }),
} = {}) {
  const tracker = {
    updates: [],
    visionCalls: [],
  };

  const router = createGenerateRouter({
    authenticateMiddleware(req, _res, next) {
      req.userId = 'user-1';
      next();
    },
    requireXHRMiddleware(_req, _res, next) {
      next();
    },
    checkTrialExpiryMiddleware(_req, _res, next) {
      next();
    },
    checkGenerationLimitsMiddleware(req, _res, next) {
      req.generationCount = 0;
      req.generationLimit = 10;
      next();
    },
    async generateCardsFn(input) {
      return textImpl(input);
    },
    async generateCardsWithVisionFn(input, files) {
      tracker.visionCalls.push({
        input,
        fileCount: files.length,
        files: files.map((file) => ({ mimetype: file.mimetype, size: file.size })),
      });
      return visionImpl(input, files);
    },
    poolInstance: {
      async query(sql, params) {
        tracker.updates.push({ sql, params });
        return { rows: [], rowCount: 1 };
      },
    },
    fileTypeFromBufferFn: fileTypeFromBufferImpl,
  });

  const app = express();
  app.use('/api/generate', router);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    tracker,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function postMultipart(baseUrl, { input = '', title = 'Deck', photoCount = 1 } = {}) {
  const form = new FormData();
  if (input) form.set('input', input);
  if (title) form.set('title', title);

  for (let i = 0; i < photoCount; i += 1) {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    form.append('photos', new File([jpegBytes], `photo-${i + 1}.jpg`, { type: 'image/jpeg' }));
  }

  return fetch(`${baseUrl}/api/generate/preview`, {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: form,
  });
}

test('POST /api/generate/preview returns cards for photo uploads', async () => {
  const server = await createTestServer({
    visionImpl: async () => [{ front: 'Photo card', back: 'Generated from image' }],
  });

  try {
    const response = await postMultipart(server.baseUrl, {
      input: 'chapter notes',
      title: 'Biology',
      photoCount: 2,
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.cards.length, 1);
    assert.equal(body.cards[0].front, 'Photo card');
    assert.equal(server.tracker.updates.length, 1);
    assert.equal(server.tracker.visionCalls.length, 1);
    assert.equal(server.tracker.visionCalls[0].fileCount, 2);
  } finally {
    await server.close();
  }
});

test('POST /api/generate/preview maps no-card vision responses to 422', async () => {
  const server = await createTestServer({
    visionImpl: async () => {
      const err = new Error('No flashcards could be generated from the provided images.');
      err.code = 'NO_CARDS';
      throw err;
    },
  });

  try {
    const response = await postMultipart(server.baseUrl, {
      title: 'Biology',
      photoCount: 1,
    });

    assert.equal(response.status, 422);
    const body = await response.json();
    assert.match(body.error, /No flashcards/i);
    assert.equal(server.tracker.updates.length, 0);
  } finally {
    await server.close();
  }
});

test('POST /api/generate/preview maps provider failures to 502 for photo uploads', async () => {
  const server = await createTestServer({
    visionImpl: async () => {
      const err = new Error('Vision request timed out after 60 seconds.');
      err.code = 'VISION_PROVIDER_ERROR';
      throw err;
    },
  });

  try {
    const response = await postMultipart(server.baseUrl, {
      title: 'Biology',
      photoCount: 1,
    });

    assert.equal(response.status, 502);
    const body = await response.json();
    assert.match(body.error, /Photo processing failed/i);
    assert.equal(server.tracker.updates.length, 0);
  } finally {
    await server.close();
  }
});

test('POST /api/generate/preview rejects invalid photo content', async () => {
  const server = await createTestServer({
    fileTypeFromBufferImpl: async () => ({ mime: 'application/pdf' }),
  });

  try {
    const response = await postMultipart(server.baseUrl, {
      title: 'Biology',
      photoCount: 1,
    });

    assert.equal(response.status, 422);
    const body = await response.json();
    assert.match(body.error, /allowed image format/i);
    assert.equal(server.tracker.visionCalls.length, 0);
  } finally {
    await server.close();
  }
});
