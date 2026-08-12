#!/usr/bin/env node
/**
 * グローバルナビが全ページで揃っているかを見る。
 *
 * なぜ要るか（2026-08-12）:
 *   ナビは182ページの静的HTMLに直書きされている。手で足すと必ず取り残しが出る。
 *   実際「資産形成」は**5ページにしか入っていなかった**（残り177ページには無い）。
 *   利用者から見ると、あるページには在ってあるページには無いリンクになる。
 *   → tools/gen_nav.mjs で生成し、ここで「生成した結果と一致するか」を検査する。
 *
 * ★この検査は「ナビの中身が正しいか」ではなく「揃っているか」を見る。
 *   項目を足したいときは gen_nav.mjs の ITEMS を直して流し直す。
 */
import { execFileSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url).pathname;
try {
  const out = execFileSync('node', ['tools/gen_nav.mjs', '--check'],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log(out.trim());
} catch (e) {
  console.error((e.stdout || '') + (e.stderr || ''));
  console.error('✗ グローバルナビが揃っていない。node tools/gen_nav.mjs を実行してコミットすること。');
  process.exit(1);
}
