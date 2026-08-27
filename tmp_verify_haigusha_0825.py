#!/usr/bin/env python3
"""記事の主張を条文コーパスに当てて確かめる。"""
import json, pathlib, re

texts = json.loads(pathlib.Path("/tmp/haigusha_corpus_0825.json").read_text(encoding="utf-8"))
minpo = texts["民法"]

# 1041条（配偶者短期居住権への準用）の中身
i = minpo.find("第千四十一条")
print("--- 民法1041条まわり ---")
print(minpo[i:i + 200])

print()
print("--- 1037条ただし書に「放棄」が在るか ---")
j = minpo.find("第千三十七条")
k = minpo.find("第千三十八条")
art1037 = minpo[j:k]
print("1037条の長さ %d字 / 「放棄」%d回 / 「第八百九十一条」%d回 / 「廃除」%d回"
      % (len(art1037), art1037.count("放棄"), art1037.count("第八百九十一条"), art1037.count("廃除")))

print()
print("--- 対照: 民法全体で「放棄」は %d回（＝語そのものは存在する）---" % minpo.count("放棄"))

print()
print("--- 891条の見出し ---")
m = minpo.find("第八百九十一条")
print(minpo[m:m + 120])

print()
print("--- 1028条ただし書（共有）---")
n = minpo.find("第千二十八条")
print(minpo[n:n + 300])

print()
print("--- 算術（記事に載せる設例）---")
tatemono = 23_000_000
tochi = 30_000_000
taiyo = 33          # 22年 × 1.5（施行令5条の7第2項）
keika = 10
zonzoku = 12
fukuri = 0.701      # 年3%・12年
zan = (taiyo - keika - zonzoku) / (taiyo - keika)
print("(33-10-12)/(33-10) = %d/%d = %s" % (taiyo - keika - zonzoku, taiyo - keika, zan))
kojo = tatemono * zan * fukuri
print("建物の控除額 = %s × %s × %s = %s" % (format(tatemono, ","), zan, fukuri, format(kojo, ",.0f")))
print("配偶者居住権   = %s" % format(tatemono - kojo, ",.0f"))
print("建物の所有権   = %s" % format(kojo, ",.0f"))
shikichi = tochi - tochi * fukuri
print("敷地利用権     = %s − %s = %s" % (format(tochi, ","), format(tochi * fukuri, ",.0f"), format(shikichi, ",.0f")))
print("土地の所有権   = %s" % format(tochi * fukuri, ",.0f"))
print("配偶者の取り分 = %s" % format((tatemono - kojo) + shikichi, ",.0f"))
print("子の取り分     = %s" % format(kojo + tochi * fukuri, ",.0f"))
print("合計           = %s（元の %s と一致するか）" %
      (format((tatemono - kojo) + shikichi + kojo + tochi * fukuri, ",.0f"), format(tatemono + tochi, ",")))
print()
print("複利現価率の検算: 1/1.03^12 = %.6f" % (1 / (1.03 ** 12)))
