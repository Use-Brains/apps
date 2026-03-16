import { api } from '@/lib/api';
import { getDownloadedDecks, markDeckDeletedOnServer, saveDeckSnapshot } from './repository';
import { createOfflineDeckSnapshot } from './snapshot';

export async function downloadDeckForOffline(deckId: string) {
  const detail = await api.getDeck(deckId);
  await saveDeckSnapshot(null, createOfflineDeckSnapshot(detail.deck));
  return detail.deck;
}

export async function refreshOfflineDeckSnapshots() {
  const [downloadedDecks, remoteDecks] = await Promise.all([
    getDownloadedDecks(null),
    api.getDecks(),
  ]);

  const remoteById = new Map(remoteDecks.decks.map((deck) => [deck.id, deck]));

  for (const localDeck of downloadedDecks) {
    const remoteDeck = remoteById.get(localDeck.id);
    if (!remoteDeck) {
      await markDeckDeletedOnServer(null, localDeck.id, true);
      continue;
    }

    if (remoteDeck.updatedAt !== localDeck.serverUpdatedAt) {
      await downloadDeckForOffline(localDeck.id);
    }
  }
}
