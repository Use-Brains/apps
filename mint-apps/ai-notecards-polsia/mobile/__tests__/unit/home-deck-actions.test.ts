import { describe, expect, it } from 'vitest';

import { getDeckActionState, getSellAvailability } from '../../src/lib/decks/deck-actions';
import type { Deck, User } from '../../src/types/api';

const baseDeck: Deck = {
  id: 'deck-1',
  userId: 'user-1',
  title: 'Deck',
  sourceText: null,
  origin: 'generated',
  archivedAt: null,
  cardCount: 12,
  createdAt: '2026-03-16T10:00:00.000Z',
  updatedAt: '2026-03-16T10:00:00.000Z',
};

const sellerReadyUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test',
  plan: 'pro',
  subscriptionPlatform: 'apple',
  avatarUrl: null,
  studyScore: 0,
  currentStreak: 0,
  longestStreak: 0,
  trialEndsAt: null,
  cancelAtPeriodEnd: false,
  cancelAt: null,
  hasSellerPayoutAccount: true,
  sellerTermsAccepted: true,
  stripeConnectOnboarded: true,
  createdAt: '2026-03-16T10:00:00.000Z',
  preferences: {},
};

describe('deck action state', () => {
  it('marks generated decks as sell-ready when seller onboarding is complete', () => {
    expect(getSellAvailability(baseDeck, sellerReadyUser)).toBe('ready');
  });

  it('requires onboarding when the account is not seller-ready', () => {
    expect(getSellAvailability(baseDeck, { ...sellerReadyUser, stripeConnectOnboarded: false })).toBe('needs_onboarding');
  });

  it('treats purchased decks as non-sellable and archive-only', () => {
    const purchasedDeck: Deck = { ...baseDeck, origin: 'purchased' };
    const state = getDeckActionState({
      deck: purchasedDeck,
      user: sellerReadyUser,
      isDownloaded: true,
      isDownloading: false,
    });

    expect(state.canSell).toBe(false);
    expect(state.sellReason).toBe('purchased_deck');
    expect(state.deleteLabel).toBe('Archive');
    expect(state.isDeleteDestructive).toBe(false);
    expect(state.canRemoveDownload).toBe(true);
    expect(state.isDownloadedIndicatorVisible).toBe(true);
  });

  it('switches archive action to restore for archived purchased decks', () => {
    const archivedPurchasedDeck: Deck = {
      ...baseDeck,
      origin: 'purchased',
      archivedAt: '2026-03-16T11:00:00.000Z',
    };

    const state = getDeckActionState({
      deck: archivedPurchasedDeck,
      user: sellerReadyUser,
      isDownloaded: false,
      isDownloading: false,
    });

    expect(state.deleteLabel).toBe('Restore');
    expect(state.canDownload).toBe(true);
  });

  it('suppresses download action while a download is in progress', () => {
    const state = getDeckActionState({
      deck: baseDeck,
      user: sellerReadyUser,
      isDownloaded: false,
      isDownloading: true,
    });

    expect(state.canDownload).toBe(false);
    expect(state.isDownloadedIndicatorVisible).toBe(false);
  });
});
