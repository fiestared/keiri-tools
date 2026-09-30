from pathlib import Path
import json
p=Path('tests/test_iryohi.mjs');s=p.read_text()
a=s.index("t('補填ひも付きを渡さない");b=s.index('\n});',a)+4
s=s[:a]+"""t('補填金あり・対象医療費未入力は計算しない', () => {
  assert.throws(() => calcIryohi({ iryohi: 270000, hoten: 200000, kyuyoShunyu: 5000000, shotokuzeiRate: 10 }, refs), /対象医療費/);
});"""+s[b:]
s=s.replace('rateFromKazei(boundary, I), at','rateFromKazei(boundary, I), below');s=s.replace('assert.strictEqual(rateFromKazei(boundary - 1, I), below);','assert.strictEqual(rateFromKazei(boundary - 1, I), below);\n    assert.strictEqual(rateFromKazei(boundary + 1, I), at);')
for v,old,new in [(1950000,10,5),(6950000,23,20),(9000000,33,23),(18000000,40,33),(40000000,45,40)]:s=s.replace(f'rateFromKazei({v}, I), {old}',f'rateFromKazei({v}, I), {new}')
exec(Path('reports/r16-t14-a/edit.py').read_text().split("if __name__=='__main__':")[0],ns:={})
for old,new in ns['bands']:s=s.replace(old,new)
s=s.replace('R9 税率境界','r16 所得税法89条の境界').replace('R9 速算表の表示区分はNo.2260と一致','r16 表示区分は所得税法89条に一致')
p.write_text(s)
p=Path('tests/boundaries/iryohi_core.mjs');s=p.read_text().replace('iryohiKojo, selfmedKojo','iryohiKojo, selfmedKojo, rateFromKazei, calcIryohi');s+='''
// r16: 法89条は「以下／超える」。境界の両側と補填対象未入力を検証。
for (const [n,lo,hi] of [[1950000,5,10],[3300000,10,20],[6950000,20,23],[9000000,23,33],[18000000,33,40],[40000000,40,45]]) {
 for (const [delta,expected] of [[-1,lo],[0,lo],[1,hi]]) cases.push({name:`r16税率${n}${delta}`,run:()=>rateFromKazei(n+delta,iryohiData),expected,source:'https://laws.e-gov.go.jp/law/340AC0000000033',quote:'百九十五万円以下の金額'});
}
cases.push(
 {name:'r16補填対象未入力',run:()=>{try{iryohiKojo(300000,200000,null,3000000,iryohiData);return '計算続行';}catch(e){return /対象医療費/.test(e.message);}},expected:true,source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm',quote:'その給付の目的となった医療費の金額を限度として差し引きます'},
 {name:'r16補填超過を他の医療費から引かない',run:()=>iryohiKojo(300000,200000,100000,3000000,iryohiData).kojo,expected:100000,source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm',quote:'他の医療費からは差し引きません'},
 {name:'r16給与2971999円の足切り',run:()=>calcIryohi({iryohi:100000,kyuyoShunyu:2971999,zeisei:'r8'},{iryohiData,juminzeiData:load('juminzei_r08.json')}).ashikiri,expected:99880,source:'https://laws.e-gov.go.jp/law/340AC0000000033',quote:'２，９６８，０００'},
 {name:'r16給与2972000円の足切り',run:()=>calcIryohi({iryohi:100000,kyuyoShunyu:2972000,zeisei:'r8'},{iryohiData,juminzeiData:load('juminzei_r08.json')}).ashikiri,expected:100000,source:'https://laws.e-gov.go.jp/law/340AC0000000033',quote:'２，９７２，０００'},
 {name:'r16HTML初期値は計算不能',run:d=>{try{calcIryohi({iryohi:d.getElementById('iryohi').value,hoten:d.getElementById('hoten').value,kyuyoShunyu:d.getElementById('shunyu').value},{iryohiData});return '計算続行';}catch(e){return /総所得金額等/.test(e.message);}},expected:true,source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm',quote:'総所得金額等の5パーセントの金額'}
);
''';p.write_text(s)
p=Path('tests/test_iryohi.mjs');s=p.read_text();at=s.index('// ── 4.')
s=s[:at]+"""t('r16 給与160万円のみは基礎控除104万円で所得税0、住民税の軽減目安5700円', () => {
 const r=calcIryohi({iryohi:100000,kyuyoShunyu:1600000,zeisei:'r8',shotokuzeiRate:5},refs);
 assert.deepStrictEqual([r.normal.keigen.shotokuzei,r.normal.keigen.fukko,r.normal.keigen.jumin,r.normal.keigen.total],[0,0,5700,5700]);
});

"""+s[at:];p.write_text(s)
p=Path('tests/boundaries/iryohi_core.mjs');s=p.read_text();s+='''
cases.push({name:'r16給与160万円は所得税0',run:()=>calcIryohi({iryohi:100000,kyuyoShunyu:1600000,zeisei:'r8',shotokuzeiRate:5},{iryohiData,juminzeiData:load('juminzei_r08.json')}).normal.keigen.total,expected:5700,source:'https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026_20261201_508AC0000000012?elm=Article_41_16_2',quote:'四十二万円'});
''';p.write_text(s)
