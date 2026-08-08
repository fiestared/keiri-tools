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
//
// ★★2026-07-31: **fetch() の引数そのものを見る形にも同じ穴があった**。
//   `const load = (path) => fetch(path).then(...)` という**取得を1行のヘルパーに畳んだ書き方**
//   だと、`fetch("../assets/x.json")` という文字列は**どこにも現れない**。
//   この形のページが本番に**6本**あり(chukai-tesuryo / hikazei-setai / iryubun / seizen-zoyo /
//   shokibo-takuchi / sozoku-toki-menkyozei)、**全部この検査の外側にいた**。
//   壊しテスト(tests/break_izoku_page.mjs)で「await を外す」壊しが素通しして発覚した。
//   ＝ 検査は緑だったが、守っていたつもりのページを1行も見ていなかった。
//   → **呼び出しの形ではなく「assets配下のJSONのパスを持っていて、fetchを使うページ」**で拾う。
//     ヘルパーに畳もうが、変数に入れようが、パス文字列はページのどこかに必ず在る。
const ASSET_JSON = /["'][^"']*assets\/([\w.-]+\.json)["']/g;
const users = pages(DOCS)
  .map((p) => ({ p, src: readFileSync(p, "utf8") }))
  .map(({ p, src }) => ({ p, src, data: [...new Set([...src.matchAll(ASSET_JSON)].map((m) => m[1]))] }))
  .filter(({ src, data }) => data.length > 0 && /\bfetch\s*\(/.test(src));

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
    // ★★2026-08-08: 「どこかに1つでも await …Ready があれば合格」に穴があった。
    //   **1ページが複数の参照データを読む場合、片方の待ちを壊しても素通しする。**
    //   /kokuho/ に任意継続の比較を足して `await shahoReady` が増えた結果、
    //   本来の `await dataReady` を壊しても緑のままになり、
    //   break_kokuho_page が「素通し」と報告して発覚した（＝壊しテストが検査の劣化を捕まえた）。
    //   → **fetch から作った Promise のすべてが await されていること**を名前ごとに見る。
    // ★`const ready = await dataReady;` の左辺は「待った結果」であって Promise ではない。
    //   除外の先読みは `=(?!\s*await\b)` の形で書く。`=\s*(?!await\b)` だと `\s*` が
    //   ゼロ幅に戻って ` await` を通してしまい、79ページが誤って落ちる（実際にやった）。
    const declared = [...src.matchAll(/const\s+(\w*[Rr]eady)\s*=(?!\s*await\b)/g)].map((m) => m[1]);
    ok(declared.length > 0,
       `${rel}: ready を表す Promise（<なにか>Ready）が宣言されていない [${data.join(", ")}]`);
    // ★待ち方は `await x` だけではない。`await Promise.all([a, b])` も正しい待ち方。
    //   名前だけで見ると gensen-choshu（2つのデータを Promise.all で待つ）を誤って落とす
    //   （2026-08-08 に実際に誤検出した。**検査の期待値の方が壊れている**ことがある）。
    const awaitedInAll = new Set(
      [...src.matchAll(/await\s+Promise\.all\s*\(\s*\[([^\]]*)\]/g)]
        .flatMap((m) => m[1].split(',').map((s) => s.trim())),
    );
    const notAwaited = declared.filter((n) =>
      !new RegExp(`await\\s+${n}\\b`).test(src) && !awaitedInAll.has(n));
    ok(notAwaited.length === 0,
       `${rel}: 宣言した ${notAwaited.join(", ")} を計算前に await していない`
       + `（回線が遅い人だけがそのデータを知らないまま答えを見る）[${data.join(", ")}]`);
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
