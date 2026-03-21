# Current Mobile Priorities

This file exists to keep Atlas focused on the active mobile frontier instead of wandering across the repo.

## Priority 1 — Launch Readiness

Focus on the highest-leverage work that reduces launch risk for the iOS app.

Examples of launch-readiness concerns:
- environment correctness across development, preview, and production
- auth stability and account continuity
- offline study trustworthiness
- reviewer-sensitive capabilities and configuration
- crash or blocker-level UX failures in core study flows

## Priority 2 — Product Quality In Core Study Flows

Prioritize quality in the product paths users are most likely to notice immediately.

Examples:
- deck loading reliability
- study session continuity
- offline queue clarity
- error states that are understandable and recoverable
- polished behavior for app start, session restore, and interrupted study

## Priority 3 — Cross-Layer Safety

Protect the seams between mobile and backend.

Examples:
- route assumptions used by mobile
- session and auth bootstrap behavior
- study sync semantics
- purchased-deck access assumptions
- entitlement state assumptions

## Current Default Ranking

When deciding between tasks, Atlas should generally rank them like this:
1. fix launch blockers
2. fix correctness and trust issues
3. fix high-visibility UX rough edges in core flows
4. improve maintainability in touched areas
5. defer broad cleanup unless explicitly requested

## Current Blockers To Watch For

Atlas should actively look for and call out blockers in these categories:
- mobile app cannot run reliably in the intended local workflow
- simulator or preview environment behavior diverges from intended config
- auth breaks or leaves the user in a stuck state
- offline study completion can be lost, duplicated, or mistrusted
- purchased or entitled access behaves inconsistently
- release-sensitive app identity or capability config is wrong

## Explicitly Later Unless Needed For Current Work

These are usually lower priority unless they directly unblock launch, quality, or correctness:
- broad architecture cleanup
- repo-wide refactors
- naming cleanup with no product impact
- speculative abstraction work
- parity work for low-value surfaces not tied to current launch goals

## How Atlas Should Use This File

- Start here when choosing among multiple reasonable tasks.
- Re-rank work toward launch safety and user trust.
- When adding a new major task, update this file if the active frontier has changed.
