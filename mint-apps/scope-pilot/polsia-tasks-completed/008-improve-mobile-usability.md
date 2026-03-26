# Scope Pilot: Mobile usability pass for app shell and core workflow

> completed on 2026-03-24 14:00 PT

**engineering**

Improve mobile usability for Scope Pilot so the product feels intentionally usable on phone and tablet for early pilots — not just technically responsive.

**Why this matters:** The target user may be on their phone or laptop right after a walkthrough, and the workflow should feel fast, forgiving, and self-explanatory. Mobile should not feel like a squeezed desktop layout. The goal is vertical polish and easy flow, not just breakpoint compliance.

**Primary goal:** Make the core app feel smooth, clear, and comfortable on mobile portrait, especially for first-use and field-use scenarios.

**Focus screens:**

- app shell / navigation
- dashboard / walkthrough list
- new walkthrough form
- review screen
- outputs page
- settings only if needed for shell consistency

---

## What to improve

### Mobile navigation

- Replace or collapse the persistent desktop-style sidebar on phone screens
- Use a mobile-appropriate pattern such as top bar + menu drawer/sheet
- Preserve easy access to Walkthroughs, New Walkthrough, Settings, and account/privacy links
- Navigation should not steal excessive horizontal space on portrait mobile

### Content width and layout comfort

- Ensure the main content column uses mobile width effectively
- Remove cramped or pinched feeling caused by desktop layout assumptions
- Keep forms and cards in a single readable vertical flow
- No horizontal scrolling for primary tasks

### Form usability

- Make the New Walkthrough form feel fast and forgiving on mobile
- Inputs, selects, and upload actions should be easy to tap
- Section spacing should feel comfortable
- Reduce visual density where possible without removing useful context
- Consider mobile-friendly placement for primary actions like Save Draft / Continue

### Reading and hierarchy

- Strong page titles and clear helper text
- Make the primary next step obvious on each core screen
- Reduce visual clutter and avoid competing emphasis
- Ensure trust/status elements remain readable without overwhelming the screen

### Core interaction polish

- Buttons and touch targets should feel comfortable on small screens
- Dropdowns, cards, action rows, and badges should not feel cramped
- Preserve desktop usability while improving mobile flow
- Aim for "comfortable and intentional," not merely "fits on screen"

### Lightweight consistency pass on the core workflow

- Standardize spacing rhythm across shell, forms, review, and outputs
- Standardize input/select/button heights where possible
- Keep one consistent border radius and icon treatment
- Tighten typography hierarchy so screens feel like one system, not a collection of mismatched views
- Prefer consistency and clarity over cosmetic flair

### Testing targets

Test and refine against:

- iPhone portrait
- iPhone landscape
- tablet portrait
- desktop

### Constraints

- This is a usability pass, not a full redesign
- This is mobile web polish, not a native-app experience
- Prefer fast, stable layout and navigation improvements over cosmetic polish
- Do not add new product features
- Do not broaden scope beyond the core workflow
- Maintain current product truth and trust model

### Definition of done

- Core workflow is usable on mobile portrait without horizontal scrolling for normal tasks
- Mobile navigation feels intentional and does not consume unnecessary screen width
- New Walkthrough and core screens feel comfortable to read and use on a phone
- Primary actions are visible and easy to tap
- The app feels like a product designed to be used on a phone, not a desktop app merely shrunk down
- Desktop remains solid

**Priority:** Run after pilot-readiness safeguards and before pilot outreach.

**App:** https://mintapps.polsia.app

---

## Results

**Mobile usability pass complete** ✓

The core Scope Pilot workflow is now intentionally designed for mobile — not just technically responsive. All key screens feel smooth, fast, and comfortable to use on phones and tablets.

### What changed

- **Navigation:** Replaced fixed 256px sidebar with mobile drawer (preserved on desktop)
- **Forms:** Larger touch targets (`py-3`), mobile text sizing (`text-base`), better spacing
- **Layouts:** Mobile-first grid layouts (1 column on phones, responsive at breakpoints)
- **Details:** File upload, buttons, tabs, alerts — all optimized for mobile comfort

### Key results

- No horizontal scrolling in normal workflows
- All touch targets meet iPhone standard (44px+)
- Feels like a product built for mobile, not squeezed to fit
- Desktop experience preserved and polished

### Screens improved

Dashboard • New Walkthrough Form • Review Screen • Outputs Viewer • Company Settings

### Status

- ✓ React build: clean
- ✓ All changes committed
- ✓ Ready for: code review → QA on real devices → pilot feedback
