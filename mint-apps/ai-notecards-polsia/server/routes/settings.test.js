import test from 'node:test';
import assert from 'node:assert/strict';

import { validatePreferences } from './settings.js';

test('validatePreferences accepts AI generation consent payloads', () => {
  const valid = validatePreferences({
    ai_generation_consent: {
      granted: true,
      version: '2026-03-22',
      granted_at: '2026-03-22T12:00:00.000Z',
    },
  });

  assert.deepEqual(valid, {
    ai_generation_consent: {
      granted: true,
      version: '2026-03-22',
      granted_at: '2026-03-22T12:00:00.000Z',
    },
  });
});

test('validatePreferences rejects malformed AI generation consent payloads', () => {
  assert.equal(validatePreferences({
    ai_generation_consent: {
      granted: 'yes',
      version: '2026-03-22',
    },
  }), null);

  assert.equal(validatePreferences({
    ai_generation_consent: {
      granted: true,
      version: '',
    },
  }), null);
});
