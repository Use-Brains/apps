import { PostHog } from 'posthog-node';
import pool from '../db/index.js';

let client = null;

function getClient() {
  if (client) return client;
  if (!process.env.POSTHOG_API_KEY) return null;
  client = new PostHog(process.env.POSTHOG_API_KEY, {
    host: 'https://us.i.posthog.com',
    flushAt: 20,
    flushInterval: 10000,
  });
  client.on('error', (err) => console.error('[PostHog]', err));
  return client;
}

export async function trackServerEvent(userId, event, properties = {}) {
  const ph = getClient();
  if (!ph) return;
  try {
    const { rows } = await pool.query(
      "SELECT preferences->>'analytics_opt_out' AS opted_out FROM users WHERE id = $1",
      [userId]
    );
    if (rows[0]?.opted_out === 'true') return;
    ph.capture({ distinctId: userId, event, properties });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.warn('[PostHog]', err);
  }
}

export async function shutdownAnalytics() {
  if (client) {
    try {
      await client.shutdown();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.warn('[PostHog shutdown]', err);
    }
  }
}
