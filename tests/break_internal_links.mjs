/** test_internal_links.mjs が実際のリンク切れを赤にできるか確かめる壊しテスト。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'docs', 'hotei-fukuri', 'index.html');
const original = readFileSync(target, 'utf8');
const run = () => spawnSync(process.execPath, ['tests/test_internal_links.mjs'], { cwd: root, encoding: 'utf8' });

const baseline = run();
if (baseline.status !== 0) {
  console.error('✗ ベースラインが赤。壊しテストを中止する。');
  console.error((baseline.stdout || '') + (baseline.stderr || ''));
  process.exit(1);
}

let broken;
try {
  const changed = original.replace('../shakai-hoken/', '../zz-break-missing-link/');
  if (changed === original) throw new Error('壊す対象リンクが見つからない');
  writeFileSync(target, changed);
  broken = run();
} finally {
  writeFileSync(target, original);
}

const restored = run();
const caught = broken?.status !== 0 && `${broken.stdout}${broken.stderr}`.includes('zz-break-missing-link');
if (!caught || restored.status !== 0) {
  console.error(`✗ 壊し検出=${caught} 復元後=${restored.status === 0}`);
  process.exit(1);
}
console.log('✓ 内部リンクの壊しテスト OK（切断で赤、復元後に緑）');
