#!/usr/bin/env python3
"""Fetch citation URLs without turning failures into "no change".

The public API is intentionally small and injectable so the monitor can test
HTTP failures, redirects, timeouts, and pacing without contacting a source.
"""

from __future__ import annotations

import hashlib
import socket
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Callable, Iterable


def _taxanswer_2665_alternate(url: str) -> str | None:
    pairs = (
        ("/taxanswer/shotoku/2665.htm", "/taxanswer/gensen/2665.htm"),
        ("/taxanswer/gensen/2665.htm", "/taxanswer/shotoku/2665.htm"),
    )
    for old, new in pairs:
        if old in url:
            return url.replace(old, new, 1)
    return None


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _fetch_one(url: str, *, opener, timeout: float, now: Callable[[], str]) -> dict:
    record = {
        "url": url,
        "fetched_at": now(),
        "http_status": None,
        "final_url": None,
        "redirected": False,
        "body_sha256": None,
        "error": None,
    }
    try:
        with opener.open(url, timeout=timeout) as response:
            body = response.read()
            record.update(
                http_status=response.getcode(),
                final_url=response.geturl(),
                redirected=response.geturl() != url,
                body_sha256=hashlib.sha256(body).hexdigest(),
            )
    except urllib.error.HTTPError as exc:
        record.update(
            http_status=exc.code,
            final_url=exc.geturl(),
            redirected=exc.geturl() != url,
            error="http_error",
        )
    except (TimeoutError, socket.timeout):
        record["error"] = "timeout"
    except urllib.error.URLError as exc:
        record["error"] = "timeout" if isinstance(exc.reason, (TimeoutError, socket.timeout)) else "url_error"
    return record


def fetch_citations(
    urls: Iterable[str],
    *,
    timeout: float = 15.0,
    min_interval: float = 1.0,
    opener=None,
    clock: Callable[[], float] = time.monotonic,
    sleep: Callable[[float], None] = time.sleep,
    now: Callable[[], str] = _iso_now,
) -> list[dict]:
    """Fetch each unique URL once, preserving failures and the No.2665 fallback.

    A fallback is an additional observation, never a replacement for the
    original result.  Callers must inspect ``original`` and ``alternate``.
    """
    opener = opener or urllib.request.build_opener()
    unique_urls = list(dict.fromkeys(urls))
    results: list[dict] = []
    last_started: float | None = None

    def paced_fetch(url: str) -> dict:
        nonlocal last_started
        if last_started is not None:
            remaining = min_interval - (clock() - last_started)
            if remaining > 0:
                sleep(remaining)
        last_started = clock()
        return _fetch_one(url, opener=opener, timeout=timeout, now=now)

    for url in unique_urls:
        original = paced_fetch(url)
        item = {"url": url, "original": original, "alternate": None}
        alternate_url = _taxanswer_2665_alternate(url)
        if original["error"] is not None and alternate_url:
            item["alternate"] = paced_fetch(alternate_url)
        results.append(item)
    return results
