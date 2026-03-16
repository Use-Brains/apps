import type { StudyMode } from '@/types/api';
import { enqueuePendingSession } from '@/lib/offline/repository';
import type { OfflineCard, OfflineDeck, PendingSession } from '@/lib/offline/types';
import { STUDY_MODE_MIN_CARDS } from './modes';

type SessionOptions = {
  now?: Date;
  createId?: () => string;
};

type QueueOptions = {
  correct: number;
  now?: Date;
  enqueuePendingSession?: (session: PendingSession) => Promise<unknown>;
};

export type LocalStudySession = {
  clientSessionId: string;
  deckId: string;
  mode: StudyMode;
  totalCards: number;
  startedAt: string;
  cardIds: string[];
  deckSnapshotUpdatedAt: string | null;
};

function defaultCreateId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSessionCards(deck: Pick<OfflineDeck, 'cards'>, mode: StudyMode): OfflineCard[] {
  if (mode === 'match') {
    return deck.cards.slice(0, 6);
  }
  return deck.cards;
}

export function getMinimumCardsForMode(mode: StudyMode) {
  return STUDY_MODE_MIN_CARDS[mode];
}

export function createLocalStudySession(
  deck: Pick<OfflineDeck, 'id' | 'cards'> & { serverUpdatedAt?: string | null },
  mode: StudyMode,
  options: SessionOptions = {},
): LocalStudySession {
  const cards = getSessionCards(deck, mode);
  const minCards = getMinimumCardsForMode(mode);
  if (cards.length < minCards) {
    throw new Error(`This mode requires at least ${minCards} cards.`);
  }

  const now = options.now ?? new Date();

  return {
    clientSessionId: (options.createId ?? defaultCreateId)(),
    deckId: deck.id,
    mode,
    totalCards: cards.length,
    startedAt: now.toISOString(),
    cardIds: cards.map((card) => card.id),
    deckSnapshotUpdatedAt: deck.serverUpdatedAt ?? null,
  };
}

export async function queueCompletedSession(
  session: LocalStudySession,
  options: QueueOptions,
) {
  const completedAt = (options.now ?? new Date()).toISOString();
  const pendingSession: PendingSession = {
    clientSessionId: session.clientSessionId,
    deckId: session.deckId,
    mode: session.mode,
    correct: options.correct,
    total: session.totalCards,
    startedAt: session.startedAt,
    completedAt,
    deckSnapshotUpdatedAt: session.deckSnapshotUpdatedAt,
    synced: false,
  };

  if (options.enqueuePendingSession) {
    await options.enqueuePendingSession(pendingSession);
  } else {
    await enqueuePendingSession(null, pendingSession);
  }
  return pendingSession;
}
