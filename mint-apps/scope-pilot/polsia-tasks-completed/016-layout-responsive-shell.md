# Scope Pilot: Responsive shell + UI cleanup pass from QA audit (desktop, tablet, mobile)

**engineering**

---

## Objective

Fix the layout and UI issues surfaced by the first-run QA audit so Scope Pilot feels intentionally usable and trustworthy across desktop, tablet, and mobile before any onboarding/tutorial work ships.

This is now the top-priority UI task. The founder wants to approve the live layout system first, before tutorial work or additional polish moves forward.

---

## Context

Earlier mobile work already aimed to make the app feel intentionally usable on phone and tablet, not like a desktop app shrunk down. The intended pattern was to replace or collapse the persistent desktop sidebar on phones and use a mobile-appropriate top bar + menu drawer/sheet. That goal was only partially achieved; the app shell is still breaking down on small screens and needs a fuller responsive pass.

This task should finish that job properly.

---

## Primary blocking issue from QA audit

**Mobile app shell / navigation still breaks on small screens**

- The current sidebar behavior still consumes too much horizontal space on phone-sized screens
- On a ~390px wide screen, the main workflow becomes truncated and uncomfortable
- Core product evaluation suffers because the content area is too narrow
- The shell should prioritize the workflow content, not the navigation chrome

---

## Required solution direction

Implement a responsive shell pattern by breakpoint:

### Desktop

- Keep a persistent sidebar if it still works well
- Preserve easy access to: Walkthroughs, New Walkthrough, Settings, Help, Privacy
- Tighten spacing and content-width consistency where needed, but do not redesign the desktop product

### Tablet

- Do not assume desktop shell behavior is automatically acceptable on tablet portrait
- Choose the layout that best preserves workflow usability: either a narrower persistent sidebar if truly comfortable, or the same collapsible / drawer behavior used on smaller breakpoints
- Prioritize readable content width over keeping desktop nav visible

### Mobile

- Remove the persistent desktop sidebar pattern on phone-sized screens
- Use a sticky top bar + hamburger/menu button
- Open navigation in a temporary drawer/sheet
- Drawer should close when: user selects a destination, user taps outside, user presses escape/back where supported
- Main content should use the full screen width by default
- No mini collapsed rail on phone
- No nav pattern that permanently steals horizontal space from the workflow

---

## Scope

This task includes:

### A. Responsive app shell

- Desktop / tablet / mobile navigation behavior
- Sticky mobile top bar
- Temporary drawer/sheet navigation on small screens
- Proper placement of Help and Privacy access in responsive nav
- Ensure navigation never overwhelms the core workflow

### B. Core layout cleanup across main screens

Review and refine the responsive layout of: dashboard / walkthrough list, new walkthrough form, review screen, outputs page, company settings only if needed for shell/layout consistency.

**Goals:** no horizontal scrolling in normal use, comfortable content width, readable cards/forms/tabs, obvious next-step actions, trust/status elements remain readable on all breakpoints.

### C. Output rendering cleanup

- Scope of Work and Proposal tabs must render clean formatted markdown/rich text, not raw markdown
- Preserve safe rendering / sanitization
- Preserve readability across desktop, tablet, and mobile
- Ensure headings, paragraphs, bullets, spacing, and line breaks feel professional
- Do not weaken draft/review-required truth indicators

### D. Privacy link / destination cleanup

- Investigate the broken privacy destination surfaced in QA
- If a privacy link points to a dead route, fix the route or point it to the correct valid destination
- If the intended behavior is an inline Privacy modal, make sure all Privacy entry points trigger that correctly
- Do not expand this into a full privacy policy build unless absolutely required for a working destination

### E. Lightweight consistency pass

Standardize where easy and low-risk: page header spacing, card spacing, form spacing, button/input heights, tab spacing, typography rhythm, empty-state spacing, trust/status badge readability, CTA visibility. This should make the product feel more like one coherent system across breakpoints.

---

## Design / UX principles

- Mobile should feel intentional, not squeezed
- Content first, navigation second
- Preserve product truth and trust model
- Keep the UI practical and calm for a small cleaning business owner
- Prefer clarity over flair
- Prefer stable, understandable patterns over clever patterns
- Do not add product features, change business logic, or broaden the promise of the product

### Important product truths to preserve

Do not weaken or obscure: outputs are drafts, human review is required, confirmed / inferred / missing distinctions where supported, sample/demo walkthrough labeling, support/contact visibility, privacy / recording-consent posture.

---

## Specific implementation expectations

**Responsive shell:** Desktop persistent sidebar allowed. Tablet: choose the behavior that best preserves content width. Mobile: sticky header + temporary drawer/sheet. Keep route titles/page titles clear. Ensure no accidental double-scroll or awkward nested scrolling.

**Dashboard:** Main value and next action obvious at all breakpoints. Sample/demo walkthrough clearly visible and labeled. "New Walkthrough" easy to find. Cards and tables/lists stack or compress cleanly.

**New Walkthrough:** Comfortable single-column flow on phone. File upload area tappable and readable. Save/continue actions visible and easy to tap. Privacy / recording-consent notice readable and reachable on mobile.

**Review screen:** Confirmed / inferred / missing information legible on narrow screens. Long sections stack cleanly. Action buttons don't crowd or wrap awkwardly. Hierarchy helps user review confidently before generating.

**Outputs page:** Tabs usable across breakpoints. Mobile-friendly tab treatment if necessary. Scope and Proposal content renders as clean formatted text. DRAFT / review-required messaging obvious. Copy / regenerate / version controls usable without clutter.

**Settings:** Only adjust if needed for consistency with the responsive shell and spacing system. Do not expand settings scope.

---

## Testing requirements

**Test and refine against:**

- desktop
- tablet portrait
- tablet landscape if it exposes different issues
- iPhone-width portrait (~390px)
- narrow mobile landscape only if it exposes meaningful layout problems

**Required QA checks after implementation:**

- no horizontal scrolling in normal workflow use
- app shell feels intentional at each breakpoint
- dashboard readable and useful on phone/tablet
- new walkthrough easy to use on phone
- review screen understandable on phone
- outputs page readable and trustworthy on phone
- help/privacy access reachable on all breakpoints
- privacy destination works
- markdown outputs render cleanly
- desktop remains solid

---

## Constraints

**Do NOT change:** business logic, database schema, API endpoints, auth flow, product positioning, trust model, seeded sample/demo behavior except where layout/display needs adjustment.

**Do NOT add:** onboarding wizard, tutorial system, new product features, major redesign work, full privacy policy experience unless required to fix a broken destination cleanly.

---

## Deliverable

Ship the responsive shell and UI cleanup to production, then verify live behavior on desktop, tablet, and mobile.

**Implementation report** (concise) should cover:

- what changed in the shell by breakpoint
- what changed on each core screen
- how the privacy destination was fixed
- how markdown rendering was fixed
- design tradeoffs made for tablet behavior
- any remaining non-blocking UI issues

---

## Definition of done

- mobile no longer shows a persistent desktop sidebar that steals most of the screen
- mobile uses sticky top bar + temporary drawer/sheet navigation
- tablet behavior is explicitly tuned, not accidental
- desktop remains strong
- core screens are usable without horizontal scrolling
- dashboard / new walkthrough / review / outputs feel comfortable at each target breakpoint
- Help and Privacy are reachable on all breakpoints
- privacy destination works without 404/broken behavior
- Scope of Work and Proposal render as clean formatted content, not raw markdown
- DRAFT / review-required truth remains visible
- changes are deployed and confirmed live in production
- founder can review layout confidently before tutorial work proceeds

---

## Links

- **Production:** [https://mintapps.polsia.app](https://mintapps.polsia.app)
- **Repo:** [https://github.com/Polsia-Inc/mintapps](https://github.com/Polsia-Inc/mintapps)
