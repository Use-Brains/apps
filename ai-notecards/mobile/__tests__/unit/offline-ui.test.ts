import { describe, expect, it } from 'vitest';

import {
  getOfflineBannerState,
  getOfflineFeatureMessage,
  getOfflineStatsLabel,
} from '../../src/lib/offline/ui';

describe('offline UI helpers', () => {
  it('shows an offline banner when connectivity is lost', () => {
    expect(getOfflineBannerState({ isOnline: false, isSyncing: false })).toEqual({
      visible: true,
      message: "You're offline. Downloaded decks still work.",
    });
  });

  it('shows a syncing banner when connectivity returns and sync is running', () => {
    expect(getOfflineBannerState({ isOnline: true, isSyncing: true })).toEqual({
      visible: true,
      message: 'Back online. Syncing your offline progress...',
    });
  });

  it('returns clear offline-disabled copy for generate and marketplace surfaces', () => {
    expect(getOfflineFeatureMessage('generate')).toMatch(/requires an internet connection/i);
    expect(getOfflineFeatureMessage('marketplace')).toMatch(/require an internet connection/i);
  });

  it('marks stats as stale when the device is offline', () => {
    expect(getOfflineStatsLabel(false)).toBe('Stats may be stale until your next refresh.');
    expect(getOfflineStatsLabel(true)).toBeNull();
  });
});
