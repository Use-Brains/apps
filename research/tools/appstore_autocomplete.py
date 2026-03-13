"""Fetch App Store search suggestions and score keyword saturation.

Uses the undocumented MZSearchHints endpoint for autocomplete suggestions, then
runs lightweight iTunes Search queries to assess competition saturation per keyword.

Usage:
    python appstore_autocomplete.py "keyword1" "keyword2" --niche-dir niches/my-niche/data/
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from shared import create_http_client, rate_limited_sleep, setup_logging, write_json

HINTS_URL = (
    "https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints"
)
SEARCH_URL = "https://itunes.apple.com/search"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("keywords", nargs="+", help="Seed keywords for suggestions")
    parser.add_argument(
        "--niche-dir", required=True, type=Path, help="Output directory for JSON"
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    return parser


def fetch_suggestions(client, keyword: str, logger) -> list[str]:
    """Fetch autocomplete suggestions from MZSearchHints endpoint."""
    params = {"term": keyword, "media": "software"}
    try:
        resp = client.get(HINTS_URL, params=params)
        if resp.status_code != 200:
            logger.debug("MZSearchHints returned %d for '%s'", resp.status_code, keyword)
            return fallback_suggestions(client, keyword)

        data = resp.json()
        hints = data.get("hints", [])
        return [h.get("term", "") for h in hints if h.get("term")]
    except Exception as exc:
        logger.debug("MZSearchHints failed for '%s': %s — using fallback", keyword, exc)
        return fallback_suggestions(client, keyword)


def fallback_suggestions(client, keyword: str) -> list[str]:
    """Fallback: use iTunes Search with prefix queries to simulate autocomplete."""
    suggestions = []
    for suffix in ["", " app", " tracker", " manager"]:
        query = keyword + suffix
        try:
            resp = client.get(
                SEARCH_URL, params={"term": query, "entity": "software", "limit": 3}
            )
            if resp.status_code == 200:
                for result in resp.json().get("results", []):
                    name = result.get("trackName", "")
                    if name and name not in suggestions:
                        suggestions.append(name)
            rate_limited_sleep()
        except Exception:
            pass
    return suggestions


def score_saturation(client, suggestion: str, logger) -> tuple[str, str]:
    """Score saturation for a suggestion by checking top 3 iTunes Search results.

    Returns (level, detail) where level is "high", "medium", or "low".
    """
    try:
        resp = client.get(
            SEARCH_URL,
            params={"term": suggestion, "entity": "software", "limit": 3, "country": "us"},
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
    except Exception as exc:
        logger.debug("Saturation check failed for '%s': %s", suggestion, exc)
        return "unknown", "Could not fetch search results"

    if not results:
        return "low", "No results found for this query — wide open opportunity"

    ratings = [r.get("averageUserRating", 0) or 0 for r in results]
    review_counts = [r.get("userRatingCount", 0) or 0 for r in results]

    avg_rating = sum(ratings) / len(ratings) if ratings else 0
    avg_reviews = sum(review_counts) / len(review_counts) if review_counts else 0

    if avg_rating > 4.3 and avg_reviews > 5000:
        level = "high"
    elif avg_rating > 3.5 or avg_reviews > 1000:
        level = "medium"
    else:
        level = "low"

    detail = (
        f"Top {len(results)} results: avg rating {avg_rating:.1f}, "
        f"avg reviews {int(avg_reviews)}. "
        f"{'Well-served' if level == 'high' else 'Opportunity' if level == 'low' else 'Moderate'}."
    )

    return level, detail


def run(args) -> int:
    logger = setup_logging("appstore_autocomplete", verbose=args.verbose)
    client = create_http_client()

    results = []
    for keyword in args.keywords:
        logger.info("Fetching suggestions for: %s", keyword)

        suggestions = fetch_suggestions(client, keyword, logger)
        if suggestions:
            logger.info("  %d suggestions found", len(suggestions))
        else:
            logger.info("  No suggestions found")

        rate_limited_sleep()

        # Score saturation for each suggestion
        scored_suggestions = []
        for suggestion in suggestions[:10]:  # Cap at 10 per keyword
            level, detail = score_saturation(client, suggestion, logger)
            scored_suggestions.append(suggestion)
            rate_limited_sleep()

        # Build output entry with overall saturation from first suggestion
        if suggestions:
            level, detail = score_saturation(client, suggestions[0], logger)
            rate_limited_sleep()
        else:
            level, detail = "unknown", "No suggestions available"

        results.append({
            "query": keyword,
            "suggestions": suggestions,
            "result_saturation": level,
            "saturation_detail": detail,
        })

    output_path = args.niche_dir / "autocomplete.json"
    write_json(results, output_path)
    logger.info(
        "Wrote %d keyword results to %s", len(results), output_path
    )

    client.close()
    return 0


def main() -> int:
    args = build_parser().parse_args()
    args.niche_dir.mkdir(parents=True, exist_ok=True)
    try:
        return run(args)
    except Exception:
        logging = setup_logging("appstore_autocomplete")
        logging.exception("Fatal error")
        return 1


if __name__ == "__main__":
    sys.exit(main())
