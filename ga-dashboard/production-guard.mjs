import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Snapshot the exact committed input bytes; check again immediately before sending.
export function productionGuard(dir) {
  const git = (...args) => execFileSync('/usr/bin/git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const files = ['build.mjs', 'run.sh', 'production-guard.mjs'];
  const head = git('rev-parse', 'HEAD');
  const inputs = new Map(files.map(name => [name, readFileSync(join(dir, name))]));
  function verify() {
    for (const state of ['MERGE_HEAD', 'REBASE_HEAD', 'CHERRY_PICK_HEAD', 'rebase-merge', 'rebase-apply']) {
      if (existsSync(git('rev-parse', '--path-format=absolute', '--git-path', state))) {
        throw new Error('本番送信を停止: Gitの統合作業中。解消・コミットしてから再実行してください。');
      }
    }
    if (git('rev-parse', 'HEAD') !== head || git('status', '--porcelain', '--untracked-files=all', '--', '.')) {
      throw new Error('本番送信を停止: ga-dashboardに未コミットの変更、または実行中のコミット変更があります。');
    }
    for (const [name, bytes] of inputs) {
      const committed = execFileSync('/usr/bin/git', ['-C', dir, 'show', `${head}:ga-dashboard/${name}`], { stdio: ['ignore', 'pipe', 'pipe'] });
      if (!bytes.equals(committed) || !bytes.equals(readFileSync(join(dir, name)))) {
        throw new Error(`本番送信を停止: ${name} が起動時のコミットと一致しません。`);
      }
    }
    return head;
  }
  verify();
  return { head, verify };
}

if (process.argv[2] === '--check') {
  try { productionGuard(fileURLToPath(new URL('.', import.meta.url))); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
