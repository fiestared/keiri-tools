// 局所文脈（2026-10-09 gbrain implementation/keiri-unit-context-2026-10-09）
// 照合の単位に、画面で必ず一緒に見えている文（表の表題・直前の前提・直後の注、FAQ の設問と答え）を context として添える。
// 守ること: ①id・text・text_hash を1つも変えない ②束ねるのは局所だけ（隣り合う段落・同じ FAQ）③文脈が変われば context_hash が変わる
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { segmentClaims, validateSegments, TABLE_CONTEXT_MAX } from '../tools/segment_claims.mjs';
const core = us => us.map(({ context, context_hash, ...rest }) => rest);
const TABLE = '<div class="scroll-wrap"><table><tr><th>寄附額</th><th>控除の合計</th></tr><tr><td>80,000円</td><td>58,621.90円</td></tr></table></div>';
const PREMISE = '両税率5％・確定申告をする場合の算術例です。';
const page = (pre, post = '') => `<title>題</title><meta name="description" content="説明は100円です。"><h1>題</h1><p class="lead">記事全体の前提は令和8年分です。</p><h2>設例</h2><p${pre}>${PREMISE}</p>${TABLE}<p${post}>端数処理前の額です。</p><h2>別の表</h2><p>前置き。</p><table><tr><th>年</th><th>額</th></tr><tr><td>1年目</td><td>100円</td></tr></table>`;

// 1. 印の有無で id・text・text_hash・protected は1つも変わらない（台帳の covers を壊さない）
{
  const plain = segmentClaims(page('')), marked = segmentClaims(page(' data-review-context="before-table"', ' data-review-context="after-table"'));
  assert.deepEqual(core(marked), core(plain));
  assert.ok(plain.every(u => u.context === undefined && u.context_hash === null), '無傷: 印が無ければ文脈は付かない（context_hash は null で常に出る）');
  const cell = marked.find(u => u.text.includes('【値】58,621.90円'));
  assert.equal(cell.context, `【表の直前の説明】${PREMISE} 【表の直後の注】端数処理前の額です。`);
  assert.match(cell.context_hash, /^[0-9a-f]{20}$/);
  // 見出しのセル・行の先頭のセルにも同じ文脈
  assert.ok(marked.filter(u => /^t[dh]$/.test(u.kind) && u.context).length === 4);
  // 2. 局所だけ: 別の表・記事の冒頭・title・description・印を付けた段落自身・ほかの段落には付かない
  for (const u of marked) if (!(/^t[dh]$/.test(u.kind) && u.context)) assert.equal(u.context_hash, null, u.text);
  assert.equal(marked.find(u => u.text.includes('【値】100円')).context, undefined, '別の表へ引き継がない');
  assert.ok(marked.some(u => u.kind === 'p' && u.text === PREMISE), '印を付けた段落は従来どおり1単位として照合される');
  // 3. 文脈が変われば context_hash が変わる（id は同じ）。印を外せば文脈は消える
  const edited = segmentClaims(page(' data-review-context="before-table"').replace('両税率5％', '両税率10％'));
  const cell2 = edited.find(u => u.text.includes('【値】58,621.90円'));
  assert.equal(cell2.id, cell.id); assert.notEqual(cell2.context_hash, cell.context_hash);
  // 文脈つきの ok の記録は、文脈が変わると無効。文脈より前の記録（context_hash なし）は従来どおり
  const ledger = (us, v) => ({ claims: [{ id: 'c1', covers: us.map(u => u.id) }], verified: [v] });
  const rec = { id: cell.id, text_hash: cell.text_hash, result: 'ok', review_ref: 'run-x' };
  assert.equal(validateSegments(marked, ledger(marked, { ...rec, context_hash: cell.context_hash })).verified, 1);
  assert.equal(validateSegments(edited, ledger(edited, { ...rec, context_hash: cell.context_hash })).verified, 0);
  assert.equal(validateSegments(plain, ledger(plain, { ...rec, context_hash: cell.context_hash })).verified, 0, '印を外した（文脈が消えた）ら無効');
  assert.equal(validateSegments(edited, ledger(edited, rec)).verified, 1);
}
// 4. 「隣り合う」を機械で強制する（離れた段落・記事全体の前提を束ねる抜け道を塞ぐ）
{
  const t = '<table><tr><th>a</th><th>b</th></tr><tr><td>x</td><td>1円</td></tr></table>';
  assert.doesNotThrow(() => segmentClaims(`<p data-review-context="before-table">前提。</p>${t}`));
  assert.throws(() => segmentClaims(`<p data-review-context="before-table">前提。</p><p>間の文。</p>${t}`), /adjacent next/);
  assert.throws(() => segmentClaims(`<p data-review-context="before-table">前提。</p><h2>次の節</h2>${t}`), /adjacent next/);
  assert.throws(() => segmentClaims(`${t}<p>間の文。</p><p data-review-context="after-table">注。</p>`), /adjacent previous/);
  assert.throws(() => segmentClaims(`<p data-review-context="after-table">注。</p>${t}`), /adjacent previous/, '向きを取り違えたら止まる');
  assert.throws(() => segmentClaims(`<p data-review-context="before-table">前提。</p><div><p>箱の中の別の文。</p>${t}</div>`), /adjacent next/, '表だけを包む入れ物以外は隣と見なさない');
  assert.throws(() => segmentClaims(`<p data-review-context="before-table">前提。</p><div>${t}${t}</div>`), /adjacent next/);
  assert.throws(() => segmentClaims(`<div data-review-context="before-table">前提。</div>${t}`), /only for a <p>/);
  assert.throws(() => segmentClaims(`<p data-review-context="before-table">${'あ'.repeat(TABLE_CONTEXT_MAX + 1)}</p>${t}`), /longer than/);
  assert.doesNotThrow(() => segmentClaims(`<p data-review-context="before-table">${'あ'.repeat(TABLE_CONTEXT_MAX)}</p>${t}`));
  assert.throws(() => segmentClaims(`<p data-review-context="table">前提。</p>${t}`), /Invalid data-review-context/);
  // figure に包んだ表・caption
  const f = segmentClaims(`<p data-review-context="before-table">前提。</p><figure><table><caption>令和8年度・東京都</caption><tr><th>a</th><th>b</th></tr><tr><td>x</td><td>1円</td></tr></table><figcaption>出典</figcaption></figure>`);
  assert.equal(f.find(u => u.text.includes('【値】1円')).context, '【表題】令和8年度・東京都 【表の直前の説明】前提。');
  assert.equal(segmentClaims(`<table><caption>令和8年度</caption><tr><th>a</th><th>b</th></tr><tr><td>x</td><td>1円</td></tr></table>`).find(u => u.text.includes('【値】1円')).context, '【表題】令和8年度');
}
// 5. FAQ: 設問と答えは既定で束ねる（印は要らない）。id・text は FAQ の外に置いた同じ文と同じ
{
  const q = 'Q. 所定労働時間が7時間30分の場合、時間単位では何時間まで取れますか？', a = 'A. 1日分は8時間に切り上げます。年5日なら40時間です。';
  const faq = segmentClaims(`<h2>本文</h2><p>本文の文。</p><h2 id="faq">よくある質問</h2><h3>${q}</h3><p>${a}</p><h3>次の設問は？</h3><p>次の答え。</p><h2>出典</h2><h3>${q}</h3><p>${a}</p>`);
  const [inFaq, outside] = faq.filter(u => u.text === q);
  assert.equal(inFaq.context, `【回答】${a}`); assert.equal(inFaq.protected, true, '数字のある設問は非主張にできないまま');
  assert.equal(outside.context, undefined, 'FAQ の外の h3＋p は束ねない');
  assert.equal(inFaq.text_hash, outside.text_hash); assert.equal(inFaq.id.slice(0, -2), outside.id.slice(0, -2));
  const ans = faq.filter(u => u.kind === 'p' && u.zone === 'faq' && u.context?.startsWith(`【質問】${q}`));
  assert.deepEqual(ans.map(u => u.text), ['A. 1日分は8時間に切り上げます。', '年5日なら40時間です。']);
  assert.ok(ans.every(u => u.context === `【質問】${q} 【回答の全文】${a}`));
  assert.equal(faq.find(u => u.text === '次の答え。').context, '【質問】次の設問は？ 【回答の全文】次の答え。', '隣の設問と混ざらない');
  assert.equal(faq.find(u => u.text === '本文の文。').context, undefined);
  // 答えを変えると設問の context_hash が変わる（設問の id は同じ）
  const changed = segmentClaims(`<h2>よくある質問</h2><h3>${q}</h3><p>${a.replace('40時間', '80時間')}</p>`).find(u => u.text === q);
  assert.equal(changed.id.slice(0, -2), inFaq.id.slice(0, -2)); assert.notEqual(changed.context_hash, inFaq.context_hash);
  // 従来の next（text を置き換える）はそのまま。二重には束ねない
  const legacy = segmentClaims(`<h2>よくある質問</h2><h3 data-review-context="next">3年途中の除却は？</h3><p class="faq-answer">通常除却では残額算入不可。</p>`);
  const lq = legacy.find(u => u.text.startsWith('【質問】'));
  assert.equal(lq.text, '【質問】3年途中の除却は？ 【回答】通常除却では残額算入不可。'); assert.equal(lq.context, undefined);
}
// 6. 本物のページで: 無傷で緑（規則2）→ 印を1つ足すと、その表のセルだけに文脈が付き、全単位の id・text は不変
{
  const path = new URL('../docs/furusato/index.html', import.meta.url), html = readFileSync(path, 'utf8');
  const before = segmentClaims(html, 'docs/furusato/index.html');
  const target = '<p>次は、確定申告をする場合について、特例分の天井46,840円・両税率5％を固定した算術例です。';
  assert.equal(html.split(target).length, 2, '印を足す段落は本文に1つだけ（規則8: 壊し方を一意に）');
  const cellsBefore = before.filter(u => u.text.startsWith('【行】80,000円（上限超え'));
  assert.ok(cellsBefore.length >= 3 && cellsBefore.every(u => u.context_hash === null), '無傷: この表のセルに文脈は無い');
  const after = segmentClaims(html.replace(target, target.replace('<p>', '<p data-review-context="before-table">')), 'docs/furusato/index.html');
  assert.deepEqual(core(after), core(before));
  const withCtx = after.filter(u => u.context?.includes('特例分の天井46,840円・両税率5％を固定した算術例'));
  assert.ok(withCtx.length >= 10 && withCtx.every(u => /^t[dh]$/.test(u.kind)));
  assert.ok(after.filter(u => u.text.startsWith('【行】80,000円（上限超え')).every(u => u.context?.startsWith('【表の直前の説明】次は、確定申告をする場合について')));
  // FAQ の設問は印なしで答えつき
  const fq = before.filter(u => u.zone === 'faq' && /^h[3-6]$/.test(u.kind));
  // このページは従来の next（text が【質問】…【回答】…）の設問も持つ。どの設問も、答えが text か context のどちらか一方に必ず在る
  assert.ok(fq.length >= 3 && fq.every(u => u.text.startsWith('【質問】') ? u.context === undefined && u.text.includes('【回答】') : u.context?.startsWith('【回答】')));
  assert.ok(fq.some(u => u.context) && fq.some(u => !u.context));
  assert.ok(before.filter(u => u.zone === 'summary' && !/^t[dh]$/.test(u.kind) && !(u.kind === 'p' && u.context?.startsWith('【質問】'))).every(u => u.context_hash === null), 'title・description・要約に文脈は付かない');
}
// 7. check_claim_scope: must_with の語は、単位の本文か局所文脈にあればよい。離れた段落にあるだけでは落ちる
{
  const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const dir = mkdtempSync(tmpdir() + '/unit-context-'); mkdirSync(dir + '/docs/x', { recursive: true });
  const ledger = dir + '/ledger.json'; writeFileSync(ledger, JSON.stringify({ claims: [{ id: 'c1', text: '控除の合計', numbers: ['58,621円'], must_with: ['両税率5％'] }] }));
  const table = '<table><tr><th>寄附額</th><th>控除</th></tr><tr><td>80,000円</td><td>58,621円</td></tr></table>';
  const run = html => { writeFileSync(dir + '/docs/x/index.html', html); return spawnSync('node', [fileURLToPath(new URL('../tools/check_claim_scope.mjs', import.meta.url)), dir + '/docs/x/index.html', '--ledger', ledger], { encoding: 'utf8' }); };
  const far = run(`<p>両税率5％の算術例です。</p><p>別の話。</p>${table}`);
  assert.equal(far.status, 1, far.stdout); assert.match(far.stdout, /「両税率5％」が同じ文に無い/);
  assert.equal(run(`<p>両税率5％の算術例です。</p>${table}`).status, 1, '隣でも、印が無ければ従来どおり落ちる');
  const ok = run(`<p data-review-context="before-table">両税率5％の算術例です。</p>${table}`);
  assert.equal(ok.status, 0, ok.stdout); assert.match(ok.stdout, /条件の抜け 0/);
  assert.equal(run(`<p data-review-context="before-table">税率を固定した算術例です。</p>${table}`).status, 1, '文脈にも語が無ければ落ちる');
}
console.log('unit context: ids unchanged; table premise only when adjacent and marked; FAQ question bundled with its answer');
