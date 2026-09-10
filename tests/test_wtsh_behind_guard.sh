#!/bin/bash
# wt.sh new の behind ガードを、隔離したテスト用リポジトリで確かめる。
#
#   bash tests/test_wtsh_behind_guard.sh tools/wt.sh
#
# なぜ在るか（2026-09-10）: wt.sh は ahead だけを数えて behind を見ていなかった。
# 実測で ahead 4 / behind 26 のとき、**公開済み26コミットが欠けた作業場**が黙って出来た。
# エラーにならないので気づけない。ガードは規律ではなく検査で守る。
# ★このテストは壊しテストを兼ねる: 修正前の wt.sh を渡すと 2合格/3不合格 になる
#   （通るべき2件が通り、落ちるべき3件が落ちない）。常に赤ではないことの確認。
# 実物の ~/Scripts/keiri-tools には一切触らない（ROOT/WTPREFIX を差し替えた複製で試す）。
set -u
SRC="$1"                       # 検査したい wt.sh
T=$(mktemp -d)
pass=0; fail=0
ok(){ echo "  ✓ $1"; pass=$((pass+1)); }
ng(){ echo "  ✗ $1"; fail=$((fail+1)); }

mk() {  # mk <case> <ahead> <behind> ; 上流つきのリポジトリを作る
  local c=$1 a=$2 b=$3
  local up="$T/$c/up.git" wk="$T/$c/root"
  mkdir -p "$T/$c"
  git init -q --bare "$up"
  git init -q -b main "$wk"
  git -C "$wk" -c user.email=t@t -c user.name=t commit -q --allow-empty -m base
  git -C "$wk" remote add origin "$up"
  git -C "$wk" push -q origin main
  local i
  for ((i=0;i<b;i++)); do git -C "$wk" -c user.email=t@t -c user.name=t commit -q --allow-empty -m "up$i"; done
  [ "$b" -gt 0 ] && { git -C "$wk" push -q origin main; git -C "$wk" reset -q --hard "HEAD~$b"; }
  for ((i=0;i<a;i++)); do git -C "$wk" -c user.email=t@t -c user.name=t commit -q --allow-empty -m "loc$i"; done
  git -C "$wk" fetch -q origin
  # ROOT/WTPREFIX を差し替えた wt.sh を置く
  mkdir -p "$wk/tools"
  sed -e "s|^ROOT=.*|ROOT=\"$wk\"|" -e "s|^WTPREFIX=.*|WTPREFIX=\"$T/$c/wt-\"|" "$SRC" > "$wk/tools/wt.sh"
  echo "$T/$c"
}

run() { # run <case> <ahead> <behind> <期待: ok|stop>
  local c=$1 a=$2 b=$3 want=$4 d out rc
  d=$(mk "$c" "$a" "$b")
  out=$(bash "$d/root/tools/wt.sh" new probe 2>&1); rc=$?
  local made=no; [ -d "$d/wt-probe" ] && made=yes
  if [ "$want" = ok ]; then
    { [ $rc -eq 0 ] && [ $made = yes ]; } && ok "$c (ahead=$a behind=$b) → 作れた" \
      || { ng "$c: 作れるはずが rc=$rc made=$made"; echo "$out" | sed 's/^/      /'; }
  else
    { [ $rc -ne 0 ] && [ $made = no ]; } && ok "$c (ahead=$a behind=$b) → 作る前に止まった" \
      || { ng "$c: 止まるはずが rc=$rc made=$made"; echo "$out" | sed 's/^/      /'; }
  fi
}

echo "== 通るべきものが通る =="
run same  0 0 ok
run ahead 2 0 ok
echo "== 落ちるべきものが落ちる =="
run behind  0 3 stop
run diverged 2 3 stop
echo "== fetch が失敗したら「遅れゼロ」に見せない =="
d=$(mk fetchfail 0 0)
git -C "$d/root" remote set-url origin "$T/nonexistent.git"
out=$(bash "$d/root/tools/wt.sh" new probe 2>&1); rc=$?
made=no; [ -d "$d/wt-probe" ] && made=yes
{ [ $rc -ne 0 ] && [ $made = no ]; } && ok "fetchfail → 作る前に止まった" \
  || { ng "fetchfail: 止まるはずが rc=$rc made=$made"; echo "$out" | sed 's/^/      /'; }

echo
echo "合格 $pass / 不合格 $fail"
rm -rf "$T"
[ $fail -eq 0 ]
