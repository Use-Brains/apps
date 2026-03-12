# Niche Research

Orchestrator that runs the full niche discovery pipeline: keyword expansion, 5 data collection tools, and report generation.

## Trigger

`/niche-research <keyword-or-niche>` — e.g., `/niche-research "fodmap tracking"`

## Inputs

| Field | Required | Description |
|-------|----------|-------------|
| `keyword` | Yes | The niche keyword or phrase to research |

## Prerequisites

- Python venv set up: `apps/research/tools/.venv/`
- Reddit credentials configured (env vars or `~/.config/niche-research/reddit.env`)

## Workflow

### Step 1: Setup

1. Parse the keyword from the user's input
2. Generate a slug: use lowercase, hyphens, strip special chars (e.g., "FODMAP Tracking App" -> "fodmap-tracking-app")
3. Create the data directory: `apps/research/niches/<slug>/data/`
4. Set the tools directory: `apps/research/tools/`

### Step 2: Keyword Expansion

Generate 3-5 keyword variations from the input. Think about:
- Synonyms ("fodmap tracking" -> "fodmap tracker", "fodmap diet app")
- Adjacent terms ("ibs food tracker", "low fodmap app")
- User intent phrases ("gut health tracker")

Store the keyword list for passing to each tool.

### Step 3: Run Pipeline

Activate the venv and run each tool. Capture exit codes and timing.

```bash
cd apps/research/tools
source .venv/bin/activate
```

**Tool execution order:**

**3a. App Discovery** (must run first — review_miner depends on its output)
```bash
python app_discovery.py "kw1" "kw2" "kw3" --niche-dir ../niches/<slug>/data/
```

**3b. Review Miner** (only if competitors.json has results)
```bash
python review_miner.py --niche-dir ../niches/<slug>/data/
```

**3c. Reddit Miner** (independent — can run anytime)
```bash
python reddit_miner.py "kw1" "kw2" "kw3" --niche-dir ../niches/<slug>/data/
```

**3d. Trends Checker** (independent)
```bash
python trends_checker.py "kw1" "kw2" "kw3" --niche-dir ../niches/<slug>/data/
```

**3e. App Store Autocomplete** (independent, but shares iTunes rate limit with app_discovery — run after it)
```bash
python appstore_autocomplete.py "kw1" "kw2" "kw3" --niche-dir ../niches/<slug>/data/
```

**Recommended execution order**: 3a -> 3e -> 3b -> 3c -> 3d
(app_discovery first, then autocomplete uses same API so run next while rate limit resets, then review_miner which takes longest, then Reddit and Trends)

### Step 4: Record Pipeline Metadata

After all tools complete, write `_pipeline_meta.json`:

```python
{
    "pipeline_version": "0.1.0",
    "timestamp": "2026-03-12T14:30:00Z",
    "keywords": ["kw1", "kw2", "kw3"],
    "niche_slug": "<slug>",
    "tools": {
        "app_discovery": {"status": "success|failed", "duration_s": N, "error": "..."},
        "review_miner": {"status": "success|failed|skipped", "duration_s": N},
        "reddit_miner": {"status": "success|failed", "duration_s": N},
        "trends_checker": {"status": "success|failed", "duration_s": N},
        "appstore_autocomplete": {"status": "success|failed", "duration_s": N}
    },
    "total_duration_s": N
}
```

Use the Write tool to create this JSON file at `niches/<slug>/data/_pipeline_meta.json`.

### Step 5: Generate Report

Invoke the `/niche-report` skill:

```
/niche-report <slug>
```

Or manually: read all JSON files from `niches/<slug>/data/` plus the reference docs, and generate the report following the template in the niche-report SKILL.md.

### Step 6: Present Results

After the report is generated, display:

```
[niche-research] Pipeline complete for "<keyword>"
[niche-research] Data: apps/research/niches/<slug>/data/
[niche-research] Report: apps/research/niches/<slug>/report.md
[niche-research] Go/No-Go Score: X/25 (VERDICT)
```

## Error Handling

- **Per-tool failure**: If any tool exits with code 1, log it as "failed" in pipeline metadata and continue with the next tool. Never let a single tool failure stop the pipeline.
- **Zero app results**: If app_discovery finds no apps, set review_miner status to "skipped" and continue. The report will note "No direct App Store competitors found."
- **Rate limits**: Tools handle their own rate limiting internally. If a tool fails due to rate limiting, it writes partial output and exits with code 0.
- **Missing credentials**: If Reddit credentials are missing, reddit_miner will log a warning and attempt Arctic Shift only.

## Progress Output

As each tool runs, show its progress output to the user. The tools print `[tool_name] message` format to stdout.

Example session:
```
[niche-research] Researching: "fodmap tracking"
[niche-research] Keywords: fodmap tracker, fodmap diet app, ibs food tracker, low fodmap app, gut health tracker
[app_discovery] Searching App Store for: fodmap tracker
[app_discovery] Found 18 unique apps across 5 keywords
[appstore_autocomplete] Fetching suggestions for: fodmap tracker
[appstore_autocomplete] 12 suggestions found
[review_miner] Mining reviews for FODMAP Helper (1/10)...
[review_miner] Wrote 3200 total reviews
[reddit_miner] Searching 8 subreddits for 5 keywords
[reddit_miner] Total unique threads: 47
[trends_checker] Trend direction: growing
[niche-research] Pipeline complete. Generating report...
[niche-research] Report: apps/research/niches/fodmap-tracking/report.md
[niche-research] Go/No-Go Score: 21/25 (STRONG GO)
```

## Output

- JSON data files in `niches/<slug>/data/`
- Pipeline metadata in `niches/<slug>/data/_pipeline_meta.json`
- Research report at `niches/<slug>/report.md`
