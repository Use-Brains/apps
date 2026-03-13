import { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';
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

export const queryPersister: Persister = {
  persistClient: async (client) => {
    storage.set(PERSIST_KEY, JSON.stringify(client));
  },
  restoreClient: async () => {
    const data = storage.getString(PERSIST_KEY);
    return data ? JSON.parse(data) : undefined;
  },
  removeClient: async () => {
    storage.remove(PERSIST_KEY);
  },
};
