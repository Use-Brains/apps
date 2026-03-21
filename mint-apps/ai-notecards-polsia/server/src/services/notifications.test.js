import test from 'node:test';
import assert from 'node:assert/strict';

import { deactivateDeviceToken, notifyUser, upsertDeviceToken } from './notifications.js';

function createClient({ users = new Map(), deviceTokens = [] } = {}) {
  const state = {
    users: new Map(users),
    deviceTokens: [...deviceTokens],
  };

  return {
    state,
    async query(sql, params = []) {
      if (sql.includes('INSERT INTO device_tokens')) {
        const [userId, platform, provider, token, timezone, permissionStatus] = params;
        const existingIndex = state.deviceTokens.findIndex((entry) => entry.token === token);
        const next = {
          user_id: userId,
          platform,
          provider,
          token,
          timezone,
          status: 'active',
          permission_status: permissionStatus,
        };

        if (existingIndex >= 0) {
          state.deviceTokens[existingIndex] = next;
        } else {
          state.deviceTokens.push(next);
        }

        return { rows: [{ id: 'token-1', ...next }], rowCount: 1 };
      }

      if (sql.startsWith('UPDATE device_tokens') && sql.includes('token = $2')) {
        const [userId, token] = params;
        state.deviceTokens = state.deviceTokens.map((entry) =>
          entry.user_id === userId && entry.token === token
            ? { ...entry, status: 'inactive' }
            : entry);
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('SELECT preferences FROM users')) {
        const [userId] = params;
        return {
          rows: [{ preferences: state.users.get(userId)?.preferences || {} }],
          rowCount: 1,
        };
      }

      if (sql.includes('FROM device_tokens') && sql.includes("permission_status = 'granted'")) {
        const [userId] = params;
        const rows = state.deviceTokens
          .filter((entry) => entry.user_id === userId && entry.status === 'active' && entry.permission_status === 'granted')
          .map((entry) => ({ token: entry.token, timezone: entry.timezone }));
        return { rows, rowCount: rows.length };
      }

      if (sql.startsWith('UPDATE device_tokens') && sql.includes('ANY($2::text[])')) {
        const [userId, tokens] = params;
        const invalidSet = new Set(tokens);
        state.deviceTokens = state.deviceTokens.map((entry) =>
          entry.user_id === userId && invalidSet.has(entry.token)
            ? { ...entry, status: 'inactive' }
            : entry);
        return { rows: [], rowCount: invalidSet.size };
      }

      throw new Error(`Unhandled SQL: ${sql}`);
    },
  };
}

test('upsertDeviceToken reassigns token ownership to the latest authenticated user', async () => {
  const client = createClient({
    deviceTokens: [{
      user_id: 'user-1',
      platform: 'ios',
      provider: 'expo',
      token: 'ExponentPushToken[abc]',
      timezone: 'UTC',
      status: 'active',
      permission_status: 'granted',
    }],
  });

  const row = await upsertDeviceToken(client, 'user-2', {
    token: 'ExponentPushToken[abc]',
    timezone: 'America/Los_Angeles',
    permissionStatus: 'granted',
  });

  assert.equal(row.user_id, 'user-2');
  assert.equal(client.state.deviceTokens[0].user_id, 'user-2');
  assert.equal(client.state.deviceTokens[0].timezone, 'America/Los_Angeles');
});

test('notifyUser respects notification preferences', async () => {
  const client = createClient({
    users: new Map([[
      'user-1',
      { preferences: { notifications: { marketplace_activity: false } } },
    ]]),
    deviceTokens: [{
      user_id: 'user-1',
      platform: 'ios',
      provider: 'expo',
      token: 'ExponentPushToken[abc]',
      timezone: 'UTC',
      status: 'active',
      permission_status: 'granted',
    }],
  });

  const result = await notifyUser(
    client,
    'user-1',
    { type: 'sale', title: 'Sale', body: 'You made a sale.' },
    { preferenceKey: 'marketplace_activity' },
    async () => ({ ok: true, json: async () => ({ data: [] }) }),
  );

  assert.deepEqual(result, { sent: 0, skipped: 'preference_disabled' });
});

test('notifyUser deactivates invalid Expo tokens', async () => {
  const client = createClient({
    users: new Map([['user-1', { preferences: {} }]]),
    deviceTokens: [{
      user_id: 'user-1',
      platform: 'ios',
      provider: 'expo',
      token: 'ExponentPushToken[abc]',
      timezone: 'UTC',
      status: 'active',
      permission_status: 'granted',
    }],
  });

  const result = await notifyUser(
    client,
    'user-1',
    { type: 'sale', title: 'Sale', body: 'You made a sale.' },
    { preferenceKey: 'marketplace_activity' },
    async () => ({
      ok: true,
      json: async () => ({
        data: [{
          status: 'error',
          details: { error: 'DeviceNotRegistered' },
        }],
      }),
    }),
  );

  assert.deepEqual(result, { sent: 0, invalidated: 1 });
  assert.equal(client.state.deviceTokens[0].status, 'inactive');
});

test('deactivateDeviceToken marks the token inactive for the current user', async () => {
  const client = createClient({
    deviceTokens: [{
      user_id: 'user-1',
      platform: 'ios',
      provider: 'expo',
      token: 'ExponentPushToken[abc]',
      timezone: 'UTC',
      status: 'active',
      permission_status: 'granted',
    }],
  });

  await deactivateDeviceToken(client, 'user-1', 'ExponentPushToken[abc]');

  assert.equal(client.state.deviceTokens[0].status, 'inactive');
});
