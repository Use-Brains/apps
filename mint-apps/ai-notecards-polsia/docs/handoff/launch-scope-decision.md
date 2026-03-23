# Launch Scope Decision

Last updated: 2026-03-22

This memo exists so Polsia does not infer the wrong launch scope from a mixture of PRD material, placeholder routes, and older planning documents.

## Firm launch intent

AI Notecards is intended to launch as:

- an AI-powered flashcard and study app
- with iOS as a serious launch surface
- with a real buyer-facing marketplace presence

Buyer marketplace importance is firm. It should not be collapsed into an irrelevant or decorative feature.

## Current launch-safe implementation stance

Firm:

- generation from text and photos matters
- deck CRUD and study flows matter
- marketplace browse matters
- marketplace listing detail matters
- purchased deck access and study behavior matter as a product goal

Flexible:

- final iOS marketplace purchase implementation path
- exact launch timing of seller tooling
- whether direct in-app deck purchase is enabled at launch or deferred pending platform/compliance readiness

## Seller tooling stance

Current stance:

- seller creation, onboarding, listing management, and payout tooling are deferred by default
- seller surfaces remain in the repo, but handoff mode keeps them as shell or disabled flows

This is intentional. Do not treat seller tooling as a launch blocker unless the founder explicitly re-expands scope.

## Apple subscription and RevenueCat stance

Current stance:

- Apple subscription support through RevenueCat is the clearest active iOS monetization path in the repo
- native billing remains a real code path, not a placeholder-only idea
- production readiness still depends on real App Store Connect and RevenueCat verification

## iOS marketplace purchase stance

Current stance:

- buyer marketplace is strategically important
- the exact iOS purchase path is not yet locked as final launch truth
- the repo currently supports marketplace browse and detail
- marketplace purchase checkout currently resolves to placeholder behavior in the handoff build
- the backend also contains an iOS-specific gate for browser-based marketplace checkout behavior

Operational rule:

- do not assume direct iOS marketplace purchasing is already solved
- do not simplify the marketplace away
- treat this as an explicit founder decision that must be finalized before TestFlight-to-submission work is considered complete

## What Polsia should optimize for

Polsia should optimize recommendations for:

- preserving buyer marketplace seriousness
- avoiding false claims about live purchase or seller capabilities
- making launch prioritization decisions that help a real builder ship

Polsia should not optimize for:

- abstract marketplace strategy detached from current repo reality
- forcing seller tooling into v1 by default
- assuming a billing architecture that the current sandbox does not support
