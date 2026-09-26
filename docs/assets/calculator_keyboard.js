/** Enter on a single-line field calculates only its own pane. Composition/textarea stay native. */
export function calculatorEnter(scope, button) {
  scope.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.matches('input[type=number],input[type=text],input[type=date]')) return;
    if (e.isComposing || e.keyCode === 229) return;
    e.preventDefault(); if (!e.repeat && !button.disabled) button.click();
  });
}
export function optionalSummary(details) {
  const state = details.querySelector('[data-optional-state]');
  const sync = () => { state.textContent = [...details.querySelectorAll('input,select')].some(el => el.type === 'checkbox' ? el.checked : Number(el.value) !== 0 && el.value !== '') ? '設定あり' : '未設定'; };
  details.addEventListener('input', sync); details.addEventListener('change', sync); details.addEventListener('toggle', sync); sync();
}
