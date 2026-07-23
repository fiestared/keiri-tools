/**
 * 防衛特別所得税(令和8年法律12号)への言及が、条文と一致した形でサイト全体に
 * 行き渡っているかを機械で見る。
 *
 * 背景(2026-07-23の棚卸しで本番から取り除いた古い知識):
 *   「復興特別所得税は2.1%(令和19年分まで)」という記述が12箇所に残っていた。
 *   令和8年度税制改正(令和8年3月31日法律12号)で、
 *     - 令和9年分から: 防衛特別所得税1%(防衛財源確保法5条の9) + 復興特別所得税1.1%(復興財確法13条)
 *       = 合計2.1%は不変(源泉徴収の分解は防衛財源確保法5条の26第10項が
 *         「102.1分の1 / 102.1分の1.1 / 102.1分の100」と明記)
 *     - 復興特別所得税の課税期間は令和29年(令和29年12月31日までの徴収)へ10年延長(復興財確法9条・28条)
 *     - 防衛特別所得税は「当分の間」(5条の5)=終期の定めなし
 *   どの計算も×102.1%のままなのでコードは無傷。壊れていたのは「いつまで」の言葉だけ
 *   =「黙って古くなった」型。
 *
 * あわせて地方税法(令和8年法律2号)の発見:
 *   ふるさと納税の特例控除に絶対上限(道府県77.2万+市町村115.8万=193万円)が新設。
 *   ただし改正附則3条9項・11条8項が「令和10年度以後に適用・令和9年度分までは従前の例」
 *   = 2026年の寄附(令和9年度住民税)には適用されない。ツールの計算は現状のままが正。
 *   ×1.021の読替え表(附則5条の6・84.895%等)は両版md5一致=令和9年度も不変。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const visible = (s) => s.replace(/<[^>]+>/g, ' ');

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✅ ${msg}`);
  else { console.error(`  ❌ ${msg}`); failed++; }
};

// 条文の数の内部整合(772,000 + 1,158,000 = 1,930,000。指定都市 386,000+1,544,000も同額)
ok(772000 + 1158000 === 1930000, '特例控除の絶対上限: 道府県+市町村 = 193万円(条文の数の整合)');
ok(386000 + 1544000 === 1930000, '特例控除の絶対上限: 指定都市の分割でも合計193万円');

// --- ① 源泉徴収票記事のcallout(名指し: 防衛特別所得税を含むcalloutは1つ) ---
{
  const html = read('docs/column/gensen-choshuhyo-mikata/index.html');
  const callouts = [...html.matchAll(/<div class="callout">[\s\S]*?<\/div>/g)].map((m) => m[0]);
  const target = callouts.filter((c) => c.includes('防衛特別所得税'));
  ok(target.length === 1, `gensen-choshuhyo-mikata: 防衛特別所得税のcalloutが一意(${target.length}件)`);
  const t = visible(target[0] || '');
  ok(t.includes('源泉徴収すべき所得税額の1％'), 'callout: 税率1%(5条の26第2項)');
  ok(t.includes('2.1％→1.1％'), 'callout: 復興は1.1%へ(復興財確法13条)');
  ok(t.includes('令和29年12月31日まで10年延長'), 'callout: 課税期間の延長(復興財確法9条・28条)');
  ok(t.includes('令和9年分以後') && t.includes('令和9年1月1日以後に支払う給与等'),
     'callout: 適用時期を個人(年分)と源泉徴収(支払日)で区別(5条の5第1項・5条の26第1項)');
  ok(t.includes('当分の間') && t.includes('終期の定めがありません'),
     'callout: 防衛分に終期なし(5条の5「当分の間」)');
}

// --- ② 退職金記事: 本文h3の節と速算表の注(それぞれ名指し) ---
{
  const html = read('docs/column/taishokukin-zeikin/index.html');
  const sec = html.match(/<h3>上乗せの2\.1%は今後も続く[\s\S]*?<\/p>/);
  ok(!!sec, 'taishokukin-zeikin: 改正の節(h3+p)が存在');
  const t = visible(sec ? sec[0] : '');
  ok(t.includes('防衛特別所得税（所得税額の1%）＋復興特別所得税（同1.1%）'), '節: 1%+1.1%の内訳');
  ok(t.includes('令和29年12月31日まで10年延長'), '節: 復興の延長');
  ok(t.includes('当分の間') && t.includes('合計2.1%は変わらない'), '節: 終期なし・合計不変');
  const note = html.match(/<p[^>]*>税額＝（A × B − C）[\s\S]*?<\/p>/);
  ok(!!note && visible(note[0]).includes('合計2.1%は変わりません'),
     '速算表の注: 組み替え後も合計2.1%は不変と明記');
}

// --- ③ 節税系ツールの出典脚注(4ページ)と小規模共済の本文bullet ---
for (const p of ['docs/fuyo-kojo/index.html', 'docs/haigusha-kojo/index.html',
                 'docs/seimei-hoken-kojo/index.html', 'docs/ideco-setsuzei/index.html']) {
  const lis = [...read(p).matchAll(/<li>[^<]*復興特別所得税は所得税額の2\.1%[\s\S]*?<\/li>/g)];
  ok(lis.length === 1 && lis[0][0].includes('防衛特別所得税1%＋復興特別所得税1.1%')
     && lis[0][0].includes('令和8年法律12号') && !lis[0][0].includes('令和19年分まで'),
     `${p}: 脚注が組み替え後の姿(1%+1.1%・法律番号つき・令和19年なし)`);
}
{
  const lis = [...read('docs/shokibo-kyosai/index.html')
    .matchAll(/<li><b>復興特別所得税の減少<\/b>[\s\S]*?<\/li>/g)];
  ok(lis.length === 1 && lis[0][0].includes('防衛特別所得税1%＋復興特別所得税1.1%')
     && !lis[0][0].includes('令和19年分まで'),
     'shokibo-kyosai: 復興特別所得税bulletが組み替え後の姿');
}

// --- ④ ふるさと納税(ツール+記事): ×1.021段落に組み替えと絶対上限の適用年度 ---
for (const p of ['docs/furusato/index.html', 'docs/column/furusato-nozei-keisan/index.html']) {
  const html = read(p);
  const paras = [...html.matchAll(/[^\n]*×1\.021を織り込んだ[\s\S]*?(?=\n)/g)];
  ok(paras.length === 1, `${p}: ×1.021の段落が一意(${paras.length}件)`);
  const t = visible(paras[0] ? paras[0][0] : '');
  ok(t.includes('防衛特別所得税1％＋復興特別所得税1.1％') && t.includes('×1.021はそのまま'),
     `${p}: 組み替え後も×1.021が続くと明記`);
  ok(t.includes('道府県77万2,000円＋市町村115万8,000円＝合計193万円'),
     `${p}: 絶対上限の額(地方税法37条の2第11項・314条の7第11項ただし書)`);
  ok(t.includes('令和10年度分の住民税') && t.includes('2026年の寄附には適用されません'),
     `${p}: 適用年度(改正附則3条9項・11条8項=令和10年度以後)と現年への不適用`);
}

// --- ⑤ 参照データの保守ノート(将来の自分への指示が正しい向きか) ---
{
  const meta = JSON.parse(read('docs/assets/taishoku_rates_r08.json'))._meta;
  ok(meta.note.includes('防衛特別所得税1%＋復興特別所得税1.1%') && meta.note.includes('合計102.1%は不変'),
     'taishoku_rates: noteが組み替えを説明');
  ok(meta.note.includes('令和29年') && meta.note.includes('当分の間'),
     'taishoku_rates: noteが新しい期限(復興=令和29年・防衛=終期なし)');
  ok(String(meta.fukko_until).startsWith('2047-12-31'), 'taishoku_rates: fukko_until=2047-12-31');
  ok(!meta.note.includes('2038年以降は 2.1% を外すこと'), 'taishoku_rates: 旧の誤指示(2038年に外せ)が消えている');
}
ok(JSON.parse(read('docs/assets/setsuzei_r08.json'))._meta.note.includes('防衛特別所得税1%'),
   'setsuzei_r08: noteが組み替えを説明');

// --- ⑥ 網(規則6): 古い期限の言い方がdocs配下に残っていないか ---
{
  const stale = ['令和19年分まで', '令和19年12月31日', '復興特別所得税は令和19年まで'];
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(html|json)$/.test(name)) {
        const body = readFileSync(p, 'utf8');
        for (const s of stale) if (body.includes(s)) hits.push(`${p}: ${s}`);
      }
    }
  };
  walk(join(root, 'docs'));
  ok(hits.length === 0, `古い期限の言い方が残っていない(${hits.length}件${hits.length ? ': ' + hits.join(' / ') : ''})`);
}

if (failed) { console.error(`\n${failed}件 失敗`); process.exit(1); }
console.log('\ntest_boei_surtax: all green');
