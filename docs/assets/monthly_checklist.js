import {todayJst, readJSON, writeJSON, removeStored, trackRetention, recordUse, forgetUse} from './retention.js';
export const MONTH_KEY = 'keiri_monthly_checks_v1';
export const TASK_IDS = ['withholding-normal', 'withholding-special', 'social', 'payments', 'records', 'annual'];
export function monthPair(now = new Date()) {
  const [y, m] = todayJst(now).slice(0, 7).split('-').map(Number);
  return [`${y}-${String(m).padStart(2, '0')}`, `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`];
}
export function cleanMonths(value) {
  const out = {};
  if (!value || value.version !== 1 || !value.months || typeof value.months !== 'object') return out;
  for (const [month, ids] of Object.entries(value.months))
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Array.isArray(ids)) out[month] = [...new Set(ids.filter(id => TASK_IDS.includes(id)))];
  return out;
}
const tasks = [
 ['withholding-normal','通常納付をする場合：源泉所得税','前月に支払った給与等の納付を確認。原則は支払月の翌月10日まで、休日なら翌開庁日です。','/gensen-choshu/','源泉税を計算','https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2505.htm','国税庁：通常納付'],
 ['withholding-special','納期特例を使う場合：対象期間と承認','承認を受けた事業所の対象所得だけ。1〜6月支払分は7月10日、7〜12月支払分は翌年1月20日。すべての報酬が対象ではありません。休日は翌開庁日です。','/column/gensen-shotokuzei-noki-tokurei/','納期特例を確認','https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2505.htm','国税庁：特例の条件'],
 ['social','健康保険・厚生年金保険料の納付','対象月の翌月末日が納期限。土日祝なら翌営業日です。納入告知書と口座残高を確認します。','/shakai-hoken/','社会保険料を計算','https://www.nenkin.go.jp/service/kounen/hokenryo/nofu/20121121.html','日本年金機構：納付期限'],
 ['payments','支払予定と社内の承認日','契約上の支払日、銀行休業日、社内の承認に必要な日数を確認します。社内予定は会社ごとに決めます。','/shiharai-site/','支払予定を計算','/eigyobi/','営業日を確認'],
 ['records','証憑・残高・月次の締め','請求書や領収書の保存、売掛・買掛と預金残高の照合、月次の確認を進めます。全国一律の社内締切はありません。','/denchoho-index/','電子取引の索引を作る','/column/keiri-nenkan-schedule/#manage','管理方法を読む'],
 ['annual','その月の年次業務も確認','決算月や対象制度で必要な作業が変わります。下の年間表は2026年版です。翌年の年次期限は各制度の公式案内を確認してください。','#year','年間表を見る','/hojokin/schedule/','補助金の日程を見る'],
];
export function mountMonthly(root) {
  if (!root) return;
  const pair = monthPair(), stored = readJSON(MONTH_KEY, null);
  let months = cleanMonths(stored.value), selected = pair[0], saving = stored.ok && stored.value?.version === 1;
  root.hidden = false;
  root.innerHTML = `<div class="retention-months" aria-label="確認する月">${pair.map((m, i) => `<button type="button" class="btn-outline" data-month="${m}" aria-pressed="${i === 0}">${i ? '翌月' : '今月'}：${Number(m.slice(0,4))}年${Number(m.slice(5))}月</button>`).join('')}</div>
    <p class="hint">対象の項目だけチェックできます。前月の完了は引き継ぎません。個人情報の入力はありません。</p>
    <p class="hint"><a href="#monthly-save-options">チェックの保存設定へ</a></p>
    <p id="monthly-status" role="status"></p><div id="monthly-items"></div>
    <div id="monthly-save-options">
    <label class="retention-opt"><input type="checkbox" id="monthly-save" ${saving ? 'checked' : ''}>チェックをこのブラウザに保存する（任意）</label>
    <p class="hint">共有PCでは保存しないで使えます。チェックを外すと保存済みの確認記録も消えます。別の端末には引き継がれません。</p>
    </div>
    <button type="button" class="btn-outline" id="monthly-clear">保存した全月のチェックを消す</button>`;
  const status = root.querySelector('#monthly-status'), opt = root.querySelector('#monthly-save');
  function notice(message) { status.textContent = message; }
  function render() {
    root.querySelectorAll('[data-month]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.month === selected)));
    const done = months[selected] || [];
    root.querySelector('#monthly-items').innerHTML = `<h3>${Number(selected.slice(0,4))}年${Number(selected.slice(5))}月の確認</h3>` + tasks.map((t, i) => `${i === 0 ? '<h4>法定期限：対象制度と納付方法を確認</h4>' : i === 3 ? '<h4>社内予定：会社の締め・承認に合わせる</h4>' : ''}<div class="monthly-task"><label><input type="checkbox" data-task="${t[0]}" ${done.includes(t[0]) ? 'checked' : ''}><b>${t[1]}</b></label><p>${t[2]}</p><div class="retention-links"><a href="${t[3]}">${t[4]}</a><a href="${t[5]}">${t[6]}</a></div></div>`).join('');
  }
  function persist() {
    if (!saving) return false;
    if (writeJSON(MONTH_KEY, {version: 1, months})) { notice('このブラウザに月別で保存しました。'); return true; }
    saving = false; opt.checked = false; notice('保存できませんでした。チェックはこの画面で使えますが、再読み込みすると消えます。'); return false;
  }
  opt.addEventListener('change', () => {
    if (opt.checked) { saving = true; if (persist()) { trackRetention('retention_save','monthly','keiri-nenkan-schedule','save'); recordUse('monthly','keiri-nenkan-schedule',{baseline:true}); } }
    else if (removeStored(MONTH_KEY)) { saving = false; forgetUse('monthly','keiri-nenkan-schedule'); notice('保存をやめ、保存済みの確認記録を消しました。画面上のチェックは再読み込みで消えます。'); }
    else { opt.checked = true; notice('保存記録を消せませんでした。ブラウザのサイトデータ設定も確認してください。'); }
  });
  root.addEventListener('click', e => {
    const button = e.target.closest('[data-month]');
    if (button) { selected = button.dataset.month; render(); notice('表示する月を切り替えました。'); }
    if (e.target.closest('#monthly-clear')) {
      if (removeStored(MONTH_KEY)) { months = {}; saving = false; opt.checked = false; render(); forgetUse('monthly','keiri-nenkan-schedule'); notice('保存した全月のチェックを消しました。'); trackRetention('retention_clear','monthly','keiri-nenkan-schedule','clear'); }
      else notice('保存記録を消せませんでした。ブラウザのサイトデータ設定も確認してください。');
    }
    if (e.target.closest('.retention-links a')) { trackRetention('retention_open','monthly','keiri-nenkan-schedule','open'); if (saving) recordUse('monthly','keiri-nenkan-schedule'); }
  });
  root.addEventListener('change', e => {
    const id = e.target.dataset.task; if (!TASK_IDS.includes(id)) return;
    const done = new Set(months[selected] || []); if (e.target.checked) done.add(id); else done.delete(id);
    months[selected] = [...done];
    trackRetention('retention_check','monthly','keiri-nenkan-schedule',e.target.checked ? 'check' : 'uncheck');
    if (persist()) recordUse('monthly','keiri-nenkan-schedule');
    else if (!saving && !status.textContent.includes('保存できません')) notice('この画面だけのチェックです。');
  });
  render();
  if (!stored.ok) notice('保存記録を読み取れませんでした。この画面だけでチェックできます。');
  else if (saving) { notice('保存済みの確認記録を表示しています。'); trackRetention('retention_restore','monthly','keiri-nenkan-schedule','restore'); }
}
if (typeof document !== 'undefined') mountMonthly(document.querySelector('#monthly-checklist'));
