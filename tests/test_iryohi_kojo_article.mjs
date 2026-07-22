// 記事「医療費控除はいくらから？いくら戻る？（令和8年分）」の数字・引用・規則を機械照合する。
//
// 規律（CLAUDE.md「検査の9つの規則」）:
//  - 存在確認(includes)ではなく「集合の一致」で見る。過不足の両方を落とす（規則6）
//  - 表記の系統ごとに別の網を張る（カンマ金額 / 万円 / % / 年）。日数の網は日付を先に除去する
//  - ★網は「値の過不足」には強いが、**同じ値が複数箇所に出る主張の位置ずれ**には無力（規則7）。
//    この記事で網が守れない主張は5つ:
//      (a) 10万円は「上限(キャップ)」か「下限(床)」か —— どちらに書いても集合には10万円が残る
//      (b) 補填金を「ひも付いた医療費からだけ引く」か「総額から引く」か —— 数字は同じ
//      (c) 傷病手当金・出産手当金を「差し引く/差し引かない」の入れ替え —— 表の行を入れ替えても
//          記事全体の語の集合は変わらない
//      (d) タクシー代・ガソリン代が ○ 側か × 側か —— 対象/対象外の列の入れ替え
//      (e) 所得の高い人／低い人のどちらで「税率」が効き「足切り」が下がるのか —— 行の入れ替え
//    → いずれも **その主張が1回しか現れない最小の要素** を名指しして見る（規則3・4・5）
//  - ★外部オラクル: 記事の目玉である足切り額の表を、**国税庁No.1410の給与所得控除の式と
//    所得税法73条1項の式からこの場で計算し直して**照合する。記事が自分の算数を根拠にしないための独立実装。
//  - title と meta description も検査対象に入れる（規則9）
import fs from 'node:fs';

const FILE = process.env.ARTICLE_FILE || 'docs/column/iryohi-kojo-ikura-kara/index.html';
const html = fs.readFileSync(FILE, 'utf8');
let ng = 0;
const fail = m => { console.error('  ✗ ' + m); ng++; };
const ok = m => console.log('  ✓ ' + m);

// ───────── 前提（一次情報。ここだけが手打ちを許される） ─────────
// 国税庁 No.1410「給与所得控除」の速算式（収入660万円以下の範囲。記事の表はこの範囲だけを使う）
const kyuyoKojo = R => {
  if (R <= 1_900_000) return 650_000;
  if (R <= 3_600_000) return Math.floor(R * 0.30) + 80_000;
  if (R <= 6_600_000) return Math.floor(R * 0.20) + 440_000;
  throw new Error('記事の表は給与収入660万円以下しか扱わない');
};
// ★★給与所得は「速算式」ではなく所得税法**別表第五**で求めるのが法（速算式は660万円以上の備考）。
//   別表第五は収入190万円以上660万円未満を**4,000円刻みの区分**にしており、その区分の下限額で控除を計算する。
//   → 速算式をそのまま収入に当てると、刻みのぶんだけ答えがずれる。
//   ⚠️このオラクルは以前ここを速算式で書いていたため、記事の「297万円」行の誤り（総所得1,999,000円・
//     足切り99,950円。正しくは1,997,600円・99,880円）を**記事と同じ誤りを共有していたので見逃していた**。
//     外部オラクルは「独立実装」であるだけでは足りず、**法の求め方そのもの**でなければ意味がない。
const kyuyoShotokuR7 = R => {
  if (R < 651_000) return 0;
  if (R < 1_900_000) return R - 650_000;
  if (R < 6_600_000) { const A = Math.floor(R / 4_000) * 4_000; return A - kyuyoKojo(A); }
  return R - kyuyoKojo(R);
};
// ★令和8年分・令和9年分＝租税特別措置法29条の4（給与所得控除の最低保障 65万→74万）。
//   収入220万円以上は改正後の別表第五が改正前と完全一致するので、そのまま別表第五へ委譲する。
const kyuyoShotokuR8 = R => {
  if (R < 741_000) return 0;
  if (R < 2_191_000) return R - 740_000;
  if (R < 2_193_000) return 1_451_000;
  if (R < 2_196_000) return 1_453_000;
  if (R < 2_200_000) return 1_456_000;
  return kyuyoShotokuR7(R);
};
// 所得税法73条1項: 足切り = min(総所得金額等 × 5/100, 10万円)。控除額の上限は200万円
const ASHIKIRI_CAP = 100_000;
const KOJO_CAP = 2_000_000;
const ashikiri = shotoku => Math.min(Math.floor(shotoku * 0.05), ASHIKIRI_CAP);
// 所得税法73条1項 + 国税庁No.1120: 補填金は「その給付の目的となった医療費」を限度に引く（他へ回さない）
const kojoGaku = items => {
  const iryohi = items.reduce((s, it) => s + Math.max(0, it.hi - (it.hoten || 0)), 0);
  return Math.min(Math.max(0, iryohi - ASHIKIRI_CAP), KOJO_CAP);
};
// 国税庁 No.2260「所得税の税率」令和8年分 速算表
const SOKUSAN = [
  [1_949_000, 5, 0], [3_299_000, 10, 97_500], [6_949_000, 20, 427_500],
  [8_999_000, 23, 636_000], [17_999_000, 33, 1_536_000], [39_999_000, 40, 2_796_000],
  [Infinity, 45, 4_796_000],
];
const FUKKO = 0.021;   // 復興特別所得税（基準所得税額の2.1%）
const JUMINZEI = 0.10; // 地方税法35条(4%) + 314条の3(6%) = 標準税率で合計10%

// ───────── 外部オラクル1: 足切り額の表を、給与所得控除の式から計算し直す ─────────
// 記事の表（給与収入 → 給与所得控除 → 総所得金額等 → その5% → 足切り）を独立実装で再現する。
const ROWS = [1_600_000, 2_000_000, 2_500_000, 2_970_000, 3_000_000, 5_000_000];
const oracle = ROWS.map(R => {
  const shotoku = kyuyoShotokuR8(R);   // ★令和8年分の記事なので R8 規則で求める
  const kojo = R - shotoku;            // 表の「給与所得控除」は 収入 − 給与所得（別表第五では差額として現れる）
  return { R, kojo, shotoku, gopct: Math.floor(shotoku * 0.05), ashi: ashikiri(shotoku) };
});
// 記事が主張する「200万円未満なら足切りは10万円より低い / 200万円以上は10万円で固定」を独立に確かめる
{
  const below = oracle.filter(o => o.shotoku < 2_000_000);
  const above = oracle.filter(o => o.shotoku >= 2_000_000);
  if (below.length && below.every(o => o.ashi < ASHIKIRI_CAP)) ok(`オラクル: 総所得<200万の${below.length}件は足切り<10万円`);
  else fail('オラクル: 総所得200万円未満なのに足切りが10万円になった行がある');
  if (above.length && above.every(o => o.ashi === ASHIKIRI_CAP)) ok(`オラクル: 総所得≧200万の${above.length}件は足切り=10万円で固定`);
  else fail('オラクル: 総所得200万円以上なのに足切りが10万円でない行がある');
}
// 境目: 足切りが10万円を下回る最大の給与収入 = 2,971,999円（記事が名指ししている数）。
// ★別表第五は4,000円刻みなので、給与だけの人の総所得金額等は「ちょうど200万円」を通り過ぎる
//   （1,997,600円の次が2,000,400円）。速算式で逆算した1円単位の境目（2,971,427円）は法の求め方ではない。
const KYOKAI = (() => {
  for (let R = 2_980_000; R >= 2_960_000; R--) {
    if (ashikiri(kyuyoShotokuR8(R)) < ASHIKIRI_CAP) return R;
  }
  throw new Error('境目が見つからない');
})();
if (KYOKAI === 2_971_999) ok(`オラクル: 足切りが10万円を下回る最大の給与収入 = ${KYOKAI.toLocaleString()}円`);
else fail(`オラクル: 境目の給与収入が 2,971,999 でなく ${KYOKAI}`);
// 刻みをまたぐ2値も固定する（記事が「1,997,600円の次は2,000,400円」と書いている根拠）
if (kyuyoShotokuR8(2_971_999) === 1_997_600 && kyuyoShotokuR8(2_972_000) === 2_000_400)
  ok('オラクル: 別表第五の刻みで総所得は 1,997,600円 → 2,000,400円 と跳ぶ（200万円ちょうどを通らない）');
else fail(`オラクル: 刻みの跳びが記事と違う（${kyuyoShotokuR8(2_971_999)} → ${kyuyoShotokuR8(2_972_000)}）`);

// ───────── 外部オラクル2: 還付額（控除額×税率）を速算表から計算し直す ─────────
const zeiritsu = kazei => SOKUSAN.find(([hi]) => kazei <= hi)[1];
const modoru = (kojo, kazei) => {
  const r = zeiritsu(kazei) / 100;
  const shotokuzei = Math.round(kojo * r);
  const fukko = Math.round(shotokuzei * FUKKO);
  const jumin = Math.round(kojo * JUMINZEI);
  return { shotokuzei, fukko, jumin, total: shotokuzei + fukko + jumin };
};
// 記事の主例: 医療費30万・補填金なし・年収500万（足切り10万）・課税所得200万（税率10%）
{
  const k = kojoGaku([{ hi: 300_000 }]);
  if (k === 200_000) ok('オラクル: 医療費30万・補填金なし → 控除額20万円');
  else fail(`オラクル: 控除額が20万円でなく ${k}`);
  const m = modoru(k, 2_000_000);
  if (m.shotokuzei === 20_000 && m.fukko === 420 && m.jumin === 20_000 && m.total === 40_420)
    ok('オラクル: 税率10% → 所得税20,000+復興420+住民税20,000 = 40,420円');
  else fail(`オラクル: 還付額が40,420円でなく ${JSON.stringify(m)}`);
  const m20 = modoru(k, 4_000_000); // 課税所得400万 → 税率20%
  if (m20.total === 60_840) ok('オラクル: 税率20% → 60,840円');
  else fail(`オラクル: 税率20%の還付額が60,840円でなく ${m20.total}`);
}
// ★オラクル3: 補填金の「ひも付き」ルール —— 総額から引く誤った計算と結論が変わることを確かめる
{
  const seikai = kojoGaku([{ hi: 150_000, hoten: 200_000 }, { hi: 120_000 }]);
  const goshin = Math.max(0, (150_000 + 120_000) - 200_000 - ASHIKIRI_CAP); // 総額どうしで引く誤り
  if (seikai === 20_000) ok('オラクル: ひも付きで引くと控除額20,000円');
  else fail(`オラクル: 正しい控除額が20,000円でなく ${seikai}`);
  if (goshin === 0) ok('オラクル: 総額から引く誤りだと控除額0円（結論が逆になる）');
  else fail(`オラクル: 誤った計算の控除額が0円でなく ${goshin}`);
  if (seikai > goshin) ok('オラクル: 引き方の違いで「使える/使えない」が分かれる');
  else fail('オラクル: 引き方の違いが結論を変えていない（記事の目玉が成立しない）');
}

// ───────── 記事の要素を取り出す（規則3: ページ全体でなく要素を名指し） ─────────
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const body = html.slice(html.indexOf('<article>'));
const rows = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
// 主語のセルで一意に特定する（規則4: 名指しは一意であれ）
// ★タグ剥がしは <b> の位置に空白を入れる（`<b>入院給付金</b>（生命保険）` → `入院給付金 （生命保険）`）ので、
//   空白を潰してから比べる。ここを忘れると、正しい記事を「行が無い」と落とす（規則1: まず疑うのは検査）。
const squash = s => strip(s).replace(/\s+/g, '');
const rowBySubject = subj => rows.find(r => {
  const first = r.match(/<td>([\s\S]*?)<\/td>/);
  return first && squash(first[1]) === squash(subj);
});

// (1) 足切りの表: 6行それぞれをオラクルの数字と照合する
for (const o of oracle) {
  const subj = `${o.R / 10_000}万円`;
  const tr = rowBySubject(subj);
  if (!tr) { fail(`足切りの表に「${subj}」の行が無い`); continue; }
  const text = strip(tr);
  const want = [o.kojo, o.shotoku, o.gopct, o.ashi];
  const miss = want.filter(v => !text.includes(v.toLocaleString()) && !text.includes(`${v / 10_000}万円`));
  if (miss.length === 0) ok(`表の行「${subj}」: 控除${o.kojo.toLocaleString()} / 所得${o.shotoku.toLocaleString()} / 5%=${o.gopct.toLocaleString()} / 足切り${o.ashi.toLocaleString()}`);
  else fail(`表の行「${subj}」に ${miss.map(v => v.toLocaleString()).join(', ')} が無い（オラクルと不一致）`);
}

// (1b) ★境目の主張は「本文」と「出典」の2か所に数字が出るので、網では守れない（規則7）。
//      → 境目の段落と、その根拠を述べた注記の段落を、それぞれ名指しする。
const PARAS = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(m => strip(m[1]));
{
  const p = PARAS.find(t => t.includes('境目は') && t.includes(KYOKAI.toLocaleString()));
  if (!p) fail('境目（総所得金額等200万円）を述べた段落が見つからない');
  else {
    if (p.includes('総所得金額等が200万円')) ok('境目の段落: 境目は総所得金額等200万円');
    else fail('★境目が「総所得金額等200万円」でなくなっている');
    if (p.includes('99,880円')) ok('境目の段落: 手前の足切りは99,880円');
    else fail('★境目の段落の足切り額がオラクル(99,880円)と違う');
  }
}
// (1c) ★なぜ1円単位で切り替わらないのか＝別表第五の4,000円刻み。ここが記事の核心の根拠で、
//      これを落とすと「速算式で逆算した境目」という誤り（以前この記事が載せていた）に戻る。
{
  const p = PARAS.find(t => t.includes('別表第五') && t.includes('刻み'));
  if (!p) fail('★別表第五の4,000円刻みを説明した段落が見つからない（境目の根拠が消えている）');
  else {
    // ★規則5: この段落は「4,000円刻み」を2回言う（区分の定義＋階段状に増える説明）ので、
    //   段落単位で includes すると片方を壊しても素通しする（壊しテストで実際に素通しした）。
    //   → 主張が1回しか現れない最小の要素＝太字の「4,000円刻みの区分」まで名指しを下ろす。
    if (/<b>4,000円刻みの区分<\/b>/.test(body)) ok('刻みの段落: 別表第五は4,000円刻みの区分（太字を名指し）');
    else fail('★別表第五の区分が「4,000円刻み」でなくなっている');
    if (p.includes('1,997,600円') && p.includes('2,000,400円'))
      ok('刻みの段落: 総所得は 1,997,600円 → 2,000,400円 と跳ぶ（オラクル一致）');
    else fail('★刻みの段落の跳びの2値がオラクルと違う');
  }
}

// (2) ★10万円は「上限」であって「下限」ではない（網では守れない。位置ずれ＝規則7）
{
  // 「足切り＝5％と10万円の低いほう」と言い切っている段落を名指しする
  const p = [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => m[1])
    .find(t => t.includes('キャップ') && t.includes('かっこ書き'));
  if (!p) fail('10万円がキャップである旨を述べた段落が見つからない');
  else {
    const t = strip(p);
    if (/足切り＝5％と10万円の低いほう/.test(t)) ok('「足切り＝5％と10万円の低いほう」と明言している');
    else fail('足切りが「5％と10万円の低いほう」だと明言していない');
    if (/床ではなく、天井/.test(t)) ok('10万円を「床ではなく天井」と位置づけている');
    else fail('★10万円の位置づけ（床/天井）が入れ替わっているか、失われている');
  }
}

// (3) 条文の引用が原文どおりか（blockquote を名指し。粒度＝規則5）
{
  const bq = [...body.matchAll(/<blockquote>([\s\S]*?)<\/blockquote>/g)].map(m => strip(m[1]));
  const joubun = bq.find(t => t.includes('百分の五'));
  if (!joubun) fail('所得税法73条の引用（blockquote）が無い');
  else {
    // 原文の核心: 「百分の五に相当する金額（当該金額が十万円を超える場合には、十万円）」
    if (joubun.includes('百分の五に相当する金額') && joubun.includes('当該金額が十万円を超える場合には、十万円'))
      ok('73条の引用が原文どおり（5%が本体・10万円がかっこ書き）');
    else fail('★73条の引用が改ざんされている（5%と10万円の関係が原文と違う）');
    if (joubun.includes('二百万円を超える場合には、二百万円')) ok('引用に控除上限200万円が含まれる');
    else fail('引用から控除上限200万円が落ちている');
  }
  const nta = bq.find(t => t.includes('その給付の目的となった医療費'));
  if (!nta) fail('国税庁No.1120の引用（補填金の差し引き方）が無い');
  else if (nta.includes('他の医療費からは差し引きません')) ok('No.1120の引用に「他の医療費からは差し引きません」がある');
  else fail('★No.1120の引用の核心（他の医療費からは差し引かない）が改ざんされている');
}

// (4) ★補填金の表: 「差し引く / 差し引かない」の割り当て（行を入れ替えても網は緑になる）
{
  const HOTEN = [
    ['高額療養費', true], ['入院給付金（生命保険）', true], ['出産育児一時金', true],
    ['傷病手当金', false], ['出産手当金', false], ['会社からの見舞金', false],
  ];
  for (const [name, hiku] of HOTEN) {
    const tr = rowBySubject(name);
    if (!tr) { fail(`補填金の表に「${name}」の行が無い`); continue; }
    const cells = [...tr.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => strip(m[1]));
    const handan = cells[1] || '';
    const hikuY = /^差し引く/.test(handan);
    const hikuN = /差し引かない/.test(handan);
    if (hiku && hikuY && !hikuN) ok(`補填金「${name}」= 差し引く`);
    else if (!hiku && hikuN) ok(`補填金「${name}」= 差し引かない`);
    else fail(`★補填金「${name}」の判定が逆（記載: ${handan}）`);
  }
}

// (5) ★対象/対象外の表: タクシー代・ガソリン代・健康診断が × 側にあること（列の入れ替えを落とす）
{
  const taisho = rows.filter(r => r.includes('<td>') && !r.includes('<th>'));
  const findRow = kw => taisho.find(r => strip(r).includes(kw));
  const CHECKS = [
    ['自家用車のガソリン代・駐車場代', 1], // 1 = 右列（対象にならない）
    ['それ以外のタクシー代', 1],
    ['ビタミン剤', 1],
    ['通院のための電車・バス代', 0],      // 0 = 左列（対象になる）
    ['公共交通機関が使えない場合のタクシー代', 0],
  ];
  for (const [kw, col] of CHECKS) {
    const tr = findRow(kw);
    if (!tr) { fail(`対象/対象外の表に「${kw}」が無い`); continue; }
    const cells = [...tr.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => strip(m[1]));
    const at = cells.findIndex(c => c.includes(kw.replace(/<[^>]+>/g, '')));
    if (at === col) ok(`対象表「${kw}」は${col === 0 ? '◯対象' : '✕対象外'}の列にある`);
    else fail(`★対象表「${kw}」が${col === 0 ? '対象' : '対象外'}の列にない（列が入れ替わっている）`);
  }
}

// (6) ★「誰でまとめるか」の表: 税率と足切りの向きが逆になっていないこと
{
  const zei = rowBySubject('税率');
  const ashi = rowBySubject('足切り');
  if (!zei || !ashi) fail('「誰でまとめるか」の表（税率・足切りの行）が無い');
  else {
    const zc = [...zei.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => strip(m[1]));
    const ac = [...ashi.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => strip(m[1]));
    // 列は [項目, 所得の高い人, 所得の低い人]
    if (/^◯/.test(zc[1]) && /^✕/.test(zc[2])) ok('税率は「所得の高い人」に◯（向きが正しい）');
    else fail('★税率の◯✕が逆（高所得側が有利でなくなっている）');
    if (/^✕/.test(ac[1]) && /^◯/.test(ac[2])) ok('足切りは「所得の低い人」に◯（向きが正しい）');
    else fail('★足切りの◯✕が逆（低所得側で足切りが下がる、が失われている）');
  }
}

// (7) ★所得税を払っていない人に寄せても戻らない（記事の落とし穴。callout の中の <p> を名指し）
{
  const co = [...body.matchAll(/<div class="callout">([\s\S]*?)<\/div>/g)].map(m => m[1]);
  const zei0 = co.find(c => c.includes('税金を払っていない人'));
  if (!zei0) fail('「税金を払っていない人に寄せても戻らない」の callout が無い');
  else {
    // 粒度（規則5）: callout の見出し <b> ではなく、中の <p> が主張を持っているか見る
    const ps = [...zei0.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => strip(m[1]));
    const p = ps.find(t => t.includes('所得控除'));
    if (p && /「税金を減らす」仕組みであって、「お金をもらう」仕組みではありません/.test(p))
      ok('落とし穴: 所得控除は税金を減らす仕組みであって、もらう仕組みではない');
    else fail('★所得控除の性質（減らす／もらう）の説明が失われている');
    if (p && /所得税の還付はゼロ/.test(p)) ok('落とし穴: 納税していない人に寄せると還付ゼロ');
    else fail('★「納税していない人に寄せると還付ゼロ」が失われている');
  }
}

// (8) セルフメディケーション税制の期限と金額（callout を名指し）
{
  const co = [...body.matchAll(/<div class="callout">([\s\S]*?)<\/div>/g)].map(m => m[1]);
  const self = co.find(c => c.includes('令和八年'));
  if (!self) fail('セルフメディケーション税制の期限を述べた callout が無い');
  else {
    const t = strip(self);
    if (t.includes('令和8年12月31日まで')) ok('セルフメディケーション: 令和8年12月31日までと明記');
    else fail('★セルフメディケーション税制の期限が改ざんされている');
    if (t.includes('現行法のままなら今年が最後の適用年')) ok('セルフメディケーション: 現行法では今年が最後と明記');
    else fail('★「現行法では今年が最後」が失われている');
  }
  // 金額（12,000円超・88,000円限度）は本文の <p> に1回だけ出る
  const p = [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => strip(m[1]))
    .find(t => t.includes('特定一般用医薬品等'));
  if (p && p.includes('12,000円を超える部分') && p.includes('88,000円を限度'))
    ok('セルフメディケーション: 12,000円超・88,000円限度');
  else fail('★セルフメディケーションの金額（12,000円超／88,000円限度）が違う');
}

// (9) 還付申告は5年・年末調整ではできない（それぞれ要素を名指し）
{
  const co = [...body.matchAll(/<div class="callout">([\s\S]*?)<\/div>/g)].map(m => strip(m[1]));
  const gonen = co.find(c => c.includes('還付申告は5年間できる'));
  if (gonen && gonen.includes('その年の翌年1月1日から5年間')) ok('還付申告: 翌年1月1日から5年間');
  else fail('★還付申告の期間（翌年1月1日から5年間）が失われている');

  const p = [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => strip(m[1]))
    .find(t => t.includes('年末調整では受けられません'));
  if (p) ok('年末調整では受けられない旨を明記');
  else fail('★「年末調整では受けられない」が失われている');
}

// ───────── 集合一致の網（規則6: 表記の系統ごとに別の網。網の外を数える） ─────────
// 網の外に残るもの: 条文の漢数字（百分の五・十万円・二百万円）→ (3) の引用照合で守る
//                   ◯✕の割り当て → (4)(5)(6) の要素照合で守る
{
  const text = strip(body);
  // 日付を先に除去する（「2026年」「令和8年12月31日」の年・日を数値の網が拾って正しい記事を落とすため）
  const noDate = text
    .replace(/令和\d+年\d+月\d+日/g, '')
    .replace(/令和\d+年/g, '').replace(/平成\d+年\d+月\d+日/g, '').replace(/平成\d+年/g, '')
    .replace(/\d{4}年/g, '').replace(/2月16日|3月15日|1月1日|4月1日/g, '');

  const set = re => [...new Set((noDate.match(re) || []))].sort();
  const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  // 網1: カンマ区切りの金額
  // ★足切りの表は、給与所得控除と総所得金額等を「65万円」のような万円表記で書き、5%と足切りだけを
  //   カンマ表記で書いている。どちらの網に入るかは表記で決まるので、オラクルの値を表記ごとに振り分ける。
  const kane = set(/\d{1,3}(?:,\d{3})+円/g);
  const kaneWant = [...new Set([
    // 足切りの表のうちカンマ表記のセル（オラクル由来）: 5%と足切り
    ...oracle.flatMap(o => [o.gopct, o.ashi]).map(v => v.toLocaleString() + '円'),
    // 297万円の行だけは控除・所得もカンマ表記（万円で割り切れないため。オラクル由来）
    ...[oracle.find(o => o.R === 2_970_000)].flatMap(o => [o.kojo, o.shotoku]).map(v => v.toLocaleString() + '円'),
    // 境目（オラクル由来）: 手前の最大収入と、そこから1円上＝10万円で頭打ちになる収入
    KYOKAI.toLocaleString() + '円', (KYOKAI + 1).toLocaleString() + '円',
    // 別表第五の刻みで総所得が跳ぶ2値（オラクル由来）
    ...[KYOKAI, KYOKAI + 1].map(R => kyuyoShotokuR8(R).toLocaleString() + '円'),
    // 還付の例（オラクル由来）
    '20,000円', '20,420円', '40,420円', '40,840円', '60,840円', '4,000円',
    // リード・FAQ の例（年収160万円・医療費6万円 → 60,000 − 足切り。★オラクル由来にして手打ちを避ける）
    (60_000 - oracle.find(o => o.R === 1_600_000).ashi).toLocaleString() + '円',
    // 速算表（国税庁No.2260）
    '1,000円', '1,949,000円', '1,950,000円', '3,299,000円', '3,300,000円', '6,949,000円',
    '6,950,000円', '8,999,000円', '9,000,000円', '17,999,000円', '18,000,000円', '39,999,000円',
    '40,000,000円', '97,500円', '427,500円', '636,000円', '1,536,000円', '2,796,000円', '4,796,000円',
    // セルフメディケーション税制
    '12,000円', '88,000円',
    // 補填金の例（カンマ表記で出るのは通院・薬代と、誤った計算の結果）
    '120,000円', '70,000円',
  ])].sort();
  if (eq(kane, kaneWant)) ok(`金額の網: ${kane.length}種が一致（過不足なし）`);
  else {
    const extra = kane.filter(v => !kaneWant.includes(v));
    const missing = kaneWant.filter(v => !kane.includes(v));
    fail(`金額の網が不一致 — 記事にしかない: [${extra}] / 期待にしかない: [${missing}]`);
  }

  // 網2: 「◯万円」表記（カンマを含まないので金額の網には構造上入らない＝規則6）
  const man = set(/\d+万円/g);
  const manWant = [...new Set([
    // 足切りの表の控除・所得（オラクル由来。万円で割り切れる行だけ万円表記）
    ...oracle.filter(o => o.kojo % 10_000 === 0).map(o => o.kojo / 10_000 + '万円'),
    ...oracle.filter(o => o.shotoku % 10_000 === 0).map(o => o.shotoku / 10_000 + '万円'),
    ...oracle.map(o => o.R / 10_000 + '万円'),  // 年収の列
    // 制度の数字
    '10万円',   // 足切りのキャップ
    '200万円',  // 総所得金額等の境目 かつ 控除額の上限
    // 給与所得控除の式（国税庁No.1410）と、令和8年分の特例（措法29条の4）の境界
    '190万円', '360万円', '660万円', '8万円', '44万円', '65万円',
    '220万円',  // ★措法29条の4: この収入未満だけ最低保障74万円が効く（改正の効き目の境界）
    // 還付の例
    '30万円', '20万円', '4万円',
    // 補填金の例
    '15万円', '12万円', '5万円',
    // リードの例（医療費6万円）
    '6万円',
  ])].sort();
  if (eq(man, manWant)) ok(`万円表記の網: ${man.length}種が一致`);
  else {
    const extra = man.filter(v => !manWant.includes(v));
    const missing = manWant.filter(v => !man.includes(v));
    fail(`万円表記の網が不一致 — 記事にしかない: [${extra}] / 期待にしかない: [${missing}]`);
  }

  // 網3: パーセント（本文は全角％で統一している。半角%は head の meta にしかない）
  const pct = set(/\d+(?:\.\d+)?[%％]/g);
  const pctWant = [...new Set([
    '5％',                                       // 所得税法73条の足切り率／速算表の最低税率
    '10％', '20％', '23％', '33％', '40％', '45％', // 速算表（No.2260）＋住民税の合計10％
    '30％',                                      // 給与所得控除の式（No.1410）
    '2.1％',                                     // 復興特別所得税
    '6％', '4％', '2％', '8％',                    // 地方税法314条の3・35条（指定都市は8％・2％）
  ])].sort();
  if (eq(pct, pctWant)) ok(`％の網: ${pct.length}種が一致`);
  else {
    const extra = pct.filter(v => !pctWant.includes(v));
    const missing = pctWant.filter(v => !pct.includes(v));
    fail(`％の網が不一致 — 記事にしかない: [${extra}] / 期待にしかない: [${missing}]`);
  }

  // 網4: 年数（「5年間」「6か月」など。日付は上で除去済み）
  const nen = set(/\d+年間|\d+か月/g);
  const nenWant = [...new Set(['5年間', '6か月'])].sort();
  if (eq(nen, nenWant)) ok(`年数の網: ${nen.join(' / ')}`);
  else fail(`年数の網が不一致 — 記事: [${nen}] / 期待: [${nenWant}]`);
}

// ───────── title と meta description（規則9: タグ剥がしで消えるので別に見る） ─────────
{
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([\s\S]*?)">/) || [])[1] || '';
  if (title.includes('10万円は下限ではない')) ok('title: 「10万円は下限ではない」を掲げている');
  else fail('★title から記事の核心（10万円は下限ではない）が失われている');
  if (title.length <= 60) ok(`title: ${title.length}字（60字以内）`);
  else fail(`title が ${title.length}字（60字を超える）`);
  if (/10万円を上限として書いており、下限として書いていません/.test(desc))
    ok('meta description: 上限/下限の位置づけが正しい');
  else fail('★meta description の上限/下限の位置づけが失われているか逆になっている');
  if (/297万円以下なら/.test(desc)) ok('meta description: 297万円の境目を含む');
  else fail('★meta description から境目（297万円）が失われている');
  if (desc.length >= 60) ok(`meta description: ${desc.length}字（60字以上）`);
  else fail(`meta description が ${desc.length}字（60字未満）`);
}

console.log(ng === 0 ? '\n✓ 医療費控除の記事: 全て一致' : `\n✗ ${ng}件の不一致`);
process.exit(ng === 0 ? 0 : 1);
