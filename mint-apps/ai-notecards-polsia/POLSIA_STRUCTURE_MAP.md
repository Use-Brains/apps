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
| `server/src/index.js` | `server/index.js` | partially aligned | `server/index.js` now exists as a thin wrapper; main app logic still lives in `server/src/index.js` |
| `server/src/bootstrap.js` | `server/index.js` bootstrapping concern | preserved | still loads `server/.env`; final Polsia repo likely moves env management up a level |
| `server/src/routes/*` | `server/routes/*` | partially aligned | core route implementations are being promoted into `server/routes/*`; matching `server/src/routes/*` files remain as compatibility re-exports during the move |
| `server/src/middleware/*` | `server/middleware/*` | partially aligned | compatibility wrappers now exist under `server/middleware/*` |
| `server/src/services/*` | `server/services/*` | partially aligned | compatibility wrappers now exist under `server/services/*` |
| `server/src/db/pool.js` | `server/db/index.js` | partially aligned | `server/src/db/index.js` now centralizes DB exports and `server/db/index.js` exists as a compatibility wrapper |
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

- `server/routes/*` now exists as the future-facing route surface.
- Core route implementations already promoted into `server/routes/*`:
  - `auth`
  - `auth-google`
  - `auth-magic`
  - `decks`
  - `generate`
  - `marketplace`
  - `study`
  - `settings`
  - `ratings`
  - `notifications`
  - `revenuecat`
- The matching `server/src/routes/*` files for those modules now act as compatibility re-exports.
- `server/middleware/*` now exists as a thin wrapper layer over the current middleware modules.
- `server/services/*` now exists as a thin wrapper layer over the current service modules.
- The remaining packaging move should now be mostly:
  - promotion of remaining route implementations (`account`, `seller`, `admin`, `handoff-billing`, `auth-apple`)
  - relocation of the highest-value middleware/service implementations
  - eventual replacement of `server/src/index.js` with a top-level `server/index.js` runtime entry
  - cleanup of the temporary compatibility layer once the move is complete
