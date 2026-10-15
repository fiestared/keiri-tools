# 専用クローン ~/Scripts/keiri-tools-autodata を使う定時ジョブどうしのロック（source して使う）。
#
# ★なぜ要るか（2026-10-15）:
#   update_hojokin.sh（07:50/12:50/18:50）と rebake_hojokin_tabs.sh（00:10）は同じ専用クローンで
#   reset --hard → 生成 → commit → push をする。時刻は離してあるが、Mac が夜に閉じていると
#   launchd は起きた直後に**取りこぼした起動をまとめて走らせる**ので、2つが同時に動きうる。
#   片方の reset --hard が、もう片方の生成途中のファイルや commit を消す。
#
# 使い方: . tools/autodata_lock.sh; autodata_lock <待つ秒数> || { 降りる; }
#   取れたら 0（EXIT で自動的に外す）。待っても取れなければ 1。
#   持ち主の PID が死んでいるロックは外して取り直す。
#   🚫 pgrep で相手を探して待たない（他セッションの同名プロセスに一致して永久待ちになる）。

AUTODATA_LOCK="${AUTODATA_LOCK:-/Users/masahiroyasu/Scripts/keiri-tools/logs/.autodata.lock}"   # 検査用に差し替え可

autodata_lock() {
  local wait="${1:-0}" waited=0 op
  mkdir -p "$(dirname "$AUTODATA_LOCK")"
  while :; do
    if mkdir "$AUTODATA_LOCK" 2>/dev/null; then
      echo $$ > "$AUTODATA_LOCK/pid"
      trap 'rm -rf "$AUTODATA_LOCK"' EXIT
      return 0
    fi
    op="$(cat "$AUTODATA_LOCK/pid" 2>/dev/null)"
    if [ -n "$op" ] && ! kill -0 "$op" 2>/dev/null; then
      rm -rf "$AUTODATA_LOCK"; continue      # 持ち主が死んでいる
    fi
    [ "$waited" -ge "$wait" ] && return 1
    sleep 5; waited=$((waited + 5))
  done
}
