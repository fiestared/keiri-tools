from pathlib import Path
p=Path('tools/e2e/harness.html');s=p.read_text();needle='  set(doc, "tokiBi", o.tokiBi ?? "2026-07-01");';assert needle in s;s=s.replace(needle,needle+'\n  set(doc, "shutokuBi", o.shutokuBi ?? "2026-04-01");')
s=s.replace('tokiMadeMonths: 13, tochiKagaku: 0, saikenGaku: 0,','shutokuBi: "2025-06-01", tochiKagaku: 0, saikenGaku: 0,')
s=s.replace('SCENES.toroku_kigen_kyokai = torokuJutakuScene({ tokiBi: "2027-03-31" });','SCENES.toroku_kigen_kyokai = torokuJutakuScene({ shutokuBi: "2027-03-31", tokiBi: "2027-03-31" });')
s=s.replace('SCENES.toroku_kigen_gai = torokuJutakuScene({ tokiBi: "2027-04-01" });','SCENES.toroku_kigen_gai = torokuJutakuScene({ shutokuBi: "2027-04-01", tokiBi: "2027-04-01" });\nSCENES.toroku_acquired_in_time = torokuJutakuScene({ shutokuBi: "2027-03-31", tokiBi: "2027-04-01" });')
s=s.replace('// ★登記までの月数（既定値3でない側）。13か月＝1年超で軽減が落ちて 2%＝200,000円。\n//   月数を渡し忘れる実装は30,000円のままで落ちる。','// ★取得から登記まで1年超の入力。月数の既定値3を誤用すると軽減を通してしまう。')
s=s.replace('// その翌日 → 建物と抵当権は出せず、土地だけ出す（期限が別の制度だから）。','// 取得期限の翌日に取得 → 建物と抵当権は出せず、土地だけ出す。期限内取得・翌日登記は別シーンで軽減を確認。')
p.write_text(s)
p=Path('tools/e2e/e2e.mjs');s=p.read_text();needle='  { name: "toroku_kigen_gai", expect: (s) =>';assert needle in s;s=s.replace(needle,'  { name: "toroku_acquired_in_time", expect: (s) => s.total === 290000 && s.tatemono === 30000 && s.bubun === null },\n'+needle);s=s.replace('// その翌日は建物と抵当権を出さない。★tokiBi を渡し忘れる実装は290,000を出して落ちる。','// 取得期限翌日の取得は建物と抵当権を出さない。期限内取得・翌日登記は上の別ケースで確認。');p.write_text(s)
p=Path('tests/break_toroku_page.mjs');s=p.read_text();s=s.replace('登記までの月数を渡し忘れる（1年超でも軽減を通す）','取得日を渡し忘れる（月数3を使って1年超でも軽減を通す）').replace("s.replace('    tokiMadeMonths: num(\"tokiMadeMonths\"),', \"    tokiMadeMonths: 0,\")","s.replace('    shutokuBi: $(\"shutokuBi\").value,', \"    shutokuBi: undefined,\")")
needle='const MUTATIONS = [';s=s.replace(needle,needle+'''
  {
    name: "取得日を渡し忘れると期限内取得・翌日登記の軽減を失う",
    scene: "toroku_acquired_in_time",
    apply: s=>s.replace('    shutokuBi: $("shutokuBi").value,', '    shutokuBi: undefined,'),
  },''');p.write_text(s)
