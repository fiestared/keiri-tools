import assert from 'node:assert/strict';
import {segmentClaims,validateSegments} from '../tools/segment_claims.mjs';
const html='<title>対象の説明</title><meta name="description" content="条件の説明"><meta property="og:description" content="対象者の説明"><h1>概要</h1><p>対象は<b>会社</b>です。</p><h2>手続</h2><p>申請する。</p><table><tr><td>区分</td></tr></table><svg><text>図の主張</text></svg><label>金額<input id="money" value="100"></label><select><option value="a">甲</option></select><h2>よくある質問</h2><h3>対象は？</h3><p>会社です。</p>';
const units=segmentClaims(html),ledger={claims:[{id:'c1',covers:units.map(s=>s.id)}],nonclaims:[]};
assert.deepEqual(validateSegments(units,ledger).errors,[]); // pristine green before every corruption family
const broken=structuredClone(ledger);broken.claims[0].covers.pop();assert.ok(validateSegments(units,broken).errors.length);
assert.ok(validateSegments(segmentClaims(html.replace('content="条件の説明"','content="条件の説明だけです"')),ledger).errors.length);
const nc=structuredClone(ledger);nc.claims[0].covers.shift();nc.nonclaims=[{id:units[0].id,why:'案内文'}];assert.ok(validateSegments(units,nc).errors.length);
assert.deepEqual(segmentClaims(html.replace('<b>会社</b>',' 会 社 ')).map(s=>s.id),units.map(s=>s.id));
assert.deepEqual(segmentClaims(html+'<nav><p>パンくず</p></nav><section class="related"><p>関連記事</p></section>').map(s=>s.id),units.map(s=>s.id));
assert.ok(units.some(u=>u.kind==='og:description'));assert.ok(units.some(u=>u.kind==='input'));assert.ok(units.some(u=>u.kind==='figure'&&u.text==='図の主張'));assert.ok(units.some(u=>u.zone==='faq'&&u.protected));
const duplicate=segmentClaims('<p>同じ文。</p><p>同じ文。</p>');assert.equal(new Set(duplicate.map(u=>u.id)).size,2);
const plain=segmentClaims('<p>目次へ戻る</p>');assert.deepEqual(validateSegments(plain,{nonclaims:[{id:plain[0].id,why:'ページ内の案内'}]}).errors,[]);
console.log('segment fixtures: pristine green; covers/meta/nonclaim red; whitespace/bold/navigation green');

const summary=segmentClaims('<h2>まとめ</h2><p>この場合に適用します。</p>');
const summaryLedger={claims:[{id:'s',covers:summary.map(u=>u.id)}]};
assert.deepEqual(validateSegments(summary,summaryLedger).errors,[]);
summaryLedger.claims[0].covers.pop();summaryLedger.nonclaims=[{id:summary.at(-1).id,why:'まとめの案内'}];
assert.ok(validateSegments(summary,summaryLedger).errors.some(e=>e.includes('invalid nonclaim')));

// Section labels and column labels are not claims, even under a summary heading.
const labels=segmentClaims('<div class="summary">この記事のまとめ</div><h2>まとめ</h2><table><tr><th>支出の例</th><th>消費税</th></tr><tr><td>税率は10%です。</td></tr></table><p>適用条件を満たします。</p><h2>実務の注意点まとめ</h2><h2>結論：税率は10%</h2>');
for (const text of ['この記事のまとめ','支出の例','消費税','実務の注意点まとめ']) {
  const u=labels.find(u=>u.text===text);
  assert.equal(u.protected,false,text);
}
for (const text of ['税率は10%です。','適用条件を満たします。','結論：税率は10%']) assert.equal(labels.find(u=>u.text===text).protected,true,text);
// Structural summary/FAQ labels have no proposition. Real summary/FAQ assertions stay protected.
const structural = segmentClaims('<h2>まとめ</h2><p>先に全体を表にします。</p><table><tr><th>区分</th><th>原則</th><th>入る方法</th><th>根拠</th><th>給付率は80%</th></tr></table><p>）</p><h2>FAQ</h2><div>この内容をXで共有</div><p>給付率は常に80%です。</p>');
for (const u of structural.filter(u=>['まとめ','先に全体を表にします。','区分','原則','入る方法','根拠','）','この内容をXで共有'].includes(u.text))) assert.equal(u.protected,false,u.text);
for (const u of structural.filter(u=>u.text.includes('80%'))) assert.equal(u.protected,true,u.text);

// r16 t7-z: a callout heading is organizational; its substantive body stays protected.
const practical = segmentClaims('<div class="callout"><h3>実務上の意味</h3><p>給付は50日分です。</p></div>');
assert.equal(practical.find(u=>u.kind==='h3').protected,false);
assert.equal(practical.find(u=>u.kind==='p').protected,true);

// 2026-10-01 対策5（gbrain audits/keiri-why-not-one-pass-2026-10-01 の D: 図の断片・表の行見出し・見出しが単独で非主張にされ、後の周で high になった）
{
  const fig = segmentClaims('<figure><svg aria-label="住民税の控除の内訳"><title>内訳</title><text>①5,600円</text><text>②2,800<tspan>円</tspan></text><text>×（100−10−20）＝70％</text></svg><figcaption>図: 控除の合計28,000円</figcaption></figure><p>本文です。</p>');
  const figs = fig.filter(u => u.kind === 'figure');
  // 通るべき: 図1つ＝単位1つで、断片・aria-label・title・figcaption を全部含む
  assert.equal(figs.length, 1, '図は1単位');
  for (const piece of ['住民税の控除の内訳', '内訳', '①5,600円', '②2,800円', '×（100−10−20）＝70％', '図: 控除の合計28,000円']) assert.ok(figs[0].text.includes(piece), piece);
  assert.equal(figs[0].protected, true, '金額を含む図は非主張にできない');
  // 落ちるべき: 断片や figcaption が別の単位として残っていない
  assert.ok(!fig.some(u => u.kind === 'text' || u.kind === 'figcaption'), '図の断片が別単位で残っている');
  const ledger = { claims: [{ id: 'c', covers: fig.filter(u => u.kind !== 'figure').map(u => u.id) }], nonclaims: [{ id: figs[0].id, why: '図の飾り' }] };
  assert.ok(validateSegments(fig, ledger).errors.some(e => e.includes('invalid nonclaim')), '金額つきの図を非主張にできてしまう');
  // 図の外の figcaption（表の説明など）は従来どおり単独の単位
  assert.ok(segmentClaims('<figure><table><tr><td>a</td></tr></table><figcaption>表の説明</figcaption></figure>').some(u => u.kind === 'figcaption'));
}
{
  const html = '<table><thead><tr><th>年収</th><th>超えるとどうなる</th><th>手続</th></tr></thead><tbody><tr><th>130万円</th><td>扶養から外れる。国保に入る。</td><td>届出</td></tr><tr><td>106万円</td><td>社保に入る</td><td>なし</td></tr></tbody></table>';
  const t = segmentClaims(html);
  const cell = t.find(u => u.text.includes('扶養から外れる'));
  // 通るべき: データのセルは「行見出し＋列見出し＋セル」の1単位（文で分けない）
  assert.equal(cell.text, '【行】130万円 【列】超えるとどうなる 【値】扶養から外れる。国保に入る。');
  assert.equal(cell.protected, true, '境界語・金額の見出しを持つセルは非主張にできない');
  assert.equal(t.find(u => u.text.includes('社保に入る')).text, '【行】106万円 【列】超えるとどうなる 【値】社保に入る', 'thead が無い行見出し td も見出しとして使う');
  // 見出しのセル自体は単独の単位として残り、境界語を含めば protected
  assert.equal(t.find(u => u.text === '超えるとどうなる').protected, true);
  assert.equal(t.find(u => u.text === '130万円').protected, true);
  assert.equal(t.find(u => u.text === '手続').protected, false, '境界語の無い列見出しは従来どおり');
  // 落ちるべき: 見出しを書き換えたらセルの単位も変わる（見出しと結論を一緒に照合し直す）
  const t2 = segmentClaims(html.replace('超えるとどうなる', '以上になるとどうなる'));
  assert.notEqual(t2.find(u => u.text.includes('扶養から外れる')).id, cell.id);
  // colspan を数える
  const span = segmentClaims('<table><tr><th>区分</th><th colspan="2">手数料</th><th>備考</th></tr><tr><td>他行</td><td>3万円未満</td><td>220円</td><td>窓口</td></tr></table>');
  assert.equal(span.find(u => u.text.endsWith('220円')).text, '【行】他行 【列】手数料 【値】220円');
  assert.equal(span.find(u => u.text.endsWith('窓口')).text, '【行】他行 【列】備考 【値】窓口');
}
{
  // 見出し・ラベルの境界語・金額・日付。通るべき: 語の無い見出しは非主張にできる。落ちるべき: 有る見出しはできない
  const h = segmentClaims('<h2>手続の流れ</h2><h3>年収130万円を超えると</h3><h3>10月1日から</h3><label>月額</label><select><option>8.8万円以上</option></select>');
  for (const text of ['年収130万円を超えると', '10月1日から', '8.8万円以上 [value=8.8万円以上;default=true]']) assert.equal(h.find(u => u.text === text).protected, true, text);
  for (const text of ['手続の流れ', '月額']) assert.equal(h.find(u => u.text === text).protected, false, text);
  const ok = { nonclaims: h.filter(u => !u.protected).map(u => ({ id: u.id, why: '見出し' })), claims: [{ id: 'c', covers: h.filter(u => u.protected).map(u => u.id) }] };
  assert.deepEqual(validateSegments(h, ok).errors, []);
  const bad = structuredClone(ok); const tgt = h.find(u => u.text === '年収130万円を超えると');
  bad.claims[0].covers = bad.claims[0].covers.filter(id => id !== tgt.id); bad.nonclaims.push({ id: tgt.id, why: '見出し' });
  assert.ok(validateSegments(h, bad).errors.some(e => e.includes('invalid nonclaim')));
}
console.log('one-pass units: figure bundled; table cell with row/column headers; boundary headings protected');

// t11-q08465: protected row labels/questions need their actual data/answer.
{
 const html='<table><tr><th>年度</th><th>一括</th><th>特例</th></tr><tr><td data-review-context="row">1年目</td><td>50,000円</td><td>150,000円</td></tr></table><h2>よくある質問</h2><h3 data-review-context="next">3年途中の除却は？</h3><p class="faq-answer">通常除却では残額算入不可。清算等の例外あり。</p>';
 const units=segmentClaims(html), row=units.find(x=>x.text.startsWith('【行】1年目 /')), q=units.find(x=>x.text.startsWith('【質問】'));
 assert.ok(row?.text.includes('【列】一括 【値】50,000円'));
 assert.ok(row?.text.includes('【列】特例 【値】150,000円'));
 assert.ok(q?.text.includes('【回答】通常除却では残額算入不可。清算等の例外あり。'));
 assert.ok(row.protected && q.protected);
 assert.notEqual(segmentClaims(html.replace('150,000円','100,000円')).find(x=>x.text.startsWith('【行】1年目 /')).id,row.id);
 assert.notEqual(segmentClaims(html.replace('清算等の例外あり','例外なし')).find(x=>x.text.startsWith('【質問】')).id,q.id);
 assert.throws(()=>segmentClaims('<h3 data-review-context="next">問い</h3><p>回答class欠落</p>'),/adjacent FAQ answer/);
 assert.throws(()=>segmentClaims('<table><tr><td data-review-context="row">1年目</td></tr></table>'),/row label/);
 assert.ok(validateSegments(units,{nonclaims:[{id:q.id,why:'質問'}]}).errors.some(x=>x.includes('invalid nonclaim')));
}
