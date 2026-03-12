# Niche Brainstorm

Interactive interview to identify underserved app niches from your domain expertise, frustrations, and community involvement.

## Trigger

`/niche-brainstorm` or "help me brainstorm niche ideas"

## Inputs

No arguments required. The skill runs as an interactive interview.

## Workflow

### Step 1: Introduction

Say:

> I'll ask you 5-6 questions to uncover app niches where you have an unfair advantage. Answer with as much detail as you can — specific frustrations, communities, and workflows are more valuable than broad categories. I'll ask one question at a time.

### Step 2: Interview Questions

Ask these questions **one at a time**, waiting for the user's response before proceeding. After each answer, acknowledge the key insights before moving to the next question.

1. **Domain expertise**: "What industries or fields have you worked in? What frustrated you daily — tools that were clunky, processes that were manual, information that was hard to find?"

2. **Communities**: "What hobbies, interests, or communities are you deeply embedded in? Think subreddits, Discord servers, Facebook groups, forums you check regularly."

3. **Bad tools**: "What professional or personal tools do you use regularly that are terrible? Apps where you think 'someone could do this so much better'?"

4. **Unmet needs**: "What groups or communities are you part of where people frequently ask for solutions that don't exist? Where do people use spreadsheets, paper, or 'nothing' to solve a problem?"

5. **Personal pain points**: "What problem do YOU solve with a workaround — a spreadsheet, a notes app, a manual process — that really should be a dedicated app?"

6. **Follow-up** (based on most promising answers): Ask 1-2 targeted follow-up questions about the areas with the strongest signal. Probe for specifics: Who exactly has this problem? How many people? What do they currently do? Would they pay?

### Step 3: Synthesize Candidates

After the interview, analyze all answers and identify 3-7 candidate niches. For each:

- **Name**: A short, descriptive name
- **Target audience**: Who specifically has this problem
- **Pain point**: What frustrates them about current solutions (or lack thereof)
- **Why underserved**: Why existing apps don't solve this well
- **Keywords**: 3-5 search terms for App Store / Reddit research

### Step 4: Write Profile

Generate a timestamped profile markdown file:

**Path**: `apps/research/profiles/YYYY-MM-DD-<topic-slug>.md`

Use the Write tool to create this file with the following format:

```markdown
---
date: YYYY-MM-DD
topic: <topic-slug>
---

# Niche Brainstorm Profile

## Domain Expertise Areas
- [Key industries, fields, communities from the interview]

## Pain Points Identified
- [Specific frustrations and unmet needs, quoted from answers]

## Candidate Niches

### 1. **Niche Name**
- **Target audience**: [who]
- **Pain point**: [what frustrates them]
- **Why underserved**: [why existing solutions fail]
- **Opportunity signal**: [evidence of demand — community size, complaint frequency, etc.]
- **Keywords**: keyword1, keyword2, keyword3

### 2. **Niche Name**
[same structure]

...

## Next Steps

Research each candidate with:
- `/niche-research "keyword1"` — for Niche 1
- `/niche-research "keyword2"` — for Niche 2
- ...
```

### Step 5: Present Results

After writing the profile, tell the user:

> Profile saved to `apps/research/profiles/YYYY-MM-DD-<topic>.md`
>
> I identified **N candidate niches**. The most promising looks like **[top pick]** because [reason].
>
> To research any of these, run:
> - `/niche-research "keyword"` for each candidate

## Output

A markdown profile in `apps/research/profiles/` containing domain expertise notes, pain points, candidate niches with keywords, and ready-to-run research commands.
