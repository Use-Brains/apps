---
status: pending
priority: p3
issue_id: "030"
tags: [code-review, plan-review, security, infrastructure]
dependencies: []
---

# Missing Security Headers (helmet) — Not Addressed by Plan

## Problem Statement

The Express server does not set standard security headers: no HSTS (HTTP Strict Transport Security), no CSP (Content Security Policy), no X-Frame-Options, no X-Content-Type-Options. For a marketplace application handling real money via Stripe, this is a notable gap. The pre-launch plan does not address this in any phase.

Without these headers:
- The app can be embedded in iframes (clickjacking risk)
- Browsers may MIME-sniff responses (XSS vector)
- No enforcement of HTTPS-only connections
- No restriction on script/style sources

## Findings

- **Security Sentinel** (MEDIUM): Identified missing security headers as a gap not covered by any plan phase

## Proposed Solutions

### Option A: Add helmet middleware (Recommended)

Install `helmet` and add it as early middleware in the Express app:

```javascript
import helmet from 'helmet';
app.use(helmet());
```

Helmet sets sensible defaults for all major security headers. CSP may need customization for Vite dev server and Stripe.js.

- **Effort**: Small — one dependency, one line, plus CSP tuning
- **Risk**: Low — CSP misconfiguration could break Stripe.js or inline styles. Test thoroughly.

### Option B: Set headers manually

Add individual headers without a dependency:

```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  // etc.
  next();
});
```

- **Effort**: Small — but more code to maintain and easier to miss headers
- **Risk**: Low

## Acceptance Criteria

- [ ] Express server sets X-Content-Type-Options, X-Frame-Options, and Strict-Transport-Security headers
- [ ] CSP is configured to allow Stripe.js, fonts, and application assets
- [ ] Helmet (or equivalent) does not break Stripe Checkout or Connect onboarding flows
- [ ] Headers are verified via browser dev tools or `curl -I`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | Security headers are table stakes for any app handling payments — should not be overlooked in launch planning |
