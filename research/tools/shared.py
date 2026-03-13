"""Shared utilities for niche research tools."""
from __future__ import annotations

import json
import logging
import re
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

import httpx


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
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        format=f"[{tool_name}] %(message)s",
        level=level,
        stream=sys.stdout,
    )
    # Suppress noisy httpx/httpcore debug logs unless truly verbose
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    return logging.getLogger(tool_name)


def write_json(data: dict | list, path: Path) -> None:
    """Write data as formatted JSON atomically (temp + rename)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_fd, tmp_path = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with open(tmp_fd, "w") as f:
            json.dump(data, f, indent=2, default=str)
            f.write("\n")
        Path(tmp_path).replace(path)
    except BaseException:
        Path(tmp_path).unlink(missing_ok=True)
        raise


def read_json(path: Path) -> dict | list:
    """Read and parse a JSON file."""
    return json.loads(path.read_text())


def create_http_client(*, timeout: float = 30.0, retries: int = 2) -> httpx.Client:
    """Create an httpx client with retry transport and reasonable defaults."""
    transport = httpx.HTTPTransport(retries=retries)
    return httpx.Client(
        transport=transport,
        timeout=httpx.Timeout(timeout, connect=10.0),
        headers={"User-Agent": "NicheResearchTools/0.1"},
        follow_redirects=True,
    )


def rate_limited_sleep(seconds: float = 3.0) -> None:
    """Sleep for rate limiting. Default 3s for iTunes API (~20 req/min)."""
    time.sleep(seconds)


@dataclass
class NicheDir:
    """Manages the niche data directory."""

    base_path: Path

    def __post_init__(self) -> None:
        self.base_path.mkdir(parents=True, exist_ok=True)

    def json_path(self, filename: str) -> Path:
        return self.base_path / filename
