---
status: pending
priority: p3
issue_id: "055"
tags: [code-review, simplification, yagni]
dependencies: []
---

# Plan Simplification Opportunities

## Problem Statement

Several elements of the plan add complexity without clear consumers or immediate value. Removing them reduces implementation scope and maintenance burden.

## Findings (Simplicity Reviewer)

### 1. `duplicated_from_deck_id` is YAGNI
No feature reads this column. No UI shows provenance. The `origin = 'duplicated'` column already tells you a deck is a duplicate. Dropping it removes: FK column, partial index, ON DELETE SET NULL logic, FK violation handling, one INSERT parameter. Can be added later with a one-line ALTER TABLE if a provenance feature is built.
**Estimated savings:** ~30 LOC, simpler migration

### 2. Onboarding Step 3 (quick tour) is a speed bump
After generating their first deck in Step 2, users should go straight to studying. A static tour page delays the value moment. The "Start studying" button on Step 3 is where the value is — send them there directly from Step 2.
**Estimated savings:** ~45 LOC

### 3. Session recording config — not needed yet
`maskAllInputs: true` and `maskTextSelector: '*'` configure a feature not in the acceptance criteria. Add when session recording is actually enabled.
**Estimated savings:** ~5 LOC, less config surface area

### 4. `streak_milestone` event needs deduplication state
The only client-side event requiring state tracking (localStorage flag? server preference?). All other events are simple "action happened" captures. Cut from initial rollout; derive server-side from existing streak data if needed.
**Estimated savings:** ~15 LOC

### 5. `before_send` URL scrubbing defends against non-existent scenario
No current routes use `token` or `code` as URL query params. Magic links use form input, Stripe redirects go to the server. Remove and add if sensitive params are introduced later.
**Estimated savings:** ~8 LOC

## Acceptance Criteria

- [ ] Each simplification is evaluated as a product decision (keep/cut)
- [ ] Items cut from the plan are documented as intentional deferrals
