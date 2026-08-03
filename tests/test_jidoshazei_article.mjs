/**
 * /jidoshazei/ の**ページ本文**の検査（コアの単体テストは test_jidoshazei.mjs）。
 *
 * なぜ要るか（2026-08-03 第11便）:
 *   このページはBingで 206表示/1クリック（CTR 0.5%）＝**表示はあるのに選ばれていない**。
 *   実SERP（「排気量 税金」でkeiri-toolsは8位）を読むと、上位10件のうち6件が
 *   タイトルに「早見表」を、9件が西暦（2026年）を入れていた。当ページはどちらも0回で、
 *   さらに「1,500ccはどちらの区分か」（＝境界を「以下」で読む）に答えていなかった。
 *   → タイトル・meta・境界の説明を足した。**足した主張が消えたら落ちる**ようにする。
 *
 * 規律（CLAUDE.md「検査の9つの規則」）:
 *   - 規則3/5: 「本文のどこかに在る」で見ない。**主張が1回しか現れない最小の要素を名指し**する
 *     （1,500cc/30,500円 は hero・meta・境界calloutの3箇所に出るので、**それぞれ別に**見る）
 *   - 規則9: `<title>` と `<meta name="description">` も検査対象（検索結果に出る＝公開された主張）
 *   - 金額は手打ちを照合しない。**正本 jidoshazei_r08.json の bracket から期待値を組む**
 *     （税率が改定されてデータを差し替えたら、この検査が本文の置き忘れを落とす）
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../docs/jidoshazei/index.html', import.meta.url), 'utf8');
const D = JSON.parse(readFileSync(new URL('../docs/assets/jidoshazei_r08.json', import.meta.url)));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

// タグを空白に置換して可視文字列にする（属性値は消える＝meta は別に取る）
const visible = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const bracket = (key) => {
  const b = D.passenger.brackets.find((x) => x.key === key);
  assert.ok(b, `正本データに bracket ${key} が無い`);
  return b;
};
const yen = (n) => n.toLocaleString('en-US'); // 30500 -> "30,500"

// 要素の名指し（規則4: 名指しは一意でなければ効かない）
const el = (re, label) => {
  const m = HTML.match(re);
  assert.ok(m, `${label} が見つからない（構造が変わった？）`);
  return m[1];
};

const le1500 = bracket('le1500');
const le2000 = bracket('le2000');
const le2500 = bracket('le2500');

// ── 1. <title>: SERPで戦っている語（早見表・西暦）が入っていること ──────────────
t('title に「早見表」と西暦の年度が入っている（実SERPの上位10件が持っていた語）', () => {
  const title = el(/<title>([^<]*)<\/title>/, '<title>');
  assert.ok(title.includes('早見表'), `title に「早見表」が無い: ${title}`);
  assert.ok(/2026年度/.test(title), `title に西暦の年度が無い: ${title}`);
  assert.ok(title.includes('令和8年度'), `title の和暦が消えている（データ年の申告）: ${title}`);
  assert.ok(title.includes('排気量'), `title に「排気量」が無い: ${title}`);
});

// ── 2. meta description: 冒頭の答え（cc→年額）が正本と一致 ─────────────────────
//    規則9。ここは検索結果のスニペットに出るので、金額が古いと**公開された嘘**になる。
t('meta description の 1,500cc/2,000cc の年額が正本データと一致する', () => {
  const desc = el(/name="description" content="([^"]*)"/, 'meta description');
  assert.ok(desc.includes(`1,500ccなら年${yen(le1500.new)}円`),
    `meta description の1,500ccの額が正本(${yen(le1500.new)}円)と違う: ${desc.slice(0, 90)}`);
  assert.ok(desc.includes(`2,000ccなら年${yen(le2000.new)}円`),
    `meta description の2,000ccの額が正本(${yen(le2000.new)}円)と違う: ${desc.slice(0, 90)}`);
  assert.ok(desc.includes('早見表'), 'meta description に「早見表」が無い');
});

// ── 3. hero の <p>: 上と同じ値だが**別の要素**なので別に見る（規則7）────────────
t('hero の答え（1,500cc/2,000cc）が正本データと一致する', () => {
  const hero = visible(el(/<section class="hero">([\s\S]*?)<\/section>/, 'hero セクション'));
  assert.ok(hero.includes(`1,500ccなら年${yen(le1500.new)}円`), `hero の1,500ccの額が正本と違う: ${hero.slice(0, 160)}`);
  assert.ok(hero.includes(`2,000ccなら年${yen(le2000.new)}円`), `hero の2,000ccの額が正本と違う: ${hero.slice(0, 160)}`);
  assert.ok(/<h1>[^<]*早見表[^<]*<\/h1>/.test(HTML), 'h1 に「早見表」が無い');
});

// ── 4. 境界の説明（実SERPで判明した欠落）──────────────────────────────────────
//    名指しは callout ではなく**その中の <p>** まで下ろす（規則5: <b>の見出しが同じ主張を
//    含んでいると、本文を消しても緑になる）。見出しは「どちらの区分？」しか言っていない。
t('境界callout の <p> が「1,500cc は 1リットル超1.5リットル以下」と自分で言っている', () => {
  const callout = el(/<div class="callout" id="cc-kyokai">([\s\S]*?)<\/div>/, '境界callout(#cc-kyokai)');
  const p = visible(el(new RegExp(`id="cc-kyokai">[\\s\\S]*?<p>([\\s\\S]*?)<\\/p>`), '境界callout の <p>'));

  // 見出しは主張を再掲していないこと（＝この検査が <p> を本当に見ていること）
  const head = visible(el(/id="cc-kyokai">\s*<b>([\s\S]*?)<\/b>/, '境界callout の見出し'));
  assert.ok(!head.includes(yen(le1500.new)), '見出しが金額を再掲している。名指しの粒度が効かない（規則5）');

  assert.ok(p.includes('以下'), '境界の説明に「以下」が無い');
  assert.ok(p.includes(`1,500cc（＝1.5リットル）は「${le1500.label}」で年${yen(le1500.new)}円`),
    `1,500cc の区分・金額が正本(${le1500.label} / ${yen(le1500.new)}円)と一致しない: ${p.slice(0, 200)}`);
  assert.ok(p.includes(`2,000cc（＝2リットル）は「${le2000.label}」で年${yen(le2000.new)}円`),
    `2,000cc の区分・金額が正本(${le2000.label} / ${yen(le2000.new)}円)と一致しない: ${p.slice(0, 200)}`);
  // 1つ上の区分へ跳ねる例（「超」は含まない側）
  assert.ok(p.includes('1,501cc') && p.includes('2,001cc'), '境界の1つ上（1,501cc/2,001cc）の例が無い');
  assert.ok(p.includes(`「${le2500.label}」`), `2,001cc の行き先(${le2500.label})が書かれていない`);
});

// ── 5. 早見表の見出しと目次が一致している（見出しを変えたら目次も変える）────────
t('早見表の h2 と目次のリンク文字列が一致する', () => {
  const h2 = el(/<h2 id="ichiran">([\s\S]*?)<\/h2>/, 'h2#ichiran');
  const toc = el(/<a href="#ichiran">([\s\S]*?)<\/a>/, '目次の #ichiran リンク');
  assert.strictEqual(visible(toc), visible(h2), '目次と h2 の文字列が食い違う');
  assert.ok(visible(h2).includes('早見表'), 'h2#ichiran に「早見表」が無い');
});

console.log(`\n${fail === 0 ? '✅' : '❌'} test_jidoshazei_article: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
