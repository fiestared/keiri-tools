#!/usr/bin/env python3
"""Convert the reviewed citation inventory Markdown into a stable registry."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

EXPECTED = {"pages": 68, "sources": 31, "citations": 33, "unlinked": 35}
ROW = re.compile(r"^\| `(?P<page>/[^`]+)` \| (?P<label>[^|]+?) \| (?P<source>.*?) \|")
LINK = re.compile(r"\[[^]]+\]\((https?://[^)]+)\)")


def source_id(url: str) -> str:
    return "src_" + hashlib.sha256(url.encode()).hexdigest()[:16]


def parse_inventory(text: str) -> dict:
    citations = []
    sources = {}
    for line in text.splitlines():
        match = ROW.match(line)
        if not match:
            continue
        page = match.group("page")
        label = match.group("label").strip()
        link = LINK.search(match.group("source"))
        url = link.group(1) if link else None
        sid = source_id(url) if url else None
        if url:
            sources[sid] = {"source_id": sid, "url": url}
        citations.append({"page": page, "label": label, "source_id": sid})

    page_counts = {}
    for citation in citations:
        page_counts[citation["page"]] = page_counts.get(citation["page"], 0) + 1
    counts = {
        "pages": len(page_counts),
        "sources": len(sources),
        "citations": sum(1 for row in citations if row["source_id"]),
        "unlinked": sum(1 for row in citations if not row["source_id"]),
    }
    duplicates = sorted(page for page, count in page_counts.items() if count != 1)
    referenced = {row["source_id"] for row in citations if row["source_id"]}
    dangling = sorted(referenced - set(sources))
    return {
        "schema_version": 1,
        "counts": counts,
        "sources": sorted(sources.values(), key=lambda row: row["source_id"]),
        "citations": sorted(citations, key=lambda row: row["page"]),
        "reconciliation": {
            "expected": EXPECTED,
            "duplicate_pages": duplicates,
            "unresolved_source_ids": dangling,
        },
    }


def validate(registry: dict) -> list[str]:
    errors = []
    if registry["counts"] != EXPECTED:
        errors.append(f"inventory count changed: expected {EXPECTED}, got {registry['counts']}")
    if registry["reconciliation"]["duplicate_pages"]:
        errors.append("duplicate pages: " + ", ".join(registry["reconciliation"]["duplicate_pages"]))
    if registry["reconciliation"]["unresolved_source_ids"]:
        errors.append("unresolved source ids: " + ", ".join(registry["reconciliation"]["unresolved_source_ids"]))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    registry = parse_inventory(args.inventory.read_text(encoding="utf-8"))
    errors = validate(registry)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 2
    rendered = json.dumps(registry, ensure_ascii=False, indent=2) + "\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
