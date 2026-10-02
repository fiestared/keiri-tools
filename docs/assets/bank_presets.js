/** Public IDs belong to fee_table.json, never array positions or amounts. */
export function attachBankPresets({ select, under, over, note, fetcher = fetch, win = window }) {
  let edited = false;
  let banks = [];
  const initialFees = [under.value, over.value];
  const notice = text => { note.textContent = text; note.style.display = ''; };
  const changed = () => {
    edited = true;
    notice('手数料の入力・選択を変更しました。現在の入力値で計算します。');
  };
  [under, over].forEach(el => {
    el.addEventListener('input', changed);
    el.addEventListener('change', changed);
  });
  select.addEventListener('change', () => {
    changed();
    const bank = banks[Number(select.value)];
    if (select.value !== '' && bank) {
      under.value = bank.under30k;
      over.value = bank.over30k;
      if (bank.scope_note || bank.public_note) notice([bank.scope_note, bank.public_note].filter(Boolean).join("。"));
    }
  });
  function applyHash() {
    // Restored form values and edits made while loading always win.
    if (edited || under.value !== initialFees[0] || over.value !== initialFees[1]) return;
    const id = new URLSearchParams(win.location.hash.slice(1)).get('bank');
    if (!id) return;
    const index = banks.findIndex(bank => bank.id === id);
    if (index < 0) {
      notice('指定された銀行を見つけられませんでした。銀行を選ぶか、手数料を手入力してください。');
      return;
    }
    const bank = banks[index];
    select.value = String(index);
    under.value = bank.under30k;
    over.value = bank.over30k;
    // Auto-applied values become the baseline for history/hash navigation.
    initialFees[0] = under.value; initialFees[1] = over.value;
    notice(`${bank.name}の掲載手数料を選択済み。請求額と、取引先との取り決めに合う差引方式を確認してください。${[bank.scope_note, bank.public_note].filter(Boolean).join("。")}`);
  }
  win.addEventListener('hashchange', applyHash);
  return fetcher('../assets/fee_table.json')
    .then(response => { if (!response.ok) throw new Error('fee table unavailable'); return response.json(); })
    .then(data => {
      if (!Array.isArray(data.banks) || data.banks.some(b => !Number.isFinite(b.under30k) || !Number.isFinite(b.over30k))) throw new Error('invalid fee table');
      banks = data.banks;
      banks.forEach((bank, index) => {
        const option = select.ownerDocument.createElement('option');
        option.value = index;
        option.textContent = `${bank.name}　${bank.under30k}円 / ${bank.over30k}円`;
        select.appendChild(option);
      });
      applyHash();
      return true;
    }).catch(() => {
      notice('銀行プリセットを読み込めませんでした。振込手数料は手入力してください（計算はできます）。');
      return false;
    });
}
