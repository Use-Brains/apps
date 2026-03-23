# Polsia Collaboration Prompts

These prompts are written for a human-in-the-loop workflow where you copy messages between this repo effort and Polsia.

## Purpose

Use these prompts to:

- explain the current state of `mint-apps/ai-notecards-polsia`
- ask Polsia what prep work is still missing
- clarify what should happen before any code or data handoff
- reduce ambiguity before phase 4 packaging work

## Current-state prompt

Copy-paste this to Polsia:

```text
We have been preparing a copied sandbox at `mint-apps/ai-notecards-polsia` for eventual migration into your standard Express + Postgres + React/Vite structure.

Current prep completed on our side:

- Added runtime/config boundaries for deployment and feature flags
- Added storage abstraction prep so route code no longer hardcodes Supabase public URLs
- Added a shared public app URL helper for checkout/onboarding/email links
- Added opt-in Express static serving of the built client for unified deployment prep
- Added a client-side seller read-only boundary so seller pages can remain visible but disabled gracefully
- Added root scripts, a draft `render.yaml`, and compatibility entrypoints for the server and DB surface
- Added a DB compatibility surface around the current `pg` pool
- Documented route classification into web-core vs optional vs deferred

Current intentional non-goals:

- no broad folder migration yet
- no schema rewrite
- no auth rewrite
- no Stripe/RevenueCat rewrite beyond containment
- no mobile refactor

Known remaining high-coupling areas:

- seller and Stripe Connect flows
- RevenueCat/native billing
- Supabase-backed storage implementation
- legacy `client/vercel.json` split-host artifact

Before we start phase 4 packaging/path migration, is there anything you want us to do first?

Specifically:

1. Are we missing any repo-shape prep you want before code lands in your environment?
2. Do you want any additional DB/runtime conventions beyond a standard Neon `pg` setup?
3. Do you want marketplace purchase/seller flows kept present-but-disabled, or fully omitted from the first handoff?
4. Do you expect any specific data handoff format for existing schema/migrations/content, or should we assume SQL migrations plus a separate export/import conversation later?
5. Is there anything in our current prep that you would prefer we stop doing before the collaboration continues?
```

## Data-handoff prompt

Copy-paste this when you want to move the conversation toward data transfer expectations:

```text
We want to clarify the eventual data handoff path before we make deeper migration changes.

Current state:

- The copied app still uses raw SQL migrations under `server/src/db/migrations`
- PostgreSQL is the system of record
- We have not rewritten the schema
- We are preparing the repo for your Express + Neon + Render-style structure
- Storage and payments are still isolated rather than rewritten

Can you clarify how you would prefer data to be handed over when the time comes?

Questions:

1. Do you want the migration history itself ported as-is first, or would you rather receive schema + seed/export artifacts separately?
2. Should we prepare a structured export/import plan for users, decks, cards, marketplace entities, and billing-related references now, or is that premature?
3. Are there any entities you already know should be excluded from first-pass data transfer?
4. Do you want us to prepare a field-by-field mapping document between the current schema and your target repo once phase 4 begins?
5. Is there any security/privacy constraint we should account for before preparing sample exports or migration docs?
```

## Response-followup prompt

Use this after Polsia replies and you want to narrow the next action:

```text
Thanks. Based on your reply, we want to confirm the next concrete prep step before we touch packaging further.

Our current likely next step is:

- continue phase 3 runtime/route convergence, or
- begin phase 4 packaging/path migration, or
- prepare a schema/data mapping document first

Given the current repo state we described, which one do you want first?

If helpful, we can send:

- a route matrix
- a current-to-target structure map
- a DB/runtime compatibility summary
- a high-risk subsystem list

Tell us which artifact would reduce the most uncertainty on your side.
```

## Notes

- Keep prompts concrete and rooted in the copied sandbox, not in the original app.
- Ask Polsia for sequencing decisions before doing irreversible folder moves or data-handling work.
- Treat data transfer as a separate planning thread from repo structure unless Polsia explicitly combines them.
