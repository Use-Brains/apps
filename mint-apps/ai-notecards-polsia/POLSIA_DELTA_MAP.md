# Polsia Delta Map

| subsystem | current implementation | target direction | action needed | risk level | refactor phase |
|---|---|---|---|---|---|
| database connection | `pg` pool in `server/src/db/pool.js`, Supabase-oriented production notes | standard Neon-friendly `pg` runtime config | centralize DB env handling and keep raw SQL approach | medium | phase 2 |
| migrations | sequential SQL runner in `server/src/db/migrator.js` | keep migration model | preserve as-is, only align env/runtime assumptions | low | phase 1 |
| avatar/media storage | Supabase-specific upload/delete and URL building in `server/src/services/storage.js` and route/auth call sites | provider-oriented storage service with R2-capable future path | continue expanding adapter and remove remaining provider assumptions | high | phase 2 |
| auth/session model | web JWT cookies plus native refresh-token sessions in `server/src/routes/auth.js` | keep web auth, isolate native session branch | gate native session flows behind runtime flags and keep web auth stable | high | phase 3 |
| AI provider orchestration | Groq/OpenAI-compatible primary plus Gemini fallback in `server/src/services/ai.js` | keep current orchestration | mostly preserve; revisit only if Polsia infra changes secrets/provider ops | low | phase 4 |
| subscription billing | Stripe web subscriptions plus Apple/RevenueCat state in `server/src/services/billing.js` and `server/src/routes/stripe.js` | web-core only first, native billing isolated | keep Stripe web intact for now, isolate RevenueCat and Apple coupling | high | phase 3 |
| seller onboarding | Stripe Connect onboarding in `server/src/routes/seller.js` | visible but disableable seller tools | keep routes/pages, gate behind runtime flags, do not port first | high | phase 3 |
| marketplace purchase flow | Stripe Connect destination-charge checkout in `server/src/services/purchase.js` | marketplace browse/read first, purchase optional later | avoid rewriting now; isolate as optional commerce path | high | phase 4 |
| webhooks | platform Stripe webhook, Connect webhook, RevenueCat webhook | optional integrations behind boundaries | preserve but treat as deferred infra in Polsia port | high | phase 4 |
| iOS subscription sync | RevenueCat webhook + reconcile route | isolate from web-core | keep separate and flaggable; do not let it drive backend shape | high | phase 3 |
| offline sync | `/api/study/sync` plus mobile SQLite/MMKV queueing | isolate from core web milestone | leave in place, document as non-blocking | medium | phase 5 |
| deployment config | Vite dev proxy, Vercel rewrite to Railway, separate server host | env-driven web API base and optional unified serving | env-driven API base and opt-in Express client serving now exist; `client/vercel.json` remains the main host-specific coupling point | high | phase 2 |
| analytics/monitoring | Sentry, PostHog, Vercel analytics | keep optional observability | retain but avoid letting host-specific analytics dictate runtime | low | phase 5 |
| push notifications | Expo token storage and notification routes/services | optional native-only subsystem | keep flaggable and out of initial Polsia scope | medium | phase 5 |

## Remaining direct infra coupling points

- `client/vercel.json`
  - Split-host rewrite dependency still present.
- `server/src/db/pool.js`
  - Database hosting/runtime assumptions still need Neon-focused review.
- `server/src/services/storage.js`
  - Storage abstraction exists, but only Supabase operations are implemented today.
- `server/src/services/billing.js`
  - Shared web/native billing state remains provider-aware.
- `server/src/routes/stripe.js`
  - Stripe subscription and purchase orchestration remains first-class.
- `server/src/routes/seller.js`
  - Stripe Connect seller onboarding remains operationally coupled.
- `server/src/services/purchase.js`
  - Marketplace checkout and fulfillment still assume Stripe Connect commerce.
- `server/src/routes/revenuecat.js`
  - RevenueCat remains a direct native billing integration, now only behind a flag.
