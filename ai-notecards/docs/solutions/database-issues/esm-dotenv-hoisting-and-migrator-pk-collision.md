---
title: "ESM Import Hoisting & Migrator Sub-version Tracking Bugs"
date: 2026-03-13
category: database-issues
tags:
  - nodejs
  - esm
  - postgresql
  - dotenv
  - migrations
  - lazy-initialization
  - runtime-errors
severity: high
components:
  - server/src/db/pool.js
  - server/src/db/migrator.js
symptoms:
  - 'database "simons" does not exist'
  - COALESCE expression rejected in PRIMARY KEY
  - PK collision between migration 005 and 005b
root_cause: ESM static import hoisting evaluates pool.js before dotenv.config() runs; migrator used invalid expression PK and integer-based tracking that collapses sub-versions
---

# ESM Import Hoisting & Migrator Sub-version Tracking Bugs

Two interrelated database connectivity bugs discovered during Phase 2 verification of the iOS Swift/SwiftUI rewrite + BYOK implementation.

## Bug 1: ESM Import Hoisting — Pool Created Before dotenv Loads

### Symptoms

- Error: `database "simons" does not exist`
- `pg.Pool` silently fell back to `process.env.USER` ("simons") for both user and database name when `connectionString` was `undefined`
- Server started without crashing on the pool creation itself, making the root cause non-obvious

### Investigation

1. Error referenced OS username ("simons"), not the configured database ("notecards")
2. Recognized pg's default-fallback behavior when `connectionString` is undefined
3. Traced why `DATABASE_URL` was undefined despite `dotenv.config()` being called in `index.js`
4. Identified ESM static import hoisting: all `import` statements execute before any module-level code

### Root Cause

ESM hoists all `import` statements and resolves them before executing any module-level code. The original `pool.js` called `new pg.Pool({ connectionString: process.env.DATABASE_URL })` at module evaluation time. Since `pool.js` was imported by other modules which were imported by `index.js`, the Pool constructor ran **before** `dotenv.config()` populated `process.env`. `DATABASE_URL` was `undefined`, and pg silently used the OS username as the database name.

### Solution

Deferred Pool construction to first use via lazy initializer + Proxy:

```js
// server/src/db/pool.js
import pg from 'pg';

const isProduction = process.env.NODE_ENV === 'production';

let _pool;

function getPool() {
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ...(isProduction && {
        ssl: { rejectUnauthorized: false },
        max: 12,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }),
    });
  }
  return _pool;
}

// Proxy preserves pool.query() / pool.connect() call sites — no changes needed elsewhere
const pool = new Proxy({}, {
  get(_, prop) {
    const p = getPool();
    const val = p[prop];
    return typeof val === 'function' ? val.bind(p) : val;
  },
});

export default pool;
```

Key design decisions:
- `val.bind(p)` ensures `this` inside pg.Pool methods stays correct
- `_pool` is module-level singleton — Pool created only once
- By the time any route handler calls `pool.query(...)`, Express has fully initialized including `dotenv.config()`

---

## Bug 2: Migrator COALESCE-in-PK + Sub-version Integer Collision

### Symptoms

- PostgreSQL rejects `PRIMARY KEY (COALESCE(version_tag, version::text))` — expressions not allowed in PK constraints
- `parseInt('005b', 10)` returns `5`, same as migration `005`, causing duplicate-PK insert error

### Investigation

1. Attempted expression-based PK — PostgreSQL immediately rejected the DDL
2. Recognized any sub-version scheme keyed on the integer prefix would collide
3. Existing production rows used only `version INTEGER`, requiring backward-compatible detection

### Root Cause

**Expression PK:** PostgreSQL's `PRIMARY KEY` only accepts column names, not expressions. `COALESCE(version_tag, version::text)` is rejected at DDL execution time.

**Integer collision:** `parseInt('005b', 10)` stops at the first non-numeric character and returns `5`. Sub-versioned migration `005b` produces the same integer as `005`, making integer-only tracking unusable.

### Solution

Switched to filename-based deduplication with backward-compatible integer fallback:

```js
// Track applied migrations by filename (handles sub-versions)
const { rows: applied } = await pool.query(
  'SELECT version, version_tag, filename FROM schema_migrations'
);
const appliedFiles = new Set(applied.map((r) => r.filename).filter(Boolean));
const appliedVersions = new Set(applied.map((r) => r.version)); // backwards compat

for (const file of files) {
  if (appliedFiles.has(file)) continue; // primary: filename-based

  const prefix = file.split('_')[0];
  const version = parseInt(prefix, 10);
  const versionTag = /[a-z]/i.test(prefix) ? prefix : null;

  // Fallback for old rows that predate filename column
  if (!versionTag && appliedVersions.has(version)) continue;

  // ... apply migration, INSERT (version, versionTag, file)
}
```

Manual fix for existing database:
```sql
ALTER TABLE schema_migrations DROP CONSTRAINT schema_migrations_pkey;
-- Then re-run migrations
```

---

## Verification

All endpoints verified working after fixes:
- Health check: DB connected, correct database name
- Auth: cookie + Bearer + SIWA paths
- Marketplace: browse, categories
- Login: demo user returns token
- Generate: full AI round-trip, 8 cards generated and batch inserted
- Migrations: clean apply from fresh DB, idempotent re-run

---

## Prevention Strategies

### ESM + Environment Variables

1. **Never create stateful resources at module top level in ESM** — use factory functions or lazy getters
2. **Prefer `import 'dotenv/config'`** over `dotenv.config()` — the import form executes as a side effect during module resolution
3. **Use `node --env-file=.env`** (Node 20.6+) to load env before any module evaluates
4. **Validate required env vars at startup with hard throws:**
   ```js
   const missing = ['DATABASE_URL', 'JWT_SECRET'].filter(k => !process.env[k]);
   if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
   ```

### Migration System Design

1. **Track by full filename, not parsed number** — the filename is the canonical identity
2. **Sort migration files lexicographically**, not numerically (`localeCompare`, not `parseInt`)
3. **Never use expressions in PRIMARY KEY** — COALESCE, NULLIF, casts are all invalid
4. **Validate filename format at load time:**
   ```js
   if (!/^\d{3}[a-z]?_\w+\.sql$/.test(file)) throw new Error(`Invalid migration: ${file}`);
   ```

### Code Review Checklist

- [ ] No `new Pool()` or `new Client()` at module top level in ESM files
- [ ] Required env vars validated at startup with clear error messages
- [ ] Migration tracking uses filename, not integer coercion
- [ ] No COALESCE or expressions in PRIMARY KEY definitions
- [ ] Migrator is idempotent — running twice produces no errors or duplicates

---

## Related Documentation

- `server/src/db/pool.js` — inline comment explains the lazy-init pattern
- `CLAUDE.md` Conventions: "Database pool is lazily initialized (avoids ES module import hoisting issue with dotenv)"
- `CLAUDE.md` Conventions: "In production: SSL + pool max 12 for Supabase Supavisor session mode (port 5432)"
- `docs/plans/2026-03-12-feat-ios-swift-rewrite-byok-plan.md` — the plan that surfaced these bugs during verification
