# Niche Report

Generate a comprehensive Go/No-Go research report for a niche candidate using data collected by the Python pipeline tools.

## Trigger

`/niche-report <niche-name>` or invoked automatically by `/niche-research`

## Inputs

| Field | Required | Description |
|-------|----------|-------------|
| `niche-name` | Yes | Name of the niche directory (e.g., "fodmap-tracking") |

The data directory is at `apps/research/niches/<niche-name>/data/`.

## Data Sources

Read ALL of these files before generating the report:

### Pipeline Data (JSON)
- `niches/<niche-name>/data/competitors.json` — Competitor apps from App Store
- `niches/<niche-name>/data/reviews.json` — App Store reviews for competitors
- `niches/<niche-name>/data/reddit_threads.json` — Reddit threads about the niche
- `niches/<niche-name>/data/trends.json` — Google Trends data
- `niches/<niche-name>/data/autocomplete.json` — App Store keyword suggestions + saturation
- `niches/<niche-name>/data/_pipeline_meta.json` — Tool execution metadata

### Reference Documents
- `apps/research/indie-ios-app-playbook.md` — $500K market sizing formula, validation criteria
- `apps/research/ios-app-marketplace-breakdown.md` — Category revenue data, benchmarks

## Workflow

### Step 1: Load Data

Read all JSON files from the niche data directory. Read `_pipeline_meta.json` to understand which tools succeeded and which failed. Note any data gaps.

Read both reference documents for market sizing formulas and category benchmarks.

### Step 2: Analyze Data

Perform these analyses on the raw data:

1. **Competitor landscape**: From `competitors.json` — count apps, avg rating, avg review count, pricing distribution, genre distribution, last updated dates
2. **Review complaint themes**: From `reviews.json` — categorize 1-3 star reviews into complaint themes (UX issues, missing features, bugs, pricing complaints, etc.). Identify the top 5 most common complaints.
3. **Demand signals**: From `reddit_threads.json` — identify ask patterns ("is there an app for...", "looking for...", "alternative to..."), sentiment toward existing solutions, unmet needs mentioned
4. **Trend direction**: From `trends.json` — report direction (growing/stable/declining), seasonality, related keyword opportunities
5. **Keyword opportunity**: From `autocomplete.json` — identify low-saturation keywords (opportunity signals), count of suggestions per seed keyword
6. **Market sizing**: Apply the $500K formula from the playbook using competitor review counts and category benchmarks

### Step 3: Generate Report

Write the report to `apps/research/niches/<niche-name>/report.md` using the Write tool.

## Report Template

```markdown
---
niche: <niche-name>
date: YYYY-MM-DD
score: <total>/25
verdict: GO | WEAK GO | NO-GO
---

# Niche Research Report: <Niche Name>

## Data Quality Summary

| Tool | Status | Records |
|------|--------|---------|
| App Discovery | success/failed | N apps |
| Review Miner | success/failed | N reviews |
| Reddit Miner | success/failed | N threads |
| Trends Checker | success/failed | — |
| Autocomplete | success/failed | N suggestions |

**Data gaps**: [List any failed tools and what this means for the analysis]
**Confidence level**: High (all tools) / Medium (1-2 failed) / Low (3+ failed)

## 1. Competitor Landscape

- **Total competitors found**: N
- **Average rating**: X.X
- **Average reviews**: N
- **Price distribution**: N free, N paid ($X-$Y range), N subscription
- **Top 5 competitors**:

| App | Rating | Reviews | Price | Last Updated |
|-----|--------|---------|-------|-------------|
| ... | ... | ... | ... | ... |

**Key insight**: [One sentence summary — e.g., "Market has many apps but average rating is 3.4, suggesting widespread user dissatisfaction"]

## 2. Review Pain Points

Analysis of [N] reviews (1-3 star) across top competitors:

| Theme | Frequency | Example Quote |
|-------|-----------|---------------|
| [e.g., Poor UX] | ~N mentions | "The interface is so confusing..." |
| [e.g., Missing feature X] | ~N mentions | "I wish it could..." |
| ... | ... | ... |

**Biggest opportunity**: [Which pain point is most actionable for a new app?]

## 3. Demand Signals (Reddit)

- **Threads found**: N across [subreddit list]
- **Common ask patterns**:
  - "Is there an app for [X]?" — N threads
  - "Looking for [X]" — N threads
  - "Alternative to [X]" — N threads
- **Sentiment toward existing solutions**: [Positive/Mixed/Negative]
- **Unmet needs mentioned**:
  - [Need 1 — evidence]
  - [Need 2 — evidence]

**Key quote**: "[Most telling Reddit quote about the unmet need]"

## 4. Search Trends

- **Direction**: Growing / Stable / Declining ([X]% change YoY)
- **Seasonality**: [Peak months and patterns, or "No strong seasonality"]
- **Related keywords**: [List of related queries that reveal adjacent opportunities]

## 5. Keyword Opportunities

| Keyword | Suggestions | Saturation | Signal |
|---------|-------------|------------|--------|
| [seed kw] | N | low/medium/high | [interpretation] |
| ... | ... | ... | ... |

**Best keyword opportunities**: [Low saturation keywords with decent search interest]

## 6. Market Sizing

**Bottom-up estimate** (using $500K formula):
- Estimated addressable market: [N] people
- Realistic App Store reach (year 1): [X]% = [N] downloads
- Conversion to subscriber: [X]% = [N] subscribers
- At $[X]/year = **$[N]/year revenue**

**Top-down validation**:
- Combined competitor review volume suggests [X] monthly active users
- Category benchmarks from marketplace breakdown: [relevant data]

**Verdict**: [Does the math support $500K/year potential?]

## 7. Competitive Moat Assessment

- **Can you be 2x better for a specific segment?** [Yes/No — explain]
- **Willingness to pay**: [Evidence from reviews/Reddit that users will pay]
- **Recurring problem?**: [Does this support subscription pricing?]
- **Defensibility**: [What would make your app hard to clone?]

## 8. Go/No-Go Scorecard

| Factor | Score (1-5) | Notes |
|--------|-------------|-------|
| Market demand | X | [Evidence] |
| Competition weakness | X | [Evidence] |
| Revenue potential | X | [Evidence] |
| Technical feasibility | X | [Evidence] |
| Personal fit | X | [Based on domain knowledge/community access] |
| **Total** | **X/25** | |

### Scoring Rubric
- **5**: Strong signal, clear evidence
- **4**: Good signal, some evidence
- **3**: Neutral, mixed signals
- **2**: Weak signal, concerning evidence
- **1**: Red flag, strong evidence against

### Verdict

- **21-25**: **STRONG GO** — High confidence, start validation immediately
- **16-20**: **GO** — Promising, worth validating with user conversations
- **11-15**: **WEAK GO** — Proceed with caution, significant risks
- **6-10**: **NO-GO** — Too many red flags, look elsewhere
- **1-5**: **HARD NO** — Move on

**Overall: [SCORE]/25 — [VERDICT]**

## 9. Recommended Next Steps

If GO:
1. [Specific validation step based on findings]
2. [Second validation step]
3. [Key differentiator to test]

If NO-GO:
1. [What would change the verdict]
2. [Adjacent niches worth exploring]
```

## Output

A markdown report at `apps/research/niches/<niche-name>/report.md` with all 9 sections, data-backed analysis, and a scored Go/No-Go verdict.
