/**
 * 計算結果を「そのまま貼れる形」でコピーさせる共通部品。
 *
 * ★なぜ要るのか（2026-08-03 ペルソナレビュー）: 57ツール中、結果をコピーできるのは2本だけだった。
 *   経理担当者は結果を freee へ手打ちし、上長へはスクショで送っていた。
 *   計算が正しくても、そこで時間と転記ミスが生まれる。
 *
 * ★出所を必ず付ける: コピーしたテキストだけが独り歩きするので、
 *   「何のツールの、いつの計算か」を本文に含める。数字だけを渡さない。
 */

/** 表示用の装飾やボタン文言を落として、貼って意味が通る行だけにする（純関数・テスト対象） */
export function cleanResultText(raw) {
  return String(raw ?? "")
    .split("\n")
    .map((l) => l.replace(/\u3000/g, " ").trim())
    .filter((l) => l.length > 0)
    // ボタンやリンクの文言は結果ではないので落とす
    .filter((l) => !/^(コピー(しました)?|結果をコピー|印刷|閉じる)/.test(l))
    .join("\n");
}

/**
 * コピーする本文を組み立てる（純関数・テスト対象）
 * @param {{title:string, url:string, body:string, dateJst:string}} p
 */
export function buildCopyText({ title, url, body, dateJst }) {
  const lines = [cleanResultText(body)];
  lines.push("");
  lines.push(`— ${title}（${dateJst} 計算）`);
  if (url) lines.push(url);
  return lines.join("\n");
}

/** JSTの日付（YYYY-MM-DD）。★toISOString は UTC なので使わない */
export function todayJst(now = new Date()) {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

/**
 * ボタンに「結果をコピー」の動作を付ける。
 * 結果が空のあいだはボタンを隠し、結果が出たら現れる。
 * @param {HTMLElement} btn
 * @param {HTMLElement} resultEl
 * @param {{title?:string, url?:string}} opts
 */
export function attachCopyButton(btn, resultEl, opts = {}) {
  if (!btn || !resultEl) return;
  const title = opts.title || document.title.split("｜")[0].trim();
  const url = opts.url || location.href.split("#")[0];

  const sync = () => {
    const has = cleanResultText(resultEl.innerText).length > 0
      && resultEl.style.display !== "none";
    btn.style.display = has ? "" : "none";
  };
  sync();
  new MutationObserver(sync).observe(resultEl, {
    childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["style"],
  });

  btn.addEventListener("click", async () => {
    const text = buildCopyText({ title, url, body: resultEl.innerText, dateJst: todayJst() });
    try {
      await navigator.clipboard.writeText(text);
      const before = btn.textContent;
      btn.textContent = "コピーしました ✓";
      setTimeout(() => { btn.textContent = before; }, 1800);
    } catch {
      // ★失敗を黙らせない。クリップボードは権限やHTTPSの条件で普通に失敗する
      btn.textContent = "コピーできませんでした（手動で選択してください）";
    }
  });
}
