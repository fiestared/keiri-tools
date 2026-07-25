/**
 * 壊しテスト: 住民税非課税世帯の判定コア・参照データ・ページに「ありそうな間違い」を注入し、
 * test_hikazei_setai.mjs が **必ず落ちる** ことを確かめる。
 *
 * 規則2（ベースライン確認）: 壊す前に、無傷の実装で検査が緑になることを確かめる。
 * ★実装は壊さない。一時ディレクトリにコピーを作ってそれを壊す。
 *
 * ★規則8: 「赤くなった」だけでは足りない。**狙った検査が落ちたか**まで見る。
 *   expect は検査の失敗メッセージ（"§4 …"）に一致させる。節見出し（"── §4 …"）は
 *   常に出力されるので、そちらに一致する文字列を expect にすると何を壊しても満点になる。
 *
 * ★このコアは juminzei_core.js / juminzei_r08.json（非課税限度額と給与所得の正本）に依存する。
 *   壊す対象にはそちらも入れる — 限度額の転記ミスはあちらで起きるため。
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SRC = {
  core: new URL('../docs/assets/hikazei_setai_core.js', import.meta.url),
  data: new URL('../docs/assets/hikazei_setai_r08.json', import.meta.url),
  jcore: new URL('../docs/assets/juminzei_core.js', import.meta.url),
  jdata: new URL('../docs/assets/juminzei_r08.json', import.meta.url),
  // juminzei_core.js が import している（壊しはしないが、コピーしないと解決できない）
  shaho: new URL('../docs/assets/shaho_core.js', import.meta.url),
};
const FILE = {
  core: 'hikazei_setai_core.js',
  data: 'hikazei_setai_r08.json',
  jcore: 'juminzei_core.js',
  jdata: 'juminzei_r08.json',
  shaho: 'shaho_core.js',
};
const TEST = new URL('./test_hikazei_setai.mjs', import.meta.url);
const orig = Object.fromEntries(Object.entries(SRC).map(([k, u]) => [k, readFileSync(u, 'utf8')]));

/** [名前, 対象, 置換前, 置換後, 落ちるべき検査の断片] */
const BREAKS = [
  // ── コア: 公的年金等控除（このツールの核心）───────────────────────────────
  ['★65歳以上の最低保障110万円を落として本則の60万円で計算する（年金世帯を丸ごと誤判定）', 'core',
   'const min = is65 ? b.min_65over : b.min_under65;',
   'const min = b.min_under65;',
   '§1 65歳以上'],

  ['★65歳の判定を「以上」でなく「超」にする（65歳ちょうどの人が110万円を失う）', 'core',
   'const is65 = age != null && age >= N.age_65;',
   'const is65 = age != null && age > N.age_65;',
   '§2 65歳・年金155万円の雑所得'],

  ['★年齢未入力を65歳以上とみなす（有利な読替えを勝手に与える＝fail open）', 'core',
   'const is65 = age != null && age >= N.age_65;',
   'const is65 = age == null || age >= N.age_65;',
   '§2 年齢未入力は65歳未満として扱う'],

  ['★ロの「収入から50万円を引く」を落とす（控除が過大になる）', 'core',
   'const zangaku = Math.max(0, s - N.ro_sashihiki);',
   'const zangaku = Math.max(0, s);',
   '§1 65歳以上'],

  ['★イと最低保障を足してしまう（max ではなく和）', 'core',
   'return Math.max(b.i + ro, min);',
   'return b.i + ro + min;',
   '§1 65歳以上'],

  ['★控除しきれない分をマイナスのまま返す（雑所得が負になり合計所得が減る）', 'core',
   'return Math.max(0, s - kokyoNenkinKojo(s, age, igaiShotoku, D));',
   'return s - kokyoNenkinKojo(s, age, igaiShotoku, D);',
   '§1 65歳以上'],

  // ── コア: 世帯の判定 ───────────────────────────────────────────────────
  ['★扶養の付け方を「所得が最も多い人にまとめる」1通りに決め打ちする', 'core',
   '    if (!eligible[i]) return;\n',
   '    return;\n',
   '§7 付け替えれば非課税世帯になる'],

  ['★世帯の判定を「誰か1人でも非課税なら非課税世帯」にする', 'core',
   'const setaiHikazei = rows.every((r) => r.hikazei);',
   'const setaiHikazei = rows.some((r) => r.hikazei);',
   '§6 → 世帯は非課税世帯にならない'],

  ['★扶養に入れる所得の上限を旧48万円のまま使う', 'core',
   'const limit = D.fuyo_yoken.goukei_shotoku_ika;\n  const eligible',
   'const limit = 480000;\n  const eligible',
   '§8 妻の所得55万円 → 夫は扶養1人で101万円'],

  ['★扶養に入っている人にも他人を扶養させる（同じ人を二重に数える）', 'core',
   'if (assign[i] >= 0 && assign.some((a, k) => k !== i && a === i)) return null;',
   'if (false) return null;',
   '§7 ★互いを扶養に数えることはしない'],

  ['★配偶者を扶養親族として二重に数える（同一生計配偶者の枠を使わない）', 'core',
   "if (members[k].zokugara === 'spouse' && !hasSpouseDep) hasSpouseDep = true;\n        else fuyoCount++;",
   'fuyoCount++;\n        if (members[k].zokugara === "spouse") hasSpouseDep = true;',
   '§5 夫の限度額（妻を扶養に数える）'],

  ['★未成年（18歳未満）の自動判定を落とす（295条1項2号の135万円が効かなくなる）', 'core',
   'honninMiseinen: m.miseinen != null ? !!m.miseinen : (sho.age != null && sho.age < 18),',
   'honninMiseinen: !!m.miseinen,',
   '§6 17歳は295条1項2号（未成年）で非課税'],

  ['★未成年の境界を18歳未満でなく20歳未満にする（成年年齢の引下げを反映し忘れる）', 'core',
   '(sho.age != null && sho.age < 18)',
   '(sho.age != null && sho.age < 20)',
   '§6 19歳の子は自分が均等割課税'],

  ['★所得金額調整控除を「合計10万円以下でも」効かせる（控除が負になる）', 'core',
   'if (k + n <= C.shikii) return 0;',
   'if (false) return 0;',
   '§9 合計が10万円以下なら効かない'],

  ['★所得金額調整控除の1人あたり上限10万円を外す', 'core',
   'return Math.min(k, C.cap_each) + Math.min(n, C.cap_each) - C.shikii;',
   'return k + n - C.shikii;',
   '§9 両方10万円超 → 上限10万円'],

  ['★所得金額調整控除を合計所得から引かない（給与と年金の両方がある人が過大になる）', 'core',
   'goukeiShotoku: Math.max(0, kyuyoSho + nenkinSho + sonota - chosei),',
   'goukeiShotoku: Math.max(0, kyuyoSho + nenkinSho + sonota),',
   '§9 合計所得（5万＋50万−5万）'],

  ['★級地の指定を無視して常に1級地で計算する', 'core',
   'const kyuchi = [1, 2, 3].includes(Number(input?.kyuchi)) ? Number(input.kyuchi) : 1;',
   'const kyuchi = 1;',
   '§4 2級地・単身の限度額'],

  ['★不正な入力（負・NaN・文字列）を素通しする', 'core',
   'return Number.isFinite(v) && v > 0 ? v : 0;',
   'return v;',
   '§11 不正な入力は0として扱う'],

  ['★参照データが無くても計算を続ける（fail open）', 'core',
   "if (!D || !J) throw new Error('参照データが渡されていません');",
   'if (false) throw new Error();',
   '§11 データ欠落・世帯0人・人数超過で必ず throw する'],

  // ── データ: 条文の数値の転記ミス ───────────────────────────────────────────
  ['★データ: 65歳以上の最低保障を110万→120万に取り違える（令和2年改正前の額）', 'data',
   '"min_65over": 1100000',
   '"min_65over": 1200000',
   '§1 65歳以上'],

  ['★データ: 65歳未満の最低保障を60万→70万に取り違える', 'data',
   '"min_under65": 600000',
   '"min_under65": 700000',
   '§1 65歳未満'],

  ['★データ: ロの25%の区分上限360万を410万に取り違える（速算表の「収入」と混同）', 'data',
   '{ "upto": 3600000, "base": 0, "rate_pct": 25, "over": 0 }',
   '{ "upto": 4100000, "base": 0, "rate_pct": 25, "over": 0 }',
   '§1 65歳以上'],

  ['★データ: ロの控除する50万円を落とす', 'data',
   '"ro_sashihiki": 500000',
   '"ro_sashihiki": 0',
   '§1 65歳以上'],

  ['★データ: 扶養に入れる所得の上限を旧48万円に戻す', 'data',
   '"goukei_shotoku_ika": 580000',
   '"goukei_shotoku_ika": 480000',
   '§8 参照データの上限'],

  ['★データ: 所得金額調整控除の閾値10万円を5万円に取り違える', 'data',
   '"shikii": 100000',
   '"shikii": 50000',
   '§9 合計が10万円以下なら効かない'],

  ['★データ: 判定の基準を均等割から所得割に取り違える', 'data',
   '"kijun": "kintouwari"',
   '"kijun": "shotokuwari"',
   '§12 判定の基準は均等割'],

  // ── 依存する正本（juminzei）側の転記ミスも、このツールの答えを壊す ────────────
  ['★juminzei: 均等割の基本額35万円を取り違える', 'jdata',
   '"1": { "kihon": 350000, "kasan": 210000,',
   '"1": { "kihon": 330000, "kasan": 210000,',
   '§3 コアの限度額'],

  ['★juminzei: 2級地の倍率0.9を1.0にする（級地差が消える）', 'jdata',
   '"2": { "kihon": 315000, "kasan": 189000,',
   '"2": { "kihon": 350000, "kasan": 210000,',
   '§4 2級地・単身の限度額'],

  ['★juminzei: 均等割の一律加算10万円を落とす', 'jdata',
   '"plus": 100000,\n      "kyuchi"',
   '"plus": 0,\n      "kyuchi"',
   '§3 コアの限度額'],

  ['★juminzei: 障害者・未成年等の135万円を125万円に取り違える', 'jdata',
   '"shogaisha_goukei_limit": 1350000',
   '"shogaisha_goukei_limit": 1250000',
   '§6 17歳・合計所得132万円は135万円以下なので非課税'],

  ['★juminzei: 給与所得控除の最低保障65万円を旧55万円に戻す', 'jdata',
   '"hyo5_flat_kojo": 650000',
   '"hyo5_flat_kojo": 550000',
   '§3 給与110万円の給与所得'],
];

// ── ベースライン: 無傷の実装で検査が緑であること（規則2）────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'hikazei-setai-break-'));
const write = (k, s) => writeFileSync(join(dir, FILE[k]), s);
const run = () => {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'test_hikazei_setai.mjs')],
      { stdio: 'pipe', timeout: 300000, encoding: 'utf8' });
    return { green: true, out };
  } catch (e) {
    return { green: false, out: String(e.stdout || '') + String(e.stderr || '') };
  }
};

for (const k of Object.keys(FILE)) write(k, orig[k]);
writeFileSync(join(dir, 'test_hikazei_setai.mjs'),
  readFileSync(TEST, 'utf8')
    .replaceAll('join(docs, "assets", "hikazei_setai_r08.json")', 'join(here, "hikazei_setai_r08.json")')
    .replaceAll('join(docs, "assets", "juminzei_r08.json")', 'join(here, "juminzei_r08.json")')
    .replaceAll('join(docs, "assets", "hikazei_setai_core.js")', 'join(here, "hikazei_setai_core.js")')
    .replaceAll('join(docs, "assets", "juminzei_core.js")', 'join(here, "juminzei_core.js")'));

const base = run();
if (!base.green) {
  console.error('❌ ベースラインが赤: 無傷の実装で test_hikazei_setai.mjs が落ちている。');
  console.error(base.out.split('\n').slice(-14).join('\n'));
  console.error('壊しテストは実行できない（規則2）');
  process.exit(1);
}
console.log('✓ ベースライン確認: 無傷の実装で検査は緑');

let caught = 0, missed = 0, wrongCheck = 0;
for (const [name, target, before, after, expect] of BREAKS) {
  if (!orig[target].includes(before)) {
    console.log(`❌ 壊し方が外れた（置換前の文字列が実ファイルに無い）: ${name}`);
    missed++;
    continue;
  }
  write(target, orig[target].replace(before, after));
  const r = run();
  write(target, orig[target]);

  if (r.green) {
    console.log(`❌ 素通し: ${name}`);
    missed++;
  } else if (expect && !r.out.includes(expect)) {
    const reds = r.out.split('\n').filter((l) => l.includes('❌')).slice(0, 3).map((l) => l.trim());
    console.log(`❌ 別の検査が落ちた（狙い「${expect}」は発火せず）: ${name}`);
    for (const l of reds) console.log(`     実際に落ちた: ${l}`);
    wrongCheck++;
  } else {
    console.log(`✅ 捕捉: ${name}`);
    caught++;
  }
}

const bad = missed + wrongCheck;
console.log(`\n${bad ? '❌' : '✓'} 壊しテスト: ${caught}/${BREAKS.length} 捕捉` +
  (bad ? `（素通し ${missed} / 狙い違い ${wrongCheck}）` : ''));
process.exit(bad ? 1 : 0);
