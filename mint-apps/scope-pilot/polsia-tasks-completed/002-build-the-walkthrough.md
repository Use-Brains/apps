# Scope Pilot: Walkthrough intake form + file uploads + dashboard

> completed on 2026-03-23 17:00 PT

**engineering**

Build the walkthrough intake flow for Scope Pilot.

**Depends on:** Task #440810 (schema + app shell) must be completed first.

---

## What to build

### Dashboard page (`/dashboard`)

List all walkthroughs for the logged-in user's company. Show client name, property name, status badge, created date. "New Walkthrough" button. Empty state with helpful message for first-time users.

### New walkthrough form (`/walkthroughs/new`)

Multi-section form:

- **Client info:** `client_name`, `client_email`
- **Property info:** `property_name`, `property_type` (dropdown or free text), `square_footage`, `number_of_floors`
- **Service info:** `service_frequency` (dropdown: daily, 3x/week, 2x/week, weekly, custom), `occupancy_notes`
- **Requirements:** `special_requirements` (textarea)
- **Notes:** `typed_notes` (textarea for walkthrough observations)

**Save draft action** — saves to `walkthroughs` table with `status='draft'`

**Form validation** with inline errors for required fields (at minimum: `client_name`, `property_name`)

### File uploads

On the same form or as a next step:

- **Audio upload** (voice memos from walkthrough) — upload to R2, save metadata to `walkthrough_assets` with `asset_type='audio'`
- **Photo upload** (site photos) — upload to R2, save metadata to `walkthrough_assets` with `asset_type='photo'`
- Support multiple files per type
- **File type validation** (audio: mp3/m4a/wav/webm, photos: jpg/png/webp/heic)
- **File size limit** (suggest 25MB per file)
- Upload progress indicator
- Show uploaded files with ability to remove

### Status management

Walkthrough starts as `'draft'`. After form is complete with at least the minimum fields filled, user can submit to move to next pipeline stage.

**Product context:** Target user is a cleaning company owner on their phone or laptop right after a walkthrough. The form should be fast and forgiving — let them save partial drafts. They'll often have messy notes and phone photos/voice memos. Don't make them fill everything to save a draft.

**Tech:** Express API routes, React frontend, R2 for file storage, Postgres for metadata.

---

Results:

The full walkthrough intake flow is live at mintapps.polsia.app.

What shipped:

Multi-section walkthrough form (client info, property details, service frequency, notes)
Drag-and-drop file uploads for photos and voice memos (R2 storage, 25MB limit)
Save Draft (partial, no validation) vs Submit for Processing (validates required fields)
Edit mode with pre-populated form + existing files
Dashboard lists all walkthroughs with status badges and file counts
The form is intentionally forgiving — users can save drafts with zero fields filled, and uploading a file auto-saves the walkthrough. Built for a cleaning company owner on their phone right after a walkthrough.

Next up: The AI processing pipeline (transcription + structured extraction) to turn these inputs into bid packages.
