// Protect independent grade/amount reconciliation and the context each published cell carries.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {segmentClaims} from '../tools/segment_claims.mjs';
const path='docs/column/hyojun-hoshu-gakuhyo/index.html';
const units=segmentClaims(readFileSync(path,'utf8'),path);
// 2026-10-11: 列見出しを短い語にし、全行に共通する条件は表の直前の説明・直後の注（局所文脈 u.context）へ1回ずつにまとめた。
// 金額のセル250個すべてに、その文脈が付いていることを確かめる（列見出しに条件を書き写さない）。
const COLS=['健康保険（介護なし）','健保＋介護（40〜64歳）','子ども支援金','厚生年金','合計（39歳以下）'];
const money=units.filter(u=>u.kind==='td'&&/^【行】\d+ 【列】/.test(u.text)&&COLS.some(c=>u.text.includes(`【列】${c} 【値】`)));
assert.equal(money.length,250);
for(const c of COLS)assert.equal(money.filter(u=>u.text.includes(`【列】${c} 【値】`)).length,50,c);
for(const u of money){const c=u.context||'';assert.match(c,/【表の直前の説明】/);assert.match(c,/【表の直後の注】/);assert.match(c,/東京支部の一般被保険者の本人負担分（月額）/);assert.match(c,/保険料免除や保険料調整制度の利用がなく/);assert.match(c,/50銭以下切捨・50銭超切上/);assert.match(c,/健康保険・介護は2026年3月分から、子ども支援金と合計は2026年4月分から/);assert.match(c,/厚生年金と合計は、厚生年金基金未加入/);assert.match(c,/区域内.*40歳以上65歳未満.*医療保険加入者/);assert.match(c,/93,000円未満なら標準報酬月額88,000円（第1級）、635,000円以上なら650,000円（第32級）/);assert.match(c,/雇用保険料は含みません/);assert.match(c,/任意継続の人は、この一般被保険者の表を使えません/);}
// 入力欄とボタンの間に補足を挟まない（2026-10-11 Masahiro）。補足は入力欄の上に1行・80字まで
{const html=readFileSync(path,'utf8');const form=html.slice(html.indexOf('<form id="grade-lookup"'),html.indexOf('</form>'));assert.match(form,/<input id="grade-amount"[^>]*>\s*<button type="submit"/);const help=form.match(/<p id="grade-help"[^>]*>([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g,'');assert(help.length<=80,`入力欄の補足が ${help.length} 字`);}
assert.equal(units.filter(u=>u.text.includes('【値】83,000 〜 93,000（厚年は93,000円未満）')).length,1);
assert.equal(units.filter(u=>u.text.includes('【値】635,000 〜 665,000（厚年は635,000円以上）')).length,1);
execFileSync('node',['review-evidence/auto20261008-t3x-q08381/verify.mjs'],{stdio:'pipe'});
// 預り金の記事の3月分の設例（42,225円・58,545円・76,545円）は統合で見送った: main が 10-08 の書き直し（rg24）で設例を令和8年6月支給・9月決算に替えており、3月分の設例そのものが無い。
console.log('✓ 全50等級の公表料率との独立照合・250セルの対象条件');
