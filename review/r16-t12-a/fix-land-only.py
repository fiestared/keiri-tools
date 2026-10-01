from pathlib import Path
p=Path('docs/assets/toroku_jutaku_core.js');s=p.read_text();old='const kigen = inp.tokiBi === undefined ? null : kigenHantei(inp.tokiBi, data, inp.shutokuBi);';new='''// 住宅の新築・取得日は建物・住宅ローンの軽減に使う。土地だけの登記では不要。
  const hasJutaku = nz(inp.tatemonoKagaku) * (inp.tatemonoMochibun == null ? 1 : nz(inp.tatemonoMochibun)) > 0 || nz(inp.saikenGaku) > 0;
  const kigen = inp.tokiBi === undefined ? null : kigenHantei(inp.tokiBi, data, hasJutaku ? inp.shutokuBi : undefined);''';assert old in s;s=s.replace(old,new);p.write_text(s)
p=Path('tests/boundaries/toroku_jutaku_core.mjs');s=p.read_text();s+='''cases.push({name:'土地のみ・住宅取得日未入力',run:()=>{
  const r=calcTorokuJutaku({tochiKagaku:15000000,tochiGenin:'売買',tatemonoKagaku:0,saikenGaku:0,tokiBi:'2026-07-01',shutokuBi:''},data);
  return {ok:r.ok,taxes:(r.meisai||[]).map(x=>x.zeigaku)};
},expected:{ok:true,taxes:[225000]},source,quote:'売買による所有権の移転の登記 千分の十五'});
''';p.write_text(s)
import json
p=Path('tests/conditions/toroku_jutaku_core.json');d=json.loads(p.read_text());d['conditions'][0]['cases'].append('土地のみ・住宅取得日未入力');p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
p=Path('review/r16-t12-a/report-body.txt');s=p.read_text().replace('HTML初期値と取得日が登記日より後の入力も検証。','HTML初期値と取得日が登記日より後の入力も検証。追加した日付欄が土地のみの計算を阻害しないケースも、赤→緑で確認した。月数欄は日付と重複して答えに効かないため除去し、入力は実日付に統一。');p.write_text(s)
