import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { createDeckRouter } from './decks.js';

function createPoolStub(initialDecks) {
  const state = {
    decks: new Map(initialDecks.map((deck) => [deck.id, { ...deck }])),
  };

  return {
    state,
    async query(sql, params = []) {
      if (sql.includes('FROM decks d') && sql.includes('archived_at')) {
        const [userId] = params;
        const rows = [...state.decks.values()]
          .filter((deck) => deck.user_id === userId)
          .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
          .map((deck) => ({
            id: deck.id,
            user_id: deck.user_id,
            title: deck.title,
            source_text: deck.source_text ?? null,
            origin: deck.origin,
            purchased_from_listing_id: deck.purchased_from_listing_id ?? null,
            archived_at: deck.archived_at ?? null,
            created_at: deck.created_at,
            updated_at: deck.updated_at,
            card_count: deck.card_count ?? 0,
            listing_id: null,
            listing_status: null,
            has_rated: false,
            last_studied_at: null,
          }));
        return { rows, rowCount: rows.length };
      }

      if (sql === 'SELECT origin FROM decks WHERE id = $1 AND user_id = $2') {
        const [deckId, userId] = params;
        const deck = state.decks.get(deckId);
        if (!deck || deck.user_id !== userId) return { rows: [], rowCount: 0 };
        return { rows: [{ origin: deck.origin }], rowCount: 1 };
      }

      if (sql === 'SELECT id, origin, archived_at FROM decks WHERE id = $1 AND user_id = $2') {
        const [deckId, userId] = params;
        const deck = state.decks.get(deckId);
        if (!deck || deck.user_id !== userId) return { rows: [], rowCount: 0 };
        return { rows: [{ id: deck.id, origin: deck.origin, archived_at: deck.archived_at ?? null }], rowCount: 1 };
      }

      if (sql === 'SELECT id, origin FROM decks WHERE id = $1 AND user_id = $2') {
        const [deckId, userId] = params;
        const deck = state.decks.get(deckId);
        if (!deck || deck.user_id !== userId) return { rows: [], rowCount: 0 };
        return { rows: [{ id: deck.id, origin: deck.origin }], rowCount: 1 };
      }

      if (sql.includes('UPDATE decks SET archived_at = NOW()')) {
        const [deckId, userId] = params;
        const deck = state.decks.get(deckId);
        if (!deck || deck.user_id !== userId) return { rows: [], rowCount: 0 };
        const archivedAt = '2026-03-16T12:00:00.000Z';
        deck.archived_at = archivedAt;
        deck.updated_at = archivedAt;
        return { rows: [{ id: deck.id, archived_at: archivedAt }], rowCount: 1 };
      }

      if (sql.includes('UPDATE decks SET archived_at = NULL')) {
        const [deckId, userId] = params;
        const deck = state.decks.get(deckId);
        if (!deck || deck.user_id !== userId) return { rows: [], rowCount: 0 };
        deck.archived_at = null;
        deck.updated_at = '2026-03-16T12:05:00.000Z';
        return { rows: [{ id: deck.id, archived_at: null }], rowCount: 1 };
      }

      if (sql.includes('DELETE FROM decks WHERE id = $1 AND user_id = $2 RETURNING id')) {
        const [deckId, userId] = params;
        const deck = state.decks.get(deckId);
        if (!deck || deck.user_id !== userId) return { rows: [], rowCount: 0 };
        state.decks.delete(deckId);
        return { rows: [{ id: deckId }], rowCount: 1 };
      }

      throw new Error(`Unhandled SQL in decks route test: ${sql}`);
    },
    async connect() {
      throw new Error('Unexpected connect() call in decks route test');
    },
  };
}

async function createTestServer(initialDecks) {
  const poolStub = createPoolStub(initialDecks);
  const router = createDeckRouter({
    authenticateMiddleware(req, _res, next) {
      req.userId = 'user-1';
      req.userPlan = 'pro';
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
    poolInstance: poolStub,
    countUserDecksFn: async () => 0,
  });

  const app = express();
  app.use(express.json());
  app.use('/api/decks', router);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    poolStub,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

test('GET /api/decks returns archived_at in deck list payload', async () => {
  const server = await createTestServer([
    {
      id: 'deck-1',
      user_id: 'user-1',
      title: 'Purchased deck',
      origin: 'purchased',
      archived_at: '2026-03-15T10:00:00.000Z',
      created_at: '2026-03-15T09:00:00.000Z',
      updated_at: '2026-03-15T10:00:00.000Z',
      card_count: 12,
    },
  ]);

  try {
    const response = await fetch(`${server.baseUrl}/api/decks`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.decks[0].archived_at, '2026-03-15T10:00:00.000Z');
  } finally {
    await server.close();
  }
});

test('POST /api/decks/:id/archive archives purchased decks', async () => {
  const server = await createTestServer([
    {
      id: 'deck-1',
      user_id: 'user-1',
      title: 'Purchased deck',
      origin: 'purchased',
      archived_at: null,
      created_at: '2026-03-15T09:00:00.000Z',
      updated_at: '2026-03-15T09:00:00.000Z',
    },
  ]);

  try {
    const response = await fetch(`${server.baseUrl}/api/decks/deck-1/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: '{}',
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.deck.id, 'deck-1');
    assert.match(body.deck.archived_at, /2026-03-16/);
  } finally {
    await server.close();
  }
});

test('POST /api/decks/:id/archive rejects generated decks', async () => {
  const server = await createTestServer([
    {
      id: 'deck-1',
      user_id: 'user-1',
      title: 'Generated deck',
      origin: 'generated',
      archived_at: null,
      created_at: '2026-03-15T09:00:00.000Z',
      updated_at: '2026-03-15T09:00:00.000Z',
    },
  ]);

  try {
    const response = await fetch(`${server.baseUrl}/api/decks/deck-1/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: '{}',
    });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.match(body.error, /Only purchased decks can be archived/i);
  } finally {
    await server.close();
  }
});

test('POST /api/decks/:id/unarchive restores purchased decks', async () => {
  const server = await createTestServer([
    {
      id: 'deck-1',
      user_id: 'user-1',
      title: 'Purchased deck',
      origin: 'purchased',
      archived_at: '2026-03-15T10:00:00.000Z',
      created_at: '2026-03-15T09:00:00.000Z',
      updated_at: '2026-03-15T10:00:00.000Z',
    },
  ]);

  try {
    const response = await fetch(`${server.baseUrl}/api/decks/deck-1/unarchive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: '{}',
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.deck.archived_at, null);
  } finally {
    await server.close();
  }
});

test('DELETE /api/decks/:id rejects purchased deck deletion', async () => {
  const server = await createTestServer([
    {
      id: 'deck-1',
      user_id: 'user-1',
      title: 'Purchased deck',
      origin: 'purchased',
      archived_at: null,
      created_at: '2026-03-15T09:00:00.000Z',
      updated_at: '2026-03-15T09:00:00.000Z',
    },
  ]);

  try {
    const response = await fetch(`${server.baseUrl}/api/decks/deck-1`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, 'purchased_deck_archive_only');
    assert.equal(server.poolStub.state.decks.has('deck-1'), true);
  } finally {
    await server.close();
  }
});
