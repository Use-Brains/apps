import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { checkTrialExpiry, checkGenerationLimits } from '../middleware/plan.js';
import { generateCards } from '../services/ai.js';
import pool from '../db/pool.js';

const router = Router();

router.post('/', authenticate, checkTrialExpiry, checkGenerationLimits, async (req, res) => {
  const { input, title } = req.body;
  if (!input || input.trim().length === 0) {
    return res.status(400).json({ error: 'Input text is required' });
  }

  try {
    const cards = await generateCards(input);

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

      const today = new Date().toISOString().split('T')[0];
      await client.query(
        'UPDATE users SET daily_generation_count = $1, last_generation_date = $2 WHERE id = $3',
        [req.generationCount + 1, today, req.userId]
      );

      await client.query('COMMIT');

      const savedCards = await pool.query(
        'SELECT id, front, back, position FROM cards WHERE deck_id = $1 ORDER BY position',
        [deck.id]
      );

      res.status(201).json({
        deck: { ...deck, cards: savedCards.rows },
        generationsRemaining: req.generationLimit - (req.generationCount + 1),
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
