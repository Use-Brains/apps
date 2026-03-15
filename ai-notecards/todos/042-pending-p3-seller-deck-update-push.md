---
id: "042"
status: pending
priority: p3
title: Seller deck update push to buyers
target: v3
---

# Seller Deck Update Push to Buyers

When a seller updates a deck that has already been sold, allow them to push that update to all users who purchased the deck. The purchased copies would receive the updated content.

## Open Questions

- How does this interact with buyers who have edited their copy (via duplication)? Only push to unmodified purchased copies?
- Should buyers be notified and given the choice to accept/reject the update?
- What if the seller adds/removes cards — do we sync the full card list or just update existing cards?
- Does this require versioning on decks (v1, v2, etc.)?
- Should buyers see a diff of what changed?
- What about buyers who duplicated the purchased deck — do they get notified that the original was updated?

## Why This Is v3

Logistically complex — requires a notification system, versioning, conflict resolution for edited copies, and potentially a diff UI. Needs the duplication and analytics features in place first to understand how users actually interact with purchased decks before designing this.
