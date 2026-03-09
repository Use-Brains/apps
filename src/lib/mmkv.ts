import { createMMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';

const ENCRYPTION_KEY_ID = 'mmkv-encryption-key';

function getOrCreateEncryptionKey(): string {
  let key = SecureStore.getItem(ENCRYPTION_KEY_ID);
  if (!key) {
    // Generate a random 16-char key for AES-128
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    key = Array.from({ length: 16 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
    SecureStore.setItem(ENCRYPTION_KEY_ID, key);
  }
  return key;
}

export const storage = createMMKV({
  id: 'trade-journal',
  encryptionKey: getOrCreateEncryptionKey(),
});

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
