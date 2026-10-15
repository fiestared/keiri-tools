#!/bin/bash
# 補助金ページのタブ件数（公募中○件）と data-asof だけを、今の時刻で焼き直して push する。
# launchd com.masahiro.hojokin-tabs-rebake が毎日 00:10 JST に動かす。
#
# ★なぜ要るか（2026-10-15 決定・Masahiro 承認）:
#   /hojokin/schedule/ と /hojokin/koyou/ のタブ件数は静的HTMLへの焼き込み（/hojokin/ 本体は JS が表示時に上書き）。
#   焼き直しは update_hojokin.sh（07:50 起点・1日1回成功で STAMP）だけだったので、
#   0:00 に締切を過ぎた公募を 07:50 まで「公募中」として数えていた。
#   update_hojokin.sh に 00:10 を足すと STAMP でその日のデータ取得（07:50）が飛ぶので、
#   **データは取らず、タブだけを焼き直す別ジョブ**にした。
#
# ★やること: 専用クローンを origin/main に reset → gen_hojokin_tabs → --check / --check-age /
#   test_hojokin_sources → 3ページだけ add して commit → push（弾かれたら fetch→rebase で追いつく）。
# ★「変化なし」= 件数が同じ かつ 焼き込みの基準日がもう今日。このときは commit しない
#   （同じ日に手で何度流しても空の commit を積まない）。基準日が昨日なら件数が同じでも
#   data-asof を進めるために commit する（--check-age の 48 時間と「今日の件数」の申告のため）。
# ★ロック: update_hojokin.sh と同じ tools/autodata_lock.sh（同じクローンを reset --hard し合わないため）。
#   相手が動いていれば最大10分待ち、取れなければ降りる（07:50 の update_hojokin が焼き直すので実害は小さい）。
# 🚫 force push しない。🚫 git add -A / . をしない（対象3ページを名指す）。
# 🚫 jGrants 等のデータは取らない（取得は update_hojokin.sh の仕事）。
set -u

DIR="/Users/masahiroyasu/Scripts/keiri-tools"                 # 参照専用（ログとロックの置き場）
WORK="${REBAKE_WORK:-/Users/masahiroyasu/Scripts/keiri-tools-autodata}"   # update_hojokin.sh と共用の専用クローン（検査用に差し替え可）
LOG="${REBAKE_LOG:-$DIR/logs/hojokin_tabs_rebake.log}"
PAGES=(docs/hojokin/index.html docs/hojokin/schedule/index.html docs/hojokin/koyou/index.html)
mkdir -p "$(dirname "$LOG")"
say() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

# ★このファイルは $WORK の中にあり、下で reset --hard する。動いているスクリプトを書き換えないよう、
#   一時コピーに移ってから動く（bash はスクリプトを読みながら実行する）。
if [ -z "${REBAKE_COPY:-}" ]; then
  tmp="$(mktemp -t rebake_hojokin_tabs)" || { say "★一時コピーを作れない"; exit 1; }
  cp "$0" "$tmp" || { say "★一時コピーに失敗"; exit 1; }
  REBAKE_COPY="$tmp" exec /bin/bash "$tmp" "$@"
fi
[ "$REBAKE_COPY" = "$0" ] && rm -f "$0"   # 一時コピーだけを消す（開いたまま消してよい）。REBAKE_COPY=1 を手で付けて本体を消さない

TODAY="$(TZ=Asia/Tokyo date '+%Y-%m-%d')"
NOW_ARG=()
# 検査用: REBAKE_NOW=<JSTのISO> で時計を差し替え、REBAKE_DRY=1 で commit/push しない
if [ -n "${REBAKE_NOW:-}" ]; then NOW_ARG=("--now=$REBAKE_NOW"); TODAY="${REBAKE_NOW:0:10}"; fi
DRY="${REBAKE_DRY:-}"
# 🚫 時計を差し替えたまま本番の専用クローンから push しない（未来の data-asof が本番に出る）。
#   REBAKE_NOW は検査用のクローン（REBAKE_WORK）を指したときだけ push まで進める。
if [ -n "${REBAKE_NOW:-}" ] && [ -z "${REBAKE_WORK:-}" ]; then DRY=1; fi

[ -d "$WORK/.git" ] || { say "★専用クローン $WORK が無い（update_hojokin.sh が作る）"; exit 1; }
. "$WORK/tools/autodata_lock.sh" 2>/dev/null || . "$DIR/tools/autodata_lock.sh" 2>/dev/null \
  || { say "★autodata_lock.sh を読めない"; exit 1; }
if ! autodata_lock 600; then
  say "専用クローンを別のジョブが使っている（10分待っても空かない）。降りる"
  exit 0
fi

# ロックを知らない古い update_hojokin.sh（~/Scripts/keiri-tools が遅れている間）が動いていたら降りる。1回見るだけで待たない
if pgrep -f '/bin/bash .*tools/update_hojokin\.sh' >/dev/null 2>&1; then
  say "update_hojokin.sh が動いている。降りる（あちらがタブも焼き直す）"
  exit 0
fi

cd "$WORK" || { say "★$WORK に入れない"; exit 1; }
export TZ=Asia/Tokyo PYTHONUNBUFFERED=1

gen() { node tools/gen_hojokin_tabs.mjs "$@" ${NOW_ARG[@]+"${NOW_ARG[@]}"}; }   # bash 3.2 は空配列の展開を set -u で落とす

# origin/main に揃えてから焼く（$WORK はこのジョブと update_hojokin.sh 専用なので reset --hard してよい）
fresh() {
  git fetch -q origin main >> "$LOG" 2>&1 || { say "★origin から fetch できない"; return 1; }
  git reset -q --hard origin/main >> "$LOG" 2>&1 && git clean -qfd >> "$LOG" 2>&1
  [ -z "$(git status --porcelain)" ] || { say "★reset 直後なのに $WORK が汚れている。中止"; return 1; }
}

strip_asof() { sed 's/ data-asof="[^"]*"//'; }

checks() {
  local t
  for t in "--check" "--check-age"; do
    gen "$t" >> "$LOG" 2>&1 || { say "★gen_hojokin_tabs $t が赤"; return 1; }
  done
  # test_hojokin_sources は本物の時計で見るので、時計を差し替えた検査（REBAKE_NOW）では流さない
  [ -n "${REBAKE_NOW:-}" ] && return 0
  node tests/test_hojokin_sources.mjs >> "$LOG" 2>&1 || { say "★test_hojokin_sources が赤"; return 1; }
}

push_once() { git push -q origin HEAD:main >> "$LOG" 2>&1; }

fresh || exit 1
before="$(git rev-parse --short HEAD)"
old_today=0; gen --is-today >/dev/null 2>&1 && old_today=1

gen >> "$LOG" 2>&1 || { say "★タブの焼き込みに失敗（タブバーの構造が変わった可能性）"; git checkout -- "${PAGES[@]}"; exit 1; }

# 3ページ以外が変わっていたら前提が崩れている
other="$(git status --porcelain | grep -v -F -e "${PAGES[0]}" -e "${PAGES[1]}" -e "${PAGES[2]}")"
[ -z "$other" ] || { say "★対象3ページ以外が変わった: $other"; git checkout -- "${PAGES[@]}"; exit 1; }

counts_changed=0
for p in "${PAGES[@]}"; do
  if ! diff -q <(git show "HEAD:$p" | strip_asof) <(strip_asof < "$p") >/dev/null; then counts_changed=1; fi
done
n1="$(grep -o 'id="hj-tab-n1" data-asof="[^"]*">[^<]*' "${PAGES[0]}" | sed 's/.*">//')"
asof="$(grep -o 'id="hj-tab-n1" data-asof="[^"]*"' "${PAGES[0]}" | sed 's/.*data-asof="//; s/"$//')"

if [ "$counts_changed" = 0 ] && [ "$old_today" = 1 ]; then
  git checkout -- "${PAGES[@]}"
  say "変化なし（公募中 ${n1}・基準日は既に今日 ${TODAY}）。commit しない"
  exit 0
fi

checks || { git checkout -- "${PAGES[@]}"; exit 1; }

if [ -n "$DRY" ]; then
  say "[DRY] 焼き直した（公募中 ${n1}・基準 ${asof}・件数の変化=${counts_changed}）。commit/push しない"
  git checkout -- "${PAGES[@]}"
  exit 0
fi

git add -- "${PAGES[@]}"
if ! git commit -q -m "補助金タブの件数を焼き直し（公募中 ${n1}・基準 ${asof}）

tools/rebake_hojokin_tabs.sh（毎日 00:10）による自動更新。データは取り直していない。
0:00 に締切を過ぎた公募を、07:50 のデータ更新まで公募中として数えないため。" >> "$LOG" 2>&1; then
  say "★commit に失敗"; exit 1
fi

# ★push が弾かれたら追いついて押し直す（update_hojokin.sh fa26821 と同じ形）。force push はしない。
if ! push_once; then
  say "push が弾かれた。origin に追いついてもう一度試す"
  if ! git fetch -q origin main >> "$LOG" 2>&1 || ! git rebase -q origin/main >> "$LOG" 2>&1; then
    git rebase --abort >/dev/null 2>&1
    say "★追いつけなかった（衝突）。次の起動でやり直す（$WORK は次回 reset --hard で綺麗になる）"
    exit 1
  fi
  if [ "$(git rev-list --count origin/main..HEAD)" = 0 ]; then
    say "追いついたら origin 側に同じ焼き直しが入っていた。push するものは無い"; exit 0
  fi
  # 追いついた先でデータが動いていれば --check が赤になる。そのときだけ焼き直して別の commit を足す（amend しない）
  if ! gen --check >/dev/null 2>&1; then
    gen >> "$LOG" 2>&1 && git add -- "${PAGES[@]}" \
      && git commit -q -m "補助金タブの件数を焼き直し（追いついた先のデータで再計算）" >> "$LOG" 2>&1 \
      || { say "★追いついた後の焼き直しに失敗"; exit 1; }
  fi
  checks || { say "★追いついた後の検査が赤。push しない"; exit 1; }
  push_once || { say "★追いついても push できなかった（認証かネットワークを疑う）"; exit 1; }
  say "  ✓ 追いついて push した"
fi
say "✓ タブを焼き直して push した（公募中 ${n1}・基準 ${asof}・$before → $(git rev-parse --short HEAD)）"
