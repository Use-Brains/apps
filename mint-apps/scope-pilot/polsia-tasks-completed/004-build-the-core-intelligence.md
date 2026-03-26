# Scope Pilot: Structured extraction + review/edit screen

> completed on 2026-03-23 19:00 PT

**engineering**

Build the core intelligence layer — structured data extraction from walkthrough inputs, and the human review screen.

**Depends on:** Transcription + image observation pipeline must be completed first.

---

## What to build

### Structured extraction endpoint

API route that:

- Takes a walkthrough ID
- Gathers all inputs: form fields (from `walkthroughs`), typed notes, transcripts (from `walkthrough_transcripts`), image observations (from `generation_logs`), company defaults (from `companies`)
- Combines into a single context payload
- Runs the structured extraction prompt: _"You are a commercial cleaning walkthrough analyst. Convert the provided walkthrough information into structured data for proposal drafting. Rules: Extract only what is explicitly stated or reasonably inferred. Mark anything inferred as inferred. Do not invent facts. Include clarification questions where information is missing."_

**Expected output structure** (matching `extracted_walkthroughs` schema):

- `property_summary` (JSONB): overall site description
- `areas` (JSONB array): identified rooms/areas with details
- `sitewide_requirements` (JSONB array): requirements applying to whole site
- `floor_care_notes`, `restroom_notes`, `trash_notes`, `security_access_notes` (JSONB arrays)
- `assumptions` (JSONB array): things inferred but not confirmed
- `missing_information` (JSONB array): gaps that need filling
- `clarification_questions` (JSONB array): questions to ask the client
- `extraction_confidence` (JSONB): confidence scores per section

- Validates AI response against expected schema structure
- Saves to `extracted_walkthroughs` table
- Logs in `generation_logs` (`step_name='extraction'`)

### Missing info + assumptions pass

Run the assumptions prompt on extracted data: _"Identify: 1) high-priority missing information, 2) medium-priority missing information, 3) assumptions that should be stated, 4) questions to confirm before sending"_ Merge results into the `extracted_walkthroughs` record.

### Review screen (`/walkthroughs/:id/review`)

The critical human-in-the-loop page:

- Display all extracted sections in editable cards/panels
- **Confirmed vs Inferred vs Missing labels** — Each piece of information should be visually tagged with its confidence level (confirmed=from direct input, inferred=AI assumption, missing=not available)
- Editable property summary
- Editable area list (add/remove/edit areas)
- Editable sitewide requirements
- Editable assumptions section (user can confirm, modify, or reject assumptions)
- Missing information section highlighted prominently
- Clarification questions displayed clearly
- Warning banner when critical fields are missing (e.g., no square footage AND no area details)
- Block generation if inputs are unusably thin (per decisions doc: block only when truly minimal)
- "Regenerate extraction" button to re-run AI extraction
- "Approve and Generate" button to proceed to bid package generation
- Save edits back to `extracted_walkthroughs`

---

## Key constraints

- Every extracted fact must carry a confidence tag (confirmed/inferred/missing)
- Better to be incomplete than falsely specific
- Human review is required before generation — no auto-generate path
- All AI calls logged in `generation_logs`
- This is the highest-value screen in the product — it's where trust is built or broken.
