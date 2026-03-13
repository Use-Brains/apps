"""Mine App Store reviews for competitor apps via the iTunes RSS JSON endpoint.

Reads competitors.json to get app IDs, then fetches up to 500 reviews per app
(10 pages x 50 reviews). Writes results to reviews.json.

Usage:
    python review_miner.py --niche-dir niches/my-niche/data/ [--max-apps 10]
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from shared import create_http_client, read_json, setup_logging, write_json

RSS_URL_TEMPLATE = (
    "https://itunes.apple.com/{country}/rss/customerreviews"
    "/page={page}/sortBy=mostRecent/id={app_id}/json"
)

MAX_PAGES = 10
REVIEWS_PER_PAGE = 50
PAGE_DELAY = 1.5  # seconds between page fetches
RETRY_DELAY = 5.0  # seconds to wait on 403 before retry


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--niche-dir", required=True, type=Path, help="Data directory with competitors.json"
    )
    parser.add_argument(
        "--max-apps", type=int, default=10, help="Max apps to mine reviews for (default: 10)"
    )
    parser.add_argument(
        "--country", default="us", help="App Store country code (default: us)"
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    return parser


def fetch_reviews_page(
    client, app_id: int, page: int, country: str, logger
) -> list[dict]:
    """Fetch a single page of reviews. Returns list of review dicts."""
    url = RSS_URL_TEMPLATE.format(country=country, page=page, app_id=app_id)
    resp = client.get(url)

    if resp.status_code == 403:
        logger.debug("Got 403, backing off %ss and retrying...", RETRY_DELAY)
        time.sleep(RETRY_DELAY)
        resp = client.get(url)
        if resp.status_code == 403:
            logger.debug("Second 403 for page %d, giving up on this page", page)
            return []

    resp.raise_for_status()
    data = resp.json()

    entries = data.get("feed", {}).get("entry", [])
    if not entries:
        return []

    # Single entry comes as dict, not list
    if isinstance(entries, dict):
        entries = [entries]

    reviews = []
    for entry in entries:
        # Skip the app metadata entry (first entry has no "im:rating")
        rating = entry.get("im:rating", {})
        if not rating:
            continue
        reviews.append({
            "app_id": app_id,
            "app_name": entry.get("im:name", {}).get("label", ""),
            "rating": int(rating.get("label", "0")),
            "title": entry.get("title", {}).get("label", ""),
            "body": entry.get("content", {}).get("label", ""),
            "date": entry.get("updated", {}).get("label", "")[:10],
            "version": entry.get("im:version", {}).get("label", ""),
        })
    return reviews


def mine_app_reviews(
    client, app_id: int, app_name: str, country: str, logger
) -> list[dict]:
    """Fetch all available reviews for a single app (up to 500)."""
    all_reviews = []
    for page in range(1, MAX_PAGES + 1):
        try:
            reviews = fetch_reviews_page(client, app_id, page, country, logger)
        except Exception as exc:
            logger.warning("Error fetching page %d for %s: %s", page, app_name, exc)
            break

        if not reviews:
            logger.debug("No more reviews at page %d for %s", page, app_name)
            break

        all_reviews.extend(reviews)
        logger.debug(
            "Page %d: %d reviews (total: %d)", page, len(reviews), len(all_reviews)
        )
        time.sleep(PAGE_DELAY)

    return all_reviews


def run(args) -> int:
    logger = setup_logging("review_miner", verbose=args.verbose)

    competitors_path = args.niche_dir / "competitors.json"
    if not competitors_path.exists():
        logger.error("competitors.json not found in %s", args.niche_dir)
        return 1

    competitors = read_json(competitors_path)
    if not competitors:
        logger.warning("No competitors found — nothing to mine")
        write_json([], args.niche_dir / "reviews.json")
        return 0

    # Take top N by review_count (already sorted)
    apps_to_mine = competitors[: args.max_apps]
    logger.info("Mining reviews for %d apps", len(apps_to_mine))

    client = create_http_client(timeout=60.0)
    all_reviews = []

    for i, app in enumerate(apps_to_mine, 1):
        app_id = app["app_id"]
        app_name = app.get("name", str(app_id))
        logger.info(
            "Mining reviews for %s (%d/%d)...", app_name, i, len(apps_to_mine)
        )

        reviews = mine_app_reviews(client, app_id, app_name, args.country, logger)
        all_reviews.extend(reviews)
        logger.info("  %d reviews fetched", len(reviews))

    output_path = args.niche_dir / "reviews.json"
    write_json(all_reviews, output_path)
    logger.info("Wrote %d total reviews to %s", len(all_reviews), output_path)

    client.close()
    return 0


def main() -> int:
    args = build_parser().parse_args()
    try:
        return run(args)
    except Exception:
        logging = setup_logging("review_miner")
        logging.exception("Fatal error")
        return 1


if __name__ == "__main__":
    sys.exit(main())
