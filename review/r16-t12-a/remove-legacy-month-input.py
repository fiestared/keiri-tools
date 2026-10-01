from pathlib import Path
p=Path('docs/toroku-menkyozei/index.html');s=p.read_text();old='''    <div>
      <label for="tokiMadeMonths">新築・取得から登記までの月数</label>
      <input type="number" id="tokiMadeMonths" min="0" max="600" inputmode="numeric" value="3">
    </div>
''';assert old in s;s=s.replace(old,'');s=s.replace('日付入力がある場合は下の月数より優先します。','月数を丸めず、新築・取得日と登記日から1年以内かを判定します。');s=s.replace('登記までの月数は端数月を切り上げて入力してください。','新築・取得日と登記日を正確に入力してください。');s=s.replace('    tokiMadeMonths: num("tokiMadeMonths"),\n','');p.write_text(s)
p=Path('tools/e2e/harness.html');s=p.read_text().replace('  set(doc, "tokiMadeMonths", o.tokiMadeMonths ?? 3);\n','');s=s.replace('月数の既定値3を誤用すると軽減を通してしまう。','取得日を渡し忘れると軽減を通してしまう。');p.write_text(s)
p=Path('tests/break_toroku_page.mjs');s=p.read_text().replace('取得日を渡し忘れる（月数3を使って1年超でも軽減を通す）','取得日を渡し忘れる（1年超でも軽減を通す）');p.write_text(s)
p=Path('docs/assets/toroku_jutaku_core.js');s=p.read_text().replace('登記を受ける日から、その日に使える軽減を判定する。','土地の登記期限と住宅の新築・取得期限を判定する。登記まで1年以内かは別途判定する。').replace('住宅用家屋の軽減は令和9年3月31日・土地の売買の1.5%は令和11年3月31日。','住宅の新築・取得期限は令和9年3月31日・土地売買の登記期限は令和11年3月31日。')
s=s.replace(' *   @param {string} inp.tokiBi       登記を受ける日', ' *   @param {string} inp.shutokuBi    住宅の新築・取得日（YYYY-MM-DD）。実UIでは住宅計算時に必須。省略時は従来の月数入力で判定。\n *   @param {string} inp.tokiBi       登記を受ける日');p.write_text(s)
p=Path('tests/break_toroku_page.mjs');s=p.read_text().replace('登記までの月数を渡し忘れる（1年超で落ちるはずの軽減が通る・200,000→30,000）。','取得日を渡し忘れる（1年超で落ちるはずの軽減が通る・200,000→30,000）。');p.write_text(s)
