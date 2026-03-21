---
date: 2026-03-14
topic: account-settings-experience
---

<!-- FINISHED -->

# Account & Settings Experience

## What We're Building

A comprehensive account experience with three parts: (1) an avatar dropdown in the Navbar for quick navigation, (2) a Profile page combining user identity with study stats, and (3) an expanded Settings page for configuration, preferences, and account management.

## Why This Approach

The current Settings page mixes profile info with configuration. Splitting into Profile (who you are + your stats) and Settings (how the app behaves) follows the standard pattern users expect. The Navbar avatar dropdown provides persistent access to both without cluttering the navigation.

## Key Decisions

- **Avatar dropdown in Navbar**: Top-right, shows user's profile photo. Dropdown links: Profile, Settings, Seller Dashboard, Log out.
- **Google avatar auto-pull**: Use the user's Google profile photo when available (for Google auth users). Always allow manual upload as fallback/override.
- **Profile page (`/profile`)**: Combines identity (avatar, display name, email, plan badge) with study stats (total sessions, cards studied, accuracy, study score, session history, per-deck breakdown). Display name editing moves here from Settings.
- **Settings page restructured**: Purely configuration — no profile info. Sections:
  - **Security** — change password, connected accounts (Google linked status)
  - **Study Preferences** — card order (shuffle/sequential), auto-flip timing, dark mode toggle
  - **Notifications** — email preferences (study reminders, marketplace activity)
  - **Subscription** — current plan, upgrade/cancel (existing)
  - **Seller** — seller onboarding/status (existing)
  - **Data & Privacy** — export decks (download as JSON/CSV), delete account (danger zone with confirmation)
- **Study Stats on Profile**: Not a separate page. Session history and per-deck breakdowns live on the Profile page below the stats summary.
- **Dark mode**: Toggle lives in Settings under Study Preferences, not in the dropdown.

## Feature Details

### Navbar Avatar Dropdown

- Shows user's avatar (Google photo or uploaded) with fallback initials
- Dropdown menu items: Profile, Settings, Seller Dashboard, Log out
- Seller Dashboard link only shown for active sellers (or Pro users)

### Profile Page

- Avatar (editable), display name (editable), email (read-only), plan badge
- Study stats grid: study score, total sessions, cards studied, overall accuracy
- Session history table/list: date, deck title, score, accuracy per session
- Per-deck stats: times completed, best accuracy (from deck_stats table)

### Settings — Security

- Change password (current password + new password + confirm)
- Connected accounts: show Google linked status, option to link/unlink

### Settings — Study Preferences

- Card order: shuffle (default) or sequential
- Auto-flip timing: off (default), or 3s/5s/10s auto-reveal
- Dark mode toggle

### Settings — Notifications

- Email preferences: study reminders, marketplace activity (new ratings, purchases)
- Simple on/off toggles per category

### Settings — Data & Privacy

- Export decks: download all decks as JSON
- Delete account: danger zone, requires typing "DELETE" to confirm, irreversible

## Open Questions

- Should dark mode persist via localStorage or save to the user's DB record?
- Should notification preferences be stored in the users table or a separate preferences table?
- Should session history on Profile be paginated or infinite scroll?
- What avatar file size/format limits to enforce?

## Next Steps

→ `/workflows:plan` for implementation details
