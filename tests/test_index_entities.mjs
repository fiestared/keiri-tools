/** Exercise the real generator in an isolated HTML fixture, including hostile text and repeat runs. */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url).pathname;
const fixture = mkdtempSync(join(tmpdir(), 'keiri-index-entities-'));
try {
  mkdirSync(join(fixture, 'tools'));
  mkdirSync(join(fixture, 'docs/column/entity-fixture'), { recursive: true });
  copyFileSync(join(root, 'tools/gen_index_sitemap.mjs'), join(fixture, 'tools/gen_index_sitemap.mjs'));
  // 生成器は tools/nav_experiment.mjs（と名簿 nav_experiment.json）を import する（2026-09-16〜）。
  // 実物を写す。基点コミットは使い捨てリポジトリに無いが、その場合は空＝従来どおりの判定になる設計。
  copyFileSync(join(root, 'tools/nav_experiment.mjs'), join(fixture, 'tools/nav_experiment.mjs'));
  copyFileSync(join(root, 'tools/nav_experiment.json'), join(fixture, 'tools/nav_experiment.json'));
  writeFileSync(join(fixture, 'docs/index.html'), '<main><div class="post-list"></div><!--post-list:E--><p id="keep">Keep me</p></main>');
  writeFileSync(join(fixture, 'docs/column/index.html'), '<!-- GEN:COLUMN-INDEX --><!-- /GEN:COLUMN-INDEX -->');
  writeFileSync(join(fixture, 'docs/column/entity-fixture/index.html'), `<h1>S&amp;P500 <b>&#38; &#x26;</b> &quot;quotes&quot; &lt;em&gt;</h1>
<meta name="card-desc" content="S&amp;P500 &quot; onmouseover=&quot;x &lt;script&gt; &amp;lt; literal">
<script type="application/ld+json">{"datePublished":"2026-08-26"}</script>`);
  // 資産形成ハブの新着と固定枠も同じ生成器が書く（2026-09-22〜）。ハブと固定2本が無いと生成器は止まる設計なので、
  // 実サイトと同じ形の最小限を置く（HUB_PINNED の2本が消えたら止まる、という挙動は生成器側のまま）。
  mkdirSync(join(fixture, 'docs/toushi'), { recursive: true });
  writeFileSync(join(fixture, 'docs/toushi/index.html'), '<main><!-- GEN:TOUSHI-LATEST --><!-- /GEN:TOUSHI-LATEST --><p id="hub-keep">Hub keep</p></main>');
  for (const slug of ['index-toushi', 'dollar-cost-heikin']) {
    mkdirSync(join(fixture, `docs/column/${slug}`), { recursive: true });
    writeFileSync(join(fixture, `docs/column/${slug}/index.html`), `<h1>${slug}</h1>
<meta name="description" content="${slug}">
<script type="application/ld+json">{"datePublished":"2026-08-01"}</script>`);
  }
  execFileSync('git', ['init','-q',fixture]);
  const run = (...args) => execFileSync('node', [join(fixture, 'tools/gen_index_sitemap.mjs'), ...args], {stdio:'pipe'});
  run();
  const paths = ['docs/index.html', 'docs/column/index.html', 'docs/sitemap.xml', 'docs/toushi/index.html'];
  const once = paths.map(p => readFileSync(join(fixture,p), 'utf8'));
  for (const html of once.slice(0,2)) {
    assert.ok(html.includes('<div class="p-title">S&amp;P500 &amp; &amp; &quot;quotes&quot; &lt;em&gt;</div>'));
    assert.ok(html.includes('<div class="p-desc">S&amp;P500 &quot; onmouseover=&quot;x &lt;script&gt; &amp;lt; literal</div>'));
    assert.ok(!html.includes('S&amp;amp;P500'));
    assert.ok(html.includes('2026.08.26'), 'publication date retained');
    assert.ok(!html.includes('<script>'), 'source text never becomes markup');
  }
  assert.ok(once[1].includes('data-s="s&amp;p500 &amp; &amp; &quot;quotes&quot; &lt;em&gt; s&amp;p500 &quot; onmouseover=&quot;x &lt;script&gt; &amp;lt; literal"'));
  assert.ok(once[0].includes('<p id="keep">Keep me</p>'));
  assert.ok(once[3].includes('<p id="hub-keep">Hub keep</p>'), 'hub content outside the markers is kept');
  run();
  assert.deepEqual(paths.map(p => readFileSync(join(fixture,p), 'utf8')), once, 'second generation is byte-identical');
  run('--check');
  console.log('✓ index entities: decoded text / safe attributes / dates / adjacent content / idempotency');
} finally {
  rmSync(fixture, {recursive:true, force:true});
}
