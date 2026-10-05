// 公開物・台帳・道具に git のぶつかった印（<<<<<<< / ======= / >>>>>>>）が残っていないこと（2026-10-05）。
// ★実害寸前: 公開手順で main を取り込んだとき、ぶつかったまま生成器の後段の `git add -u` が電帳法3ページを印ごとコミットし、
//   ほかの検査は全部緑のままだった（push 前に司令塔が気づいた）。
import { execFileSync } from 'node:child_process';
let out = '';
try {
  out = execFileSync('git', ['grep', '-n', '-E', '^(<<<<<<<|>>>>>>>) |^=======$', '--', 'docs', 'claims', 'tools', 'tests'], { encoding: 'utf8' });
} catch (e) { if (e.status !== 1) throw e; }   // status 1 = 一致なし
const hits = out.split('\n').filter(Boolean).filter((l) => !l.startsWith('tests/test_no_conflict_markers.mjs'));
if (hits.length) { console.error('✗ ぶつかった印が残っている:\n' + hits.slice(0, 20).join('\n')); process.exit(1); }
console.log('✓ test_no_conflict_markers: docs・claims・tools・tests にぶつかった印なし');
