---
status: pending
priority: p2
issue_id: "053"
tags: [code-review, race-condition, onboarding, frontend]
dependencies: []
---

# Onboarding 1.5s Minimum Timer Race Condition

## Problem Statement

The plan specifies a 1.5s minimum display for the loading state in onboarding step 2. This timer is a race condition factory: if the API responds in 800ms and the user clicks Skip at 1200ms, the timer fires at 1500ms and may save a phantom deck or advance to step 3 after the user has already navigated away.

Additionally, 1.5s is excessive — Groq typically responds in 2-5 seconds, and if it responds faster, the artificial delay makes the app feel slow.

## Findings

- **Frontend Races Reviewer:** HIGH — timer races with Skip/Back/unmount
- **Simplicity Reviewer:** Unnecessary UX theater — existing Generate.jsx has no such delay

## Proposed Solutions

### Option A: Remove the minimum timer entirely (Recommended)
Use the same loading pattern as Generate.jsx. No artificial delay.
**Pros:** Simpler, no race condition, fastest user experience
**Cons:** Sub-second responses may flash the spinner briefly
**Effort:** Reduces complexity
**Risk:** None

### Option B: Race API + min-wait promise with shared AbortController
```js
const generateWithMinDisplay = async (signal) => {
  const minWait = new Promise((resolve, reject) => {
    const id = setTimeout(resolve, 300); // 300ms, not 1500ms
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
  const [data] = await Promise.all([
    api.generatePreview(topic, topic, { signal }),
    minWait,
  ]);
  return data;
};
```
**Pros:** Prevents jarring flash, cancellable
**Cons:** Adds complexity
**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] No phantom decks from abandoned onboarding generation
- [ ] Skip/Back buttons immediately abort in-flight generation AND any timer
- [ ] Loading state does not persist after component unmount
