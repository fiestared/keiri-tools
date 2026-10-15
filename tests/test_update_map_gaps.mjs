// tools/update_map_gaps.mjs（変えたページの「テーマに結び付かない数字・年度」の一覧）の検査。
// 落ちるべきが落ちる（未結合を拾う）と、通るべきが通る（結び付いた箇所・生成器の区画・出典・既存の未結合を拾わない）を両方見る。
// ネットワークは叩かない。一時ディレクトリに git を作って --base の経路も通す。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, loadTopics } from '../tools/gen_update_map.mjs';
import { handPart, newGaps, pageGaps, scan } from '../tools/update_map_gaps.mjs';

const topics = loadTopics(ROOT);
const page = (body, title = 'テスト記事') => `<!doctype html><html><head><title>${title}</title></head><body><main><article>${body}</article></main></body></html>`;
let n = 0;
const ok = (msg) => { n++; console.log('✓ ' + msg); };

// 0. ベースライン: 実在の新記事（ほぼ全部が未分類だった /column/kasuhara/）で拾えること＝検査が常に空でない
{
  const r = pageGaps(readFileSync(join(ROOT, 'docs/column/kasuhara/index.html'), 'utf8'), '/column/kasuhara/', topics, 'docs/column/kasuhara/index.html');
  assert.ok(r.gaps.length > 0, '実在の未結合ページで 0件 = 検査が効いていない');
  ok(`実ページのベースライン: /column/kasuhara/ 未結合 ${r.gaps.length}箇所`);
}
// 1. 落ちるべき: テーマの語が無い金額
{
  const r = pageGaps(page('<h2 id="a">罰則</h2><p>報告を怠ると20万円以下の過料です。</p>'), '/x/', topics);
  assert.equal(r.gaps.length, 1); assert.deepEqual(r.gaps[0].values, ['20万円']);
  ok('テーマの語が無い金額を拾う');
}
// 2. 通るべき: テーマの語がある金額・率（協会けんぽ）
{
  const r = pageGaps(page('<h2 id="a">料率</h2><p>協会けんぽの健康保険料率は東京都で9.85%です。</p>'), '/x/', topics);
  assert.equal(r.gaps.length, 0, JSON.stringify(r.gaps)); assert.equal(r.numeric, 1);
  ok('テーマに結び付いた率は拾わない（数字の箇所としては数える）');
}
// 2b. 同じ段落でも値ごと: 結び付いた率と結び付かない金額が並ぶなら、金額だけを拾う
{
  const r = pageGaps(page('<p>協会けんぽの健康保険料率は東京都で9.85%です。報告を怠ると20万円以下の過料です。</p>'), '/x/', topics);
  assert.deepEqual(r.gaps.map(g => g.values), [['20万円']], JSON.stringify(r.gaps));
  ok('同じ段落でも結び付かない値だけを拾う');
}
// 2c. JSON-LD（FAQ の写し）は本文の写しなので数えない
{
  const r = pageGaps(page('<p>本文に数字は無い。</p><script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"過料は？","acceptedAnswer":{"@type":"Answer","text":"20万円以下の過料です。"}}]}</script>'), '/x/', topics);
  assert.equal(r.gaps.length, 0, JSON.stringify(r.gaps));
  ok('JSON-LD の写しは数えない');
}
// 3. 年度（令和N年）だけの箇所も拾う。漢数字の法令番号・公開日の行・出典の節は拾わない
{
  const r = pageGaps(page('<p>公開日：2026年10月14日</p><p>この義務は令和8年10月1日に始まります。</p><p>（平成十七年法律第八十六号）</p>'
    + '<h2 id="shutten">出典</h2><ul><li>e-Gov法令検索で2026年10月14日に確認</li></ul>'), '/x/', topics);
  assert.deepEqual(r.gaps.map(g => g.values), [['令和8年10月1日']], JSON.stringify(r.gaps));
  ok('年度の箇所は拾い、公開日・漢数字の法令番号・出典の確認日は拾わない');
}
// 4. 生成器の区画・関連記事の中の他記事の title（年度・金額入り）は拾わない
{
  const r = pageGaps(page('<p>本文に数字は無い。</p><!--next-read:S--><section class="next-read"><a><b>別記事【令和8年】30万円</b></a></section><!--next-read:E-->'
    + '<section class="related"><ul><li><a>贈与税は110万円まで【令和8年】</a></li></ul></section><!-- x-share:auto --><div>令和8年 50万円</div><!-- /x-share:auto -->'), '/x/', topics);
  assert.equal(r.gaps.length, 0, JSON.stringify(r.gaps));
  ok('生成器の区画・関連記事・auto 区画の数字は拾わない');
}
// 5. 新しく生まれた分だけ: base と同じ文面の未結合は数えず、足した文だけ数える
{
  const base = pageGaps(page('<p>報告を怠ると20万円以下の過料です。</p>'), '/x/', topics);
  const head = pageGaps(page('<p>報告を怠ると20万円以下の過料です。</p><p>虚偽の報告は30万円以下の罰金です。</p>'), '/x/', topics);
  assert.deepEqual(newGaps(head, base).map(g => g.values), [['30万円']]);
  assert.equal(newGaps(base, base).length, 0);
  ok('既存の未結合は数えず、新しく足した未結合だけ数える');
}
// 6. 生成器だけの変更（区画・更新日・class）は署名が変わらない／本文・meta description の変更は変わる
{
  const a = '<html><head><meta name="description" content="20万円の過料"></head><body><p class="x">本文</p><!--rel:S--><li>A</li><!--rel:E--><p>最終更新：2026-10-01</p></body></html>';
  assert.equal(handPart(a), handPart(a.replace('<li>A</li>', '<li>B 令和9年</li>').replace('2026-10-01', '2026-10-15').replace('class="x"', 'class="y"')));
  assert.notEqual(handPart(a), handPart(a.replace('<p class="x">本文</p>', '<p class="x">本文 30万円</p>')));
  assert.notEqual(handPart(a), handPart(a.replace('20万円の過料', '30万円の過料')));
  ok('生成器だけの変更は読まず、本文・meta の変更は読む');
}
// 7. --base の経路（git）: 新規ページだけ・生成器だけの変更は数えない
{
  const t = mkdtempSync(join(tmpdir(), 'umgaps-'));
  try {
    mkdirSync(join(t, 'tools'), { recursive: true });
    for (const f of ['update_map_topics.json', 'source_year_registry.json', 'citation_date_registry.json', 'source_registry.json']) cpSync(join(ROOT, 'tools', f), join(t, 'tools', f));
    const w = (p, s) => { mkdirSync(join(t, p, '..'), { recursive: true }); writeFileSync(join(t, p), s); };
    const g = (...a) => execFileSync('git', ['-C', t, ...a], { stdio: 'ignore' });
    w('docs/column/a/index.html', page('<p>協会けんぽの料率は9.85%です。</p><!--next-read:S--><b>x</b><!--next-read:E-->'));
    w('docs/column/b/index.html', page('<p>報告を怠ると20万円以下の過料です。</p>'));
    g('init', '-q'); g('add', '-A'); g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base');
    w('docs/column/a/index.html', page('<p>協会けんぽの料率は9.85%です。</p><!--next-read:S--><b>別記事【令和9年】90万円</b><!--next-read:E-->'));
    w('docs/column/b/index.html', page('<p>報告を怠ると20万円以下の過料です。</p><p>雇用保険料率は5/1,000で、労働者負担は月1,500円です。</p>'));
    w('docs/column/c/index.html', page('<p>虚偽の報告は30万円以下の罰金です。</p>'));
    w('docs/column/index.html', page('<p>一覧 令和8年 40万円</p>'));
    const r = scan({ root: t, base: 'HEAD' });
    assert.deepEqual(r.pages.map(p => [p.page, p.status, p.new_unbound.length]), [['/column/c/', 'new', 1]], JSON.stringify(r.pages));
    assert.equal(r.generated_only, 1);
    ok('--base: 新規の未結合だけ一覧。生成器だけの変更・結び付いた追記・一覧ページは数えない');
  } finally { rmSync(t, { recursive: true, force: true }); }
}
console.log(`更新マップの未結合一覧 ${n}件緑`);
