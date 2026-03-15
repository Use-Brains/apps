import pool from './pool.js';

/**
 * Count user-owned decks (generated + duplicated) for limit checks.
 * Purchased decks are exempt from limits.
 */
export async function countUserDecks(userId) {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM decks WHERE user_id = $1 AND origin IN ('generated', 'duplicated')",
    [userId]
  );
  return rows[0].count;
}
