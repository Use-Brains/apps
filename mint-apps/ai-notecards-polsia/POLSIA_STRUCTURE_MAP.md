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
| `server/src/index.js` | `server/index.js` | retired | live runtime now starts from `server/index.js`; the old compatibility entrypoint has been removed |
| `server/src/bootstrap.js` | `server/index.js` bootstrapping concern | retired | boot logic now lives only at the top-level server entry |
| `server/src/routes/*` | `server/routes/*` | mostly retired | live route implementations now live in `server/routes/*`; only historical/deferred references should remain in docs, not runtime |
| `server/src/middleware/*` | `server/middleware/*` | retired | live middleware implementations now live only in `server/middleware/*` |
| `server/src/services/*` | `server/services/*` | retired | live service implementations now live only in `server/services/*` |
| `server/src/db/*` | `server/db/*` | partially retained for history | live DB runtime, pool, queries, and index now live in `server/db/*`; only historical SQL/script copies remain under `server/src/db/*` |
| `server/src/db/migrations/*` | `server/db/legacy-migrations/*` | aligned via copied legacy chain | the promoted legacy migrator now reads top-level `server/db/legacy-migrations/*`; the old `server/src/db/migrations/*` files remain as compatibility/history copies for now |
| `client/*` | `client/*` | already close | web app layout is already near target |
| root `package.json` | single root `package.json` | partially aligned | root scripts now cover build/start/migrate flow without workspaces yet |
| no `render.yaml` | `render.yaml` | aligned by draft | current file is a copied-app draft, not final production truth |
| `server/.env` + `client/.env.example` | root `.env` managed by Polsia | not aligned | leave env files as-is until the real Polsia repo owns secret management |

## Explicit non-goals for phase 2

- Do not move the existing `server/src/*` tree yet.
- Do not delete `mobile/`, seller routes, Stripe routes, or RevenueCat routes.
- Do not rewrite imports just to match the future folder names.

## Phase 3 prep implied by this map

- Introduce a Polsia-style DB adapter surface so `server/db/index.js` has a clear future landing spot.
- Produce a route inventory that marks which current routes map cleanly to Polsia conventions and which remain optional/deferred.
- Narrow the eventual phase 4 move to mostly file relocation plus import rewrites, not logic changes.

## Packaging prep status

- `server/routes/*` now exists as the live future-facing route surface.
- All current Express route implementations now live in `server/routes/*`.
- The former `server/src/routes/*` compatibility layer has now been retired from runtime use.
- `server/middleware/*` now exists as the live middleware surface.
- `server/services/*` now exists as the live service surface.
- `server/index.js` now exists as the live runtime entry surface.
- `server/app.js` now exists as the live shared app module behind the runtime entry.
- `server/config/runtime.js` now exists as the live runtime/config surface.
- `server/db/*` now owns the primary DB runtime/config/pool/query surfaces used by the promoted app.
- `server/db/migrator.js`, `server/db/legacy-migrate.js`, and `server/db/legacy-seed.js` now own the legacy DB runner surface.
- `server/db/legacy-migrations/*` and `server/db/scripts/*` now exist as the top-level DB artifact surface.
- The remaining historical residue under `server/src/*` is now limited to copied SQL migrations and helper scripts retained for history/reference.
