# Scope Pilot: Schema + app shell + auth + routing

> completed on 2026-03-23 16:00 PT

**engineering**

Build the foundation for Scope Pilot — an AI walkthrough-to-bid copilot for small commercial cleaning companies.

---

## What to build

### Database schema

Run the following schema on Neon (adapt for Polsia's Postgres setup). Create all tables: `companies`, `users`, `walkthroughs`, `walkthrough_assets`, `walkthrough_transcripts`, `extracted_walkthroughs`, `bid_packages`, `company_presets`, `generation_logs`. Use UUID primary keys with pgcrypto. Add `updated_at` triggers on `companies`, `users`, `walkthroughs`, `extracted_walkthroughs`, and `bid_packages`.

**Key tables and their purposes**

- **companies** — business identity + default proposal settings (tone, exclusions, terms, signature)
- **users** — linked to company, has role field
- **walkthroughs** — core record with client info, property details, typed notes, status lifecycle (draft → processing → review → generated)
- **walkthrough_assets** — audio/photo/doc uploads, references R2 file URLs, `asset_type` constrained to audio/photo/doc
- **walkthrough_transcripts** — transcription results linked to source asset
- **extracted_walkthroughs** — structured JSON extraction with typed JSONB columns: `property_summary`, `areas`, `sitewide_requirements`, `floor_care_notes`, `restroom_notes`, `trash_notes`, `security_access_notes`, `assumptions`, `missing_information`, `clarification_questions`, `extraction_confidence`
- **bid_packages** — versioned outputs (`version_number` integer): `scope_text`, `checklist_json`, `proposal_text`, `followup_email_text`, `internal_questions_text`
- **company_presets** — named reusable scenario configs (proposal style, exclusions, assumptions, email style, service terms)
- **generation_logs** — every AI pipeline step logged with `step_name`, `input_payload`, `output_payload`, `model_name`, `status`

### React app shell

Set up React frontend with Tailwind CSS. Create route structure:

- **`/`** — Landing page (placeholder for now)
- **`/dashboard`** — Walkthrough list (empty state with "New Walkthrough" button)
- **`/walkthroughs/new`** — New walkthrough form (placeholder)
- **`/walkthroughs/:id/review`** — Review extracted details (placeholder)
- **`/walkthroughs/:id/outputs`** — Generated outputs (placeholder)
- **`/settings/company`** — Company settings (placeholder)

### Auth

Wire up Polsia's built-in auth. Protected routes for everything except landing page.

### Navigation

Simple sidebar or top nav linking all routes. Clean, minimal Tailwind UI.

### Seed data

Create a dev company and user so the app is immediately usable after deploy.

**Tech stack:** Express + Postgres + React + Tailwind on Render, R2 for file storage, Polsia built-in auth.

**Product context:** Narrow B2B copilot. Target user is an owner/estimator at a 2-25 person commercial cleaning company. Converts messy walkthrough inputs (notes, photos, voice memos) into a draft bid package. All outputs are drafts requiring human review.

---

Results:

Scope Pilot is deployed and running at mintapps.polsia.app

Built the complete foundation in one shot:

9 database tables — walkthroughs, assets, transcripts, AI extractions, bid packages, presets, generation logs (all UUID PKs with pgcrypto)
React + Tailwind app with 7 routes — landing page, login/register, dashboard, walkthrough form, review page, outputs viewer, company settings
JWT auth with protected routes
Full CRUD API for walkthroughs and company settings
Demo account — demo@scopepilot.com / demo1234
Next up: File uploads (R2 integration), AI extraction pipeline, and bid generation.
