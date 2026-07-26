/**
 * 壊しテスト: invoice_bangou_core.js に「ありそうな間違い」を注入し、
 * test_invoice_bangou.mjs が **必ず落ちる** ことを確かめる。
 *
 * 規則2（ベースライン確認）: 壊す前に、無傷のコアで検査が緑になることを確かめる。
 * ★実装は壊さない。一時ディレクトリにコピーを作ってそれを壊す。
 *
 * 注入する間違いは、すべて「このツールで実際に黙って誤答しうる」もの:
 *   - 検査用数字を「9 − 余り」ではなく「余り」にする（算式の取り違え）
 *   - 偶数桁と奇数桁の重みを入れ替える（PDFの表を読み違える典型）
 *   - 最下位の数え始めを逆（左から）にする
 *   - 余りを 10 で取る（mod 9 を mod 10 と混同）
 *   - 重みの ×2 を落とす
 *   - 13桁の判定を「13桁以上」に緩める
 *   - 全角→半角の正規化を落とす（全角で貼られた番号を形式エラーにする）
 *   - T の除去を落とす（T付きを14桁と誤判定）
 *   - ★NOT_HOUJIN を「誤り」と断定する文言にする（個人事業者の番号を誤判定する）
 *   - 一括処理で最初の1件しか返さない（このツールの本命が一括なので致命）
 *   - 空行を件数に数える
 */
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CORE = new URL('../docs/assets/invoice_bangou_core.js', import.meta.url);
const TEST = new URL('./test_invoice_bangou.mjs', import.meta.url);
const orig = readFileSync(CORE, 'utf8');

/** [名前, 置換前, 置換後] */
const BREAKS = [
  ['★検査用数字を「9 − 余り」ではなく余りそのものにする',
   'return 9 - ((evenSum * 2 + oddSum) % 9);',
   'return (evenSum * 2 + oddSum) % 9;'],

  ['★偶数桁と奇数桁の重みを入れ替える（PDFの表の読み違え）',
   'return 9 - ((evenSum * 2 + oddSum) % 9);',
   'return 9 - ((oddSum * 2 + evenSum) % 9);'],

  ['★最下位からではなく左から数える',
   'const n = Number(s[11 - i]); // i=0 が最下位',
   'const n = Number(s[i]);'],

  ['★余りを 10 で取る（mod 9 と mod 10 の混同）',
   'return 9 - ((evenSum * 2 + oddSum) % 9);',
   'return 9 - ((evenSum * 2 + oddSum) % 10);'],

  ['★重みの ×2 を落とす',
   'return 9 - ((evenSum * 2 + oddSum) % 9);',
   'return 9 - ((evenSum + oddSum) % 9);'],

  ['★13桁の判定を「13桁以上」に緩める（14桁を通す）',
   'if (digits.length !== 13) {',
   'if (digits.length < 13) {'],

  ['★全角→半角の正規化を落とす（全角で貼られた番号を形式エラーにする）',
   's = s.replace(/[０-９Ｔｔ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));',
   ''],

  ['★T の除去を落とす（T付きを14桁と誤判定する）',
   'const stripped = hadT ? s.slice(1) : s;',
   'const stripped = s;'],

  ['★ハイフン・空白の除去を落とす（請求書からの貼り付けが全部形式エラーになる）',
   's = s.replace(DASHES, "").replace(SPACES, "");',
   ''],

  // ★ここがこのツールで最も危険な誤り: 個人事業者の正しい番号を「誤り」と断定してしまう
  ['★NOT_HOUJIN を「誤り」と断定する文言にする（個人事業者の番号を誤判定する）',
   'reason: "法人番号の検査用数字と一致しない（法人番号ではない）。"\n          + "個人事業者・人格のない社団等の登録番号は、この検査では妥当性を判定できない",',
   'reason: "登録番号が誤りです",'],

  ['★一括処理で最初の1件しか返さない（本命の一括が壊れる）',
   '    out.push({ line: i + 1, input: line.trim(), ...classify(picked) });',
   '    if (out.length === 0) out.push({ line: i + 1, input: line.trim(), ...classify(picked) });'],

  ['★空行を件数に数える',
   '    if (!line.trim()) return;',
   '    if (false) return;'],

  ['★summarize で法人番号以外を全部 format に寄せる',
   '    else if (r.status === STATUS.NOT_HOUJIN) s.notHoujin++;',
   '    else if (false) s.notHoujin++;'],
];

const dir = mkdtempSync(join(tmpdir(), 'break-invoice-bangou-'));
cpSync(new URL('../docs', import.meta.url), join(dir, 'docs'), { recursive: true });
cpSync(new URL('.', import.meta.url), join(dir, 'tests'), { recursive: true });
const coreCopy = join(dir, 'docs/assets/invoice_bangou_core.js');
const testCopy = join(dir, 'tests/test_invoice_bangou.mjs');

const run = () => {
  try {
    execFileSync('node', [testCopy], { stdio: 'pipe' });
    return true;   // 緑
  } catch {
    return false;  // 赤
  }
};

// --- 規則2: ベースライン確認。無傷が緑でなければ、何を壊しても赤になり嘘の満点が出る ---
writeFileSync(coreCopy, orig);
if (!run()) {
  console.error('✗ ベースラインが赤。壊しテストを実行しても意味がないので降ります');
  console.error('  （test_invoice_bangou.mjs を直してから再実行してください）');
  process.exit(1);
}
console.log('✓ ベースライン: 無傷のコアで検査が緑');

let caught = 0;
const missed = [];
for (const [name, from, to] of BREAKS) {
  if (!orig.includes(from)) {
    // ★実装を変えたら「壊し方」も直す。当たらない壊しは素通しと別枠で出す
    console.error(`❌ 壊し方が外れた（置換前の文字列が無い）: ${name}`);
    missed.push(name + '（壊し方が外れた）');
    continue;
  }
  writeFileSync(coreCopy, orig.replace(from, to));
  if (run()) {
    console.error(`⚠️  素通し: ${name}`);
    missed.push(name + '（素通し）');
  } else {
    caught++;
  }
}
writeFileSync(coreCopy, orig);

console.log(`\n壊し ${BREAKS.length}方向 / 捕捉 ${caught} / 取りこぼし ${missed.length}`);
if (missed.length) {
  console.error('取りこぼし:');
  for (const m of missed) console.error('  -', m);
  process.exit(1);
}
console.log('✅ break_invoice_bangou: 全方向を捕捉');
