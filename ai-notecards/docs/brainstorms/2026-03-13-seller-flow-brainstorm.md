---
date: 2026-03-13
topic: seller-flow-and-marketplace-listing
---

# Seller Flow & Marketplace Listing

## What We're Building

A complete seller journey: explicit opt-in to become a seller (separate from Pro), liability/content terms acceptance, and a visible way to list decks from the Dashboard. Currently the ListDeck page exists at `/sell/:deckId` but is unreachable — no UI links to it.

Three connected features:
1. **Seller opt-in flow** — becoming a seller is a deliberate choice, not automatic for Pro users
2. **Seller liability/content agreement** — short, clear terms accepted before Stripe Connect onboarding
3. **Sell icon on Dashboard deck cards** — status-aware icon on each deck for listing to marketplace

## Key Decisions

### 1. Seller Opt-In: Dual Entry Points

- **During Pro checkout:** After successful payment, prompt: "Want to sell your decks on the marketplace?" with a note that they can skip and do this later under Settings
- **From Settings (later):** A "Become a Seller" section in Settings that kicks off the same onboarding flow
- **Trial users cannot sell** — already enforced (`plan='trial'` blocked from seller routes)

### 2. Seller Terms: Concise Modal/Step (Option C)

A short, friendly step shown before Stripe Connect onboarding. Bullet points:
- You are responsible for all content you list, including AI-generated content
- Review your full deck before listing — make sure it's accurate and complete
- Clean, well-organized notecards sell better and get higher ratings
- We reserve the right to remove listings that violate our content guidelines

Checkbox: "I understand and agree" → proceeds to Stripe Connect

Tone: practical and encouraging, not heavy legalese. Doubles as a quality nudge.

### 3. Dashboard Deck Card: Sell Icon (Top-Right Badge)

A small icon (price tag / storefront) in the top-right corner of each deck card. Does NOT go in the Study/View/Delete action row. The label next to the icon changes based on status:

| State | Icon Label | Behavior |
|-------|-----------|----------|
| Eligible to sell (generated, 10+ cards, not listed, user is seller) | "Sell" | Clickable → navigates to `/sell/:deckId` |
| Ineligible (purchased, <10 cards, or user not a seller) | Icon only, greyed out | Not clickable |
| Already listed | "View" | Clickable → navigates to marketplace listing |

### 4. Onboarding Flow Order

1. User completes Pro checkout
2. Post-checkout prompt: "Become a seller?" (with skip note)
3. If yes → Seller terms modal (checkbox accept)
4. Terms accepted → Stripe Connect Express onboarding
5. Return from Stripe → seller is active, sell icons appear on eligible decks

## Open Questions

- Should the post-checkout seller prompt reappear as a one-time Dashboard banner if skipped? (saved as future idea)
- Tooltip content for greyed-out icons — explain *why* ineligible? (saved as future idea)
- Earnings badge on listed decks in Dashboard? (saved as future idea)

## Next Steps

-> `/workflows:plan` for implementation details
