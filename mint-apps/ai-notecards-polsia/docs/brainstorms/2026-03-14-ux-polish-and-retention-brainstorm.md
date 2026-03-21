---
date: 2026-03-14
topic: ux-polish-and-retention
---

# UX Polish & Retention

## What We're Building

Three features that make users stay, come back, and get more value from the product: deck duplication, a guided onboarding flow, and analytics integration. These aren't launch blockers — they're the difference between users who try the app once and users who build it into their study routine.

Card editing and keyboard shortcuts were part of the original brainstorm but have been implemented. Card editing (add/edit/delete) works in DeckView. Keyboard shortcuts (Space to flip, arrow keys to rate) work in flip mode study sessions.

## Why This Approach

The core product works: generate cards, study them, buy/sell on the marketplace. But the experience has friction points that compound over time. A user who lands on an empty dashboard after signup doesn't know what to do. Without data, we're guessing which problems are worst. We need to measure before we can improve.

## Feature Details

### 1. Deck Duplication

**Problem:** Users can't copy a deck. Use cases: (1) create a subset for a specific exam, (2) make a variation with harder questions, (3) get a mutable copy of a purchased deck so they can edit it, (4) share a copy with a study partner (manually). The only option is to regenerate from scratch, losing the existing content.

**Approach:**
- Add "Duplicate" button on DeckView page (next to Delete)
- Creates a new deck with title "[Original Title] (copy)" and copies all cards
- New endpoint: `POST /api/decks/:id/duplicate`
- **Duplicated decks get `origin = 'duplicated'`** — this is NOT the same as `'generated'`. The backend must distinguish duplicated decks from truly generated ones because selling is gated to `origin = 'generated'` only
- Deck count limits still apply (free tier max 10 generated decks — duplicated decks count toward this limit)
- Purchased decks CAN be duplicated — the duplicate becomes a `'duplicated'` deck that the user owns and can edit

**Why a separate origin matters:**
- Selling requires `origin = 'generated'` — a duplicated deck (whether from your own deck or a purchased one) cannot be listed on the marketplace
- This prevents someone from buying a deck, duplicating it, and reselling someone else's content
- It also prevents a seller from duplicating their own deck and listing both copies — each listing must come from a genuinely generated deck
- On a seller's dashboard, duplicated decks show the disabled sell icon with a tooltip: "Duplicated decks can't be sold. Only decks you generate from scratch are eligible for the marketplace."

**Architecture:**
- Single transaction: INSERT deck (with `origin = 'duplicated'`) + INSERT cards SELECT from source
- Store `duplicated_from_deck_id` on the new deck (nullable FK) for provenance tracking
- Check deck ownership (user_id matches)
- Check deck limits for free tier users
- Return the new deck object with redirect to `/decks/:newId`
- Migration: add `'duplicated'` to any origin check constraints, add `duplicated_from_deck_id` column

**Design:** Small duplicate icon (two overlapping squares) next to the delete button. Confirmation not needed — it's a non-destructive operation.

**Purchased deck editing — open question:**

From first principles: if a user buys notecards, they should be theirs to do with as they please. Restricting editing on something someone paid for feels wrong. But there's a practical concern — if we let users edit purchased decks directly and they break the content, there's no way to reset to the original.

Options:
1. **Allow editing on purchased decks directly.** Simple, respects ownership. Risk: user edits a purchased deck, ruins it, can't get original back. Could mitigate by showing a warning: "This deck was purchased. Edits can't be undone — consider duplicating first."
2. **Block editing on purchased decks, explain why, offer duplication.** When a user tries to edit a purchased card, show a message: "Purchased decks are read-only to preserve the original content. Duplicate this deck to create an editable copy." With a one-click "Duplicate & Edit" action.
3. **Allow editing but keep a hidden "original" snapshot.** Most complex. Adds a "Reset to original" button. Significant backend work for a rare use case.

**Decision: Option 2 — block editing on purchased decks, explain why, offer duplication.** When a user tries to edit a purchased card, show a message: "Purchased decks are read-only to preserve the original content. Duplicate this deck to create an editable copy." With a one-click "Duplicate & Edit" action. This is the simplest approach, preserves originals, and the duplication flow makes it painless.

### 2. Guided Onboarding Flow

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

### 3. Analytics Integration

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
- `deck_duplicated` (source_origin: generated/purchased)
- `study_session_started` (mode: flip/mc/type/match)
- `study_session_completed` (mode, accuracy, duration)
- `streak_milestone` (days: 7/30/100)

**Marketplace funnel:**
- `marketplace_viewed`
- `listing_viewed`
- `purchase_started` (listing_id)
- `purchase_completed` (listing_id, price)

**Seller funnel:**
- `seller_terms_accepted`
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
| Deck duplication origin | `'duplicated'` (not `'generated'`) | Duplicated decks must not be sellable — only truly generated decks can be listed |
| Purchased deck editing | Not allowed (duplicate first) | Preserves original content; "Duplicate & Edit" one-click action makes it painless |
| Deck duplication | Available for all decks (owned + purchased) | Simple, non-destructive, enables editing of purchased content via copy |
| Duplicated deck sell button | Disabled with explanation | Show why the deck can't be sold: "Only decks you generate from scratch are eligible" |
| Onboarding style | Dedicated flow, not tooltip tour | Tooltip tours are universally dismissed; generation-in-onboarding drives activation |
| Analytics tool | PostHog | Free tier 50x larger than alternatives, includes session replay |
| Tracking philosophy | Key events only | Track decisions, not clicks. ~18 events, not 150. |

## Implementation Priority

Recommended build order:
1. **Deck duplication** — small backend + frontend, enables editing of purchased content, quick win
2. **Analytics integration** — npm install + event calls, starts collecting data immediately
3. **Guided onboarding** — largest effort, but informed by analytics data on where users drop off

## Scope Boundaries

**In scope:** Three UX and retention features.

**Already complete (from original brainstorm):**
- Card editing after save (edit/add/delete in DeckView)
- Keyboard shortcuts in study mode (flip mode: Space, arrows)

**Out of scope:**
- Spaced repetition / SM-2 algorithm (v2 — requires significant study flow redesign)
- Collaborative decks / real-time sync (v2)
- Deck sharing via link (v2)
- Dark mode (v2 — infrastructure ready but separate effort)
- Achievement system / gamification beyond streaks (v2)
- Re-study-missed-only mode (users can restart full session)
- Deck folders / tags / collections (search + sort is sufficient)
- A/B testing (PostHog supports it, but we need baseline data first)
