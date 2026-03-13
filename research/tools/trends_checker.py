"""Check Google Trends interest for niche keywords via pytrends-modern.

Reports interest direction (growing/stable/declining), seasonality patterns,
and related queries. Gracefully handles rate limiting.

Usage:
    python trends_checker.py "keyword1" "keyword2" --niche-dir niches/my-niche/data/
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from shared import setup_logging, write_json


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("keywords", nargs="+", help="Search keywords (max 5)")
    parser.add_argument(
        "--niche-dir", required=True, type=Path, help="Output directory for JSON"
    )
    parser.add_argument(
        "--timeframe", default="today 12-m", help="Timeframe (default: today 12-m)"
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    return parser


def compute_direction(values: list[float]) -> str:
    """Compare last 3 months avg vs prior 3 months to determine trend direction."""
    if len(values) < 6:
        return "insufficient_data"
    recent = sum(values[-3:]) / 3
    prior = sum(values[-6:-3]) / 3
    if prior == 0:
        return "growing" if recent > 0 else "stable"
    change = (recent - prior) / prior
    if change > 0.10:
        return "growing"
    if change < -0.10:
        return "declining"
    return "stable"


def detect_seasonality(monthly_data: list[dict], keywords: list[str]) -> str:
    """Identify months with >1.5x average interest."""
    if not monthly_data or not keywords:
        return ""

    primary_kw = keywords[0]
    values = [row.get(primary_kw, 0) for row in monthly_data]
    if not values:
        return ""

    avg = sum(values) / len(values)
    if avg == 0:
        return "No significant search volume detected"

    peak_months = []
    for row, val in zip(monthly_data, values, strict=True):
        if val > avg * 1.5:
            date_str = row.get("date", "")
            if date_str:
                peak_months.append(date_str)

    if not peak_months:
        return "No strong seasonality detected"
    return f"Peak interest months: {', '.join(peak_months)}"


def run(args) -> int:
    logger = setup_logging("trends_checker", verbose=args.verbose)

    # Cap at 5 keywords (pytrends limit)
    keywords = args.keywords[:5]
    logger.info("Checking Google Trends for: %s", ", ".join(keywords))

    # Import pytrends-modern here to allow graceful failure if not installed
    try:
        from pytrends_modern import TrendReq
        from pytrends_modern.exceptions import TooManyRequestsError
    except ImportError:
        logger.error("pytrends-modern not installed — pip install pytrends-modern")
        write_json(
            {"status": "error", "error": "pytrends-modern not installed", "keywords": keywords},
            args.niche_dir / "trends.json",
        )
        return 1

    pytrends = TrendReq(
        hl="en-US",
        tz=360,
        timeout=(10, 25),
        retries=3,
        backoff_factor=0.5,
    )

    output = {
        "keywords": keywords,
        "timeframe": args.timeframe,
        "direction": "unknown",
        "interest_over_time": [],
        "related_queries": [],
        "seasonality_notes": "",
    }

    # Interest over time
    try:
        pytrends.build_payload(keywords, timeframe=args.timeframe, geo="US")
        df = pytrends.interest_over_time()

        if df is not None and not df.empty:
            monthly_data = []
            for idx, row in df.iterrows():
                entry = {"date": str(idx)[:7]}  # YYYY-MM
                for kw in keywords:
                    if kw in df.columns:
                        entry[kw] = int(row[kw])
                monthly_data.append(entry)

            output["interest_over_time"] = monthly_data

            # Compute direction from primary keyword
            primary_values = [row.get(keywords[0], 0) for row in monthly_data]
            output["direction"] = compute_direction(primary_values)
            output["seasonality_notes"] = detect_seasonality(monthly_data, keywords)

            logger.info("Trend direction: %s", output["direction"])
        else:
            logger.warning("No interest_over_time data returned")

    except TooManyRequestsError:
        logger.warning("Rate limited by Google Trends")
        output["status"] = "rate_limited"
        write_json(output, args.niche_dir / "trends.json")
        return 0
    except Exception as exc:
        logger.warning("interest_over_time failed: %s", exc)
        output["status"] = "partial_failure"

    # Related queries
    try:
        related = pytrends.related_queries()
        if related:
            all_related = []
            for kw in keywords:
                if kw in related:
                    kw_data = related[kw]
                    for table_name in ("top", "rising"):
                        df_rel = kw_data.get(table_name)
                        if df_rel is not None and not df_rel.empty:
                            for _, row in df_rel.head(10).iterrows():
                                query = row.get("query", "")
                                if query and query not in all_related:
                                    all_related.append(query)
            output["related_queries"] = all_related
            logger.info("Found %d related queries", len(all_related))
    except Exception as exc:
        logger.debug("Related queries failed: %s", exc)

    output_path = args.niche_dir / "trends.json"
    write_json(output, output_path)
    logger.info("Wrote trends to %s", output_path)
    return 0


def main() -> int:
    args = build_parser().parse_args()
    args.niche_dir.mkdir(parents=True, exist_ok=True)
    try:
        return run(args)
    except Exception:
        logging = setup_logging("trends_checker")
        logging.exception("Fatal error")
        return 1


if __name__ == "__main__":
    sys.exit(main())
