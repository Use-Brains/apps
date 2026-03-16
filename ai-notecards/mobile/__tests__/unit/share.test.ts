import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    select: ({ default: value, ios }: { default?: unknown; ios?: unknown }) => ios ?? value,
  },
  Share: {
    share: vi.fn(),
  },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

import { buildMarketplaceSharePayload, buildStudyResultShareMessage } from '../../src/lib/share';

describe('share helpers', () => {
  it('builds a marketplace share payload with a public URL', () => {
    const payload = buildMarketplaceSharePayload({
      id: 'listing-1',
      title: 'Biology 101',
      sellerName: 'Dana',
    });

    expect(payload.url).toBe('https://ainotecards.com/marketplace/listing-1');
    expect(payload.message).toContain('Biology 101');
    expect(payload.message).toContain('Seller: Dana');
  });

  it('builds a concise study result share message', () => {
    expect(buildStudyResultShareMessage({
      deckTitle: 'Chemistry',
      correct: 8,
      total: 10,
    })).toBe('I reviewed "Chemistry" on AI Notecards and got 8/10 correct.');
  });
});
