/**
 * /link/（リンク・ご紹介について）のコピーボタン。
 * button[data-copy-target] を押すと、id で指した要素の文字列をそのままクリップボードへ入れる。
 * clipboard API が使えない環境（http・古いブラウザ）では、選択して execCommand で写す。
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

const status = document.querySelector(".link-copy-status");
for (const btn of document.querySelectorAll("button[data-copy-target]")) {
  const label = btn.textContent;
  let timer;
  btn.addEventListener("click", async () => {
    const el = document.getElementById(btn.dataset.copyTarget);
    if (!el) return;
    const ok = await copyText(el.textContent.trim());
    btn.textContent = ok ? "コピーしました" : "コピーできませんでした。文章を選択してコピーしてください";
    if (status) status.textContent = ok ? `${label.replace(/をコピー$/, "")}をコピーしました。` : "コピーできませんでした。";
    clearTimeout(timer);
    timer = setTimeout(() => { btn.textContent = label; }, 2500);
  });
}
