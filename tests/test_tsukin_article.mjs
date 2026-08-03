/**
 * /column/tsukin-teate-hikazei/ の**ページ本文**の検査（このページに対応するツール/コアは無い）。
 *
 * なぜ要るか（2026-08-03 第13便）:
 *   このページはBingで 35表示/**0クリック**。受け皿の実測（GetPageQueryStats）で付いているクエリは
 *   「通勤手当 非課税限度額」4表示9位 / 「車通勤 非課税限度額」3表示8位 /
 *   「マイカー通勤 非課税限度額」2表示8位 / 「マイカー 非課税限度額」2表示9位 の4件（＋無関係な英語2件）。
 *   ＝ **車で通う人の限度額を知りたい人**が来ている。
 *
 *   本文を数えたところ、**「有料道路」「高速」が1回も出てこなかった**。
 *   国税庁 No.2585 は交通用具通勤者の限度額を**4通り**に定めており（1 マイカーのみ /
 *   2 ＋駐車場等 / 3 ＋有料道路 / 4 ＋有料道路＋駐車場等）、3・4は**上限が150,000円**。
 *   ところが本ページは1と2しか書いておらず、読者は「車通勤の非課税枠は
 *   66,400＋5,000＝**71,400円が上限**」と誤読する。**枠を過小に見積もらせる欠落**だった。
 *   → #yuryo を新設。**この4通りの表と上限15万円が消えたら落ちる**ようにする。
 *
 *   併せて `<title>` に**西暦（2026年）と「車通勤」が無かった**（実SERP上位10件は
 *   7/10が西暦、5/10がマイカー系の語をタイトルに持つ）。第11便の jidoshazei と同型。
 *
 * 規律（CLAUDE.md「検査の9つの規則」):
 *   - 規則3/5: 「本文のどこかに在る」で見ない。**主張が1回しか現れない最小の要素を名指し**する。
 *     「150,000円」「15万円」「5,000円」「2km未満」は本文・FAQ・出典に**何度も**出るので、
 *     行(`<tr>`)・callout・note・FAQの`<p>`を個別に名指しする。
 *   - 規則6: 金額の網はカンマ区切りだけでは足りない。**「15万円」は漢数字混じりで網に入らない**ので
 *     表記の系統ごとに見る。
 *   - 規則7: 同じ値が複数箇所に出る主張は、網ではなく要素の名指しで守る。
 *   - 規則9: `<title>` と `<meta name="description">` も検査対象（検索結果に出る＝公開された主張）。
 *   - 例示の算数は手打ちを信じない。**同じページの早見表の行から 32,300 を読み直して検算する**
 *     （早見表を直したのに例示を直し忘れたら落ちる）。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../docs/column/tsukin-teate-hikazei/index.html', import.meta.url), 'utf8');

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

const visible = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** 要素の名指し（規則4: 名指しは一意でなければ効かない） */
const el = (re, label) => {
  const all = HTML.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
  assert.ok(all && all.length, `${label} が見つからない（構造が変わった可能性）`);
  assert.strictEqual(all.length, 1, `${label} が ${all.length} 箇所に一致した。名指しが一意でない（規則4）`);
  return all[0];
};

// ── 看板（規則9） ───────────────────────────────────────────────
const title = el(/<title>[^<]*<\/title>/, '<title>');
const desc = el(/<meta name="description" content="[^"]*">/, 'meta description');

t('title に実クエリの「車通勤」が入っている', () => {
  assert.ok(title.includes('車通勤'), `title に「車通勤」が無い: ${title}`);
});

t('title に西暦（2026年）が入っている（元号だけにしない）', () => {
  assert.ok(/2026年/.test(title), `title に西暦が無い: ${title}`);
});

t('title に「マイカー」が入っている（実クエリの語）', () => {
  assert.ok(title.includes('マイカー'), `title に「マイカー」が無い: ${title}`);
});

t('meta description が有料道路の上限15万円に触れている', () => {
  assert.ok(/有料道路/.test(desc), `description に「有料道路」が無い: ${desc}`);
  assert.ok(/15万円/.test(desc), `description に「15万円」が無い: ${desc}`);
});

// ── 目次と見出しの対応（#yuryo を消したら落ちる） ─────────────────
t('#yuryo の h2 が在り、目次から同じ文言でリンクされている', () => {
  const h2 = el(/<h2 id="yuryo">[^<]*<\/h2>/, '#yuryo の h2');
  const text = visible(h2);
  const toc = el(/<li><a href="#yuryo">[^<]*<\/a><\/li>/, '目次の #yuryo 項目');
  assert.strictEqual(visible(toc), text, `目次「${visible(toc)}」と h2「${text}」が食い違う`);
});

// ── 4通りの表（規則3/5: 行を1本ずつ名指しする） ────────────────────
/** #yuryo セクションの中だけを切り出す（他セクションの表を拾わないため） */
const yuryoSection = (() => {
  const start = HTML.indexOf('<h2 id="yuryo">');
  const end = HTML.indexOf('<h2 id="keisan">');
  assert.ok(start > 0 && end > start, '#yuryo セクションを切り出せない');
  return HTML.slice(start, end);
})();

/**
 * 行の特定は**1列目のセルの完全一致**で行う（規則4）。
 * `includes` だと「マイカーなど＋有料道路」が「マイカーなど＋有料道路＋駐車場等」の行にも当たり、
 * 3行目と4行目を区別できない（前者は後者の接頭辞）。
 */
const rowOf = (firstCell, label) => {
  const rows = yuryoSection.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  const hit = rows.filter((r) => {
    const td = r.match(/<td>([\s\S]*?)<\/td>/);
    return td && visible(td[1]) === firstCell;
  });
  assert.strictEqual(hit.length, 1, `${label}: 1列目が「${firstCell}」の行が ${hit.length} 本（1本であるべき）`);
  return visible(hit[0]);
};

t('表に「マイカーなどだけ」の行があり、上限が66,400円', () => {
  const row = rowOf('マイカーなどだけ', '4通りの表');
  assert.ok(row.includes('66,400円'), `行に 66,400円 が無い: ${row}`);
});

t('表に「＋駐車場等」の行があり、上限が71,400円（66,400+5,000）', () => {
  const row = rowOf('マイカーなど＋駐車場等', '4通りの表');
  assert.ok(row.includes('71,400円'), `行に 71,400円 が無い: ${row}`);
  assert.ok(row.includes('5,000円'), `行に駐車場の上限5,000円が無い: ${row}`);
});

t('★表に「＋有料道路」の行があり、上限が150,000円', () => {
  const row = rowOf('マイカーなど＋有料道路', '4通りの表');
  assert.ok(row.includes('150,000円'), `行に 150,000円 が無い: ${row}`);
  assert.ok(row.includes('合理的な料金の額'), `行に「合理的な料金の額」が無い: ${row}`);
});

t('★表に「＋有料道路＋駐車場等」の行があり、上限が150,000円', () => {
  const row = rowOf('マイカーなど＋有料道路＋駐車場等', '4通りの表');
  assert.ok(row.includes('150,000円'), `行に 150,000円 が無い: ${row}`);
});

// ── 例示の算数を、同じページの早見表から検算する（手打ちを信じない） ──
t('例示 55,300円 が、早見表の45〜55km区分＋高速18,000＋駐車場5,000と一致する', () => {
  // 早見表（#hayami）の「45km以上 55km未満」の行から距離区分の額を読み直す
  const hayami = HTML.slice(HTML.indexOf('<h2 id="hayami">'), HTML.indexOf('<h2 id="kaisei">'));
  const rows = (hayami.match(/<tr>[\s\S]*?<\/tr>/g) || []).filter((r) => visible(r).includes('45km以上'));
  assert.strictEqual(rows.length, 1, `早見表の45km行が ${rows.length} 本`);
  const m = visible(rows[0]).match(/(\d{1,3}(?:,\d{3})+)円/);
  assert.ok(m, `早見表の45km行から金額を読めない: ${visible(rows[0])}`);
  const kyori = Number(m[1].replace(/,/g, ''));

  // 例示の段落（#yuryo 内で「55,300円」を主張している <p> を名指し）
  const paras = (yuryoSection.match(/<p>[\s\S]*?<\/p>/g) || []).filter((p) => visible(p).includes('55,300円'));
  assert.strictEqual(paras.length, 1, `例示の段落が ${paras.length} 個（1個であるべき）`);
  const text = visible(paras[0]);

  const kosoku = Number((text.match(/高速代を月([\d,]+)円/) || [])[1]?.replace(/,/g, ''));
  assert.ok(kosoku, `例示から高速代を読めない: ${text}`);
  const expected = kyori + kosoku + 5000;
  assert.strictEqual(expected, 55300,
    `早見表(${kyori}) + 高速(${kosoku}) + 駐車場(5000) = ${expected} だが、本文は 55,300円 と書いている`);
  assert.ok(text.includes(`${kyori.toLocaleString()}円＋`), `例示が早見表の額 ${kyori} を使っていない: ${text}`);
});

// ── 2km未満の除外（規則5: note の中の最小要素まで下ろす） ───────────
t('片道2km未満は駐車場代も有料道路も非課税にならないと書いてある', () => {
  const note = el(/<div class="note">\s*<b>片道2km未満の人は、このどれにも当てはまりません<\/b>[\s\S]*?<\/div>/, '2km未満のnote');
  const body = visible(note).replace('片道2km未満の人は、このどれにも当てはまりません', '');
  assert.ok(/駐車場代も有料道路の料金も非課税になりません/.test(body),
    `note の本文が主張を再掲していない（見出しだけでは規則5違反）: ${body}`);
});

// ── FAQ（本文と別の場所で同じ主張をするので、別に名指しして守る） ────
t('FAQ「高速道路を使っています」の答えが上限15万円を言っている', () => {
  const i = HTML.indexOf('Q. 通勤で高速道路を使っています。その料金も非課税になりますか？</h3>');
  assert.ok(i > 0, 'FAQ の設問（高速道路）が見つからない');
  const ans = HTML.slice(i).match(/<p>([\s\S]*?)<\/p>/);
  assert.ok(ans, 'FAQ の答えの <p> が無い');
  const text = visible(ans[1]);
  assert.ok(/15万円/.test(text), `答えに上限15万円が無い: ${text}`);
  assert.ok(/加算/.test(text), `答えに「加算できる」旨が無い: ${text}`);
});

t('FAQ「ガソリン代の実費」の答えが、実費でも距離区分で判定すると言っている', () => {
  const i = HTML.indexOf('Q. ガソリン代の実費として支給しています。実費なら限度額は関係ありませんか？</h3>');
  assert.ok(i > 0, 'FAQ の設問（ガソリン代）が見つからない');
  const ans = HTML.slice(i).match(/<p>([\s\S]*?)<\/p>/);
  assert.ok(ans, 'FAQ の答えの <p> が無い');
  const text = visible(ans[1]);
  assert.ok(/距離に応じた限度額で判定/.test(text), `答えが距離区分での判定を言っていない: ${text}`);
});

// ── 「いくらまで非課税か」のFAQは、有料道路の存在を落としてはいけない ──
t('総論FAQ が交通用具でも有料道路の加算があることに触れている', () => {
  const i = HTML.indexOf('Q. 通勤手当は結局いくらまで非課税ですか？</h3>');
  assert.ok(i > 0, '総論FAQ の設問が見つからない');
  const ans = HTML.slice(i).match(/<p>([\s\S]*?)<\/p>/);
  const text = visible(ans[1]);
  assert.ok(/有料道路/.test(text),
    `総論FAQ が有料道路に触れていない＝「交通用具は距離区分の定額だけ」と読ませる: ${text}`);
});

console.log(`\n${fail === 0 ? '✅' : '❌'} 通勤手当の記事: ${pass} 件成功 / ${fail} 件失敗`);
if (fail > 0) process.exit(1);
