#!/usr/bin/env bash
# tests/ 配下を全部走らせる。1つでも落ちたら非ゼロで終わる。
#
# ★なぜ在るか（2026-08-06）: このリポジトリには 130 本のテストがあるのに
#   **全部走らせる1コマンドが無かった**（CLAUDE.md も `node tests/<file>` と書いてある）。
#   その結果 test_qa / test_tool_related / test_x_link / test_year_staleness の
#   **4本が赤いまま誰にも気づかれていなかった**。個別に叩く分には緑に見えるので、
#   「全部走らせる1コマンドが無いこと」自体が穴だった。
#   ai-income-daily でも同じことが起きている（test_revenue_check.py が5日間赤のまま）。
#
# 使い方:
#   ./run_tests.sh            全部走らせる（push 前に必ず通す）
#   ./run_tests.sh -q         赤いものだけ表示する
#   ./run_tests.sh break      名前に break を含むものだけ（壊しテスト）
#   ./run_tests.sh test_qa    名前に test_qa を含むものだけ
set -uo pipefail
cd "$(dirname "$0")"

# ★同時に2つ走らせない（2026-08-07 追加）。
#   壊しテストは本番ファイルを一時的に書き換えて元に戻す。2つ同時に走ると
#   互いの復元を潰し、**作業ツリーが汚れたまま残る**。この repo は自律ワーカーと
#   共有していて、ワーカーがその汚れをそのまま commit する事故が実際に起きている。
#   ★「気をつける」では守れなかった。同じ日に2回、自分で並行実行して踏んだので
#     ランナー自身に排他を持たせる。
LOCK=".run_tests.lock"
if [ -d "$LOCK" ]; then
  OWNER="$(cat "$LOCK/pid" 2>/dev/null)"
  if [ -n "$OWNER" ] && kill -0 "$OWNER" 2>/dev/null; then
    # ★`${}` で必ず囲む。macOS の bash 3.2 は `$OWNER）` の全角括弧を**変数名の一部として読む**ため、
    #   `set -u` 下で「OWNER）: unbound variable」で落ちる。＝ロックが効いた時（＝他が実行中の時）に
    #   **必ずクラッシュし、この親切なメッセージが出ないまま exit 1 になる**。
    #   「同時実行だから中止した」が「テストが落ちた」に化ける（2026-08-13 に実際に踏んだ）。
    echo "★別の run_tests.sh が実行中（pid ${OWNER}）。同時実行は作業ツリーを汚すので中止します。"
    exit 2
  fi
  echo "★残骸ロック（pid ${OWNER:-不明} は不在）を掃除して続行します。"
  rm -rf "$LOCK"
fi
mkdir "$LOCK" 2>/dev/null || { echo "★ロックを取れませんでした。中止します。"; exit 2; }
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT

QUIET=""
[ "${1:-}" = "-q" ] && { QUIET=1; shift; }
FILTER="${1:-}"

shopt -s nullglob
files=(tests/*.mjs)
(( ${#files[@]} )) || { echo "★ tests/ にテストが1つも無い（探索パターンの誤りを疑う）"; exit 2; }

if [ -n "$FILTER" ]; then
  keep=()
  for f in "${files[@]}"; do [[ "$f" == *"$FILTER"* ]] && keep+=("$f"); done
  # ★空判定は**配列を展開する前**に行う。macOS の bash 3.2 は空配列の "${keep[@]}" を
  #   `set -u` で unbound variable として落とすので、順序が逆だと「一致が無い」を伝える前に
  #   line 54 のエラーで死ぬ（＝下の親切なメッセージに到達しない）。
  (( ${#keep[@]} )) || { echo "★ 「${FILTER}」に一致するテストが無い"; exit 2; }  # ${} 必須（上と同じ理由）
  files=("${keep[@]}")
fi

red=()
for f in "${files[@]}"; do
  [ -z "$QUIET" ] && printf '%-46s ' "$f"
  if out=$(node "$f" 2>&1); then
    [ -z "$QUIET" ] && echo "緑"
  else
    [ -z "$QUIET" ] && echo "★赤" || printf '%-46s ★赤\n' "$f"
    red+=("$f")
    printf '%s\n' "$out" | tail -12 | sed 's/^/    | /'
  fi
done

echo
if (( ${#red[@]} )); then
  echo "★赤 ${#red[@]}/${#files[@]} 件:"
  printf '  %s\n' "${red[@]}"
  exit 1
fi
echo "全${#files[@]}ファイル緑"
