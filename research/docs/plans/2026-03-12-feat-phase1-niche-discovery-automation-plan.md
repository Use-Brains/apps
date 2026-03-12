---
title: "Phase 1: Niche Discovery Automation Pipeline"
type: feat
status: active
date: 2026-03-12
deepened: 2026-03-12
origin: apps/research/brainstorms/2026-03-12-phase1-niche-discovery-automation-brainstorm.md
---

# Phase 1: Niche Discovery Automation Pipeline

## Enhancement Summary

**Deepened on:** 2026-03-12
**Sections enhanced:** 12
**Research agents used:** architecture-strategist, kieran-python-reviewer, performance-oracle, security-sentinel, spec-flow-analyzer, best-practices-researcher, pattern-recognition-specialist, code-simplicity-reviewer, create-agent-skills, Context7 (httpx, PRAW, pytrends-modern), 6 web searches

### Key Improvements
1. **Replace `pytrends` with `pytrends-modern`** — the original library breaks frequently; `pytrends-modern` has built-in retries, backoff, proxy rotation, and async support
2. **iTunes API rate limit is ~20 req/min** — plan's 1s delay is too aggressive; must use 3s+ delays
3. **Atomic writes need implementation** — plan mentions atomic writes but `write_json()` doesn't use temp+rename pattern
4. **Arctic Shift limitation** — can only do full-text search per-subreddit, not Reddit-wide; `BAScraper` is an async Python wrapper that handles this
5. **PRAW `search_by_topic` is dead** — returns 404 since 2020; use `subreddits.search()` instead
6. **`write_json()` should use atomic temp+rename** — current implementation risks corrupted JSON on crash

### New Considerations Discovered
- Consider `pytrends-modern` (Benchmark Score: 95.1) as drop-in replacement with exponential backoff and browser mode fallback
- MZSearchHints endpoint has no SLA — build fallback to iTunes Search API if it breaks
- Arctic Shift can't search Reddit-wide by keyword; must specify subreddits first, then search within them
- httpx has built-in retry via `HTTPTransport(retries=N)` — no need for manual retry loops
- PRAW script-type OAuth is simplest for CLI tools (just client_id, client_secret, username, password)
- Official Google Trends API launched 2025 (alpha) — monitor as future pytrends replacement

## Overview

Build an automated research pipeline that takes niche candidates and produces structured Go/No-Go reports. Five Python CLI tools handle data collection (App Store search, review mining, Reddit mining, Google Trends, auto-complete). Three Claude Code skills handle the user-facing workflow (brainstorm interview, report generation, orchestration). All tools output structured JSON; Claude synthesizes into scored markdown reports.

(see brainstorm: `apps/research/brainstorms/2026-03-12-phase1-niche-discovery-automation-brainstorm.md`)

## Problem Statement / Motivation

The indie app playbook's Phase 1 (Niche Discovery) requires manually mining App Store reviews, Reddit threads, Google Trends, and auto-complete suggestions across multiple candidate niches. This is 10-20 hours of repetitive research per niche. Automating it turns a 2-week manual process into a pipeline that runs in minutes per niche, producing consistent, comparable reports.

## Proposed Solution

A modular hybrid system: Python scripts for reliable data fetching, Claude Code skills for analysis and user interaction. Each tool is standalone (runnable individually) but composable via an orchestrator skill.

## Technical Approach

### Architecture

```
User
  │
  ├─ /niche-brainstorm ──→ profiles/<name>.md (candidate list)
  │                              │
  │                              ▼ (manual or future --from-profile)
  ├─ /niche-research <kw> ──→ Orchestrator
  │                              │
  │                    ┌─────────┼─────────────────────┐
  │                    ▼         │                     │
  │              app_discovery   │                     │
  │                    │         │                     │
  │         ┌──────────┼─────────┼──────────┐          │
  │         ▼          ▼         ▼          ▼          │
  │    review_miner reddit_miner trends  autocomplete  │
  │         │          │         │          │          │
  │         └──────────┼─────────┼──────────┘          │
  │                    ▼                               │
  │              /niche-report                         │
  │                    │                               │
  │                    ▼                               │
  └────────── niches/<name>/report.md                  │
```

### Research Insights — Architecture

**Best Practices:**
- The filesystem-based state approach is sound for a single-user CLI pipeline — no need for a database at this scale
- The fan-out pattern (app_discovery → parallel tools) is the right call; review_miner depends on competitors.json but the other 3 tools are independent
- Per-tool error isolation with `_pipeline_meta.json` is a well-established pattern in data pipelines

**Performance Considerations:**
- The orchestrator should use `subprocess.run()` for each tool (not `import` + direct call) to maintain true isolation and match the CLI contract
- Consider `asyncio.create_subprocess_exec()` for the parallel fan-out to avoid blocking on the slowest tool

**Edge Cases:**
- If a tool produces invalid JSON (e.g., crash during write), the report skill will fail to parse it — atomic writes are critical
- The orchestrator should validate that each tool's output JSON is parseable before marking it as "success" in pipeline metadata

### Conventions (from repo research)

All Python code follows trading-bot conventions:
- `from __future__ import annotations` at top of every file
- Module docstring explaining purpose
- `@dataclass` for structured config/data
- `logging.getLogger()` for output (not bare `print()` — except progress status lines to stdout)
- ruff-compatible: line-length 100, double quotes, space indent
- Narrow exception handling (no bare `except Exception`)
- Functions under 80 lines, orchestrator + sub-method pattern

### CLI Contract (all tools)

Every Python tool follows this interface:

```
python tool.py <positional-args> --niche-dir <path> [--tool-specific-flags]
```

- `--niche-dir`: required, path to `niches/<niche-name>/data/` where JSON is written
- Exit code 0 on success, 1 on failure
- On success: writes output JSON to `--niche-dir`
- On failure: writes partial JSON if possible, logs error to stderr
- Progress lines to stdout: `[tool_name] status message`

### Research Insights — CLI Design

**Best Practices:**
- argparse is the right choice for standalone scripts with zero external deps — Click/Typer would add unnecessary dependencies for simple tools
- Add `--verbose` / `-v` flag to all tools for debug logging (switch logger to DEBUG level)
- Add `--dry-run` flag to the orchestrator to show what would run without executing
- Each tool should print a JSON summary line on completion for machine-readable status: `{"tool": "app_discovery", "status": "success", "count": 18, "duration_s": 12.4}`

**Implementation Detail:**
```python
# Recommended argparse pattern for all tools
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("keywords", nargs="+", help="Search keywords")
    parser.add_argument("--niche-dir", required=True, type=Path, help="Output directory")
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    return parser

def main() -> int:
    args = build_parser().parse_args()
    logger = setup_logging("tool_name", verbose=args.verbose)
    try:
        # ... tool logic ...
        return 0
    except Exception:
        logger.exception("Fatal error")
        return 1

if __name__ == "__main__":
    sys.exit(main())
```

### Niche Name Normalization

Input keyword → slugified directory name:
- Lowercase, spaces to hyphens, strip non-alphanumeric (except hyphens)
- `"Knee Surgery Recovery"` → `knee-surgery-recovery`
- `"FODMAP Tracking App"` → `fodmap-tracking-app`
- Re-runs overwrite the existing `data/` directory

### Research Insights — Slugify Security

**Edge Cases to Handle:**
- Empty string after slugification → reject with clear error
- Very long keywords (>100 chars) → truncate slug to 80 chars to avoid filesystem issues
- Unicode input (e.g., emoji, CJK characters) → current regex strips these; consider `text-unidecode` for transliteration or just strip cleanly
- Path traversal via crafted input (e.g., `"../../etc"`) → the slugify function already strips slashes via `[^\w\s-]`, but validate the result doesn't start with `.` or contain `..`

```python
def slugify(text: str) -> str:
    """Convert text to a URL/directory-safe slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    slug = re.sub(r"-+", "-", text).strip("-")
    if not slug:
        raise ValueError(f"Cannot slugify empty or non-alphanumeric input: {text!r}")
    return slug[:80]  # Prevent filesystem issues with very long names
```

### Error Handling Strategy

The orchestrator catches failures per-tool and continues:

```python
results = {
    "app_discovery": {"status": "success", "count": 18},
    "review_miner": {"status": "success", "count": 4200},
    "reddit_miner": {"status": "failed", "error": "Arctic Shift API timeout"},
    "trends_checker": {"status": "success"},
    "appstore_autocomplete": {"status": "success", "count": 12}
}
```

This metadata is written to `niches/<name>/data/_pipeline_meta.json` and read by `/niche-report` to flag data gaps in the report.

Special case: if `app_discovery.py` returns zero results, skip `review_miner.py` but continue all other tools. The report flags this as "No direct App Store competitors found — niche may use different terminology."

### Research Insights — Error Handling

**Best Practices:**
- Add `"duration_s"` to each tool's metadata entry for performance tracking
- Add `"timestamp"` to `_pipeline_meta.json` so reports can show data freshness
- The orchestrator should also record the pipeline version and keyword list used

**Enhanced _pipeline_meta.json:**
```json
{
    "pipeline_version": "0.1.0",
    "timestamp": "2026-03-12T14:30:00Z",
    "keywords": ["fodmap tracking", "fodmap diet app", "ibs food tracker"],
    "tools": {
        "app_discovery": {"status": "success", "count": 18, "duration_s": 12.4},
        "review_miner": {"status": "success", "count": 4200, "duration_s": 165.2},
        "reddit_miner": {"status": "failed", "error": "Arctic Shift API timeout", "duration_s": 30.0},
        "trends_checker": {"status": "success", "duration_s": 8.1},
        "appstore_autocomplete": {"status": "success", "count": 12, "duration_s": 22.7}
    },
    "total_duration_s": 238.4
}
```

### Implementation Phases

#### Phase 1: Foundation

Set up the project structure, shared utilities, and Python environment.

**Files to create:**

- `apps/research/tools/pyproject.toml`

```toml
[project]
name = "niche-research-tools"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "httpx>=0.27",
    "praw>=7.7",
    "pytrends-modern>=0.1",
]

[tool.ruff]
line-length = 100
target-version = "py310"

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "B", "C4", "SIM", "ARG", "PIE", "Q", "RET", "RUF"]
```

### Research Insights — Dependencies

**Critical Change: Replace `pytrends` with `pytrends-modern`**

`pytrends` (GeneralMills) is notoriously unreliable — it breaks frequently when Google changes backend endpoints or cookie policies. `pytrends-modern` (Context7 Benchmark Score: 95.1) is a maintained fork with:
- Built-in retries with exponential backoff (`retries=5, backoff_factor=0.5`)
- Proxy rotation support
- `TooManyRequestsError` exception for clean error handling
- Async support via `AsyncTrendReq`
- Browser mode fallback (via Camoufox) when API is blocked
- User agent rotation (`rotate_user_agent=True`)

```python
from pytrends_modern import TrendReq
from pytrends_modern.exceptions import TooManyRequestsError

pytrends = TrendReq(
    retries=3,
    backoff_factor=0.5,
    timeout=(10, 25),
    rotate_user_agent=True,
)
```

**Also consider adding `tenacity`** for retry logic in the other tools (httpx has built-in retries for connection errors, but not for HTTP 403/429 responses).

- `apps/research/tools/shared.py` — shared utilities

```python
"""Shared utilities for niche research tools."""
from __future__ import annotations

import json
import logging
import re
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path


def slugify(text: str) -> str:
    """Convert text to a URL/directory-safe slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    slug = re.sub(r"-+", "-", text).strip("-")
    if not slug:
        raise ValueError(f"Cannot slugify empty or non-alphanumeric input: {text!r}")
    return slug[:80]


def setup_logging(tool_name: str, *, verbose: bool = False) -> logging.Logger:
    """Configure logging for a tool."""
    logging.basicConfig(
        format=f"[{tool_name}] %(message)s",
        level=logging.DEBUG if verbose else logging.INFO,
        stream=sys.stdout,
    )
    return logging.getLogger(tool_name)


def write_json(data: dict | list, path: Path) -> None:
    """Write data as formatted JSON atomically (temp + rename)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_fd, tmp_path = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with open(tmp_fd, "w") as f:
            json.dump(data, f, indent=2, default=str)
        Path(tmp_path).replace(path)
    except BaseException:
        Path(tmp_path).unlink(missing_ok=True)
        raise


@dataclass
class NicheDir:
    """Manages the niche data directory."""
    base_path: Path

    def __post_init__(self) -> None:
        self.base_path.mkdir(parents=True, exist_ok=True)

    def json_path(self, filename: str) -> Path:
        return self.base_path / filename
```

### Research Insights — Shared Utilities

**Improvements applied to code above:**
- `write_json()` now uses atomic temp+rename pattern — prevents corrupted JSON on crash/interrupt
- `setup_logging()` accepts `verbose` parameter for debug mode
- `slugify()` validates non-empty result and truncates to 80 chars

**httpx Client Pattern:**

Consider adding a shared httpx client factory to `shared.py`:
```python
import httpx

def create_http_client(*, timeout: float = 30.0, retries: int = 2) -> httpx.Client:
    """Create an httpx client with retry transport and reasonable defaults."""
    transport = httpx.HTTPTransport(retries=retries)
    return httpx.Client(
        transport=transport,
        timeout=httpx.Timeout(timeout, connect=10.0),
        headers={"User-Agent": "NicheResearchTools/0.1"},
        follow_redirects=True,
    )
```

This ensures consistent timeout/retry behavior across all tools and avoids repeating configuration.

**Tasks:**
- [ ] Create `apps/research/tools/pyproject.toml` with dependencies and ruff config
- [ ] Create `apps/research/tools/shared.py` with `slugify()`, `setup_logging()`, `write_json()`, `NicheDir`, `create_http_client()`
- [ ] Create venv: `cd apps/research/tools && python3 -m venv .venv`
- [ ] Install deps: `source .venv/bin/activate && pip install -e .`
- [ ] Add `.venv/` to `.gitignore`
- [ ] Verify ruff runs clean: `ruff check .`

#### Phase 2: Primary Tools (app_discovery + review_miner + reddit_miner)

**2a: `app_discovery.py`**

Uses two iTunes APIs:
1. Search API: `https://itunes.apple.com/search?term={kw}&country=us&entity=software&limit=25`
2. Lookup API: `https://itunes.apple.com/lookup?id={id}` — for `last_updated` date (not in search results)

Accepts multiple keywords (the orchestrator generates 3-5 variations via Claude). Deduplicates by app ID across keyword searches.

```
python app_discovery.py "keyword1" "keyword2" ... --niche-dir <path> [--country us] [--limit 25]
```

Output: `competitors.json`
```json
[
    {
        "app_id": 123456,
        "name": "App Name",
        "developer": "Dev Co",
        "rating": 4.2,
        "review_count": 1847,
        "price": 0.0,
        "genre": "Health & Fitness",
        "description": "...",
        "last_updated": "2026-01-15",
        "icon_url": "https://...",
        "keywords_matched": ["keyword1", "keyword2"]
    }
]
```

**Tasks:**
- [ ] Create `apps/research/tools/app_discovery.py`
- [ ] Implement iTunes Search API client with httpx
- [ ] Implement iTunes Lookup API for `last_updated` enrichment
- [ ] Multi-keyword search with deduplication by `app_id`
- [ ] Sort results by `review_count` descending (most-reviewed = most relevant competitors)
- [ ] **3-second delay between API calls** (iTunes rate limit is ~20 req/min)
- [ ] Test with a known niche keyword (e.g., "habit tracker")

### Research Insights — iTunes Search API

**Critical: Rate Limit is ~20 requests/minute**

The [iTunes Search API documentation](https://performance-partners.apple.com/search-api) states approximately 20 calls per minute. The plan's original 1-second delay (= 60 req/min) is 3x too aggressive and will trigger rate limiting.

**Recommended approach:**
- Use 3-second delay between requests (= 20 req/min exactly)
- Implement exponential backoff on 403 responses: wait 10s, then 30s, then fail
- Batch Lookup API calls: the endpoint accepts up to 200 comma-separated IDs in a single request (`?id=123,456,789`), so enrichment can be done in 1-2 calls instead of N

```python
# Batch lookup — reduces N calls to ceil(N/200) calls
def batch_lookup(app_ids: list[int], client: httpx.Client) -> dict[int, dict]:
    """Fetch app details in batches of 200 (iTunes Lookup API limit)."""
    results = {}
    for i in range(0, len(app_ids), 200):
        batch = app_ids[i:i + 200]
        id_str = ",".join(str(aid) for aid in batch)
        resp = client.get(f"https://itunes.apple.com/lookup?id={id_str}")
        resp.raise_for_status()
        for item in resp.json().get("results", []):
            results[item["trackId"]] = item
        time.sleep(3)
    return results
```

**Edge Cases:**
- Some apps have no ratings (new apps) — handle `None` for rating/review_count fields
- The Search API returns up to 200 results (not just 25) — consider increasing `--limit` for broader coverage
- Results may include non-app content (podcasts, etc.) — filter by `kind == "software"`
- Description field can be very long — consider truncating to first 500 chars in the JSON output

**2b: `review_miner.py`**

Reads `competitors.json` from `--niche-dir` to get app IDs. Fetches reviews via iTunes RSS endpoint.

```
python review_miner.py --niche-dir <path> [--max-apps 10] [--country us]
```

Uses: `https://itunes.apple.com/{country}/rss/customerreviews/page={1-10}/sortBy=mostRecent/id={appId}/json`

Output: `reviews.json`
```json
[
    {
        "app_id": 123456,
        "app_name": "App Name",
        "rating": 2,
        "title": "Missing feature X",
        "body": "I wish this app would...",
        "date": "2026-02-10",
        "version": "3.4.1"
    }
]
```

**Tasks:**
- [ ] Create `apps/research/tools/review_miner.py`
- [ ] Read `competitors.json` from niche-dir, take top N apps by review_count (default 10)
- [ ] Implement iTunes RSS/JSON pagination (10 pages × 50 reviews per app)
- [ ] 1.5-second delay between page fetches to avoid 403
- [ ] Retry logic: on 403, back off 5s and retry once
- [ ] Log progress: `"Mining reviews for App Name (1/10)... 350 reviews fetched"`
- [ ] Test with a real app ID

### Research Insights — iTunes RSS Reviews

**Endpoint Reliability:**
- The JSON endpoint (`/json` suffix) remains functional as of 2026, though the XML variant has had issues
- Hard limit: 10 pages × 50 reviews = **500 reviews max per app** — this is an API limitation, not configurable
- Without throttling, the endpoint starts slowing responses and eventually returns 403s
- The 1.5-second delay in the plan is reasonable, but add exponential backoff: 403 → wait 5s → retry → 403 → wait 15s → retry → fail

**Implementation Details:**
- The RSS JSON response wraps reviews in `feed.entry` — handle the case where `entry` is a single dict (1 review) vs a list (multiple reviews)
- Some pages may return empty (no more reviews) — stop pagination early when `entry` is missing
- Filter by `sortBy=mostRecent` to get the freshest complaints (most relevant for niche analysis)
- Consider also fetching `sortBy=mostCritical` (lowest-rated) separately — these contain the richest pain point data for niche opportunity analysis

**Edge Case:**
- Apps with very few reviews may have fewer than 10 pages — handle gracefully when a page returns no entries
- Some apps may have reviews disabled — the endpoint returns a valid but empty response

**2c: `reddit_miner.py`**

Two-layer approach: Arctic Shift (historical) + PRAW (recent).

```
python reddit_miner.py "keyword1" "keyword2" ... --niche-dir <path> [--subreddits sub1,sub2] [--months 12]
```

If `--subreddits` not provided, searches default set (`AppRecommendations`, `SuggestAnApp`, `androidapps`, `iphone`, `ios`) plus auto-discovers niche-specific subs via Reddit's subreddit search.

Query patterns applied to each keyword:
- `"{keyword} app"`
- `"is there an app" {keyword}`
- `"looking for" {keyword} app`
- `"best app for" {keyword}`
- `"alternative to" {keyword}`

Output: `reddit_threads.json`
```json
{
    "subreddits_searched": ["AppRecommendations", "SuggestAnApp", "ADHD", "..."],
    "threads": [
        {
            "title": "Is there an app for tracking FODMAP foods?",
            "url": "https://reddit.com/r/...",
            "subreddit": "ibs",
            "score": 47,
            "num_comments": 23,
            "date": "2025-11-03",
            "body": "...",
            "top_comments": [
                {"body": "I've been using X but it's terrible because...", "score": 31}
            ]
        }
    ]
}
```

**Tasks:**
- [ ] Create `apps/research/tools/reddit_miner.py`
- [ ] Implement Arctic Shift API client (`arctic-shift.photon-reddit.com`) for historical search
- [ ] Implement PRAW client for recent threads (last 30 days)
- [ ] Subreddit auto-discovery via `reddit.subreddits.search(query)` (NOT `search_by_topic` — returns 404 since 2020)
- [ ] Query pattern expansion (5 patterns × N keywords)
- [ ] Deduplicate threads by URL across sources and queries
- [ ] Fetch top 5 comments per thread (sorted by score)
- [ ] Log progress: `"Searching r/ADHD... 12 threads found"`
- [ ] Handle PRAW auth: read credentials from `~/.config/niche-research/reddit.env` or env vars
- [ ] Test with a known niche (e.g., "ADHD planner")

### Research Insights — Reddit Mining

**Arctic Shift API Limitations (Critical):**
- Arctic Shift **cannot do Reddit-wide full-text search** — it can only do FTS within a specific subreddit or user ([source](https://github.com/ArthurHeitmann/arctic_shift))
- This means you must know which subreddits to search first, then query Arctic Shift per-subreddit
- For Reddit-wide keyword search, use PRAW's `reddit.subreddit("all").search(query)` instead
- Consider [BAScraper](https://github.com/maxjo020418/BAScraper) — an async Python wrapper for both Arctic Shift and PullPush APIs with built-in rate limit management

**Recommended Approach (revised):**
1. Use PRAW `subreddits.search(keyword)` to discover relevant subreddits (this works)
2. Use PRAW `subreddit("all").search(query, sort="relevance", time_filter="year")` for broad Reddit-wide search
3. Use Arctic Shift API for deep historical mining within discovered subreddits (>1 year old)
4. Deduplicate across both sources

**PRAW Authentication (script type):**
```python
import praw

reddit = praw.Reddit(
    client_id="YOUR_CLIENT_ID",
    client_secret="YOUR_CLIENT_SECRET",
    username="YOUR_USERNAME",
    password="YOUR_PASSWORD",
    user_agent="NicheResearchTools/0.1 by u/YOUR_USERNAME",
)
```

**PRAW Rate Limiting:**
- PRAW handles rate limits automatically (Reddit allows ~100 requests/minute for OAuth)
- Check `reddit.auth.limits` for remaining quota
- The `user_agent` string is important — Reddit may throttle generic user agents

**Credential Security:**
- Use `~/.config/niche-research/reddit.env` with restrictive permissions (chmod 600)
- Never log or include credentials in JSON output
- Support both env vars (`REDDIT_CLIENT_ID`, etc.) and env file, with env vars taking precedence

#### Phase 3: Secondary Tools (trends_checker + appstore_autocomplete)

**3a: `trends_checker.py`**

Uses `pytrends-modern` (maintained fork of pytrends with built-in retries and error handling).

```
python trends_checker.py "keyword1" "keyword2" ... --niche-dir <path> [--timeframe today 12-m]
```

Output: `trends.json`
```json
{
    "keywords": ["fodmap tracking", "ibs diet app"],
    "timeframe": "2025-03-12 2026-03-12",
    "direction": "growing",
    "interest_over_time": [
        {"date": "2025-03", "fodmap tracking": 45, "ibs diet app": 23},
        {"date": "2025-04", "fodmap tracking": 52, "ibs diet app": 28}
    ],
    "related_queries": ["fodmap app", "low fodmap recipes", "..."],
    "seasonality_notes": "Peaks in January (New Year resolutions) and September (back-to-routine)"
}
```

Note: Google Trends is rate-limited. If it fails, the tool writes a minimal JSON with `"status": "rate_limited"` and the pipeline continues.

**Tasks:**
- [ ] Create `apps/research/tools/trends_checker.py`
- [ ] Implement pytrends-modern `interest_over_time` query with retries
- [ ] Compute direction: compare last 3 months average vs prior 3 months (growing/stable/declining)
- [ ] Extract related queries for additional keyword ideas
- [ ] Add seasonality detection (identify months with >1.5x average interest)
- [ ] Graceful failure on rate limit: write partial result with status field
- [ ] Test with trending and stable keywords

### Research Insights — Google Trends

**Why `pytrends-modern` over `pytrends`:**

The original `pytrends` library [breaks frequently](https://meetglimpse.com/software-guides/pytrends-alternatives/) because Google quietly changes endpoints and cookie policies. `pytrends-modern` addresses this with:

```python
from pytrends_modern import TrendReq
from pytrends_modern.exceptions import TooManyRequestsError

pytrends = TrendReq(
    hl="en-US",
    tz=360,
    timeout=(10, 25),
    retries=3,
    backoff_factor=0.5,
    rotate_user_agent=True,
)

try:
    pytrends.build_payload(["fodmap tracking", "ibs diet app"], timeframe="today 12-m", geo="US")
    df = pytrends.interest_over_time()
except TooManyRequestsError:
    # Write partial result with status flag
    write_json({"status": "rate_limited", "keywords": keywords}, niche_dir.json_path("trends.json"))
```

**Important Constraints:**
- Max 5 keywords per `build_payload()` call — plan's 3-5 keyword variations fit within this limit
- Add a 2-second polite delay between requests
- The `related_queries()` method returns "top" and "rising" queries — both are valuable for keyword discovery
- Async mode (`AsyncTrendReq`) only supports 1 keyword at a time — use sync mode for multi-keyword comparison

**Alternatives to Monitor:**
- Google launched an [official Google Trends API](https://meetglimpse.com/google-trends-api/) in 2025 (alpha stage) — structured data, but limited endpoints and quotas
- SerpApi and Glimpse API are reliable paid alternatives if pytrends-modern also breaks

**3b: `appstore_autocomplete.py`**

Uses the App Store search suggestions endpoint (undocumented but stable):
```
https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?term={keyword}&media=software
```

```
python appstore_autocomplete.py "keyword1" "keyword2" ... --niche-dir <path>
```

Output: `autocomplete.json`
```json
[
    {
        "query": "fodmap",
        "suggestions": ["fodmap tracker", "fodmap diet", "fodmap food list", "..."],
        "result_saturation": "low",
        "saturation_detail": "Top 3 results: avg rating 3.2, avg reviews 89. Low competition signal."
    }
]
```

Saturation scoring: for each suggestion, run a quick iTunes Search API query and assess the top 3 results:
- **High**: avg rating >4.3 AND avg reviews >5000 (well-served market)
- **Medium**: avg rating 3.5-4.3 OR avg reviews 1000-5000
- **Low**: avg rating <3.5 OR avg reviews <1000 (opportunity signal)

**Tasks:**
- [ ] Create `apps/research/tools/appstore_autocomplete.py`
- [ ] Implement search suggestions endpoint
- [ ] For each suggestion, run a lightweight iTunes Search query (limit=3) for saturation scoring
- [ ] **3-second delay between requests** (shares iTunes rate limit budget)
- [ ] Test with various keyword stems

### Research Insights — App Store Autocomplete

**MZSearchHints Endpoint Reliability:**
- This is an [undocumented Apple endpoint](https://github.com/dgurney/mzsearchhints) with no SLA — Apple could change or disable it without notice
- A Go library ([dgurney/mzsearchhints](https://github.com/dgurney/mzsearchhints)) wraps it, confirming it's been stable for years
- The endpoint also supports a `/wa/trends` path for trending searches (potential v2 feature)

**Fallback Strategy:**
- If MZSearchHints returns errors, fall back to iTunes Search API with short keyword prefixes (e.g., "fodm", "fodma", "fodmap") to simulate autocomplete behavior
- Log a warning when falling back so the report can note reduced autocomplete coverage

**Saturation Scoring Refinement:**
- The saturation scoring uses the same iTunes Search API as `app_discovery.py` — be mindful of the shared 20 req/min rate limit
- Consider caching Search API results: if `app_discovery.py` already fetched results for similar keywords, reuse that data instead of re-querying
- The saturation thresholds (rating >4.3, reviews >5000) are reasonable starting points but should be calibrated per category — Health & Fitness has different norms than Productivity

#### Phase 4: Claude Code Skills

**4a: `/niche-brainstorm` skill**

Location: `apps/research/skills/niche-brainstorm/SKILL.md`

Interactive interview that asks structured questions one at a time:
1. What industries have you worked in? What frustrated you daily?
2. What hobbies or communities are you deeply embedded in?
3. What professional tools do you use that are terrible?
4. What groups are you part of that have unmet needs?
5. What problems do you solve with spreadsheets, paper, or "nothing"?
6. (Follow-ups based on answers)

Output: writes a timestamped profile to `apps/research/profiles/YYYY-MM-DD-<topic>.md`

```markdown
---
date: 2026-03-12
topic: domain-expertise-interview
---

# Niche Brainstorm Profile

## Domain Expertise Areas
- [answers to industry/hobby/community questions]

## Pain Points Identified
- [specific frustrations and unmet needs]

## Candidate Niches
1. **Niche Name** — brief description, target audience, why underserved
2. **Niche Name** — ...
3. ...

## Keywords Per Niche
- Niche 1: keyword1, keyword2, keyword3
- Niche 2: ...
```

**Tasks:**
- [ ] Create `apps/research/skills/niche-brainstorm/SKILL.md` following OpenClaw SKILL.md format
- [ ] Define question sequence with branching logic
- [ ] Define output format (profile markdown)
- [ ] Test the skill interactively

### Research Insights — Skill Design

**Best Practices for Claude Code Skills:**
- Skills should be self-contained — include ALL instructions in the SKILL.md, don't rely on external context
- Use clear section headers: `## Trigger`, `## Inputs`, `## Workflow`, `## Output`, `## Examples`
- The brainstorm skill should use `AskUserQuestion` tool for the interview loop, not freeform conversation
- Include explicit stop criteria: "After 5 questions or when the user says 'done', generate the profile"
- The profile's `## Keywords Per Niche` section is the key handoff to `/niche-research` — ensure keywords are formatted as a clean comma-separated list that can be copy-pasted

**Skill → Tool Handoff:**
- The profile markdown should include a "Next Steps" section with ready-to-run commands: `Run /niche-research "keyword1" for each candidate above`
- This makes the brainstorm → research flow explicit and copy-pasteable

**4b: `/niche-brainstorm` template**

Location: `apps/research/templates/niche-brainstorm-template.md`

Same questions as the skill but as a fillable markdown document. User fills it out manually, saves to `profiles/`.

**Tasks:**
- [ ] Create `apps/research/templates/niche-brainstorm-template.md`
- [ ] Mirror the skill's question structure and output format

**4c: `/niche-report` skill**

Location: `apps/research/skills/niche-report/SKILL.md`

Reads all JSON from `niches/<niche-name>/data/` plus:
- `apps/research/ios-app-marketplace-breakdown.md` (category revenue, saturation lists, benchmarks)
- `apps/research/indie-ios-app-playbook.md` ($500K formula, paywall guidance)
- `niches/<niche-name>/data/_pipeline_meta.json` (tool success/failure status)

Produces `niches/<niche-name>/report.md` with the 9-section structure from the brainstorm.

Key analysis steps:
1. Categorize review complaints into themes (Claude analysis of reviews.json)
2. Extract demand signals from Reddit threads (sentiment, ask patterns)
3. Apply $500K market sizing formula with category-specific benchmarks
4. Score each Go/No-Go factor 1-5 using the rubric
5. Flag any data gaps from pipeline metadata

**Tasks:**
- [ ] Create `apps/research/skills/niche-report/SKILL.md`
- [ ] Define the full report template with all 9 sections
- [ ] Specify how each JSON file maps to report sections
- [ ] Include the Go/No-Go scoring rubric inline
- [ ] Include the $500K formula with category benchmarks inline
- [ ] Test with sample JSON data

### Research Insights — Report Generation

**Best Practices:**
- The report skill will process potentially large JSON files (reviews.json could be 5000+ reviews at ~500 chars each = 2.5MB) — consider having the skill summarize in batches or use the Python tools to pre-aggregate
- Include a "Data Quality" section at the top of the report that summarizes pipeline metadata: which tools succeeded, which failed, data freshness
- The Go/No-Go score should be presented as both a total (e.g., 21/25) and per-factor breakdown for transparency
- Include "Confidence Level" alongside the score: High (all tools succeeded), Medium (1-2 tools failed), Low (3+ tools failed)

**Edge Case — Large Review Sets:**
- If reviews.json exceeds Claude's comfortable processing range, pre-filter to 1-2 star reviews only (these contain the richest pain point data)
- Or add a pre-processing step in the Python pipeline that extracts review themes using simple keyword frequency analysis, saving Claude from processing raw review text

**4d: `/niche-research` orchestrator skill**

Location: `apps/research/skills/niche-research/SKILL.md`

Full execution flow:

1. Accept `<keyword-or-niche>` from user
2. Slugify to niche name, create `niches/<niche-name>/data/`
3. Use Claude to generate 3-5 keyword variations from the input
4. Run `app_discovery.py` with all keyword variations
5. If competitors found: run `review_miner.py` in parallel with steps 6-8
6. Run `reddit_miner.py` with keyword variations
7. Run `trends_checker.py` with keyword variations
8. Run `appstore_autocomplete.py` with keyword variations
9. Write `_pipeline_meta.json` with tool statuses
10. Invoke `/niche-report` to generate final report
11. Display report location and Go/No-Go score summary

Progress output:
```
[niche-research] Researching: "fodmap tracking"
[niche-research] Generated keywords: fodmap tracker, fodmap diet app, ibs food tracker, low fodmap app, gut health tracker
[app_discovery] Searching App Store... found 18 apps
[review_miner] Mining reviews for MyFitnessPal (1/10)... 420 reviews
[reddit_miner] Searching r/ibs... 8 threads found
[trends_checker] Google Trends: growing (+23% YoY)
[appstore_autocomplete] 14 suggestions, 9 low-saturation
[niche-report] Generating report...
[niche-research] ✓ Report: apps/research/niches/fodmap-tracking/report.md
[niche-research] Go/No-Go Score: 21/25 (STRONG GO)
```

**Tasks:**
- [ ] Create `apps/research/skills/niche-research/SKILL.md`
- [ ] Define keyword expansion prompt (Claude generates variations)
- [ ] Define execution order with dependency handling
- [ ] Define error handling: per-tool catch, continue, log to _pipeline_meta.json
- [ ] Define progress output format
- [ ] Test end-to-end with a real niche

### Research Insights — Orchestrator

**Parallelization Strategy:**
- The orchestrator runs tools via Bash (subprocess). For the parallel fan-out (steps 5-8), use separate Bash calls or `asyncio.create_subprocess_exec()`
- In a Claude Code skill context, the simplest approach is sequential Bash calls — the skill can't easily run true parallel subprocesses
- **Alternative**: the orchestrator skill could invoke each tool with `&` (background) and `wait`, but capturing individual exit codes and output becomes complex
- **Recommended**: run tools sequentially but time-box each one. The bottleneck is `review_miner` (~2.5 min for 10 apps). Total sequential time: ~5-8 minutes, well under 15-minute target

**Rate Limit Budget Management:**
- `app_discovery` and `appstore_autocomplete` share the iTunes rate limit (~20 req/min)
- The orchestrator should run `appstore_autocomplete` AFTER `app_discovery` completes to avoid competing for rate limit budget
- `reddit_miner` and `trends_checker` use completely separate APIs and can truly run in any order

#### Phase 5: Testing & Validation

- [ ] Test each Python tool standalone with a known niche (e.g., "habit tracker for ADHD")
- [ ] Test the full pipeline via `/niche-research "habit tracker for ADHD"`
- [ ] Verify report completeness: all 9 sections present, scoring rubric applied
- [ ] Test error scenarios: invalid keyword (zero app results), Reddit rate limit, Google Trends rate limit
- [ ] Test re-run behavior: run same niche twice, verify data is overwritten cleanly
- [ ] Verify `/niche-brainstorm` produces a valid profile that can feed into `/niche-research`

### Research Insights — Testing

**Additional Test Scenarios:**
- [ ] Empty keyword (should fail with clear error message)
- [ ] Special characters in keyword (e.g., `"C++ learning"`, `"résumé builder"`)
- [ ] Very long keyword (>100 chars) — test slug truncation
- [ ] Network timeout simulation (disconnect during review mining)
- [ ] Partial pipeline run (e.g., only `app_discovery` succeeds, all others fail) — report should still generate with data gap warnings
- [ ] Competitors.json with zero apps — review_miner should be skipped, report should note this

**Validation Checklist:**
- Each JSON output should be valid JSON (parseable by `json.loads()`)
- Each JSON output should match the documented schema (field names, types)
- `_pipeline_meta.json` should always be written, even if all tools fail
- Report should never contain raw JSON — all data should be presented in human-readable format

## System-Wide Impact

### Interaction Graph

`/niche-research` → Bash (Python tools) → JSON files → `/niche-report` → Read (JSON + reference docs) → Write (report.md)

No database, no external services beyond the APIs. All state is filesystem-based (JSON + markdown). No callbacks, no middleware.

### Error & Failure Propagation

Each Python tool is isolated. Failures are caught by the orchestrator and logged to `_pipeline_meta.json`. The report generator reads this metadata and flags gaps. A single tool failure never crashes the pipeline.

Rate limit errors (iTunes 403, Google Trends throttle, Reddit 429) are retried once with backoff, then logged as failures.

### State Lifecycle Risks

Minimal. All output is files written to `niches/<name>/data/`. Re-runs overwrite entirely. No partial state concerns — each tool writes its JSON atomically (write to temp, rename).

### API Surface Parity

The three Claude Code skills (`/niche-brainstorm`, `/niche-report`, `/niche-research`) are the only user-facing interfaces. The Python tools are also runnable standalone for debugging but are not the primary UX.

## Acceptance Criteria

### Functional Requirements

- [ ] `app_discovery.py` returns competitor apps with app_id, rating, review_count, last_updated, and genre
- [ ] `review_miner.py` fetches up to 500 reviews per app (US) for the top 10 competitors
- [ ] `reddit_miner.py` finds relevant threads via Arctic Shift (historical) and PRAW (recent), with auto subreddit discovery
- [ ] `trends_checker.py` returns interest direction and seasonality via pytrends-modern
- [ ] `appstore_autocomplete.py` returns suggestions with saturation scoring
- [ ] `/niche-brainstorm` produces a structured profile in `profiles/`
- [ ] `/niche-report` produces a 9-section report with Go/No-Go score
- [ ] `/niche-research` orchestrates all tools and produces a complete report
- [ ] Pipeline continues when individual tools fail, with failures flagged in the report
- [ ] All tools accept `--niche-dir` and write structured JSON

### Non-Functional Requirements

- [ ] Full pipeline completes in under 15 minutes per niche
- [ ] No unhandled exceptions — all API errors caught and logged
- [ ] ruff passes on all Python files
- [ ] Each tool has a module docstring and `--help` output (argparse)

## Dependencies & Prerequisites

- [ ] Python 3.10+ with venv
- [ ] Reddit API credentials (register at reddit.com/prefs/apps, script type)
- [ ] `httpx`, `praw`, `pytrends-modern` pip packages
- [ ] No paid APIs or keys required (all endpoints are free/unauthenticated except Reddit OAuth)

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| iTunes RSS endpoint deprecated | Low | High (breaks review_miner) | Endpoint has been stable for years; fallback to `app-store-web-scraper` library |
| Arctic Shift API goes offline | Medium | Medium (lose historical Reddit data) | PRAW alone still works for recent threads; degrade gracefully |
| pytrends-modern rate limited | High | Low (secondary data source) | Built-in retries/backoff; graceful failure with status flag; trends is secondary |
| Reddit API terms change | Low | Medium | Arctic Shift provides independent access to historical data |
| iTunes Search API returns irrelevant results | Medium | Medium | Keyword expansion (3-5 variations) + manual keyword override |
| MZSearchHints endpoint removed | Medium | Low (autocomplete is supplementary) | Fall back to iTunes Search with prefix queries to simulate autocomplete |
| iTunes rate limit hit (20 req/min) | Medium | Medium (slows pipeline) | 3-second delays, batch Lookup API calls, exponential backoff on 403 |
| Arctic Shift can't do Reddit-wide FTS | N/A (confirmed) | Medium | Use PRAW `subreddit("all").search()` for broad search; Arctic Shift for deep per-sub history |

## Future Considerations (v2)

- `--from-profile` batch mode to process all candidates from a brainstorm profile (with `--limit`)
- Multi-country review mining (US, GB, CA, AU) for higher volume
- Revenue estimation integration (Appfigures API or similar)
- Keyword difficulty/opportunity scoring (requires paid ASO tools)
- Comparative report across multiple niches (side-by-side scoring table)
- Web UI for browsing reports
- Official Google Trends API (when it exits alpha) as pytrends-modern replacement
- Pre-aggregation of review themes in Python (keyword frequency) to reduce Claude processing load
- BAScraper integration for async Reddit mining
- MZSearchHints `/wa/trends` endpoint for App Store trending data

## Sources & References

### Origin

- **Brainstorm document:** [`apps/research/brainstorms/2026-03-12-phase1-niche-discovery-automation-brainstorm.md`](apps/research/brainstorms/2026-03-12-phase1-niche-discovery-automation-brainstorm.md) — Key decisions: hybrid Python+Claude architecture, iTunes JSON endpoint over Playwright, Arctic Shift+PRAW over web scraping, modular tools with orchestrator, Go/No-Go scoring rubric

### Reference Data

- [`apps/research/indie-ios-app-playbook.md`](apps/research/indie-ios-app-playbook.md) — $500K market sizing formula, Phase 1 steps, validation criteria
- [`apps/research/ios-app-marketplace-breakdown.md`](apps/research/ios-app-marketplace-breakdown.md) — Category revenue data, saturation lists, conversion/retention benchmarks, pricing medians

### API Documentation

- iTunes Search API: `https://itunes.apple.com/search?term={}&entity=software` — [Official docs](https://performance-partners.apple.com/search-api), ~20 req/min rate limit
- iTunes Lookup API: `https://itunes.apple.com/lookup?id={}` — supports batch: up to 200 comma-separated IDs
- iTunes RSS Reviews: `https://itunes.apple.com/{country}/rss/customerreviews/page={}/id={}/json` — max 10 pages × 50 reviews
- Arctic Shift: `https://arctic-shift.photon-reddit.com/` — [GitHub](https://github.com/ArthurHeitmann/arctic_shift), per-subreddit FTS only
- PRAW: `https://praw.readthedocs.io/` — script-type OAuth, auto rate limiting
- pytrends-modern: `https://github.com/yiromo/pytrends-modern` — maintained pytrends fork with retries/backoff
- MZSearchHints: `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints` — [GitHub reference](https://github.com/dgurney/mzsearchhints), undocumented
- BAScraper: `https://github.com/maxjo020418/BAScraper` — async Arctic Shift + PullPush wrapper

### Repo Conventions

- Python patterns: `/Users/simons/dev/trading-bot/PATTERNS_AND_CONVENTIONS.md`
- Standalone script pattern: `/Users/simons/dev/trading-bot/deploy/cron/trading_bot_cron.py`
- Skill definition format: `/Users/simons/dev/trading-bot/deploy/openclaw/agents/ceo/skills/github-research/SKILL.md`

### Research Sources (from deepening)

- [iTunes Search API Rate Limits](https://developer.apple.com/forums/thread/69955) — Apple Developer Forums
- [pytrends Alternatives 2026](https://meetglimpse.com/software-guides/pytrends-alternatives/) — Glimpse
- [Best Google Trends Scraping APIs 2026](https://www.scrapingbee.com/blog/best-google-trends-api/) — ScrapingBee
- [Arctic Shift GitHub](https://github.com/ArthurHeitmann/arctic_shift) — Reddit data archive project
- [MZSearchHints Reference](https://github.com/dgurney/mzsearchhints) — Go library for undocumented endpoint
- [Python CLI Tools: Click vs Typer vs argparse](https://dasroot.net/posts/2025/12/building-cli-tools-python-click-typer-argparse/) — 2025 comparison
- [httpx Documentation](https://github.com/encode/httpx) — Timeouts, retries, async patterns
- [PRAW Documentation](https://praw.readthedocs.io/en/stable/) — OAuth, subreddit search, rate limits
