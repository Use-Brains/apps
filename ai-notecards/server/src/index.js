import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import authAppleRoutes from './routes/auth-apple.js';
import authAccountRoutes from './routes/auth-account.js';
import generateRoutes from './routes/generate.js';
import deckRoutes from './routes/decks.js';
import studyRoutes from './routes/study.js';
import stripeRoutes from './routes/stripe.js';
import settingsRoutes from './routes/settings.js';
import marketplaceRoutes from './routes/marketplace.js';
import sellerRoutes from './routes/seller.js';
import ratingsRoutes from './routes/ratings.js';
import adminRoutes from './routes/admin.js';
import iapRoutes from './routes/iap.js';
import appleWebhookRoutes from './routes/apple-webhook.js';
import pool from './db/pool.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Raw body for Stripe webhooks — must be before any JSON parsers
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/webhooks/stripe-connect', express.raw({ type: 'application/json' }));

// Per-route JSON body limits:
// - /api/generate gets 500KB (BYOK users can send large input)
// - Everything else gets 100KB default
app.use('/api/generate', express.json({ limit: '500kb' }));
app.use(express.json({ limit: '100kb' }));

app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/apple', authAppleRoutes);
app.use('/api/auth', authAccountRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/iap', iapRoutes);

// Stripe Connect webhook (separate endpoint, separate signing secret)
import Stripe from 'stripe';
app.post('/webhooks/stripe-connect', async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
        // Get seller ID before nulling the connect account
        const { rows } = await pool.query(
          `SELECT id FROM users WHERE stripe_connect_account_id = $1`,
          [account.id]
        );
        // Delist listings using seller ID (not connect account, which gets nulled)
        if (rows[0]) {
          await pool.query(
            `UPDATE marketplace_listings SET status = 'delisted', updated_at = NOW()
             WHERE seller_id = $1 AND status = 'active'`,
            [rows[0].id]
          );
        }
        // Then null the connect account
        await pool.query(
          `UPDATE users SET connect_charges_enabled = false, connect_payouts_enabled = false,
           stripe_connect_account_id = NULL WHERE stripe_connect_account_id = $1`,
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

// Apple webhook — JWS-signed JSON notifications from App Store Server
app.use('/webhooks/apple', appleWebhookRoutes);

// Health check with DB connection test + API version for iOS force-update
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', minClientVersion: '1.0.0' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
