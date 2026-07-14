#!/bin/bash
# build_zip.sh — Chromeウェブストアにアップロードする拡張ZIPを作る。
#   bash tools/store/build_zip.sh [出力先ディレクトリ]
#
# 入れるのは**実行に必要なファイルだけ**。README/STORE/テストは入れない
# (ストア審査は同梱物も見る。開発メモや未使用ファイルは減点・混乱のもと)。
# ZIPの中身はmanifest.jsonがルートに来る形にする(フォルダで包まない)。

set -euo pipefail
cd "$(dirname "$0")/../.."            # repo root
SRC="extension/amazon-receipt"
OUT="${1:-$HOME/Desktop/ChromeStore_amazon-receipt}"
VER=$(node -p "require('./$SRC/manifest.json').version")
ZIP="$OUT/amazon-receipt-v$VER.zip"

mkdir -p "$OUT"
rm -f "$ZIP"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

# 同梱するもの(ホワイトリスト。増やすときはmanifestからの参照があることを確かめる)
mkdir -p "$STAGE/src/lib" "$STAGE/icons"
cp "$SRC/manifest.json" "$SRC/selectors.default.json" "$STAGE/"
cp "$SRC/src/background.js" "$SRC/src/content.js" "$STAGE/src/"
# ExtPay.js を忘れないこと: background.js が importScripts で読み込むので、
# 入れ忘れると**service workerが起動時に落ちて拡張が丸ごと死ぬ**(セレクタ取得・ライセンス・
# ダウンロードが全滅する)。2026-07-14までZIPから漏れていた(下の検証が捕まえた)
cp "$SRC/src/lib/scrape.js" "$SRC/src/lib/crawl.js" "$SRC/src/lib/csv.js" \
   "$SRC/src/lib/license.js" "$SRC/src/lib/ExtPay.js" "$STAGE/src/lib/"
cp "$SRC/icons/icon16.png" "$SRC/icons/icon48.png" "$SRC/icons/icon128.png" "$STAGE/icons/"

# ── 検証: manifestが参照するファイルがZIPに全部入っているか ──────────────
# (v0.2で license.js がmanifestから漏れてPro境界が丸ごと死んでいた事故があった。
#  逆向き=「manifestに書いてあるのにZIPに無い」も同じくらい静かに壊れるので機械で見る)
node - "$STAGE" <<'JS'
const fs = require("fs"), path = require("path");
const stage = process.argv[2];
const m = JSON.parse(fs.readFileSync(path.join(stage, "manifest.json"), "utf8"));
const refs = [
  m.background?.service_worker,
  ...(m.content_scripts || []).flatMap(c => [...(c.js || []), ...(c.css || [])]),
  ...Object.values(m.icons || {}),
  ...(m.web_accessible_resources || []).flatMap(w => w.resources || []),
].filter(Boolean);
let bad = 0;
for (const r of refs) {
  if (!fs.existsSync(path.join(stage, r))) { console.error(`❌ manifestが参照するファイルがZIPに無い: ${r}`); bad++; }
}
// 逆向き: ZIPにあるがmanifestからもコードからも参照されないファイル
const all = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p) : all.push(path.relative(stage, p));
  }
})(stage);
const code = all.filter(f => f.endsWith(".js")).map(f => fs.readFileSync(path.join(stage, f), "utf8")).join("\n");
for (const f of all) {
  if (f === "manifest.json" || refs.includes(f)) continue;
  if (!code.includes(path.basename(f))) { console.error(`⚠️  参照の無いファイルが入っている: ${f}`); bad++; }
}
if (m.key || m.update_url) { console.error("❌ manifestに key/update_url が残っている(ストア用では消す)"); bad++; }
console.log(bad ? `\n${bad}件の問題` : `✅ manifest参照 ${refs.length}件すべて同梱・余計なファイル無し`);
process.exit(bad ? 1 : 0);
JS

# 全JSの構文チェック(壊れたJSをアップロードして審査を落とさない)
find "$STAGE" -name "*.js" -print0 | xargs -0 -n1 node --check

( cd "$STAGE" && zip -qr "$ZIP" . -x ".*" )
echo "📦 $ZIP ($(du -h "$ZIP" | cut -f1))"
unzip -Z1 "$ZIP" | sed 's/^/   /'
