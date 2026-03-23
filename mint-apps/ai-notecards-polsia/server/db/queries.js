import pool from './pool.js';

export async function countUserDecks(userId) {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM decks WHERE user_id = $1 AND origin IN ('generated', 'duplicated')",
    [userId]
  );
  return rows[0].count;
}
