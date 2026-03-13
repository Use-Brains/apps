import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import generateRoutes from './routes/generate.js';
import deckRoutes from './routes/decks.js';
import studyRoutes from './routes/study.js';
import stripeRoutes from './routes/stripe.js';
import settingsRoutes from './routes/settings.js';
import pool from './db/pool.js';

const app = express();
const PORT = process.env.PORT || 3001;

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/settings', settingsRoutes);

// Health check with DB connection test
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
