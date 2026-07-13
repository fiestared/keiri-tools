/**
 * **fetchした参照データを使う全ページ**の構造チェック(再発防止・Chrome不要)。
 *
 * この検査がある理由: 「fetchしたデータの到着を待たずに計算する」バグを
 * 2026-07-13 に**2回**出した(支払サイト計算 f03bdcf → 営業日計算)。
 * 2回目は、同じ教訓が CLAUDE.md に散文で書いてあるのに再発している。
 * 散文の注意書きは守られないので、機械が落とす形にする。
 *
 * **当初は祝日データを使うページだけを見ていた**(test_holiday_pages.mjs)。
 * しかし源泉徴収の月額表(gensen_getsugaku_r08.json)を足したとき、同じ失敗モードなのに
 * **ファイル名で絞っていたせいで新ページは検査対象外**だった。データファイルの名前ではなく
 * **「assets配下のJSONをfetchしている」という形**で拾う。新しい参照データを足した瞬間に落ちる。
 *
 * E2E(tools/e2e)でも捕まえられるが、あちらはヘッドレスChromeが要る。
 * こちらは `node tests/test_data_pages.mjs` だけで走る。
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

// assets配下のJSONをfetchしているページ = 「非同期で届く参照データ」を使うページ。
// データファイル名では絞らない(絞ると新しい参照データが検査から漏れる。実際に漏れた)。
const FETCH_JSON = /fetch\(\s*["'][^"']*assets\/([\w.-]+\.json)["']/g;
const users = pages(DOCS)
  .map((p) => ({ p, src: readFileSync(p, "utf8") }))
  .map(({ p, src }) => ({ p, src, data: [...src.matchAll(FETCH_JSON)].map((m) => m[1]) }))
  .filter(({ data }) => data.length > 0);

ok(users.length >= 3, `参照データを使うページを検出: ${users.length}件`);

for (const { p, src, data } of users) {
  const rel = p.slice(DOCS.length);
  const usesHolidays = data.includes("holidays_jp.json");

  // 1) データの到着を待ってから計算しているか。
  //    `fetch(...).then(d => DATA = d)` した変数をクリック時にそのまま読むと、
  //    回線が遅いユーザーだけ「データを1行も知らない」状態で答えが出る(開発機では再現しない)。
  //    規約: ready を表すPromiseを `<なにか>Ready` と名付け、計算前に必ず await する。
  ok(/await\s+\w*[Rr]eady\b/.test(src),
     `${rel}: 計算前にデータを待っている (await …Ready) [${data.join(", ")}]`);

  // 2) 読み込み失敗を黙って通していないか。データが無いまま「0円」と答えるのが最悪。
  ok(/読み込めませんでした/.test(src),
     `${rel}: データを読めなかったときに断り書きを出す`);

  // 3) 参照データには必ず守備範囲がある。知らないものは「知らない」と申告させる。
  if (usesHolidays) {
    // 収録範囲の判定は、ページ内で直接 coverageMaxYear を呼ぶ場合(営業日計算)と、
    // core側が算出した beyondData を受け取る場合(支払サイト計算)の両方がある。どちらでもよい。
    ok(/概算/.test(src) && /(coverageMaxYear|beyondData)/.test(src),
       `${rel}: 収録範囲を超えた年は「概算」と申告する`);
  } else {
    // 年度版のあるデータ(税額表・保険料率など)は、**どの年分を引いたのかをデータ自身から**
    // 表示すること。画面に「令和8年分」と手で書くと、データを差し替えた年に嘘になる。
    ok(/\.year\b/.test(src),
       `${rel}: どの年分のデータを引いたかをデータ自身から表示する (…​.year)`);
  }
}

console.log(fails ? `\n❌ ${fails}件 失敗` : "\nall data-page checks passed");
process.exit(fails ? 1 : 0);
