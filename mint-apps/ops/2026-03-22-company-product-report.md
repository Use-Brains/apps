Now let me check the completed task details to understand what research has been produced.

Now let me search for additional context on the handoff state and any competitive/launch details.

I now have comprehensive data. Here's the full report.

Mint Apps — State of the Company & Product Report
Date: March 22, 2026 | Prepared for: Kashane (Founder) | Classification: Internal / Operator-Level

1. Executive Overview
   Mint Apps is a solo-founder company 2 days old on Polsia (created March 20, 2026), building AI Notecards as its first product — an AI-powered flashcard app with a user-generated marketplace layer. The company's longer-term aspiration is to become an "app factory" that launches a portfolio of profitable iOS subscription apps using a repeatable 7-phase playbook.

Where things actually stand: AI Notecards has substantial prior engineering work across web, backend, mobile, auth, payments, and marketplace — estimated at 79 features, 63 API endpoints, 16 database tables, and 18 migrations before the current rebuild. The product was originally built on Vercel/Railway/Supabase with Stripe payments and Stripe Connect marketplace payouts. It is now being refactored and ported onto Polsia's infrastructure (Express/Postgres/React on Render/Neon) with a deliberate scope reduction: the seller-side marketplace, Stripe Connect, and native billing flows have been deferred to v1.1+, while the web core is being cleaned up for a handoff build.

The handoff prep pass (Phase 4 of the playbook) is essentially complete: squashed schema validated, idempotent seed script validated, unified Express runtime verified, placeholder surfaces for deferred features confirmed working, clean boot tested. The founder is about to enter packaging/path-move prep — the structural refactoring that gets the codebase physically into the Polsia repo for engineering agents to build on.

Three research reports have been completed (competitive teardown, marketplace feasibility, ASO keyword strategy). Four tasks remain queued (App Store listing copy, community mapping, teacher recruitment channels, iOS launch pre-flight checklist).

Net assessment: The product has real depth, the strategic thinking is strong, the handoff process is unusually disciplined for a solo founder — but the project is in a migration/refactoring tunnel right now, not yet producing user-facing traction. No users, no revenue, no App Store submission yet. The distance between "handoff-ready codebase" and "profitable app" is still significant.

2. What AI Notecards Is Today
   The Product
   AI Notecards is a flashcard creation and study app. Users paste text, type a topic, or photograph physical notes. AI (Groq/Gemini) generates structured flashcards from this input. Users then study those cards through four modes (flip, multiple choice, type-the-answer, match). A marketplace lets users browse and buy curated decks from other creators.

Who It's For
Students (high school through professional certification), self-learners, and anyone who uses flashcards as a study method. The sweet spot is students who want flashcard quality without the manual creation burden and who will pay for curated content from others.

The Value Proposition
"Generate flashcards instantly from any source material, study with multiple modes, and browse a marketplace of curated decks — all in one app."

How It Differentiates
The pitch against competitors is threefold:

AI generation from text AND photos — most competitors do text only or photo poorly
Marketplace — Quizlet's shared decks are free/low-quality; AI Notecards aims for a curated paid marketplace more like Teachers Pay Teachers
Native iOS experience — Anki is powerful but ugly; Knowt is web-first; the claim is a better native iOS product with offline, haptics, biometrics
Is the Differentiation Strong Enough?
Partially. The AI generation is table-stakes — Quizlet, Knowt, Brainscape, RemNote, and multiple free tools all have AI flashcard generation now. Photo-to-flashcard is a genuine differentiator that few competitors do well. The marketplace is the real strategic moat, but it doesn't exist yet in a functional sense — the seller side is deferred and the buyer purchase flow returns placeholder responses. The marketplace is a future differentiator, not a current one.

Without the marketplace, AI Notecards at launch is: a clean AI flashcard generator with good study modes and a warm aesthetic. That's a viable product but not a defensible one. The speed at which the marketplace becomes real determines whether this product has a lasting position.

3. What Has Already Been Done
   This is a comprehensive reconstruction across every domain, based on all available evidence.

Product / Design
Full product concept, PRD (v1.1.0), and feature inventory (79 features documented)
Warm parchment design system (#FAF7F2 bg, #1B6B5A accent, #C8A84E gold)
Mobile-first responsive design with Tailwind CSS
Dark toast notification system, CSS 3D flip animations, avatar circles
4 study modes with distinct interaction patterns
Generation preview flow (edit before save, regenerate option)
Study streak system (current/longest, daily goal, streak-at-risk banner)
Engineering — Web Frontend
React 19 + Vite 6 + Tailwind CSS 3
Full page suite: Dashboard, Deck view, Study sessions, Marketplace browse/detail, Pricing, Settings, Admin
Client-side placeholder handling for deferred features (Pricing, Settings, Admin, MarketplaceDeck purchase state)
Originally deployed on Vercel; now unified into Express-serves-client for Polsia deployment
Engineering — Backend
Node.js ES modules + Express 4
63 API endpoints across auth, deck CRUD, generation, study, marketplace, seller, admin, billing
AI pipeline: Groq (llama-3.3-70b) primary → Gemini fallback, Gemini vision for photos (up to 5 images)
JWT auth with httpOnly cookies, bcrypt password hashing
Magic link auth via Resend email
Google Sign-In and Apple Sign-In (iOS)
Refresh token system for mobile sessions
Rate limiting (daily generation count per tier)
Full-text search on marketplace listings (tsvector + GIN index)
Content flagging and moderation queue
Engineering — Database
PostgreSQL (originally Supabase, now Neon on Polsia)
16 tables with well-designed schema including proper constraints, partial indexes, and composite indexes
Schema squashed to single migration (001_initial.sql) — approved, validated against fresh DB
Idempotent seed script validated with 12 synthetic users, 13 categories, 16 curated decks/listings, 40 ratings, 48 tags, 4 content flags
Deferred columns/tables properly annotated (Stripe, Apple, RevenueCat, seller terms, device tokens, refresh tokens)
Key schema improvements already made: payment_reference_id (renamed from stripe_payment_intent_id), seller_payout_cents added, price ceiling documented
Engineering — iOS/Mobile
Expo SDK 55 + React Native 0.83 with Expo Router
TanStack Query + MMKV for state/cache
Offline deck downloads via Expo SQLite
Offline study with sync (client_session_id deduplication)
Apple Sign-In with SecureStore refresh tokens
RevenueCat subscription management with server reconciliation
Universal links (AASA hosted by server)
Push notifications (Expo push tokens)
Biometric re-entry (Face ID/Touch ID)
Haptics, share sheets, offline banners
Status: Lives in founder's private repo (Use-Brains/apps), NOT on Polsia infrastructure. Polsia cannot modify.
Payments / Monetization (Original)
Stripe Checkout for web subscriptions
Stripe Connect Express for marketplace seller payouts (50/50 split)
RevenueCat for iOS subscriptions
Three tiers: Free (1 gen/day, 10 decks), Trial (7 days, 10 gen/day), Pro ($9/mo, unlimited, marketplace sell)
Marketplace pricing: $1-$5 per deck
Payments / Monetization (Current Polsia Handoff)
All Stripe code removed from Express registration
/api/stripe/\* returns placeholder responses
Purchase endpoints return placeholder responses
Schema retains purchases table with generic payment_reference_id (ready for Polsia payments wiring)
Seller dashboard, payout logic, Connect onboarding — all deferred to v1.1+
No live payment flow exists in the current build
Marketplace
13 browse categories seeded
Full-text search (tsvector + GIN)
Listing detail pages with ratings display
Cursor pagination
Content flagging and moderation schema
Listing tags system (48 seeded)
Star ratings (1-5 with optional 200-char reviews, requires purchase + study session to leave)
Buyer purchase: placeholder only
Seller: entirely deferred (shell/coming-soon responses)
Marketplace cold-start plan documented: recruit 30-50 teacher partners, seed 50-100 decks pre-launch
Trust / Safety / Legal
Content flagging system (schema + moderation queue)
Admin moderation routes (shell state in handoff)
Soft-delete account handling (deleted_at column)
Email verification flow
Rate limiting on magic link attempts
Account suspension mechanism (suspended, suspended_reason)
Missing: No Terms of Service drafted. No Privacy Policy drafted. No Seller Agreement drafted. DMCA agent registration not done. These were flagged in earlier planning docs as launch blockers.
Research / Strategy (Completed on Polsia)
Competitive teardown of Quizlet, Knowt, Flashka, RemNote, Nota, Anki — pricing, paywalls, review sentiment, ASO, gaps identified
Marketplace feasibility report — Apple guidelines, legal requirements, revenue split recommendations (70/15/15), cold-start strategy, COPPA considerations
ASO keyword strategy — App Name/Subtitle recommendations, 100-char keyword field, competitor keyword gaps, long-tail opportunities
Market research — iOS economics, category revenues, retention benchmarks, pricing benchmarks, underserved niches
Research / Strategy (Queued, Not Yet Done)
App Store listing copy (title, subtitle, description, keywords, screenshot captions) — todo
Student community mapping (launch channels) — todo
Teacher/educator recruitment for marketplace cold start — todo
iOS launch pre-flight checklist synthesis — todo
Ops / Infrastructure
Polsia infrastructure: Render web service (live, 200 OK), Neon Postgres (active), GitHub repo (Polsia-Inc/mintapps)
Domain: ai-notecards.com (purchased, not yet pointed at Polsia build)
.env.example and README updated for handoff boot path
POLSIA_PORTING_NOTES.md and POLSIA_ROUTE_MATRIX.md maintained
Clean boot verified: health check, client serving, placeholder endpoints all confirmed
No analytics/monitoring in the Polsia build (Sentry was in original mobile stack only)
No recurring tasks or automated monitoring set up yet 4. Current Maturity / Launch Stage
Assessment: Late MVP, entering pre-launch prep. Not yet launch-ready.

Here's why:

Signal Status
Core feature (AI generation + study) ✅ Built
Auth flows ✅ Built (multiple methods)
Database + schema ✅ Validated and clean
Marketplace browse ✅ Built
Marketplace purchase ❌ Placeholder only
Seller flows ❌ Deferred
Payments (any kind) ❌ None functional
iOS app submitted ❌ Not yet
App Store listing ❌ Copy not yet drafted
Legal pages ❌ Not drafted
Landing page ❓ ai-notecards.com exists but audit task was rejected
User analytics ❌ Not in Polsia build
Any real users ❌ None
Any revenue ❌ None
The product is not a prototype — there's too much real engineering for that label. But it's also not soft-launch ready because there's no working payment flow, no legal pages, no submitted iOS app, and no App Store listing copy finalized. The codebase is mid-migration between infrastructure stacks.

I'd classify this as: "MVP feature-complete in original stack, currently being ported and scoped down for launch. Pre-launch prep is ~40% done."

5. Major Product Flows Inventory
   Flow Status Notes
   Landing page → signup Partially implemented ai-notecards.com exists (original stack); Polsia build has no dedicated landing page yet
   Onboarding / welcome Unclear No evidence of a structured first-run experience
   Login (email/password) Appears implemented bcrypt + JWT
   Login (Google) Appears implemented Web Google Sign-In
   Login (Apple) Appears implemented iOS only, via SecureStore
   Login (Magic Link) Appears implemented Resend email, rate-limited
   Auth recovery / password reset Unclear / likely weak Was flagged as a launch blocker in earlier docs; no evidence it was resolved
   AI generation from text Appears implemented Groq primary, Gemini fallback
   AI generation from photos Appears implemented Gemini vision, up to 5 photos
   Preview / edit / save deck Appears implemented Edit before save, regenerate option
   Deck browsing / management Appears implemented Search, sort, duplication, archiving
   Study: Flip Appears implemented CSS 3D animation
   Study: Multiple choice Appears implemented
   Study: Type-the-answer Appears implemented Levenshtein 85% threshold
   Study: Match Appears implemented Memory grid
   Session recap / stats Appears implemented Accuracy, missed cards, best accuracy
   Streaks Appears implemented Current/longest, daily goal, streak-at-risk
   Trial / Free / Pro limits Appears implemented Rate limiting, tier gating
   Subscription checkout (web) Not functional Stripe removed, Polsia payments not wired
   Subscription checkout (iOS) Unclear RevenueCat integration exists in original code; not in Polsia build
   Seller onboarding Placeholder only Shell responses
   Create listing Placeholder only Shell responses
   Marketplace browse Appears implemented Full-text search, categories, cursor pagination
   Marketplace detail Appears implemented Rating display, listing info
   Purchase flow Placeholder only Returns placeholder response
   Post-purchase study Not functional No purchases can occur
   Rating/review submission Display only Seeded ratings display; submit disabled
   Profile / settings Partially implemented Billing portal placeholder
   Account deletion Appears implemented Soft-delete with deleted_at
   Admin / moderation Placeholder only Shell state
   iOS offline deck access Appears implemented In original mobile codebase
   iOS offline study + sync Appears implemented client_session_id dedup
   Push notifications Schema exists Implementation uncertain in current state
   Deep links / sharing Schema exists AASA documented, unclear if functional
   Email verification Appears implemented email_verified column exists
   SEO / meta tags Unclear Flagged as a gap in earlier planning docs
6. What Is Already Strong
7. Schema and data architecture are genuinely well-designed. The 16-table schema has proper constraints, partial indexes for performance, composite indexes for common access patterns, GIN full-text search, and coherence checks between listing status and moderation status. The deferred-feature annotation system is smart — any engineer picking this up can immediately see what's active vs. parked. The squash + seed validation pass against a fresh database is real engineering discipline, not theater.

8. The founder's technical decision-making is high-quality. Decisions like: rename stripe_payment_intent_id → payment_reference_id before launch (avoid baking in a vendor assumption), add seller_payout_cents to make the three-leg fee model explicit, keep the price ceiling constraint documented, and maintain a formal disable-vs-delete matrix — these are decisions a principal engineer makes, not a first-time builder.

9. The scope reduction is the right call. Cutting Stripe Connect, seller onboarding, payouts, and the full marketplace transaction flow from v1 is correct. Shipping a curated-browse marketplace with AI generation is a viable v1. Trying to ship a two-sided marketplace on day one as a solo founder would be a recipe for perpetual pre-launch.

10. Research quality is high and sequenced correctly. The competitive teardown → marketplace feasibility → ASO keyword strategy chain is the right order. The marketplace feasibility report correctly identified the cold-start problem and recommended recruiting 30-50 teacher partners before opening to all sellers. The ASO strategy identified that "marketplace" and "creator payouts" are unowned positioning angles.

11. The playbook framework is a real asset. The 7-phase playbook (Niche Discovery → Validation → Build MVP → Pre-Launch ASO → Launch → Growth → Scale/Portfolio) is well-reasoned and the project is actually following it. This is evidence the founder is thinking in systems, not just shipping features.

12. What Is Unfinished, Weak, Risky, or Potentially Misleading
    7A. Genuinely Incomplete Areas
    No working payment flow. This is the single biggest gap. The web subscription checkout is dead (Stripe removed). The marketplace purchase is a placeholder. RevenueCat exists in the original iOS code but the iOS app isn't submitted. There is currently no way for any user to pay for anything. Until payments work, the product generates zero revenue.

No legal pages. Terms of Service, Privacy Policy, and Seller Agreement are not drafted. These are App Store submission requirements and marketplace legal prerequisites. They were previously identified as launch blockers and remain unresolved.

No onboarding flow. There's no evidence of a structured first-run experience. The playbook's own research says "80% of trial starts happen day 1" and "paywall in onboarding" — yet there's no documented onboarding sequence to drive that conversion.

No analytics in the Polsia build. Sentry existed in the mobile stack but there's nothing in the current web build for tracking user behavior, conversion funnels, or crash reporting. You can't optimize what you can't measure.

Password reset appears unfinished. It was flagged as a launch blocker in earlier planning docs. Magic link auth exists as an alternative, but a missing password reset flow will generate 1-star reviews.

7B. "Paper Complete" vs. Truly Polished
The marketplace looks impressive on paper but is functionally inert. Browse works. Detail pages work. Ratings display. But you can't buy anything, you can't sell anything, and the only content is 16 synthetic seed decks. A user visiting the marketplace today would see a curated storefront with a "Coming Soon" button. That's fine for a beta — but calling this a "marketplace app" in marketing would be misleading.

The iOS app has extensive documented features but is not on Polsia and not submitted. The entire mobile codebase lives in the founder's private repo. Polsia cannot touch it. The iOS launch prep is happening in parallel but the actual submission depends entirely on the founder's personal development capacity.

Auth is comprehensive in breadth but unclear in polish. Email/password, Google, Apple, magic link, refresh tokens — that's a lot of auth flows for a pre-revenue app. Each one is a surface area for bugs. The question isn't whether they exist but whether they all work reliably under real user conditions.

7C. Product Risks
Retention risk is high. Industry data says 90%+ of app users churn in the first month. Flashcard apps specifically have a "use it during exam season, abandon it after" pattern. AI generation lowers the creation barrier but doesn't inherently create daily engagement. Streaks help, but the core study loop needs to be genuinely better than Anki (which is free and beloved by power users) and Quizlet (which has massive brand recognition and content).

The AI generation is no longer a differentiator. Every competitor now has AI flashcard generation. Quizlet has it. Knowt has it. Brainscape has it. RemNote has it. Free tools like NoteGPT and Revisely have it. "AI generates your flashcards" was a differentiator in 2024. In 2026, it's a baseline feature. The value has to come from the study experience, the marketplace, or the overall product quality.

7D. Business Model Risks
The $1-$5 deck marketplace has thin unit economics. At a 70/15/15 split (creator/platform/Apple), a $2.99 deck gives the platform ~$0.45. You need extremely high volume or a large catalog to generate meaningful platform revenue from micro-transactions. The real revenue path may need to be Pro subscriptions ($9/mo) with the marketplace as a retention/discovery mechanism rather than a direct profit center.

Two-sided marketplace cold-start is the hardest problem in consumer tech. The feasibility report correctly identified this. But the plan to recruit 30-50 teacher partners before launch is ambitious for a solo founder with no existing audience, no brand, and no money to offer guaranteed earnings. Teacher recruitment hasn't started yet — it's still a queued research task.

7E. Growth Risks
No distribution channel exists yet. No social following, no email list, no community presence, no content marketing, no paid acquisition. The community mapping task is queued but not executed. The App Store is the primary discovery channel for iOS apps, which means ASO is critical — but even great ASO takes months to compound.

The web-to-iOS split creates a distribution problem. The web app on Polsia can't process payments. The iOS app isn't submitted. Neither channel is currently functional for converting a visitor into a paying user.

7F. Founder-Focus Risks
The founder is splitting attention between three things:

Refactoring/porting the codebase to Polsia (active)
iOS development and submission (upcoming)
The broader "Mint Apps as app factory" vision (aspirational)
Plus there's Trade Journal as a second app in early development. For a solo founder, this is a lot of concurrent surface area. The handoff discipline is excellent, but the risk is that the porting process takes longer than expected and delays everything downstream (iOS submission, payment wiring, actual launch, first revenue).

7G. Over-Complexity Risk
79 features across 63 endpoints for a pre-revenue product is a lot. The scope reduction was the right call, but even the "kept" feature set (AI generation, 4 study modes, streaks, marketplace browse, multiple auth flows, avatars, deck management, stats) is broad for a v1 launch. Every feature is a maintenance burden and a potential bug surface. A more aggressive v1 scope might be: AI generation + 1-2 study modes + streak + marketplace browse. Everything else is v1.1.

8. Likely Current Next Steps Based on Project State
   Based on the conversation history and task queue, the project appears to be following this sequence:

Packaging/path-move prep (active) — Structural refactoring to get the codebase physically into Polsia-Inc/mintapps for engineering agents to build on
App Store listing copy (queued) — Draft title, subtitle, description, keywords, screenshot captions
Student community mapping (queued) — Identify top 20 launch channels
Teacher recruitment research (queued) — Find channels and draft outreach for marketplace cold-start
iOS launch pre-flight checklist (queued) — Synthesize all research into actionable submission plan
The implied sequence after these tasks: finish the code port → wire Polsia payments → finalize App Store listing → submit iOS app → soft launch → begin community outreach.

This sequence makes sense directionally. The research is being done in parallel with the code migration, which is efficient. The pre-flight checklist will synthesize everything into an actionable launch plan.

9. Recommended Next Steps
   Immediate (This Week)
   Task Why Domain Effort Impact
   Complete the packaging/path-move into Polsia repo Everything downstream is blocked until the codebase is on Polsia and engineering agents can work on it Engineering High (founder-dependent) Critical — unblocks all engineering work
   Draft Terms of Service + Privacy Policy App Store hard requirement. Also needed before any real user touches the product Content/Legal Medium (Polsia can draft, founder reviews) Critical for launch
   Wire Polsia payments for Pro subscription Without a working payment flow, the product cannot generate revenue. This is the #1 monetization blocker Engineering Medium Critical for revenue
   Next 30 Days
   Task Why Domain Effort Impact
   Run the 4 queued research tasks App Store listing copy, community mapping, teacher recruitment, and pre-flight checklist — all feed directly into launch execution Research/Growth Low (already scoped and queued) High — creates the launch plan
   Build a basic onboarding flow First-run experience → paywall → trial start. This is where 80% of conversions happen per the playbook's own data Product/Engineering Medium High for conversion
   Add basic analytics PostHog or Mixpanel free tier. Track: signups, generation events, study session starts/completions, marketplace views, paywall impressions, conversions Engineering Low High for optimization
   Submit iOS app to TestFlight Get the beta in testers' hands. Every day of delay is a day without user feedback Engineering (founder) Medium High for launch timeline
   Build the landing page on Polsia ai-notecards.com pointed at a conversion-optimized page on Polsia infrastructure, with "Download on App Store" CTA ready for launch Engineering Medium High for discoverability
   Next 90 Days
   Task Why Domain Effort Impact
   iOS App Store submission and soft launch This is the main event. Everything before this is prep. Engineering/Product High Critical — revenue starts here
   Wire marketplace purchase flow (Polsia payments for deck purchases) Turn the marketplace from a browse experience into a transactional one Engineering Medium High for differentiation + retention
   Execute community outreach Seed initial reviews, build word-of-mouth in student communities per the community mapping results Growth Medium (ongoing) High for organic acquisition
   Begin teacher partner recruitment 10-20 quality decks from real educators transform the marketplace from synthetic to valuable Growth Medium High for marketplace credibility
   Monthly ASO iteration cycle Pull rankings → update keywords → A/B test screenshots → analyze. Start the compound growth loop Growth Low (recurring) High over time
   Add spaced repetition (SM-2) This is the #1 feature that separates serious study apps from casual ones. Anki's entire value proposition is spaced repetition. Adding it makes AI Notecards competitive for long-term learners Engineering Medium High for retention
10. Business Model and Profitability Assessment
    Value Proposition
    Moderately compelling. "AI generates flashcards from your notes/photos" solves a real pain point (flashcard creation is tedious). The study modes are varied and well-designed. The marketplace — when functional — adds a unique layer. But AI generation alone is commoditized, and the marketplace needs supply to deliver value.

Pricing / Tiering
Sensible but conservative. Free (1 gen/day) → Trial (7 days) → Pro ($9/mo) is standard. The hard paywall with trial approach is correct per the data (5x better conversion than freemium). $9/mo is below the median iOS subscription price ($12.99/mo), which leaves room to increase if the product earns it. The weekly pricing option recommended by the playbook ($7.48/week) converts better but has terrible retention — worth testing but not defaulting to.

Is the Marketplace a Real Moat?
It's a potential moat, but it's currently an empty swimming pool. A functioning two-sided marketplace with quality content and active sellers would be a genuine differentiator — no AI flashcard competitor has this. But marketplace businesses are notoriously hard to bootstrap. The curated-only launch strategy (seed 50-100 decks, open to sellers in v1.1) is the right approach. The question is execution: can the founder recruit enough quality creators without budget, brand, or existing audience?

At $1-$5 per deck with $0.45 platform take, the marketplace is not a profit center — it's a retention/discovery mechanism. The real revenue engine is Pro subscriptions at $9/mo.

Retention Likelihood
Moderate risk. Flashcard apps have seasonal usage patterns (exam periods). Streaks help but aren't enough alone. Spaced repetition (not yet implemented) is the feature that creates genuine daily pull. The marketplace could drive browsing/discovery behavior that brings users back, but only if content is consistently fresh and valuable.

Likely Acquisition Channels
App Store organic search — dependent on ASO execution (research is done, implementation pending)
Student community word-of-mouth — Reddit, Discord, TikTok study communities (research queued)
Teacher/creator networks — if marketplace supply is strong, creators bring their audiences
Build in public — founder's Twitter presence (low-cost, slow-build)
Meta Ads — available through Polsia at $10/day minimum; potentially viable for student acquisition with the right video creative
Is the Product Direction Too Broad?
Yes, slightly. 79 features is a lot. The scope reduction to cut seller flows was correct but could go further. For v1 launch, the app should be ruthlessly focused on: AI generation → study → streak → marketplace browse. Everything else should be dark or deferred until there's user data showing what matters.

iOS vs. Web Priority
iOS should be primary. The playbook's own research shows iOS users spend 2x more per app than Android, IAP converts 25-35% better than web purchases, and the App Store is the main discovery channel. The web build on Polsia is useful as a companion/marketing surface and for the marketplace, but the monetization engine is the iOS app with IAP.

Profitability Potential
Realistic but modest. Scenario math:

1,000 Pro subscribers at $9/mo = $9,000/mo gross
Apple takes 15% (Small Business Program) = $7,650/mo net
That's achievable for a well-positioned niche app with good ASO and 12-18 months of compounding
$500K/year target (from the playbook) requires ~5,800 Pro subscribers — ambitious but not impossible over 2-3 years with a portfolio approach 11. Mint Apps "App Factory" Assessment
Current State of Factory Capability
Almost entirely bespoke to AI Notecards. The reusable assets are:

Reusable:

The 7-phase App Playbook (documented, being followed)
Research methodology and competitive teardown templates
ASO keyword research process
Market sizing framework ($500K niche formula)
The Polsia platform itself (Express/Postgres/React + deployment infrastructure)
The founder's technical judgment and handoff discipline
Not yet reusable:

No shared component library across apps
No shared auth module
No shared payment/subscription infrastructure
No shared analytics setup
No shared launch checklist template (the queued task will create one)
No documented "launch recipe" with actual metrics from a shipped app
Is the Factory Vision Realistic?
Realistic in theory, unproven in practice. The idea of launching 2-4 focused subscription apps and cross-promoting them is sound. Solo indie devs who've done this successfully (e.g., those in the ~$10K/mo portfolio range) typically have 3-5 apps, each earning $2-3K/mo. But every one of them will tell you: the first app is by far the hardest. It takes 6-12 months to learn the real lessons that make apps 2, 3, and 4 faster.

What Would Make the Factory Real
The transition from "first app" to "factory" happens when:

AI Notecards has a documented launch → growth → revenue sequence
That sequence becomes a template with specific tools, timelines, and benchmarks
Shared infrastructure modules (auth, payments, analytics) are extracted and reused
The founder has validated that the playbook actually produces revenue, not just features
Until AI Notecards generates revenue and retains users, the factory is aspirational. That's fine — but the focus right now should be 100% on making the first app work.

Operating Model Recommendation
If the goal is a multi-app portfolio:

Ship AI Notecards. Get to $1K MRR. Document everything.
Extract reusable modules (auth, payments, analytics, ASO template, launch checklist) into a shared library.
Use that library + documented playbook to launch app #2 (Trade Journal or a new niche discovery).
Target: app #2 should take 50% of the calendar time of app #1.
Use Polsia for research/ASO/growth on all apps; founder focuses on iOS development. 12. Top Priorities, Top Risks, and Final Recommendation
Is the Company on the Best Track?
Mostly yes, but priorities should be adjusted.

The strategic thinking is strong. The playbook is sound. The scope reduction is correct. The handoff discipline is exceptional for a solo founder. The research pipeline is well-sequenced.

But the project is spending too much time in migration/prep mode and not enough time moving toward first revenue. The handoff prep pass was thorough — arguably more thorough than needed for a pre-revenue product. The schema review, seed validation, placeholder surface engineering, and multi-document handoff process consumed significant founder time that could have gone toward getting the iOS app into TestFlight or wiring payments.

The adjustment needed: compress the remaining port, accept imperfection, get to submission. Perfection is the enemy of launch.

Top 5 Most Important Next Moves
Complete the code port to Polsia and wire payments. No revenue is possible until this is done. Every other activity is pre-revenue overhead until payments work.

Submit the iOS app to TestFlight within 2 weeks. Real user feedback > perfect code. Even 20 beta testers will surface issues no amount of handoff review will find.

Draft legal pages (ToS, Privacy Policy). Hard blocker for App Store submission. Not glamorous, but non-negotiable.

Execute the 4 queued research tasks. App Store listing copy, community mapping, teacher recruitment, and pre-flight checklist. These create the launch execution plan.

Set up basic analytics before any user touches the product. If you launch without analytics, you're flying blind on conversion, retention, and engagement — the metrics that determine whether the business works.

Top 5 Biggest Risks
Extended porting timeline delays launch indefinitely. The handoff process is high-quality but the opportunity cost of each additional week in "prep mode" is real. Competitors are shipping. Students are choosing tools now.

No payment flow = no revenue feedback loop. You can't learn whether people will pay until you let them. The current build has no path to revenue.

Marketplace cold-start failure. If the marketplace launches with only 16 synthetic decks and no real educator content, it undermines the core differentiation claim. The teacher recruitment plan is still at the research stage.

Solo founder bandwidth. iOS development, web porting, marketplace strategy, ASO, legal, community outreach — this is too much for one person to execute quickly. The 80/20 split (Polsia handles distribution, founder handles engineering) is the right model but requires trusting Polsia with more execution autonomy.

AI generation is commoditized. The "AI flashcard" angle is no longer unique. The marketplace and study quality need to carry the value proposition, and both are incomplete.

Where to Focus Next
Focus on: traction, then monetization, then retention — in that order.

Not polish. Not the factory. Not Trade Journal. Not more schema optimization.

Get the app in users' hands. See if they come back. See if they pay. Then optimize.

Final Answer
"Are we on the right track to make AI Notecards profitable and to turn Mint Apps into a real app company?"

The strategic track is right. The playbook is real. The product has genuine depth. The founder's technical capability and system-thinking are above average for a solo operation. The research foundation is solid.

But you are currently building infrastructure for a building that has no tenants. The schema is clean, the handoff is disciplined, the research is thorough — and yet zero users have ever opened this app, zero dollars have been charged, and the iOS app is not submitted.

The track is right. The pace needs to shift from "prepare perfectly" to "launch imperfectly." Get to TestFlight in 2 weeks. Get to App Store submission in 30 days. Get to first revenue in 60 days. Then — and only then — does optimizing the marketplace, expanding the factory, or launching Trade Journal make sense.

AI Notecards can be profitable. Mint Apps can be a real company. But only if the first product actually ships to real users and proves people will pay for it. Everything else is planning.
