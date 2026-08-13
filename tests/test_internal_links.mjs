/** 静的HTMLの内部 href が docs/ 内の実在ファイルを指すことを全数検査する。 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs');

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : entry.name.endsWith('.html') ? [path] : [];
  });
}

const failures = [];
let checked = 0;
for (const file of htmlFiles(docs)) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const href = match[1].trim();
    // 動的テンプレートは静的には解決不能。`${BASE}` 等をリンク切れ扱いしない。
    if (!href || href.includes('${') || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) continue;
    const clean = href.split(/[?#]/, 1)[0];
    if (!clean) continue;
    let target = clean.startsWith('/') ? join(docs, clean) : resolve(dirname(file), clean);
    target = normalize(target);
    if (target !== docs && !target.startsWith(docs + sep)) {
      failures.push(`${file.slice(root.length + 1)}: docs外を指す ${href}`);
      continue;
    }
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
    checked++;
    if (!existsSync(target)) failures.push(`${file.slice(root.length + 1)}: ${href} → ${target.slice(root.length + 1)} が無い`);
  }
}

if (failures.length) {
  console.error(`✗ 内部リンク切れ ${failures.length}件`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ 内部リンク OK (${checked}リンク)`);
