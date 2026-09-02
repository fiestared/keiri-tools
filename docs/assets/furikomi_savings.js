const RAKSUL_OTHER_BANK_FEE = 119;

export function parsePositiveInteger(value) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\s,，円件]/g, "");
  if (!/^\d+$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function calculateFurikomiSavings(monthlyCount, currentFee) {
  if (!Number.isSafeInteger(monthlyCount) || monthlyCount <= 0) {
    throw new TypeError("monthlyCount must be a positive integer");
  }
  if (!Number.isSafeInteger(currentFee) || currentFee <= 0) {
    throw new TypeError("currentFee must be a positive integer");
  }

  const currentMonthly = monthlyCount * currentFee;
  const raksulMonthly = monthlyCount * RAKSUL_OTHER_BANK_FEE;
  const monthlySaving = Math.max(0, currentMonthly - raksulMonthly);

  return {
    currentMonthly,
    raksulMonthly,
    monthlySaving,
    annualSaving: monthlySaving * 12,
    isCheaper: currentFee > RAKSUL_OTHER_BANK_FEE,
  };
}

function bucket(value, boundaries) {
  for (const boundary of boundaries) {
    if (value <= boundary) return `up_to_${boundary}`;
  }
  return `over_${boundaries.at(-1)}`;
}

function init() {
  const form = document.getElementById("furikomi-savings-form");
  if (!form) return;

  const countInput = document.getElementById("furikomi-monthly-count");
  const feeInput = document.getElementById("furikomi-current-fee");
  const error = document.getElementById("furikomi-savings-error");
  const result = document.getElementById("furikomi-savings-result");
  const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const monthlyCount = parsePositiveInteger(countInput.value);
    const currentFee = parsePositiveInteger(feeInput.value);

    countInput.removeAttribute("aria-invalid");
    feeInput.removeAttribute("aria-invalid");
    error.hidden = true;

    if (monthlyCount === null || currentFee === null) {
      if (monthlyCount === null) countInput.setAttribute("aria-invalid", "true");
      if (currentFee === null) feeInput.setAttribute("aria-invalid", "true");
      error.textContent = "振込件数と1件あたりの手数料を、1以上の整数で入力してください。";
      error.hidden = false;
      result.hidden = true;
      (monthlyCount === null ? countInput : feeInput).focus();
      return;
    }

    const values = calculateFurikomiSavings(monthlyCount, currentFee);
    document.getElementById("furikomi-monthly-saving").textContent = yen.format(values.monthlySaving);
    document.getElementById("furikomi-annual-saving").textContent = yen.format(values.annualSaving);
    document.getElementById("furikomi-current-total").textContent = yen.format(values.currentMonthly);
    document.getElementById("furikomi-raksul-total").textContent = yen.format(values.raksulMonthly);
    document.getElementById("furikomi-savings-message").textContent = values.isCheaper
      ? "現在の入力条件では、119円との差額が削減見込みです。"
      : "現在の手数料は119円以下のため、この比較での削減見込みは0円です。";
    result.hidden = false;
    result.focus({ preventScroll: true });

    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "furikomi_savings_calculate", {
          monthly_count_bucket: bucket(monthlyCount, [10, 30, 50, 100]),
          current_fee_bucket: bucket(currentFee, [119, 220, 440, 660]),
          monthly_saving_bucket: bucket(values.monthlySaving, [1000, 5000, 10000, 30000]),
          from: "furikomi-tesuryo-hikaku",
        });
      }
    } catch (_) {
      // 計測失敗で計算結果を壊さない。
    }
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}
