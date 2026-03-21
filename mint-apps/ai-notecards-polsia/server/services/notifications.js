import { getUserTimezone, normalizeTimezone } from './study-timezone.js';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

function getNotificationPreference(preferences, preferenceKey) {
  const notifications = preferences?.notifications;
  if (!notifications || typeof notifications !== 'object' || Array.isArray(notifications)) {
    return true;
  }

  if (!(preferenceKey in notifications)) {
    return true;
  }

  return notifications[preferenceKey] !== false;
}

function normalizeDeviceTokenPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('device token payload is required');
  }

  const token = typeof input.token === 'string' ? input.token.trim() : '';
  if (token.length === 0 || token.length > 255) {
    throw new Error('token is required');
  }

  const permissionStatus = typeof input.permissionStatus === 'string'
    ? input.permissionStatus.trim()
    : 'granted';
  if (!['granted', 'denied', 'undetermined'].includes(permissionStatus)) {
    throw new Error('permissionStatus is invalid');
  }

  return {
    token,
    platform: 'ios',
    provider: 'expo',
    timezone: normalizeTimezone(input.timezone),
    permissionStatus,
  };
}

export async function upsertDeviceToken(client, userId, input) {
  if (!userId) {
    throw new Error('userId is required');
  }

  const payload = normalizeDeviceTokenPayload(input);

  const { rows: [row] } = await client.query(
    `INSERT INTO device_tokens
      (user_id, platform, provider, token, timezone, status, permission_status, updated_at, last_used_at)
     VALUES ($1, $2, $3, $4, $5, 'active', $6, NOW(), NOW())
     ON CONFLICT (token) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       platform = EXCLUDED.platform,
       provider = EXCLUDED.provider,
       timezone = EXCLUDED.timezone,
       status = 'active',
       permission_status = EXCLUDED.permission_status,
       updated_at = NOW(),
       last_used_at = NOW()
     RETURNING id, user_id, token, timezone, status, permission_status`,
    [userId, payload.platform, payload.provider, payload.token, payload.timezone, payload.permissionStatus],
  );

  return row;
}

export async function deactivateDeviceToken(client, userId, token) {
  if (!userId || typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('userId and token are required');
  }

  await client.query(
    `UPDATE device_tokens
     SET status = 'inactive', updated_at = NOW()
     WHERE user_id = $1 AND token = $2`,
    [userId, token.trim()],
  );
}

export async function notifyUser(client, userId, payload, options = {}, fetchImpl = fetch) {
  if (!userId) {
    throw new Error('userId is required');
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('payload is required');
  }

  const { preferenceKey } = options;

  const { rows: [user] } = await client.query(
    'SELECT preferences FROM users WHERE id = $1',
    [userId],
  );

  if (preferenceKey && !getNotificationPreference(user?.preferences || {}, preferenceKey)) {
    return { sent: 0, skipped: 'preference_disabled' };
  }

  const { rows: tokens } = await client.query(
    `SELECT token, timezone
     FROM device_tokens
     WHERE user_id = $1 AND status = 'active' AND permission_status = 'granted'`,
    [userId],
  );

  if (tokens.length === 0) {
    return { sent: 0, skipped: 'no_active_tokens' };
  }

  const messages = tokens.map((entry) => ({
    to: entry.token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: {
      type: payload.type,
      url: typeof payload.url === 'string' ? payload.url : undefined,
      ...((payload.metadata && typeof payload.metadata === 'object') ? payload.metadata : {}),
    },
  }));

  const response = await fetchImpl(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo push request failed with status ${response.status}`);
  }

  const result = await response.json();
  const tickets = Array.isArray(result?.data) ? result.data : [];
  const invalidTokens = [];

  for (let index = 0; index < tickets.length; index += 1) {
    const ticket = tickets[index];
    if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
      invalidTokens.push(tokens[index]?.token);
    }
  }

  if (invalidTokens.length > 0) {
    await client.query(
      `UPDATE device_tokens
       SET status = 'inactive', updated_at = NOW()
       WHERE user_id = $1 AND token = ANY($2::text[])`,
      [userId, invalidTokens],
    );
  }

  return {
    sent: tickets.filter((ticket) => ticket?.status === 'ok').length,
    invalidated: invalidTokens.length,
  };
}

export function getReminderTimezone(preferences) {
  return getUserTimezone(preferences);
}
