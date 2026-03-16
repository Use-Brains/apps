import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeStreakMetrics,
  getCurrentDateKey,
  getUserTimezone,
  normalizeTimezone,
  toTimezoneDateKey,
} from './study-timezone.js';

test('normalizeTimezone falls back to UTC for invalid values', () => {
  assert.equal(normalizeTimezone('America/Los_Angeles'), 'America/Los_Angeles');
  assert.equal(normalizeTimezone('Not/A-Timezone'), 'UTC');
  assert.equal(normalizeTimezone(''), 'UTC');
});

test('getUserTimezone reads timezone from preferences', () => {
  assert.equal(getUserTimezone({ timezone: 'America/New_York' }), 'America/New_York');
  assert.equal(getUserTimezone({}), 'UTC');
});

test('toTimezoneDateKey uses the supplied timezone boundary', () => {
  const value = new Date('2026-03-16T01:30:00.000Z');

  assert.equal(toTimezoneDateKey(value, 'UTC'), '2026-03-16');
  assert.equal(toTimezoneDateKey(value, 'America/Los_Angeles'), '2026-03-15');
});

test('computeStreakMetrics groups days in the supplied timezone', () => {
  const completed = [
    '2026-03-14T07:30:00.000Z',
    '2026-03-15T07:30:00.000Z',
    '2026-03-16T07:30:00.000Z',
  ];

  assert.deepEqual(computeStreakMetrics(completed, 'UTC'), {
    current_streak: 3,
    longest_streak: 3,
    last_study_date: '2026-03-16',
  });

  assert.deepEqual(computeStreakMetrics(completed, 'America/Los_Angeles'), {
    current_streak: 3,
    longest_streak: 3,
    last_study_date: '2026-03-16',
  });
});

test('getCurrentDateKey returns the local day key', () => {
  const now = new Date('2026-03-16T01:30:00.000Z');

  assert.equal(getCurrentDateKey(now, 'UTC'), '2026-03-16');
  assert.equal(getCurrentDateKey(now, 'America/Los_Angeles'), '2026-03-15');
});
