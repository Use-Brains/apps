# AI Notecards

AI-powered flashcard app. Paste notes or type a topic, and AI generates study flashcards.

## Setup

```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Create database
createdb notecards

# Configure environment
cp server/.env.example server/.env
# Edit server/.env with your ANTHROPIC_API_KEY

# Run migrations
cd server && npm run migrate

# Optional: seed demo data
npm run seed
# Demo user: demo@example.com / password123
```

## Development

Start both client and server:

```bash
# Terminal 1 — server (port 3001)
cd server && npm run dev

# Terminal 2 — client (port 5173)
cd client && npm run dev
```

Open http://localhost:5173

## Stack

- **Frontend:** React (Vite), Tailwind CSS
- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **AI:** Claude (Anthropic)
- **Payments:** Stripe (scaffolded)
