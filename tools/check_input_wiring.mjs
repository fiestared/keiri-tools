// check_input_wiring.mjs — 計算機の入力欄が、本当に答えを動かしているか（誤りの型 D の予防。2026-09-28）。
// ★今は「候補を出す道具」（exit 0）。WIRING_STRICT=1 で関門として動く（候補があれば exit 1）。
//   2026-09-28 の初回実行で候補53件 → 仕分け（gbrain implementation/keiri-input-wiring-triage-2026-09-28）。
// ★なぜ: 記事レビューで、入力させた値を計算に渡していない計算機が見つかった（住民税で年齢を入力させて税額計算に使っていない等）。
//   単体テストは core に値を直接渡すので、**画面の入力欄→core の配線**は検査されない（CLAUDE.md「単体テストの守備範囲」）。
//   gbrain keiri-tools/article-error-patterns の D。
// やり方: 計算機のページ（*_core.js を読むページ）を実ブラウザで開き、入力欄を1つずつ、いくつかの値
//   （半分・倍・1/10・最小・最大・境目、select は全選択肢、checkbox は反転、日付は前後）に変えて計算し直す。
//   **どの値に変えても main の本文が1文字も変わらない入力欄**を候補にする。3段で試す:
//     1) 既定の状態で動かす
//     2) 他の入力欄を1つだけ別の値にした状態で動かす（有給の日数×時間など、組み合わせで効くもの）
//     3) 他の入力欄を全部ばらばらに変えた状態（乱数・種は固定）で動かす（3つの要件が揃ったときだけ効く等）
//   答えを動かさないのが正しい入力欄（表示の切替・法的に同額など）は、
//   tools/input_wiring_allow.json に**理由つきで**書く（規則1: 正しい商品を落とさない）。書き方は2つ:
//     "id": "理由"                               … 検査から外す（どの組み合わせでも答えが変わらないのが正しいとき）
//     "id": { "when": {他の欄: 値}, "why": "理由" } … 特定の組み合わせでだけ効く欄。その組み合わせを置いて
//                                                    **動くことを検査する**（外さない＝配線が切れたら落ちる）。
//   許可は「外す」より「when」を先に考える。外すと、その欄の配線漏れは二度と見つからない。
// 道具の限界として直したこと（2026-09-28 仕分けで判明。どれも誤検知の原因だった）:
//   - タブ（role=tab）の「賞与（算出率の表）」「◯営業日後を計算」を計算ボタンと取り違えて押し、タブを切り替えていた
//   - 「空欄なら概算」の入力欄（社会保険料など）を見本の値で埋めたまま戻さず、概算に使う入力（年齢・都道府県）が死んでいた
//     → 最初に空だった入力欄は「空欄」も試す値に入れる
//   - 上限の無い金額欄（既定 0）の試す値が 0〜100 に縛られ、給与所得控除の内側から出なかった
//   - 日付の試す値が ±2年だけで、制度の境目（1982年・2017年など）を越えなかった
//   - 入力欄を別の入力欄へ書き込む補助ボタン（「正味の遺産額を出して上に入れる」）を押していなかった
//   - 見本の値が placeholder「例: 0」を 300000 に置き換えていた（勤労学生の「勤労によらない所得」が10万円超＝対象外になり全部死ぬ）
//   - 料率（小数の欄）を 300000% で埋め、国保の賦課限度額に張り付いていた → 「記入例を入れる」ボタンがあれば先に押す・小数の欄は 5
//   - 畳まれた <details> の中の計算機（国保の任意継続の比較）を開いていなかった
//   - 空欄で動いた（v === ""）ことを「動かなかった」と数えていた（空文字は偽）
// 検査の範囲を広げたこと: ラジオボタン（name ごとに1つの欄）と、タブで切り替える計算機の他のタブの入力欄も試す
//   （以前はどちらも1つも検査されていなかった）。
// ★Chromium は1つだけ使う（この Mac は並列の撮影で固まった前歴がある）。
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { browserTools, serve, contextFor, ready, DOCS } from "../tests/layout/browser.mjs";

const ALLOW = JSON.parse(readFileSync(new URL("./input_wiring_allow.json", import.meta.url)));
const ONLY = process.env.WIRING_ONLY;   // 1ページだけ見るとき: WIRING_ONLY=juminzei
const DEBUG = !!process.env.WIRING_DEBUG;
const WAIT_MS = Number(process.env.WIRING_WAIT_MS || 50);
const RANDOM_STATES = Number(process.env.WIRING_RANDOM_STATES || 16);
const SKIP_ID = /memo|search|keyword|filter|name|label|copy|share|bookmark|favorite|q$/i;

function toolPages() {
  const out = [];
  for (const d of readdirSync(DOCS, { withFileTypes: true })) {
    if (!d.isDirectory() || ["assets", "embed", "column", "hojokin", "ext", "about"].includes(d.name)) continue;
    const f = join(DOCS, d.name, "index.html");
    if (existsSync(f) && /assets\/[a-z0-9_]+_core\.js/.test(readFileSync(f, "utf8"))) out.push(d.name);
  }
  return out.filter((p) => !ONLY || ONLY.split(",").includes(p)).sort();
}

// 決まった種の乱数（実行ごとに同じ状態を試す＝再現できる）
function rng(seedStr) {
  let a = 0; for (const c of seedStr) a = (a * 31 + c.charCodeAt(0)) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

async function resultText(page, id = null) {
  // 入力欄のいちばん近くにある計算ボタンを押す（1ページに計算機が複数あるページがある）。
  // その手前に「別の入力欄へ書き込む補助ボタン」があれば先に押す（相続税の「正味の遺産額を出して上に入れる」）。
  // 無ければ入力イベントだけで再計算する作り。
  const clicked = await page.evaluate((id) => {
    const main = document.querySelector("main");
    if (!main) return "";
    const bad = (b) => b.offsetParent === null || b.disabled || b.type === "reset"
      || b.getAttribute("role") === "tab" || b.closest('[role="tablist"]')          // タブは計算ボタンではない
      || b.hasAttribute("aria-expanded") || b.hasAttribute("aria-pressed")        // 開閉・切替は押すたびに状態が反転する
      || /保存|覚え|コピー|消す|削除|リセット|クリア|共有|記入例|例を入れ|閉じ|印刷|戻る/.test(b.textContent);
    const isCalc = (b) => /計算|判定|試算|算出|求める|チェック|表示する/.test(b.textContent) || /^calc/i.test(b.id) || b.classList.contains("primary");
    const all = [...main.querySelectorAll("button")].filter((b) => !bad(b));
    let helper = null, calc = null;
    let el = id ? window.__wEl(id) : main;
    while (el && el !== document.body && !calc) {
      const bs = all.filter((b) => el.contains(b));
      calc = bs.find((b) => b.classList.contains("primary") || /^calc/i.test(b.id)) || bs.find(isCalc) || null;
      if (!calc && !helper && bs.length) helper = bs[0];
      el = el.parentElement;
    }
    if (helper) helper.click();
    if (calc) calc.click();
    return [helper, calc].filter(Boolean).map((b) => (b.id || "") + ":" + b.textContent.trim().slice(0, 16)).join(" + ");
  }, id);
  if (DEBUG) console.log("  click", id, "->", clicked);
  // 答えが結果欄の外に出るページもあるので、本文全体の文字を比べる（入力欄の値そのものは innerText に入らない）。
  // 計算は await の後に描かれるので、本文が落ち着く（2回続けて同じ）まで待つ。前の操作の描画が遅れて届くと
  // 「動いた」と誤認して配線漏れを見逃すため、固定の待ち時間にしない
  // innerText はページ全体の再レイアウトを伴い遅い（記事の長いページで1回100ms超）ので textContent で比べる。
  // 結果欄は innerHTML で書き換わるので textContent で足りる（表示/非表示の切替だけの変化は拾わないが、答えの文字は拾う）
  const read = () => page.evaluate(() => (document.querySelector("main")?.textContent ?? "").replace(/\s+/g, " ").trim());
  let prev = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(WAIT_MS);
    const cur = await read();
    if (cur === prev) return cur;
    prev = cur;
  }
  return prev;
}

// 入力欄ごとの試す値（前のほうほど「効きやすい」値。組み合わせの段では先頭の数個だけ使う）
async function variantsFor(page, id) {
  return page.evaluate((id) => {
    const el = window.__wEl(id);
    if (id.startsWith("radio:")) return window.__wRadios(id).filter((r) => !r.checked && !r.disabled).map((r) => r.value).slice(0, 8);
    const blank = el.dataset.wiringBlank === "1";   // 最初は空欄だった（空欄に意味がある入力欄＝「空欄なら概算」など）
    if (el.tagName === "SELECT") return [...el.options].filter((o) => !o.disabled).map((o) => o.value).filter((v) => v !== el.value).slice(0, 8);
    if (el.type === "checkbox") return ["__toggle__"];
    const out = blank && el.value !== "" ? [""] : [];
    if (el.type === "date" || el.type === "month") {
      // ローカル日付で作る（toISOString は UTC なので JST では1日ずれる）
      const base = el.value ? new Date((el.type === "month" ? el.value + "-01" : el.value) + "T00:00:00") : new Date("2026-04-01T00:00:00");
      const fmt = (x) => { const y = x.getFullYear(), m = String(x.getMonth() + 1).padStart(2, "0"), d = String(x.getDate()).padStart(2, "0");
        return el.type === "month" ? `${y}-${m}` : `${y}-${m}-${d}`; };
      // 前後1日（境目）・1〜3か月（「6月1日〜7月1日に取得」のような年内の窓）・1年超・10年・50年（1982年などの制度の境目）
      const days = [-400, 400, -3650, -18250, -1, 1, 61, 30, 91, -30, -61, -182, 3650];
      const c = days.map((d) => { const x = new Date(base); x.setDate(x.getDate() + d); return fmt(x); })
        .filter((v) => v !== el.value && (!el.min || v >= el.min) && (!el.max || v <= el.max));
      return [...out, ...new Set(c)].slice(0, 14);
    }
    const v = Number(el.value || 0);
    const min = el.min !== "" ? Number(el.min) : 0, max = el.max !== "" ? Number(el.max) : Infinity;
    const step = el.step && el.step !== "any" ? Number(el.step) : 0;
    const snap = (x) => step >= 1 ? Math.round(x / step) * step : x;
    const c = [v / 2, v * 2, v / 10, v * 10, min, max, (min + (Number.isFinite(max) ? max : v * 4)) / 2, 5000000, 30000000, 1000,
      1056000, 1300000, 17, 40, 65, 70, 75, v + 1, v - 1, 1, 2, 3]
      .map((x) => snap(Number.isInteger(v) ? Math.round(x) : x))
      .filter((x) => Number.isFinite(x) && x >= min && x <= max && x !== v);
    return [...out, ...[...new Set(c)].map(String)].slice(0, 16);
  }, id);
}
async function setValue(page, id, v) {
  await page.evaluate(([id, v]) => {
    if (id.startsWith("radio:")) {
      const r = window.__wRadios(id).find((r) => r.value === v);
      if (r) { r.checked = true; r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); r.dispatchEvent(new Event("click", { bubbles: true })); }
      window.__wFill();
      return;
    }
    const el = document.getElementById(id);
    if (!el) return;
    if (v === "__toggle__") el.checked = !el.checked; else if (el.type === "checkbox") el.checked = v === "true"; else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
    window.__wFill();
  }, [id, v]);
}
const getValue = (page, id) => page.evaluate((id) => {
  if (id.startsWith("radio:")) return window.__wRadios(id).find((r) => r.checked)?.value ?? "";
  const e = document.getElementById(id); return e.type === "checkbox" ? String(e.checked) : e.value; }, id);
async function getState(page, ids) { const s = {}; for (const i of ids) s[i] = await getValue(page, i); return s; }
// 状態を戻す（値が違う欄だけ書き戻す＝余計なイベントを撃たない）
async function setState(page, s) {
  const diff = await page.evaluate((s) => Object.entries(s).filter(([id, v]) => {
    if (id.startsWith("radio:")) return (window.__wRadios(id).find((r) => r.checked)?.value ?? "") !== v;
    const e = document.getElementById(id); return (e.type === "checkbox" ? String(e.checked) : e.value) !== v;
  }), s);
  for (const [i, v] of diff) await setValue(page, i, v);
}

// その状態から id を動かして、本文が変わるか
async function movesFrom(page, id, limit = 99) {
  const base = await resultText(page, id);
  for (const v of (await variantsFor(page, id)).slice(0, limit)) {
    await setValue(page, id, v);
    if ((await resultText(page, id)) !== base) return { v };   // v が "" (空欄) でも「動いた」と分かるように包む
  }
  return null;
}

const { chromium } = await browserTools();
const server = await serve();
const browser = await chromium.launch();
const errors = [], checked = [];
try {
  const context = await contextFor(browser, server.origin, 1280);
  await context.addInitScript(() => {
    window.__wRadios = (id) => [...document.querySelectorAll('main input[type="radio"]')].filter((r) => "radio:" + r.name === id);
    window.__wEl = (id) => id.startsWith("radio:") ? window.__wRadios(id)[0] : document.getElementById(id);
    // 空の入力欄を見本の値で埋める（一度埋めた欄＝data-wiring-blank は二度と埋めない。試す値の「空欄」を潰さないため）。
    //   チェックで後から現れる入力欄（地震保険の「両方に当てはまる契約」の金額など）も、現れたときに埋める
    window.__wFill = () => {
      for (const e of document.querySelectorAll("main input[id]")) {
        if (e.offsetParent === null || e.disabled || e.value !== "" || e.dataset.wiringBlank === "1") continue;
        if (e.type === "date") e.value = "2026-04-01";
        else if (e.type === "number" || e.inputMode === "numeric" || e.inputMode === "decimal") {
          const ph = (e.placeholder || "").replace(/[^0-9.]/g, "");
          // 小数の欄（料率％など）に 300000 を入れると上限に張り付くので、小数の欄は 5 にする
          const decimal = e.inputMode === "decimal" || (e.step && e.step !== "any" && Number(e.step) < 1);
          // 見本の値は placeholder（「例: 0」なら 0。0 を 300000 に置き換えると、勤労学生の「勤労によらない所得」が
          //   10万円を超えて対象外になり、他の入力欄が全部死ぬ）
          e.value = ph !== "" && Number.isFinite(Number(ph)) ? ph : (e.max && Number(e.max) < 300000 ? String(Math.round((Number(e.min || 0) + Number(e.max)) / 2)) : decimal ? "5" : "300000");
        } else continue;
        e.dataset.wiringBlank = "1";
        e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
  });
  for (const p of toolPages()) {
    const page = await context.newPage();
    page.on("dialog", (d) => d.dismiss().catch(() => {}));
    try {
      await ready(page, `${server.origin}/${p}/`);
      // 畳まれた <details> の中の計算機（国保の「任意継続と比べる」等）は、開かないと結果が innerText に出ない。全部開く。
      // 「記入例を入れる」ボタンがあるページは、まずそれを押す（空欄の料率を架空の大きな値で埋めると上限に張り付いて何も動かなくなる）
      await page.evaluate(() => {
        for (const d of document.querySelectorAll("main details")) d.open = true;
        for (const b of document.querySelectorAll("main button")) if (b.offsetParent !== null && /記入例|例を入れ/.test(b.textContent)) b.click();
      });
      await page.waitForTimeout(200);
      // タブで切り替える計算機（源泉徴収の 給与／賞与／報酬 など）は、タブごとに見える入力欄を試す。
      //   以前は既定のタブの入力欄しか試しておらず、他のタブの入力欄は1つも検査されていなかった
      const tabs = await page.evaluate(() => [...document.querySelectorAll('main [role="tab"]')].filter((t) => t.offsetParent !== null && t.id).map((t) => t.id));
      const seen = new Set();
      for (const tab of [null, ...tabs]) {
        if (tab) { await page.evaluate((t) => document.getElementById(t).click(), tab); await page.waitForTimeout(150); }
        const ids = (await page.evaluate(() => [...document.querySelectorAll("main input[id], main select[id]")]
          .filter((e) => !["hidden", "button", "submit", "file", "radio"].includes(e.type) && e.offsetParent !== null && !e.disabled)
          .map((e) => e.id)
          // ラジオボタンは name ごとに1つの入力欄として扱う（「radio:<name>」）。性別・婚姻歴などの要件がラジオで来るページがある
          .concat([...new Set([...document.querySelectorAll('main input[type="radio"][name]')]
            .filter((e) => e.offsetParent !== null && !e.disabled).map((e) => "radio:" + e.name))])))
          .filter((i, k, all) => !seen.has(i) && all.indexOf(i) === k);
        ids.forEach((i) => seen.add(i));
        if (!ids.length) continue;
        // 空の入力欄（賞与の額など）があると「入力してください」だけが出て何も計算されない。見本の値で埋めてから試す。
        // ★埋めた欄には印を付け、「空欄」も試す値に入れる（空欄＝「年収から概算する」の意味を持つ欄がある）
        await page.evaluate(() => window.__wFill());
        const base = await resultText(page);
        if (!base) { errors.push(`${p}${tab ? "（タブ " + tab + "）" : ""}: 既定値で計算しても結果が空（計算ボタン・結果欄が見つからない）`); continue; }
        const init = await getState(page, ids);
        const kind = await page.evaluate((ids) => ids.map((i) => { const e = window.__wEl(i);
          return i.startsWith("radio:") || e.tagName === "SELECT" || e.type === "checkbox" ? 1 : e.dataset.wiringBlank === "1" ? 0 : 2; }), ids);
        const order = ids.map((i, k) => [i, kind[k]]).sort((a, b) => a[1] - b[1]).map(([i]) => i);
        for (const id of ids) {
          if (SKIP_ID.test(id)) continue;
          const allow = ALLOW[p]?.[id];
          if (typeof allow === "string") continue;   // 答えを動かさないのが正しい（理由つき）
          let how = null;
          if (allow?.when) {
            // 特定の組み合わせでだけ効く入力欄: その組み合わせ（when）を置いて、そこで動くことを確かめる（配線の検査は残す）
            for (const [o, v] of Object.entries(allow.when)) await setValue(page, o, v);
            if (await movesFrom(page, id)) how = "when " + JSON.stringify(allow.when);
            await setState(page, init);
            if (!how) errors.push(`${p}: 入力欄 #${id} が、許可リストの組み合わせ（when）でも結果を動かさない（配線が切れたか、when が古い）`);
            checked.push(`${p}#${id}`);
            if (DEBUG) console.log(`${p}#${id}: ${how ? "動く（" + how + "）" : "動かない"}`);
            continue;
          }
          // 1) 既定の状態で
          if (await movesFrom(page, id)) how = "既定";
          await setState(page, init);
          // 2) 他の入力欄を1つだけ別の値にして（効きやすい順: 最初は空欄だった欄 → 選択肢・チェック → 数値）
          for (const other of order) {
            if (how || other === id || SKIP_ID.test(other)) continue;
            for (const ov of (await variantsFor(page, other)).slice(0, 3)) {
              await setValue(page, other, ov);
              if (await movesFrom(page, id, 8)) { how = `${other}=${ov}`; break; }
              await setState(page, init);
            }
            await setState(page, init);
          }
          // 3) 他の入力欄を全部ばらばらに変えて（種は ページ#id で固定）
          const rand = rng(`${p}#${id}`);
          for (let k = 0; k < RANDOM_STATES && !how; k++) {
            const st = {};
            for (const other of ids) {
              if (other === id || SKIP_ID.test(other)) continue;
              const vs = await variantsFor(page, other);
              // 最初は空欄だった欄は半分の確率で空欄に戻す（「空欄なら概算」の分岐に入れる）
              const blankFirst = vs[0] === "" && rand() < 0.5;
              if ((blankFirst || rand() < 0.5) && vs.length) { st[other] = blankFirst ? "" : vs[Math.floor(rand() * vs.length)]; await setValue(page, other, st[other]); }
            }
            if (await movesFrom(page, id, 8)) how = "乱数 " + JSON.stringify(st);
            await setState(page, init);
          }
          await setState(page, init);
          await resultText(page);
          checked.push(`${p}#${id}`);
          if (DEBUG) console.log(`${p}#${id}: ${how ? "動く（" + how + "）" : "動かない"}`);
          if (!how) errors.push(`${p}: 入力欄 #${id} をどの値に変えても結果が1文字も変わらない（計算に配線されていない疑い。正しいなら tools/input_wiring_allow.json に理由つきで）`);
        }
      }
      // 許可したのに、もう画面に無い入力欄（許可の腐り）
      for (const id of Object.keys(ALLOW[p] || {})) if (!seen.has(id)) errors.push(`${p}#${id}: 許可リストにあるが画面に見える入力欄として存在しない（許可を消す）`);
    } catch (e) { errors.push(`${p}: ${e.message.split("\n")[0]}`); }
    finally { await page.close(); }
  }
} finally { await browser.close(); server.close(); }

for (const [p, m] of Object.entries(ALLOW)) for (const [id, a] of Object.entries(m)) if (String(typeof a === "string" ? a : a?.why ?? "").trim().length < 20) errors.push(`${p}#${id}: 許可の理由が空か短すぎる`);
if (errors.length) { console.error(errors.map((e) => "✗ " + e).join("\n") + `\n候補 ${errors.length}件（WIRING_STRICT=1 なら失敗にする）`); process.exit(process.env.WIRING_STRICT ? 1 : 0); }
const tested = Object.entries(ALLOW).filter(([p]) => toolPages().includes(p)).map(([, m]) => Object.values(m));
const nAllow = tested.reduce((a, v) => a + v.filter((x) => typeof x === "string").length, 0);
const nWhen = tested.reduce((a, v) => a + v.filter((x) => typeof x !== "string").length, 0);
console.log(`✓ check_input_wiring: ${checked.length}個の入力欄が答えを動かす（うち組み合わせ指定 ${nWhen}件）。動かないのが正しい ${nAllow}件は理由つきで除外`);
