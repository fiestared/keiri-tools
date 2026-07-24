/**
 * 中小企業者等の少額減価償却資産の特例（令和8年度改正で 30万円未満 → 40万円未満）の結合テスト。
 *
 * ★なぜ要るか（2026-07-24・改正修正枠で見つけた実害）:
 *   コラム記事は「令和8年4月1日以後の取得は40万円未満」に更新されていたのに、
 *   ツール本体 /genka/ と genka_core.js は「30万円未満」のままだった。しかもコアは
 *   `if (cost < 300000)` で案内そのものを閉じていたため、35万円の資産（令和8年4月以後に
 *   取得すれば特例で全額経費にできる）を入れた人には、特例の存在すら表示されなかった。
 *
 * ★オラクルの独立性:
 *   期待値は genka_rates.json から取らず、条文を読み下した定数としてこのファイルに直接書く。
 *   - 措法28条の2第1項（個人）/ 67条の5第1項（法人）:
 *       「平成十八年四月一日から令和十一年三月三十一日までの間に取得し…その取得価額が
 *         四十万円未満であるもの…三百万円に達するまでの…を限度とする」
 *   - 適用時期は本文でなく附則: 令和8年法律12号 附則35条（個人）・附則65条（法人）が
 *       「施行日以後に取得」したものに新規定を適用（施行日前の取得は従前の例＝30万円未満）。
 *       施行日は同法 附則1条本文の「令和八年四月一日」（28条の2・67条の5の改正規定は
 *       同条各号の例外に列挙されていない＝出現0回を確認済み）。
 *   - 措令18条の5第1項（個人＝常時使用する従業員400人以下）／39条の28第1項
 *       （法人＝400人以下、二号の特定法人＝300人以下）。改正前はいずれも「五百人以下」で、
 *       政令附則（令和8年政令98号）9条・20条も「施行日以後に取得」を基準にする。
 *   - 所令138条（10万円未満）・139条（20万円未満・3年で均等）。
 *   いずれも 2026-07-24 に e-Gov 法令API v2 の XML で逐語確認した。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcGenka } from '../docs/assets/genka_core.js';

const ASSETS = new URL('../docs/assets/', import.meta.url);
const D = JSON.parse(readFileSync(new URL('genka_rates.json', ASSETS)));
const S = D.shogaku_tokurei;
const genkaPage = readFileSync(new URL('../docs/genka/index.html', import.meta.url), 'utf8');
const columnPage = readFileSync(
  new URL('../docs/column/shogaku-genka-shokyaku/index.html', import.meta.url), 'utf8');

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

// タグを空白に置換して本文だけを見る（属性値も落ちるので meta は別に見る）
const visible = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
// id で名指しした要素の中身だけを取り出す（規則3・規則5: 主張が1回しか現れない最小の要素まで下ろす）
const byId = (html, id) => {
  const m = html.match(new RegExp(`<(\\w+)[^>]*id="${id}"[^>]*>([\\s\\S]*?)</\\1>`));
  assert.ok(m, `id="${id}" の要素が見つからない`);
  return visible(m[2]);
};

// ── 1. 条文の書き下しオラクル ⇔ 参照データ ──────────────────────────────────────
t('データ: 取得価額の基準は 40万円未満（措法28条の2①/67条の5①）', () => {
  assert.strictEqual(S.chusho_mangan, 400000);
  assert.strictEqual(S.chusho_mangan_label, '40万円未満');
});
t('データ: 改正前（令和8年3月31日以前の取得）は 30万円未満', () => {
  assert.strictEqual(S.chusho_mangan_kyu, 300000);
  assert.strictEqual(S.chusho_mangan_kyu_label, '30万円未満');
});
t('データ: 拡充の境界は取得年月 2026-04（=令和8年4月1日・附則35条/65条の「施行日以後に取得」）', () => {
  assert.strictEqual(S.chusho_kakuju_start, '2026-04');
  assert.strictEqual(S.chusho_kakuju_start_label, '令和8年4月1日');
});
t('データ: 年間限度は300万円', () => {
  assert.strictEqual(S.chusho_nengaku_gendo, 3000000);
});
t('データ: 適用期限（取得期限）は令和11年3月31日＝2029-03-31', () => {
  assert.strictEqual(S.chusho_kigen, '2029-03-31');
  assert.strictEqual(S.chusho_kigen_label, '令和11年3月31日');
});
t('データ: 従業員要件は400人以下（旧500人・特定法人300人）', () => {
  assert.strictEqual(S.chusho_jugyoin, 400);
  assert.strictEqual(S.chusho_jugyoin_kyu, 500);
  assert.strictEqual(S.chusho_jugyoin_tokutei_hojin, 300);
});
t('データ: 少額10万円未満（所令138条）・一括償却20万円未満3年（所令139条）', () => {
  assert.strictEqual(S.shogaku_mangan, 100000);
  assert.strictEqual(S.ikkatsu_mangan, 200000);
  assert.strictEqual(S.ikkatsu_years, 3);
});
t('データ整合: 拡充の開始は適用期限より前（期限切れの制度を拡充と称さない）', () => {
  assert.ok(S.chusho_kakuju_start < S.chusho_kigen.slice(0, 7));
});

// ── 2. コアの挙動（取得年月で基準額が変わる）───────────────────────────────────
const notesOf = (cost, acqYm) =>
  calcGenka({ method: 'teigaku', cost, life: 4, acqYm }, D).notes.join('\n');
const tokureiNote = (cost, acqYm) =>
  notesOf(cost, acqYm).split('\n').filter((n) => n.includes('少額減価償却資産の特例'));

t('★35万円・令和8年4月取得: 特例を案内し「40万円未満」と言う（旧コードは案内しなかった）', () => {
  const n = tokureiNote(350000, '2026-04');
  assert.strictEqual(n.length, 1, '特例の注記がちょうど1つ出ること');
  assert.ok(n[0].includes('40万円未満'), n[0]);
  assert.ok(n[0].includes('令和11年3月31日'), n[0]);
  assert.ok(n[0].includes('400人'), n[0]);
});
t('35万円・令和8年3月取得: 旧基準（30万円未満）では対象外なので特例を案内しない', () => {
  assert.strictEqual(tokureiNote(350000, '2026-03').length, 0);
});
t('29万9,999円・令和8年3月取得: 旧基準で対象。「30万円未満」と言う', () => {
  const n = tokureiNote(299999, '2026-03');
  assert.strictEqual(n.length, 1);
  assert.ok(n[0].includes('30万円未満'), n[0]);
  assert.ok(!n[0].includes('40万円未満'), '旧取得に新基準を持ち込まない: ' + n[0]);
});
t('境界: 39万9,999円は対象・40万円ちょうどは対象外（「未満」）', () => {
  assert.strictEqual(tokureiNote(399999, '2026-04').length, 1);
  assert.strictEqual(tokureiNote(400000, '2026-04').length, 0);
});
t('境界: 令和8年3月31日以前＝29万9,999円まで／30万円ちょうどは対象外', () => {
  assert.strictEqual(tokureiNote(299999, '2026-03').length, 1);
  assert.strictEqual(tokureiNote(300000, '2026-03').length, 0);
});
t('★期限: 令和11年3月取得は案内する／令和11年4月取得は「使える」と言わず期限を告げる', () => {
  const inTime = tokureiNote(350000, '2029-03');
  assert.strictEqual(inTime.length, 1);
  assert.ok(inTime[0].includes('全額経費にできる'), inTime[0]);
  const after = tokureiNote(350000, '2029-04');
  assert.strictEqual(after.length, 1, '期限後も黙らず、期限を告げること');
  assert.ok(!after.includes('全額経費にできる場合があります'), after[0]);
  assert.ok(after[0].includes('までに取得したものが対象'), after[0]);
  assert.ok(after[0].includes('延長されたかどうか'), after[0]);
});
t('10万円・20万円の案内: 19万9,999円では出る／20万円ちょうどでは出ない', () => {
  assert.ok(notesOf(199999, '2026-04').includes('一括償却資産として3年で均等'));
  assert.ok(!notesOf(200000, '2026-04').includes('一括償却資産として3年で均等'));
});
t('回帰防止: コアに 300000 の直書きゲートが残っていない（金額の正本はデータ）', () => {
  const core = readFileSync(new URL('genka_core.js', ASSETS), 'utf8');
  assert.ok(!/cost\s*<\s*300000/.test(core), 'cost < 300000 の直書きが残っている');
  assert.ok(!/30万円未満まで少額減価償却資産/.test(core), '旧文言が残っている');
});

// ── 3. ページ ⇔ データ（規則3/4/5: 主張が1回だけ現れる要素を名指し）──────────────
t('/genka/ 一覧の中小特例の行が「40万円未満」「300万円」を言う', () => {
  const li = byId(genkaPage, 'shogaku-chusho');
  assert.ok(li.includes(S.chusho_mangan_label), li);
  assert.ok(li.includes('300万円'), li);
  assert.ok(!li.includes('30万円未満'), '旧基準が残っている: ' + li);
});
t('★/genka/ の注記が「令和8年4月1日以後の取得」「それ以前は30万円未満」「令和11年3月31日」「400人」を全部言う', () => {
  const p = byId(genkaPage, 'shogaku-kakuju');
  for (const must of [S.chusho_kakuju_start_label, '以後に取得', S.chusho_mangan_label,
                      S.chusho_mangan_kyu_label, S.chusho_kigen_label,
                      String(S.chusho_jugyoin) + '人', String(S.chusho_jugyoin_tokutei_hojin) + '人']) {
    assert.ok(p.includes(must), `注記に「${must}」が無い: ${p}`);
  }
});
t('/genka/ の見出し・目次が「40万円未満」を名乗る（30万円のまま残さない）', () => {
  const h2 = genkaPage.match(/<h2 id="shogaku">([^<]*)<\/h2>/);
  assert.ok(h2 && h2[1].includes('40万円未満'), '見出し: ' + (h2 && h2[1]));
  const toc = genkaPage.match(/<a href="#shogaku">([^<]*)<\/a>/);
  assert.ok(toc && toc[1] === (h2 && h2[1]), '目次と見出しが一致しない: ' + (toc && toc[1]));
});
t('★/genka/ のFAQは本文とJSON-LDの「回答文そのもの」が40万円を言う（設問名や括弧書きで代用しない）', () => {
  // 規則7: 同じ「40万円」が回答の別の文（括弧の中）にも出るので、主張が1回だけ現れる
  //        節（＝いくらの資産をいくらまで全額経費にできるか）を名指しする。
  // 規則8: この主張はhead側のJSON-LDにも本文にも出る＝2箇所とも別々に見ないと素通しする。
  const CLAIM = '中小企業者等は40万円未満の資産を年間合計300万円まで';
  const WRONG = '30万円未満の資産を年間合計';

  const body = genkaPage.match(/<h3>Q\. 10万円[^<]*<\/h3>\s*<p>([\s\S]*?)<\/p>/);
  assert.ok(body, 'FAQ本文の回答が見つからない');
  assert.ok(visible(body[1]).includes(CLAIM), 'FAQ本文の回答: ' + visible(body[1]).slice(0, 140));
  assert.ok(!visible(body[1]).includes(WRONG), 'FAQ本文に旧基準が残っている');

  const ldRaw = genkaPage.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ldRaw, 'JSON-LDが見つからない');
  const graph = JSON.parse(ldRaw[1])['@graph'];
  const faqPage = graph.find((n) => n['@type'] === 'FAQPage');
  assert.ok(faqPage, 'FAQPageのJSON-LDが無い');
  const q = faqPage.mainEntity.find((x) => x.name.startsWith('Q. 10万円'));
  assert.ok(q, '少額資産のFAQがJSON-LDに無い');
  assert.ok(q.name.includes('40万円未満'), '設問名が古い: ' + q.name);
  assert.ok(q.acceptedAnswer.text.includes(CLAIM), 'JSON-LDの回答文が古い: ' + q.acceptedAnswer.text.slice(0, 140));
  assert.ok(!q.acceptedAnswer.text.includes(WRONG), 'JSON-LDの回答文に旧基準が残っている');
  assert.ok(q.acceptedAnswer.text.includes('令和8年4月1日以後'), '改正時期がJSON-LDの回答に無い');
});
t('/genka/ が特例の条文（措法28条の2・67条の5）を出典に挙げる', () => {
  const v = visible(genkaPage);
  assert.ok(v.includes('租税特別措置法28条の2'), '出典に条文が無い');
  assert.ok(v.includes('附則35条'), '適用時期の根拠（附則）が無い');
});

// ── 4. コラム記事 ⇔ データ（同じ数字が2箇所にあるので両方を名指し）────────────────
t('コラム: 改正calloutが「40万円未満」「令和8年4月1日以後に取得」「令和11年」「500人以下から400人以下」', () => {
  const m = columnPage.match(/<div class="callout">\s*<b>令和8年度税制改正[\s\S]*?<\/div>/);
  assert.ok(m, '改正calloutが見つからない');
  const c = visible(m[0]);
  for (const must of ['40万円未満', '令和8年4月1日以後に取得', '令和11年', '500人以下から400人以下']) {
    assert.ok(c.includes(must), `calloutに「${must}」が無い`);
  }
});
t('コラム: 要件表の「取得価額」行と「適用期限」行がデータと一致', () => {
  const rows = columnPage.match(/<tr><td>[\s\S]*?<\/tr>/g) || [];
  const row = (label) => {
    const r = rows.find((x) => x.startsWith(`<tr><td>${label}</td>`));
    assert.ok(r, `要件表に「${label}」の行が無い`);
    return visible(r);
  };
  assert.ok(row('取得価額').includes(S.chusho_mangan_label), row('取得価額'));
  assert.ok(row('取得価額').includes(S.chusho_mangan_kyu_label), row('取得価額'));
  // 記事は「令和11年（2029年）3月31日」と西暦を併記するので、和暦と月日を分けて見る
  assert.ok(row('適用期限').includes('令和11年'), row('適用期限'));
  assert.ok(row('適用期限').includes('3月31日'), row('適用期限'));
  assert.ok(row('従業員数').includes(String(S.chusho_jugyoin) + '人以下'), row('従業員数'));
  assert.ok(row('従業員数').includes(String(S.chusho_jugyoin_kyu) + '人以下'), row('従業員数'));
});

// ── 5. カナリア（期限つき措置は放置すると黙って腐る）──────────────────────────────
t('★カナリア: recheck_after を過ぎたら赤くなる（令和11年度改正で延長の有無を確認する）', () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(today <= S.recheck_after,
    `${S.recheck_after} を過ぎた。${S.expire_note}`);
});
t('カナリア: 適用期限そのものを過ぎていないか（過ぎたら特例の案内を止める判断が要る）', () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(today <= S.chusho_kigen,
    `適用期限 ${S.chusho_kigen} を過ぎた。延長の有無を確認し chusho_kigen を更新すること`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
