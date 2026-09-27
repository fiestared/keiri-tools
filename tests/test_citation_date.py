#!/usr/bin/env python3
"""BL-004: 引用先基準日の抽出・比較 fixture。"""

import importlib.util
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "check_citation_date", ROOT / "tools" / "check_citation_date.py"
)
module = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(module)


class CitationDateTest(unittest.TestCase):
    def test_eight_required_fixtures(self):
        fixture_path = ROOT / "tests" / "fixtures" / "citation_dates.json"
        fixtures = json.loads(fixture_path.read_text(encoding="utf-8"))
        self.assertEqual(8, len(fixtures), "完了条件の8 fixtureを減らさない")
        for fixture in fixtures:
            with self.subTest(fixture["name"]):
                actual = module.compare_reference_date(fixture["text"], fixture["cited_as_of"])
                self.assertEqual(fixture["status"], actual["status"])
                self.assertEqual(fixture["comparison"], actual["comparison"])
                self.assertEqual(fixture["iso_date"], actual["iso_date"])
                for raw in fixture["raw_contains"]:
                    self.assertIn(raw, actual["raw"])

    def test_same_date_repeated_is_not_ambiguous(self):
        result = module.extract_reference_date(
            "令和8年4月1日現在法令等／再掲: 令和８年４月１日現在法令等"
        )
        self.assertEqual("observed", result["status"])
        self.assertEqual("2026-04-01", result["iso_date"])


if __name__ == "__main__":
    unittest.main()

