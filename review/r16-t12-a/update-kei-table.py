from pathlib import Path
old='軽自動車（自家用乗用・660cc以下）の軽自動車税（種別割）＝ 平成27年4月1日以後 最初の新規検査 <b>${yen(k.new)}</b>／以前 <b>${yen(k.old)}</b>／13年超の重課 <b>${yen(k.jyuka)}</b>（市区町村税・月割なし）。'
new='四輪以上の自家用乗用軽自動車の標準年額（重課・軽課を除く）は、平成27年4月1日以後の初回新規検査で<b>${yen(k.new)}</b>、それ以前は<b>${yen(k.old)}</b>。13年経過後の重課は<b>${yen(k.jyuka)}</b>ですが、電気・天然ガス・メタノール・ガソリン電力併用等は対象外です。グリーン化特例の軽課は別途確認します（月割なし）。'
for f in ['tools/gen_jidoshazei_table.mjs','docs/jidoshazei/index.html']:
 p=Path(f);s=p.read_text();assert s.count(old)==1,f;p.write_text(s.replace(old,new))
# データ・生成器の一致だけでは条件脱落を検出できないので、正本からの要件も静的な要素に要求する。
p=Path('tests/test_jidoshazei_static_table.mjs');s=p.read_text();old="  assert.ok(!/読み込み中/.test(line), '軽自動車の行が「読み込み中…」のままです');";new=old+"\n  for (const term of ['四輪以上', 'ガソリン電力併用', '対象外', 'グリーン化特例の軽課']) assert.ok(line.includes(term), '軽自動車の条件がありません: '+term);";assert old in s;p.write_text(s.replace(old,new))
p=Path('tests/break_jidoshazei_static_table.mjs');s=p.read_text();needle='// ── 後始末の確認';i=s.index(needle);s=s[:i]+"// r16: 三輪との区別・重課の対象外を消す退行を捕まえる。\nwithBreak('⑨ 四輪以上の範囲を消す → 赤', PAGE, s=>s.replace('四輪以上の自家用乗用軽自動車の標準年額', '自家用乗用軽自動車の標準年額'));\nwithBreak('⑩ ガソリン電力併用の対象外を消す → 赤', PAGE, s=>s.replace('・ガソリン電力併用等は対象外です', '等は対象外です'));\n\n"+s[i:];p.write_text(s)
# 再生成とJS描画でも、既存の金額列の右寄せを保つ。
for f in ['tools/gen_jidoshazei_table.mjs','docs/jidoshazei/index.html']:
 p=Path(f);s=p.read_text();old='<td>${yen(b.new)}</td><td>${yen(b.old)}</td>';new='<td class="num">${yen(b.new)}</td><td class="num">${yen(b.old)}</td>';assert s.count(old)==1,f;p.write_text(s.replace(old,new))
p=Path('tests/test_jidoshazei_static_table.mjs');s=p.read_text().replace('assert.strictEqual(tbody(), buildRows(D),', '''assert.strictEqual(tbody(), buildRows(D).replace(/<td class="num">/g, '<td>'),''');p.write_text(s)
