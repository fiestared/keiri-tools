// 記事「高額療養費の自己負担限度額」の数字・条文引用・境界主張を機械照合する。
//
// 規律（CLAUDE.md「検査の9つの規則」）:
//  - 存在確認(includes)ではなく「集合の一致」で見る。過不足の両方を落とす（規則6）
//  - 網の外に残る主張を数える。この記事で網の外に出るのは
//      ・**等級**（「第30級」— カンマが無いので金額の網に構造上入らない）
//      ・**条文番号**（42条1項1号 / 129条の2第2項）
//      ・**「1円」「1%」**（3桁未満）
//    → 等級は別の網、条文番号と境界の主張は**要素の名指し**で守る（規則6・7）
//  - ★この記事の最大の危険は「同じ金額が複数箇所に出る主張の**位置ずれ**」（規則7）。
//    87,430円 と 171,820円 は 表・本文・FAQ・図解 に何度も出るので、
//    **どちらがどの区分の額か**を入れ替えても金額の集合は変わらない。
//    → 崖の表は **報酬月額のセル（514,999/515,000）で行を特定**し、その行の中だけを見る（規則4・5）
//  - ★外部オラクル: 記事の目玉（1円で84,390円変わる）を、自分の算数ではなく
//    **本番ツールの等級表（docs/assets/shaho_core.js の kenkoGrade）** と
//    **施行令42条の式** から独立に再計算して照合する。
//    記事・ツール・政令の3つが噛み合えば、読み違えていないと分かる。
import fs from 'node:fs';
import { kenkoGrade, KENKO_GRADES } from '../docs/assets/shaho_core.js';

const FILE = process.env.ARTICLE_FILE || 'docs/column/kogaku-ryoyohi/index.html';
const html = fs.readFileSync(FILE, 'utf8');
let ng = 0;
const fail = m => { console.error('  ✗ ' + m); ng++; };
const ok = m => console.log('  ✓ ' + m);

// ───────── 前提（一次情報。ここだけが手打ちを許される） ─────────
// 健康保険法施行令42条1項（e-Gov法令 v2 で条文全文を確認）
// ★号の順番は ウ(1号=「以外の者」)・ア(2号)・イ(3号)・エ(4号)・オ(5号) で、表の並びと違う
const SEIREI = {
  ウ: { go: 1, base: 80100,  start: 267000, rate: 0.01, tasuukai: 44400 },
  ア: { go: 2, base: 252600, start: 842000, rate: 0.01, tasuukai: 140100 },
  イ: { go: 3, base: 167400, start: 558000, rate: 0.01, tasuukai: 93000 },
  エ: { go: 4, flat: 57600,  tasuukai: 44400 },
  オ: { go: 5, flat: 35400,  tasuukai: 24600 },
};
// 施行令41条1項1号かっこ書き: 70歳未満の世帯合算は「二万千円…以上のものに限る」
const GASSAN_MIN = 21000;
// 区分の境目（施行令42条1項2号〜4号。**標準報酬月額**であって年収でも報酬月額でもない）
const KUBUN_KYOKAI = { ア: 830000, イ: 530000, エ: 280000 };
// 協会けんぽ「高額療養費」の公表表に載っている12個の金額（curlで生HTMLを確認）
const KYOKAI_KENPO = [80100, 252600, 167400, 57600, 35400, 140100, 93000, 44400, 24600, 267000, 558000, 842000];

// ───────── 外部オラクル1: 政令の式 ⇔ 協会けんぽの公表表 ─────────
{
  const fromSeirei = new Set();
  for (const v of Object.values(SEIREI)) {
    for (const k of ['base', 'start', 'flat', 'tasuukai']) if (v[k] != null) fromSeirei.add(v[k]);
  }
  const missing = KYOKAI_KENPO.filter(n => !fromSeirei.has(n));
  const extra = [...fromSeirei].filter(n => !KYOKAI_KENPO.includes(n));
  if (missing.length || extra.length) {
    fail(`政令から読んだ金額と協会けんぽの公表表が一致しない 不足=${missing} 余分=${extra}`);
  } else {
    ok(`外部オラクル: 施行令42条から読んだ12個の金額が協会けんぽの公表表と完全一致`);
  }
}

// ───────── 外部オラクル2: 本番ツールの等級表で「1円の崖」を再現する ─────────
// 記事の目玉。政令の式 × 実際の等級表 から独立に再計算し、記事の数字と突き合わせる。
const genkido = (kubun, iryohi) => {
  const s = SEIREI[kubun];
  if (s.flat != null) return s.flat;
  const pct = Math.max(0, iryohi - s.start) * s.rate;
  // 施行令42条: 1円未満の端数は50銭未満切捨・50銭以上切上
  const rounded = Math.floor(pct) + (pct - Math.floor(pct) >= 0.5 ? 1 : 0);
  return s.base + rounded;
};
// 標準報酬月額 → 区分（政令の境目に当てはめる）
const kubunOf = std => std >= KUBUN_KYOKAI.ア ? 'ア' : std >= KUBUN_KYOKAI.イ ? 'イ' : std >= KUBUN_KYOKAI.エ ? 'ウ' : 'エ';

const IRYOHI = 1000000;   // 医療費100万円（10割）
const CLIFF = {};
for (const hoshu of [514999, 515000]) {
  const g = kenkoGrade(hoshu);                 // ← 本番ツールの等級表そのもの
  CLIFF[hoshu] = { grade: g.grade, std: g.standard, kubun: kubunOf(g.standard), limit: genkido(kubunOf(g.standard), IRYOHI) };
}
{
  const lo = CLIFF[514999], hi = CLIFF[515000];
  const expect = { lo: { grade: 30, std: 500000, kubun: 'ウ', limit: 87430 }, hi: { grade: 31, std: 530000, kubun: 'イ', limit: 171820 } };
  const same = (a, e) => a.grade === e.grade && a.std === e.std && a.kubun === e.kubun && a.limit === e.limit;
  if (!same(lo, expect.lo) || !same(hi, expect.hi)) {
    fail(`崖の再計算が合わない 514999→${JSON.stringify(lo)} / 515000→${JSON.stringify(hi)}`);
  } else {
    ok(`外部オラクル: 本番ツールの等級表＋施行令の式で、報酬月額1円差の崖を再現(87,430 / 171,820)`);
  }
  const diff = hi.limit - lo.limit;
  if (diff !== 84390) fail(`崖の差額が84,390円でない: ${diff}`);
  else ok(`外部オラクル: 崖の差額 84,390円 を再計算で確認`);
  // 窓口3割からの払い戻し
  const modori = IRYOHI * 0.3 - lo.limit;
  if (modori !== 212570) fail(`払い戻し額が212,570円でない: ${modori}`);
  else ok(`外部オラクル: 高額療養費 212,570円（300,000−87,430）を再計算で確認`);
}

// ───────── 外部オラクル3: 80万円台の標準報酬月額の等級は存在しない ─────────
// 記事は「条文の『83万円未満』と協会けんぽの『79万円まで』は矛盾しない」と主張する。
// その根拠（80万円台の等級が無いこと）を、等級表そのものから確かめる。
{
  const stds = KENKO_GRADES.map(([, std]) => std);
  const between = stds.filter(s => s > 790000 && s < 830000);
  if (between.length) fail(`80万円台の標準報酬月額の等級が存在する: ${between}`);
  else ok(`外部オラクル: 標準報酬月額に80万円台の等級は無い(79万→83万で飛ぶ)＝条文と協会けんぽ表は矛盾しない`);
  // 同じ理由で区分ウの上端が50万円になること
  const uEnd = stds.filter(s => s >= 280000 && s < 530000).pop();
  if (uEnd !== 500000) fail(`区分ウの上端の等級が50万円でない: ${uEnd}`);
  else ok(`外部オラクル: 区分ウ(28万以上53万未満)の上端の等級は50万円`);
}

// ───────── 本文の抽出 ─────────
const body = html.slice(html.indexOf('<article>'));
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const text = strip(body);

// 表の行を「セルの中身」で一意に名指しする（規則4・5: find()は最初の一致を返す）
const rows = [...body.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map(m => m[0]);
const rowBy = (...needles) => rows.find(r => needles.every(n => r.includes(n)));

// ───────── 1. 早見表: 5区分すべての額と**区分の境目**を、区分セルで行を名指しして照合 ─────────
// ★境目のセル（標準報酬月額）まで見ること。金額だけを見ていると
//   「区分イ＝53万円以上」を「50万円以上」に書き換えても緑になる（読者が別の区分の額を見る実害）。
const KYOKAI_CELL = {
  ア: '<td>83万円以上</td>',
  イ: '<td>53万円以上83万円未満</td>',
  ウ: '<td>28万円以上53万円未満</td>',
  エ: '<td>28万円未満</td>',
  オ: '<td>住民税非課税</td>',
};
for (const [k, v] of Object.entries(SEIREI)) {
  const r = rowBy(`<td><b>${k}</b></td>`);
  if (!r) { fail(`早見表に区分${k}の行が無い`); continue; }
  const t = strip(r);
  const want = v.flat != null
    ? [`${v.flat.toLocaleString()}円`]
    : [`${v.base.toLocaleString()}円`, `${v.start.toLocaleString()}円`];
  const miss = want.filter(w => !t.includes(w));
  const tas = `${v.tasuukai.toLocaleString()}円`;
  if (!r.includes(KYOKAI_CELL[k])) fail(`早見表 区分${k}の境目のセルが ${KYOKAI_CELL[k]} でない: ${t}`);
  else if (miss.length) fail(`早見表 区分${k}の行に ${miss} が無い: ${t}`);
  else if (!t.includes(tas)) fail(`早見表 区分${k}の行に多数回該当 ${tas} が無い: ${t}`);
  else ok(`早見表 区分${k}: 境目${strip(KYOKAI_CELL[k]).trim()} / ${want.join(' / ')} ＋多数回 ${tas}`);
}
// 境目の数字が、政令から読んだ標準報酬月額の境界と食い違っていないか（表記ゆれの裏取り）
for (const [k, en] of Object.entries(KUBUN_KYOKAI)) {
  const man = en / 10000;
  if (!KYOKAI_CELL[k].includes(`${man}万円`)) fail(`区分${k}の境目セルが政令の${man}万円と一致しない`);
}
ok('区分の境目(83万/53万/28万)が政令の標準報酬月額と一致');

// ───────── 2. 崖の表: 報酬月額セルで行を名指しし、限度額の**入れ替わり**を落とす ─────────
// （規則7: 87,430 と 171,820 は記事の各所に出るので、集合の網では入れ替えを検出できない）
for (const [hoshu, want] of [[514999, CLIFF[514999]], [515000, CLIFF[515000]]]) {
  const r = rowBy(`<b>${hoshu.toLocaleString()}円</b>の人`);
  if (!r) { fail(`崖の表に報酬月額${hoshu.toLocaleString()}円の行が無い`); continue; }
  const t = strip(r);
  const need = [`第${want.grade}級`, `${(want.std / 10000)}万円`, want.kubun, `${want.limit.toLocaleString()}円`];
  const miss = need.filter(n => !t.includes(n));
  // 反対側の額が同じ行に紛れ込んでいたら落とす（入れ替えの検出）
  const other = hoshu === 514999 ? CLIFF[515000] : CLIFF[514999];
  if (miss.length) fail(`崖の表 ${hoshu}の行に ${miss} が無い: ${t}`);
  else if (t.includes(`${other.limit.toLocaleString()}円`)) fail(`崖の表 ${hoshu}の行に反対側の限度額 ${other.limit} が混入: ${t}`);
  else ok(`崖の表 報酬月額${hoshu.toLocaleString()}円 → 第${want.grade}級・区分${want.kubun}・${want.limit.toLocaleString()}円`);
}

// ───────── 3. 多数回該当の表: 区分ウとエが同じ44,400円に潰れる ─────────
{
  const ru = rowBy('<b>区分ウ</b>'), re = rowBy('<b>区分エ</b>');
  if (!ru || !re) fail('多数回該当の表に区分ウ/エの行が無い');
  else {
    const tu = strip(ru), te = strip(re);
    if (!tu.includes('87,430円') || !tu.includes('44,400円')) fail(`多数回該当 区分ウの行: ${tu}`);
    else if (!te.includes('57,600円') || !te.includes('44,400円')) fail(`多数回該当 区分エの行: ${te}`);
    // 「潰れる」＝エの多数回が57,600のままでない（同じ行に2つ出るので includes では守れない）
    else if (/<td>57,600円<\/td><td><b>57,600円<\/b><\/td>/.test(re.replace(/\s+/g, ''))) fail('区分エの多数回該当が57,600円のまま（44,400円に潰れていない）');
    else ok('多数回該当: 区分ウ(87,430→44,400) / 区分エ(57,600→44,400) が同額に潰れる');
  }
  // ★条文の引用（要件そのもの）。表の額だけ見ていると「12月以内→6月以内」の改ざんが素通しする
  const sec = body.slice(body.indexOf('id="tasuukai"'), body.indexOf('id="taishogai"'));
  if (!strip(sec).includes('当該療養のあった月以前の十二月以内に既に高額療養費が支給されている月数が三月以上ある場合')) {
    fail('多数回該当の節に、施行令42条ただし書の引用（十二月以内・三月以上）が正しく無い');
  } else ok('多数回該当: 要件は「十二月以内に三月以上」＝4回目から（暦年ではない）');
}

// ───────── 4. 世帯合算: 21,000円未満は「まるごと対象外」で合算0円 ─────────
{
  const r = rowBy('<b>合算される額</b>');
  // ★セルを厳密一致で見る。includes('0円') だと「60,000円」が部分文字列として通る（規則4の変種）
  if (!r) fail('世帯合算の表に「合算される額」の行が無い');
  else if (!r.replace(/\s+/g, '').includes('<td><b>0円</b>')) fail(`世帯合算の結論が0円でない: ${strip(r)}`);
  else ok('世帯合算: 20,000円×3件でも合算される額は0円');
  const sec = body.slice(body.indexOf('id="gassan"'), body.indexOf('id="tasuukai"'));
  if (!strip(sec).includes('二万千円')) fail('世帯合算の節に条文の「二万千円」の引用が無い');
  else if (!/21,000円未満の自己負担は[^。]*まるごと合算の対象から外れます/.test(strip(sec).replace(/<[^>]+>/g, ''))) {
    // 「超えた分だけ合算」という誤りとの区別が本文にあるか
    if (!strip(sec).includes('まるごと合算の対象から外れます')) fail('「21,000円未満はまるごと対象外」の断定が節に無い');
    else ok('世帯合算: 「超えた分だけ」ではなく「まるごと対象外」と明記');
  } else ok('世帯合算: 「超えた分だけ」ではなく「まるごと対象外」と明記');
  if (!String(GASSAN_MIN).length || !strip(sec).includes('21,000円')) fail('世帯合算の節に21,000円が無い');
}

// ───────── 5. 条文の号の順番（ウ・ア・イ・エ・オ）— calloutを名指し ─────────
{
  const co = [...body.matchAll(/<div class="callout">[\s\S]*?<\/div>/g)].map(m => m[0]);
  const c = co.find(x => x.includes('次号から第五号までに掲げる者以外の者'));
  if (!c) fail('「1号＝以外の者＝区分ウ」のcalloutが無い');
  else {
    const t = strip(c);
    if (!t.includes('条文の号の順番はウ・ア・イ・エ・オ')) fail(`号の順番の断定が無い: ${t}`);
    else ok('条文の号の順番 ウ・ア・イ・エ・オ（1号が「以外の者」＝区分ウ）');
  }
  // 政令の号番号そのもの（前提と一致するか）
  for (const [k, v] of Object.entries(SEIREI)) {
    if (v.go !== SEIREI[k].go) fail(`号番号の前提が壊れている: ${k}`);
  }
}

// ───────── 6. 限度額適用認定証: 省令が交付対象を「資格確認書の人」に限る ─────────
{
  const sec = body.slice(body.indexOf('id="ninteisho"'), body.indexOf('id="gassan"'));
  const t = strip(sec);
  const need = ['健康保険法施行規則129条の2第2項', '資格確認書の交付又は提供を受けているものに限る'];
  const miss = need.filter(n => !t.includes(n));
  if (miss.length) fail(`認定証の節に ${miss} が無い`);
  else ok('認定証: 施行規則129条の2第2項が交付対象を「資格確認書の交付を受けているものに限る」と限定');
  if (!t.includes('申請する対象から外れている')) fail('「申請しなくてよい」ではなく「対象から外れている」の断定が無い');
  else ok('認定証: マイナ保険証の人は「申請対象ですらない」と明記');
  // 逆側（資格確認書の人は今も事前申請が必要）を落とすと片手落ちになる
  if (!t.includes('マイナ保険証を使っていない人（資格確認書の人）は、今も事前申請が必要')) fail('資格確認書の人は事前申請が必要、の但し書きが無い');
  else ok('認定証: 資格確認書の人は今も事前申請が必要（両側を書いている）');
}

// ───────── 7. ★令和8年8月診療分から限度額が上がる（2026-08-02 訂正） ─────────
// この記事は「7月診療分までの表」と「8月診療分からの表」の**2つ**を載せる。
// 最大の危険は規則7そのもの＝**どちらの額がどちらの期間か**の入れ替え
// （87,430 と 92,940 は両方とも本文に出るので、金額の集合は入れ替えても変わらない）。
// → 新表は **kaisei節の中だけ**を見て、区分セルで行を名指しする（規則4: find は最初の一致を返す。
//   早見表にも <td><b>ア</b></td> があるので、節に切ってから探さないと早見表の行が当たる）。
const SHINPYO = {   // 厚労省PDF「（令和８年８月～令和９年７月）」＋協会けんぽの同名の表（両者一致）
  ア: { base: 270300, start: 901000, tasuukai: 140100, nenkan: '168万円' },
  イ: { base: 179100, start: 597000, tasuukai: 93000,  nenkan: '111万円' },
  ウ: { base: 85800,  start: 286000, tasuukai: 44400,  nenkan: '53万円' },
  エ: { base: 61500,  start: null,   tasuukai: 44400,  nenkan: '53万円' },
  オ: { base: 36900,  start: null,   tasuukai: 24600,  nenkan: '29万円' },
};
{
  // ★節の終わりは id="over70"（70歳以上の節）まで。id="faq" まで取ると、70歳以上の表が
  //   この節の検査に混ざり、kaisei の主張を壊しても新しい節が救ってしまう（規則3）。
  const sec = body.slice(body.indexOf('id="kaisei"'), body.indexOf('id="over70"'));
  const t = strip(sec);

  // 7-1. 訂正したことを読者に申告しているか（黙って書き換えない）
  if (!t.includes('誤りでしたので訂正します')) fail('改正の節に、前日の記述が誤りだった旨の訂正の申告が無い');
  else ok('改正: 「変わらない」と書いていたのは誤りだったと明示して訂正している');

  // 7-2. 新表の5行を、節の中で区分セルを名指しして照合（規則4・5）
  const secRows = [...sec.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map(m => m[0]);
  for (const [k, v] of Object.entries(SHINPYO)) {
    const r = secRows.find(x => x.includes(`<td><b>${k}</b></td>`));
    if (!r) { fail(`8月からの表に区分${k}の行が無い`); continue; }
    const rt = strip(r);
    const need = [`${v.base.toLocaleString()}円`, `${v.tasuukai.toLocaleString()}円`, v.nenkan];
    if (v.start) need.push(`${v.start.toLocaleString()}円`);
    const miss = need.filter(n => !rt.includes(n));
    // ★旧表の額がこの行に紛れ込んでいたら落とす（期間の入れ替えの検出）
    const oldBase = SEIREI[k].flat != null ? SEIREI[k].flat : SEIREI[k].base;
    if (miss.length) fail(`8月からの表 区分${k}の行に ${miss} が無い: ${rt}`);
    else if (rt.includes(`${oldBase.toLocaleString()}円`)) fail(`8月からの表 区分${k}の行に7月までの額 ${oldBase} が混入: ${rt}`);
    else ok(`8月からの表 区分${k}: ${v.base.toLocaleString()}円${v.start ? `＋起点${v.start.toLocaleString()}円` : ''} ／多数回 ${v.tasuukai.toLocaleString()}円／年間上限 ${v.nenkan}`);
  }

  // 7-3. 多数回該当は据え置き＝旧表と同じであること（厚労省が「維持」と明記）
  for (const k of Object.keys(SHINPYO)) {
    if (SHINPYO[k].tasuukai !== SEIREI[k].tasuukai) fail(`前提が壊れている: 区分${k}の多数回該当が新旧で違う`);
  }
  ok('8月からの表: 多数回該当（140,100/93,000/44,400/24,600）は据え置き＝7月までと同額');

  // 7-4. ★87,430（7月まで）と 92,940（8月から）の**紐付け**。差5,510円
  //     金額の網では入れ替えを検出できないので、同じ文の中で照合する（規則7）
  const cliffP = [...sec.matchAll(/<p>[\s\S]*?<\/p>/g)].map(m => strip(m[0]))
    .find(p => p.includes('87,430円') && p.includes('92,940円'));
  if (!cliffP) fail('7月診療分87,430円と8月診療分92,940円を並べて比べた段落が無い');
  else if (!/7月診療分[^。]*87,430円/.test(cliffP) || !/8月診療分[^。]*92,940円/.test(cliffP)) {
    fail(`87,430円と92,940円がどちらの診療月か、同じ文で結び付いていない: ${cliffP}`);
  } else if (!cliffP.includes('5,510円')) fail('差額5,510円が段落に無い');
  else ok('比較: 7月診療分87,430円 → 8月診療分92,940円（差5,510円）が同じ段落で結び付いている');

  // 7-5. 外部オラクル: 新表の式が厚労省の「約9.3万円」を再現するか（自分の算数ではなく公表値と照合）
  const u = SHINPYO.ウ;
  const recomputed = u.base + Math.floor(Math.max(0, 1000000 - u.start) * 0.01 + 0.5);
  if (recomputed !== 92940) fail(`新表 区分ウの再計算が92,940円にならない: ${recomputed}`);
  else ok('外部オラクル: 85,800＋(100万−28.6万)×1%＝92,940円 ＝ 厚労省の「約9.3万円」と一致');
  if (!t.includes('約9.3万円')) fail('厚労省の公表値「約9.3万円」との突き合わせが本文に無い');

  // 7-6. e-Gov の条文にはまだ無い、という食い違いを隠さず開示しているか
  const need = ['令和8年政令第219号', '公的年金等控除の読替額', '205,762字', '協会けんぽ'];
  const miss = need.filter(n => !t.includes(n));
  if (miss.length) fail(`改正の節に ${miss} が無い`);
  else ok('改正: e-Govの条文にまだ載っていないことと、協会けんぽが8月から新表を掲げていることの両方を開示');
  if (!t.includes('証明にはなりません')) fail('「e-Govに無い＝存在しない ではない」という限界の明示が無い');
  else ok('改正: 「e-Govに反映されていない＝改正が無い の証明にはならない」と明記');

  // 7-7. ★早見表（7月まで）の側に、8月からの額が漏れ出していないこと（逆向きの入れ替え）
  const hayami = body.slice(body.indexOf('id="hayami"'), body.indexOf('id="kubun"'));
  const leaked = Object.values(SHINPYO).map(v => v.base).filter(n => strip(hayami).includes(n.toLocaleString() + '円'));
  if (leaked.length) fail(`7月までの早見表に8月からの額が混入: ${leaked}`);
  else ok('7月までの早見表に、8月からの額は入っていない');
  // ★見出しの要素そのものを名指しする（規則3: 「節のどこかに在る」で見ると、
  //   目次の同じ文言が節の外から救ってしまい、見出しを壊しても緑になる）
  const h2 = (body.match(/<h2 id="hayami">([^<]*)<\/h2>/) || [])[1] || '';
  if (!h2.includes('令和8年7月診療分まで')) fail(`早見表のh2が期間を名乗っていない: ${h2}`);
  else ok('早見表のh2が「令和8年7月診療分まで」と期間を名乗っている');
  // 目次も見出しと一致していること（片方だけ直すと目次が古い期間を名乗る）
  if (!body.includes(`<a href="#hayami">${h2}</a>`)) fail('目次の早見表の項目が、h2の文言と一致していない');
  else ok('目次と早見表のh2が一致');
}

// ───────── 8. 端数規則（施行令42条が明記）— 節を名指し ─────────
{
  const sec = body.slice(body.indexOf('id="keisan"'), body.indexOf('id="ninteisho"'));
  const t = strip(sec);
  if (!t.includes('端数が50銭未満なら切り捨て、50銭以上なら1円に切り上げ')) fail('端数規則（50銭未満切捨/50銭以上切上）が計算の節に無い');
  else ok('端数規則: 50銭未満切捨・50銭以上切上（政令が明記）');
}

// ───────── 9. 対象外（食費・差額ベッド）— 厚労省の明記 ─────────
{
  const sec = body.slice(body.indexOf('id="taishogai"'), body.indexOf('id="kaisei"'));
  const t = strip(sec);
  if (!t.includes('入院時の食費負担や差額ベッド代は、自己負担限度額の対象に含みません')) fail('食費・差額ベッドが対象外である断定が無い');
  else ok('対象外: 入院時の食費・差額ベッド代は限度額の対象に含まれない（厚労省）');
  if (!t.includes('傷病手当金や出産手当金は差し引きません')) fail('医療費控除との接続（傷病/出産手当金は補填金でない）が無い');
  else ok('医療費控除との接続: 高額療養費は差し引く／傷病・出産手当金は差し引かない');
}

// ───────── 9b. ★年間上限の仕組み（2026-08-02追加）─────────
// この記事でいちばん誤解されやすい主張＝「年間上限は窓口では引かれない／申請しないと戻らない」。
// 規則3・5: 主張が1回しか現れない最小の要素（h3・その直後のp・callout内のp）を名指しする。
{
  const h3 = (body.match(/<h3 id="nenkan">([^<]*)<\/h3>/) || [])[1] || '';
  if (!/窓口で.*引かれる.*ではなく/.test(h3) || !h3.includes('申請'))
    fail(`年間上限の見出しが「窓口では引かれない・申請して戻る」を名乗っていない: ${h3}`);
  else ok('年間上限: h3が「窓口で引かれるのではなく申請して戻る」と名乗っている');

  // h3 の直後の p（この主張が1回だけ現れる最小の要素）
  const afterH3 = body.slice(body.indexOf('<h3 id="nenkan">'));
  const firstP = strip((afterH3.match(/<p>([\s\S]*?)<\/p>/) || [])[1] || '');
  if (!firstP.includes('その月の窓口負担を下げる仕組みではありません'))
    fail('年間上限が「その月の窓口負担を下げる仕組みではない」と本文で断定されていない');
  else ok('年間上限: 月額の限度額を下げないことを本文が断定している');
  if (!firstP.includes('申請しないと戻りません'))
    fail('「申請しないと戻らない」が本文に無い（読者が取りこぼす最大の実害）');
  else ok('年間上限: 申請しないと戻らないことを明記');
  if (!firstP.includes('年間の高額療養費支給申請書兼自己負担額証明書交付申請書'))
    fail('協会けんぽの年間上限用の申請書名（通常の申請書とは別）が無い');
  else ok('年間上限: 申請書の名前（通常の高額療養費支給申請書とは別）を明記');
  if (!firstP.includes('92,940'))
    fail('窓口で払う額（区分ウ 92,940円）が、年間上限の説明と同じ段落で結び付いていない');
  else ok('年間上限: 窓口では92,940円を払う、と同じ段落で結び付いている');

  // 1年の区切り（暦年・年度と取り違えると全部ずれる）。callout 内の p を名指し
  const co = body.slice(body.indexOf('<b>年間上限の「1年」は、8月診療分から翌年7月診療分までです</b>'));
  const coP = strip((co.match(/<p>([\s\S]*?)<\/p>/) || [])[1] || '');
  if (!coP.includes('暦年（1月〜12月）でも年度（4月〜3月）でもありません'))
    fail('年間上限の1年が「暦年でも年度でもない」と否定されていない');
  else ok('年間上限: 暦年でも年度でもないことを明示');
  if (!coP.includes('令和8年8月診療分〜令和9年7月診療分'))
    fail('最初の1年の期間（令和8年8月〜令和9年7月診療分）が無い');
  else ok('年間上限: 最初の1年の期間を明記');
  if (!coP.includes('令和9年8月以降に償還払いします'))
    fail('厚労省・協会けんぽの「令和9年8月以降に償還払い」の引用が無い（事後精算の根拠）');
  else ok('年間上限: 「令和9年8月以降に償還払い」の一次引用がある');
  if (!coP.includes('7月31日を基準日として'))
    fail('先行制度（外来年間合算）の基準日7月31日の引用が無い（8月〜翌7月の根拠）');
  else ok('年間上限: 先行制度の「7月31日を基準日として」の引用がある');
  // 区分エの軽減（53万円ではなく41万円）。取り違えると12万円ずれる
  if (!coP.includes('53万円ではなく41万円が上限'))
    fail('標準報酬月額15万円以下の年間上限41万円（53万円ではない）が無い');
  else ok('年間上限: 標報15万円以下は41万円（53万円ではない）');

  // ★まだ確定できていないことを開示しているか（fail-closed の申告）
  const t = strip(body.slice(body.indexOf('<h3 id="nenkan">'), body.indexOf('<h3 id="r09">')));
  if (!t.includes('あなたの年間累計は計算していません'))
    fail('年間累計を計算していないことの申告が無い（できないことを黙っている）');
  else ok('年間上限: 年間累計を計算していないことを申告している');
}

// ───────── 9c. ★令和9年8月からの13区分（実装していない将来の表）─────────
// 実装していないものを「対応している」と読ませないこと。かつ、額の転記が正しいこと。
{
  const sec = strip(body.slice(body.indexOf('<h3 id="r09">'), body.indexOf('<h3>なぜ「変わらない」')));
  for (const [n, why] of [['13段階', '細分化後の区分数'], ['110,400円＋1％', '標報44万〜50万円'],
                          ['98,100円＋1％', '標報36万〜41万円'], ['85,800円＋1％', '標報28万〜34万円'],
                          ['34,500円', '標報15万円以下の多数回該当（新設）']]) {
    if (!sec.includes(n)) fail(`令和9年8月の節に ${n}（${why}）が無い`);
    else ok(`令和9年8月: ${n}（${why}）`);
  }
  if (!sec.includes('令和9年7月診療分まで'))
    fail('計算機の対応が令和9年7月診療分までであることが書かれていない');
  else ok('令和9年8月: 計算機は令和9年7月診療分までだと明記');
}

// ───────── 13. ★70歳以上（施行令42条3項・5項）2026-08-02追加 ─────────
// 外部オラクル: 本番ツールが読んでいる docs/assets/kogaku_r08.json の over70 と、記事の表を
// **セル単位**で突き合わせる。記事とツールが食い違えば、必ずどちらかが利用者に嘘をついている。
// 規則4: <b>現役並みⅢ</b> は新旧2つの表に出るので、必ず h3 で節に切ってから行を探す。
// 規則5: 行に含まれるだけでは**列の入れ替え**（外来の上限を世帯の欄に書く等）を見逃すので、
//        セルの位置まで下ろして見る。外来22,000と世帯61,500を入れ替えても行の金額集合は同じ。
const OVER70 = JSON.parse(fs.readFileSync('docs/assets/kogaku_r08.json', 'utf8')).over70;
const OVER70_MONEY = [];
for (const t of OVER70.tables) for (const k of t.kubun) {
  for (const f of ['base', 'threshold', 'tasukai', 'gairai', 'gairai_annual']) if (k[f] != null) OVER70_MONEY.push(k[f]);
}
{
  const yen = n => n.toLocaleString() + '円';
  const afterMark = mark => { const i = body.indexOf(mark); return i < 0 ? '' : body.slice(i); };
  const firstP = frag => strip((frag.match(/<p>([\s\S]*?)<\/p>/) || [])[1] || '');
  const LABEL = { genekinami3: '現役並みⅢ', genekinami2: '現役並みⅡ', genekinami1: '現役並みⅠ',
                  ippan: '一般', teishotoku2: '低所得者Ⅱ', teishotoku1: '低所得者Ⅰ' };
  const SECT = { over70_from_2026_08: 'over70-new', over70_before_2026_08: 'over70-old' };

  // 13-1. 2つの表を、データJSONとセル単位で照合
  for (const tbl of OVER70.tables) {
    const id = SECT[tbl.id];
    const start = body.indexOf(`<h3 id="${id}">`);
    if (start < 0) { fail(`70歳以上: 節 #${id} が記事に無い（${tbl.label}）`); continue; }
    const next = body.indexOf('<h3 id="', start + 8);
    const sec = body.slice(start, next < 0 ? body.length : next);
    const secRows = [...sec.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map(m => m[0]);
    const hasNenkan = tbl.id === 'over70_from_2026_08';   // 年間上限の列は8月からの表だけ
    for (const k of tbl.kubun) {
      const label = LABEL[k.key];
      const r = secRows.find(x => x.includes(`<b>${label}</b>`));
      if (!r) { fail(`70歳以上[${tbl.label}] ${label} の行が無い`); continue; }
      const cells = [...r.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => strip(m[1]).trim());
      const wantCols = hasNenkan ? 5 : 4;
      if (cells.length !== wantCols) { fail(`70歳以上[${label}] 列数が${cells.length}（期待${wantCols}）: ${cells}`); continue; }
      const [, gairai, setai, tasu, nenkan] = cells;
      const bad = [];
      // 外来（個人ごと）— null は「上限が無い」ことを画面に書かせる（空欄で黙らない）
      if (k.gairai == null) { if (!gairai.includes('外来の上限なし')) bad.push(`外来セルが「外来の上限なし」を名乗っていない: ${gairai}`); }
      else if (!gairai.includes(yen(k.gairai))) bad.push(`外来セルに ${yen(k.gairai)} が無い: ${gairai}`);
      if (k.gairai_annual != null && !gairai.includes(`年間${yen(k.gairai_annual)}`)) bad.push(`外来の年間上限 ${yen(k.gairai_annual)} が外来セルに無い: ${gairai}`);
      // 世帯（入院を含む）— 外来の額がここに紛れ込んでいたら列の入れ替え
      if (!setai.includes(yen(k.base))) bad.push(`世帯セルに ${yen(k.base)} が無い: ${setai}`);
      if (k.rate > 0 && !setai.includes(yen(k.threshold))) bad.push(`世帯セルに1%の起点 ${yen(k.threshold)} が無い: ${setai}`);
      if (k.gairai != null && setai.includes(yen(k.gairai))) bad.push(`世帯セルに外来の額 ${yen(k.gairai)} が混入: ${setai}`);
      // 多数回該当 — null（低所得者Ⅰ）は「無い」と書かせる。黙って据え置くと4か月目以降を軽く見せる
      if (k.tasukai == null) { if (!tasu.includes('多数回該当なし')) bad.push(`多数回セルが「多数回該当なし」を名乗っていない: ${tasu}`); }
      else if (!tasu.includes(yen(k.tasukai))) bad.push(`多数回セルに ${yen(k.tasukai)} が無い: ${tasu}`);
      // 年間上限（8月からの表だけ）
      if (hasNenkan) {
        if (!nenkan.includes(`${k.household_annual / 10000}万円`)) bad.push(`年間上限セルが ${k.household_annual / 10000}万円 でない: ${nenkan}`);
        if (k.household_annual_reduced != null && !nenkan.includes(`${k.household_annual_reduced / 10000}万円`)) {
          bad.push(`標報15万円以下の軽減（${k.household_annual_reduced / 10000}万円）が年間上限セルに無い: ${nenkan}`);
        }
      }
      if (bad.length) fail(`70歳以上[${tbl.label}] ${label}: ${bad.join(' / ')}`);
      else ok(`70歳以上[${hasNenkan ? '8月から' : '7月まで'}] ${label}: 外来${k.gairai == null ? 'なし' : yen(k.gairai)}／世帯${yen(k.base)}／多数回${k.tasukai == null ? 'なし' : yen(k.tasukai)}${hasNenkan ? `／年間${k.household_annual / 10000}万円` : ''}`);
    }
  }

  // 13-2. ★二段階の順序（この節の核心）。callout の p を名指しする（規則3・5）
  {
    const p = firstP(afterMark('<b>70歳以上は「①外来だけを個人ごとに」→「②世帯で合算して」の二段階で計算します</b>'));
    const need = [['外来（通院）だけ', '①が外来だけを見ること'], ['ひとりずつ', '①が個人単位であること'],
                  ['施行令42条5項', '①の条文'], ['世帯で合算', '②が世帯単位であること'], ['同42条3項', '②の条文'],
                  ['現役並み所得者には外来の上限がありません', '現役並みは①を飛ばすこと']];
    const miss = need.filter(([n]) => !p.includes(n));
    if (!p) fail('二段階の callout が記事に無い');
    else if (miss.length) fail(`二段階の説明に ${miss.map(m => m[1])} が無い: ${p}`);
    else ok('70歳以上: ①外来を個人ごと(42条5項)→②世帯で合算(42条3項)の順序と、現役並みの例外を明記');
  }

  // 13-3. ★①を飛ばした場合との比較表（セル単位。金額の入れ替えを落とす）
  {
    const rowRight = rowBy('<b>①外来を個人ごとに見る</b>'), rowWrong = rowBy('<b>①を飛ばして世帯の上限だけ当てる</b>');
    if (!rowRight || !rowWrong) fail('①を飛ばした場合との比較表の行が無い');
    else {
      const cR = [...rowRight.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => strip(m[1]).trim());
      const cW = [...rowWrong.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => strip(m[1]).trim());
      const bad = [];
      if (!cR[1].includes('22,000円') || !cR[2].includes('22,000円') || !cR[3].includes('58,000円')) bad.push(`正しい側: ${cR}`);
      if (!cW[1].includes('61,500円') || !cW[2].includes('61,500円') || !cW[3].includes('18,500円')) bad.push(`誤りの側: ${cW}`);
      if (cR[2].includes('61,500円')) bad.push('正しい側の自己負担に世帯の上限が混入');
      if (bad.length) fail(`①を飛ばした比較表: ${bad.join(' / ')}`);
      else ok('70歳以上: ①を飛ばすと自己負担が22,000円→61,500円（戻る額 58,000円→18,500円）');
    }
    // 2.8倍と39,500円は同じ段落で結び付いていること（別々に書くと入れ替えが黙る・規則7）
    const p = [...body.matchAll(/<p>[\s\S]*?<\/p>/g)].map(m => strip(m[0])).find(x => x.includes('2.8倍') && x.includes('39,500円'));
    if (!p) fail('「2.8倍」と差額「39,500円」を並べた段落が無い');
    else if (!p.includes('①の有無が答えを変えるのは、頭打ちしたあとの合計が世帯の上限に届かない月')) {
      fail('①が効く条件（合計が世帯の上限に届かない月）の限定が無い＝常に2.8倍ずれると読めてしまう');
    } else ok('70歳以上: 2.8倍・39,500円と、①が効く条件の限定が同じ段落にある');
  }

  // 13-4. 70歳未満の規律を持ち込む3つの誤り（それぞれ callout の p を名指し）
  for (const [mark, need, name] of [
    ['<b>21,000円の足切りは、70歳未満だけの規律です</b>', '70歳以上の方は自己負担額をすべて合算できます', '21,000円の足切りは70歳未満だけ（協会けんぽの逐語）'],
    ['<b>現役並み所得者かどうかは、標準報酬月額だけでは決まりません</b>', '収入の合計額が520万円未満（1人世帯の場合は383万円未満）', '現役並みは標報だけで決まらない（520万/383万の収入要件）'],
    ['<b>低所得者Ⅰには、多数回該当がありません</b>', '6号にはただし書がなく', '低所得者Ⅰに多数回該当が無い根拠（6号にただし書が無い）'],
  ]) {
    const p = firstP(afterMark(mark));
    if (!p) fail(`70歳以上の落とし穴の callout が無い: ${name}`);
    else if (!p.includes(need)) fail(`${name} の根拠が本文に無い: ${p}`);
    else ok(`70歳以上: ${name}`);
  }

  // 13-5. 外来だけの年間上限（41条の2の計算期間）。窓口では引かれないことも書く
  {
    const p = [...body.matchAll(/<p>[\s\S]*?<\/p>/g)].map(m => strip(m[0])).find(x => x.includes('施行令41条の2'));
    const need = ['毎年8月1日から翌年7月31日までの期間', '216,000円', '144,000円', '96,000円', '窓口で引かれるのではなく'];
    if (!p) fail('外来の年間上限（41条の2）の段落が無い');
    else {
      const miss = need.filter(n => !p.includes(n));
      if (miss.length) fail(`外来の年間上限の段落に ${miss} が無い`);
      else ok('70歳以上: 外来の年間上限（41条の2・8/1〜翌7/31・216,000/144,000/96,000円・事後の償還払い）');
    }
  }

  // 13-6. 目次と h2 の一致（片方だけ直すと目次が古い見出しを名乗る）
  {
    const h2 = (body.match(/<h2 id="over70">([^<]*)<\/h2>/) || [])[1] || '';
    if (!h2.includes('70歳以上')) fail(`70歳以上のh2が見出しを名乗っていない: ${h2}`);
    else if (!body.includes(`<a href="#over70">${h2}</a>`)) fail('目次の70歳以上の項目が、h2の文言と一致していない');
    else ok('目次と70歳以上のh2が一致');
  }
}

// ───────── 10. 網: カンマ金額の集合一致（過不足の両方を落とす） ─────────
{
  // 網の外に出るもの: 等級(第30級)・1円・1%・条文番号 → 上で要素名指し済み
  const found = new Set([...text.matchAll(/(\d{1,3}(?:,\d{3})+)円/g)].map(m => Number(m[1].replace(/,/g, ''))));
  const allow = new Set([
    ...KYOKAI_KENPO,               // 政令の12個
    21000, 20000, 60000, 40000,    // 世帯合算（下限・例の3件・合計・同一病院で2回なら40,000円で対象に入る）
    1000000, 700000, 300000,       // 医療費100万・7割・3割
    87430, 171820, 84390, 212570,  // 崖と払い戻し
    7330,                          // 80,100＋(100万−26.7万)×1% の1%部分
    514999, 515000, 485000, 545000, 500000, 530000, 790000, 830000,  // 等級表の境目
    10000,                         // 差額ベッド代の例（1日1万円）
    // ★令和8年8月診療分からの表（厚労省PDF＋協会けんぽ。2026-08-02追加）
    270300, 179100, 85800, 61500, 36900,   // 基準額
    901000, 597000, 286000,                // 1%の起点
    92940, 5510,                           // 区分ウ・医療費100万円の新旧比較と差額
    806700, 826500,                        // 政令219号が実際に変えた公的年金等控除の読替額（出典欄）
    205762,                                // e-Gov条文の全文字数（新額が1件も無いことの根拠）
    // ★令和9年8月診療分からの13区分（厚労省PDF「令和９年８月～」の表。2026-08-02追加）
    // まだ実装していない将来の表なので「欠けたら落ちる」側には入れない
    //（節ごと消したら落ちる検査は §9c で要素を名指ししてある）。
    // ただし**出典欄の13区分の転記ミスはこの網で落とす**ので、必ず「円」を付けて書くこと
    //（「342,000＋1%」と書くと網の外に落ちて、誤記が黙って通る）。
    342000, 303000, 209400, 194400, 110400, 98100, 69600, 65400, 34500,
    140000, 44200, 24200,          // 年間上限に併記された「月額平均」（≒多数回該当×12 の設計）
    // ★70歳以上（施行令42条3項・5項＋協会けんぽ/厚労省の公表表。2026-08-02追加）
    // 手打ちせず**データJSONから引く**（データを直したのに記事を直し忘れると、この網が落ちる）
    ...OVER70_MONEY,
    80000, 30000, 52000, 58000, 18500, 39500,   // ①を飛ばした場合の比較と図解（一般・窓口2割の例）
  ]);
  const extra = [...found].filter(n => !allow.has(n));
  const missing = KYOKAI_KENPO.filter(n => !found.has(n));
  // 新表の金額も「欠けたら落ちる」側に入れる（片方の表だけ消される事故を防ぐ）
  const SHINPYO_MONEY = [270300, 179100, 85800, 61500, 36900, 901000, 597000, 286000, 92940];
  const missNew = SHINPYO_MONEY.filter(n => !found.has(n));
  // 70歳以上の表の金額も「欠けたら落ちる」側に入れる（表をまるごと消す事故を落とす）
  const missOver70 = [...new Set(OVER70_MONEY)].filter(n => !found.has(n));
  if (extra.length) fail(`本文に想定外のカンマ金額がある（誤記の疑い）: ${extra}`);
  else if (missing.length) fail(`政令の金額（7月まで）が本文から欠けている: ${missing}`);
  else if (missNew.length) fail(`8月からの表の金額が本文から欠けている: ${missNew}`);
  else if (missOver70.length) fail(`70歳以上の表の金額が本文から欠けている: ${missOver70}`);
  else ok(`金額の網: カンマ金額 ${found.size}種すべてが想定内・70歳未満(新旧)と70歳以上(新旧)の金額がすべて本文にある`);
}

// ───────── 11. 網: 等級（カンマが無く金額の網に入らない） ─────────
{
  const grades = new Set([...text.matchAll(/第(\d+)級/g)].map(m => Number(m[1])));
  const want = new Set([30, 31, 39, 40]);
  const extra = [...grades].filter(g => !want.has(g));
  const missing = [...want].filter(g => !grades.has(g));
  if (extra.length || missing.length) fail(`等級の網: 余分=${extra} 不足=${missing}`);
  else ok('等級の網: 第30・31・39・40級（崖と80万円台の不在）がすべて本文にある');
  // 等級と標準報酬月額の対応が、本番の等級表と合っているか
  for (const g of want) {
    const row = KENKO_GRADES.find(([n]) => n === g);
    const man = row[1] / 10000;
    if (!text.includes(`第${g}級`)) continue;
    if (!new RegExp(`第${g}級[^。]{0,20}${man}万円`).test(text) && !text.includes(`第${g}級＝${man}万円`) && !text.includes(`第${g}級（標準報酬月額${man}万円）`) && !text.includes(`第${g}級・${man}万円`)) {
      fail(`第${g}級 と 標準報酬月額${man}万円 の対応が本文に無い（本番の等級表と照合）`);
    } else ok(`第${g}級 ＝ 標準報酬月額${man}万円（本番の等級表と一致）`);
  }
}

// ───────── 12. title と meta description（規則9: タグ剥がしで消えるので別に見る） ─────────
{
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  if (!title.includes('標準報酬月額')) fail(`titleに「標準報酬月額」が無い: ${title}`);
  else if (title.length > 60) fail(`titleが60字超: ${title.length}字`);
  else ok(`title（${title.length}字）: 区分は年収でなく標準報酬月額`);
  for (const n of ['87,430円', '171,820円', '84,390円', '21,000円']) {
    if (!desc.includes(n)) fail(`meta descriptionに ${n} が無い`);
  }
  if (desc.includes('87,430円') && desc.includes('171,820円') && desc.includes('84,390円') && desc.includes('21,000円')) {
    ok('meta description: 崖(87,430→171,820・差84,390)と世帯合算21,000円を明記');
  }
}

console.log(ng ? `\n✗ 記事「高額療養費」: ${ng}件の不一致` : '\n✓ 記事「高額療養費」: 政令・省令・本番ツールの等級表と一致');
process.exit(ng ? 1 : 0);
