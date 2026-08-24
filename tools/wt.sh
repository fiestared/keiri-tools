#!/bin/bash
# 並列作業を git worktree で物理的に分ける。
#
#   tools/wt.sh new  <名前>   自分専用の作業場を作る
#   tools/wt.sh list          いま誰が何を持っているか
#   tools/wt.sh status        競合の兆候を見る（触る前にこれ）
#   tools/wt.sh done <名前>   main に取り込んで作業場を畳む
#
# ★なぜ要るか（2026-08-24 に実害が出た）:
#   同じ ~/Scripts/keiri-tools を **3つの Claude が同時に書いていた**。
#   ①ターミナルのセッション ②別の Orca ペイン ③launchd の自律ワーカー。
#   互いを知らないまま同じファイルを書き、**一方の44ページぶんの変更が黙って消えた**
#   （気づいたのは偶然で、テストは緑のままだった）。
#   さらに作業ツリーに 208 ファイルの未コミット差分が混ざり、
#   誰かが `git add .` を打てば他人の未レビューの変更まで載る状態になっていた。
#
# ★設計（規律ではなく構造で防ぐ）:
#   規律（「並列中は全ページ生成器を流さない」）は CLAUDE.md に既にあったが、
#   **守った側だけが損をした**（自制したワーカーの記事登録が、
#   自制しなかった側の生成器実行に巻き込まれた）。
#   守るかどうかに依存しない形にする ＝ **ファイルを共有しない**。
#
#     ~/Scripts/keiri-tools          main   ← ワーカー専用。ここが GitHub Pages の公開元
#     ~/Scripts/keiri-tools-<名前>   wt/<名前> ← 対話セッションはここで作業する
#
#   worktree は同じ .git を共有するので履歴は1本のまま。ディスクは docs/ の実体ぶんだけ増える。
#   package.json が無いリポジトリなので、作業場を作った直後から test も生成器も動く。
set -u

ROOT="/Users/masahiroyasu/Scripts/keiri-tools"
# ★置き場は「既にそうなっているもの」に合わせる（2026-08-24 12:29 に別セッションが
#   ~/Scripts/keiri-tools-ctr を作っていた）。規約を2つ作らない。
WTPREFIX="/Users/masahiroyasu/Scripts/keiri-tools-"
cd "$ROOT" || exit 1

die() { echo "✗ $*" >&2; exit 1; }

cmd_status() {
  echo "=== main（${ROOT}）==="
  echo "  HEAD        : $(git log -1 --format='%h %s' | cut -c1-64)"
  local dirty; dirty=$(git status --porcelain | wc -l | tr -d ' ')
  echo "  未コミット  : ${dirty} ファイル"
  [ "$dirty" -gt 20 ] && echo "     ⚠️  他のセッションが作業中の可能性。main では書かないこと"
  echo
  echo "=== 作業場 ==="
  git worktree list | sed 's|^|  |'
  echo
  echo "=== 動いている claude プロセス ==="
  local n; n=$(pgrep -f "claude --dangerously" 2>/dev/null | wc -l | tr -d ' ')
  echo "  ${n} 個"
  [ "$n" -gt 1 ] && echo "     ⚠️  複数動いている。必ず自分の作業場で作業すること"
  echo
  echo "=== 定期ワーカー ==="
  launchctl list 2>/dev/null | grep -E "aibot.*(daily|pulse)" | sed 's|^|  |' || echo "  未登録"
}

cmd_new() {
  local name="${1:-}"
  [ -n "$name" ] || die "名前が要る: tools/wt.sh new <名前>"
  echo "$name" | grep -qE '^[a-z0-9][a-z0-9-]*$' || die "名前は英小文字・数字・ハイフンのみ: $name"
  local dir="${WTPREFIX}${name}" br="wt/$name"
  [ -e "$dir" ] && die "既にある: $dir"
  git show-ref --verify --quiet "refs/heads/$br" && die "ブランチが既にある: ${br}（tools/wt.sh done $name で畳むか、別名を使う）"

  # ★分岐元は必ず**ローカル main**。origin/main にしてはいけない（2026-08-24 実測）。
  #   このリポジトリは push が運用者判断なので、ローカル main が origin より先行している
  #   のが常態（実測: 2コミット先行）。origin/main から切ると、
  #   **他セッションが入れたばかりの変更が欠けた作業場が黙って出来る**。
  #   最初にそう書いて実際に踏んだ: 作った作業場に gen_trust_footer.mjs が無く、
  #   --check がエラーで落ちた。エラーの形が「テストが赤い」と見分けにくい。
  local base="main"
  local ahead; ahead=$(git rev-list --count origin/main..main 2>/dev/null || echo 0)
  [ "${ahead:-0}" -gt 0 ] && echo "  （main は origin より ${ahead} コミット先行。ローカル main から切る）"
  git worktree add -b "$br" "$dir" "$base" || die "worktree の作成に失敗した"
  echo
  echo "✓ 作業場を作った"
  echo "    cd $dir"
  echo "    ブランチ: ${br}（分岐元 ${base}）"
  echo "  ★以後この中だけで作業する。$ROOT は触らない（あそこはワーカーのもの）"
  echo "  ★終わったら: $ROOT/tools/wt.sh done $name"
}

cmd_list() {
  git worktree list | while read -r dir rest; do
    local br; br=$(echo "$rest" | sed -n 's/.*\[\(.*\)\]/\1/p')
    local d; d=$(git -C "$dir" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    printf "  %-52s %-16s 未コミット %s\n" "$dir" "${br:-detached}" "$d"
  done
}

cmd_done() {
  local name="${1:-}"
  [ -n "$name" ] || die "名前が要る: tools/wt.sh done <名前>"
  local dir="${WTPREFIX}${name}" br="wt/$name"
  [ -d "$dir" ] || die "作業場が無い: $dir"

  local d; d=$(git -C "$dir" status --porcelain | wc -l | tr -d ' ')
  [ "$d" -eq 0 ] || die "作業場に未コミットの変更が ${d} 件ある。先に $dir でコミットすること"

  # ★main が汚れているなら自動マージしない。
  #   別のセッションが作業中の作業ツリーに merge を打つのは、この仕組みが防ごうとしている事故そのもの。
  local md; md=$(git status --porcelain | wc -l | tr -d ' ')
  if [ "$md" -ne 0 ]; then
    echo "⚠️  main の作業ツリーに未コミットの変更が ${md} 件ある（別セッションが作業中の可能性）。"
    echo "    自動マージはしない。手が空いたら次を実行:"
    echo "      cd $ROOT && git merge --no-ff $br"
    echo "      cd $ROOT && git worktree remove $dir && git branch -d $br"
    exit 2
  fi

  git merge --no-ff "$br" -m "merge $br" || die "マージが衝突した。$ROOT で解消すること"
  git worktree remove "$dir" && git branch -d "$br"
  echo "✓ $br を main に取り込み、作業場を畳んだ"
  echo "  ★公開は push で走る（GitHub Pages）。push は運用者かワーカーの判断で。"
}

case "${1:-}" in
  new)    shift; cmd_new "$@" ;;
  list)   cmd_list ;;
  status) cmd_status ;;
  done)   shift; cmd_done "$@" ;;
  *)      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
