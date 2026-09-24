#!/usr/bin/env python3
"""一次資料と自社の基準日を、本文の意味を推測せず比較する。

BL-004 は抽出・比較だけを担当する。HTTP 取得、登録、CLI、本文更新は後続工程。
候補が複数ある場合に最大日付を選ばず、判定不能へ倒す。
"""

from __future__ import annotations

from datetime import date
import re
from typing import Any


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

