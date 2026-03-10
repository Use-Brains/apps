import * as SecureStore from 'expo-secure-store';

const ENCRYPTION_KEY_ID = 'mmkv-encryption-key';
const STORAGE_ID = 'trade-journal';

type KeyValueStorage = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
};

type MmkvFactory = {
  createMMKV: (config: { id: string; encryptionKey: string }) => KeyValueStorage;
};

const memoryFallback = new Map<string, string>();

function generateEncryptionKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 16 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}

function getOrCreateEncryptionKey(): string {
  try {
    let key = SecureStore.getItem(ENCRYPTION_KEY_ID);
    if (!key) {
      // Generate a random 16-char key for AES-128.
      key = generateEncryptionKey();
      SecureStore.setItem(ENCRYPTION_KEY_ID, key);
    }
    return key;
  } catch {
    // Runtime without SecureStore support (tests/web); key is only needed for MMKV encryption.
    return generateEncryptionKey();
  }
}

function createSecureStoreFallbackStorage(): KeyValueStorage {
  return {
    getString: (key: string): string | undefined => {
      try {
        return SecureStore.getItem(key) ?? memoryFallback.get(key);
      } catch {
        return memoryFallback.get(key);
      }
    },
    set: (key: string, value: string): void => {
      try {
        SecureStore.setItem(key, value);
      } catch {
        memoryFallback.set(key, value);
      }
    },
    remove: (key: string): void => {
      try {
        void SecureStore.deleteItemAsync(key);
      } finally {
        memoryFallback.delete(key);
      }
    },
  };
}

function createStorage(): KeyValueStorage {
  try {
    const runtimeRequire = (globalThis as { require?: (name: string) => unknown }).require;
    if (!runtimeRequire) {
      throw new Error('Runtime require is unavailable');
    }

    const { createMMKV } = runtimeRequire('react-native-mmkv') as MmkvFactory;
    return createMMKV({
      id: STORAGE_ID,
      encryptionKey: getOrCreateEncryptionKey(),
    });
  } catch {
    // Expo Go does not include react-native-mmkv's Nitro module.
    return createSecureStoreFallbackStorage();
  }
}

export const storage: KeyValueStorage = createStorage();

/**
 * MMKV-backed storage adapter for Supabase Auth.
 * SecureStore has a 2048-byte limit; Supabase sessions exceed it.
 * We store sessions in MMKV (encrypted with a key from SecureStore).
 */
export const SupabaseMmkvAdapter = {
  getItem: (key: string): string | null => {
    return storage.getString(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
  removeItem: (key: string): void => {
    storage.remove(key);
  },
};
