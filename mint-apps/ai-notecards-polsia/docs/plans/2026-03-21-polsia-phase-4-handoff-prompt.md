# Polsia Phase 4 Handoff Prompt

Use this prompt in another Codex instance to execute the first real phase 4 pass.

```text
You are working only inside:

/Users/kashane/app-dev/apps/mint-apps/ai-notecards-polsia

Context:
- Phase 1, phase 2, and phase 3 batch 1 are already complete.
- Work is happening on branch `polsia-web-core-prep-pass-2`.
- Polsia has now confirmed the phase 4 direction.

Key Polsia decisions:
- Squash migrations now, inside the sandbox.
- Keep all 15 app/domain tables in the squashed schema.
- Do NOT include `schema_migrations` in the squashed SQL; the migration runner owns it.
- Add deferred-feature SQL comment blocks above deferred tables/sections.
- Buyer marketplace browse/detail stays active.
- Buyer purchase routes stay registered but return placeholder 200 responses like `{ status: "unavailable", message: "Deck purchases coming soon" }`.
- Seller routes/pages stay present as shells that return “coming soon.”
- `stripe.js` must be removed from Express registration and removed from the handoff path.
- `client/vercel.json` must be removed before handoff.
- Keep storage at the current thin helper boundary; do not over-abstract it further.
- Create an idempotent seed script with:
  - 13 categories
  - 15-18 curated decks
  - 3-5 synthetic creator users
  - 8-12 synthetic rater users, 10-15 total users overall
  - 30-50 ratings with varied distribution
  - 3-5 content flags
  - 0 purchases
  - 0 revenuecat_webhook_events
  - 0 device_tokens
  - 0 refresh_tokens
  - deck_stats rows where appropriate
  - listing_tags rows for marketplace realism

Existing artifacts to read first:
- `POLSIA_REFACTOR_PLAN.md`
- `POLSIA_PORTING_NOTES.md`
- `POLSIA_DELTA_MAP.md`
- `POLSIA_STRUCTURE_MAP.md`
- `POLSIA_ROUTE_MATRIX.md`
- `POLSIA_COLLAB_PROMPTS.md`
- `docs/plans/2026-03-20-polsia-phase-3-plan.md`
- `server/db/migrations/001_initial.sql` (draft squashed schema)

Your phase 4 task batch:

1. Review the draft squashed migration in `server/db/migrations/001_initial.sql`
2. Refine it until it accurately represents the current sandbox schema state
3. Create `server/db/seed.js` as an idempotent seed script matching Polsia’s confirmed seed guidance
4. Add or update any helper script needed to run the new handoff-path migration + seed flow safely without breaking the current legacy migration chain
5. Prepare the app for handoff runtime cleanup:
   - make unified Express-serves-client the default path
   - remove `client/vercel.json`
   - remove `server/src/routes/stripe.js` from Express registration and handoff path
   - convert buyer purchase routes in `marketplace.js` to placeholder responses
   - convert seller/admin deferred areas into shell responses/pages
6. Update README and related docs so a fresh engineer can boot the handoff path locally

Hard constraints:
- Do not touch the original source app elsewhere in the monorepo
- Do not do a broad folder migration yet
- Do not rewrite the schema semantics beyond what is needed for the squash
- Do not remove deferred tables from the schema
- Do not wire a new payment system
- Prefer containment, placeholders, and thin adapters
- Tests first where behavior changes are involved

Expected output:
- concrete code changes
- fresh verification evidence
- a summary of what changed
- what remains for the next phase
```
