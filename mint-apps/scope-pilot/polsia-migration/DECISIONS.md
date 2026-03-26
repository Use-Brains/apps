# DECISIONS.md

## Product
AI walkthrough-to-bid copilot for small commercial cleaning companies.

## v1 outcome
Help a small cleaning company go from messy walkthrough inputs to a reviewable first-pass bid package in minutes.

## Exact v1 scope
Included:
- authentication
- dashboard
- new walkthrough intake form
- audio upload
- photo upload
- typed notes
- transcription
- image observation summary
- structured extraction
- review/edit step
- missing information detection
- assumptions generation
- scope of work draft
- area checklist
- proposal draft
- follow-up email
- internal questions to confirm
- company defaults
- copy actions
- basic versioning for generated bid packages

Not included:
- pricing generation
- labor estimation
- PDF export
- DOCX export
- scheduling
- payroll
- timekeeping
- invoicing
- inspections
- CRM
- QuickBooks
- team permissions complexity
- mobile app
- integrations

## First customer
Best first customer:
- owner-led commercial cleaning company
- 2 to 25 cleaners
- does custom walkthrough-based quotes
- serves offices, clinics, or small commercial spaces
- already uses phone notes, voice memos, photos, and templates

## Narrow starting use case
Default for v1:
- office or small commercial property
- recurring cleaning
- after-walkthrough proposal drafting
- owner or office manager reviewing before sending

## Core promise
Turn walkthrough voice notes, photos, and property details into a draft cleaning scope, checklist, proposal, and follow-up email in minutes.

## Claims we can make
Allowed claims:
- saves admin time after walkthroughs
- turns messy walkthrough inputs into draft bid materials
- improves consistency and professionalism of first-pass proposals
- highlights missing information before sending
- works with existing workflow without replacing an ops stack

Claims we should not make:
- fully automatic quoting
- exact or accurate pricing
- guaranteed compliance
- guaranteed win-rate improvement
- autonomous bid sending
- replacement for human review
- exact site understanding from photos/audio alone

## AI boundaries
The AI is allowed to:
- summarize uploaded information
- infer likely room/task relationships when clearly marked
- generate draft proposal materials
- suggest assumptions
- identify missing information
- produce follow-up language

The AI is not allowed to:
- invent measurements, counts, frequencies, or specialized requirements
- claim pricing accuracy
- claim legal/compliance accuracy
- hide uncertainty
- send anything automatically
- make final inclusion/exclusion decisions without user review

## Trust model
Every important fact should be treated as one of:
- confirmed
- inferred
- missing / needs confirmation

UI and stored data should preserve that distinction wherever possible.

## Minimum input for generation
Minimum usable input for a draft package:
- property type
- at least one descriptive source: typed notes, transcript, or usable images
- some indication of requested service frequency or service intent
- some property size cue: square footage, rough scale, or number of floors/areas

If these are absent, generation should warn or block depending on severity.

## Generation rules
Block generation when:
- there is no meaningful site description at all
- the uploaded content is unreadable or empty
- there is no property type
- there is no usable input source after processing

Warn but allow generation when:
- square footage is missing
- frequency is missing
- room counts are uncertain
- floor type is uncertain
- consumables inclusion is unclear
- access schedule is unclear
- scope boundaries are unclear but assumptions can be stated

## Editing rules
- every major extracted section must be editable
- every generated output must be editable
- user always owns final proposal text
- user always owns exclusions
- user always owns pricing
- user always owns send decision

## Prompt architecture
Use a pipeline, not one giant prompt:
1. image observation
2. structured extraction
3. missing info / assumptions
4. scope generation
5. checklist generation
6. proposal generation
7. follow-up email generation

## Data retention direction
Initial direction:
- store assets privately
- keep only what is needed for product operation and debugging
- provide delete capability for walkthroughs and assets
- log AI version/prompt steps for debugging and quality review
- avoid storing unnecessary PII

## Manual review principle
Outputs are drafts. Human review is required before anything is sent externally.

## Product quality principle
Prefer incomplete but honest output over detailed but false output.

## Success metric
Primary:
- median time from walkthrough input to usable draft package

Secondary:
- repeat walkthrough usage
- percentage reaching generated output
- copy usage
- number of edits before final use
- user-reported time saved

## Founder operating principle
Do not expand scope until at least a few real users repeatedly use the core workflow with real walkthroughs.
