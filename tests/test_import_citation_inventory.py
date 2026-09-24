import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("inventory", ROOT / "tools/import_citation_inventory.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CitationInventoryTest(unittest.TestCase):
    def test_counts_and_references(self):
        source = Path("/Users/masahiroyasu/Scripts/ai-income-daily/reports/long-2026-09-22/reiwa7-genzai-inventory.md")
        registry = MODULE.parse_inventory(source.read_text(encoding="utf-8"))
        self.assertEqual(registry["counts"], MODULE.EXPECTED)
        self.assertEqual(registry["reconciliation"]["duplicate_pages"], [])
        self.assertEqual(registry["reconciliation"]["unresolved_source_ids"], [])

    def test_same_input_is_deterministic(self):
        row = "| `/x/` | 令和7年4月1日現在 | [一次](https://example.test/a) | — | — | 圏外 |"
        self.assertEqual(MODULE.parse_inventory(row), MODULE.parse_inventory(row))

    def test_count_change_fails_closed(self):
        registry = MODULE.parse_inventory("| `/x/` | 令和7年4月1日現在 | 出典URLなし | — | — | 圏外 |")
        self.assertTrue(MODULE.validate(registry)[0].startswith("inventory count changed"))


if __name__ == "__main__":
    unittest.main()
