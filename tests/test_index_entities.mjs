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
  writeFileSync(join(fixture, 'docs/index.html'), '<main><div class="post-list"></div><!--post-list:E--><p id="keep">Keep me</p></main>');
  writeFileSync(join(fixture, 'docs/column/index.html'), '<!-- GEN:COLUMN-INDEX --><!-- /GEN:COLUMN-INDEX -->');
  writeFileSync(join(fixture, 'docs/column/entity-fixture/index.html'), `<h1>S&amp;P500 <b>&#38; &#x26;</b> &quot;quotes&quot; &lt;em&gt;</h1>
<meta name="card-desc" content="S&amp;P500 &quot; onmouseover=&quot;x &lt;script&gt; &amp;lt; literal">
<script type="application/ld+json">{"datePublished":"2026-08-26"}</script>`);
  execFileSync('git', ['init','-q',fixture]);
  const run = (...args) => execFileSync('node', [join(fixture, 'tools/gen_index_sitemap.mjs'), ...args], {stdio:'pipe'});
  run();
  const paths = ['docs/index.html', 'docs/column/index.html', 'docs/sitemap.xml'];
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
  run();
  assert.deepEqual(paths.map(p => readFileSync(join(fixture,p), 'utf8')), once, 'second generation is byte-identical');
  run('--check');
  console.log('✓ index entities: decoded text / safe attributes / dates / adjacent content / idempotency');
} finally {
  rmSync(fixture, {recursive:true, force:true});
}
