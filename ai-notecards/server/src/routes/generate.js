import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { generateCards } from '../services/ai.js';
import pool from '../db/pool.js';

const router = Router();

router.post('/', authenticate, async (req, res) => {
  const { input, title } = req.body;
  if (!input || input.trim().length === 0) {
    return res.status(400).json({ error: 'Input text is required' });
  }

  try {
    // Check generation limits
    const userResult = await pool.query(
      'SELECT plan, daily_generation_count, last_generation_date FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userResult.rows[0];

    const today = new Date().toISOString().split('T')[0];
    const isNewDay = !user.last_generation_date || user.last_generation_date.toISOString().split('T')[0] !== today;
    const currentCount = isNewDay ? 0 : user.daily_generation_count;

    if (user.plan === 'free' && currentCount >= 3) {
      return res.status(429).json({
        error: 'Daily generation limit reached. Upgrade to Pro for unlimited generations.',
        limit: true,
      });
    }

    // Check deck limit for free users
    if (user.plan === 'free') {
      const deckCount = await pool.query('SELECT COUNT(*) FROM decks WHERE user_id = $1', [req.userId]);
      if (parseInt(deckCount.rows[0].count) >= 10) {
        return res.status(429).json({
          error: 'Maximum deck limit reached. Upgrade to Pro for unlimited decks.',
          limit: true,
        });
      }
    }

    // Generate cards
    const cards = await generateCards(input);

    // Save deck and cards in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const deckTitle = title || input.slice(0, 60).trim() + (input.length > 60 ? '...' : '');
      const deckResult = await client.query(
        'INSERT INTO decks (user_id, title, source_text) VALUES ($1, $2, $3) RETURNING *',
        [req.userId, deckTitle, input]
      );
      const deck = deckResult.rows[0];

      for (let i = 0; i < cards.length; i++) {
        await client.query(
          'INSERT INTO cards (deck_id, front, back, position) VALUES ($1, $2, $3, $4)',
          [deck.id, cards[i].front, cards[i].back, i]
        );
      }

      // Update generation count
      await client.query(
        `UPDATE users SET daily_generation_count = $1, last_generation_date = $2 WHERE id = $3`,
        [currentCount + 1, today, req.userId]
      );

      await client.query('COMMIT');

      const savedCards = await pool.query(
        'SELECT id, front, back, position FROM cards WHERE deck_id = $1 ORDER BY position',
        [deck.id]
      );

      res.status(201).json({
        deck: { ...deck, cards: savedCards.rows },
        generationsRemaining: user.plan === 'free' ? 2 - currentCount : null,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Generation error:', err);
    if (err.message === 'Failed to parse AI-generated cards') {
      return res.status(502).json({ error: 'AI returned an invalid response. Please try again.' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
