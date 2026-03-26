# Scope Pilot: Company settings + presets + defaults pipeline

> completed on 2026-03-23 21:00 PT

**engineering**

Build the company settings page and wire defaults/presets into the generation pipeline.

**Depends on:** Schema + app shell must be completed. Best built after or alongside bid package generation.

---

## What to build

### Company settings page (`/settings/company`)

Form with sections:

- **Business identity:** company name, email, phone, website, `logo_url`
- **Proposal defaults:**
  - `default_proposal_tone` (dropdown or text: professional, friendly, formal, etc.)
  - `default_exclusions` (textarea — common items excluded from scope, e.g., "exterior windows, carpet deep cleaning, pest control")
  - `default_terms` (textarea — standard service terms)
  - `default_signature` (textarea — closing signature block for proposals)
- Save to `companies` table
- Show success feedback on save

### Presets (lightweight v1)

- List existing presets from `company_presets`
- Create new preset with: `preset_name`, `proposal_style`, `default_exclusions`, `default_assumptions`, `default_email_style`, `default_service_terms`
- Edit existing presets
- Delete presets
- This is the "scenario layer" — e.g., "Medical Office" preset vs "Standard Office" preset
- v1 does NOT need preset selection during walkthrough creation — that comes later. For now, company-wide defaults are used automatically.

### Wire defaults into generation pipeline

- When generating bid package outputs, pull company defaults from `companies` table
- Inject into relevant prompts: proposal tone, exclusions, terms, signature
- If no defaults are set, generate without them (graceful fallback)

### First-run experience

- If company has no defaults set, show a gentle prompt on the settings page or dashboard: "Set up your company defaults to get better proposals"
- Seed a sensible default preset on first company creation (from schema task)

**Product context:** Most cleaning companies have standard exclusions and terms they copy-paste into every proposal. Capturing these once and auto-injecting them is a big time saver and makes outputs feel more "theirs" rather than generic AI.

**Tech:** Express API, React form, Postgres.

----

