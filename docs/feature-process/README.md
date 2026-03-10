# Feature Process README

Use this guide whenever you have a new feature idea.

## Goal
Ship new features with low regression risk and consistent quality.

## Files You Should Use
- `docs/feature-briefs/_template.md`
- `docs/feature-process/feature-integration-framework.md`
- `docs/feature-process/release-checklist.md`
- `docs/feature-process/ai-feature-delivery-checklist.md`

## Quick Start (Human)
1. Copy `docs/feature-briefs/_template.md` to a new file:
   - `docs/feature-briefs/YYYY-MM-DD-<feature-name>.md`
2. Fill out problem, scope, impacted files, risk lane, and test plan.
3. Ask the AI agent to execute using the prompt template below.
4. Review AI output for:
   - lane classification
   - required gates
   - verification results
   - residual risks
5. Run release checklist before merge:
   - `docs/feature-process/release-checklist.md`

## Risk Lane Reminder
- Lane A: UI-only, low risk.
- Lane B: hooks/forms/state changes.
- Lane C: schema/auth/storage/PnL or critical flow changes.

Lane determines required tests and approvals.

## Commands
- `npm run verify:lane:a`
- `npm run verify:lane:b`
- `npm run verify:lane:c`
- `npm run verify:baseline`

## Copy/Paste Prompt For New Feature X
Use this exact prompt with your AI coding agent.

```md
You are implementing feature: "<FEATURE X>" for Trade Journal.

Follow this process exactly:
1. Read and follow:
   - docs/feature-process/feature-integration-framework.md
   - docs/feature-process/ai-feature-delivery-checklist.md
   - docs/feature-process/release-checklist.md
2. Start by creating/updating this feature brief:
   - docs/feature-briefs/YYYY-MM-DD-<feature-x>.md
3. Classify risk lane (A/B/C) and explain why.
4. Implement only what is in scope from the brief.
5. Add/update required tests for the lane.
6. Run required verification commands for the lane.
7. Output a final report with:
   - impacted files
   - lane classification
   - required gates and their status
   - verification command results
   - residual risks/deferred work
   - explicit human sign-off items still required

Important constraints:
- No ad hoc scope creep.
- If financial logic/auth/schema is touched, escalate to Lane C.
- Do not claim completion without command results.
```

## Practical Tip
If your feature is fuzzy, spend 5 minutes improving the feature brief first. Better brief = faster implementation with fewer surprises.
