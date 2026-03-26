# Merge mobile branch to main + favicon, 404 page, and metadata cleanup

> completed on 2026-03-24 16:00 PT

**engineering**

Bundle task: merge the completed mobile usability work and add three small pilot-facing polish items before pilot outreach.

**Goal:** Get the mobile usability improvements live in production and add a few small trust-facing finish details that improve first impressions without expanding scope.

---

## Merge and deploy

- Merge `feat/mobile-usability-pass` to `main`
- Deploy to production
- Confirm the mobile usability changes are live at https://mintapps.polsia.app
- Do not leave work sitting on a feature branch
- Verify the live app after deploy on both desktop and mobile viewport

## Favicon + page title

- Replace any default React/favicon/browser-tab branding with a simple, clean Scope Pilot favicon
- Update the default page title to: Scope Pilot — Walkthrough-to-Bid Copilot
- If route-level titles are easy to support, use clean route titles such as:
  - Dashboard | Scope Pilot
  - New Walkthrough | Scope Pilot
  - Review Walkthrough | Scope Pilot
  - Outputs | Scope Pilot
  - Settings | Scope Pilot
- Keep route titles simple and consistent

## 404 / not-found page

- Add a simple branded 404 page for unmatched routes
- Minimal, clean Tailwind styling
- **Message example:**
  - Page not found
  - short explanation
  - clear link/button back to dashboard or home
- Prevent blank screens or ugly default route failures
- If there is an app-level error/not-found boundary already available, use the simplest stable implementation

## Metadata for link previews and browser basics

- Add basic metadata so shared links have sensible previews and the browser tab feels branded
- **Include at minimum:**
  - page title
  - meta description
  - Open Graph title
  - Open Graph description
  - Twitter title
  - Twitter description
  - `theme-color` if easy
- Use conservative, truth-aligned copy

**Metadata copy:**

- **Title:** Scope Pilot — Walkthrough-to-Bid Copilot
- **Description:** Turn walkthrough notes, photos, and voice memos into a reviewable draft proposal package. Built for small commercial cleaning companies.

### Important messaging rules

- Keep messaging narrow and accurate
- Emphasize draft proposal generation and review-required workflow
- **Do not imply:**
  - automatic quoting
  - accurate pricing
  - autonomous bidding
  - compliance guarantees
  - final/send-ready outputs

### Constraints

- Do not add new product features
- Do not broaden this into a larger polish pass
- Do not redesign the UI
- Do not touch unrelated screens beyond what is needed for merge/deploy, favicon/title, 404, and metadata
- Merge to main and deploy — completion requires production release, not just a branch commit

### Definition of done

- `feat/mobile-usability-pass` is merged into `main`
- changes are deployed and live in production
- mobile usability changes are visible at https://mintapps.polsia.app
- favicon and browser tab branding are updated
- page title is correct and no longer uses default app branding
- unmatched routes show a simple branded 404 page with a clear path back
- shared links show a sensible title and description preview
- all changes are confirmed live on production, not just in the repo

**App:** https://mintapps.polsia.app

---

## Results

All four pilot-facing polish items are live at https://mintapps.polsia.app.

### What shipped

- **Favicon** — clean indigo clipboard SVG, visible in browser tabs and bookmarks
- **Page title** — Scope Pilot — Walkthrough-to-Bid Copilot (no more Vite defaults)
- **Route titles** — each page sets its own tab title: Dashboard, New Walkthrough, Edit Walkthrough, Review Walkthrough, Outputs, Settings
- **404 page** — branded not-found screen with a clear link back to the dashboard; no more blank screens on bad URLs
- **Metadata** — Open Graph + Twitter Card + meta description with your approved copy, so shared links preview cleanly

Mobile usability changes were already in `main` — nothing was left on a feature branch. Deploy finished in ~48s. Everything confirmed live.

---

## Self notes

This may have been a mistake on my part. I thought the improve-mobile-usability branch didn't merge all the way, but it did. It's just that it didn't fully fix the issue on a small mobile screen. The navbar on the right is still too big. We need a solution for this — maybe a **collapsible** navbar? Auto-collapses, and when a user goes to click it, it will expand the navbar; then the user can select an option on the navbar. So on smaller screens, the navbar would be collapsed by default. On bigger screens, it would not be collapsed by default. There can be a toggle near the bottom of the navbar that looks like a collapsible icon to toggle the default behavior.
