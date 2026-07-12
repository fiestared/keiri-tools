/**
 * 祝日データを使うページの構造チェック(再発防止・Chrome不要)。
 *
 * この検査がある理由: 「fetchした祝日データの到着を待たずに計算する」バグを
 * 2026-07-13 に**2回**出した(支払サイト計算 f03bdcf → 営業日計算)。
 * 2回目は、同じ教訓が CLAUDE.md に散文で書いてあるのに再発している。
 * 散文の注意書きは守られないので、機械が落とす形にする。
 *
 * E2E(tools/e2e)でも捕まえられるが、あちらはヘッドレスChromeが要る。
 * こちらは `node tests/test_holiday_pages.mjs` だけで走り、新しいツールを足した瞬間に落ちる。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;
let fails = 0;
const ok = (c, msg) => { console.log(`${c ? "✅" : "❌"} ${msg}`); if (!c) fails++; };

/** docs/ 配下の index.html を全部集める */
function pages(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (e === "index.html") out.push(p);
  }
  return out;
}

const users = pages(DOCS)
  .map((p) => ({ p, src: readFileSync(p, "utf8") }))
  .filter(({ src }) => src.includes("holidays_jp.json"));

ok(users.length >= 2, `祝日データを使うページを検出: ${users.length}件`);

for (const { p, src } of users) {
  const rel = p.slice(DOCS.length);

  // 1) 祝日データの到着を待ってから計算しているか。
  //    `fetch(...).then(d => H = d)` した変数をクリック時にそのまま読むと、
  //    回線が遅いユーザーだけ「祝日を1日も知らない」状態で答えが出る(開発機では再現しない)。
  ok(/await\s+holidaysReady/.test(src),
     `${rel}: 計算前に祝日データを待っている (await holidaysReady)`);

  // 2) 読み込み失敗・収録範囲外を黙って通していないか。
  //    参照データには必ず守備範囲がある。知らない年は「知らない」と申告させる。
  ok(/読み込めませんでした/.test(src),
     `${rel}: 祝日データを読めなかったときに断り書きを出す`);
  // 収録範囲の判定は、ページ内で直接 coverageMaxYear を呼ぶ場合(営業日計算)と、
  // core側が算出した beyondData を受け取る場合(支払サイト計算)の両方がある。どちらでもよい。
  ok(/概算/.test(src) && /(coverageMaxYear|beyondData)/.test(src),
     `${rel}: 収録範囲を超えた年は「概算」と申告する`);
}

console.log(fails ? `\n❌ ${fails}件 失敗` : "\nall holiday-page checks passed");
process.exit(fails ? 1 : 0);
