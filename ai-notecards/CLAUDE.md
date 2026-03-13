# AI Notecards

AI-powered flashcard app. Paste notes or type a topic, AI generates study flashcards.

## Stack

- **Frontend:** React 19 (Vite), Tailwind CSS 3, react-router-dom v7, react-hot-toast — `client/` on port 5173
- **Backend:** Node.js (ES modules), Express 4 — `server/` on port 3001
- **Database:** PostgreSQL — database name `notecards`
- **AI (Primary):** Groq (`llama-3.3-70b-versatile`) via OpenAI-compatible SDK
- **AI (Fallback):** Google Gemini (`gemini-2.5-flash-lite`) via `@google/genai`
- **Auth:** bcrypt + JWT in httpOnly cookies
- **Payments:** Stripe Checkout (scaffolded, test keys)

## Project Structure

```
client/src/
  components/   # Navbar, shared UI
  pages/        # Landing, Login, Signup, Dashboard, DeckView, Generate, Study, Pricing
  lib/          # api.js (fetch wrapper), AuthContext.jsx (React context)

server/src/
  routes/       # auth, generate, decks, study, stripe
  middleware/   # auth.js (JWT verification)
  services/     # ai.js (Groq/Gemini abstraction with auto-fallback)
  db/           # pool.js (lazy-init PG pool), migrate.js, seed.js
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

Tables: `users`, `decks`, `cards`, `study_sessions`

## Environment

Server env vars in `server/.env` (see `server/.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `GROQ_API_KEY` — primary AI provider
- `GEMINI_API_KEY` — fallback AI provider
- `AI_PROVIDER` — `groq` (default) or `gemini`
- `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`

## Conventions

- ES modules throughout (`"type": "module"` in both package.json files)
- Vite proxies `/api` requests to the Express server (no CORS in dev)
- Database pool is lazily initialized (avoids ES module import hoisting issue with dotenv)
- AI service auto-falls back to secondary provider on failure
- Free tier: 3 AI generations/day, max 10 decks. Pro tier: unlimited.
- All routes under `/api/` prefix
- Auth state managed via React context (`AuthContext.jsx`)
- Toast notifications via react-hot-toast
- CSS card flip animation (no animation library)
