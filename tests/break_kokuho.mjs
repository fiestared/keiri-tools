/**
 * `tests/test_kokuho.mjs` の壊しテスト。
 *
 * 89件が初回から全部緑だったので、**検査が本物を捕まえられるのか**を確かめる
 * （CLAUDE.md 規則1・規則2。緑は「正しい」の証拠ではなく「この網では何も引っかからなかった」の意味）。
 *
 * 壊し方は、国民健康保険料の計算で実際に出回っている誤りをそのまま再現する:
 *   1. 賦課区分を3つのまま（令和8年度の子ども・子育て支援金分を落とす）
 *   2. 賦課限度額を区分ごとでなく合計にだけ当てる
 *   3. 軽減を所得割にも当てる
 *   4. 軽減の判定所得を基礎控除「後」の額にする
 *   5. 判定の人数から特定同一世帯所属者を外す
 *   6. 給与所得者等の加算を（人数−1）でなく人数×10万円にする
 *   7. 未就学児の5割減額を軽減の「前」に当てる
 *   8. 子ども・子育て支援金分の均等割を18歳未満にも賦課する
 *   9. 介護分を40歳未満・65歳以上にも賦課する
 *  10. 所得割の基礎控除を引かない
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = join(root, 'docs', 'assets', 'kokuho_core.js');
const DATA = join(root, 'docs', 'assets', 'kokuho_r08.json');
const run = () => spawnSync(process.execPath, ['tests/test_kokuho.mjs'], { cwd: root, encoding: 'utf8' });

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log('✅ ' + name); }
  else { fail++; console.log('❌ ' + name + (detail ? '\n   ' + detail : '')); }
};

const coreSrc = readFileSync(CORE, 'utf8');
const dataSrc = readFileSync(DATA, 'utf8');
const restore = () => { writeFileSync(CORE, coreSrc); writeFileSync(DATA, dataSrc); };

// ── ベースライン ────────────────────────────────────────────────────────────
const base = run();
if (base.status !== 0) {
  console.log('❌ ベースラインが赤。壊しテストは意味を成さないので中止する。');
  console.log((base.stdout || '') + (base.stderr || ''));
  process.exit(1);
}
t('ベースライン: 無傷の状態で test_kokuho が緑', true);

/** コアの一部を置換して検査が赤くなることを確かめる。 */
function breakCore(name, from, to) {
  if (!coreSrc.includes(from)) {
    t(name, false, `壊し対象の文字列がコアに無い（壊せていない）: ${from}`);
    return;
  }
  // ★同じ文字列が複数箇所にあると「どこを壊したか」が一意でなくなる（規則8）。
  const count = coreSrc.split(from).length - 1;
  if (count !== 1) {
    t(name, false, `壊し対象が${count}箇所にあり一意でない: ${from}`);
    return;
  }
  try {
    writeFileSync(CORE, coreSrc.replace(from, to));
    const r = run();
    t(name, r.status !== 0, '壊したのに緑のまま＝この誤りは検査をすり抜ける');
  } finally { restore(); }
}

function breakData(name, from, to) {
  if (!dataSrc.includes(from)) {
    t(name, false, `壊し対象の文字列がデータに無い: ${from}`);
    return;
  }
  try {
    writeFileSync(DATA, dataSrc.replace(from, to));
    const r = run();
    t(name, r.status !== 0, '壊したのに緑のまま＝この誤りは検査をすり抜ける');
  } finally { restore(); }
}

// 1. 賦課区分を3つに（子ども・子育て支援金分を落とす）
{
  try {
    const d = JSON.parse(dataSrc);
    d.kubun = d.kubun.filter((k) => k.key !== 'kosodate');
    writeFileSync(DATA, JSON.stringify(d, null, 2));
    const r = run();
    t('1. 賦課区分を3つに落とすと赤になる', r.status !== 0);
  } finally { restore(); }
}

// 2. 限度額を区分ごとでなく素通しにする（＝合計にだけ当てる実装と同じ挙動）
breakCore('2. 限度額を区分ごとに当てないと赤になる',
  'const capped = beforeCap > cap;',
  'const capped = false;');

// 3. 軽減を所得割にも当てる
breakCore('3. 軽減を所得割にも当てると赤になる',
  'const shotokuwari = kazeiHyojun * shotokuwariRate;',
  'const shotokuwari = kazeiHyojun * shotokuwariRate * (1 - keigenRate);');

// 4. 軽減の判定所得を基礎控除「後」にする
breakCore('4. 判定所得を基礎控除後にすると赤になる',
  'for (const m of members) hanteiShotoku += nz(m.shotoku);',
  'for (const m of members) hanteiShotoku += Math.max(0, nz(m.shotoku) - 430000);');

// 5. 判定の人数から特定同一世帯所属者を外す
breakCore('5. 人数から特定同一世帯所属者を外すと赤になる',
  'const headcount = members.length + tokutei.length;',
  'const headcount = members.length;');

// 6. 給与所得者等の加算を人数×10万円にする
breakCore('6. 給与所得者等の加算を（人数−1）でなく人数にすると赤になる',
  '+ Math.max(0, kyuyoCount - 1) * nz(k.kyuyo_shotokusha_add_yen);',
  '+ kyuyoCount * nz(k.kyuyo_shotokusha_add_yen);');

// 7. 未就学児の5割減額を軽減の「前」に当てる
breakCore('7. 未就学児の減額を軽減前に当てると赤になる',
  'const genzoku = afterKeigen * mishugakujiRate;',
  'const genzoku = kintouwariUnit * mishugakujiRate;');

// 8. 子ども・子育て支援金分の均等割を18歳未満にも賦課する
breakCore('8. 子育て分の均等割を全員に賦課すると赤になる',
  "if (kubun.kintouwari_taisho === 'over18') return !member.under18;",
  "if (kubun.kintouwari_taisho === 'over18') return true;");

// 9. 介護分を40歳未満・65歳以上にも賦課する
breakCore('9. 介護分を全員に賦課すると赤になる',
  "if (kubun.taisho === 'kaigo2') return !!member.kaigo2;",
  "if (kubun.taisho === 'kaigo2') return true;");

// 10. 所得割の基礎控除を引かない
breakCore('10. 所得割の基礎控除を引かないと赤になる',
  'kazeiHyojun += Math.max(0, nz(m.shotoku) - kisoKojo);',
  'kazeiHyojun += nz(m.shotoku);');

// ── 壊しを戻したあと、本当に緑へ戻ることを確認する ──────────────────────────
{
  const r = run();
  t('後始末: すべての壊しを戻したあと test_kokuho が緑に戻る', r.status === 0,
    (r.stdout || '') + (r.stderr || ''));
}

console.log(`\n${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
