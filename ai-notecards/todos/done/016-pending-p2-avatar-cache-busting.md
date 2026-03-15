---
status: pending
priority: p2
issue_id: "016"
tags: [code-review, performance]
dependencies: []
---

# Avatar URL Lacks Cache-Busting Parameter

## Problem Statement

Avatar stored at `avatars/{userId}.{ext}` — when re-uploaded, same path is overwritten. Browsers and CDNs cache the old image. The `sanitizeUser` URL construction has no cache-busting parameter.

## Findings

- **Performance Oracle** (#12): Stale cached avatars after re-upload

## Proposed Solutions

### Option A: Append timestamp query parameter (Recommended)

```javascript
avatar_url: `${STORAGE_BASE}/${user.avatar_url}?v=${Date.now()}`
```

- **Pros**: Simple, forces refetch
- **Cons**: Prevents CDN caching (acceptable for avatars)
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] Re-uploading avatar shows the new image immediately
- [ ] No stale cached avatar displayed after update

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | Standard cache-busting pattern |
