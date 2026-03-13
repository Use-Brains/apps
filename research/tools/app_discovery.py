"""Discover competitor apps on the iOS App Store via iTunes Search and Lookup APIs.

Searches for apps matching given keywords, deduplicates by app ID, enriches with
last_updated dates via batch Lookup API, and writes results to competitors.json.

Usage:
    python app_discovery.py "keyword1" "keyword2" --niche-dir niches/my-niche/data/
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from shared import create_http_client, rate_limited_sleep, setup_logging, write_json

SEARCH_URL = "https://itunes.apple.com/search"
LOOKUP_URL = "https://itunes.apple.com/lookup"


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
        "--country", default="us", help="App Store country code (default: us)"
    )
    parser.add_argument(
        "--limit", type=int, default=25, help="Max results per keyword (default: 25)"
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    return parser


def search_apps(client, keyword: str, country: str, limit: int, logger) -> list[dict]:
    """Search iTunes for apps matching a keyword."""
    params = {
        "term": keyword,
        "country": country,
        "entity": "software",
        "limit": min(limit, 200),
    }
    logger.debug("Searching: %s", keyword)
    resp = client.get(SEARCH_URL, params=params)
    resp.raise_for_status()
    results = resp.json().get("results", [])
    # Filter to apps only (exclude podcasts, books, etc.)
    return [r for r in results if r.get("kind") == "software"]


def batch_lookup(client, app_ids: list[int], logger) -> dict[int, dict]:
    """Fetch app details in batches of 200 (iTunes Lookup API limit)."""
    details = {}
    for i in range(0, len(app_ids), 200):
        batch = app_ids[i : i + 200]
        id_str = ",".join(str(aid) for aid in batch)
        logger.debug("Lookup batch: %d apps", len(batch))
        resp = client.get(LOOKUP_URL, params={"id": id_str})
        resp.raise_for_status()
        for item in resp.json().get("results", []):
            track_id = item.get("trackId")
            if track_id:
                details[track_id] = item
        if i + 200 < len(app_ids):
            rate_limited_sleep()
    return details


def normalize_app(raw: dict, keywords_matched: list[str]) -> dict:
    """Extract relevant fields from an iTunes Search API result."""
    return {
        "app_id": raw.get("trackId"),
        "name": raw.get("trackName", ""),
        "developer": raw.get("artistName", ""),
        "rating": raw.get("averageUserRating"),
        "review_count": raw.get("userRatingCount", 0),
        "price": raw.get("price", 0.0),
        "genre": raw.get("primaryGenreName", ""),
        "description": (raw.get("description", "") or "")[:500],
        "last_updated": None,  # Enriched by Lookup API
        "icon_url": raw.get("artworkUrl512") or raw.get("artworkUrl100", ""),
        "keywords_matched": sorted(set(keywords_matched)),
    }


def run(args) -> int:
    logger = setup_logging("app_discovery", verbose=args.verbose)
    client = create_http_client()

    # Search across all keywords, dedup by app_id
    seen: dict[int, dict] = {}  # app_id -> normalized app
    keyword_map: dict[int, list[str]] = {}  # app_id -> [keywords that matched]

    for keyword in args.keywords:
        logger.info("Searching App Store for: %s", keyword)
        try:
            results = search_apps(client, keyword, args.country, args.limit, logger)
        except Exception as exc:
            logger.warning("Search failed for '%s': %s", keyword, exc)
            rate_limited_sleep()
            continue

        for raw in results:
            app_id = raw.get("trackId")
            if not app_id:
                continue
            keyword_map.setdefault(app_id, []).append(keyword)
            if app_id not in seen:
                seen[app_id] = raw

        rate_limited_sleep()

    if not seen:
        logger.warning("No apps found for any keyword")
        write_json([], args.niche_dir / "competitors.json")
        return 0

    logger.info("Found %d unique apps across %d keywords", len(seen), len(args.keywords))

    # Batch lookup for last_updated enrichment
    logger.info("Enriching with Lookup API...")
    try:
        lookup_data = batch_lookup(client, list(seen.keys()), logger)
    except Exception as exc:
        logger.warning("Lookup API failed: %s — proceeding without last_updated", exc)
        lookup_data = {}

    # Build final list
    apps = []
    for app_id, raw in seen.items():
        app = normalize_app(raw, keyword_map.get(app_id, []))
        # Enrich last_updated from lookup
        if app_id in lookup_data:
            app["last_updated"] = lookup_data[app_id].get("currentVersionReleaseDate", "")[:10]
        apps.append(app)

    # Sort by review_count descending (most-reviewed = most relevant competitors)
    apps.sort(key=lambda a: a.get("review_count") or 0, reverse=True)

    output_path = args.niche_dir / "competitors.json"
    write_json(apps, output_path)
    logger.info("Wrote %d competitors to %s", len(apps), output_path)

    client.close()
    return 0


def main() -> int:
    args = build_parser().parse_args()
    args.niche_dir.mkdir(parents=True, exist_ok=True)
    try:
        return run(args)
    except Exception:
        logging = setup_logging("app_discovery")
        logging.exception("Fatal error")
        return 1


if __name__ == "__main__":
    sys.exit(main())
