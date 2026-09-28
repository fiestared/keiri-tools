// check_input_wiring.mjs — 計算機の入力欄が、本当に答えを動かしているか（誤りの型 D の予防。2026-09-28）。
// ★今は「候補を出す道具」（exit 0）。2026-09-28 の初回実行で候補53件が出た（多くはページの作りの差による誤検知と推定）。
//   1件ずつ仕分けて、本当の配線漏れは直し、正しいものは tools/input_wiring_allow.json に理由つきで書く。
//   誤検知が0になったら tests/ に昇格して関門にする（WIRING_STRICT=1 で今でも関門として動く）。
// ★なぜ: 記事レビューで、入力させた値を計算に渡していない計算機が見つかった（住民税で年齢を入力させて税額計算に使っていない等）。
//   単体テストは core に値を直接渡すので、**画面の入力欄→core の配線**は検査されない（CLAUDE.md「単体テストの守備範囲」）。
//   gbrain keiri-tools/article-error-patterns の D。
// やり方: 計算機のページ（*_core.js を読むページ）を実ブラウザで開き、既定値で計算した結果の文字列を控える。
//   入力欄を1つずつ、いくつかの値（最小・最大・境目・倍・半分、select は全選択肢、checkbox は反転）に変えて計算し直す。
//   **どの値に変えても結果が1文字も変わらない入力欄**は「配線されていない」として落とす。
//   答えを動かさないのが正しい入力欄（表示の切替・メモ・他の入力と組み合わせたときだけ効く等）は、
//   tools/input_wiring_allow.json に**理由つきで**書く（規則1: 正しい商品を落とさない）。
// ★Chromium は1つだけ使う（この Mac は並列の撮影で固まった前歴がある）。
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { browserTools, serve, contextFor, ready, DOCS } from "../tests/layout/browser.mjs";

const ALLOW = JSON.parse(readFileSync(new URL("./input_wiring_allow.json", import.meta.url)));
const ONLY = process.env.WIRING_ONLY;   // 1ページだけ見るとき: WIRING_ONLY=juminzei
const SKIP_ID = /memo|search|keyword|filter|name|label|copy|share|bookmark|favorite|q$/i;

function toolPages() {
  const out = [];
  for (const d of readdirSync(DOCS, { withFileTypes: true })) {
    if (!d.isDirectory() || ["assets", "embed", "column", "hojokin", "ext", "about"].includes(d.name)) continue;
    const f = join(DOCS, d.name, "index.html");
    if (existsSync(f) && /assets\/[a-z0-9_]+_core\.js/.test(readFileSync(f, "utf8"))) out.push(d.name);
  }
  return out.filter((p) => !ONLY || p === ONLY).sort();
}

async function resultText(page, id = null) {
  // 入力欄のいちばん近くにある計算ボタンを押す（1ページに計算機が複数あるページがある）。無ければ入力イベントだけで再計算する作り
  await page.evaluate((id) => {
    const isCalc = (b) => b.offsetParent !== null && !b.disabled && (/計算|判定|試算|算出|求める|チェック|表示する/.test(b.textContent) || b.id === "calc" || b.classList.contains("primary"))
      && !/保存|覚え|コピー|消す|削除|リセット|クリア|共有/.test(b.textContent);
    let el = id ? document.getElementById(id) : document.querySelector("main");
    while (el && el !== document.body) {
      const b = [...el.querySelectorAll("button")].find(isCalc);
      if (b) { b.click(); return; }
      el = el.parentElement;
    }
  }, id);
  await page.waitForTimeout(150);
  // 答えが結果欄の外に出るページもあるので、本文全体の文字を比べる（入力欄の値そのものは innerText に入らない）
  return page.evaluate(() => (document.querySelector("main")?.innerText ?? "").replace(/\s+/g, " ").trim());
}

// 入力欄ごとの試す値
async function variantsFor(page, id) {
  return page.evaluate((id) => {
    const el = document.getElementById(id);
    if (el.tagName === "SELECT") return [...el.options].map((o) => o.value).filter((v) => v !== el.value).slice(0, 8);
    if (el.type === "checkbox") return ["__toggle__"];
    if (el.type === "date") {
      const base = el.value ? new Date(el.value + "T00:00:00") : new Date("2026-04-01T00:00:00");
      return [-800, -400, 400].map((d) => { const x = new Date(base); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); });
    }
    const v = Number(el.value || 0), min = el.min !== "" ? Number(el.min) : 0, max = el.max !== "" ? Number(el.max) : Math.max(v * 10, 100);
    const c = [min, max, Math.round((min + max) / 2), v * 2, Math.round(v / 2), v + 1, v - 1, 17, 40, 65, 70, 75, 1056000, 1300000, 5000000]
      .filter((x) => Number.isFinite(x) && x >= min && x <= max && x !== v);
    return [...new Set(c)].slice(0, 10).map(String);
  }, id);
}
async function setValue(page, id, v) {
  await page.evaluate(([id, v]) => {
    const el = document.getElementById(id);
    if (v === "__toggle__") el.checked = !el.checked; else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  }, [id, v]);
}

const { chromium } = await browserTools();
const server = await serve();
const browser = await chromium.launch();
const errors = [], checked = [];
try {
  const context = await contextFor(browser, server.origin, 1280);
  for (const p of toolPages()) {
    const page = await context.newPage();
    try {
      await ready(page, `${server.origin}/${p}/`);
      const ids = await page.evaluate(() => [...document.querySelectorAll("main input[id], main select[id]")]
        .filter((e) => !["hidden", "button", "submit", "file", "radio"].includes(e.type) && e.offsetParent !== null && !e.disabled)
        .map((e) => e.id));
      // 空の入力欄（賞与の額など）があると「入力してください」だけが出て何も計算されない。見本の値で埋めてから試す
      await page.evaluate(() => {
        for (const e of document.querySelectorAll("main input[id]")) {
          if (e.offsetParent === null || e.disabled || e.value !== "") continue;
          if (e.type === "date") e.value = "2026-04-01";
          else if (e.type === "number" || e.inputMode === "numeric" || e.inputMode === "decimal") {
            const ph = (e.placeholder || "").replace(/[^0-9.]/g, "");
            e.value = ph && Number(ph) > 0 ? ph : (e.max && Number(e.max) < 300000 ? String(Math.round((Number(e.min || 0) + Number(e.max)) / 2)) : "300000");
          } else continue;
          e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      const base = await resultText(page);
      if (!base) { errors.push(`${p}: 既定値で計算しても結果が空（計算ボタン・結果欄が見つからない）`); continue; }
      for (const id of ids) {
        if (SKIP_ID.test(id) || ALLOW[p]?.[id]) continue;
        const orig = await page.evaluate((id) => { const e = document.getElementById(id); return e.type === "checkbox" ? String(e.checked) : e.value; }, id);
        const baseI = await resultText(page, id);   // その入力欄の計算機で、既定値のときの本文
        let moved = false;
        for (const v of await variantsFor(page, id)) {
          await setValue(page, id, v);
          if ((await resultText(page, id)) !== baseI) { moved = true; break; }
        }
        // 2回目: 他の入力欄と組み合わせたときだけ効く入力欄がある（有給の日数×時間など）。
        //   他の入力欄を1つずつ別の値にした状態で、同じように動かしてみる
        if (!moved) {
          for (const other of ids) {
            if (other === id || SKIP_ID.test(other) || moved) continue;
            const oOrig = await page.evaluate((o) => { const e = document.getElementById(o); return e.type === "checkbox" ? String(e.checked) : e.value; }, other);
            for (const ov of (await variantsFor(page, other)).slice(0, 3)) {
              await setValue(page, other, ov);
              const base2 = await resultText(page, id);
              for (const v of await variantsFor(page, id)) {
                await setValue(page, id, v);
                if ((await resultText(page, id)) !== base2) { moved = true; break; }
              }
              await page.evaluate(([id, o]) => { const e = document.getElementById(id); if (e.type === "checkbox") e.checked = o === "true"; else e.value = o;
                e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, [id, orig]);
              if (moved) break;
            }
            await page.evaluate(([o, v]) => { const e = document.getElementById(o); if (e.type === "checkbox") e.checked = v === "true"; else e.value = v;
              e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, [other, oOrig]);
          }
        }
        // 元に戻す（次の入力欄の判定に影響させない）
        await page.evaluate(([id, o]) => { const e = document.getElementById(id); if (e.type === "checkbox") e.checked = o === "true"; else e.value = o;
          e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, [id, orig]);
        await resultText(page);
        checked.push(`${p}#${id}`);
        if (!moved) errors.push(`${p}: 入力欄 #${id} をどの値に変えても結果が1文字も変わらない（計算に配線されていない疑い。正しいなら tools/input_wiring_allow.json に理由つきで）`);
      }
    } catch (e) { errors.push(`${p}: ${e.message.split("\n")[0]}`); }
    finally { await page.close(); }
  }
} finally { await browser.close(); server.close(); }

for (const [p, m] of Object.entries(ALLOW)) for (const [id, why] of Object.entries(m)) if (!String(why).trim()) errors.push(`${p}#${id}: 許可の理由が空`);
if (errors.length) { console.error(errors.map((e) => "✗ " + e).join("\n") + `\n候補 ${errors.length}件（WIRING_STRICT=1 なら失敗にする）`); process.exit(process.env.WIRING_STRICT ? 1 : 0); }
console.log(`✓ test_input_wiring: ${checked.length}個の入力欄が答えを動かす（許可 ${Object.values(ALLOW).reduce((a, m) => a + Object.keys(m).length, 0)}件は理由つき）`);
