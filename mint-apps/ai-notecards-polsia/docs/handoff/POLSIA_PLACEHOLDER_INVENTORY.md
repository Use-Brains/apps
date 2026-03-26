# Polsia Placeholder Inventory

This file exists to prevent the first Polsia engineering pass from mistaking intentionally deferred or placeholder behavior for production-ready implementation.

## Active handoff stance

- `server/` and `client/` are the active web-core collaboration surface.
- `mobile/` is included for contract context, but mobile execution and device validation still depend on founder-side workflows.
- Buyer marketplace seriousness is preserved.
- Seller tooling is deferred by default.

## Known placeholder or deferred behavior

1. `server/routes/handoff-billing.js`
- `/api/stripe/checkout`
- `/api/stripe/cancel`
- `/api/stripe/portal`
- `/api/stripe/webhook`
- These return placeholder `"status": "unavailable"` billing responses in the handoff build.

2. `server/routes/marketplace.js`
- `POST /api/marketplace/:id/purchase`
- This currently returns a purchase placeholder payload, not a live checkout flow.

3. iOS marketplace purchase behavior
- `mobile/app/(tabs)/marketplace/[id].tsx`
- iOS purchase remains decision-sensitive.
- The backend can intentionally block iOS web-purchase handoff with `IOS_MARKETPLACE_WEB_PURCHASES_ENABLED=false`.
- Do not assume iOS direct purchase is launch-settled.

4. Seller routes are shell-first when disabled
- `server/routes/seller.js`
- When `FEATURE_SELLER_TOOLS=false`, seller endpoints return shell / unavailable responses instead of full seller behavior.
- This deferral is intentional.

5. Seller web UI is intentionally non-final
- `client/src/pages/SellerDashboard.jsx`
- `client/src/pages/ListDeck.jsx`
- Seller surfaces remain present for continuity, but the current launch stance is deferred-by-default seller tooling.

6. Admin tooling is visible but not operationally complete
- `client/src/pages/Admin.jsx`
- Admin moderation workflows are intentionally represented as deferred / coming-soon placeholders.
- Do not treat this as launch-ready moderation tooling.

7. Web pricing/billing UI is handoff-only
- `client/src/pages/Pricing.jsx`
- `client/src/pages/Settings.jsx`
- Billing language remains placeholder-oriented in the handoff build because live subscription checkout is not wired through the active handoff surface.

8. Notification/reminder delivery is not fully productized
- Preferences exist, but reminder delivery and some notification channels are not fully live end-to-end.
- Do not assume stored notification preferences imply completed delivery infrastructure.

## Practical engineering rule

- If a route or surface appears implemented but returns `"status": "unavailable"`, “coming soon,” shell payloads, or iOS-disabled purchase messaging, treat it as intentionally deferred unless the task explicitly says to make it real.
- When in doubt, cross-check:
  - `docs/contracts/mobile-api-runtime-contract.md`
  - `docs/handoff/launch-scope-decision.md`
  - `docs/handoff/verification-status.md`
  - `START_HERE_FOR_POLSIA.md`
