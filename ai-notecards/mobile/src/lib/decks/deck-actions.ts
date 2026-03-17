import type { Deck, User } from '@/types/api';

export type SellAvailabilityReason = 'ready' | 'needs_onboarding' | 'purchased_deck';

export type DeckActionState = {
  canSell: boolean;
  sellReason: SellAvailabilityReason;
  deleteLabel: 'Delete' | 'Archive' | 'Restore';
  isDeleteDestructive: boolean;
  canDownload: boolean;
  canRemoveDownload: boolean;
  isDownloadedIndicatorVisible: boolean;
};

export function getSellAvailability(deck: Deck, user: User | null): SellAvailabilityReason {
  if (deck.origin === 'purchased') {
    return 'purchased_deck';
  }

  if (!user || user.plan !== 'pro' || !user.sellerTermsAccepted || !user.stripeConnectOnboarded) {
    return 'needs_onboarding';
  }

  return 'ready';
}

export function getDeckActionState(input: {
  deck: Deck;
  user: User | null;
  isDownloaded: boolean;
  isDownloading: boolean;
}): DeckActionState {
  const sellReason = getSellAvailability(input.deck, input.user);
  const isArchivedPurchasedDeck = input.deck.origin === 'purchased' && !!input.deck.archivedAt;

  return {
    canSell: sellReason === 'ready',
    sellReason,
    deleteLabel: isArchivedPurchasedDeck ? 'Restore' : input.deck.origin === 'purchased' ? 'Archive' : 'Delete',
    isDeleteDestructive: input.deck.origin !== 'purchased',
    canDownload: !input.isDownloaded && !input.isDownloading,
    canRemoveDownload: input.isDownloaded,
    isDownloadedIndicatorVisible: input.isDownloaded && !input.isDownloading,
  };
}
