Create a builder-facing iOS launch pre-flight checklist and execution brief for AI Notecards.

This is not meant to be a generic research summary. It must directly support:

- ongoing development
- local testing
- handoff readiness
- TestFlight readiness
- App Store submission readiness
- fastest path to first users and first revenue

You should use all completed research and project materials available to you, including the PRD / product docs / prior reports / launch notes / implementation notes.

You should treat this task as a synchronization and execution document, not just a checklist.

## Critical context

### Company

- Company name: Mint Apps
- AI Notecards is the first product
- Long-term goal: build Mint Apps into an app creation factory
- Immediate goal: make AI Notecards launchable, credible, useful, and capable of becoming profitable

### Current working reality

- Coding is currently being handled primarily by founder + ChatGPT + Codex
- Polsia is currently supporting with research, planning, strategy, audit, and launch preparation
- Polsia may collaborate more directly later, but is not yet the primary implementation engine
- Because of this, your output must help a currently-active builder make smart development decisions now
- Assume engineering time is limited
- Assume only 1 overnight task token per day is available, so prioritization matters a lot

### Current product intent

AI Notecards is intended to be:

- an AI-powered flashcard / study app
- users can generate study decks from notes, text, and photos
- users can study those decks across web and iOS
- the product should launch with a **full buyer-facing marketplace experience**
- that means users should be able to browse, evaluate, buy, access, and study marketplace decks
- the **seller-side marketplace scope is not fully locked**
- current leaning: seller creation/listing/onboarding may be delayed to a later version if needed
- do not assume seller marketplace must be fully in v1 unless evidence strongly suggests it is required
- do assume the buyer marketplace experience matters strategically and should be treated seriously

### Alignment requirements

I want this task to help ensure that Polsia and the builder side are aligned on:

- what the app is trying to launch as
- what must exist for launch credibility
- what can wait until later
- which goals are firm vs still flexible
- where research should change priorities and where it should not

### Source-of-truth context

Use the current project materials as grounding, especially:

- PRD.json
- project overview / README
- implementation notes / architecture notes
- prior launch-readiness notes
- marketplace feasibility research
- ASO / App Store / competitive research
- prior audit reports
- any existing docs that describe current app structure, flows, and launch plans

You should treat the PRD and current implementation docs as essential context, not optional background.

## What I want you to produce

Produce a single execution-oriented report that does all of the following:

### 1. Restate the current intended launch product

Give a concise but precise summary of:

- what AI Notecards is trying to launch as
- what the intended buyer marketplace scope is
- what the likely seller marketplace scope is for launch vs later
- which parts of the current vision appear firm
- which parts appear flexible / likely to shift

### 2. Translate current app structure into launch implications

Based on the current project structure and materials, explain:

- what major product areas already exist
- what major flows appear partly built vs fully needed
- what areas are most likely to create launch blockers
- what areas are overbuilt for now
- what areas are underbuilt for launch credibility

### 3. Produce a builder-facing pre-flight checklist

Organize into:

1. Must verify before local testing is considered trustworthy
2. Must complete before TestFlight
3. Must complete before App Store submission
4. Must complete before first paid user
5. Safe to defer until after launch

For every item include:

- exact task
- why it matters
- category: product / engineering / App Store / analytics / legal / payments / marketplace / growth / operations
- severity: blocker / high / medium / low
- estimated effort: XS / S / M / L
- recommended owner: founder / Codex / Polsia
- dependencies
- how to verify it is actually done

### 4. Separate launch-critical work from nice-to-have work

Make this explicit.
I want a clear distinction between:

- must-have for credible launch
- should-have soon
- not worth spending scarce time on yet

Call out anything that sounds attractive but is bad timing.

### 5. Account for the likely handoff path

Given that Polsia may become more collaborative later, explain:

- what condition the app/project should be in before deeper handoff makes sense
- what documents / checklists / repo state / testing state would create strong handoff condition
- what ambiguity should be removed now so future collaboration is smoother

### 6. Recommend the best use of scarce overnight research tokens

Based on all current knowledge:

- identify which types of future Polsia tasks are highest leverage
- identify which task types should wait
- recommend the single best overnight task after this one

## Important constraints

- Do not give generic startup advice
- Do not produce fluffy launch commentary
- Do not optimize for theoretical completeness
- Optimize for fastest path to:
  - trustworthy local testing
  - strong handoff condition
  - TestFlight
  - App Store submission
  - first users
  - first revenue
- Be skeptical
- Be concrete
- Use the current product intent, not an imagined simpler app
- But if the current scope is too large, say so clearly
- Treat buyer marketplace as a serious current goal
- Treat seller marketplace scope as important but still negotiable
- Distinguish clearly between:
  - what must launch now
  - what can launch later
  - what should maybe not be built yet at all

## Output format

# 1. Current launch-product alignment

# 2. Current app structure and launch implications

# 3. Builder-facing pre-flight checklist

# 4. Must-have vs should-have vs defer

# 5. Handoff-readiness recommendations

# 6. Best future overnight task use

# 7. Final blunt recommendation

End with:

- Best single next task for founder
- Best next task for Codex
- Best next use of the next overnight Polsia token
