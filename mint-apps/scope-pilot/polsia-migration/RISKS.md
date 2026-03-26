# RISKS.md

## 1. Hallucination and fake-confidence risk
### Risk
The AI may confidently invent or overstate:
- room counts
- floor types
- included areas
- consumables assumptions
- service frequency suitability
- special requirements for clinics, schools, or other sensitive environments

### Why it matters
A polished but wrong proposal destroys trust quickly and can create real quoting mistakes.

### Mitigation
- separate confirmed vs inferred vs missing information
- require review before final output use
- show confidence labels
- surface clarification questions
- explicitly instruct prompts not to invent facts
- favor assumptions over false specificity

---

## 2. Poor input quality risk
### Risk
Users may upload:
- noisy audio
- blurry photos
- incomplete notes
- contradictory notes
- almost no structured details

### Why it matters
Weak inputs can create weak outputs and lead users to think the product itself is unreliable.

### Mitigation
- show upload quality and transcript status
- warn when input quality is low
- provide minimum-input guidance
- block generation only when inputs are unusably thin
- allow draft generation with visible limitations banner
- provide sample of what good input looks like

---

## 3. Scope creep risk
### Risk
Users will ask for:
- pricing
- scheduling
- inspections
- invoicing
- CRM
- staff apps
- route optimization

### Why it matters
This can pull the product into incumbent-feature territory and slow down launch.

### Mitigation
- maintain a written v1 scope
- enforce non-goals
- capture feature requests without building them
- optimize for the narrow after-walkthrough use case first

---

## 4. Positioning risk
### Risk
The product may be described too broadly, such as “AI janitorial software” or “automatic quoting.”

### Why it matters
This creates wrong expectations, lower trust, and harder sales conversations.

### Mitigation
- keep messaging narrow
- describe product as a walkthrough-to-bid copilot
- emphasize draft generation and review workflow
- avoid autonomy language

---

## 5. Legal / compliance overreach risk
### Risk
The system could imply:
- medical cleaning compliance
- infection-control adequacy
- government or school procurement readiness
- legal sufficiency of contract language

### Why it matters
Specialized spaces often have extra requirements that should not be guessed.

### Mitigation
- avoid compliance claims in prompts and UI
- add disclaimers for specialized environments
- keep output focused on operational proposal drafting
- require user confirmation for specialized requirements

---

## 6. Privacy risk
### Risk
The app may store:
- voice recordings
- client names and emails
- photos of workplaces
- internal site notes

### Why it matters
These can contain business-sensitive or personal information.

### Mitigation
- private storage by default
- authenticated access only
- deletion path for uploads and walkthroughs
- minimal retention mindset
- disclose third-party AI processing in policy materials
- avoid storing anything unnecessary

---

## 7. Recording-consent risk
### Risk
Users may upload recordings captured during walkthrough conversations without proper consent.

### Why it matters
Recording laws vary by jurisdiction and can create risk for users.

### Mitigation
- add upload acknowledgement that user is responsible for obtaining required consent
- avoid any marketing that encourages covert recording
- document this in terms or upload notice

---

## 8. Deceptive marketing risk
### Risk
Marketing could drift into unsupported claims like:
- guaranteed time saved
- guaranteed more wins
- accurate bidding
- autonomous quoting

### Why it matters
Unsupported AI claims create legal and trust risk.

### Mitigation
- use conservative language
- make only supportable claims
- treat testimonials carefully
- avoid guarantees without evidence
- align homepage claims with actual product behavior

---

## 9. Data security risk
### Risk
A rushed build could leave sensitive uploads or records exposed.

### Why it matters
Even early users expect basic security and privacy hygiene.

### Mitigation
- use private storage buckets
- keep secrets server-side
- use row-level security as appropriate
- avoid exposing raw provider keys
- log critical failures without leaking sensitive data

---

## 10. Evaluation blindness risk
### Risk
Without a repeatable evaluation process, prompt quality may look better in demos than in real usage.

### Why it matters
You may ship brittle quality and not notice until pilots fail.

### Mitigation
- keep 10 seed test cases
- add real walkthrough examples over time
- create a scoring rubric
- review outputs for fake confidence, omissions, and tone quality
- track edits users make after generation

---

## 11. Support burden risk
### Risk
As a solo founder, too much manual support can swamp build time.

### Why it matters
A high-touch onboarding model does not scale for a one-person operation.

### Mitigation
- keep onboarding simple
- make the workflow self-explanatory
- ship demo data
- reduce custom setup
- document common issues internally
- use concierge mode selectively for learning, not forever

---

## 12. Wrong-customer risk
### Risk
Early users may come from segments that are too complex or too demanding, such as:
- large janitorial firms
- highly regulated facilities
- buyers wanting a full operating system
- users demanding automatic pricing from day one

### Why it matters
These customers distort the roadmap and create product pressure before the core wedge is validated.

### Mitigation
- qualify first users carefully
- prioritize simple office and small commercial jobs
- avoid overfitting to edge cases early
- keep roadmap tied to the target ICP

---

## 13. Product value ambiguity risk
### Risk
It may be unclear whether customers care most about:
- speed
- polish
- consistency
- fewer missed details
- better close rates

### Why it matters
Ambiguity weakens pricing, messaging, and prioritization.

### Mitigation
- ask every early user what mattered most
- collect before/after workflow timing
- observe edits they make
- learn which output they value most

---

## 14. Dependency risk
### Risk
The app depends on transcription, vision, and text-generation providers.

### Why it matters
Provider outages, cost changes, or bad model regressions can break the workflow.

### Mitigation
- abstract provider calls behind service modules
- keep model fallback paths
- log model version and failures
- make regeneration possible
- budget for usage and monitor costs early

---

## 15. Founder drift risk
### Risk
The founder may keep polishing architecture instead of getting real walkthroughs through the product.

### Why it matters
This is the most common early-stage trap.

### Mitigation
- define v1 clearly
- prioritize live pilot usefulness over elegance
- run concierge pilots early
- improve product based on real walkthrough examples, not imagined future scale

---

## Immediate safeguards to include in v1
- draft-only banner on outputs
- confirmed / inferred / missing distinction
- upload consent acknowledgment for recordings
- delete walkthrough and asset capability
- private file storage
- internal logging of prompt and output versions
- conservative marketing language
