/**
 * gen_x_link.mjs の冪等分岐が、**文書を複製しない**ことを守る。
 *
 * ★なぜこの検査が要るのか（2026-08-15 第8便で実際に踏んだ）:
 *   withLink() の冪等分岐は「マーカーの後ろにある </div> まで」を差し替える。
 *   新規記事をテンプレから手書きすると、フッターに `<!-- x-link:auto -->` だけ置いて
 *   中身の <div> がまだ無い状態になる。すると indexOf('</div>') が **-1** を返し、
 *   旧実装は `-1 + '</div>'.length` ＝ **5** を終端として扱って html.slice(5) を後ろに繋いだ。
 *   結果、**文書全体が2回書き込まれた**（2つ目は先頭の `<!DOC` だけ欠けた複製）。
 *
 *   ★危険なのは、生成器が **exit 0 で正常終了する**こと。気づけるのは別の検査
 *   （test_dup_ids）で「id が重複」と出たときで、そこから原因の生成器まで距離がある。
 *   ＝ このリポジトリが繰り返し記録してきた「黙って間違える」型そのもの。
 *
 * ★見るのは3つ:
 *   ① マーカーだけで中身が無い入力でも、文書が複製されない（旧実装はここで落ちる）
 *   ② 既に中身がある入力を2回通しても、1回通したものと同一（本来の冪等性）
 *   ③ マーカーが無い入力には </footer> の手前に1つだけ入る
 */
import assert from 'node:assert';
import { withLink, MARK, LINE } from '../tools/gen_x_link.mjs';

const body = (extra = '') =>
  `<!DOCTYPE html>\n<html lang="ja">\n<head><title>t</title></head>\n<body>\n` +
  `<main><h2 id="a">見出し</h2><p>本文</p></main>\n` +
  `<footer class="site">\n  <p>© 税金・経理・補助金ツールズ</p>\n  ${extra}\n</footer>\n</body>\n</html>\n`;

// --- ① マーカーだけあって中身が無い（新規記事の手書きテンプレ） -------------------
{
  const src = body(MARK);
  const out = withLink(src);

  assert.strictEqual(out.match(/<!DOCTYPE/gi)?.length ?? 0, 1,
    '文書が複製されています（<!DOCTYPE が2つ以上）。' +
    'withLink の冪等分岐で indexOf("</div>") が -1 を返したときに ' +
    '-1+6=5 を終端として扱っていないか確認すること');
  assert.strictEqual(out.match(/id="a"/g)?.length ?? 0, 1,
    '本文が複製されています（id="a" が2つ以上）。id の重複は test_dup_ids 側で落ちるが、' +
    '原因はこの生成器にある');
  assert.strictEqual(out.match(/<\/html>/g)?.length ?? 0, 1, '</html> が2つ以上あります');
  assert.ok(out.includes(LINE), 'マーカーが LINE に置き換わっていません');
  assert.strictEqual(out.match(new RegExp(MARK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length ?? 0, 1,
    'マーカーが2つ以上残っています');
  // 長さは「マーカー → LINE」の差分ぶんだけ増えるはず（＝文書は増えていない）
  assert.strictEqual(out.length, src.length - MARK.length + LINE.length,
    '出力の長さが「マーカーを LINE に置き換えた」ぶんと一致しません（余計な文字列が混入）');
}

// --- ② 既に中身がある → 2回通しても同じ（本来の冪等性） --------------------------
{
  const once = withLink(body(MARK));
  const twice = withLink(once);
  assert.strictEqual(twice, once, 'withLink が冪等ではありません（2回通すと結果が変わる）');

  const thrice = withLink(twice);
  assert.strictEqual(thrice, once, 'withLink が冪等ではありません（3回目で結果が変わる）');
  assert.strictEqual(thrice.match(/<!DOCTYPE/gi)?.length ?? 0, 1, '回を重ねると文書が複製されます');
}

// --- ③ マーカーが無い → </footer> の手前に1つだけ入る ---------------------------
{
  const src = body('');
  const out = withLink(src);
  assert.strictEqual(out.match(/<!DOCTYPE/gi)?.length ?? 0, 1, '文書が複製されています');
  assert.strictEqual(out.match(new RegExp(MARK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length ?? 0, 1,
    '導線が1つだけ入っていません');
  assert.ok(out.indexOf(LINE) < out.indexOf('</footer>'), '導線が </footer> の手前にありません');
  assert.strictEqual(withLink(out), out, 'マーカー無しから入れた後、冪等になっていません');
}

console.log('✓ test_x_link_idempotent: 中身なしマーカーでも複製されない / 冪等 / 未挿入ページに1つだけ入る');
