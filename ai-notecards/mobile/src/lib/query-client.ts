import { QueryClient } from '@tanstack/react-query';
import type { Query } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { storage } from './mmkv';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      retry: 2,
    },
  },
});

const PERSIST_KEY = 'tanstack-query-cache';

type PersistedQueryClient = PersistedClient | undefined;

export const queryPersister: Persister = {
  persistClient: async (client) => {
    storage.set(PERSIST_KEY, JSON.stringify(client));
  },
  restoreClient: async () => {
    const data = storage.getString(PERSIST_KEY);
    return data ? sanitizePersistedClient(JSON.parse(data) as PersistedQueryClient) : undefined;
  },
  removeClient: async () => {
    storage.remove(PERSIST_KEY);
  },
};

// Allowlist of query roots to persist offline.
// Default-deny: only explicitly listed roots are cached to disk.
// Add new roots here when implementing features that need offline support.
const PERSISTABLE_ROOTS = new Set(['decks', 'marketplace', 'study']);

export function shouldPersistQuery(query: Pick<Query, 'queryKey' | 'state'>) {
  const queryRoot = query.queryKey[0];
  return query.state.status === 'success' && PERSISTABLE_ROOTS.has(queryRoot as string);
}

export function sanitizePersistedClient(client: PersistedQueryClient): PersistedQueryClient {
  if (!client?.clientState?.queries) {
    return client;
  }

  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.filter((query) => shouldPersistQuery(query as never)),
    },
  };
}

export async function clearPersistedQueryCache() {
  queryClient.clear();
  await queryPersister.removeClient();
}

export const dehydrateOptions = {
  shouldDehydrateQuery: shouldPersistQuery,
};
