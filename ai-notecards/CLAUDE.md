# AI Notecards

AI-powered flashcard app with marketplace. Paste notes or type a topic, AI generates study flashcards. Buy and sell decks on the marketplace.

## Stack

- **Frontend:** React 19 (Vite), Tailwind CSS 3, react-router-dom v7, react-hot-toast — `client/` on port 5173
- **Backend:** Node.js (ES modules), Express 4 — `server/` on port 3001
- **Database:** PostgreSQL (Supabase in production) — database name `notecards`
- **AI (Primary):** Groq (`llama-3.3-70b-versatile`) via OpenAI-compatible SDK
- **AI (Fallback):** Google Gemini (`gemini-2.5-flash-lite`) via `@google/genai`
- **Auth:** bcrypt + JWT in httpOnly cookies
- **Payments:** Stripe Checkout (subscriptions) + Stripe Connect Express (marketplace payouts)

## Project Structure

```
client/src/
  components/   # Navbar, shared UI
  pages/        # Landing, Login, Signup, Dashboard, DeckView, Generate, Study,
                # Pricing, Settings, Marketplace, MarketplaceDeck, ListDeck,
                # SellerDashboard, Admin
  lib/          # api.js (fetch wrapper), AuthContext.jsx (React context)

server/src/
  routes/       # auth, generate, decks, study, stripe, settings, marketplace, seller, ratings, admin
  middleware/   # auth.js (JWT verification), plan.js (tier checks, generation limits)
  services/     # ai.js (Groq/Gemini abstraction), purchase.js (checkout + fulfillment)
  db/           # pool.js (lazy-init PG pool), migrator.js (versioned migrations), migrate.js
  db/migrations/ # Numbered SQL migration files (001_initial.sql, 002_tiers_and_marketplace_prep.sql, etc.)
```

## Running

```bash
# Terminal 1 — server
cd server && npm run dev

# Terminal 2 — client
cd client && npm run dev
```

## Database

```bash
createdb notecards
cd server && npm run migrate
npm run seed   # demo user: demo@example.com / password123
```

Tables: `users`, `decks`, `cards`, `study_sessions`, `marketplace_categories`, `marketplace_listings`, `listing_tags`, `purchases`, `ratings`, `content_flags`, `schema_migrations`

Migrations are versioned SQL files in `server/src/db/migrations/`. The migrator tracks applied versions in `schema_migrations`.

## Environment

Server env vars in `server/.env` (see `server/.env.example`):
- `DATABASE_URL` — PostgreSQL connection string (pooler in production)
- `DATABASE_URL_DIRECT` — Direct PostgreSQL connection (for migrations, bypasses pooler)
- `NODE_ENV` — `development` or `production`
- `GROQ_API_KEY` — primary AI provider
- `GEMINI_API_KEY` — fallback AI provider
- `AI_PROVIDER` — `groq` (default) or `gemini`
- `JWT_SECRET` — JWT signing secret
- `STRIPE_SECRET_KEY` — Stripe API key
- `STRIPE_WEBHOOK_SECRET` — Stripe platform webhook signing secret
- `STRIPE_CONNECT_WEBHOOK_SECRET` — Stripe Connect webhook signing secret
- `STRIPE_PRO_PRICE_ID` — Stripe Price ID for Pro subscription ($9/mo)
- `CLIENT_URL` — Frontend URL (for CORS + Stripe redirect URLs)

## Tier System

- **Free**: 1 AI generation/day, max 10 decks, can buy marketplace decks
- **Trial**: 10 generations/day, unlimited decks, 7-day duration (auto-downgrades to free)
- **Pro** ($9/mo): 10 generations/day, unlimited decks, can sell on marketplace

Trial expiry is checked at request time via `checkTrialExpiry` middleware — no cron needed.

## Marketplace

- Sellers must complete Stripe Connect Express onboarding before listing
- Destination charges with 70/30 split (seller/platform)
- Price range: $1–$5 per deck
- Copy-on-purchase: buyer gets an independent copy of the deck
- Cursor-based pagination on browse, full-text search via PostgreSQL tsvector
- Ratings: one per user per listing, requires purchase + completed study session
- Content moderation: user-submitted flags, admin review queue

## Design System

Warm parchment palette:
- Background: `#FAF7F2`
- Text primary: `#1A1614`
- Text secondary: `#6B635A`
- Accent green: `#1B6B5A` (buttons, links)
- Accent gold: `#C8A84E` (ratings, badges)
- Light accent: `#E8F5F0`
- Study mode: dark gradient (`#1A1614` via `#0d4a3d`)

## Conventions

- ES modules throughout (`"type": "module"` in both package.json files)
- Vite proxies `/api` requests to the Express server (no CORS in dev)
- Database pool is lazily initialized (avoids ES module import hoisting issue with dotenv)
- AI service auto-falls back to secondary provider on failure
- AI hard cap: 25 cards suggested, 30 cards max enforced in backend
- All routes under `/api/` prefix (except `/webhooks/stripe-connect`)
- Auth state managed via React context (`AuthContext.jsx`)
- Toast notifications via react-hot-toast
- CSS card flip animation (no animation library)
- Webhook endpoints use `express.raw()` before `express.json()` for Stripe signature verification
