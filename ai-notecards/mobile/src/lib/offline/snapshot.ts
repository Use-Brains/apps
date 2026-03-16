import type { Card, DeckWithCards } from '@/types/api';
import type { OfflineDeckSnapshot } from './types';

function normalizeCard(card: Card) {
  return {
    id: card.id,
    deckId: card.deckId,
    front: card.front,
    back: card.back,
    position: card.position,
  };
}

export function createOfflineDeckSnapshot(deck: DeckWithCards): OfflineDeckSnapshot {
  return {
    id: deck.id,
    title: deck.title,
    cardCount: deck.cardCount,
    origin: deck.origin,
    downloadedAt: Date.now(),
    serverUpdatedAt: deck.updatedAt,
    deletedOnServer: false,
    cards: deck.cards.map(normalizeCard),
  };
}
