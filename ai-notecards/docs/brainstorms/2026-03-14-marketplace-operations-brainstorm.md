---
date: 2026-03-14
topic: marketplace-operations
---

# Marketplace Operations

## What We're Building

Five features that make the two-sided marketplace actually function as a business: transactional emails, automated content moderation, listing share buttons, Stripe billing portal, and user-friendly rate limit messaging. The marketplace mechanics work (payments, fulfillment, ratings), but the operational layer is missing — sellers don't know when they make a sale, buyers can't share what they bought, and offensive content has no pre-publish filter.

## Why This Approach

A marketplace that processes real money needs operational infrastructure beyond just "buy and sell." Right now the marketplace is technically functional but operationally blind. Consider the seller experience: they list a deck, someone buys it, and... nothing. No email, no notification, no ping. The seller has to manually check their dashboard to discover they earned money. That's not a product — that's a database with a UI.

These five features target the operational gaps that would make real sellers and buyers frustrated within their first week.

## Feature Details

### 1. Transactional Emails

**Problem:** Zero email communication for marketplace activity. Sellers don't know when they make a sale. Buyers don't get purchase confirmations. Subscription changes happen silently. Resend is already integrated for magic links but unused for everything else.

**Emails to implement (ordered by impact):**

**Must-have (launch):**
- **Sale notification (seller):** "You sold [Deck Title] for $X.XX! Your earnings: $Y.YY. View your dashboard →"
- **Purchase confirmation (buyer):** "You purchased [Deck Title]. Start studying →"
- **Subscription confirmed:** "Welcome to Pro! Here's what you can do now →"
- **Subscription cancelled:** "Your Pro plan will end on [date]. Your listings will be delisted. Resubscribe →"

**Nice-to-have (post-launch):**
- **New rating received (seller):** "Someone rated [Deck Title] ★★★★★" (daily digest, not per-rating)
- **Listing delisted by admin:** "Your listing [Title] was removed for [reason]"
- **Account suspension notice:** "Your account has been suspended for [reason]"

**Architecture:**
- Create `server/src/services/emails/` directory with template functions
- Each email is a function that takes data and returns HTML (inline styles for email compatibility)
- Templates use the warm parchment palette — branded, not generic
- Trigger points: webhook handlers (purchase, subscription), admin actions (delist, suspend)
- Resend API already in `services/email.js` — extend it with new templates
- All emails include unsubscribe link (required by CAN-SPAM) — ties into existing notification preferences

**Open question:** Should emails be plain text, HTML, or both? HTML for branding, but always include a plain text fallback. Resend supports both.

### 2. Automated Content Moderation

**Problem:** Manual admin queue exists but has two gaps: (1) listings go live immediately — offensive content is public before anyone reviews it, and (2) admin has to manually check the queue with no notification that new flags exist. At scale, this is unsustainable.

**Approach — two layers:**

**Layer 1: Pre-publish AI screening (v1 scope)**
- When a seller creates a listing, run the title + description + card content through a lightweight AI classifier
- Check for: explicit/sexual content, hate speech, violence, spam/gibberish, copyright red flags
- If flagged: listing goes into "pending review" status instead of "active"
- Seller sees: "Your listing is being reviewed and will be published shortly"
- Admin gets notified (email or dashboard badge)
- If clean: listing goes active immediately (no delay for good content)

**Layer 2: Post-publish community flagging (already exists)**
- Users can flag listings (Inappropriate/Misleading/Spam/Low Quality/Other)
- Admin resolves flags (dismiss/uphold/suspend)

**AI screening architecture:**
- Use OpenRouter (`OPENROUTER_API_KEY` already in `.env`) with a cheap, fast model (e.g., `meta-llama/llama-3.1-8b-instruct`) — keeps moderation decoupled from the Groq/Gemini generation pipeline so a rate limit spike on generation doesn't starve moderation
- Simple prompt: "Does this educational flashcard content contain any of the following: [list]. Respond with PASS or FAIL and a one-line reason."
- OpenRouter exposes an OpenAI-compatible API, so the integration mirrors the existing Groq SDK pattern
- Run asynchronously — don't block the listing creation response. Return "pending" status immediately.
- Store moderation result on the listing (new column: `moderation_status`, `moderation_reason`)
- Auto-approve after 60 seconds if AI screening doesn't respond (fail-open with logging)
- New env var `OPENROUTER_API_KEY` needs to be added to `.env.example`

**Open question:** Fail-open or fail-closed? Fail-open (auto-approve on timeout) avoids blocking legitimate sellers if the AI service is down. Fail-closed (stay pending) is safer for content quality. Recommendation: fail-open for v1 with logging, switch to fail-closed when we have confidence in the system.

### 3. Marketplace Listing Share Button

**Problem:** Sellers have no way to promote their listings externally. A seller who creates a great deck can't easily share it on Twitter, Reddit, or in a study group. The marketplace URL works but there's no copy-link button, no share UI, no incentive to share.

**Approach:**
- Add a "Share" button on the MarketplaceDeck page (next to Buy/Flag buttons)
- Click opens a share popover with:
  - **Copy link** — copies marketplace URL to clipboard with toast confirmation
  - **Twitter/X** — pre-filled tweet: "Check out [Deck Title] on AI Notecards — [card count] flashcards for $[price] [url]"
  - **Reddit** — pre-filled title + URL for relevant subreddits
- Also add a share button on the SellerDashboard listing cards (sellers sharing their own listings)
- Consider a "Share" button in the post-purchase confirmation: "Share this deck with friends"

**Why this matters:** Organic sharing is the cheapest growth channel. Every seller who shares a listing brings potential buyers. This is especially powerful for niche academic topics where students share resources in group chats and subreddits.

**Open Graph meta tags:**
- Add dynamic OG tags to the `MarketplaceDeck` page so shared links render rich previews on Twitter/Reddit/Discord/iMessage
- Tags: `og:title` (deck title), `og:description` (listing description, truncated), `og:url` (canonical listing URL), `og:type` ("product"), `og:image` (placeholder branded card or category icon for v1)
- Twitter-specific: `twitter:card` ("summary"), `twitter:title`, `twitter:description`
- Use `react-helmet` (or `react-helmet-async`) to inject `<meta>` tags per listing — the data is already fetched on the page
- Without these, shared links show a bare URL with no preview — kills click-through on every platform

**Design:** Small share icon (arrow-up-from-square). Popover, not modal. Matches existing button styles.

### 4. Stripe Billing Portal

**Problem:** Pro subscribers can cancel but can't view invoices, update their payment method, or see billing history. If a card expires, they can't update it without cancelling and resubscribing. Stripe provides a hosted billing portal that handles all of this — we just need to create a session and redirect.

**Approach:**
- New endpoint: `POST /api/stripe/portal` — creates a Stripe Billing Portal session and returns the URL
- Settings page: Add "Manage Billing" button in the Subscription section (only for Pro users)
- Portal handles: invoice history, payment method update, subscription management, cancellation
- Return URL: `/settings` (user comes back to our app after portal actions)
- Configure the portal in Stripe Dashboard to match our branding (logo, colors)

**Architecture:**
```
// One endpoint, ~10 lines of code
const session = await stripe.billingPortal.sessions.create({
  customer: user.stripe_customer_id,
  return_url: `${CLIENT_URL}/settings`
});
res.json({ url: session.url });
```

**Why not build our own billing UI?** Stripe Portal is free, PCI-compliant, handles edge cases (failed payments, card updates, proration), and updates automatically when Stripe adds features. Building our own is weeks of work for a worse result.

### 5. Rate Limit UX

**Problem:** Rate limiting exists but the UX is incomplete. The plan middleware (`plan.js`) returns 429 with `{ error: "...", limit: true }` — a flat error string and a boolean flag. The frontend (`Generate.jsx`) detects the `limit` flag and shows the backend message via `toast.error()`, so users do see *something*. But there's no countdown, no `retry_after` value, no remaining-generations display, and the error format isn't structured enough for the frontend to build good UI around it.

**What already works:**
- `plan.js` checks `daily_generation_count` per plan and returns 429 with tier-aware message ("Upgrade to Pro" for free users, "Limit resets tomorrow" for Pro)
- `Generate.jsx` checks `err.data?.limit` and shows the error message in a toast
- After a successful generation, the backend returns `generationsRemaining` in the response

**What needs improvement:**
- Backend: Standardize all rate limit responses to use a structured format with `retry_after`:
  ```json
  {
    "error": "rate_limit",
    "message": "Daily generation limit reached (1/day). Upgrade to Pro for more generations.",
    "limit": true,
    "retry_after": 43200
  }
  ```
- Backend: Add `retry_after` calculation — for daily limits, seconds until midnight; for express-rate-limit windows, seconds until window resets
- Frontend: Show a countdown timer on the Generate page when rate-limited ("You can generate again in 7:32") instead of just a toast
- Frontend: Show remaining generations *before* hitting the limit: "3 of 10 generations used today" — the backend already tracks `daily_generation_count`, expose it in `GET /api/auth/me` response so the Generate page can display it on load
- Tier-aware upgrade nudge: Free users see "Upgrade to Pro for 10 generations per day" inline on the Generate page (not just in the error toast)

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Email format | HTML + plain text fallback | Branded experience with accessibility fallback |
| Content moderation | AI pre-screen + community flags | Catches obvious violations before publish; community catches nuance |
| Moderation AI provider | OpenRouter (separate from Groq/Gemini) | Decouples moderation from generation pipeline; avoids shared rate limits |
| Moderation failure mode | Fail-open for v1 | Don't block legitimate sellers if AI is down; log and review |
| Share targets | Copy link + Twitter + Reddit + OG tags | Primary channels for student content sharing; OG tags make shared links render rich previews |
| Billing portal | Stripe hosted | Free, PCI-compliant, handles edge cases we'd miss |
| Rate limit UX | Structured error + countdown + remaining display | Extends existing `limit` flag with `retry_after`; shows usage before hitting limit |

## Implementation Priority

Recommended build order:
1. **Stripe billing portal** — one endpoint, one button, 30 minutes of work
2. **Rate limit UX** — backend error format + frontend toast updates
3. **Listing share button + OG tags** — share popover + clipboard API + react-helmet for OG meta tags
4. **Transactional emails** — templates + trigger points in webhook handlers
5. **Automated content moderation** — AI screening + new listing status + migration

## Scope Boundaries

**In scope:** Five marketplace operational features.

**Out of scope:**
- Push notifications / in-app notification center (v2)
- Seller analytics dashboard with charts (v2)
- Refund system (Stripe handles disputes; no self-serve refunds for v1)
- Full marketplace SEO beyond OG tags (sitemaps, structured data, server-side rendering)
- Rating digest emails (post-launch nice-to-have, not launch blocker)
- Seller payout schedule visibility (Stripe Connect dashboard handles this)
