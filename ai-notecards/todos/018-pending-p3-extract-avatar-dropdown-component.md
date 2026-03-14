---
status: pending
priority: p3
issue_id: "018"
tags: [code-review, architecture, frontend]
dependencies: []
---

# Extract AvatarDropdown as Standalone Component

## Problem Statement

The plan inlines complex dropdown logic (refs, two useEffects, ARIA patterns, conditional rendering) directly in `Navbar.jsx`. This will bloat the Navbar significantly.

## Findings

- **Architecture Strategist** (#5.1): Extract `AvatarDropdown` as `client/src/components/AvatarDropdown.jsx`

## Proposed Solutions

Create `AvatarDropdown.jsx` that receives `user` and `onLogout` as props. Navbar renders `<AvatarDropdown user={user} onLogout={handleLogout} />`.

- **Effort**: Small
- **Risk**: None

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | Keep Navbar focused on layout |
