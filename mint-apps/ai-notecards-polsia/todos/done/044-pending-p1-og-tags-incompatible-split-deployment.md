---
status: pending
priority: p1
issue_id: "044"
tags: [code-review, architecture, marketplace-operations, og-tags]
dependencies: []
---

# OG Tags Architecture Incompatible With Split Vercel+Railway Deployment

## Problem Statement

The plan creates `server/src/middleware/og.js` and `server/src/routes/og.js` to intercept crawler requests at `/marketplace/:id` and serve OG HTML. But production uses a **split deployment**: client on Vercel (serves all non-`/api` routes), server on Railway (receives only `/api/*` via Vercel proxy rewrites). Crawler requests to `https://domain.com/marketplace/:id` hit Vercel, **not Express**. Express will never see them.

The plan also assumes Express serves `index.html` for non-crawler requests (`res.sendFile()`), but Express has no `express.static` middleware registered, no reference to `index.html`, and no client build output accessible to it.

## Findings

- **Architecture Strategist**: Flagged as most significant architectural gap. Confirmed by reading `client/vercel.json` rewrite rules.
- **Code Simplicity**: Recommends static OG tags in `index.html` for v1 — no server-side detection needed.

## Proposed Solutions

### Option A: Static OG tags in index.html (Recommended for v1)

Add generic marketplace OG tags to `client/index.html`. Every shared link shows "AI Notecards Marketplace" with a branded image. No server changes needed.

- **Pros**: Zero complexity, ships in 5 minutes, no new files
- **Cons**: All links show same preview (no per-listing title/image)
- **Effort**: Small
- **Risk**: None

### Option B: Vercel Edge Middleware for crawler detection

Create `client/middleware.ts` (Vercel Middleware) that checks user-agent and rewrites crawler requests to a Railway API endpoint (`/api/og/marketplace/:id`) that returns OG HTML.

- **Pros**: Per-listing OG previews, keeps DB access on backend
- **Cons**: Adds Vercel Middleware complexity, needs `DATABASE_URL` or API call from edge
- **Effort**: Medium
- **Risk**: Low

### Option C: Vercel serverless function

Create `client/api/og/[id].ts` serverless function that queries the DB and returns OG HTML. Add Vercel rewrite to route crawler traffic there.

- **Pros**: Self-contained, runs on Vercel infra
- **Cons**: Needs DB connection from serverless context, cold starts
- **Effort**: Medium
- **Risk**: Medium (DB connection management)

## Acceptance Criteria

- [ ] Shared marketplace links render OG previews on Twitter/Discord/Slack
- [ ] Solution works with split Vercel+Railway deployment
- [ ] No assumption that Express serves the SPA

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Architecture reviewer discovered deployment model conflict |
