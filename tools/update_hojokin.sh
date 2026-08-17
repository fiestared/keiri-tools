#!/bin/bash
# 補助金データ（jGrants）を取り直して、変わっていればコミットして push する。
#
# ★なぜ自動更新が要るか:
#   締切は毎日過ぎていく。実測で**30日以内に締切を迎えるものが全体の約17%**あり、
#   放っておくと「もう出せない補助金」を公募中として見せることになる。
#   ページ側でも表示のたびに今日と突き合わせて締切超過を外しているが、
#   それだけでは**新しく始まった公募が載らない**ので、データ自体の更新が要る。
#
# ★python は**マイナー版まで固定**する。`python3` のままだと brew の更新で
#   張り替わって無言で死ぬ（過去に定時ジョブがそれで止まった）。
#
# ★push 先は明示する。このリポジトリは origin = fiestared/keiri-tools。
#
# ★自律ワーカー（ai-income-daily）も同じリポジトリを触る。競合を避けるため、
#   ワーカーのロックが在るときは何もしないで降りる。
set -u

DIR="/Users/masahiroyasu/Scripts/keiri-tools"
PY="/opt/homebrew/bin/python3.14"
LOCK="/Users/masahiroyasu/Scripts/ai-income-daily/data/.worker.lock"
LOG="$DIR/logs/hojokin_update.log"
mkdir -p "$(dirname "$LOG")"

say() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

# ★その日に成功していたら、何もしないで降りる（2026-08-17 追加）。
#   下のワーカー回避と対で必要。1日に複数回起動するようにしたので、
#   これが無いと同じ日に何度も fetch して push する。
STAMP="$DIR/logs/.hojokin_last_success"
TODAY="$(TZ=Asia/Tokyo date '+%Y-%m-%d')"
if [ -r "$STAMP" ] && [ "$(cat "$STAMP")" = "$TODAY" ]; then
  exit 0
fi

# ★ワーカーが動いていたら降りる（同じ repo を同時に触ると片方の変更が消える）
#
# ★★2026-08-17 修正: ここは**降りたら終わり**だったため、4日間データが止まっていた。
#   実測: ワーカーは毎時0分に起動して22〜95分かかる（中央値30分）。
#   この便は 7:20 の1回だけだったので、**毎日必ずワーカーと被って永久にスキップ**していた。
#     08-13 07:25 ✓ 更新して push
#     08-14〜08-17 07:20 「ワーカーが作業中。今回は見送る」×4日
#   → 1日3回（7:50 / 12:50 / 18:50）に増やし、上の「その日に成功したら降りる」で
#     重複を防ぐ。**1回でも通れば良い**設計にする。
#   ★「見送る」を作るときは、必ず**次にいつ試すか**を決めること。
#     再試行の無い skip は、条件が毎回成立すると永久停止になる。
if [ -d "$LOCK" ]; then
  pid="$(cat "$LOCK/pid" 2>/dev/null || echo '')"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    say "ワーカーが作業中（pid ${pid}）。今回は見送る"
    exit 0
  fi
  say "ロックが残っているが持ち主(pid $pid)は居ない。続行する"
fi

cd "$DIR" || { say "★$DIR に入れない"; exit 1; }

# ★未コミットの変更がある状態で走らせない（人の作業中に巻き込むため）
if [ -n "$(git status --porcelain -- docs/assets/hojokin_jgrants.json)" ]; then
  say "★補助金データに未コミットの変更がある。人が触っている可能性があるので見送る"
  exit 0
fi

before="$(git rev-parse HEAD)"
if ! "$PY" tools/fetch_jgrants.py >> "$LOG" 2>&1; then
  say "★取得に失敗した（データは差し替えていない）"
  exit 1
fi

# ★jGrants 以外の2つ。**失敗しても本体は続ける**（片方が落ちても補助金の一覧は出す）。
#   どちらもスクリプト側に件数ガードがあり、痩せたら自分で書き出しを止める。
for extra in fetch_kokunai_schedule fetch_koyou_joseikin; do
  if ! "$PY" "tools/${extra}.py" >> "$LOG" 2>&1; then
    say "★${extra} が失敗した（前回のデータを残して続行する）"
    git checkout -- docs/assets/hojokin_schedule.json docs/assets/koyou_joseikin.json 2>/dev/null
  fi
done

# ★件数が極端に減っていたら push しない。APIの一時不調で中身を空にしないため。
n="$("$PY" -c "import json;print(len(json.load(open('docs/assets/hojokin_jgrants.json'))['subsidies']))" 2>/dev/null || echo 0)"
if [ "${n:-0}" -lt 50 ]; then
  say "★取得できたのが ${n}件 しかない。異常とみなして差し戻す"
  git checkout -- docs/assets/hojokin_jgrants.json
  exit 1
fi

if git diff --quiet -- docs/assets/hojokin_jgrants.json docs/assets/hojokin_schedule.json docs/assets/koyou_joseikin.json; then
  say "変化なし（${n}件）"
  echo "$TODAY" > "$STAMP"   # ★取得は成功している＝今日の確認は済み
  exit 0
fi

# ★カードを焼き直す。制度名が変わっていたら生成が落ちるので、そこで気づける
if ! node tools/gen_hojokin_cards.mjs >> "$LOG" 2>&1; then
  say "★カードの生成に失敗（制度名が変わった可能性）。データを差し戻して中止する"
  git checkout -- docs/assets/ 2>/dev/null
  exit 1
fi

# ★タブの件数（3ページ×3タブ）を焼き直す。データが動けば件数も動くので、ここで必ず一緒に更新する。
#   忘れると「昨日の件数がタブに出たまま」になり、検索結果の件数と食い違う（2026-08-13 追加）
if ! node tools/gen_hojokin_tabs.mjs >> "$LOG" 2>&1; then
  say "★タブ件数の焼き込みに失敗（タブバーの構造が変わった可能性）。データを差し戻して中止する"
  git checkout -- docs/assets/ 2>/dev/null
  exit 1
fi

# ★「もらった後の経理・税務」への導線。記事がrename/削除されたら生成が落ちて気づける（2026-08-14 追加）
if ! node tools/gen_hojokin_after.mjs >> "$LOG" 2>&1; then
  say "★『もらった後』導線の生成に失敗（記事が消えたかrenameされた可能性）。中止する"
  git checkout -- docs/assets/ 2>/dev/null
  exit 1
fi

# 検査を通してから push（壊れたデータを本番へ出さない）
if ! node tests/test_hojokin.mjs >> "$LOG" 2>&1 || ! node tests/test_hojokin_sources.mjs >> "$LOG" 2>&1 || ! node tests/test_hojokin_cards.mjs >> "$LOG" 2>&1; then
  say "★test_hojokin が赤。差し戻す"
  git checkout -- docs/assets/hojokin_jgrants.json
  exit 1
fi

# ★docs/hojokin も add する（2026-08-14 修正）。gen_hojokin_tabs / gen_hojokin_after は
#   docs/hojokin/*/index.html を書き換えるのに add の対象外で、**生成しても永久に
#   コミットされず、作業ツリーを汚したまま**だった（タブの件数が本番で更新されない）。
git add docs/assets/hojokin_jgrants.json docs/assets/hojokin_schedule.json docs/assets/koyou_joseikin.json docs/column docs/hojokin
git commit -q -m "補助金データを更新（${n}件・jGrants公開APIの掃引）

出典：Jグランツ（編集・加工しています）
tools/update_hojokin.sh による自動更新。締切が過ぎたものは表示側でも外しているが、
新しく始まった公募を載せるためデータ自体を取り直している。" >> "$LOG" 2>&1

if git push -q origin main >> "$LOG" 2>&1; then
  say "✓ ${n}件で更新して push した ($before → $(git rev-parse --short HEAD))"
  echo "$TODAY" > "$STAMP"   # ★今日は成功。同日の後続の起動は先頭で降りる
else
  say "★push に失敗した（コミットは残っている）"
  exit 1
fi
