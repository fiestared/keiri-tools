#!/usr/bin/env python3
"""一次資料と自社の基準日を、本文の意味を推測せず比較する。

手動実行例::

    python3 tools/check_citation_date.py --json /tmp/citation-dates.json
    python3 tools/check_citation_date.py --markdown /tmp/citation-dates.md

終了コードは 0=差分・取得失敗なし、2=ずれ、3=未取得、4=ずれと未取得の併存。
URL未登録は「記載なし」として68ページの分母に残すが、取得失敗には数えない。
候補が複数ある場合に最大日付を選ばず、判定不能へ倒す。
"""

from __future__ import annotations

import argparse
from datetime import date
import json
from pathlib import Path
import re
import sys
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from citation_fetch import fetch_citations


DEFAULT_DATE_PATTERN = re.compile(
    r"令和(?P<year>[0-9０-９〇零一二三四五六七八九十]+)年"
    r"(?P<month>[0-9０-９〇零一二三四五六七八九十]+)月"
    r"(?P<day>[0-9０-９〇零一二三四五六七八九十]+)日現在(?:法令等)?"
)
_WIDE_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")
_KANJI_DIGITS = {"〇": 0, "零": 0, "一": 1, "二": 2, "三": 3, "四": 4,
                 "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}


def normalize_number(value: str) -> int:
    """半角・全角・99までの漢数字を整数へ変換する。"""
    normalized = value.translate(_WIDE_DIGITS)
    if normalized.isdigit():
        return int(normalized)
    if not normalized or any(c not in _KANJI_DIGITS and c != "十" for c in normalized):
        raise ValueError(f"unsupported number: {value}")
    if "十" not in normalized:
        if len(normalized) != 1:
            raise ValueError(f"unsupported kanji number: {value}")
        return _KANJI_DIGITS[normalized]
    if normalized.count("十") != 1:
        raise ValueError(f"unsupported kanji number: {value}")
    tens, ones = normalized.split("十")
    tens_value = 1 if tens == "" else _KANJI_DIGITS.get(tens)
    ones_value = 0 if ones == "" else _KANJI_DIGITS.get(ones)
    if tens_value is None or ones_value is None:
        raise ValueError(f"unsupported kanji number: {value}")
    return tens_value * 10 + ones_value


def extract_reference_date(text: str, pattern: re.Pattern[str] = DEFAULT_DATE_PATTERN) -> dict[str, Any]:
    """本文から基準日を抽出し、原文とISO日付を返す。

    同じ日付の重複表記は一意とみなす。異なる日付、不正日付、日付なしは
    いずれも日付を返さず、呼び出し側が安全に判定不能へ倒せるようにする。
    """
    candidates: list[dict[str, str]] = []
    invalid: list[str] = []
    for match in pattern.finditer(text):
        raw = match.group(0)
        try:
            wareki_year = normalize_number(match.group("year"))
            month = normalize_number(match.group("month"))
            day = normalize_number(match.group("day"))
            iso = date(2018 + wareki_year, month, day).isoformat()
        except (KeyError, TypeError, ValueError):
            invalid.append(raw)
            continue
        candidates.append({"raw": raw, "iso_date": iso})

    if invalid:
        return {"status": "invalid_date", "raw": invalid, "iso_date": None,
                "candidates": candidates}
    if not candidates:
        return {"status": "date_not_found", "raw": [], "iso_date": None,
                "candidates": []}

    unique_dates = {item["iso_date"] for item in candidates}
    if len(unique_dates) != 1:
        return {"status": "ambiguous_date", "raw": [item["raw"] for item in candidates],
                "iso_date": None, "candidates": candidates}
    return {"status": "observed", "raw": [item["raw"] for item in candidates],
            "iso_date": candidates[0]["iso_date"], "candidates": candidates}


def compare_reference_date(source_text: str, cited_as_of: str,
                           pattern: re.Pattern[str] = DEFAULT_DATE_PATTERN) -> dict[str, Any]:
    """一次本文の基準日と自社ISO日付を比較する。"""
    observation = extract_reference_date(source_text, pattern)
    try:
        cited = date.fromisoformat(cited_as_of)
    except (TypeError, ValueError):
        return {**observation, "cited_as_of": cited_as_of, "comparison": "unknown",
                "reason": "invalid_cited_as_of"}
    if observation["status"] != "observed":
        return {**observation, "cited_as_of": cited_as_of, "comparison": "unknown",
                "reason": observation["status"]}
    observed = date.fromisoformat(observation["iso_date"])
    comparison = "aligned"
    if observed > cited:
        comparison = "source_newer"
    elif observed < cited:
        comparison = "page_newer"
    return {**observation, "cited_as_of": cited_as_of, "comparison": comparison,
            "reason": None}


def _label_date(label: str) -> str | None:
    observed = extract_reference_date(label)
    return observed["iso_date"] if observed["status"] == "observed" else None


def _fixture_fetch(registry: dict, fixture: dict) -> list[dict]:
    responses = fixture.get("responses", {})
    default = fixture.get("default", {})
    records = []
    for source in registry["sources"]:
        url = source["url"]
        response = {**default, **responses.get(url, {})}
        records.append({
            "url": url,
            "original": {
                "url": url,
                "fetched_at": fixture.get("fetched_at", "fixture"),
                "http_status": response.get("http_status", 200),
                "final_url": response.get("final_url", url),
                "redirected": response.get("final_url", url) != url,
                "body_sha256": response.get("body_sha256", "fixture"),
                "body_text": response.get("body_text"),
                "error": response.get("error"),
            },
            "alternate": None,
        })
    return records


def build_report(registry: dict, fetches: list[dict]) -> dict:
    """登録68ページを落とさず、表示状態と詳細比較を分離して返す。"""
    source_by_id = {item["source_id"]: item for item in registry["sources"]}
    fetch_by_url = {item["url"]: item for item in fetches}
    rows = []
    for citation in registry["citations"]:
        row = {"page": citation["page"], "label": citation["label"],
               "source_id": citation["source_id"], "source_url": None,
               "status": None, "comparison": None, "reason": None,
               "cited_as_of": _label_date(citation["label"]),
               "observed_as_of": None, "source_raw": [], "fetch": None}
        if citation["source_id"] is None:
            row.update(status="記載なし", comparison="no_source_url", reason="source_url_missing")
            rows.append(row)
            continue
        source = source_by_id.get(citation["source_id"])
        if source is None:
            row.update(status="未取得", comparison="unknown", reason="unknown_source_id")
            rows.append(row)
            continue
        row["source_url"] = source["url"]
        fetched = fetch_by_url.get(source["url"])
        original = fetched and fetched.get("original")
        if not original or original.get("error") or original.get("http_status") != 200 \
                or not original.get("body_text"):
            row.update(status="未取得", comparison="unknown", reason="fetch_failed",
                       fetch=original)
            rows.append(row)
            continue
        compared = compare_reference_date(original["body_text"], row["cited_as_of"])
        comparison = compared["comparison"]
        status = "一致" if comparison == "aligned" else "ずれ"
        if comparison == "unknown":
            status = "未取得"
        row.update(status=status, comparison=comparison, reason=compared["reason"],
                   observed_as_of=compared["iso_date"], source_raw=compared["raw"],
                   fetch={k: v for k, v in original.items() if k != "body_text"})
        rows.append(row)

    counts = {name: sum(row["status"] == name for row in rows)
              for name in ("一致", "ずれ", "記載なし", "未取得")}
    if counts["ずれ"] and counts["未取得"]:
        exit_code = 4
    elif counts["ずれ"]:
        exit_code = 2
    elif counts["未取得"]:
        exit_code = 3
    else:
        exit_code = 0
    return {"schema_version": 1, "pages": len(rows), "counts": counts,
            "exit_code": exit_code, "rows": rows}


def render_markdown(report: dict) -> str:
    lines = ["# 引用日付監視", "", f"対象: {report['pages']}ページ / 終了: {report['exit_code']}", "",
             "| ページ | 状態 | 詳細 | 自社基準日 | 一次基準日 | 理由 |",
             "|---|---|---|---|---|---|"]
    for row in report["rows"]:
        lines.append("| {page} | {status} | {comparison} | {cited} | {observed} | {reason} |".format(
            page=row["page"], status=row["status"], comparison=row["comparison"],
            cited=row["cited_as_of"] or "—", observed=row["observed_as_of"] or "—",
            reason=row["reason"] or "—"))
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--registry", type=Path, default=Path(__file__).with_name("citation_date_registry.json"))
    parser.add_argument("--fixture", type=Path, help="HTTPへ接続せずfixture応答で完走する")
    parser.add_argument("--json", type=Path, dest="json_output")
    parser.add_argument("--markdown", type=Path, dest="markdown_output")
    args = parser.parse_args(argv)
    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    if args.fixture:
        fixture = json.loads(args.fixture.read_text(encoding="utf-8"))
        fetched = _fixture_fetch(registry, fixture)
    else:
        fetched = fetch_citations(source["url"] for source in registry["sources"])
    report = build_report(registry, fetched)
    payload = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.json_output:
        args.json_output.write_text(payload, encoding="utf-8")
    if args.markdown_output:
        args.markdown_output.write_text(render_markdown(report), encoding="utf-8")
    if not args.json_output and not args.markdown_output:
        sys.stdout.write(payload)
    return report["exit_code"]


if __name__ == "__main__":
    raise SystemExit(main())
