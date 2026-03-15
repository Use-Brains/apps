---
status: pending
priority: p2
issue_id: "047"
tags: [code-review, performance, security, architecture, marketplace-operations]
dependencies: []
---

# Auto-Approve Cleanup UPDATE Needs Debounce

## Problem Statement

The plan runs an UPDATE on every `GET /api/marketplace` browse request to flip stale `pending_review` listings to `active`. This converts the busiest read endpoint into a write endpoint, causing lock contention under concurrent load and write amplification. All 5 review agents flagged this independently.

## Findings

- **Performance Oracle (P1-01)**: Write amplification on reads; concurrent requests serialize on row locks; WAL entries on every browse.
- **Security Sentinel (P2-3)**: DDoS amplification vector — unauthenticated endpoint performs write on every request.
- **Data Integrity Guardian (P1-3)**: No concurrency guard; N concurrent requests acquire `FOR UPDATE` locks.
- **Architecture Strategist**: Recommends periodic cleanup via `setInterval` or `pg_cron`.
- **Pattern Recognition (P2)**: Suggests time-based guard (once per 10-30 seconds).

## Proposed Solutions

### Option A: Module-level debounce (Recommended)

```javascript
let lastCleanup = 0;
async function maybeAutoApprove() {
  const now = Date.now();
  if (now - lastCleanup < 30_000) return;
  lastCleanup = now;
  await pool.query(`UPDATE marketplace_listings SET status = 'active', ... WHERE ...`);
}
```

- **Pros**: No infrastructure, preserves "no cron needed" simplicity, limits writes to once per 30 seconds
- **Cons**: Not crash-proof (but auto-approve catches up on restart)
- **Effort**: Small (10 minutes)
- **Risk**: None

### Option B: Advisory lock

Use `pg_try_advisory_xact_lock` so only one request runs the UPDATE.

- **Pros**: Database-level guarantee
- **Cons**: More complex, adds a query
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Cleanup UPDATE runs at most once per 30 seconds, not per request
- [ ] Browse endpoint remains fast under concurrent load
- [ ] Auto-approve still works after server restart (time-based WHERE clause)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | All 5 agents flagged independently — strongest signal in review |
