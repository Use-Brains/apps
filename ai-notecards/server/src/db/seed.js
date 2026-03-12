import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

async function seed() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const passwordHash = await bcrypt.hash('password123', 12);

    // Create demo user
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ('demo@example.com', $1)
       ON CONFLICT (email) DO UPDATE SET password_hash = $1
       RETURNING id`,
      [passwordHash]
    );
    const userId = userResult.rows[0].id;

    // Create a sample deck
    const deckResult = await pool.query(
      `INSERT INTO decks (user_id, title, source_text)
       VALUES ($1, 'JavaScript Fundamentals', 'Basic JavaScript concepts')
       RETURNING id`,
      [userId]
    );
    const deckId = deckResult.rows[0].id;

    // Add sample cards
    const cards = [
      { front: 'What is a closure in JavaScript?', back: 'A closure is a function that has access to variables in its outer (enclosing) scope, even after the outer function has returned.' },
      { front: 'What is the difference between let, const, and var?', back: 'var is function-scoped and hoisted. let and const are block-scoped. const cannot be reassigned after declaration.' },
      { front: 'What does the spread operator (...) do?', back: 'It expands an iterable (array, string, object) into individual elements. Used for copying, merging, and function arguments.' },
      { front: 'What is event delegation?', back: 'A pattern where you attach a single event listener to a parent element instead of individual listeners to each child, leveraging event bubbling.' },
      { front: 'What is the event loop?', back: 'The mechanism that allows JavaScript to perform non-blocking operations by offloading tasks to the browser/Node.js, then processing callbacks from a queue when the call stack is empty.' },
    ];

    for (let i = 0; i < cards.length; i++) {
      await pool.query(
        'INSERT INTO cards (deck_id, front, back, position) VALUES ($1, $2, $3, $4)',
        [deckId, cards[i].front, cards[i].back, i]
      );
    }

    console.log('Seed completed. Demo user: demo@example.com / password123');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
