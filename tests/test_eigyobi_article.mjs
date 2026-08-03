/**
 * /column/eigyobi-kazoekata/ の**ページ本文**の検査（コアの単体テストは test_eigyobi.mjs）。
 *
 * なぜ要るか（2026-08-03 第12便）:
 *   このページはBingで 117表示/1クリック（CTR 0.9%）。受け皿の実測（GetPageQueryStats）を見ると
 *   付いているクエリは**全部「3営業日前」系**で、最大が「3営業日前 数え方」21表示9位。
 *   ところが `<title>`・`<h1>` は「3営業日以内」で始まり、**「前」が1文字も入っていなかった**。
 *   実SERP（「3営業日前 数え方」でkeiri-toolsは8位）でも、上位10件中5件がタイトルに「前」を持つ。
 *   さらに「3営業日以内」には曜日別の早見表があるのに、**「3営業日前」には例が1つあるだけ**だった
 *   （クエリ「3営業日前 数え方 早見表」は5位＝このクラスタで最良の順位）。
 *   → タイトル/h1に「前」を入れ、#mae に曜日別の早見表を足した。**足した主張が消えたら落ちる**ようにする。
 *
 * 規律（CLAUDE.md「検査の9つの規則」):
 *   - 規則3/5: 「本文のどこかに在る」で見ない。**主張が1回しか現れない最小の要素を名指し**する
 *     （「前週の金曜」は既存のcallout（水曜の例）と新設の表の**両方**に出るので、別々に見る）
 *   - 規則9: `<title>` と `<meta name="description">` も検査対象（検索結果に出る＝公開された主張）
 *   - 早見表の中身は手打ちを照合しない。**正本 eigyobi_core.js の addBusinessDays(base, -3) から
 *     期待値を組む**（祝日ゼロの週を実際に探して使う）。コアの数え方が変われば、この検査が本文の
 *     置き忘れを落とす。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { addBusinessDays, dow, iso, DOW_JA, holidayName } from '../docs/assets/eigyobi_core.js';

const HTML = readFileSync(new URL('../docs/column/eigyobi-kazoekata/index.html', import.meta.url), 'utf8');
const HOLIDAYS = JSON.parse(readFileSync(new URL('../docs/assets/holidays_jp.json', import.meta.url)));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

const visible = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// 要素の名指し（規則4: 名指しは一意でなければ効かない）
const el = (re, label) => {
  const m = HTML.match(re);
  assert.ok(m, `${label} が見つからない（構造が変わった可能性）`);
  return m[0];
};

const addRaw = (dt, n) => { const x = new Date(dt.y, dt.m - 1, dt.d + n); return { y: x.getFullYear(), m: x.getMonth() + 1, d: x.getDate() }; };

/** 祝日が前後10日に1つも無い週の月曜を、実際に探す（手で選ばない） */
const cleanWeekMonday = () => {
  let d = { y: 2026, m: 6, d: 1 };
  for (let i = 0; i < 400; i++) {
    const s = addRaw(d, i);
    if (dow(s) !== 1) continue;
    let clean = true;
    for (let k = -10; k <= 10; k++) if (holidayName(addRaw(s, k), HOLIDAYS)) clean = false;
    if (clean) return s;
  }
  throw new Error('祝日ゼロの週が見つからない');
};

const MON = cleanWeekMonday();
/** 基準日の曜日 → 3営業日前の曜日名（コアが正本） */
const maeDow = (offsetFromMon) => DOW_JA[dow(addBusinessDays(addRaw(MON, offsetFromMon), -3, HOLIDAYS, {}))];
/** 3営業日前が前週に入るか（＝暦で5日以上さかのぼるか） */
const goesPrevWeek = (offsetFromMon) => {
  const base = addRaw(MON, offsetFromMon);
  const r = addBusinessDays(base, -3, HOLIDAYS, {});
  return (new Date(base.y, base.m - 1, base.d) - new Date(r.y, r.m - 1, r.d)) / 86400000 >= 5;
};

// ── 1. 検索結果に出る主張（規則9） ────────────────────────────────
t('title に「3営業日前」が入っている（最大クエリの語）', () => {
  const title = el(/<title>[^<]*<\/title>/, '<title>');
  assert.ok(title.includes('3営業日前'), `title に「3営業日前」が無い: ${title}`);
});

t('title に「早見表」が入っている（「3営業日前 数え方 早見表」は5位）', () => {
  const title = el(/<title>[^<]*<\/title>/, '<title>');
  assert.ok(title.includes('早見表'), `title に「早見表」が無い: ${title}`);
});

t('h1 に「3営業日前」が入っている', () => {
  const h1 = el(/<h1[^>]*>[\s\S]*?<\/h1>/, '<h1>');
  assert.ok(visible(h1).includes('3営業日前'), `h1 に「3営業日前」が無い: ${visible(h1)}`);
});

t('JSON-LD の headline が h1 と同じ主張になっている', () => {
  const hl = el(/"headline":\s*"[^"]*"/, 'JSON-LD headline');
  assert.ok(hl.includes('3営業日前'), `headline に「3営業日前」が無い: ${hl}`);
});

t('meta description が「前週まで戻る」ことを予告している', () => {
  const md = el(/<meta name="description" content="[^"]*"/, 'meta description');
  assert.ok(md.includes('前週'), `meta description に「前週」が無い: ${md}`);
  assert.ok(md.includes('早見表'), `meta description に「早見表」が無い: ${md}`);
});

// ── 2. 新設した早見表の中身（正本＝コアから期待値を組む） ──────────
const maeTable = () => el(/<table id="mae-table">[\s\S]*?<\/table>/, '#mae-table');

t('#mae に曜日別の早見表が在る', () => {
  const tb = maeTable();
  assert.ok(tb.includes('3営業日前（＝期限）'), '早見表の見出し列が無い');
});

t('早見表の月〜金の行が、コア addBusinessDays(-3) と一致する', () => {
  const rows = maeTable().split('<tr>').slice(2); // ヘッダ行を除く
  for (let k = 0; k < 5; k++) {                    // 月(0)〜金(4)
    const expect = maeDow(k) + '曜';               // 例: 「水曜」
    const row = rows[k];
    assert.ok(row, `${DOW_JA[k + 1]}曜の行が無い`);
    const last = visible(row.split('<td>').pop()); // 最終列＝3営業日前
    assert.ok(last.includes(expect),
      `基準日 ${DOW_JA[k + 1]}曜 の3営業日前は「${expect}」のはずだが、表は「${last}」`);
  }
});

t('早見表の土日行が、コアと一致する（土・日とも同じ着地）', () => {
  assert.strictEqual(maeDow(5), maeDow(6), '前提が崩れた: 土曜と日曜で着地が違う');
  const last = visible(maeTable().split('<tr>').pop().split('<td>').pop());
  assert.ok(last.includes(maeDow(5) + '曜'),
    `土日の3営業日前は「${maeDow(5)}曜」のはずだが、表は「${last}」`);
});

t('「前週まで戻るのは月・火・水」という本文の主張が、コアと一致する', () => {
  const actual = [0, 1, 2, 3, 4].filter(goesPrevWeek).map((k) => DOW_JA[k + 1]);
  assert.deepStrictEqual(actual, ['月', '火', '水'],
    `前週へ戻る曜日がコアでは ${actual.join('・')} になっている。本文の主張と食い違う`);
});

// ── 3. 本文の主張（規則3/5: 表と別の要素として名指しで見る） ──────
t('前週へ戻る注意書きの <p> が、自分で「前週」と「5日前」を言っている', () => {
  const p = el(/<p><b>基準日が月曜・火曜・水曜のときは[\s\S]*?<\/p>/, '前週の注意書き <p>');
  const v = visible(p);
  assert.ok(v.includes('前週'), '「前週」が無い');
  assert.ok(v.includes('5日前'), '「5日前」が無い（暦日との差が消えている）');
});

t('漢数字「三営業日」に触れている（実クエリに存在する表記）', () => {
  assert.ok(HTML.includes('三営業日'), '「三営業日」の表記に触れていない');
});

t('ツールCTAが「◯営業日前」も出せることを言っている', () => {
  const cta = el(/<a class="tool-cta"[\s\S]*?<\/a>/, 'ツールCTA');
  assert.ok(visible(cta).includes('営業日前'),
    'CTAが「営業日後」しか案内していない（コアは負数で「前」も計算できる）');
});

// ── 4. 目次と見出しの同期（第11便で踏んだ穴） ────────────────────
t('#mae の h2 と目次のリンク文字列が一致する', () => {
  const h2 = visible(el(/<h2 id="mae">[\s\S]*?<\/h2>/, '#mae の h2'));
  const toc = visible(el(/<li><a href="#mae">[\s\S]*?<\/a><\/li>/, '目次の #mae'));
  assert.strictEqual(toc, h2, `目次「${toc}」と h2「${h2}」が食い違う`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
