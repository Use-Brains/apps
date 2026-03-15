import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      if (event.request?.data) {
        delete event.request.data;
      }
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      if (event.request?.headers?.cookie) {
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import authMagicRoutes from './routes/auth-magic.js';
import authGoogleRoutes from './routes/auth-google.js';
import generateRoutes from './routes/generate.js';
import deckRoutes from './routes/decks.js';
import studyRoutes from './routes/study.js';
import stripeRoutes from './routes/stripe.js';
import settingsRoutes from './routes/settings.js';
import marketplaceRoutes from './routes/marketplace.js';
import sellerRoutes from './routes/seller.js';
import ratingsRoutes from './routes/ratings.js';
import accountRoutes from './routes/account.js';
import adminRoutes from './routes/admin.js';
import pool from './db/pool.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy when behind Railway/Vercel (needed for rate limiting + correct IP)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Stripe webhooks need raw body — must be before express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/webhooks', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Validate required env vars for auth revamp
const requiredEnvVars = ['JWT_SECRET'];
if (process.env.NODE_ENV === 'production') {
  requiredEnvVars.push('RESEND_API_KEY', 'GOOGLE_CLIENT_ID');
}
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/magic-link', authMagicRoutes);
app.use('/api/auth/google', authGoogleRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/admin', adminRoutes);

// Stripe Connect webhook (separate endpoint, separate signing secret)
import { getStripe } from './services/stripe.js';
app.post('/webhooks/stripe-connect', async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_CONNECT_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Connect webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object;
        await pool.query(
          `UPDATE users SET connect_charges_enabled = $1, connect_payouts_enabled = $2
           WHERE stripe_connect_account_id = $3`,
          [account.charges_enabled, account.payouts_enabled, account.id]
        );
        if (account.requirements?.currently_due?.length > 0) {
          console.log(`Connect account ${account.id} has pending requirements:`, account.requirements.currently_due);
        }
        break;
      }

      case 'account.application.deauthorized': {
        const account = event.data.object;
        // Delist first, then nullify — single CTE to avoid race condition
        await pool.query(
          `WITH delisted AS (
            UPDATE marketplace_listings SET status = 'delisted', delisted_at = NOW(), updated_at = NOW()
            WHERE seller_id = (SELECT id FROM users WHERE stripe_connect_account_id = $1)
              AND status = 'active'
          )
          UPDATE users SET stripe_connect_account_id = NULL,
            connect_charges_enabled = false, connect_payouts_enabled = false
          WHERE stripe_connect_account_id = $1`,
          [account.id]
        );
        console.log(`Connect account ${account.id} deauthorized — listings delisted`);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Connect webhook ${event.type} error:`, err);
  }

  res.json({ received: true });
});

// Health check with DB connection test
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// API 404 catch-all (after all route registrations)
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Sentry error handler (captures errors before the generic handler)
Sentry.setupExpressErrorHandler(app);

// Generic catch-all error handler — prevents Express from leaking stack traces
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

import { shutdownAnalytics } from './services/analytics.js';

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  const timeout = setTimeout(() => process.exit(1), 5000);
  server.close();
  await shutdownAnalytics();
  await pool.end();
  clearTimeout(timeout);
  process.exit(0);
});
