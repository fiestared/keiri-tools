#!/usr/bin/env python3
"""比較表の数値列へ ``num`` クラスを付ける。

既定は dry-run。対象ファイルを表示するだけで、``--write`` 指定時だけ更新する。
2列で数値列が1本だけの表は「項目名: 金額」のラベル・値表として除外する。
rowspan/colspan を含む表は列位置を安全に決められないため除外する。
"""

from __future__ import annotations

import argparse
import html
from pathlib import Path
import re
import sys


TABLE_RE = re.compile(r"<table\b[^>]*>.*?</table>", re.DOTALL | re.IGNORECASE)
ROW_RE = re.compile(r"<tr\b[^>]*>.*?</tr>", re.DOTALL | re.IGNORECASE)
CELL_RE = re.compile(r"<(td|th)\b([^>]*)>(.*?)</\1\s*>", re.DOTALL | re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")
NUMERIC_RE = re.compile(r"^[¥0-9,.%〜 万円円]+$")


def cell_text(body: str) -> str:
    return html.unescape(TAG_RE.sub("", body)).strip()


def add_num_class(tag: str, attrs: str, body: str) -> str:
    class_match = re.search(r'\bclass=(?P<q>["\'])(?P<value>.*?)(?P=q)', attrs)
    if class_match:
        classes = class_match.group("value").split()
        if "num" in classes:
            return f"<{tag}{attrs}>{body}</{tag}>"
        new_value = " ".join([*classes, "num"])
        attrs = attrs[: class_match.start("value")] + new_value + attrs[class_match.end("value") :]
    else:
        attrs = f'{attrs} class="num"'
    return f"<{tag}{attrs}>{body}</{tag}>"


def has_num_class(attrs: str) -> bool:
    class_match = re.search(r'\bclass=["\']([^"\']*)["\']', attrs)
    return bool(class_match and "num" in class_match.group(1).split())


def transform_table(source: str) -> tuple[str, int]:
    if re.search(r"\b(?:rowspan|colspan)\s*=", source, re.IGNORECASE):
        return source, 0

    rows = []
    for row_match in ROW_RE.finditer(source):
        cells = list(CELL_RE.finditer(row_match.group(0)))
        if cells:
            rows.append((row_match.start(), cells))
    widths = {len(cells) for _, cells in rows}
    if len(rows) < 3 or len(widths) != 1:
        return source, 0

    width = widths.pop()
    numeric_columns = []
    for column in range(width):
        data_cells = [cells[column] for _, cells in rows if cells[column].group(1).lower() == "td"]
        if len(data_cells) >= 2 and all(
            NUMERIC_RE.fullmatch(cell_text(cell.group(3))) for cell in data_cells
        ):
            numeric_columns.append(column)

    # 2列・数値列1本は、値だけを右へ飛ばす「項目名: 金額」表なので対象外。
    if width == 2 and len(numeric_columns) == 1:
        return source, 0
    if not numeric_columns:
        return source, 0

    changed_columns = 0
    replacements = []
    for column in numeric_columns:
        column_changed = False
        for row_start, cells in rows:
            cell = cells[column]
            if cell.group(1).lower() != "td" or has_num_class(cell.group(2)):
                continue
            replacement = add_num_class(cell.group(1), cell.group(2), cell.group(3))
            replacements.append((row_start + cell.start(), row_start + cell.end(), replacement))
            column_changed = True
        changed_columns += int(column_changed)

    for start, end, replacement in sorted(replacements, reverse=True):
        source = source[:start] + replacement + source[end:]
    return source, changed_columns


def transform_document(source: str) -> tuple[str, int]:
    columns = 0
    parts = []
    cursor = 0
    for match in TABLE_RE.finditer(source):
        transformed, changed = transform_table(match.group(0))
        parts.extend((source[cursor : match.start()], transformed))
        cursor = match.end()
        columns += changed
    parts.append(source[cursor:])
    return "".join(parts), columns


def input_files(paths: list[str]) -> list[Path]:
    if paths:
        files = [Path(path) for path in paths]
    else:
        files = list(Path("docs").rglob("index.html"))
    return sorted(path for path in files if path.is_file())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", help="確認対象。省略時は docs/**/index.html")
    parser.add_argument("--write", action="store_true", help="対象ファイルを更新する")
    args = parser.parse_args()

    total_columns = 0
    changed_files = 0
    for path in input_files(args.paths):
        source = path.read_text(encoding="utf-8")
        transformed, columns = transform_document(source)
        if not columns:
            continue
        print(f"{path}\t{columns}")
        total_columns += columns
        changed_files += 1
        if args.write:
            path.write_text(transformed, encoding="utf-8")
    print(f"files={changed_files} columns={total_columns}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
