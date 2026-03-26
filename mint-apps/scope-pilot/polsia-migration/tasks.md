# tasks.md

## Build goal
Ship a usable v1 of the walkthrough-to-bid copilot that lets a small commercial cleaning company submit walkthrough inputs, review extracted structured data, and generate a first-pass bid package.

## Product phases
1. Foundation
2. Intake pipeline
3. Extraction and review
4. Output generation
5. Settings and reuse
6. Polish and pilot readiness

---

## Phase 1: Foundation

### 1.1 Project setup
- [ ] Create Next.js app with TypeScript
- [ ] Set up Tailwind
- [ ] Set up shadcn/ui
- [ ] Configure ESLint and Prettier
- [ ] Create environment variable strategy for local and production
- [ ] Set up deployment target
- [ ] Add basic app shell and navigation

### 1.2 Database and auth
- [ ] Create Supabase project
- [ ] Run `supabase_schema.sql`
- [ ] Set up Supabase Auth
- [ ] Implement magic link sign-in
- [ ] Create session handling in app
- [ ] Add protected route middleware
- [ ] Add seeded dev company and user flow

### 1.3 Core types and validation
- [ ] Create shared TypeScript types for companies, walkthroughs, assets, extracted walkthroughs, and bid packages
- [ ] Add Zod schemas for walkthrough form input
- [ ] Add Zod schemas for AI extraction payloads
- [ ] Add Zod schemas for generated output payloads
- [ ] Create status enums for walkthrough lifecycle

### 1.4 Developer tooling
- [ ] Add logging utility
- [ ] Add error boundary strategy
- [ ] Add toast/notification system
- [ ] Add loading and empty states
- [ ] Add feature flag file for controlled rollout
- [ ] Add internal debug panel for AI payload inspection in dev

---

## Phase 2: Intake pipeline

### 2.1 Walkthrough creation flow
- [ ] Build dashboard page
- [ ] Build “new walkthrough” page
- [ ] Add form sections for client info, property info, service info, notes, and special requirements
- [ ] Add save draft action
- [ ] Add validation and inline form errors
- [ ] Add status badge system

### 2.2 File uploads
- [ ] Set up Supabase Storage buckets
- [ ] Implement audio upload
- [ ] Implement photo upload
- [ ] Add file type and size validation
- [ ] Add upload progress UI
- [ ] Store asset metadata in `walkthrough_assets`
- [ ] Add asset removal and replacement flow

### 2.3 Transcription pipeline
- [ ] Create server action or API route for transcription
- [ ] Send audio to transcription provider
- [ ] Save transcript to `walkthrough_transcripts`
- [ ] Handle transcription failure state
- [ ] Show transcript status in UI
- [ ] Allow transcript refresh/regeneration

### 2.4 Image observation pipeline
- [ ] Create server action or API route for image summarization
- [ ] Pass photo URLs to vision-capable model
- [ ] Save image observations into generation logs or intermediate payload
- [ ] Handle missing/low-quality image response gracefully
- [ ] Display image observation summary in review flow

---

## Phase 3: Extraction and review

### 3.1 Structured extraction
- [ ] Create extraction orchestrator
- [ ] Combine form fields, typed notes, transcript, image observations, and company defaults
- [ ] Run structured extraction prompt
- [ ] Validate model response against schema
- [ ] Save output to `extracted_walkthroughs`
- [ ] Save raw input/output in `generation_logs`
- [ ] Add retry path for extraction failures

### 3.2 Missing info and assumptions
- [ ] Run missing info prompt using extracted walkthrough data
- [ ] Merge assumptions and questions into extracted record
- [ ] Save output in `extracted_walkthroughs`
- [ ] Highlight high-priority missing items
- [ ] Separate confirmed facts from inferred facts

### 3.3 Review screen
- [ ] Build review page layout
- [ ] Add editable property summary card
- [ ] Add editable area list
- [ ] Add editable sitewide requirements section
- [ ] Add editable assumptions section
- [ ] Add editable missing information section
- [ ] Add editable clarification questions section
- [ ] Add confidence labels
- [ ] Add “approve and generate” action

### 3.4 Review UX quality
- [ ] Support inline editing for every extracted section
- [ ] Add regenerate extraction button
- [ ] Add regenerate one section button
- [ ] Add audit note showing what was inferred
- [ ] Add warning banner when key facts are missing
- [ ] Prevent generation if critical minimum fields are absent

---

## Phase 4: Output generation

### 4.1 Scope generation
- [ ] Implement scope generation action
- [ ] Use approved structured data only
- [ ] Validate generated content
- [ ] Save scope to `bid_packages`
- [ ] Add inline editing

### 4.2 Checklist generation
- [ ] Implement checklist generation action
- [ ] Save structured checklist JSON
- [ ] Render checklist in readable grouped UI
- [ ] Support inline edit for tasks and notes
- [ ] Support copy/export-friendly formatting

### 4.3 Proposal generation
- [ ] Implement proposal generation action
- [ ] Keep proposal within target length
- [ ] Support multiple tone presets later, but ship one default first
- [ ] Save proposal text to `bid_packages`
- [ ] Add inline editing

### 4.4 Follow-up email generation
- [ ] Implement follow-up email generation action
- [ ] Save email text to `bid_packages`
- [ ] Add inline editing
- [ ] Add one-click copy action

### 4.5 Internal questions output
- [ ] Generate internal questions to confirm before sending
- [ ] Save and render in output page
- [ ] Add copy action

### 4.6 Outputs page
- [ ] Build tabbed output page
- [ ] Add tabs for scope, checklist, proposal, email, and internal questions
- [ ] Add loading states per section
- [ ] Add regenerate single section action
- [ ] Add “copy all” actions where useful
- [ ] Add last generated timestamp
- [ ] Add package version display

---

## Phase 5: Settings and reuse

### 5.1 Company settings
- [ ] Build company settings page
- [ ] Add business identity fields
- [ ] Add sender signature fields
- [ ] Add default exclusions
- [ ] Add default terms
- [ ] Add proposal tone field
- [ ] Add common assumptions field
- [ ] Save to `companies` and `company_presets`

### 5.2 Presets
- [ ] Add named preset creation
- [ ] Add preset editing
- [ ] Add preset selection during walkthrough creation
- [ ] Merge preset data into prompt pipeline
- [ ] Add sensible default preset on first account setup

### 5.3 Reuse and history
- [ ] Show prior bid packages for a walkthrough
- [ ] Allow generating version 2, version 3, etc.
- [ ] Add “duplicate walkthrough” action
- [ ] Add “use previous proposal as context” option later
- [ ] Add history timeline for major actions

---

## Phase 6: Polish and pilot readiness

### 6.1 Reliability
- [ ] Run all 10 test cases through extraction
- [ ] Run all 10 test cases through full generation pipeline
- [ ] Review outputs manually for hallucinations
- [ ] Tighten prompts where confidence is too high
- [ ] Add fallback handling for malformed model JSON
- [ ] Add rate limit and timeout handling
- [ ] Add basic analytics events

### 6.2 UX polish
- [ ] Improve empty states
- [ ] Improve loading states
- [ ] Add success messaging after generation
- [ ] Add better copy-to-clipboard feedback
- [ ] Add mobile responsiveness for intake and review screens
- [ ] Add sample demo data button for first-time users

### 6.3 Pilot readiness
- [ ] Create sample walkthrough for demo account
- [ ] Create sample generated outputs for landing page
- [ ] Add simple onboarding copy
- [ ] Add lightweight privacy note for uploads
- [ ] Add support email/contact path
- [ ] Prepare founder-led concierge workflow docs

---

## AI implementation tasks

### Prompt orchestration
- [ ] Create prompt builder utilities
- [ ] Keep prompts versioned in code
- [ ] Separate system prompts from task prompts
- [ ] Add response schema enforcement
- [ ] Add logging for token usage and model chosen
- [ ] Add model fallback path

### Evaluation
- [ ] Create evaluation script for test cases
- [ ] Define rubric for extraction quality
- [ ] Define rubric for proposal quality
- [ ] Score outputs on missing info detection
- [ ] Score outputs on fake-confidence risk
- [ ] Store evaluation notes for iteration

---

## Nice-to-have after v1
- [ ] Branded PDF export
- [ ] DOCX export
- [ ] Pricing helper with user-entered assumptions
- [ ] Optional labor estimate assistant
- [ ] Multi-user team accounts
- [ ] Client records
- [ ] Search across previous walkthroughs
- [ ] CRM integration
- [ ] QuickBooks integration
- [ ] Win/loss feedback loop

---

## Recommended execution order

### Sprint 1
- [ ] Project setup
- [ ] Supabase setup
- [ ] Auth
- [ ] Walkthrough form
- [ ] File uploads

### Sprint 2
- [ ] Transcription
- [ ] Image observation
- [ ] Structured extraction
- [ ] Extraction persistence

### Sprint 3
- [ ] Review screen
- [ ] Missing info and assumptions
- [ ] Editing and approval flow

### Sprint 4
- [ ] Scope generation
- [ ] Checklist generation
- [ ] Proposal generation
- [ ] Follow-up email generation
- [ ] Outputs page

### Sprint 5
- [ ] Company settings
- [ ] Presets
- [ ] Versioning
- [ ] Reliability pass using test cases

### Sprint 6
- [ ] Landing page polish
- [ ] Demo walkthrough
- [ ] Analytics
- [ ] Pilot readiness

---

## Definition of done for v1
- [ ] User can sign in
- [ ] User can create a walkthrough
- [ ] User can upload audio and photos
- [ ] Audio can be transcribed
- [ ] Photos can be summarized
- [ ] Structured extraction is generated and editable
- [ ] Missing information is surfaced clearly
- [ ] Scope, checklist, proposal, email, and internal questions can be generated
- [ ] Outputs can be edited and copied
- [ ] Company defaults can be saved
- [ ] App works for all 10 test cases without major hallucination issues

---

## Founder operating tasks
- [ ] Find first 25 target cleaning companies
- [ ] Write outreach list with owner names and contact info
- [ ] Send first batch of outreach
- [ ] Book 5 discovery conversations
- [ ] Run 3 concierge pilots
- [ ] Capture real walkthrough examples
- [ ] Compare real inputs against current schema
- [ ] Improve prompts after each pilot
- [ ] Collect before/after time-to-bid feedback
- [ ] Ask pilot users what they would pay

---

## Notes
- Keep pricing out of v1 generation
- Treat missing info as a feature, not a bug
- Never hide uncertainty
- Optimize for trust and usefulness, not AI flash
