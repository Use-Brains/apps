---
status: pending
priority: p3
issue_id: "070"
tags: [billing, revenuecat, stripe, observability, app-review, operations]
dependencies: []
---

# Billing Observability And Review Ops

## Problem Statement

The step 3 monetization plan covers entitlement correctness, webhook safety, and App Review fallback, but it does not yet define the non-blocking operational layer for monitoring billing sync health and documenting App Review operational playbooks.

This is not a launch blocker for implementation planning, but without it the team will have weaker visibility into delayed RevenueCat reconciliation, unknown product mappings, and review-time operational decisions.

## Findings

- Stripe and RevenueCat will both mutate subscription state, creating a new class of cross-provider drift and timing issues.
- The plan already requires feature-flagged fallback and explicit reconcile paths, which implies an operational need to observe reconciliation latency and fallback usage.
- App Review handling is treated functionally in the plan, but there is no dedicated ops/runbook artifact yet for “review rejected marketplace checkout, switch to browse-only mode.”

## Proposed Solutions

### Option 1 — Minimal logging only

- Add structured logs for RevenueCat webhook events, reconcile requests, and fallback mode changes
- No dedicated dashboard or runbook initially

**Pros**
- Cheap to add
- Good enough for early launch debugging

**Cons**
- Harder to spot aggregate drift or intermittent failures
- Review-time actions remain tribal knowledge

### Option 2 — Lightweight observability + runbook

- Add structured logs plus a short operational checklist covering:
  - webhook failures
  - reconcile lag
  - unknown product mapping alerts
  - App Review fallback switch steps

**Pros**
- Good operational clarity without much cost
- Easier launch support and review handling

**Cons**
- Slightly more documentation and instrumentation effort

### Option 3 — Full billing dashboard and alerting

- Build metrics dashboards and automated alerting around billing drift and reconciliation state

**Pros**
- Strongest post-launch visibility

**Cons**
- Overkill for current launch phase
- Higher implementation overhead

## Recommended Action

Prefer **Option 2** after core step 3 implementation is stable:

- add structured logs/analytics around RevenueCat webhook processing and reconcile results
- document a short App Review / fallback operations checklist
- add one explicit “unknown product mapping” alert path

## Acceptance Criteria

- [ ] Document the minimum billing observability signals needed for launch
- [ ] Add a short runbook for RevenueCat reconciliation failures and App Review fallback activation
- [ ] Define how unknown Apple product IDs / entitlement names are surfaced operationally
- [ ] Identify owner and validation window for post-launch billing monitoring

## Work Log

### 2026-03-15 - Created from second technical review

**By:** Codex

**Actions:**
- Identified this as a non-blocking follow-up during the second monetization plan technical review
- Kept P1/P2 implementation blockers in the plan and separated this operational concern into a P3 todo

**Learnings:**
- The launch-critical work is entitlement correctness and safe platform behavior
- Billing observability matters, but it should not distract from the core implementation path
