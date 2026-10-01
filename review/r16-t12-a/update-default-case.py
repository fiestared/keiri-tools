from pathlib import Path
p=Path('tests/boundaries/toroku_jutaku_core.mjs');s=p.read_text();s="import {JSDOM} from 'jsdom';\n"+s;i=s.index("cases.push({name:'住宅登記HTML初期日付'");s=s[:i]+'''cases.push({name:'住宅登記HTML初期値',run:d=>{
  const dom=d?null:new JSDOM(readFileSync(new URL('../../docs/toroku-menkyozei/index.html',import.meta.url),'utf8'));
  const doc=d||dom.window.document, v=id=>doc.getElementById(id).value, n=id=>Number(v(id));
  try {
    const r=calcTorokuJutaku({
      tokiBi:v('tokiBi'),shutokuBi:v('shutokuBi'),tokiShurui:v('tokiShurui'),genin:v('in-genin'),tochiGenin:v('in-genin'),
      tochiKagaku:n('tochiKagaku'),tochiMochibun:n('tochiMochibun'),tatemonoKagaku:n('tatemonoKagaku'),tatemonoMochibun:n('tatemonoMochibun'),
      kojinKyoju:v('kojinKyoju')==='1',yukamenseki:n('yukamenseki'),
      chuko:v('in-chuko')==='1',kenchikuBi:v('kenchikuBi'),taishinTekigo:v('taishinTekigo')==='1',
      nintei:v('in-nintei'),kodate:v('kodate')==='1',kaitoriHanbai:v('kaitoriHanbai')==='1',saikenGaku:n('saikenGaku'),
    },data);
    return {ok:r.ok,taxes:(r.meisai||[]).map(x=>x.zeigaku)};
  } finally {dom?.window.close();}
},expected:{ok:true,taxes:[225000,30000,35000]},source,quote:'千分の十五とする。千分の三とする。千分の一とする。'});
''';p.write_text(s)
p=Path('tests/conditions/toroku_jutaku_core.json');s=p.read_text().replace('住宅登記HTML初期日付','住宅登記HTML初期値');p.write_text(s)
p=Path('review/r16-t12-a/README.txt');s=p.read_text();s=s.replace('HTML初期日付のケースは例の金額を用いた日付配線の検証であり、ページの空の金額欄をそのまま計算したケースではない。','HTML初期値のケースは最終版で日付・金額・持分・住宅条件を実際のHTMLからすべて読み、土地225,000円・建物30,000円・抵当権35,000円を期待値として検証する。');p.write_text(s)
p=Path('review/r16-t12-a/report-body.txt');s=p.read_text().replace('HTML初期日付','HTML初期値');p.write_text(s)
