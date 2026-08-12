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

# ★ワーカーが動いていたら降りる（同じ repo を同時に触ると片方の変更が消える）
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

# ★件数が極端に減っていたら push しない。APIの一時不調で中身を空にしないため。
n="$("$PY" -c "import json;print(len(json.load(open('docs/assets/hojokin_jgrants.json'))['subsidies']))" 2>/dev/null || echo 0)"
if [ "${n:-0}" -lt 50 ]; then
  say "★取得できたのが ${n}件 しかない。異常とみなして差し戻す"
  git checkout -- docs/assets/hojokin_jgrants.json
  exit 1
fi

if git diff --quiet -- docs/assets/hojokin_jgrants.json; then
  say "変化なし（${n}件）"
  exit 0
fi

# 検査を通してから push（壊れたデータを本番へ出さない）
if ! node tests/test_hojokin.mjs >> "$LOG" 2>&1; then
  say "★test_hojokin が赤。差し戻す"
  git checkout -- docs/assets/hojokin_jgrants.json
  exit 1
fi

git add docs/assets/hojokin_jgrants.json
git commit -q -m "補助金データを更新（${n}件・jGrants公開APIの掃引）

出典：Jグランツ（編集・加工しています）
tools/update_hojokin.sh による自動更新。締切が過ぎたものは表示側でも外しているが、
新しく始まった公募を載せるためデータ自体を取り直している。" >> "$LOG" 2>&1

if git push -q origin main >> "$LOG" 2>&1; then
  say "✓ ${n}件で更新して push した ($before → $(git rev-parse --short HEAD))"
else
  say "★push に失敗した（コミットは残っている）"
  exit 1
fi
