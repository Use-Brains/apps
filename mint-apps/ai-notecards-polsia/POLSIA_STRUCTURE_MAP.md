# Polsia Structure Map

This document maps the current copied sandbox to the repo structure Polsia confirmed for the eventual migration target.

## Confirmed target shape

```text
mintapps/
├── server/
│   ├── index.js
│   ├── routes/
│   ├── middleware/
│   ├── db/
│   │   ├── index.js
│   │   └── migrations/
│   └── services/
├── client/
│   ├── index.html
│   ├── src/
│   ├── public/
│   └── vite.config.js
├── package.json
├── render.yaml
└── .env
```

## Current-to-target mapping

| current path | target path | status in copied app | notes |
|---|---|---|---|
| `server/src/index.js` | `server/index.js` | aligned via compatibility layer | `server/index.js` now loads env and owns the real runtime entry; `server/src/index.js` delegates to it |
| `server/src/bootstrap.js` | `server/index.js` bootstrapping concern | aligned via compatibility layer | `server/src/bootstrap.js` now delegates to `server/index.js` instead of owning boot logic |
| `server/src/routes/*` | `server/routes/*` | aligned via compatibility layer | live route implementations now live in `server/routes/*`; `server/src/routes/*` remains as compatibility re-exports during the move |
| `server/src/middleware/*` | `server/middleware/*` | aligned via compatibility layer | live middleware implementations now live in `server/middleware/*`; `server/src/middleware/*` re-exports them |
| `server/src/services/*` | `server/services/*` | aligned via compatibility layer | live service implementations now live in `server/services/*`; `server/src/services/*` re-exports them |
| `server/src/db/*` | `server/db/*` | aligned via compatibility layer | DB runtime, pool, queries, and index now live in `server/db/*`; `server/src/db/*` delegates to them |
| `server/src/db/migrations/*` | `server/db/migrations/*` | structurally close | SQL migration model already matches Polsia’s sequential approach |
| `client/*` | `client/*` | already close | web app layout is already near target |
| root `package.json` | single root `package.json` | partially aligned | root scripts now cover build/start/migrate flow without workspaces yet |
| no `render.yaml` | `render.yaml` | aligned by draft | current file is a copied-app draft, not final production truth |
| `server/.env` + `client/.env.example` | root `.env` managed by Polsia | not aligned | leave env files as-is until the real Polsia repo owns secret management |

## Explicit non-goals for phase 2

- Do not move the existing `server/src/*` tree yet.
- Do not remove `client/vercel.json` yet.
- Do not delete `mobile/`, seller routes, Stripe routes, or RevenueCat routes.
- Do not rewrite imports just to match the future folder names.

## Phase 3 prep implied by this map

- Introduce a Polsia-style DB adapter surface so `server/db/index.js` has a clear future landing spot.
- Produce a route inventory that marks which current routes map cleanly to Polsia conventions and which remain optional/deferred.
- Narrow the eventual phase 4 move to mostly file relocation plus import rewrites, not logic changes.

## Packaging prep status

- `server/routes/*` now exists as the live future-facing route surface.
- All current Express route implementations now live in `server/routes/*`.
- `server/src/routes/*` now acts as a compatibility re-export layer for those route modules.
- `server/middleware/*` now exists as the live middleware surface.
- `server/services/*` now exists as the live service surface.
- `server/index.js` now exists as the live runtime entry surface.
- `server/app.js` now exists as the live shared app module behind the runtime entry.
- `server/config/runtime.js` now exists as the live runtime/config surface.
- `server/db/*` now owns the primary DB runtime/config/pool/query surfaces used by the promoted app.
- `server/db/migrator.js`, `server/db/legacy-migrate.js`, and `server/db/legacy-seed.js` now own the legacy DB runner surface.
- The remaining packaging move should now be mostly:
  - cleanup of the temporary compatibility layer once the move is complete
