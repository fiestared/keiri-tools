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
# ★自律ワーカー（ai-income-daily）も同じリポジトリを触るが、この仕事は**専用クローン**で
#   完結するのでぶつからない（2026-08-26。旧: ワーカーのロックを見て見送る設計だった）。
set -u

# ─────────────────────────────────────────────────────────────────────────────
# ★★2026-08-26: **この仕事専用のクローンで回す**（DIR ではもう作業しない）
#
# 直した事故（2つ。どちらも「データが黙って止まる」で同じ実害）:
#
#  (1) **push の前に origin へ追いつかない。** ← 今回の停止の原因。
#      このリポジトリには MBP / MacBook Air / 自律ワーカー の3者が push する。
#      誰かが先に push した瞬間、`git push` は
#        ! [rejected] main -> main (fetch first)
#      で落ちる。STAMP は成功時しか書かないので毎回やり直すが、**毎回同じ理由で落ちる**。
#      実測: MBP の logs/hojokin_update.log
#        2026-08-25 18:55:36 ★push に失敗した（コミットは残っている）
#      → データは **2026-08-23 07:54 で止まり、新しい公募13件が3日間サイトに出なかった**
#        （うち1件は締切2日後）。launchctl は `- 1 com.masahiro.hojokin-update` を出していたが、
#        exit 1 は誰も見ていなかった。
#
#  (2) **共有チェックアウトで作業していた。** ワーカーのロックを見て「見送る」設計だったが、
#      2026-08-14〜08-17 に**毎日ぶつかって4日間永久スキップ**した前科がある（下の旧コメント参照）。
#      1日3回に増やして緩和したが、根っこは「同じファイルを複数の主体が触ること」。
#      CLAUDE.md の結論はこうだ: **守るかどうかに依存しない形にする＝ファイルを共有しない。**
#
# → この2つをまとめて消す。**専用クローン $WORK で完結させる。**
#   ・毎回 origin/main に `reset --hard` してから始める（前回 push に失敗した残骸も自動で消える＝自己修復）
#   ・$WORK は誰も手で触らないので、rebase も reset も安全
#   ・ワーカーのロックを見る必要が無くなった（ファイルを共有していないので、ぶつかりようがない）

DIR="/Users/masahiroyasu/Scripts/keiri-tools"                 # ★参照専用。ここにはもう書かない
WORK="/Users/masahiroyasu/Scripts/keiri-tools-autodata"       # ★この仕事だけのクローン
# ★SSH で持つ（2026-08-26）。HTTPS だと GitHub トークンの失効で無言で死ぬ —
#   実際 MBP のトークンが切れて private リポジトリの同期が4時間止まり、
#   誰も気づかなかった。鍵は失効しない。
REMOTE="git@github.com:fiestared/keiri-tools.git"
PY="/opt/homebrew/bin/python3.14"
LOG="$DIR/logs/hojokin_update.log"
mkdir -p "$(dirname "$LOG")"

say() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

# ★その日に成功していたら、何もしないで降りる（2026-08-17 追加）。
#   1日に3回起動するので、これが無いと同じ日に何度も fetch して push する。
STAMP="$DIR/logs/.hojokin_last_success"
TODAY="$(TZ=Asia/Tokyo date '+%Y-%m-%d')"
if [ -r "$STAMP" ] && [ "$(cat "$STAMP")" = "$TODAY" ]; then
  exit 0
fi

# ★専用クローンが無ければ作る。ローカルから複製してから origin を GitHub に向け直す
#   （ネットワークから 82MB を引き直さない）。
if [ ! -d "$WORK/.git" ]; then
  say "専用クローンを作る: $WORK"
  if ! git clone -q "$DIR" "$WORK" >> "$LOG" 2>&1; then
    say "★クローンに失敗した"
    exit 1
  fi
  git -C "$WORK" remote set-url origin "$REMOTE"
fi

cd "$WORK" || { say "★$WORK に入れない"; exit 1; }

# ★毎回 origin/main から始める。前回 push に失敗した残骸もここで消える（自己修復）。
#   ★reset --hard を許せるのは **$WORK が この仕事の専用クローンだから**。
#     🚫 共有チェックアウトで同じことをしたら、他人の作業を消す。
if ! git fetch -q origin main >> "$LOG" 2>&1; then
  say "★origin から fetch できない（ネットワークか認証）"
  exit 1
fi
git reset -q --hard origin/main >> "$LOG" 2>&1
git clean -qfd >> "$LOG" 2>&1

# ★ここは reset --hard の直後なので必ず綺麗なはず。汚れていたら前提が崩れている
#   （$WORK を人が触った等）。黙って続けず、気づけるように落とす。
if [ -n "$(git status --porcelain)" ]; then
  say "★reset --hard の直後なのに $WORK が汚れている。人が触った可能性。中止する"
  exit 1
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

# ★★push は「押せなかったら諦める」にしない（2026-08-26。これが3日停止の原因）。
#   取得〜commit の間に誰かが push していると rejected になる。1回だけ追いついて押し直す。
#   それでも駄目なら次の起動（1日3回）が reset --hard からやり直す＝自己修復するので、
#   ここで残骸を抱えたまま終わらない。
push_once() { git push -q origin main >> "$LOG" 2>&1; }

if ! push_once; then
  say "push が弾かれた。origin に追いついてもう一度試す"
  if ! git fetch -q origin main >> "$LOG" 2>&1 || ! git rebase -q origin/main >> "$LOG" 2>&1; then
    git rebase --abort >/dev/null 2>&1
    say "★追いつけなかった。次の起動でやり直す（$WORK は次回 reset --hard で綺麗になる）"
    exit 1
  fi
  if ! push_once; then
    say "★追いついても push できなかった（認証かネットワークを疑う）"
    exit 1
  fi
  say "  ✓ 追いついて push した"
fi

say "✓ ${n}件で更新して push した ($before → $(git rev-parse --short HEAD))"
echo "$TODAY" > "$STAMP"   # ★今日は成功。同日の後続の起動は先頭で降りる
