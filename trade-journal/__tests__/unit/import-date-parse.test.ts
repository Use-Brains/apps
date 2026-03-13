import { describe, expect, it } from 'vitest';
import { parseDateToIso } from '../../src/features/import/date-parse';

describe('import date parse', () => {
  it('parses iso dates with offset directly', () => {
    const parsed = parseDateToIso('2026-03-01T10:30:00-05:00', 'UTC');
    expect(parsed).toBe('2026-03-01T15:30:00.000Z');
  });

  it('parses naive date using selected timezone', () => {
    const parsed = parseDateToIso('2026-03-01 08:00:00', 'America/Los_Angeles');
    expect(parsed).toBeTruthy();
  });

  it('returns null for invalid date values', () => {
    const parsed = parseDateToIso('not-a-date', 'UTC');
    expect(parsed).toBeNull();
  });
});
