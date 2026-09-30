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
assert.ok(units.some(u=>u.kind==='og:description'));assert.ok(units.some(u=>u.kind==='input'));assert.ok(units.some(u=>u.kind==='text'));assert.ok(units.some(u=>u.zone==='faq'&&u.protected));
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
