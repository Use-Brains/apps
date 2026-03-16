import { describe, expect, it } from 'vitest';

import { shouldSyncTimezone } from '../../src/lib/timezone';

describe('timezone helpers', () => {
  it('syncs when the stored timezone is missing or different', () => {
    expect(shouldSyncTimezone(undefined, 'America/Los_Angeles')).toBe(true);
    expect(shouldSyncTimezone('UTC', 'America/Los_Angeles')).toBe(true);
  });

  it('does not sync when the stored timezone already matches the device', () => {
    expect(shouldSyncTimezone('America/Los_Angeles', 'America/Los_Angeles')).toBe(false);
  });
});
