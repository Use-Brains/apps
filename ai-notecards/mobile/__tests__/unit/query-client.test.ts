import { describe, expect, it } from 'vitest';

import { sanitizePersistedClient, shouldPersistQuery } from '../../src/lib/query-client';

describe('query cache persistence', () => {
  it('persists only successful queries for allowlisted offline roots', () => {
    expect(shouldPersistQuery({
      queryKey: ['decks', 'list'],
      state: {
        status: 'success',
      },
    } as never)).toBe(true);

    expect(shouldPersistQuery({
      queryKey: ['decks', 'list'],
      state: {
        status: 'pending',
      },
    } as never)).toBe(false);

    expect(shouldPersistQuery({
      queryKey: ['profile', 'settings'],
      state: {
        status: 'success',
      },
    } as never)).toBe(false);
  });

  it('drops persisted pending queries during restore', () => {
    expect(sanitizePersistedClient({
      clientState: {
        queries: [
          {
            queryKey: ['decks', 'list'],
            state: { status: 'pending' },
          } as never,
          {
            queryKey: ['decks', 'list'],
            state: { status: 'success' },
          } as never,
          {
            queryKey: ['profile', 'settings'],
            state: { status: 'success' },
          } as never,
        ],
      },
    } as never)).toEqual({
      clientState: {
        queries: [
          {
            queryKey: ['decks', 'list'],
            state: { status: 'success' },
          },
        ],
      },
    });
  });
});
