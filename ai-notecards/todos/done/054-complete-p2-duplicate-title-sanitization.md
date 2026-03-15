---
status: pending
priority: p2
issue_id: "054"
tags: [code-review, security, sanitization, duplication]
dependencies: []
---

# Duplicate Title Needs Sanitization and Unicode-Safe Truncation

## Problem Statement

The duplicate endpoint constructs the title as `originalTitle.substring(0, 193) + ' (Copy)'` but:
1. No `striptags()` applied — source title could contain HTML if inserted via direct API call
2. No trim or non-empty check — whitespace-only titles produce `"    (Copy)"`
3. `substring(0, 193)` operates on UTF-16 code units — can split emoji/CJK surrogate pairs mid-character

The existing `PATCH /:id` rename endpoint also lacks `striptags()`, unlike the save endpoint.

## Findings

- **Security Sentinel:** MEDIUM — XSS-adjacent if titles ever rendered as HTML
- **Data Integrity Guardian:** MEDIUM — Unicode surrogate pair splitting

## Proposed Solutions

### Apply sanitization pipeline to duplicated title
```js
const striptags = require('striptags');
let title = striptags(sourceDeck.title).trim();
if (!title) title = 'Untitled';
// Unicode-safe truncation
const chars = Array.from(title);
if (chars.length > 193) title = chars.slice(0, 193).join('');
title += ' (Copy)';
```

Also add `striptags()` to the existing `PATCH /:id` rename endpoint for consistency.

**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] Duplicated titles have HTML stripped
- [ ] Duplicated titles are trimmed and non-empty
- [ ] Truncation does not split Unicode surrogate pairs
- [ ] `PATCH /:id` rename endpoint also applies striptags
