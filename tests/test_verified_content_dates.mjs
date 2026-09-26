import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { verifiedContentDates, verifiedContentDate } from '../tools/verified_content_dates.mjs';
const cwd = new URL('../', import.meta.url);
for (const entry of verifiedContentDates) {
  const date = execFileSync('git', ['show', '-s', '--format=%cs', entry.commit], { cwd, encoding: 'utf8' }).trim();
  assert.equal(entry.date, date, 'override must match the verified commit date');
  const patch = execFileSync('git', ['show', '--format=', '-U0', entry.commit, '--', entry.path], { cwd, encoding: 'utf8' });
  assert.match(patch, /^\+[ ]*<p(?:>| )/m, 'verified commit must change article paragraphs');
  const html = readFileSync(new URL(entry.path, cwd), 'utf8');
  const modified = html.match(/"dateModified"\s*:\s*"([\d-]+)"/)[1];
  assert.ok(modified >= entry.date, 'published metadata must not predate the verified content revision');
}
assert.equal(verifiedContentDate('docs/column/anzen-eisei-suishinsha/index.html', '2026-09-26'), '2026-09-26', 'newer revisions must remain newer');
assert.equal(verifiedContentDate('docs/unrelated/index.html', '2026-08-24'), '2026-08-24', 'unreviewed pages must keep normal inference');
console.log('verified content dates: OK');
