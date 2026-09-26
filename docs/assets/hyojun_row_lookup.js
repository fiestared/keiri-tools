// Read the published table itself: do not maintain a second grade/rate dataset.
const form = document.getElementById('grade-lookup');
const input = document.getElementById('grade-amount');
const summary = document.getElementById('grade-summary');
const table = document.querySelector('#grade-table');
const rows = [...table.rows].filter(row => row.cells[0]?.tagName === 'TD');
form.addEventListener('submit', event => {
  event.preventDefault();
  const raw = input.value.normalize('NFKC').replace(/[,\s]/g, '');
  const amount = Number(raw);
  rows.forEach(row => row.classList.remove('is-matched'));
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(amount)) {
    input.setAttribute('aria-invalid', 'true');
    summary.textContent = '報酬月額を0以上の整数（円）で入力してください。';
    input.focus();
    return;
  }
  input.setAttribute('aria-invalid', 'false');
  const row = rows.find(row => {
    const range = row.cells[2].textContent;
    const numbers = range.match(/[\d,]+/g).map(n => Number(n.replaceAll(',', '')));
    if (numbers.length === 2) return amount >= numbers[0] && amount < numbers[1];
    return range.includes('未満') ? amount < numbers[0] : amount >= numbers[0];
  });
  if (!row) { summary.textContent = '該当する行を確認できませんでした。表の範囲を確認してください。'; return; }
  row.classList.add('is-matched');
  const c = [...row.cells].map(cell => cell.textContent.trim());
  summary.textContent = `該当：第${c[0]}級／報酬月額 ${c[2]}円（下限以上・上限未満）。標準報酬月額 ${c[1]}円。本人負担：健康保険（39歳以下）${c[3]}円、健保＋介護（40〜64歳）${c[4]}円、子ども支援金 ${c[5]}円、厚生年金 ${c[6]}円。合計（39歳以下）${c[7]}円。40〜64歳の合計ではありません。`;
  const wrap = table.parentElement;
  if (wrap.classList.contains('is-expanded')) row.scrollIntoView({block:'center',behavior:'instant'});
  else {
    const relativeTop = row.getBoundingClientRect().top - wrap.getBoundingClientRect().top + wrap.scrollTop;
    wrap.scrollTop = Math.max(0, relativeTop - wrap.clientHeight / 2);
    wrap.scrollLeft = 0;
  }
});
