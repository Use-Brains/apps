# Scope Pilot: Generate bid package + outputs page

> completed on 2026-03-23 20:00 PT

**engineering**

Build the output generation layer — all 5 bid package outputs from approved extracted data, plus the tabbed outputs page.

**Depends on:** Structured extraction + review screen must be completed first.

---

## What to build

### Bid package generation endpoint

API route that takes a walkthrough ID (with approved extracted data) and generates all 5 outputs.

| #     | Output                     | Notes                                                                                 |
| ----- | -------------------------- | ------------------------------------------------------------------------------------- |
| **a** | **Scope of work**          | See prompt below.                                                                     |
| **b** | **Area-by-area checklist** | Save as structured JSON in `checklist_json`.                                          |
| **c** | **Proposal draft**         | Merge company defaults (tone, exclusions, terms, signature from `companies`).         |
| **d** | **Follow-up email**        | Short post–walkthrough email.                                                         |
| **e** | **Internal questions**     | Generate questions the team should resolve before sending the proposal to the client. |

**Prompts**

- **Scope of work** — _"You are drafting a professional commercial cleaning scope of work. Requirements: plain professional language, concise and credible, include recurring services and area-specific services, separate assumptions and exclusions, do not include pricing, do not overstate uncertain facts."_

- **Area-by-area checklist** — _"You are generating an area-by-area cleaning checklist from structured walkthrough data."_

- **Proposal draft** — _"You are drafting a first-pass commercial cleaning proposal. Constraints: no pricing unless explicitly provided, no generic marketing fluff, no fake specifics, 300 to 500 words."_

- **Follow-up email** — _"You are writing a short follow-up email after a site walkthrough for a commercial cleaning proposal."_

**Persistence & data rules**

- Persist all outputs to `bid_packages` with `version_number` (starts at `1`).
- Log each generation step in `generation_logs`.
- Drive every output from **approved** `extracted_walkthroughs` data — never from raw inputs alone.
- Include a **draft-only** marker/status on generated outputs.

### Versioning (regenerate)

- New `bid_packages` row with incremented `version_number`.
- Prior versions stay accessible.
- User can view and revert to any prior version.

### Outputs page (`/walkthroughs/:id/outputs`)

Tabbed UI:

- **Tabs:** Scope · Checklist · Proposal · Follow-up Email · Internal Questions

Per tab:

- Render generated content with **inline editing**.
- **Copy to clipboard** and **Regenerate** (creates a new version).
- **Last generated** timestamp.
- **Checklist** tab: render JSON as a readable grouped list.
- **Version** selector/indicator (current + history).
- **DRAFT** banner on all outputs — not final documents.
- **Loading** states while generation runs.

### Generation flow (review screen)

Triggered by **Approve and Generate**:

- Generate all 5 outputs in sequence (or parallel where possible).
- Show progress as each output completes.
- Redirect to the outputs page when finished.
- Handle partial failures: show completed outputs; allow retry on failures.

---

## Key constraints

- No pricing in any output unless the user explicitly provided it.
- Outputs are drafts that need human review — never present as final.
- Generate only from structured, **approved** data, not raw inputs alone.
- Apply company defaults (tone, terms, exclusions, signature) where relevant.
- Log everything in `generation_logs`.

**Tech:** Express API, AI text generation, React tabbed UI with Tailwind.

---

Results:

The full output generation layer is live at mintapps.polsia.app.

What's new:

"Approve & Generate" on the review screen now calls the AI and generates all 5 outputs: scope of work, area checklist, proposal draft, follow-up email, and internal questions
The outputs page shows a live progress grid as each output completes — no waiting on a full-screen loader
All outputs are inline editable, copyable to clipboard, and fully versioned — hit "Regenerate" to get a new version while keeping previous ones accessible
The checklist renders as a readable grouped list with checkboxes per area (not raw JSON)
A persistent DRAFT banner reminds reviewers these outputs require human review before sending
Generation reads from approved extracted data only — never raw inputs. Company defaults (tone, exclusions, terms, signature) are pulled in automatically where relevant.
