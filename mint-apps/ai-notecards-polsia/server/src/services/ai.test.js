import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCards } from './ai.js';

test('parseCards accepts object payloads with a cards array', () => {
  const cards = parseCards(JSON.stringify({
    cards: [
      { front: 'What is photosynthesis?', back: 'A process plants use to convert light into chemical energy.' },
      { front: 'Where does it occur?', back: 'Primarily in the chloroplasts of plant cells.' },
    ],
  }));

  assert.equal(cards.length, 2);
  assert.equal(cards[0].front, 'What is photosynthesis?');
});

test('parseCards accepts top-level array payloads', () => {
  const cards = parseCards(JSON.stringify([
    { front: 'Cell membrane', back: 'Controls what enters and leaves the cell.' },
    { front: 'Nucleus', back: 'Contains the cell genetic material.' },
  ]));

  assert.equal(cards.length, 2);
  assert.equal(cards[1].back, 'Contains the cell genetic material.');
});

test('parseCards rejects payloads without a valid cards collection', () => {
  assert.throws(
    () => parseCards(JSON.stringify({ items: [] })),
    /cards array/i
  );
});

test('parseCards rejects entries missing front/back strings', () => {
  assert.throws(
    () => parseCards(JSON.stringify([{ front: 'Incomplete card' }])),
    /invalid card format/i
  );
});
