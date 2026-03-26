# Scope Pilot: Pilot readiness package — demo walkthrough, first-use guidance, privacy notice, and basic instrumentation

> completed on 2026-03-25 19:00 PT

**engineering**

**Type:** Engineering

---

## Objective

Prepare Scope Pilot for real pilot users. When a small commercial cleaning company owner logs in for the first time, they should immediately understand the product, see a realistic example, know how to start, and feel reasonably confident about how their data is handled.

This is a readiness package, not a redesign. Keep it minimal.

### Important product truths to preserve

The package must reinforce Scope Pilot's actual trust model:

- outputs are drafts
- human review is required
- missing information should be visible
- confirmed / inferred / missing distinctions should remain clear where applicable

Do not broaden the product promise.

---

## Preloaded sample walkthrough with full outputs

- Seed a realistic, complete example walkthrough visible to new users on first login
- Use a simple, high-fit scenario such as a 3-floor office building with recurring weekly cleaning
- **Use mixed inputs:**
  - typed notes
  - sample photos
  - a voice memo reference or transcript example
- **Show the full pipeline:**
  - walkthrough
  - extracted details / review
  - all output types
  - scope draft
  - area checklist
  - proposal draft
  - follow-up email
  - internal questions
- Mark clearly as demo/sample so it is never confused with real data
- Keep the demo walkthrough read-only or clearly separated from real walkthroughs
- **Ensure the sample experience visibly reinforces:**
  - draft-only status
  - review-required workflow
  - confirmed / inferred / missing distinctions where the UI already supports them

## Minimal first-use guidance

Add one short, contextual banner or callout when the demo walkthrough is visible.

**Suggested intent:**

- "This is a sample walkthrough showing what Scope Pilot generates from a real site visit."
- "Review the sample, then try your own walkthrough."

**Requirements:**

- dismissible
- no onboarding wizard
- no multi-step tour
- just one simple contextual prompt

## Obvious "New Walkthrough" CTA

- Make "New Walkthrough" prominent and accessible from the dashboard
- If the user is viewing the demo walkthrough or its outputs, include a clear CTA such as:
  - "Try with your own walkthrough"
- The path from demo → own first walkthrough should feel natural and obvious

## Lightweight upload privacy / recording-consent notice

Add a short, visible inline notice on the walkthrough creation or upload screen.

**It should cover:**

- uploaded files may include notes, photos, and audio
- uploads are processed by AI to generate draft outputs
- audio uploads may be transcribed by AI
- data is stored privately/securely within the product
- the user is responsible for obtaining any required consent before uploading recordings

**Requirements:**

- 2–4 sentences
- clear, honest, non-legalistic tone
- include a "Learn more" placeholder link if easy
- do not build a full privacy policy page right now

## Support / contact path

- Add one visible but non-intrusive support path for pilot users
- **Choose the simplest option:**
  - footer link
  - nav link
  - dashboard help/contact link
- Use a support identity aligned with Scope Pilot / MintApps, not Polsia infrastructure language
- Do not build a help center, FAQ, or chat widget

## Basic instrumentation

Add lightweight server-side event tracking for at least:

- `demo_viewed`
- `walkthrough_started`
- `review_reached`
- `outputs_reached`

If easy and low-risk, also add:

- `signup_completed` or `first_session_started`

**Implementation guidance:**

- server-side logging is fine
- a simple `events` or `activity_log` table is fine
- **fields can be minimal:**
  - `event_type`
  - `user_id`
  - `walkthrough_id` if applicable
  - timestamp
  - optional metadata JSON if already convenient
- no third-party analytics

## Keep the sample realistic and trust-aligned

The sample walkthrough and outputs should:

- look realistic and useful
- avoid pricing claims
- avoid compliance-heavy examples
- avoid implying final/send-ready documents
- feel like a real first-pass proposal package for a small commercial cleaning company

---

## Constraints

- Do not add product features beyond this spec
- Do not redesign existing screens or layouts
- Do not add an onboarding wizard or multi-step tour
- Do not build a full privacy policy page
- Do not integrate third-party analytics
- Keep all additions minimal and non-disruptive
- Stay within current v1 scope and messaging

---

## Definition of done

- Sample walkthrough with full pipeline outputs is seeded and visible on first login
- Demo is clearly labeled as sample data and separated from real walkthroughs
- Sample experience visibly preserves draft-only / review-required truth
- Confirmed / inferred / missing distinctions are visible where supported
- First-use guidance banner is visible and dismissible
- "New Walkthrough" CTA is prominent on dashboard and demo flow
- Upload privacy / recording-consent notice is visible on walkthrough creation or upload screen
- Support/contact path is visible and uses Scope Pilot-aligned identity
- Event tracking implemented for `demo_viewed`, `walkthrough_started`, `review_reached`, and `outputs_reached`
- Events are stored server-side in a queryable table
- Deployed to production at https://mintapps.polsia.app
- No new product features beyond this spec

**App:** https://mintapps.polsia.app

---

## Results

Shipped and live at https://mintapps.polsia.app. Here's what's in the pilot readiness package:

### Demo walkthrough labeling

The seeded sample now shows a SAMPLE badge on the dashboard with subtle indigo styling. It's fully read-only — delete and edit are blocked in the UI and on the server. Pilot users can explore it without accidentally touching it.

### First-use guidance banner

Dismissible dashboard banner: "This is a sample walkthrough — review it, then create your own." With a "New walkthrough →" CTA. Uses `localStorage` so it doesn't nag.

### Outputs page — demo mode

Sample outputs now show a read-only callout + "Try your own →" CTA. Regenerate and Edit buttons are disabled for demo walkthroughs.

### Upload privacy / recording-consent notice

Upgraded the upload gate to explicitly cover audio transcription, user responsibility for recording consent, and a "Learn more" link that opens the Privacy modal inline.

### Support link

Sidebar footer now shows Help (support@scopepilot.app) alongside Privacy — always visible, never intrusive.

### Event instrumentation

`pilot_events` now captures: `demo_viewed`, `outputs_reached`, `review_reached`, `signup_completed`, `walkthrough_started` — all server-side, queryable, no third-party analytics.
