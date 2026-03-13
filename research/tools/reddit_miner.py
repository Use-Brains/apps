"""Mine Reddit for threads about app needs and frustrations.

Two-layer approach: PRAW for recent + broad Reddit-wide search, Arctic Shift for
deep historical per-subreddit search. Auto-discovers niche-relevant subreddits.

Usage:
    python reddit_miner.py "keyword1" "keyword2" --niche-dir niches/my-niche/data/
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
import praw

from shared import create_http_client, setup_logging, write_json

ARCTIC_SHIFT_URL = "https://arctic-shift.photon-reddit.com/api/posts/search"

DEFAULT_SUBREDDITS = [
    "AppRecommendations",
    "SuggestAnApp",
    "androidapps",
    "iphone",
    "ios",
]

QUERY_PATTERNS = [
    '"{keyword} app"',
    '"is there an app" {keyword}',
    '"looking for" {keyword} app',
    '"best app for" {keyword}',
    '"alternative to" {keyword}',
]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("keywords", nargs="+", help="Search keywords")
    parser.add_argument(
        "--niche-dir", required=True, type=Path, help="Output directory for JSON"
    )
    parser.add_argument(
        "--subreddits", default="", help="Comma-separated subreddit list (optional)"
    )
    parser.add_argument(
        "--months", type=int, default=12, help="How many months of history (default: 12)"
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    return parser


def load_reddit_credentials(logger) -> dict:
    """Load Reddit API credentials from env vars or config file."""
    creds = {
        "client_id": os.environ.get("REDDIT_CLIENT_ID", ""),
        "client_secret": os.environ.get("REDDIT_CLIENT_SECRET", ""),
        "username": os.environ.get("REDDIT_USERNAME", ""),
        "password": os.environ.get("REDDIT_PASSWORD", ""),
    }

    # Try config file if env vars are missing
    if not creds["client_id"]:
        config_path = Path.home() / ".config" / "niche-research" / "reddit.env"
        if config_path.exists():
            logger.debug("Loading credentials from %s", config_path)
            for line in config_path.read_text().splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("\"'")
                    env_key = key.upper()
                    if env_key in creds and not creds[env_key.replace("REDDIT_", "").lower()]:
                        creds[key.replace("REDDIT_", "").lower()] = val

    return creds


def create_reddit_client(creds: dict, logger) -> praw.Reddit | None:
    """Create a PRAW Reddit client. Returns None if credentials are missing."""
    if not creds.get("client_id"):
        logger.warning("No Reddit credentials found — PRAW search disabled")
        return None

    return praw.Reddit(
        client_id=creds["client_id"],
        client_secret=creds["client_secret"],
        username=creds.get("username", ""),
        password=creds.get("password", ""),
        user_agent="NicheResearchTools/0.1",
    )


def discover_subreddits(
    reddit: praw.Reddit | None, keywords: list[str], logger
) -> list[str]:
    """Auto-discover niche-relevant subreddits via PRAW search."""
    discovered = set()
    if not reddit:
        return []

    for keyword in keywords[:3]:  # Limit to first 3 keywords
        try:
            results = reddit.subreddits.search(keyword, limit=5)
            for sub in results:
                if sub.subscribers and sub.subscribers > 1000:
                    discovered.add(sub.display_name)
                    logger.debug("Discovered r/%s (%d subs)", sub.display_name, sub.subscribers)
        except Exception as exc:
            logger.debug("Subreddit discovery failed for '%s': %s", keyword, exc)

    return sorted(discovered)


def expand_queries(keywords: list[str]) -> list[str]:
    """Generate search queries from keywords using pattern expansion."""
    queries = []
    for keyword in keywords:
        for pattern in QUERY_PATTERNS:
            queries.append(pattern.format(keyword=keyword))
    return queries


def search_praw(
    reddit: praw.Reddit,
    queries: list[str],
    subreddits: list[str],
    months: int,
    logger,
) -> list[dict]:
    """Search Reddit via PRAW for recent threads."""
    threads = []
    time_filter = "year" if months >= 12 else "month"

    # Search Reddit-wide first
    for query in queries[:10]:  # Cap at 10 queries to avoid rate limits
        try:
            logger.debug("PRAW search: %s", query)
            results = reddit.subreddit("all").search(
                query, sort="relevance", time_filter=time_filter, limit=10
            )
            for submission in results:
                threads.append(normalize_submission(submission))
        except Exception as exc:
            logger.debug("PRAW search failed for '%s': %s", query, exc)

    # Also search specific subreddits
    for sub_name in subreddits[:10]:
        for keyword_query in queries[:3]:  # Fewer queries per sub
            try:
                results = reddit.subreddit(sub_name).search(
                    keyword_query, sort="relevance", time_filter=time_filter, limit=10
                )
                for submission in results:
                    threads.append(normalize_submission(submission))
            except Exception as exc:
                logger.debug("PRAW r/%s search failed: %s", sub_name, exc)

    return threads


def normalize_submission(submission) -> dict:
    """Convert a PRAW submission to our standard format."""
    top_comments = []
    try:
        submission.comment_sort = "best"
        submission.comments.replace_more(limit=0)
        for comment in submission.comments[:5]:
            top_comments.append({
                "body": comment.body[:500],
                "score": comment.score,
            })
    except Exception:
        pass

    created = datetime.fromtimestamp(submission.created_utc, tz=timezone.utc)
    return {
        "title": submission.title,
        "url": f"https://reddit.com{submission.permalink}",
        "subreddit": submission.subreddit.display_name,
        "score": submission.score,
        "num_comments": submission.num_comments,
        "date": created.strftime("%Y-%m-%d"),
        "body": (submission.selftext or "")[:500],
        "top_comments": top_comments,
        "source": "praw",
    }


def search_arctic_shift(
    client: httpx.Client,
    keywords: list[str],
    subreddits: list[str],
    months: int,
    logger,
) -> list[dict]:
    """Search Arctic Shift for historical Reddit threads per-subreddit."""
    threads = []
    after_ts = int(
        (datetime.now(tz=timezone.utc).timestamp()) - (months * 30 * 86400)
    )

    for sub_name in subreddits:
        for keyword in keywords[:3]:
            try:
                params = {
                    "subreddit": sub_name,
                    "q": keyword,
                    "after": after_ts,
                    "limit": 25,
                    "sort": "score",
                    "order": "desc",
                }
                logger.debug("Arctic Shift: r/%s q=%s", sub_name, keyword)
                resp = client.get(ARCTIC_SHIFT_URL, params=params)
                if resp.status_code != 200:
                    logger.debug(
                        "Arctic Shift returned %d for r/%s", resp.status_code, sub_name
                    )
                    continue

                data = resp.json().get("data", [])
                for post in data:
                    threads.append({
                        "title": post.get("title", ""),
                        "url": f"https://reddit.com{post.get('permalink', '')}",
                        "subreddit": post.get("subreddit", sub_name),
                        "score": post.get("score", 0),
                        "num_comments": post.get("num_comments", 0),
                        "date": datetime.fromtimestamp(
                            post.get("created_utc", 0), tz=timezone.utc
                        ).strftime("%Y-%m-%d"),
                        "body": (post.get("selftext", "") or "")[:500],
                        "top_comments": [],  # Arctic Shift doesn't return comments
                        "source": "arctic_shift",
                    })
                time.sleep(0.5)
            except Exception as exc:
                logger.debug(
                    "Arctic Shift error for r/%s '%s': %s", sub_name, keyword, exc
                )

    return threads


def deduplicate_threads(threads: list[dict]) -> list[dict]:
    """Deduplicate threads by URL, keeping the version with more comments."""
    seen: dict[str, dict] = {}
    for thread in threads:
        url = thread["url"]
        if url not in seen or thread.get("num_comments", 0) > seen[url].get(
            "num_comments", 0
        ):
            seen[url] = thread
    # Sort by score descending
    return sorted(seen.values(), key=lambda t: t.get("score", 0), reverse=True)


def run(args) -> int:
    logger = setup_logging("reddit_miner", verbose=args.verbose)

    # Parse subreddits
    if args.subreddits:
        subreddits = [s.strip() for s in args.subreddits.split(",") if s.strip()]
    else:
        subreddits = list(DEFAULT_SUBREDDITS)

    # Load credentials and create PRAW client
    creds = load_reddit_credentials(logger)
    reddit = create_reddit_client(creds, logger)

    # Discover additional subreddits
    if reddit:
        discovered = discover_subreddits(reddit, args.keywords, logger)
        new_subs = [s for s in discovered if s not in subreddits]
        if new_subs:
            logger.info("Discovered subreddits: %s", ", ".join(new_subs))
            subreddits.extend(new_subs)

    logger.info("Searching %d subreddits for %d keywords", len(subreddits), len(args.keywords))

    # Generate search queries
    queries = expand_queries(args.keywords)

    all_threads = []

    # PRAW search (recent + Reddit-wide)
    if reddit:
        logger.info("Searching via PRAW (recent threads)...")
        praw_threads = search_praw(reddit, queries, subreddits, args.months, logger)
        logger.info("PRAW found %d threads", len(praw_threads))
        all_threads.extend(praw_threads)

    # Arctic Shift search (historical, per-subreddit)
    logger.info("Searching via Arctic Shift (historical)...")
    http_client = create_http_client(timeout=30.0)
    arctic_threads = search_arctic_shift(
        http_client, args.keywords, subreddits, args.months, logger
    )
    logger.info("Arctic Shift found %d threads", len(arctic_threads))
    all_threads.extend(arctic_threads)
    http_client.close()

    # Deduplicate
    unique_threads = deduplicate_threads(all_threads)
    logger.info("Total unique threads: %d", len(unique_threads))

    output = {
        "subreddits_searched": sorted(set(subreddits)),
        "threads": unique_threads,
    }

    output_path = args.niche_dir / "reddit_threads.json"
    write_json(output, output_path)
    logger.info("Wrote %d threads to %s", len(unique_threads), output_path)

    return 0


def main() -> int:
    args = build_parser().parse_args()
    args.niche_dir.mkdir(parents=True, exist_ok=True)
    try:
        return run(args)
    except Exception:
        logging = setup_logging("reddit_miner")
        logging.exception("Fatal error")
        return 1


if __name__ == "__main__":
    sys.exit(main())
