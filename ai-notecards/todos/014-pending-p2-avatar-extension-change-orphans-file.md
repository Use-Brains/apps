---
status: pending
priority: p2
issue_id: "014"
tags: [code-review, data-integrity]
dependencies: []
---

# Avatar Extension Change Orphans Old File in Storage

## Problem Statement

Avatar is stored as `avatars/{userId}.{ext}`. If a user uploads JPEG then PNG, the path changes from `.jpg` to `.png`. The `x-upsert: true` flag only overwrites files at the same key — the old `.jpg` file becomes orphaned.

## Findings

- **Data Integrity Guardian** (#9): MODERATE — old files accumulate

## Proposed Solutions

### Option A: Delete old avatar before uploading new one (Recommended)

Read current `avatar_url` from DB, delete that file from storage, then upload the new one.

- **Effort**: Small
- **Risk**: None

### Option B: Always convert to JPEG

Standardize on one format, always use `.jpg` extension.

- **Effort**: Small
- **Risk**: Low — slight quality loss for PNG originals

## Acceptance Criteria

- [ ] Re-uploading avatar does not leave orphaned files in storage

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | x-upsert only works for same key |
