---
date: 2026-03-12
topic: phase1-niche-discovery-automation
---

# Phase 1 Niche Discovery Automation

## What We're Building

An automated research pipeline that takes niche candidates and produces structured Go/No-Go reports. The system combines Python scraping tools for raw data gathering with Claude Code skills for analysis and report generation.

## Architecture: Modular Hybrid with Orchestrator

### Layer 1: Interactive Interview (Claude Code Skill + Template)

**Skill: `/niche-brainstorm`**
- Asks structured questions one at a time to extract domain expertise
- Builds candidate niche list collaboratively
- Saves answers to `apps/research/profiles/` as editable markdown (timestamped, can be revised and re-run)

**Template: `apps/research/templates/niche-brainstorm-template.md`**
- Standalone markdown with the same questions for manual completion
- Same output format as the skill — drop into `profiles/` when done

Both paths produce a candidate list that feeds into the research pipeline.

### Layer 2: Research Tools (Python — `apps/research/tools/`)

Five modular Python scripts, each outputting structured JSON:

| Tool | Input | Output | Priority |
|---|---|---|---|
| `app_discovery.py` | Niche keywords | Top 10-20 apps with IDs, names, ratings, review counts, pricing | Primary (runs first) |
| `review_miner.py` | App Store IDs (from app_discovery) | Complaint patterns, exact quotes, rating distributions | Primary |
| `reddit_miner.py` | Keywords, subreddit list (optional — auto-discovers if not provided) | Thread counts, ask patterns, sentiment, quotes | Primary |
| `trends_checker.py` | Keywords | Growth direction, seasonality, relative interest | Secondary |
| `appstore_autocomplete.py` | Seed keywords | Auto-complete suggestions, result quality assessment | Secondary |

**`app_discovery.py` runs first** — it searches the App Store for niche keywords and returns the competitor list that `review_miner.py` needs as input.

Raw data output goes to `apps/research/niches/<niche-name>/data/`. Each tool writes a JSON file:

| Tool | Output File | Key Fields |
|---|---|---|
| `app_discovery.py` | `competitors.json` | `[{app_id, name, rating, review_count, price, developer, genre, description}]` |
| `review_miner.py` | `reviews.json` | `[{app_id, app_name, rating, title, body, date, version}]` |
| `reddit_miner.py` | `reddit_threads.json` | `{subreddits_searched: [str], threads: [{title, url, subreddit, score, num_comments, date, body, top_comments: [{body, score}]}]}` |
| `trends_checker.py` | `trends.json` | `{keyword, direction, interest_over_time: [...], seasonality_notes}` |
| `appstore_autocomplete.py` | `autocomplete.json` | `[{query, suggestions: [str], result_saturation: "high/medium/low"}]` |

#### Tool Implementation Details (in execution order)

**`app_discovery.py` — App Store Search (runs first)**

Prerequisite for review mining. Searches the App Store for niche keywords and returns the top competitors. Uses the iTunes Search API:
```
https://itunes.apple.com/search?term={keyword}&country=us&entity=software&limit=20
```
- Returns app name, ID, rating, review count, price, developer, description, genre
- No auth required, stable public API
- The returned App Store IDs feed directly into `review_miner.py`

**`review_miner.py` — iTunes RSS/JSON Endpoint (depends on app_discovery)**

Uses Apple's undocumented but stable iTunes endpoint:
```
https://itunes.apple.com/{country}/rss/customerreviews/page={1-10}/sortBy=mostRecent/id={appId}/json
```
- 500 reviews per country (50/page × 10 pages), no auth required
- Start with US-only; multi-country (2,000-5,000 reviews) is a v2 optimization
- Returns structured JSON: rating, title, review text, date, app version
- 1-2 second delay between requests to avoid 403s
- Python library: `app-store-web-scraper` (futurice) for clean pagination, or `glennfang` fork for high-volume with built-in exponential backoff (~15k reviews)
- **Why not Playwright**: App Store web pages only render a handful of reviews; the data lives behind this API, not in rendered HTML. Browser automation is unnecessary overhead.

**`reddit_miner.py` — Two-Layer: Arctic Shift + PRAW (parallel with review_miner)**

*Subreddit discovery:*
- If no subreddit list provided, search a default set of app-recommendation subs: `AppRecommendations`, `SuggestAnApp`, `androidapps`, `iphone`, `ios`
- Also search niche-specific subs using Reddit's subreddit search API (`/subreddits/search?q={keyword}`) to find relevant communities
- The discovered subreddit list is included in the output JSON for transparency

*Layer A — Arctic Shift (historical backfill):*
- Free API at arctic-shift.photon-reddit.com
- Search by subreddit, date range, title/body text going back years
- No result cap like PRAW's 1,000 limit — ideal for sweeping historical queries
- Query patterns: "is there an app that", "looking for an app", "best app for", "alternative to"

*Layer B — PRAW (fresh/ongoing data):*
- Free tier: 100 requests/min (OAuth), registered at reddit.com/prefs/apps
- Multi-subreddit search via `+` syntax: `reddit.subreddit("AppRecommendations+SuggestAnApp+androidapps")`
- Full comment trees via `submission.comments.replace_more()`
- 1,000 result cap per query — manageable with targeted, niche-specific searches
- 200-400 full threads with comments per day without hitting limits

*Why not web scraping:* Reddit actively blocks scrapers (429s, CAPTCHAs), filed lawsuits against scraping services in Oct 2025. PRAW + Arctic Shift is more reliable and legally safer.

**`trends_checker.py` (parallel with above)** — TBD: `pytrends` or direct web fetching

**`appstore_autocomplete.py` (parallel with above)** — TBD: App Store search API endpoint research needed. Output should assess result saturation: are returned apps highly rated with many reviews (saturated market) or low-rated/sparse results (opportunity signal).

### Layer 3: Analysis & Report (Claude Code)

**Skill: `/niche-report`**

Reads all JSON files from `apps/research/niches/<niche-name>/data/` and the two reference docs:
- `apps/research/ios-app-marketplace-breakdown.md` — category revenue, saturation lists, conversion/retention benchmarks
- `apps/research/indie-ios-app-playbook.md` — $500K sizing formula, paywall strategy guidance

**$500K Market Sizing (applied per niche):**
```
potential_users × reach_pct (0.5-2%) = downloads
downloads × conversion_rate (category-specific: e.g., Health 35%, Entertainment 19%) = subscribers
subscribers × annual_price = gross_revenue
gross_revenue × 0.85 (Apple's 15% cut) = net_revenue
```
Category-specific conversion and retention rates come from the marketplace breakdown. Claude fills in `potential_users` estimate based on demand signals and competitor data.

**Go/No-Go Scoring Rubric (1-5 scale per factor, all equally weighted):**

| Factor | 1 (No-Go) | 3 (Neutral) | 5 (Strong Go) |
|---|---|---|---|
| Willingness to pay | Entertainment/casual, no precedent | Some paid apps exist | Professional/health, users already paying $5+/mo |
| Recurring problem | One-time need | Periodic use | Daily/weekly use, ongoing pain |
| 2x-better potential | Top apps rated 4.5+, few complaints | Mixed reviews, some gaps | Top apps below 4.0, consistent complaint patterns |
| Competition level | 100+ serious competitors | 20-50 competitors | <20 competitors, stale apps |
| Apple ecosystem leverage | No platform integration needed | Some widget/notification potential | Deep HealthKit/Shortcuts/Live Activities fit |

**Score thresholds:** 20+ = strong go, 15-19 = worth validating (Phase 2), below 15 = pass.

**Data gap handling:** If any tool returns empty/insufficient data, the report still generates but flags the gap explicitly (e.g., "Reddit: 0 threads found — niche may use different terminology or forums outside Reddit").

### Layer 4: Orchestrator

**Skill: `/niche-research <keyword-or-niche>`**

Execution order:
1. `app_discovery.py` — find competitor apps (must complete first)
2. In parallel: `review_miner.py` (using IDs from step 1), `reddit_miner.py`, `trends_checker.py`, `appstore_autocomplete.py`
3. `/niche-report` — Claude consumes all JSON, produces final report

Drops final report at `apps/research/niches/<niche-name>/report.md`

v2: `--from-profile <profile-name>` to batch-process candidates from a brainstorm profile (with `--limit` to cap API usage).

## Report Structure (per niche)

1. **Niche Summary** — audience, problem, why it's underserved
2. **Category Context** — App Store category, estimated category revenue, growth trend, saturation level
3. **Demand Signals (Primary)**
   - App Store review mining — top competitor complaints, exact user quotes, recurring "I wish..." patterns
   - Reddit/forum mining — thread counts, ask patterns, sentiment, exact quotes
4. **Demand Signals (Secondary)**
   - Google Trends — direction (growing/stable/declining), seasonality
   - App Store auto-complete — suggestions, result quality
5. **Competitor Landscape** — top 5-10 apps: ratings, review counts, update frequency, pricing model, complaint summary
6. **Oversaturation Check** — cross-reference against avoid/crowded lists from marketplace breakdown
7. **Market Sizing** — $500K formula with category-specific benchmarks (25% day-1 retention, category trial-to-paid rates)
8. **Monetization Fit** — recommended model, pricing range, hard vs soft paywall recommendation
9. **Go/No-Go Score** — weighted: willingness to pay, recurring problem, 2x-better potential, competition level, Apple ecosystem leverage

## Directory Structure

```
apps/research/
├── brainstorms/           # Design docs like this one
├── profiles/              # Brainstorm interview answers (editable)
├── templates/             # Blank templates for manual use
├── niches/
│   └── <niche-name>/
│       ├── report.md      # Final synthesized report
│       └── data/          # Raw JSON from Python tools
├── tools/                 # Python scraping/data scripts
│   ├── app_discovery.py
│   ├── review_miner.py
│   ├── reddit_miner.py
│   ├── trends_checker.py
│   ├── appstore_autocomplete.py
│   └── requirements.txt
├── indie-ios-app-playbook.md
└── ios-app-marketplace-breakdown.md
```

## Key Decisions

- **Hybrid Python + Claude**: Python for reliable, testable scraping; Claude for synthesis and scoring
- **Modular tools**: each research method is standalone, runnable individually or via orchestrator
- **Editable profiles**: interview answers persist as markdown so they can be reviewed, edited, and re-run
- **All four research methods built**: review mining and Reddit mining are primary; Google Trends and auto-complete are secondary
- **Reports include marketplace context**: category revenue, saturation checks, and conversion benchmarks from ios-app-marketplace-breakdown.md are baked into every report
- **App discovery via iTunes Search API**: public, no auth, returns top results with IDs/ratings/metadata — feeds into review miner
- **App Store reviews via iTunes JSON endpoint**: not Playwright — the API returns 500 reviews/country with no auth, structured JSON, and is stable since ~2020. Start with US-only (500 reviews); multi-country is a v2 optimization.
- **Reddit via Arctic Shift + PRAW**: not web scraping — Arctic Shift for historical backfill (years of data, no result cap), PRAW for fresh data (100 req/min free tier). Web scraping is legally risky and fragile.
- **Sentiment analysis via Claude**: use Claude to analyze Reddit comment sentiment during report generation (Layer 3), not a separate ML model — keeps the Python tools focused on data collection
- **Markdown reports**: no web UI needed — reports live as .md files in the niches directory

## Open Questions

- Google Trends: `pytrends` vs direct web fetching?
- App Store auto-complete: which endpoint/method to use?
- Reddit API registration: need to create a script-type app at reddit.com/prefs/apps before PRAW works

## Assumptions & Dependencies

- Reddit API free tier remains available for non-commercial/personal use
- iTunes RSS endpoint and Search API remain stable (undocumented but unchanged for years)
- Arctic Shift API remains free and accessible
- Claude Code skills can invoke Python scripts via Bash and read their JSON output

## Next Steps

→ Proceed to `/workflows:plan` for implementation details on each tool
