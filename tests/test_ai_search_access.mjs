/**
 * AI 検索（ChatGPT search・Microsoft Copilot）から公開ページが見えなくなる設定を落とす。
 *
 * なぜ要るか（2026-10-07、Masahiro「AI検索もやれるならやっておいて」）:
 *   GA4 では ChatGPT から28日で378、Copilot から118の流入がある。
 *   どちらも、こちらが1行書き間違えると黙って消える経路で、通常検索の計器（GSC・Bing の順位）には出ない。
 *   一次資料（2026-10-07 に curl で取得。gbrain research/keiri-ai-search-2026-10-07）:
 *   - OpenAI「Overview of OpenAI Crawlers」: "Sites that are opted out of OAI-SearchBot will not be shown
 *     in ChatGPT search answers" ／ GPTBot は学習用で "Each setting is independent of the others"。
 *   - Bing Webmaster Blog 2023-09: "Content tagged NOARCHIVE will not be included in Bing Chat answers,
 *     not be linked to in the answers." ／ NOCACHE は "We will only display URL/Snippet/Title in the answer"。
 *   - Microsoft Learn（Copilot の web search）: Copilot は "sends to the Bing search service" ＝ Bingbot の索引。
 *
 * 見るもの:
 *   1. robots.txt で、検索用のクローラ（OAI-SearchBot・Bingbot）が sitemap の全 URL を取得できること。
 *      ★GPTBot（学習用）は**見ない**。拒否するかどうかは Masahiro の判断で、どちらでも検索には影響しない
 *        （OpenAI の文書が「独立」と明言）。拒否を足してもこの検査は赤にならない（下の自己検査で固定）。
 *   2. sitemap に載せた公開ページに、AI 回答から外す/切り詰める指定（noarchive・nocache・nosnippet・
 *      none・noindex）が robots / bingbot の meta に無いこと。
 *      ★noindex は test_nopublish が .nopublish との対応を見ている。ここでは「sitemap に載せたのに索引させない」矛盾として見る。
 *
 * 規則1・2（両方向・ベースライン）: robots の解釈器は自前なので、まず合成した robots.txt で
 *   「拒否なら拒否と判定する／GPTBot だけの拒否は検索系を止めない」を先に確かめてから本物を読む。
 */
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const SEARCH_BOTS = ['OAI-SearchBot', 'Bingbot'];

/** robots.txt を group に分ける（RFC 9309 の最小実装: user-agent 行の連続が1つの group を作る） */
function parseRobots(text) {
  const groups = [];
  let cur = null, lastWasUA = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasUA) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasUA = true;
    } else {
      lastWasUA = false;
      if (cur && (key === 'allow' || key === 'disallow')) cur.rules.push({ allow: key === 'allow', path: val });
    }
  }
  return groups;
}

/** その bot に効く規則（名前が一致する group を全部合わせる。無ければ *） */
function rulesFor(groups, bot) {
  const b = bot.toLowerCase();
  const named = groups.filter((g) => g.agents.includes(b));
  const use = named.length ? named : groups.filter((g) => g.agents.includes('*'));
  return use.flatMap((g) => g.rules);
}

const toRe = (p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));

/** 最長一致。同じ長さなら Allow を優先（RFC 9309 2.2.2） */
function allowed(rules, path) {
  let best = null;
  for (const r of rules) {
    if (r.path === '') continue; // 空の Disallow は「全部許可」
    if (!toRe(r.path).test(path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

// ---- 自己検査（解釈器が壊れていたら本物を読む意味がない） ----
{
  const blockAll = parseRobots('User-agent: *\nDisallow: /\n');
  assert.equal(allowed(rulesFor(blockAll, 'OAI-SearchBot'), '/furusato/'), false, '自己検査: * の全拒否を拒否と判定できない');
  const named = parseRobots('User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /column/\n');
  assert.equal(allowed(rulesFor(named, 'OAI-SearchBot'), '/column/x/'), false, '自己検査: 名指しの拒否を拒否と判定できない');
  assert.equal(allowed(rulesFor(named, 'Bingbot'), '/column/x/'), true, '自己検査: 名指しの拒否が他の bot に漏れている');
  const gptOnly = parseRobots('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n');
  for (const b of SEARCH_BOTS) assert.equal(allowed(rulesFor(gptOnly, b), '/'), true, `自己検査: GPTBot だけの拒否で ${b} が止まると判定した`);
  const longest = parseRobots('User-agent: *\nDisallow: /column/\nAllow: /column/ok/\n');
  assert.equal(allowed(rulesFor(longest, 'Bingbot'), '/column/ok/'), true, '自己検査: 最長一致の Allow が効いていない');
}

// ---- 本物 ----
const robotsPath = join(DOCS, 'robots.txt');
assert.ok(existsSync(robotsPath), 'docs/robots.txt が無い');
const robots = readFileSync(robotsPath, 'utf8');
assert.match(robots, /^Sitemap:\s*https:\/\/keiri-tools\.com\/sitemap\.xml\s*$/m, 'robots.txt に sitemap の宣言が無い');
const groups = parseRobots(robots);

const sitemap = readFileSync(join(DOCS, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>https:\/\/keiri-tools\.com(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
assert.ok(locs.length >= 300, `sitemap の URL が ${locs.length} 件しか読めない（走査が壊れている）`);

const blocked = [];
for (const bot of SEARCH_BOTS) {
  const rules = rulesFor(groups, bot);
  for (const p of locs) if (!allowed(rules, p)) blocked.push(`${bot} ${p}`);
}
assert.deepEqual(blocked, [], `検索用クローラが robots.txt で止められている（ChatGPT search / Copilot から消える）:\n  ${blocked.slice(0, 20).join('\n  ')}`);

// meta robots / bingbot
const BAD = /\b(noarchive|nocache|nosnippet|none|noindex)\b/i;
const metaBad = [];
let read = 0;
for (const p of locs) {
  const f = join(DOCS, p, p.endsWith('/') ? 'index.html' : '');
  if (!existsSync(f)) continue;
  read++;
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const name = tag.match(/name=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (name !== 'robots' && name !== 'bingbot') continue;
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1] ?? '';
    if (BAD.test(content)) metaBad.push(`${p} ${tag}`);
  }
  if (/data-nosnippet/i.test(html)) metaBad.push(`${p} data-nosnippet`);
}
assert.ok(read >= locs.length * 0.9, `sitemap の URL のうちファイルを読めたのが ${read}/${locs.length}（対応づけが壊れている）`);
assert.deepEqual(metaBad, [], `sitemap に載せた公開ページが AI 回答から外れる指定を持っている:\n  ${metaBad.slice(0, 20).join('\n  ')}`);

console.log(`ok: robots.txt で ${SEARCH_BOTS.join('・')} が sitemap の ${locs.length} URL を取得可、公開ページ ${read} 本に noarchive/nocache/nosnippet/noindex なし`);
