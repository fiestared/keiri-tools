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

/**
 * **計算には使わない**参照データ(表示専用)の明示リスト。
 *
 * 「到着を待ってから計算する」規律が要るのは、そのデータが**答えの一部になる**ときだけ。
 * 表示専用のデータにまで await を強制すると、正しい商品を落とす検査になる
 * (2026-07-13 の第6便・第10便で実際にやった。**検査の期待値の方が壊れている**ことがある)。
 * 例外は握りつぶさず、ここに理由つきで書く。
 */
const PRESENTATION_ONLY = {
  "senpou-futan/index.html":
    "fee_table.json は銀行プリセット(手数料の入力欄を埋める候補)専用。計算は入力欄の値を読むので、" +
    "データが未着でも誤った答えは出ない(入力欄が空なら計算前に弾く)",
};

for (const { p, src, data } of users) {
  const rel = p.slice(DOCS.length);
  const usesHolidays = data.includes("holidays_jp.json");
  const exempt = PRESENTATION_ONLY[rel];

  // 1) データの到着を待ってから計算しているか。
  //    `fetch(...).then(d => DATA = d)` した変数をクリック時にそのまま読むと、
  //    回線が遅いユーザーだけ「データを1行も知らない」状態で答えが出る(開発機では再現しない)。
  //    規約: ready を表すPromiseを `<なにか>Ready` と名付け、計算前に必ず await する。
  if (exempt) {
    console.log(`⏭  ${rel}: 表示専用のため await 免除 — ${exempt}`);
  } else {
    ok(/await\s+\w*[Rr]eady\b/.test(src),
       `${rel}: 計算前にデータを待っている (await …Ready) [${data.join(", ")}]`);
  }

  // 2) 読み込み失敗を黙って通していないか。**これは表示専用でも要る** —
  //    データが来なかったことを利用者に伝えないと、空のプルダウンの理由が分からない。
  ok(/読み込めませんでした/.test(src),
     `${rel}: データを読めなかったときに断り書きを出す`);

  // 3) 参照データには必ず守備範囲がある。知らない年は「知らない」と申告させる。
  //    収録範囲の判定は、ページ内で直接 coverageMaxYear を呼ぶ場合(営業日計算)と、
  //    core側が算出した beyondData を受け取る場合(支払サイト計算)の両方がある。どちらでもよい。
  if (usesHolidays) {
    ok(/概算/.test(src) && /(coverageMaxYear|beyondData)/.test(src),
       `${rel}: 収録範囲を超えた年は「概算」と申告する`);
  }
}

console.log(fails ? `\n❌ ${fails}件 失敗` : "\nall data-page checks passed");
process.exit(fails ? 1 : 0);
