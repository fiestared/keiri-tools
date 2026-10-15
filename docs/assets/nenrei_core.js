// Civil dates only: no DOM, clock or timezone dependencies.
// Primary sources and scope: claims/nenrei-hayami.json.
export const TABLE_YEARS = Object.freeze([2026, 2027]);
export const ERAS = Object.freeze([
  { name: '明治', firstYear: 1868, lastYear: 1912, start: '1873-01-01', end: '1912-07-29' },
  { name: '大正', firstYear: 1912, lastYear: 1926, start: '1912-07-30', end: '1926-12-24' },
  { name: '昭和', firstYear: 1926, lastYear: 1989, start: '1926-12-25', end: '1989-01-07' },
  { name: '平成', firstYear: 1989, lastYear: 2019, start: '1989-01-08', end: '2019-04-30' },
  { name: '令和', firstYear: 2019, lastYear: 9999, start: '2019-05-01', end: '9999-12-31' },
].map(Object.freeze));
export const isLeapYear = y => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
export function daysInMonth(y, m) {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}
function integer(value, min, max, label) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max)
    throw new RangeError(`${label}を${min}〜${max}の整数で入力してください。`);
  return Number(value);
}
export function parseDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new RangeError('年月日を入力してください。');
  const [y, m, d] = iso.split('-').map(Number);
  if (y < 1873 || y > 9999) throw new RangeError('日付の変換・年齢計算は1873年1月1日以降に対応しています。');
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) throw new RangeError('存在する年月日を入力してください。');
  return { y, m, d };
}
const eraLabel = (e, y) => `${e.name}${y === e.firstYear ? '元' : y - e.firstYear + 1}年`;
export function seirekiToWareki(year, month = '', day = '') {
  const y = integer(year, 1868, 9999, '西暦年');
  if (month === '' && day === '') return ERAS.filter(e => y >= e.firstYear && y <= e.lastYear).map(e => eraLabel(e, y)).join('／');
  if (month === '' || day === '') throw new RangeError('月と日は両方入力するか、両方空欄にしてください。');
  const m = integer(month, 1, 12, '月'), d = integer(day, 1, 31, '日');
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  parseDate(iso);
  const e = ERAS.find(e => iso >= e.start && iso <= e.end);
  return `${eraLabel(e, y)}${m}月${d}日`;
}
export function warekiToSeireki(name, year, month = '', day = '') {
  const e = ERAS.find(e => e.name === name);
  if (!e) throw new RangeError('元号を選んでください。');
  const n = year === '元' || year === '元年' ? 1 : integer(year, 1, e.lastYear - e.firstYear + 1, '和暦年');
  const y = e.firstYear + n - 1;
  if (month === '' && day === '') return `${y}年`;
  // A year within the era does not make every day in that year valid.
  seirekiToWareki(y, month, day);
  const m = Number(month), d = Number(day);
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (iso < e.start || iso > e.end) throw new RangeError('その年月日は選んだ元号の期間外です。改元日の一覧を確認してください。');
  return `${y}年${m}月${d}日`;
}
// Usual completed age at the beginning of the reference date. In a non-leap
// year, a Feb 29 birth reaches the next age at the end of Feb 28 (Civil Code 143).
export function ageOnDate(birth, reference) {
  const b = parseDate(birth), r = parseDate(reference);
  if (reference < birth) throw new RangeError('基準日は生年月日以降にしてください。');
  const anniversary = b.m === 2 && b.d === 29 && !isLeapYear(r.y) ? [3, 1] : [b.m, b.d];
  return r.y - b.y - (r.m < anniversary[0] || (r.m === anniversary[0] && r.d < anniversary[1]) ? 1 : 0);
}
export function ageTable(year) {
  if (!TABLE_YEARS.includes(Number(year))) throw new RangeError('2026年版か2027年版を選んでください。');
  const y = Number(year);
  return Array.from({ length: 121 }, (_, age) => {
    const birthYear = y - age;
    return { birthYear, wareki: seirekiToWareki(birthYear), before: age === 0 ? null : age - 1, after: age };
  });
}
