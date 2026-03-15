export const deckKeys = {
  all: ['decks'] as const,
  lists: () => [...deckKeys.all, 'list'] as const,
  details: () => [...deckKeys.all, 'detail'] as const,
  detail: (id: string) => [...deckKeys.details(), id] as const,
  stats: () => [...deckKeys.all, 'stats'] as const,
};

export const studyKeys = {
  all: ['study'] as const,
  stats: () => [...studyKeys.all, 'stats'] as const,
  history: (filters: Record<string, unknown>) => [...studyKeys.all, 'history', filters] as const,
  deckStats: () => [...studyKeys.all, 'deck-stats'] as const,
};

export const marketplaceKeys = {
  all: ['marketplace'] as const,
  lists: () => [...marketplaceKeys.all, 'list'] as const,
  list: (filters: Record<string, string>) => [...marketplaceKeys.lists(), filters] as const,
  categories: () => [...marketplaceKeys.all, 'categories'] as const,
  details: () => [...marketplaceKeys.all, 'detail'] as const,
  detail: (id: string) => [...marketplaceKeys.details(), id] as const,
  ratings: (listingId: string) => [...marketplaceKeys.all, 'ratings', listingId] as const,
};

export const sellerKeys = {
  all: ['seller'] as const,
  dashboard: () => [...sellerKeys.all, 'dashboard'] as const,
  listings: () => [...sellerKeys.all, 'listings'] as const,
};

export const profileKeys = {
  all: ['profile'] as const,
  settings: () => [...profileKeys.all, 'settings'] as const,
};
