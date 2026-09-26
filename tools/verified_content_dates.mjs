// Actual article revisions inside bulk commits, verified against git history.
// Bulk commits remain excluded by default; this records only reviewed exceptions.
export const verifiedContentDates = [{
  path: 'docs/column/anzen-eisei-suishinsha/index.html',
  date: '2026-09-01',
  commit: '64986031feec7af50721f4bab6a1c357bcdeb23a',
  reason: '本文とFAQの選任資格の説明を更新。20ファイル以上のコミットで通常の日付推定から除外された。',
}];

export function verifiedContentDate(path, inferred) {
  const verified = verifiedContentDates.find(entry => entry.path === path)?.date;
  return verified && (!inferred || verified > inferred) ? verified : inferred;
}
