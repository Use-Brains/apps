import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPublicStorageUrl, resolveAvatarUrl } from './storage.js';

function withEnv(values, fn) {
  const previous = new Map();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous.entries()) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

test('buildPublicStorageUrl uses configured public base url', async () => {
  await withEnv(
    {
      STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com/storage',
      STORAGE_PROVIDER: 'supabase',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    },
    () => {
      const url = buildPublicStorageUrl('avatars/user-1.jpg');
      assert.equal(url, 'https://cdn.example.com/storage/avatars/user-1.jpg');
    }
  );
});

test('resolveAvatarUrl appends cache busting for stored avatars', async () => {
  await withEnv(
    {
      STORAGE_PROVIDER: 'supabase',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      STORAGE_PUBLIC_BASE_URL: undefined,
    },
    () => {
      const url = resolveAvatarUrl({
        avatar_url: 'avatars/user-1.jpg',
        google_avatar_url: null,
        updated_at: '2026-03-20T12:00:00.000Z',
      });

      assert.match(url, /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/public\/avatars\/user-1\.jpg\?v=/);
    }
  );
});

test('resolveAvatarUrl falls back to google avatar when storage is unavailable', async () => {
  await withEnv(
    {
      STORAGE_PROVIDER: 'none',
      STORAGE_PUBLIC_BASE_URL: undefined,
      SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    () => {
      const url = resolveAvatarUrl({
        avatar_url: 'avatars/user-1.jpg',
        google_avatar_url: 'https://lh3.googleusercontent.com/avatar',
        updated_at: null,
      });

      assert.equal(url, 'https://lh3.googleusercontent.com/avatar');
    }
  );
});
