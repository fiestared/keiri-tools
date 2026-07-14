// e2e.mjs — 公開中の3ツールをヘッドレスChromeで実際に操作する結合テスト。
//   node tools/e2e/e2e.mjs            全シーン
//   E2E_ONLY=payday_slow node ...     1シーンだけ
//
// tests/*.mjs が見ているのは assets/*_core.js の純ロジックだけで、ページ内の
// <script type="module">(入力の読み取り・fetchの適用・描画)は無検査だった。ここを埋める。
//
// payday_slow は「祝日JSONの配信を800ms遅らせて、届く前に計算ボタンを押す」シーン。
// モバイル回線で開いてすぐ押したユーザーの再現で、実際にこれで**祝日が無視された支払日**が
// 出ていた(2026-07-13に発見・修正)。回線の速さに結果が左右されないことを固定する。

import { createServer } from "node:http";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const SCENES = [
  { name: "senpou_preset", expect: (s) =>
      s.filled.under === s.expectFilled.under && s.filled.over === s.expectFilled.over &&
      s.result.includes(s.expectTransfer) },
  { name: "senpou_disagree", expect: (s) =>
      /方式によって差引額が変わります/.test(s.result) &&
      /据置型/.test(s.result) && /未満手数料加算型/.test(s.result) && /以上手数料加算型/.test(s.result) },
  { name: "senpou_check", expect: (s) => /550 円/.test(s.result) && /先方負担/.test(s.result) },
  { name: "zengin", expect: (s) =>
      /ｶ\)ﾔﾏﾀﾞ/.test(s.out) && s.injectedImg === 0 && !s.pwned && s.copyShown },
  // 未変換の行が黙ってクリップボード(=総合振込ファイル)へ流れないこと
  { name: "zengin_ng_copy", expect: (s) =>
      s.blocked && /組戻し/.test(s.errText) &&
      s.forcedLines === 3 && /山田商店/.test(s.forced) },
  // 支払予定日が銀行休業日に落ちていたら不合格。ツールの存在意義そのもの
  { name: "payday", expect: (s) => s.rows === 12 && s.onHoliday.length === 0 && !s.warn },
  { name: "payday_slow", slow: true,
    expect: (s) => s.rows === 12 && s.onHoliday.length === 0 && !s.warn },
  // 祝日データが読めない/古いときに「黙って答える」のではなく、断り書きを出すこと
  { name: "payday_nodata", holidays: "404",
    expect: (s) => s.rows === 12 && s.noteText.includes("読み込めませんでした") },
  { name: "payday_stale", holidays: "stale", // 2025年までしか収録が無い状態を再現
    expect: (s) => s.rows === 12 && s.beyondRows === 12 && /2026年以降の祝日/.test(s.noteText) },

  // 営業日計算。営業日数が独立実装と一致すること = 祝日がちゃんと効いていること。
  { name: "eigyobi", expect: (s) => s.business === s.expected.business && !s.warn && !s.beyond },
  // 祝日JSONが届く前にボタンを押されても、待って正しく数えること(遅い回線のユーザー)
  { name: "eigyobi_slow", slow: true,
    expect: (s) => s.business === s.expected.business && !s.warn && !s.beyond },
  // 読めなかったら黙って土日だけで答えず、断り書きを出すこと
  { name: "eigyobi_nodata", holidays: "404", expect: (s) => s.warn },
  // 収録範囲外の年(2028)は「概算」と申告すること。黙って断言しない
  { name: "eigyobi_beyond", expect: (s) => s.beyond },

  // 有給: 月末入社。応当日が無い月は末日(民法143条2項)。繰り越すと法定より遅い付与日になる
  { name: "yukyu_monthend", expect: (s) =>
      s.showsLegal && !s.showsCarried && s.clampNote },
  { name: "yukyu_monthend_leap", expect: (s) =>
      s.showsLegal && !s.showsCarried && s.clampNote },
  { name: "yukyu_normal", expect: (s) =>
      s.showsLegal && !s.showsCarried && !s.clampNote },

  // 消費税: 国税庁Q&A問57の記載例(税込10万・8%と10%混在)を画面が再現すること
  { name: "shohizei_invoice", expect: (s) =>
      s.expected.total === 8416 && s.showsStd && s.showsRed && s.showsTotal },
  // 明細ごとの端数処理(認められない方法)との差を、黙って飲み込まず警告すること
  { name: "shohizei_perline", expect: (s) =>
      s.correct === 105 && s.perLine === 100 && s.showsCorrect && s.warns },
  // 税込99円 = 真の税額がちょうど9円。素朴な浮動小数点実装なら8円になる常設プローブ
  { name: "shohizei_convert_99", expect: (s) =>
      s.expectedTax === 9 && s.taxOk && s.reconciles && s.anchorOk },
  { name: "shohizei_convert_incl", expect: (s) => s.taxOk && s.reconciles && s.anchorOk },
  { name: "shohizei_convert_excl", expect: (s) => s.taxOk && s.reconciles && s.anchorOk },
  // 申告(割戻し/積上げ)。納付税額はハーネス側の独立オラクルと照合し、
  // 認められない組み合わせ(売上=積上げ×仕入=割戻し)を画面に出さないことを固定する
  { name: "shohizei_shinkoku", expect: (s) =>
      s.national === s.want.national && s.local === s.want.local && s.total === s.want.total &&
      s.total === 500000 && !s.offersForbidden && s.showsThree && s.explainsForbidden },
  // 積上げ用の入力が空のとき、0円として計算して積上げを不当に有利に見せないこと
  { name: "shohizei_shinkoku_noinv", expect: (s) => s.declaresSkip && s.positive },

  // 給与の源泉徴収: 額は**ハーネス側が生の月額表を独立に引いた値**と一致すること。
  // どの年分の表を引いたのかを画面に出していること(来年の表に差し替えたら文言も追随する)
  { name: "gensen_kyuyo", expect: (s) =>
      s.tax === s.expected && s.tax > 0 && s.showsYear && !s.failed },
  // 表の到着を待たずに押しても、待って正しい額を出すこと(0円と答えない)
  { name: "gensen_kyuyo_slow", slow: true, expect: (s) =>
      s.tax === s.expected && s.tax > 0 && !s.failed },
  // 表を配信できないときは、額を出さずに「読み込めませんでした」と申告すること。
  // 税額表を引けないまま税額を断言するのが、このツールで最悪の壊れ方
  { name: "gensen_kyuyo_nodata", data404: "gensen_getsugaku_r08.json",
    expect: (s) => s.failed && s.tax === null },
  // 乙欄は同じ給与額でも甲欄よりかなり高い。欄の取り違えを固定する
  { name: "gensen_kyuyo_otsu", expect: (s) => s.tax === s.expected && s.tax > 0 },

  // 賞与: 額は**ハーネス側が生の算出率の表を独立に引いた値**と一致すること。
  // 国税庁の使用例(554,000円/前月196,616円/扶養2人 → 2.042% → 9,564円)をそのまま流す
  { name: "gensen_shoyo", expect: (s) =>
      s.tax === s.expected && s.tax === 9564 && s.showsYear && !s.failed },
  // 表の到着を待たずに押しても、待って正しい額を出すこと(0円と答えない)
  { name: "gensen_shoyo_slow", slow: true, expect: (s) =>
      s.tax === s.expected && s.tax === 9564 && !s.failed },
  // 算出率の表を配信できないときは、額を出さずに「読み込めませんでした」と申告すること
  { name: "gensen_shoyo_nodata", data404: "gensen_shoyo_r08.json",
    expect: (s) => s.failed && s.tax === null },
  // 前月給与の10倍超は算出率の表を使ってはいけない(備考4)。月額表による額を出し、
  // かつ「表を使えない」と画面で申告すること。率で答えると黙って誤答になる
  { name: "gensen_shoyo_10x", expect: (s) =>
      s.viaGetsugaku && s.tax === s.expected && s.tax > 0 && s.declaresGetsugaku },
  // 乙欄は扶養親族等の数を見ず、前月給与だけで率が決まる
  { name: "gensen_shoyo_otsu", expect: (s) => s.tax === s.expected && s.tax > 0 },

  // 社会保険料(需要最大の看板ツール。2026-07-13 第14便までE2Eが1つも無かった)。
  // 期待値は協会けんぽの**公式保険料額表**(PDF機械抽出)。ツールのコードを通っていない独立オラクル
  // 40歳未満は介護保険料の**行が出ない**こと(否定文「かかりません」は本文に出るので、
  // 判定は本文の正規表現でなく結果テーブルの行ラベルで見る)。どの年度の料率かも申告すること
  // 42,570(公式額表) + 1,500(雇用保険 300,000×5/1000) = 44,070
  { name: "shaho", expect: (s) =>
      s.self === s.expected && s.self === 44070 && !s.failed &&
      !s.showsKaigoRow && s.showsKoyouRow && s.showsYear },
  // 料率の到着を待たずに押しても、待って正しい額を出すこと
  { name: "shaho_slow", slow: true, expect: (s) =>
      s.self === s.expected && s.self === 44070 && !s.failed },
  // 料率を配信できないときは、額を出さずに「読み込めませんでした」と申告すること
  { name: "shaho_nodata", data404: "shaho_rates_r08.json",
    expect: (s) => s.failed && s.self === null },
  // 40〜64歳は介護保険料がかかる。合算料率で控除するのが公式額表と同じ方式
  // 45,000 + 1,500 = 46,500
  { name: "shaho_kaigo", expect: (s) =>
      s.self === s.expected && s.self === 46500 && s.showsKaigoRow && !s.failed },
  // ★雇用保険は標準報酬月額でなく**賃金総額**にかかる。報酬月額305,000は等級としては
  //   300,000(第22級)なので健保・厚年は据え置きだが、雇用保険だけは 305,000×5/1000 = 1,525円。
  //   ページが標準報酬月額を渡していれば1,500円になり 44,070 に落ちて**ここで捕まる**
  //   (coreの単体テストは全部緑のままなので、この検査でしか捕まらない)
  { name: "shaho_koyou_gaku", expect: (s) =>
      s.self === s.expected && s.self === 44095 && s.expectedKoyou === 1525 &&
      s.showsKoyouRow && !s.failed },
  // 業種を建設にすると本人6/1000 → 300,000×6/1000 = 1,800円。42,570 + 1,800 = 44,370
  { name: "shaho_koyou_kensetsu", expect: (s) =>
      s.self === s.expected && s.self === 44370 && s.expectedKoyou === 1800 &&
      s.showsKoyouRow && !s.failed },

  // ── 失業保険(基本手当) ──────────────────────────────────────────────────
  // 35歳・月30万・勤続12年・自己都合 → 賃金日額10,000円 → 日額6,207円 × 120日 = 744,840円
  { name: "kihonteate", expect: (s) =>
      s.daily === s.expectedDaily && s.daily === 6207 && s.days === 120 &&
      s.total === 6207 * 120 && s.showsRestriction && !s.failed },
  // ★離職理由で変わるのは**日数と給付制限だけ**。日額は1円も変わらない
  { name: "kihonteate_kaisha", expect: (s) =>
      s.daily === s.expectedDaily && s.daily === 6207 && s.days === 240 &&
      s.total === 6207 * 240 && s.showsNoRestriction && !s.failed },
  // 上限額が配信できないときは、額を出さずに断る(fail closed)
  { name: "kihonteate_nodata", data404: "kihonteate_r07.json",
    expect: (s) => s.failed && s.daily === null && s.total === null },

  // ── 退職金の税金(退職所得) ──────────────────────────────────────────────
  // ★期待値は**国税庁 No.2732 の計算例(実額)**。退職金800万円・勤続10年2か月 → 91,890円。
  //   控除440万・1年未満切上げ(11年)・1/2・千円未満切捨・超過累進・102.1%の**どれか1つでも
  //   間違っていたら、この額にはならない**。住民税は地税328条の3/50条の4から独立に計算。
  { name: "taishoku", expect: (s) =>
      s.kojo === 4400000 && s.taxable === 1800000 &&
      s.incomeTax === 91890 &&                       // ← 国税庁が公表している実額
      s.juminzei === 180000 &&                       // ← 180万×6% + 180万×4%
      s.tedori === 8000000 - 91890 - 180000 && !s.failed },
  // ★看板の主張が画面に出ているか: 勤続20年0か月なら「あと1か月で91,155円安くなる」
  { name: "taishoku_kiriage", expect: (s) =>
      s.kojo === 8000000 && s.taxable === 3500000 && s.showsOneMonth && !s.failed },
  // ★特定役員(役員等5年以下)は1/2が効かない → 課税退職所得は400万でなく800万になる
  { name: "taishoku_yakuin", expect: (s) =>
      s.kojo === 2000000 && s.taxable === 8000000 && !s.failed },
  // 税率表が配信できないときは、額を出さずに断る(fail closed)
  { name: "taishoku_nodata", data404: "taishoku_rates_r08.json",
    expect: (s) => s.failed && s.taxable === null && s.tedori === null },

  // ── 残業代(割増賃金) ────────────────────────────────────────────────
  // ★期待値は**神奈川労働局が実額で公表している計算例**(1,500円×1.5＝2,250円)。
  //   同じ1時間を「時間外」と「深夜」に重ねて数え、深夜は**上乗せ25%だけ**を足す ──
  //   この設計が正しいことを、労働局の公表額が裏書きしている(125%で足していたら3,750円)。
  { name: "zangyodai", expect: (s) =>
      s.hourlyRate === 1500 && s.total === 2250 && !s.failed },
  // ★1か月60時間超の50%(2023年4月から中小企業も)。画面が率の変化を名指しすること
  { name: "zangyodai_over60", expect: (s) =>
      s.total === 137755 + 27551 && s.showsOver60 && s.shows50pct && !s.failed },
  // ★固定残業代を超えた差額。この計算機のいちばん実利のある答え
  { name: "zangyodai_fixed", expect: (s) => s.total === 45918 && s.showsShortfall && !s.failed },
  // 割増率が配信できないときは、額を出さずに断る(fail closed)
  { name: "zangyodai_nodata", data404: "zangyodai_rates.json",
    expect: (s) => s.failed && s.total === null },

  // ── ふるさと納税 限度額 ──────────────────────────────────────────────
  // ★期待値は条文から手で積み上げた実額(harness側のコメントに鎖を全部書いた)。
  //   年収500万・独身・社保70万 → 所得割240,500円 → 限度額**62,283円**。
  //   本則の80%で割ると62,125円になるので、**62,283円が出ること自体が
  //   「附則5条の6の読替え(79.79%)が効いている」ことの証明**になる。
  { name: "furusato", expect: (s) =>
      s.gendo === 62283 && s.shotokuwari === 240500 && s.showsRitsu && !s.failed },
  // ★限度額ちょうど寄附すると自己負担は**きっかり2,000円**。これは限度額の定義そのもので、
  //   給与所得・調整控除・割合・20%上限・端数のどれか1つでも狂うと2,000円にならない
  { name: "furusato_gendo", expect: (s) => s.gendo === 62283 && s.jikoFutan === 2000 && !s.failed },
  // ★超えた分は自腹。8万円寄附 → 自己負担は2,000円ではなく16,137円になることを画面が言う
  { name: "furusato_over", expect: (s) =>
      s.jikoFutan === 16137 && s.showsOver && !s.failed },
  // ★社保が空欄なら年収から概算し、**その金額と前提を画面に出す**(黙って勝手な社保で答えない)
  { name: "furusato_gaisan", expect: (s) =>
      s.gendo === 60704 && s.showsGaisan && !s.failed },
  // 税率表が配信できないときは、限度額を出さずに断る(fail closed)。
  // ★黙って答えると、利用者は上限を超えて寄附して自腹を切る
  { name: "furusato_nodata", data404: "juminzei_r08.json",
    expect: (s) => s.failed && s.gendo === null },
];

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
               ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8" };

let received = null;
let onReceived = null;   // 結果が届いた瞬間にシーンを終わらせる(下記)
let slowHolidays = false;
let holidayMode = null; // null=そのまま | "404"=配信失敗 | "stale"=2025年までしか無い
let data404 = null;     // 指定したJSONファイルだけ配信失敗させる(参照データ全般)

const server = createServer(async (req, res) => {
  const [rawPath, query] = req.url.split("?");
  const path = decodeURIComponent(rawPath);
  if (path === "/__state" && req.method === "POST") {
    let b = ""; for await (const c of req) b += c;
    received = JSON.parse(b);
    res.writeHead(204); res.end();
    onReceived?.();   // シーンの答えは出た。Chromeの終了を待たない
    return;
  }
  // ハーネス自身の照合用フェッチ(?raw=1)は素通し。ツール側のfetchだけを細工する。
  // 遅延・配信失敗は**参照データ全般**に効かせる(祝日JSONだけの細工にしていると、
  // 新しい参照データ=税額表などを足したときに「待っているか」を試せない)
  const isToolDataFetch = /\/assets\/[\w.-]+\.json$/.test(path) && !/raw=1/.test(query || "");
  if (isToolDataFetch) {
    if (slowHolidays) await new Promise((r) => setTimeout(r, 800));
    if (data404 && path.endsWith(data404)) { res.writeHead(404); res.end("not found"); return; }
  }
  const isToolHolidayFetch = path.endsWith("holidays_jp.json") && !/raw=1/.test(query || "");
  if (isToolHolidayFetch) {
    if (holidayMode === "404") { res.writeHead(404); res.end("not found"); return; }
    if (holidayMode === "stale") {
      const all = JSON.parse(await readFile(join(ROOT, "docs/assets/holidays_jp.json"), "utf8"));
      const only2025 = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith("2025")));
      res.writeHead(200, { "content-type": MIME[".json"] });
      res.end(JSON.stringify(only2025));
      return;
    }
  }
  const file = path.endsWith("/") ? join(path, "index.html") : path;
  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { "content-type": MIME[extname(file)] || "text/plain" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const port = server.address().port;

const only = process.env.E2E_ONLY;
const fails = [];
const covered = new Map(); // ページ → 正常条件で駆動したシーン名

for (const sc of SCENES.filter((s) => !only || s.name === only)) {
  slowHolidays = !!sc.slow;
  holidayMode = sc.holidays || null;
  data404 = sc.data404 || null;
  received = null;
  const url = `http://127.0.0.1:${port}/tools/e2e/harness.html?scene=${sc.name}`;
  // Chromeのuser-data-dirは**毎回使い捨て**にする(2026-07-13 第15便)。
  // 以前は `tools/e2e/.chrome-<シーン名>` を使い回していたが、これには2つ問題があった:
  //   1. 同じ名前なので**2つ目の実行が1つ目のプロファイルを奪い合う**。うっかり全数実行を
  //      並走させたら全部が停滞し、中断で**壊れたプロファイルが36個(513MB)残った**
  //   2. 壊れたプロファイルは次の実行でも**そのまま開かれる**ので、Chromeが復旧を試みて
  //      起動が数分に劣化する。テストが自分の残骸で遅くなっていく
  // 使い捨てなら、並走しても衝突せず、前回の残骸も引きずらない(リポジトリも汚れない)。
  const dir = await mkdtemp(join(tmpdir(), "keiri-e2e-"));
  const args = ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                `--user-data-dir=${dir}`, "--window-size=1280,1000",
                "--virtual-time-budget=20000", "--dump-dom", url];
  // **結果のPOSTが届いた時点でシーンは終わり**。Chromeの終了は待たない(2026-07-13 第15便)。
  // --headless=new --dump-dom の Chrome は**自分から終了しないことがある**(実測: 149系で
  // 全シーンが終了せず、毎回 60 秒の SIGKILL まで待っていた)。判定自体は1秒で済んでいるのに
  // **1シーン60秒 × 36シーン = 36分**かかり、**通しで走らせるのが現実的でなくなっていた**。
  // 全数実行を誰もやらなくなった結果が第14便の全損見逃し(社会保険料にシーンが無いことに
  // 7便気付かなかった)。**遅すぎる検査は、いずれ走らされなくなって存在しないのと同じになる**。
  const p = spawn(CHROME, args, { stdio: "ignore" });
  const exited = new Promise((r) => p.on("exit", r));
  try {
    await new Promise((ok, ng) => {
      const done = () => { clearTimeout(kill); onReceived = null; ok(); };
      const kill = setTimeout(done, 60_000);   // 何も返らないまま黙り込んだとき用
      onReceived = done;                       // 通常はこちらで抜ける
      p.on("exit", done);                      // 先に落ちたら received=null → 失敗として報告される
      p.on("error", (e) => { clearTimeout(kill); onReceived = null; ng(e); });
    });
  } finally {
    p.kill("SIGKILL");
    await exited;   // **死にきるまで待ってから消す**。死ぬ途中のChromeはまだプロファイルに
                    // 書き込んでいるので、先に消すと ENOTEMPTY で落ちる(実際に踏んだ)
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }

  const s = received || { error: "ハーネスから状態が返らなかった(描画前に落ちた可能性)" };
  const ok = !s.error && sc.expect(s);
  // 「正常条件で正しい答えが出た」シーンだけを網羅とみなす(下の coverage 参照)。
  // 配信失敗・遅延を再現するシーンは、壊れたツールでも通ってしまうので数えない
  const normal = !sc.data404 && !sc.holidays && !sc.slow;
  if (ok && normal && s.page) {
    if (!covered.has(s.page)) covered.set(s.page, []);
    covered.get(s.page).push(sc.name);
  }
  console.log(`${ok ? "✅" : "❌"} ${sc.name}`);
  if (!ok) {
    fails.push(sc.name);
    // 「期待と違う」だけでは直せない。実際に画面に何が出ていたかを必ず見せる
    console.error("   ↳ " + JSON.stringify(s, null, 2).split("\n").join("\n   "));
  }
}

server.close();

// ── 網羅チェック: 計算ツールを1つもE2Eで触っていない状態を許さない ──────────────
// 2026-07-13 第14便: 需要が最大の看板ツール(社会保険料)だけE2Eシーンが**1つも無く**、
// 「料率は届いているのに『読み込めませんでした』と言い続ける」全損を**本番で放置**していた。
// 他の7ツールにはシーンがあったので、抜けは「作り忘れ」でしか起こらない = 機械で塞ぐ。
//
// **失敗再現シーン(404/遅延)は網羅に数えない**。壊れたツールでも通るため:
// 実際 shaho_nodata は「常に読み込み失敗と言う」壊れた状態で**緑のまま**だった。
// 数えるのは「正常条件で、正しい答えを出した」シーンだけ。
if (!only) {
  const toolPages = [];
  for (const d of await readdir(join(ROOT, "docs"), { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const idx = join(ROOT, "docs", d.name, "index.html");
    let html;
    try { html = await readFile(idx, "utf8"); } catch { continue; }
    // 計算ツール = assets/*_core.js を読み込んで計算しているページ(記事・about等は除外)
    if (/assets\/[a-z_]+_core\.js/.test(html)) toolPages.push(`/docs/${d.name}/`);
  }
  const uncovered = toolPages.filter((p) => !covered.has(p));
  if (uncovered.length) {
    console.error(`\n❌ E2Eシーンが無い計算ツール: ${uncovered.join(", ")}`);
    console.error("   正常条件で正しい答えが出ることを確かめるシーンを tools/e2e/harness.html に足すこと");
    fails.push(...uncovered.map((p) => `coverage:${p}`));
  } else {
    console.log(`\n📋 計算ツール ${toolPages.length}件すべてに正常系シーンあり`);
  }
}

if (fails.length) {
  console.error(`\n❌ 失敗: ${fails.join(", ")}`);
  process.exit(1);
}
console.log("\nall e2e scenes passed");
