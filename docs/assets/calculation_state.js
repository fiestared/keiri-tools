/** Opt-in for the three manually calculated payroll tools. No calculation rules here. */
export function watchCalculation(scope, box, copyButton) {
  let revision = 0;
  const snapshot = () => JSON.stringify([...scope.querySelectorAll('input, select, textarea')]
    .map(el => [el.id || el.name, el.value, el.checked]));
  box.dataset.resultState = 'initial';
  function stale() {
    box.dataset.resultState = 'stale';
    copyButton.disabled = true;
    box.style.display = 'block';
    if (!box.querySelector('.recalculate-note')) {
      const note = document.createElement('p');
      note.className = 'recalculate-note';
      note.style.fontWeight = '700';
      note.textContent = '条件を変更しました。再計算してください。以下は変更前の結果です。';
      box.prepend(note);
    }
  }
  function changed(event) {
    if (!event.target.matches('input, select, textarea')) return;
    revision++;
    if (['success', 'pending', 'stale'].includes(box.dataset.resultState)) stale();
  }
  scope.addEventListener('input', changed);
  scope.addEventListener('change', changed);
  return {
    begin() {
      box.dataset.resultState = 'pending';
      copyButton.disabled = true;
      return {revision, values: snapshot()};
    },
    finish(ticket) {
      // A slow data fetch must never restore copy after an intervening edit.
      if (ticket.revision !== revision || ticket.values !== snapshot()) stale();
      else box.dataset.resultState = 'success';
    },
  };
}

/** Respect the age range already declared by each calculator, without rounding/coercing blanks. */
export function validateAge(input, box) {
  const age = Number(input.value);
  const valid = input.value.trim() !== '' && Number.isInteger(age)
    && age >= Number(input.min) && age <= Number(input.max);
  const error = document.getElementById('age-error');
  input.setAttribute('aria-invalid', String(!valid));
  error.hidden = valid;
  if (!valid) {
    const message = `年齢は${input.min}〜${input.max}歳の整数で入力してください。`;
    error.textContent = message;
    box.dataset.resultState = 'error';
    box.innerHTML = `<div class="warn"><a href="#age">${message}</a></div>`;
  }
  return valid;
}
