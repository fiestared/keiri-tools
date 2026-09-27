import socket
import sys
import unittest
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from citation_fetch import fetch_citations


class Response:
    def __init__(self, code=200, url="https://example.test/final", body=b"body"):
        self.code, self.url, self.body = code, url, body
    def __enter__(self): return self
    def __exit__(self, *_): return False
    def getcode(self): return self.code
    def geturl(self): return self.url
    def read(self): return self.body


class MockOpener:
    def __init__(self, routes):
        self.routes, self.calls = routes, []
    def open(self, url, timeout):
        self.calls.append((url, timeout))
        value = self.routes[url]
        if isinstance(value, Exception):
            raise value
        return value


class Clock:
    def __init__(self): self.value, self.starts = 0.0, []
    def __call__(self): return self.value
    def sleep(self, seconds): self.value += seconds


class CitationFetchTests(unittest.TestCase):
    def test_status_redirect_timeout_and_dedup(self):
        urls = ["https://x/ok", "https://x/503", "https://x/timeout", "https://x/302-404", "https://x/offsite", "https://x/ok"]
        routes = {
            urls[0]: Response(200, urls[0], b"ok"),
            urls[1]: urllib.error.HTTPError(urls[1], 503, "busy", {}, None),
            urls[2]: socket.timeout(),
            urls[3]: urllib.error.HTTPError("https://x/missing", 404, "missing", {}, None),
            urls[4]: Response(200, "https://other.example/page", b"moved"),
        }
        opener, clock = MockOpener(routes), Clock()
        got = fetch_citations(urls, opener=opener, clock=clock, sleep=clock.sleep, now=lambda: "2026-09-25T05:00:00Z")
        self.assertEqual(len(got), 5)
        self.assertEqual(len(opener.calls), 5)
        self.assertEqual(got[0]["original"]["http_status"], 200)
        self.assertEqual(got[1]["original"]["http_status"], 503)
        self.assertEqual(got[2]["original"]["error"], "timeout")
        self.assertEqual(got[3]["original"]["final_url"], "https://x/missing")
        self.assertEqual(got[3]["original"]["http_status"], 404)
        self.assertTrue(got[3]["original"]["redirected"])
        self.assertEqual(got[4]["original"]["final_url"], "https://other.example/page")
        self.assertTrue(got[4]["original"]["redirected"])
        self.assertTrue(got[0]["original"]["body_sha256"])
        self.assertEqual(clock.value, 4.0)

    def test_only_2665_shelf_mismatch_gets_one_recorded_alternate(self):
        original = "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2665.htm"
        alternate = "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2665.htm"
        opener, clock = MockOpener({
            original: urllib.error.HTTPError(original, 404, "missing", {}, None),
            alternate: Response(200, alternate, b"found"),
        }), Clock()
        got = fetch_citations([original], opener=opener, clock=clock, sleep=clock.sleep)
        self.assertEqual(got[0]["original"]["http_status"], 404)
        self.assertEqual(got[0]["alternate"]["http_status"], 200)
        self.assertEqual(got[0]["alternate"]["url"], alternate)
        self.assertEqual(len(opener.calls), 2)
        self.assertEqual(clock.value, 1.0)

    def test_non_2665_failure_has_no_fallback(self):
        url = "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/9999.htm"
        opener = MockOpener({url: urllib.error.HTTPError(url, 404, "missing", {}, None)})
        got = fetch_citations([url], opener=opener)
        self.assertIsNone(got[0]["alternate"])
        self.assertEqual(len(opener.calls), 1)


if __name__ == "__main__":
    unittest.main()
