---
status: pending
priority: p2
issue_id: "051"
tags: [code-review, race-condition, frontend, duplication]
dependencies: []
---

# Duplicate Button Needs AbortController for Unmount Safety

## Problem Statement

The plan's `handleDuplicate` in DeckView.jsx calls `navigate()` after an async `api.duplicateDeck()`. If the user navigates away while the request is in-flight, the promise resolves and `navigate()` fires, teleporting the user to an unexpected page.

Additionally, `api.duplicateDeck` is defined as `(id) => request(...)` without a `signal` parameter, making cancellation impossible.

## Findings

- **Frontend Races Reviewer:** MEDIUM-HIGH — "surprise teleportation" class of bug

## Proposed Solutions

### Add AbortController + forward signal
```js
duplicateDeck: (id, options = {}) =>
  request(`/decks/${id}/duplicate`, { method: 'POST', ...options }),
```

```js
const controllerRef = useRef(null);
useEffect(() => () => controllerRef.current?.abort(), []);

const handleDuplicate = async () => {
  if (duplicatingRef.current) return;
  duplicatingRef.current = true;
  const controller = new AbortController();
  controllerRef.current = controller;
  try {
    const data = await api.duplicateDeck(id, { signal: controller.signal });
    if (controller.signal.aborted) return;
    navigate(`/decks/${data.deck.id}`);
  } catch (err) {
    if (err.name === 'AbortError') return;
    toast.error(err.message);
  } finally {
    if (!controller.signal.aborted) duplicatingRef.current = false;
  }
};
```

**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] Navigating away mid-duplication does not cause phantom navigation
- [ ] `api.duplicateDeck` accepts an options object with signal
- [ ] AbortController is cleaned up on unmount
