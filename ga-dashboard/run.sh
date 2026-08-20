#!/bin/zsh
# launchd から呼ばれる入口。build.mjs を回して index.html を作り、
# そのHTMLを payment-manager（Cloudflare Worker）へ預けて /ga で外から見えるようにする。
#
# ★秘密は plist に書かない。payment-manager/.env から読む。
#   トークンを2箇所に置くと必ず片方だけ古くなるので、**わざと同じ .env を共有している**
#   （/ga を出しているのは payment-manager の Worker なので、認証も payment-manager のもの）。
# ★.env が無くても失敗させない。その場合は送信をやめてローカルの index.html だけ作る
#   （手元の画面は外部への送信とは独立して動く）。
set -uo pipefail

cd "$(dirname "$0")"

PM_ENV="$HOME/Scripts/payment-manager/.env"
if [[ -f "$PM_ENV" ]]; then
  set -a
  source "$PM_ENV"
  set +a
  export GA_PUSH_URL="${PM_API_URL:-}"
  export GA_PUSH_TOKEN="${PM_COLLECTOR_TOKEN:-}"
else
  echo "[$(date '+%F %T')] $PM_ENV が無いので /ga への送信はしない" >&2
fi

exec /opt/homebrew/bin/node build.mjs "$@"
