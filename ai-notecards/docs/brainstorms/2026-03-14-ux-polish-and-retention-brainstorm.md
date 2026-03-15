---
date: 2026-03-14
topic: ux-polish-and-retention
---

# UX Polish & Retention

## What We're Building

Five features that make users stay, come back, and get more value from the product: card editing after save, deck duplication, keyboard shortcuts in study mode, a guided onboarding flow, and analytics integration. These aren't launch blockers — they're the difference between users who try the app once and users who build it into their study routine.

## Why This Approach

The core product works: generate cards, study them, buy/sell on the marketplace. But the experience has friction points that compound over time. A user who can't fix a typo in a generated card loses trust in the AI. A user who lands on an empty dashboard after signup doesn't know what to do. A power user studying 200 cards without keyboard shortcuts gets frustrated. These are the "death by a thousand cuts" problems that erode retention.

Analytics is included here because without data, we're guessing which of these problems is worst. We need to measure before we can improve.

## Feature Details

### 1. Card Editing After Save

**Problem:** Generation preview lets users edit cards before saving, which is great. But once a deck is saved, cards are read-only forever. DeckView shows cards but has no edit capability. AI makes factual errors, typos, and awkward phrasing. Users will want to fix these, add context, or improve wording over time. Without editing, the only option is to delete the deck and regenerate — losing any study history attached to it.

**Approach:**
- Add edit capability to the DeckView page (`/decks/:id`)
- Each card gets an edit icon (pencil) that toggles inline editing
- Editing shows front and back as text inputs with save/cancel buttons
- New endpoint: `PATCH /api/cards/:id` — updates front and/or back text
- Validate: front and back required, reasonable max length (500 chars each)
- Only the deck owner can edit their cards
- Purchased decks are NOT editable (they're copies, but the content came from someone else's listing — editing would break the marketplace trust model)

**Additional capabilities to consider:**
- **Add card:** Button at the bottom of DeckView to add a new card manually. `POST /api/cards` with deck_id, front, back
- **Delete card:** Remove individual cards from a deck. `DELETE /api/cards/:id`
- **Reorder cards:** Drag-and-drop or move up/down buttons. Lower priority — cards are always shuffled in study mode anyway

**Architecture:**
- New route file: `server/src/routes/cards.js` with PATCH, POST, DELETE
- Middleware: authenticate + ownership check (card → deck → user_id)
- DeckView.jsx: toggle between view mode and edit mode per card
- No bulk edit for v1 — one card at a time keeps it simple

**Open question:** Should editing be available on purchased decks? Argument for: users might want to personalize. Argument against: if they resell (not currently possible) it would be someone else's content modified. Recommendation: no editing on purchased decks for v1. Users can duplicate the deck (feature #2) if they want a mutable copy.

### 2. Deck Duplication

**Problem:** Users can't copy a deck. Use cases: (1) create a subset for a specific exam, (2) make a variation with harder questions, (3) get a mutable copy of a purchased deck, (4) share a copy with a study partner (manually). The only option is to regenerate from scratch, losing the existing content.

**Approach:**
- Add "Duplicate" button on DeckView page (next to Delete)
- Creates a new deck with title "[Original Title] (copy)" and copies all cards
- New endpoint: `POST /api/decks/:id/duplicate`
- Duplicated deck gets origin = "generated" (it's user's own copy now)
- Deck count limits still apply (free tier max 10 generated decks)
- Purchased decks CAN be duplicated — the duplicate becomes a "generated" deck that the user owns and can edit

**Architecture:**
- Single transaction: INSERT deck + INSERT cards SELECT from source
- Check deck ownership (user_id matches)
- Check deck limits for free tier users
- Return the new deck object with redirect to `/decks/:newId`

**Design:** Small duplicate icon (two overlapping squares) next to the delete button. Confirmation not needed — it's a non-destructive operation.

### 3. Keyboard Shortcuts in Study Mode

**Problem:** Multiple choice mode has keyboard support (1-4 number keys to select answer), but flip mode — the most-used mode — has no keyboard shortcuts. Users studying hundreds of cards have to click three buttons: "Show Answer" → "Correct"/"Incorrect". For power users, this is painfully slow. Type-the-answer mode has Enter to submit (natural), but match mode has no keyboard support either.

**Approach — Flip Mode:**
- **Space** — flip the card (show/hide answer)
- **Right arrow** or **Enter** — mark correct and advance
- **Left arrow** or **Backspace** — mark incorrect and advance
- Show shortcut hints below the buttons: `Space to flip · → Correct · ← Incorrect`

**Approach — Match Mode:**
- **Tab** — cycle through cards
- **Enter** — select highlighted card
- Lower priority — match mode is inherently mouse/touch-driven

**Architecture:**
- Add `useEffect` with `keydown` event listener in Study.jsx flip mode section
- Clean up listener on unmount and mode change
- Prevent default on Space (would scroll page) and arrow keys
- Only active when study session is in progress (not on mode select or results screen)

**Design:** Show keyboard hints as subtle gray text below the action buttons. Hide on mobile (touch devices don't need keyboard hints). Detect touch device via `'ontouchstart' in window` or media query.

**Accessibility bonus:** Keyboard shortcuts also improve accessibility for users who can't use a mouse.

### 4. Guided Onboarding Flow

**Problem:** Welcome.jsx just collects a display name and drops users on an empty dashboard. First-time users don't know what the app does, how to generate a deck, or that a marketplace exists. The empty state CTA buttons help ("Generate your first deck") but there's no guided walkthrough. The activation rate (signup → first deck generated) is likely low, and we can't even measure it because there's no analytics.

**Approach:**
- Replace the current Welcome page with a 3-step onboarding flow:

**Step 1 — Welcome + Name (existing)**
- "Welcome to AI Notecards!"
- Display name input (pre-filled from Google if available)
- Continue button

**Step 2 — Generate Your First Deck**
- "Let's create your first flashcards"
- Simple topic input: "What are you studying?" with placeholder examples
- "Generate" button that creates their first deck right from onboarding
- Skip option: "I'll do this later"
- This is the critical activation step — if they generate a deck, they're hooked

**Step 3 — Quick Tour**
- Brief visual overview: "Here's what you can do"
- 3 cards showing: Study modes, Marketplace, Track your progress
- "Start studying" button → redirects to study the deck they just generated
- If they skipped generation: "Go to Dashboard" button

**Architecture:**
- Replace Welcome.jsx content with a multi-step form (useState for step tracking)
- Step 2 calls the existing `POST /api/generate/preview` → saves via existing save flow
- No new backend work — reuses generation infrastructure
- Track completion: simple flag in preferences JSONB (`onboarding_completed: true`) to avoid showing again

**Why not a tooltip tour?** Tooltip tours (like Shepherd.js or Intro.js) are universally hated. They overlay the real UI, break when the UI changes, and users dismiss them immediately. A dedicated onboarding flow with actual content generation is 10x more effective because the user gets real value (their first deck) as part of the tour.

**Open question:** Should step 2 be a simplified generation form (just topic, no notes/photos) or the full Generate page? Recommendation: simplified — just a topic input with a "surprise me" random topic button. Reduces cognitive load for first-time users.

### 5. Analytics Integration

**Problem:** We have no data on how users interact with the app. We don't know: how many users complete onboarding, what percentage generate a second deck, which study mode is most popular, where users drop off in the purchase flow, or whether anyone actually uses the marketplace. Without this data, every product decision is a guess.

**Approach:**
- Integrate PostHog (open-source, generous free tier: 1M events/month)
- Track key events, not everything. Focus on the metrics that drive decisions.

**Events to track:**

**Activation funnel:**
- `signup_completed` (method: email/google/magic_link)
- `onboarding_step_completed` (step: 1/2/3)
- `first_deck_generated`
- `first_study_session_completed`

**Core engagement:**
- `deck_generated` (method: text/photo, card_count)
- `study_session_started` (mode: flip/mc/type/match)
- `study_session_completed` (mode, accuracy, duration)
- `streak_milestone` (days: 7/30/100)

**Marketplace funnel:**
- `marketplace_viewed`
- `listing_viewed`
- `purchase_started` (listing_id)
- `purchase_completed` (listing_id, price)

**Seller funnel:**
- `seller_onboarding_started`
- `seller_onboarding_completed`
- `listing_created`

**Revenue:**
- `subscription_started`
- `subscription_cancelled`

**Architecture:**
- Client: `posthog-js` initialized in main.jsx, identify on login, reset on logout
- Server: `posthog-node` for server-side events (purchases, subscriptions — things that happen in webhooks)
- User properties: plan, signup_date, deck_count, study_score, is_seller
- Feature flags: PostHog includes feature flag support — useful for future A/B testing

**Why PostHog over Mixpanel/Amplitude?**
- Open source, self-hostable if needed
- 1M events/month free (vs Mixpanel's 20K)
- Session replay included (watch users interact — invaluable for UX debugging)
- Feature flags built in (no separate LaunchDarkly)

**Privacy:**
- Respect existing notification preferences — if user opts out of tracking, disable PostHog for that user
- No PII in event properties (no email, no name — just user ID)
- Document in Privacy Policy (from pre-launch blockers brainstorm)

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Card editing scope | Edit + add + delete (no reorder) | Covers core needs; reorder is pointless with forced randomization |
| Purchased deck editing | Not allowed (duplicate first) | Preserves marketplace content integrity |
| Deck duplication | Available for all decks | Simple, non-destructive, enables editing of purchased content |
| Keyboard shortcuts | Flip mode priority | Most-used mode, highest impact per keystroke |
| Onboarding style | Dedicated flow, not tooltip tour | Tooltip tours are universally dismissed; generation-in-onboarding drives activation |
| Analytics tool | PostHog | Free tier 50x larger than alternatives, includes session replay |
| Tracking philosophy | Key events only | Track decisions, not clicks. 15 events, not 150. |

## Implementation Priority

Recommended build order:
1. **Card editing** — highest user demand, unblocks deck quality improvement
2. **Keyboard shortcuts** — quick win, improves daily power user experience
3. **Deck duplication** — small backend + frontend, complements card editing
4. **Analytics integration** — npm install + event calls, starts collecting data immediately
5. **Guided onboarding** — largest effort, but informed by analytics data on where users drop off

## Scope Boundaries

**In scope:** Five UX and retention features.

**Out of scope:**
- Spaced repetition / SM-2 algorithm (v2 — requires significant study flow redesign)
- Collaborative decks / real-time sync (v2)
- Deck sharing via link (v2)
- Dark mode (v2 — infrastructure ready but separate effort)
- Achievement system / gamification beyond streaks (v2)
- Re-study-missed-only mode (users can restart full session)
- Deck folders / tags / collections (search + sort is sufficient)
- A/B testing (PostHog supports it, but we need baseline data first)
