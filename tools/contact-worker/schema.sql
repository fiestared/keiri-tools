-- keiri-tools の問い合わせの受け先（2026-10-22）。道しるべ shirube-contact と同じ形。
-- created_at は UTC（SQLite の datetime('now')）。表示するときは +9h して JST にする。
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS idx_sub_created ON submissions(created_at DESC);
-- レート制限（送り手ごと600秒に5回）。client は日替わりの塩で IP をハッシュにしたもの（IP そのものは持たない）。
CREATE TABLE IF NOT EXISTS contact_rate (
  client TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate ON contact_rate(client, at);
