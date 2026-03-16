# AI Notecards

AI-powered flashcard app with a peer-to-peer marketplace. Paste your notes or type a topic — AI generates study flashcards instantly. Buy and sell decks from other learners.

## Features

- **AI Generation** — Paste notes or type a topic, get 8–25 study flashcards in seconds (Groq + Gemini fallback)
- **Study Mode** — Flip-card interface with keyboard shortcuts, progress tracking, and study score
- **iOS Offline Study** — Download decks, study locally, and sync queued sessions when connectivity returns
- **Deck Marketplace** — Browse, search, and buy flashcard decks from other users ($1–$5)
- **Sell Your Decks** — List your best AI-generated decks and earn 50% of every sale via Stripe Connect
- **Ratings & Reviews** — Rate purchased decks after studying, 1–5 stars
- **Content Moderation** — Report inappropriate listings, admin review queue
- **Tiered Plans** — Free (1 gen/day), 7-day trial (10 gen/day), Pro at $9/mo (10 gen/day + selling)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS 3, react-router-dom v7 |
| Backend | Node.js, Express 4, ES modules |
| Database | PostgreSQL (Supabase in production) |
| AI | Groq (llama-3.3-70b) primary, Google Gemini fallback |
| Auth | bcrypt + JWT in httpOnly cookies |
| Payments | Stripe Checkout (subscriptions) + Stripe Connect Express (marketplace) |
| Mobile Offline | Expo SQLite + NetInfo + MMKV |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Stripe account (test mode)
- Groq API key (and optionally Gemini)

### Setup

```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Create database
createdb notecards

# Configure environment
cp server/.env.example server/.env
# Edit server/.env with your API keys (see Environment Variables below)

# Run migrations
cd server && npm run migrate

# Optional: seed demo data
npm run seed
# Demo user: demo@example.com / password123
```

### Environment Variables

Create `server/.env` from `server/.env.example`:

```env
DATABASE_URL=postgresql://localhost:5432/notecards
DATABASE_URL_DIRECT=postgresql://localhost:5432/notecards
GROQ_API_KEY=gsk_xxx
GEMINI_API_KEY=your-gemini-key
AI_PROVIDER=groq
JWT_SECRET=your-jwt-secret
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@ai-notecards.com
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRO_PRICE_ID=price_xxx
CLIENT_URL=http://localhost:5173
PORT=3001
NODE_ENV=development
```

### Run

```bash
# Terminal 1 — server
cd server && npm run dev    # http://localhost:3001

# Terminal 2 — client
cd client && npm run dev    # http://localhost:5173
```

Open http://localhost:5173

## iOS Mobile Development

The iOS app lives in [mobile](/Users/kashane/app-dev/apps/ai-notecards/mobile) and should be developed as a custom Expo dev client app, not as an Expo Go-only app.

### One-Time Setup

```bash
cd /Users/kashane/app-dev/apps/ai-notecards/mobile
npm install
cp .env.example .env
```

Set at least:

```env
APP_ENV=development
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

If you later initialize EAS for this app, also set:

```env
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-id
```

### Local iOS Workflow

Start the backend and Metro together from the repo root:

```bash
cd /Users/kashane/app-dev/apps/ai-notecards
npm run app
```

Install the local simulator dev build when needed:

```bash
npm run app:ios:simulator
```

This uses `APP_ENV=development`, which keeps the app on a non-production bundle identifier and disables production-only iOS capabilities that should not block routine simulator work.
It should install to the iOS Simulator without requiring code signing.
The mobile script also pre-generates React Native iOS codegen artifacts before invoking `expo run:ios`.

### EAS Build Profiles

- `npm run app:ios:device` — development device build
- `npm run app:ios:preview` — internal QA / preview build
- `npm run app:ios:production` — production App Store build

### App Environments

- `development` — local simulator / local dev client
- `preview` — internal testing with production-like capabilities
- `production` — final shipping app identity

The environment-specific app identity is defined in [mobile/app.config.js](/Users/kashane/app-dev/apps/ai-notecards/mobile/app.config.js).

## Database

Migrations are versioned SQL files in `server/src/db/migrations/`:

| Migration | Description |
|-----------|-------------|
| `001_initial.sql` | Users, decks, cards, study_sessions |
| `002_tiers_and_marketplace_prep.sql` | Tier columns, Connect fields, deck origin |
| `003_marketplace.sql` | Categories, listings, tags, purchases, full-text search |
| `004_ratings_and_flags.sql` | Ratings, content flags |

```bash
cd server && npm run migrate
```

The migrator tracks applied versions in a `schema_migrations` table and runs each migration in a transaction.

## Stripe Setup

### Subscriptions

1. Create a Product + Price in Stripe Dashboard ($9/mo recurring)
2. Set `STRIPE_PRO_PRICE_ID` to the price ID
3. Create a webhook endpoint pointing to `<server-url>/api/stripe/webhook`
4. Subscribe to events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `payment_intent.succeeded`, `invoice.payment_failed`
5. Set `STRIPE_WEBHOOK_SECRET` to the webhook signing secret

### Stripe Connect (Marketplace)

1. Enable Stripe Connect in your Stripe Dashboard (Express accounts)
2. Create a separate webhook endpoint for `<server-url>/webhooks/stripe-connect`
3. Subscribe to events: `account.updated`, `account.application.deauthorized`
4. Set `STRIPE_CONNECT_WEBHOOK_SECRET` to this webhook's signing secret

### Local Webhook Testing

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
stripe listen --forward-to localhost:3001/webhooks/stripe-connect --connect
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│  React SPA  │────>│  Express API │────>│ PostgreSQL │
│  (Vite)     │     │  (port 3001) │     │ (Supabase) │
└─────────────┘     └──────┬───────┘     └────────────┘
                           │
                    ┌──────┴───────┐
                    │   Stripe     │
                    │  Checkout +  │
                    │   Connect    │
                    └──────────────┘
```

**Key flows:**

- **Purchase:** Buyer clicks Buy -> Stripe Checkout (destination charge, 50/50 split) -> `payment_intent.succeeded` webhook -> idempotent copy-on-purchase (deck + cards copied in transaction)
- **Rating:** Complete study session on purchased deck -> rating modal -> atomic SQL average update
- **Trial:** Signup sets `trial_ends_at = NOW() + 7 days` -> `checkTrialExpiry` middleware auto-downgrades on every authenticated request (no cron needed)

## Production Deployment

### Supabase

- Use Supabase Pro ($25/mo) — free tier pauses after 7 days of inactivity
- `DATABASE_URL`: Supavisor session mode (port 5432), pool max 12
- `DATABASE_URL_DIRECT`: Direct connection for migrations
- SSL required: `ssl: { rejectUnauthorized: false }`

### Server

Deploy to Railway, Render, or any Node.js host:
- Set all env vars from `.env.example`
- Run `npm run migrate` on deploy
- Ensure `NODE_ENV=production`

### Client

Deploy to Cloudflare Pages, Vercel, or Netlify:
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_URL` to your production server URL

## License

Private — all rights reserved.
