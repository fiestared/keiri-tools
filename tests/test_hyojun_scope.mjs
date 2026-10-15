// Protect independent grade/amount reconciliation and the context each published cell carries.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {segmentClaims} from '../tools/segment_claims.mjs';
const path='docs/column/hyojun-hoshu-gakuhyo/index.html';
const units=segmentClaims(readFileSync(path,'utf8'),path);
// 2026-10-11: 列見出しを短い語にし、全行に共通する条件は表の直前の説明・直後の注（局所文脈 u.context）へ1回ずつにまとめた。
// 金額のセル250個すべてに、その文脈が付いていることを確かめる（列見出しに条件を書き写さない）。
const COLS=['健康保険（介護なし）','健保＋介護第2号','子ども支援金','厚生年金加入者','合計（39歳以下）'];
const money=units.filter(u=>u.kind==='td'&&/^【行】\d+ 【列】/.test(u.text)&&COLS.some(c=>u.text.includes(`【列】${c} 【値】`)));
assert.equal(money.length,250);
for(const c of COLS)assert.equal(money.filter(u=>u.text.includes(`【列】${c} 【値】`)).length,50,c);
for(const u of money){
 const c=u.context||'';
 assert.match(c,/【表の直前の説明】/);assert.match(c,/【表の直後の注】/);
 assert.match(c,/東京支部の一般被保険者/);assert.match(c,/本人負担分.*計算例.*月額/);
 assert.match(c,/保険料免除・調整制度.*任意継続.*対象外/);
 assert.match(c,/給与控除・特約なし/);assert.match(c,/50銭以下は切捨、50銭超は切上/);
 assert.match(c,/一般被保険者の健康保険・介護は2026年3月分.*支援金・合計は4月分/);
 assert.match(c,/厚生年金と合計は基金未加入者/);
 if(/【列】健保＋介護/.test(u.text))assert.match(c,/区域内.*40歳以上65歳未満.*医療保険加入者/);
 if(/【列】厚生年金|【列】合計/.test(u.text))assert.match(c,/厚生年金・合計欄は70歳未満の加入者のみ/);
}
// 適用条件は共有の前提に、範囲の向きは列名に一度だけ示す。対象外・住所条件の複写を防ぐ。
assert.equal(units.filter(u=>u.kind==='th'&&/報酬月額の範囲.*以上〜未満/.test(u.text)).length,1);
{const notes=units.filter(u=>u.kind==='p').map(u=>u.text);for(const re of [/区域内.*40歳以上65歳未満.*医療保険加入者/,/93,000円未満なら標準報酬月額88,000円（第1級）、635,000円以上なら650,000円（第32級）/,/雇用保険料は含みません/,/保険料免除・調整制度.*任意継続.*対象外/])assert.equal(notes.filter(t=>re.test(t)).length,1,String(re));}
// 入力欄とボタンの間に補足を挟まない（2026-10-11 Masahiro）。補足はボタンの下に1行・80字まで（入力欄より上に置くと tests/layout/measure.mjs の help-position が落とし、入力欄の直前に置くと gen_layout_markup が入力欄の直後＝ボタンの上へ移す）
{const html=readFileSync(path,'utf8');const form=html.slice(html.indexOf('<form id="grade-lookup"'),html.indexOf('</form>'));assert.match(form,/<input id="grade-amount"[^>]*>\s*<button type="submit"/);const help=form.match(/<p id="grade-help"[^>]*>([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g,'');assert(help.length<=80,`入力欄の補足が ${help.length} 字`);}
assert.equal(units.filter(u=>u.text.includes('【値】83,000 〜 93,000（厚年は93,000円未満）')).length,1);
assert.equal(units.filter(u=>u.text.includes('【値】635,000 〜 665,000（厚年は635,000円以上）')).length,1);
execFileSync('node',['review-evidence/auto20261008-t3x-q08381/verify.mjs'],{stdio:'pipe'});
// 預り金の記事の3月分の設例（42,225円・58,545円・76,545円）は統合で見送った: main が 10-08 の書き直し（rg24）で設例を令和8年6月支給・9月決算に替えており、3月分の設例そのものが無い。
console.log('✓ 全50等級の公表料率との独立照合・250セルの対象条件');
