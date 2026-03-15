v1 features:
-- still needs to be addressed?

- 030 — Helmet security headers (separate infra concern)
- 041 — auth-magic.js deleted_at filter (pre-existing bug, not part of this plan)
-

---

Brand New Ideas Not in the PRD

1. Forgot Password / Password Reset
   Not in prd.json at all. Not in v1, not in v2, not mentioned. Critical auth flow.
1. Legal Pages (ToS + Privacy Policy)
   Not mentioned anywhere. Required for Stripe, app store listing, and legal compliance.
1. 404 / Error Boundary
   Not mentioned. Every web app needs this.
1. Stripe Billing Portal
   Not mentioned. One endpoint + one button. Standard for any subscription app.
1. Social Sharing / Open Graph Meta
   Not mentioned. Marketplace listings should be shareable with rich previews. Sellers would share their listings to drive traffic.
1. Favicon + PWA Manifest
   No favicon. No manifest.json. Can't be added to home screen as a PWA. Small but professional.
1. Rate Limit UX
   When users hit rate limits, they get JSON errors. No user-friendly messaging on the frontend explaining "you've hit your limit, try again in X minutes" or "upgrade to Pro for more."
1. Marketplace Listing Share Button
   Sellers have no way to share their listing URL. A copy-link button on MarketplaceDeck would let sellers promote their own listings externally.
1. Deck Duplicate
   Users can't copy/duplicate a deck. If they want to study a subset or create a variation, they have to regenerate from scratch. Simple feature, high utility.
1. Keyboard Shortcuts in Study Mode
   Multiple choice has keyboard support (1-4 keys), but flip mode has no keyboard shortcuts for correct/incorrect/flip. Power users studying hundreds of cards need this.

---

Summary: What to Prioritize

Before any real users:

1. Forgot password flow
2. 404 page + error boundary
3. Legal pages (ToS + Privacy Policy)
4. Meta tags + favicon
5. Sentry error monitoring

Before marketing / growth push:

1. Transactional emails (move from v2)
2. Card editing after save (move from v2)
3. Stripe billing portal
4. Analytics integration
5. Better onboarding flow

The core product (generation, study, marketplace, payments) is solid. The gaps are mostly around the edges that real users will hit — password recovery, legal compliance, billing self-service, and polish. None of these are architecturally hard;
they're just the "last 10%" that makes the difference between a project and a product.

---

A few ideas that might be worth considering:

Seller experience:

- Earnings badge on listed decks — next to "view" on already-listed decks, show a small earnings amount like "$4.50 earned" so sellers get that dopamine hit right from their deck library
- "Quick relist" — if a seller delisted a deck, the icon could say "relist" instead of "sell" since the listing data already exists, skipping the form

Seller onboarding:

- Tooltip on greyed-out icons — when a non-seller hovers/taps a greyed-out sell icon, show a tooltip: "Become a seller to list this deck" linking to Settings. Turns the disabled state into a conversion opportunity rather than a dead end
- Minimum card count nudge — if a deck has <10 cards and the icon is greyed out, the tooltip could say "Add at least 10 cards to sell this deck" — tells them why it's disabled and what to do about it

Quality & trust:

- Seller rating displayed on their profile — aggregate average across all their listings, visible on their seller dashboard. Motivates quality
- "Seller since" date — small trust signal on marketplace listings, rewards early sellers

Post-checkout seller prompt:

- Skip vs. "Remind me later" — instead of just a dismiss, offer to surface the seller prompt again next time they visit Dashboard (a one-time banner). Less aggressive than nothing, less annoying than recurring

---

ai model control
which model will i use as number 1. groq or gemini free.
either way i will need a system that can create a ton of theseapi keys if i need them.

---

on topic of content control, parental controls,
when the ai makes the flashcards, allow or dont allow editing?

---

Model 5: The "Study Score" Economy

Every user accumulates a Study Score based on actual usage — cards studied, sessions completed, accuracy streaks. Your Study
Score is public on your seller profile.

You can only sell decks once your Study Score hits a threshold.

This is powerful because it proves you're a real student, not someone gaming the system. A seller with a high Study Score  
signals "this person actually uses flashcards seriously, their decks are probably good." It's a trust signal and quality  
filter in one.

Viral angle: Study Score becomes a status symbol. People share it. "I hit 500 on AI Notecards." It gamifies the core  
product, not just the marketplace.

## v2 features:

Model 7: Cohort Drops — Scarcity-driven launches

Instead of an always-open marketplace, decks launch in weekly or biweekly "drops." Sellers submit decks, the best ones get
featured in that week's drop, buyers get notified.

Think of it like Product Hunt for flashcard decks. Limited window creates urgency to buy and prestige to be featured.

Viral angle: "This week's top decks" is inherently shareable content. You email it, post it, people come back weekly.  
Sellers compete for the featured spot.

Risk: Too much friction if your user base is small. This works better at scale. Could be a v2 feature.
