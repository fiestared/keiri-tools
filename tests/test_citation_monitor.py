#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
SPEC = importlib.util.spec_from_file_location("check_citation_date", ROOT / "tools/check_citation_date.py")
module = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(module)


class CitationMonitorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = json.loads((ROOT / "tools/citation_date_registry.json").read_text())
        cls.fixture = json.loads((ROOT / "tests/fixtures/citation_monitor.json").read_text())

    def report(self, fixture=None):
        return module.build_report(self.registry, module._fixture_fetch(self.registry, fixture or self.fixture))

    def test_all_68_pages_and_missing_urls_are_not_failures(self):
        got = self.report()
        self.assertEqual(68, got["pages"])
        self.assertEqual({"一致": 33, "ずれ": 0, "記載なし": 35, "未取得": 0}, got["counts"])
        self.assertEqual(0, got["exit_code"])
        self.assertEqual(68, len(got["rows"]))
        reasons = {row["reason"] for row in got["rows"] if row["status"] == "記載なし"}
        self.assertEqual({"source_url_missing"}, reasons)

    def test_exit_2_mismatch(self):
        fixture = copy.deepcopy(self.fixture)
        fixture["default"]["body_text"] = "令和8年4月1日現在法令等"
        got = self.report(fixture)
        self.assertEqual(2, got["exit_code"])
        self.assertEqual(33, got["counts"]["ずれ"])

    def test_exit_3_fetch_failure(self):
        fixture = copy.deepcopy(self.fixture)
        url = self.registry["sources"][0]["url"]
        fixture["responses"] = {url: {"http_status": 503, "body_text": None, "error": "http_error"}}
        got = self.report(fixture)
        self.assertEqual(3, got["exit_code"])
        self.assertGreater(got["counts"]["未取得"], 0)

    def test_exit_4_mismatch_and_failure(self):
        fixture = copy.deepcopy(self.fixture)
        fixture["default"]["body_text"] = "令和8年4月1日現在法令等"
        url = self.registry["sources"][0]["url"]
        fixture["responses"] = {url: {"http_status": 503, "body_text": None, "error": "http_error"}}
        self.assertEqual(4, self.report(fixture)["exit_code"])

    def test_cli_writes_json_and_markdown(self):
        with tempfile.TemporaryDirectory() as tmp:
            json_out, md_out = Path(tmp) / "out.json", Path(tmp) / "out.md"
            rc = module.main(["--fixture", str(ROOT / "tests/fixtures/citation_monitor.json"),
                              "--json", str(json_out), "--markdown", str(md_out)])
            self.assertEqual(0, rc)
            self.assertEqual(68, json.loads(json_out.read_text())["pages"])
            self.assertIn("| /column/ | 記載なし |", md_out.read_text())


if __name__ == "__main__":
    unittest.main()
