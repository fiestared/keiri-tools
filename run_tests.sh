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

QUIET=""
[ "${1:-}" = "-q" ] && { QUIET=1; shift; }
FILTER="${1:-}"

shopt -s nullglob
files=(tests/*.mjs)
(( ${#files[@]} )) || { echo "★ tests/ にテストが1つも無い（探索パターンの誤りを疑う）"; exit 2; }

if [ -n "$FILTER" ]; then
  keep=()
  for f in "${files[@]}"; do [[ "$f" == *"$FILTER"* ]] && keep+=("$f"); done
  files=("${keep[@]}")
  (( ${#files[@]} )) || { echo "★ 「$FILTER」に一致するテストが無い"; exit 2; }
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
