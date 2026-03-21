import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import striptags from 'striptags';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import { checkTrialExpiry, PLAN_LIMITS } from '../middleware/plan.js';
import pool from '../db/index.js';
import { countUserDecks } from '../db/queries.js';

const saveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.userId,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many save requests. Please try again later.' },
});

const PURCHASED_READONLY_ERROR = {
  error: 'purchased_deck_readonly',
  message: 'Purchased decks cannot be edited. Duplicate the deck to create an editable copy.',
};

const PURCHASED_DECK_DELETE_FORBIDDEN_ERROR = {
  error: 'purchased_deck_archive_only',
  message: 'Purchased decks cannot be deleted. Archive them instead.',
};

export function createDeckRouter({
  authenticateMiddleware = authenticate,
  requireActiveUserMiddleware = requireActiveUser,
  requireXHRMiddleware = requireXHR,
  checkTrialExpiryMiddleware = checkTrialExpiry,
  poolInstance = pool,
  countUserDecksFn = countUserDecks,
} = {}) {
  const router = Router();

  router.get('/', authenticateMiddleware, async (req, res) => {
    try {
      const result = await poolInstance.query(
        `SELECT d.id, d.user_id, d.title, d.source_text, d.origin, d.purchased_from_listing_id,
                d.archived_at, d.created_at, d.updated_at, COUNT(c.id)::int AS card_count,
                ml.id AS listing_id, ml.status AS listing_status,
                (rt.id IS NOT NULL) AS has_rated,
                ls.last_studied_at
         FROM decks d
         LEFT JOIN cards c ON c.deck_id = d.id
         LEFT JOIN marketplace_listings ml ON ml.deck_id = d.id
         LEFT JOIN ratings rt ON rt.user_id = d.user_id
           AND rt.listing_id = d.purchased_from_listing_id
         LEFT JOIN (
           SELECT deck_id, MAX(completed_at) AS last_studied_at
           FROM study_sessions
           WHERE user_id = $1 AND completed_at IS NOT NULL
           GROUP BY deck_id
         ) ls ON ls.deck_id = d.id
         WHERE d.user_id = $1
         GROUP BY d.id, ml.id, ml.status, rt.id, ls.last_studied_at
         ORDER BY d.created_at DESC`,
        [req.userId]
      );
      res.json({ decks: result.rows });
    } catch (err) {
      console.error('List decks error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/:id', authenticateMiddleware, async (req, res) => {
    try {
      const deckResult = await poolInstance.query(
        'SELECT * FROM decks WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
      );
      if (deckResult.rows.length === 0) {
        return res.status(404).json({ error: 'Deck not found' });
      }

      const cardsResult = await poolInstance.query(
        'SELECT id, front, back, position, created_at FROM cards WHERE deck_id = $1 ORDER BY position',
        [req.params.id]
      );

      res.json({ deck: deckResult.rows[0], cards: cardsResult.rows });
    } catch (err) {
      console.error('Get deck error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/save', requireXHRMiddleware, authenticateMiddleware, checkTrialExpiryMiddleware, saveLimiter, async (req, res) => {
    const { title, source_text, cards } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (title.length > 200) {
      return res.status(400).json({ error: 'Title is too long. Maximum 200 characters.' });
    }
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'At least 1 card is required' });
    }
    if (cards.length > 30) {
      return res.status(400).json({ error: 'Maximum 30 cards per deck' });
    }
    if (source_text && source_text.length > 50000) {
      return res.status(400).json({ error: 'Source text is too long. Maximum 50,000 characters.' });
    }
    for (const card of cards) {
      if (!card.front?.trim() || !card.back?.trim()) {
        return res.status(400).json({ error: 'Each card must have front and back text' });
      }
      if (card.front.length > 2000) {
        return res.status(400).json({ error: 'Card front text is too long. Maximum 2,000 characters.' });
      }
      if (card.back.length > 5000) {
        return res.status(400).json({ error: 'Card back text is too long. Maximum 5,000 characters.' });
      }
    }

    try {
      const limits = PLAN_LIMITS[req.userPlan] || PLAN_LIMITS.free;
      if (limits.maxDecks !== Infinity) {
        const deckCount = await countUserDecksFn(req.userId);
        if (deckCount >= limits.maxDecks) {
          return res.status(429).json({
            error: `Maximum deck limit reached (${limits.maxDecks}). Upgrade to Pro for unlimited decks.`,
            limit: true,
          });
        }
      }

      const client = await poolInstance.connect();
      try {
        await client.query('BEGIN');

        const deckResult = await client.query(
          "INSERT INTO decks (user_id, title, source_text, origin) VALUES ($1, $2, $3, 'generated') RETURNING *",
          [req.userId, title.trim(), source_text || null]
        );
        const deck = deckResult.rows[0];

        const values = [];
        const placeholders = [];
        cards.forEach((card, i) => {
          const offset = i * 4;
          placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
          values.push(deck.id, striptags(card.front.trim()), striptags(card.back.trim()), i);
        });

        const cardsResult = await client.query(
          `INSERT INTO cards (deck_id, front, back, position) VALUES ${placeholders.join(', ')} RETURNING *`,
          values
        );

        await client.query('COMMIT');

        res.status(201).json({
          deck: { ...deck, cards: cardsResult.rows },
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Save deck error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:id/duplicate', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, checkTrialExpiryMiddleware, saveLimiter, async (req, res) => {
    try {
      const sourceResult = await poolInstance.query(
        'SELECT id, title, source_text, origin FROM decks WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
      );
      if (sourceResult.rows.length === 0) {
        return res.status(404).json({ error: 'Deck not found' });
      }
      const sourceDeck = sourceResult.rows[0];

      const limits = PLAN_LIMITS[req.userPlan] || PLAN_LIMITS.free;
      if (limits.maxDecks !== Infinity) {
        const deckCount = await countUserDecksFn(req.userId);
        if (deckCount >= limits.maxDecks) {
          return res.status(429).json({
            error: `Maximum deck limit reached (${limits.maxDecks}). Upgrade to Pro for unlimited decks.`,
            limit: true,
          });
        }
      }

      const { rows: sourceCards } = await poolInstance.query(
        'SELECT front, back, position FROM cards WHERE deck_id = $1 ORDER BY position',
        [sourceDeck.id]
      );

      let title = striptags(sourceDeck.title).trim();
      if (!title) title = 'Untitled';
      const chars = Array.from(title);
      if (chars.length > 193) title = chars.slice(0, 193).join('');
      title += ' (Copy)';

      const client = await poolInstance.connect();
      try {
        await client.query('BEGIN');

        const deckResult = await client.query(
          `INSERT INTO decks (user_id, title, source_text, origin, duplicated_from_deck_id)
           VALUES ($1, $2, $3, 'duplicated', $4) RETURNING *`,
          [req.userId, title, sourceDeck.source_text, sourceDeck.id]
        );
        const newDeck = deckResult.rows[0];

        if (sourceCards.length > 0) {
          const values = [];
          const placeholders = [];
          sourceCards.forEach((card, i) => {
            const offset = i * 4;
            placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
            values.push(newDeck.id, card.front, card.back, card.position);
          });

          await client.query(
            `INSERT INTO cards (deck_id, front, back, position) VALUES ${placeholders.join(', ')}`,
            values
          );
        }

        await client.query('COMMIT');

        res.status(201).json({ deck: { ...newDeck, card_count: sourceCards.length } });
      } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23503') {
          return res.status(404).json({ error: 'Source deck no longer exists' });
        }
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      if (err.code === '23503') return;
      console.error('Duplicate deck error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, async (req, res) => {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (title.length > 200) {
      return res.status(400).json({ error: 'Title is too long. Maximum 200 characters.' });
    }
    try {
      const deckCheck = await poolInstance.query(
        'SELECT origin FROM decks WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
      );
      if (deckCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Deck not found' });
      }
      if (deckCheck.rows[0].origin === 'purchased') {
        return res.status(403).json(PURCHASED_READONLY_ERROR);
      }

      const result = await poolInstance.query(
        'UPDATE decks SET title = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
        [striptags(title), req.params.id, req.userId]
      );
      res.json({ deck: result.rows[0] });
    } catch (err) {
      console.error('Update deck error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:id/archive', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, async (req, res) => {
    try {
      const deckResult = await poolInstance.query(
        'SELECT id, origin, archived_at FROM decks WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
      );
      if (deckResult.rows.length === 0) {
        return res.status(404).json({ error: 'Deck not found' });
      }
      if (deckResult.rows[0].origin !== 'purchased') {
        return res.status(403).json({ error: 'Only purchased decks can be archived.' });
      }

      const result = await poolInstance.query(
        'UPDATE decks SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id, archived_at',
        [req.params.id, req.userId]
      );
      res.json({ deck: result.rows[0] });
    } catch (err) {
      console.error('Archive deck error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:id/unarchive', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, async (req, res) => {
    try {
      const deckResult = await poolInstance.query(
        'SELECT id, origin FROM decks WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
      );
      if (deckResult.rows.length === 0) {
        return res.status(404).json({ error: 'Deck not found' });
      }
      if (deckResult.rows[0].origin !== 'purchased') {
        return res.status(403).json({ error: 'Only purchased decks can be unarchived.' });
      }

      const result = await poolInstance.query(
        'UPDATE decks SET archived_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id, archived_at',
        [req.params.id, req.userId]
      );
      res.json({ deck: result.rows[0] });
    } catch (err) {
      console.error('Unarchive deck error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/:id', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, async (req, res) => {
    try {
      const deckResult = await poolInstance.query(
        'SELECT origin FROM decks WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
      );
      if (deckResult.rows.length === 0) {
        return res.status(404).json({ error: 'Deck not found' });
      }
      if (deckResult.rows[0].origin === 'purchased') {
        return res.status(403).json(PURCHASED_DECK_DELETE_FORBIDDEN_ERROR);
      }

      await poolInstance.query(
        'DELETE FROM decks WHERE id = $1 AND user_id = $2 RETURNING id',
        [req.params.id, req.userId]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete deck error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:id/cards', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, async (req, res) => {
    const { front, back } = req.body;
    if (!front || !back) {
      return res.status(400).json({ error: 'Front and back are required' });
    }
    if (front.length > 2000) {
      return res.status(400).json({ error: 'Card front text is too long. Maximum 2,000 characters.' });
    }
    if (back.length > 5000) {
      return res.status(400).json({ error: 'Card back text is too long. Maximum 5,000 characters.' });
    }
    try {
      const deck = await poolInstance.query('SELECT id, origin FROM decks WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
      if (deck.rows.length === 0) {
        return res.status(404).json({ error: 'Deck not found' });
      }
      if (deck.rows[0].origin === 'purchased') {
        return res.status(403).json(PURCHASED_READONLY_ERROR);
      }

      const maxPos = await poolInstance.query('SELECT COALESCE(MAX(position), -1) AS max_pos FROM cards WHERE deck_id = $1', [req.params.id]);
      const result = await poolInstance.query(
        'INSERT INTO cards (deck_id, front, back, position) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.params.id, striptags(front), striptags(back), maxPos.rows[0].max_pos + 1]
      );
      res.status(201).json({ card: result.rows[0] });
    } catch (err) {
      console.error('Add card error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:deckId/cards/:cardId', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, async (req, res) => {
    const { front, back } = req.body;
    if (front !== undefined && front.length > 2000) {
      return res.status(400).json({ error: 'Card front text is too long. Maximum 2,000 characters.' });
    }
    if (back !== undefined && back.length > 5000) {
      return res.status(400).json({ error: 'Card back text is too long. Maximum 5,000 characters.' });
    }
    try {
      const deck = await poolInstance.query('SELECT id, origin FROM decks WHERE id = $1 AND user_id = $2', [req.params.deckId, req.userId]);
      if (deck.rows.length === 0) {
        return res.status(404).json({ error: 'Deck not found' });
      }
      if (deck.rows[0].origin === 'purchased') {
        return res.status(403).json(PURCHASED_READONLY_ERROR);
      }

      const result = await poolInstance.query(
        'UPDATE cards SET front = COALESCE($1, front), back = COALESCE($2, back) WHERE id = $3 AND deck_id = $4 RETURNING *',
        [front ? striptags(front) : front, back ? striptags(back) : back, req.params.cardId, req.params.deckId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Card not found' });
      }
      res.json({ card: result.rows[0] });
    } catch (err) {
      console.error('Update card error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/:deckId/cards/:cardId', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, async (req, res) => {
    try {
      const deck = await poolInstance.query('SELECT id, origin FROM decks WHERE id = $1 AND user_id = $2', [req.params.deckId, req.userId]);
      if (deck.rows.length === 0) {
        return res.status(404).json({ error: 'Deck not found' });
      }
      if (deck.rows[0].origin === 'purchased') {
        return res.status(403).json(PURCHASED_READONLY_ERROR);
      }

      const result = await poolInstance.query(
        'DELETE FROM cards WHERE id = $1 AND deck_id = $2 RETURNING id',
        [req.params.cardId, req.params.deckId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Card not found' });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete card error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

export default createDeckRouter();
