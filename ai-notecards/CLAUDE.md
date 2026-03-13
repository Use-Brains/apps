# AI Notecards

AI-powered flashcard app with marketplace. Paste notes or type a topic, AI generates study flashcards. Buy and sell decks on the marketplace.

## Stack

- **Frontend:** React 19 (Vite), Tailwind CSS 3, react-router-dom v7, react-hot-toast — `client/` on port 5173
- **Backend:** Node.js (ES modules), Express 4 — `server/` on port 3001
- **Database:** PostgreSQL (Supabase in production) — local database name `notecards`
- **AI (Primary):** Groq (`llama-3.3-70b-versatile`) via OpenAI-compatible SDK
- **AI (Fallback):** Google Gemini (`gemini-2.5-flash-lite`) via `@google/genai`
- **Auth:** bcrypt + JWT in httpOnly cookies
- **Payments:** Stripe Checkout (subscriptions) + Stripe Connect Express (marketplace payouts)

## Project Structure

```
client/src/
  components/       # Navbar
  pages/            # Landing, Login, Signup, Dashboard, DeckView, Generate,
                    # Study, Pricing, Settings, Marketplace, MarketplaceDeck,
                    # ListDeck, SellerDashboard, Admin
  lib/              # api.js (fetch wrapper), AuthContext.jsx (React context)

server/src/
  routes/           # auth, generate, decks, study, stripe, settings,
                    # marketplace, seller, ratings, admin
  middleware/       # auth.js (JWT verification), plan.js (tier checks + generation limits)
  services/         # ai.js (Groq/Gemini with auto-fallback), purchase.js (Stripe checkout + fulfillment)
  db/               # pool.js (lazy-init PG pool), migrator.js (versioned runner), migrate.js
  db/migrations/    # 001_initial.sql, 002_tiers_and_marketplace_prep.sql,
                    # 003_marketplace.sql, 004_ratings_and_flags.sql
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
cd server && npm run migrate   # runs versioned migrations
npm run seed                   # demo user: demo@example.com / password123
```

### Tables

| Table | Purpose |
|-------|---------|
| `users` | Accounts, plans, Stripe IDs, study score, suspension status |
| `decks` | Flashcard decks with origin (generated/purchased) |
| `cards` | Individual cards belonging to decks |
| `study_sessions` | Session tracking with correct/total counts |
| `marketplace_categories` | 13 seeded categories (Science, Languages, etc.) |
| `marketplace_listings` | Active/delisted/removed listings with tsvector search |
| `listing_tags` | Up to 5 tags per listing |
| `purchases` | Purchase records with Stripe payment intent deduplication |
| `ratings` | 1-5 star ratings, one per user per listing |
| `content_flags` | User-submitted reports with admin resolution |
| `schema_migrations` | Migration version tracking |

### Migrations

Versioned SQL files in `server/src/db/migrations/`. The migrator reads files sequentially, tracks applied versions in `schema_migrations`, and runs each in a transaction. Use `DATABASE_URL_DIRECT` for migrations (bypasses connection pooler).

## Environment

Server env vars in `server/.env` (see `server/.env.example`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (pooler in production) |
| `DATABASE_URL_DIRECT` | Direct PostgreSQL connection (migrations only) |
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default: 3001) |
| `GROQ_API_KEY` | Primary AI provider |
| `GEMINI_API_KEY` | Fallback AI provider |
| `AI_PROVIDER` | `groq` (default) or `gemini` |
| `JWT_SECRET` | JWT signing secret |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Platform webhook signing secret |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Connect webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Price ID for Pro subscription ($9/mo) |
| `CLIENT_URL` | Frontend URL (CORS + Stripe redirects) |

## API Routes

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace` | Browse listings (cursor pagination, search, filter, sort) |
| GET | `/api/marketplace/categories` | List categories with counts (cached 1hr) |
| GET | `/api/marketplace/:id` | Listing detail with preview cards |
| GET | `/api/ratings/listing/:id` | Ratings for a listing |
| GET | `/api/health` | Health check with DB connection test |

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Register (starts 7-day trial) |
| POST | `/api/auth/login` | Login (checks suspension) |
| GET | `/api/auth/me` | Current user (auto-downgrades expired trials) |
| POST | `/api/auth/logout` | Clear auth cookie |

### Authenticated
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/generate` | AI card generation (tier-limited) |
| GET | `/api/decks` | List user's decks |
| GET | `/api/decks/:id` | Deck detail with cards |
| DELETE | `/api/decks/:id` | Delete a deck |
| POST | `/api/study/start` | Start study session |
| PATCH | `/api/study/:id` | Complete session (increments study_score) |
| GET/PATCH | `/api/settings` | Profile management |
| POST | `/api/marketplace/:id/purchase` | Create Stripe Checkout for purchase |
| POST | `/api/marketplace/:id/flag` | Report a listing |
| POST | `/api/ratings` | Submit rating (requires purchase + study) |
| POST | `/api/stripe/checkout` | Create Pro subscription checkout |
| POST | `/api/stripe/cancel` | Cancel subscription (at period end) |

### Seller (requires Pro + Stripe Connect)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/seller/listings` | Create listing |
| PATCH | `/api/seller/listings/:id` | Update listing |
| DELETE | `/api/seller/listings/:id` | Delist listing |
| POST | `/api/seller/listings/:id/relist` | Relist delisted listing |
| GET | `/api/seller/listings` | Seller's own listings |
| GET | `/api/seller/dashboard` | Earnings and listing stats |
| POST | `/api/seller/onboard` | Start Stripe Connect onboarding |
| GET | `/api/seller/onboard/refresh` | Regenerate onboarding link |
| GET | `/api/seller/onboard/return` | Verify Connect status |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/flags` | List all content flags |
| PATCH | `/api/admin/flags/:id` | Resolve flag (dismiss/uphold/suspend) |
| PATCH | `/api/admin/users/:id/suspend` | Suspend/unsuspend user |

### Webhooks (raw body, no auth middleware)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/stripe/webhook` | Platform webhook (subscriptions, purchases) |
| POST | `/webhooks/stripe-connect` | Connect webhook (account updates) |

## Client Routes

| Path | Page | Auth | Description |
|------|------|------|-------------|
| `/` | Landing | Public only | Hero, how it works, marketplace section, pricing |
| `/login` | Login | Public only | Email/password login |
| `/signup` | Signup | Public only | Registration (starts 7-day trial) |
| `/pricing` | Pricing | None | Free vs Pro comparison |
| `/marketplace` | Marketplace | None | Browse/search/filter listings |
| `/marketplace/:id` | MarketplaceDeck | None | Listing preview, buy, report |
| `/dashboard` | Dashboard | Required | User's decks, trial banner, study score |
| `/decks/:id` | DeckView | Required | View/edit deck cards |
| `/generate` | Generate | Required | AI card generation form |
| `/study/:deckId` | Study | Required | Flashcard study session with rating modal |
| `/settings` | Settings | Required | Profile editing, subscription management |
| `/sell/:deckId` | ListDeck | Required | Create marketplace listing form |
| `/seller` | SellerDashboard | Required | Seller stats, listings, Connect onboarding |
| `/admin/flags` | Admin | Required (admin) | Content moderation queue |

## Tier System

| Plan | Price | Generations/day | Max Decks | Marketplace |
|------|-------|-----------------|-----------|-------------|
| **Free** | $0 | 1 | 10 (generated only) | Buy only |
| **Trial** | $0 (7 days) | 10 | Unlimited | Buy only |
| **Pro** | $9/mo | 10 | Unlimited | Buy + Sell |

- Trial starts on signup with exact timestamp expiry (not midnight)
- Expiry checked at request time via `checkTrialExpiry` middleware — no cron
- Pro downgrade (cancelled/failed payment) delists all active marketplace listings
- Purchased decks don't count toward deck limits

## Marketplace

- **Selling:** Pro users complete Stripe Connect Express onboarding, then list generated decks ($1–$5, min 10 cards, max 50 active listings, 13 categories, up to 5 tags)
- **Payments:** Destination charges with 70/30 split (seller/platform). `application_fee_amount` calculated at checkout.
- **Purchase flow:** Stripe Checkout → `payment_intent.succeeded` webhook → idempotent fulfillment (ON CONFLICT DO NOTHING) → copy source deck+cards in transaction → increment purchase_count
- **Search:** PostgreSQL full-text search via `tsvector` GENERATED column + GIN index
- **Browse:** Cursor-based pagination (20/page), sort by popular/newest/rating/price
- **Ratings:** One per user per listing, requires purchase + completed study session. Atomic SQL update for average (no read-modify-write).
- **Moderation:** Report button with reason selection (Inappropriate/Misleading/Spam/Low Quality/Other). Admin queue with dismiss/uphold (delist)/uphold+suspend actions.

## Design System

Warm parchment palette:

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#FAF7F2` | Page backgrounds |
| Text primary | `#1A1614` | Headings, body text |
| Text secondary | `#6B635A` | Captions, labels |
| Accent green | `#1B6B5A` | Buttons, links, CTAs |
| Accent green light | `#2D8A5E` | Success states, gradients |
| Accent gold | `#C8A84E` | Ratings, badges, highlights |
| Light accent | `#E8F5F0` | Tag backgrounds, soft emphasis |
| Study dark | `#1A1614` via `#0d4a3d` | Study mode gradient background |

## Conventions

- ES modules throughout (`"type": "module"` in both package.json files)
- Vite proxies `/api` requests to Express server (no CORS in dev)
- Database pool is lazily initialized (avoids ES module import hoisting issue with dotenv)
- In production: SSL + pool max 12 for Supabase Supavisor session mode (port 5432)
- AI service auto-falls back to secondary provider on failure
- AI hard cap: 25 cards suggested in prompt, 30 cards max enforced by `parseCards()` in backend
- All routes under `/api/` prefix except `/webhooks/stripe-connect`
- Auth state managed via React context (`AuthContext.jsx`)
- Toast notifications via react-hot-toast (dark style, top-right)
- CSS card flip animation using `perspective` + `rotateY(180deg)` (no animation library)
- Webhook endpoints use `express.raw()` before `express.json()` for Stripe signature verification
- Stripe has two separate webhook endpoints with separate signing secrets (platform + Connect)
- Idempotent webhook handling via unique constraints + ON CONFLICT DO NOTHING
- Purchase fulfillment reads source deck outside transaction, writes copy inside transaction
