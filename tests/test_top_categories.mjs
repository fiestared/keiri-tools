/**
 * トップのツールの分類（個人向けの棚に会社向けのツールが混ざらない）と、カードの説明の書式。
 *   node tests/test_top_categories.mjs
 *
 * ★なぜ要るか（2026-10-08 UI/UXレビュー 中8・低）:
 *   「もらえるお金・休暇・退職（個人）」に、法定福利費（会社負担）・法人税の簡易計算・算定基礎届・
 *   予定納税の減額申請・源泉徴収票の書き方が並んでいた。新しいツールのカードを「最後に作った棚」へ
 *   足していった結果で、トップは手書きなので誰も気づかない。
 *   また新しいツールの説明だけ <b> で太字になっていて、カードの並びの中でそこだけ浮いていた。
 * ★2段で見る（規則1: 落ちるべきものが落ち、通るべきものが通る）:
 *   ① 登録簿 COMPANY: 会社・事業者向けと確定したツールは、個人の棚（PERSONAL）に置かない。
 *   ② 網: 個人の棚のカードの「ツールのページの <title>」に会社向けの語があれば落とす（登録し忘れの保険）。
 *      網は title を見る（カードの説明は短く言い換えるので語が落ちる）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export function check(html, titleOf) {
  const errors = [];
  const PERSONAL = ['t-kyuyo', 't-setsuzei', 't-kyufu', 't-kurashi'];
  const COMPANY = { 'hotei-fukuri': 't-keiri', hojinzei: 't-keiri', santei: 't-keiri', 'gensen-hyo': 't-keiri', 'yotei-nozei': 't-jigyo' };
  const NET = /会社が負担|法人税|算定基礎届|予定納税|源泉徴収票の書き方|月額変更届|賞与支払届|労働保険の年度更新/;
  const sections = {};
  for (const m of html.matchAll(/<section class="tcat" id="([^"]+)">([\s\S]*?)<\/section>/g)) {
    sections[m[1]] = [...m[2].matchAll(/<a class="tool-card" href="([^"/]+)\/">/g)].map((x) => x[1]);
  }
  for (const id of PERSONAL) if (!sections[id]) errors.push(`個人の棚 ${id} が見つからない（検査の前提が崩れた）`);
  for (const [slug, want] of Object.entries(COMPANY)) {
    const at = Object.entries(sections).filter(([, v]) => v.includes(slug)).map(([k]) => k);
    if (!at.length) errors.push(`${slug} のカードがトップに無い`);
    for (const id of at) if (id !== want) errors.push(`${slug}（会社・事業者向け）が ${id} に置かれている。${want} へ`);
  }
  for (const id of PERSONAL) for (const slug of sections[id] || []) {
    const t = titleOf(slug);
    if (NET.test(t)) errors.push(`個人の棚 ${id} に会社向けらしいツール: ${slug}「${t}」`);
  }
  for (const m of html.matchAll(/<a class="tool-card"[^>]*>[\s\S]*?<div class="desc">([\s\S]*?)<\/div>/g)) {
    if (/<(?:b|strong)\b/.test(m[1])) errors.push(`カードの説明に太字: ${m[1].replace(/<[^>]+>/g, '').slice(0, 40)}`);
  }
  return errors;
}

const html = readFileSync(join(root, 'docs/index.html'), 'utf8');
const titleOf = (slug) => (readFileSync(join(root, 'docs', slug, 'index.html'), 'utf8').match(/<title>([^<]*)/) || [])[1] || '';
const errors = check(html, titleOf);
assert.deepEqual(errors, [], errors.join('\n'));

// 規則2: 壊すと赤（法定福利費のカードを個人の棚へ戻す／説明を太字にする）
const card = html.match(/\n    <a class="tool-card" href="hotei-fukuri\/">[\s\S]*?\n    <\/a>/)[0];
const broken = html.replace(card, '').replace('<section class="tcat" id="t-kyufu">', '<section class="tcat" id="t-kyufu">' + card);
assert.ok(check(broken, titleOf).some((e) => e.includes('hotei-fukuri')), '法定福利費を個人の棚へ戻しても赤にならない');
const bold = html.replace(/<div class="desc">/, '<div class="desc"><b>太字</b>');
assert.ok(check(bold, titleOf).some((e) => e.includes('太字')), '説明を太字にしても赤にならない');
console.log(`✓ トップの分類: 会社向け${5}件は会社・事業者の棚、個人の棚の網に該当なし、カード説明に太字なし（壊しテスト2種も赤）`);
