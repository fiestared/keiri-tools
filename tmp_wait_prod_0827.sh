#!/bin/bash
# 新記事が本番に出るまで待つ（GitHub Pages のデプロイ待ち）。
URL="https://keiri-tools.com/column/nenkin-seikatsusha-shien-kyufukin/"
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$URL")
  if [ "$code" = "200" ]; then
    echo "LIVE 200 after ${i} tries"
    exit 0
  fi
  sleep 15
done
echo "TIMEOUT last=$code"
exit 1
