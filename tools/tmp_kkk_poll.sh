#!/bin/bash
# 本番デプロイの到達を待つ。★404が先で200が後＝デプロイ待ちであって否定キャッシュではない。
URL="https://keiri-tools.com/column/kodomo-kosodate-kyoshutsukin/"
for i in $(seq 1 12); do
  code=$(curl -s -o /Users/masahiroyasu/Scripts/keiri-tools/tools/tmp_kkk_prod.html -w "%{http_code}" "$URL")
  echo "try$i=$code"
  if [ "$code" = "200" ]; then
    echo "LIVE"
    exit 0
  fi
  sleep 20
done
echo "STILL_NOT_LIVE"
exit 1
