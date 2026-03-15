import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const ENCRYPTION_KEY_ID = 'mmkv-encryption-key';
const STORAGE_ID = 'ai-notecards';

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
  // Synchronous CSPRNG — randomUUID() is backed by the native secure RNG (122 bits entropy)
  return Crypto.randomUUID().replace(/-/g, '');
}

function getOrCreateEncryptionKey(): string {
  try {
    let key = SecureStore.getItem(ENCRYPTION_KEY_ID);
    if (!key) {
      key = generateEncryptionKey();
      SecureStore.setItem(ENCRYPTION_KEY_ID, key);
    }
    return key;
  } catch {
    // First write failed — generate a new key and attempt to persist it so the
    // same key is used on next launch. Without persisting, a different key is
    // generated next launch and all MMKV data becomes permanently unreadable.
    const newKey = generateEncryptionKey();
    try { SecureStore.setItem(ENCRYPTION_KEY_ID, newKey); } catch { /* best-effort */ }
    return newKey;
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
      // deleteItemAsync is the only available delete API; fire-and-forget is acceptable
      // since this is the fallback path and memoryFallback is cleared synchronously.
      void SecureStore.deleteItemAsync(key);
      memoryFallback.delete(key);
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
    return createSecureStoreFallbackStorage();
  }
}

export const storage: KeyValueStorage = createStorage();
