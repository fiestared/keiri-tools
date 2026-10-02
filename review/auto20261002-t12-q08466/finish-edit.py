from pathlib import Path
import json
for f in ['docs/jidoshazei/index.html','docs/assets/jidoshazei_core.js']:
 p=Path(f);s=p.read_text().replace('4月1日現在の所有者（所有権留保付き売買では買主）','4月1日現在の所有者');p.write_text(s)
p=Path('docs/assets/jidoshazei_r08.json');d=json.loads(p.read_text())
d['_meta']['label']='自家用乗用の登録車・四輪以上の軽自動車の令和8年度標準税率、燃料別・基準日別の重課、新規登録の月割'
d['_meta']['source']='東京都主税局の自家用乗用車の新旧税率表・重課月割税額表、グリーン化の説明／大阪市の軽自動車税率表。登録車は令和元年10月1日、軽は平成27年4月1日を初回登録・検査の新旧境界とする。金額・適用条件の固定正本との照合記録はclaims/jidoshazei.jsonを参照。'
d['_meta']['scope_note']='自家用乗用の登録車と四輪以上の軽自動車の標準税率による試算。営業用・貨物・バス・特種用途・三輪・二輪・原付は対象外。重課の適用有無は利用者が指定。軽課は令和7年度初度登録の自家用乗用登録車EV・燃料電池車に対する令和8年度6,500円のみ対応。その他の軽課・課税免除・申請減免は対象外。東京都の登録車の通知は通常5月上旬だが、4月1日に車検切れの場合は送付差止め。'
d['passenger']['ev_green']['note']='令和7年度初度登録の自家用乗用登録車の電気自動車・燃料電池車は、令和8年度に概ね75%軽課（年額6,500円）を適用します。東京都のZEV課税免除等は試算対象外です。'
d['passenger']['_note']+=' 車検証の4.00リットル等の表示は税額が変わる可能性があるため課税自治体に確認。ロータリー車は単室容積×ローター数×1.5で算出した総排気量を用いる。'
d['kei']['label']='軽自動車（四輪以上・自家用乗用）'
d['kei']['_note']='四輪以上・自家用乗用の標準年額は平成27年4月1日以後の初回新規検査で10,800円、それ以前は7,200円（軽課・重課を除く）。初回新規検査から13年経過日の翌年度以降は12,900円。ただし電気・天然ガス・メタノール・混合メタノール・ガソリン電力併用・被けん引車は重課対象外。月割なし。4月1日現在の所有者に年額課税。所有者が法令上課税できない者の場合は使用者に課税（公用・公共用を除く）。年度途中の購入者には当年度の月割課税なし。翌4月1日にも所有していれば年額課税（軽課・減免等を除く）。'
d['jyuka_rule']['excluded_fuel_note']='登録車の主な対象外の例: 電気・天然ガス・メタノール・ガソリンハイブリッド・一般乗合バス・スクールバス・被けん引車。軽は電気・天然ガス・メタノール・混合メタノール・ガソリン電力併用・被けん引車が対象外。'
d['jyuka_rule']['trigger_note']='登録車は4月1日現在で初回新規登録後ガソリン・LPG13年超、ディーゼル11年超。軽は初回新規検査から13年経過日の翌年度以降。'
d['proration_note']='登録車の年度途中の新規登録は翌月〜年度末3月の月割（年額×月数÷12、100円未満切捨て）。この計算機の月割は新車のみ。翌4月1日にも所有する場合は原則年額課税だが、軽課・課税免除・申請減免や抹消登録による減額は別途確認。軽に月割はない。'
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
# Complete the already-qualified kei exclusion list in static and generated content.
for f in ['docs/jidoshazei/index.html','tools/gen_jidoshazei_table.mjs']:
 p=Path(f);s=p.read_text().replace('電気・天然ガス・メタノール・ガソリン電力併用等は対象外','電気・天然ガス・メタノール・混合メタノール・ガソリン電力併用・被けん引車は対象外').replace('電気・天然ガス・メタノール・ガソリン電力併用等を除き','電気・天然ガス・メタノール・混合メタノール・ガソリン電力併用・被けん引車を除き');p.write_text(s)
# Fix inherited aria-hidden around actual FAQ answers (keep only A. hidden).
p=Path('docs/jidoshazei/index.html');s=p.read_text();import re
s=re.sub(r'<span class="faq-existing-marker" aria-hidden="true">A\. ([^<]+)</span>',r'<span class="faq-existing-marker" aria-hidden="true">A. </span>\1',s)
p.write_text(s)
