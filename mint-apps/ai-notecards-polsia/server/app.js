import * as Sentry from '@sentry/node';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
import authAppleRoutes from './routes/auth-apple.js';
import authMagicRoutes from './routes/auth-magic.js';
import authGoogleRoutes from './routes/auth-google.js';
import generateRoutes from './routes/generate.js';
import deckRoutes from './routes/decks.js';
import studyRoutes from './routes/study.js';
import handoffBillingRoutes from './routes/handoff-billing.js';
import revenueCatRoutes from './routes/revenuecat.js';
import settingsRoutes from './routes/settings.js';
import marketplaceRoutes from './routes/marketplace.js';
import sellerRoutes from './routes/seller.js';
import ratingsRoutes from './routes/ratings.js';
import accountRoutes from './routes/account.js';
import adminRoutes from './routes/admin.js';
import notificationsRoutes from './routes/notifications.js';
import { getRuntimeConfig } from './config/runtime.js';
import pool from './db/index.js';
import { shutdownAnalytics } from './services/analytics.js';

const app = express();
const PORT = process.env.PORT || 3001;
const runtime = getRuntimeConfig();
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const clientBuild = runtime.deployment.clientBuild;
const clientDistPath = clientBuild.distPath || path.resolve(serverDir, '../client/dist');
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || '';
const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID || 'com.ainotecards.app';

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: runtime.clientUrl,
    credentials: true,
  })
);

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

app.use('/api/auth', authRoutes);
app.use('/api/auth/apple', authAppleRoutes);
app.use('/api/auth/magic-link', authMagicRoutes);
app.use('/api/auth/google', authGoogleRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/stripe', handoffBillingRoutes);
app.use('/api/revenuecat', revenueCatRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.get('/.well-known/apple-app-site-association', (_req, res) => {
  res.type('application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');

  const appId = APPLE_TEAM_ID ? `${APPLE_TEAM_ID}.${IOS_BUNDLE_ID}` : IOS_BUNDLE_ID;

  res.json({
    applinks: {
      apps: [],
      details: [{
        appIDs: [appId],
        components: [
          { '/': '/marketplace', comment: 'Marketplace browse' },
          { '/': '/marketplace/*', comment: 'Marketplace listing detail' },
          { '/': '/verify-code', comment: 'Magic link verification' },
          { '/': '/seller/onboard/return', comment: 'Seller onboarding return' },
        ],
      }],
    },
  });
});

app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (clientBuild.enabled) {
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));

    app.get('*', (req, res, next) => {
      if (req.method !== 'GET') return next();
      if (req.path === '/api' || req.path.startsWith('/api/')) return next();
      if (req.path.startsWith('/.well-known')) return next();
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  } else {
    console.warn(`SERVE_CLIENT_BUILD is enabled but no client dist was found at ${clientDistPath}`);
  }
}

Sentry.setupExpressErrorHandler(app);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

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
