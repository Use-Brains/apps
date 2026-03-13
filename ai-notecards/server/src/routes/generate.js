import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { checkTrialExpiry, checkGenerationLimits } from '../middleware/plan.js';
import { generateCards } from '../services/ai.js';
import pool from '../db/pool.js';
import { ErrorCodes } from '../constants/errors.js';

const router = Router();

const SOURCE_TEXT_MAX_STORED = 5000;

router.post('/', authenticate, checkTrialExpiry, checkGenerationLimits, async (req, res) => {
  const { input, title } = req.body;
  if (!input || input.trim().length === 0) {
    return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'Input text is required' });
  }

  // Server-side input length validation using plan limits
  const maxChars = req.planLimits?.maxInputChars || 30000;
  if (input.length > maxChars) {
    return res.status(400).json({
      error: ErrorCodes.INPUT_TOO_LONG,
      message: `Input exceeds maximum length (${maxChars.toLocaleString()} characters). Please shorten your input.`,
    });
  }

  try {
    // Pass BYOK context for byok_pro users
    const aiOptions = {};
    if (req.userPlan === 'byok_pro') {
      aiOptions.userId = req.userId;
      aiOptions.byok = true;
    }

    const cards = await generateCards(input, aiOptions);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const deckTitle = title || input.slice(0, 60).trim() + (input.length > 60 ? '...' : '');
      // Truncate source_text to avoid storing massive inputs
      const storedSourceText = input.length > SOURCE_TEXT_MAX_STORED
        ? input.slice(0, SOURCE_TEXT_MAX_STORED)
        : input;

      const deckResult = await client.query(
        'INSERT INTO decks (user_id, title, source_text) VALUES ($1, $2, $3) RETURNING *',
        [req.userId, deckTitle, storedSourceText]
      );
      const deck = deckResult.rows[0];

      // Batch insert cards
      if (cards.length > 0) {
        const values = [];
        const params = [];
        for (let i = 0; i < cards.length; i++) {
          const offset = i * 4;
          values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
          params.push(deck.id, cards[i].front, cards[i].back, i);
        }
        await client.query(
          `INSERT INTO cards (deck_id, front, back, position) VALUES ${values.join(', ')}`,
          params
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
        generationsRemaining: req.generationLimit === Infinity ? null : req.generationLimit - (req.generationCount + 1),
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
      return res.status(502).json({ error: ErrorCodes.AI_PARSE_FAILED, message: 'AI returned an invalid response. Please try again.' });
    }
    if (err.message?.includes('AI generation unavailable')) {
      return res.status(502).json({ error: ErrorCodes.AI_GENERATION_FAILED, message: err.message });
    }
    // BYOK-specific errors
    if (err.message?.includes('Invalid API key') || err.status === 401) {
      return res.status(400).json({ error: ErrorCodes.BYOK_KEY_INVALID, message: 'Your API key is invalid or expired. Update it in Settings.' });
    }
    if (err.message?.includes('insufficient') || err.status === 402) {
      return res.status(402).json({ error: ErrorCodes.BYOK_INSUFFICIENT_CREDITS, message: 'Your API account has insufficient credits.' });
    }
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
});

export default router;
