// 年度監視の登録（tools/source_year_registry.json）が壊れていないかを見る。
//
// ★なぜ在るか: 2026-09-07、国税庁が令和9年分 源泉徴収税額表を8/31に公表していたのに
//   7日間気づかなかった。原因は一次資料の更新を見る計器が無かったこと。
//   計器を足したので、その登録が腐らないようにする。
//
// ★この検査が見るのは「登録の形」だけ。ネットワークは叩かない（CIで落ちるため）。
//   実際の公表状況は python3 tools/check_source_year.py が見る（終了コード 3 = 要対応）。
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const reg = JSON.parse(fs.readFileSync(path.join(root, "tools/source_year_registry.json"), "utf8"));
const errs = [];

if (!Array.isArray(reg.entries) || reg.entries.length === 0) errs.push("entries が空");

const seen = new Set();
for (const e of reg.entries) {
  const at = `entries[${e.slug}]`;
  for (const k of ["slug", "name", "source", "covers"]) {
    if (e[k] === undefined) errs.push(`${at}: ${k} が無い`);
  }
  if (seen.has(e.slug)) errs.push(`${at}: slug が重複`);
  seen.add(e.slug);

  // 記事かツールのどちらかに実在すること（登録だけ残って記事が消える事故を防ぐ）
  const asColumn = path.join(root, "docs/column", e.slug, "index.html");
  const asTool = path.join(root, "docs", e.slug, "index.html");
  if (!fs.existsSync(asColumn) && !fs.existsSync(asTool)) {
    errs.push(`${at}: 対象ページが無い（docs/column/${e.slug}/ も docs/${e.slug}/ も存在しない）`);
  }

  if (typeof e.covers !== "number" || e.covers < 2020 || e.covers > 2100) {
    errs.push(`${at}: covers は西暦の数値であること（今: ${JSON.stringify(e.covers)}）`);
  }
  // ★監視先には2つの型がある（2026-09-22 に最低賃金で2つ目が出た）。
  //   "year_templated"（既定）… 年度ごとに別URLが生える型。URLに {y} / {r} が要る。
  //                              プレースホルダ忘れは事故なので、既定では必ず弾く。
  //   "in_place"            … 同じURLの中身が毎年差し替わる型（厚労省の全国一覧など）。
  //                              置換できないのが正しいので {y}/{r} を要求しない。
  //   型は**明示させる**。URLに置換子が無いことから推測すると、
  //   本当の「置換子の書き忘れ」が黙って in_place 扱いになる。
  const kind = e.url_kind ?? "year_templated";
  if (!["year_templated", "in_place"].includes(kind)) {
    errs.push(`${at}: url_kind は "year_templated" か "in_place"（今: ${JSON.stringify(e.url_kind)}）`);
  }
  if (e.url !== null && typeof e.url === "string" && kind === "year_templated"
      && !e.url.includes("{y}") && !e.url.includes("{r")) {
    errs.push(`${at}: url に {y} または {r} が無い（年度で置換できない）。`
              + `同じURLの中身が差し替わる型なら url_kind:"in_place" を明示すること`);
  }
  if (kind === "in_place" && !(e.note || "").includes("in_place")
      && !(e.note || "").includes("年度で変わらない")) {
    errs.push(`${at}: url_kind=in_place の理由が note に無い`);
  }
  // 「令和N年」の後ろに付く語。分/度 のほか、資料見出しが「令和N年版」なら 版、
  // 同じURLに年ごとの行が足される型（延滞税の割合「令和N年1月1日から」）なら 月日 を許す（2026-10-15）。
  // 自由文字列にはしない（「年」だけにすると本文の「令和9年分以後」等の予告に当たり、偽の found を出す）
  if (e.year_label_suffix !== undefined && !/^(?:分|度|版|(?:[1-9]|1[0-2])月(?:[1-9]|[12][0-9]|3[01])日)$/.test(e.year_label_suffix)) {
    errs.push(`${at}: year_label_suffix は「分」「度」「版」または「M月D日」であること（今: ${JSON.stringify(e.year_label_suffix)}）`);
  }
  // ★未調査を「監視できている」と見せない。url が null なら note に理由を書かせる
  if (e.url === null && !(e.note || "").includes("未調査")) {
    errs.push(`${at}: url が null なのに note に「未調査」の明示が無い（未調査と未公表を混同する）`);
  }
  // probe_next=false は「登録はあるが次の年度版を見ていない」。理由を専用の欄に書かせる（note は実測の記録）
  if (e.probe_next === false && !(e.probe_off_reason || "").trim()) {
    errs.push(`${at}: probe_next=false なのに probe_off_reason（なぜ次の年度版を probe できないか）が無い`);
  }
  if (e.probe_next === false && !e.url) {
    errs.push(`${at}: probe_next=false でも url（一次資料）は書くこと`);
  }
}

// 「title に年度があるのに登録が無い」コラムを落とすのは tests/test_source_year_coverage.mjs（2026-10-15〜）。
// ここは登録の形だけを見る（以前ここにあった「残りは順次登録すること」の警告は、新規分を止めないので
// 漏れが増え続けた。coverage 側で新規分は必ず落とし、既存の未登録は許可リストで減らす一方にした）。

if (errs.length) {
  console.error(`✗ 年度監視の登録に ${errs.length}件の問題:`);
  for (const e of errs) console.error("  - " + e);
  console.error("");
  process.exit(1);
}
console.log(`✓ 年度監視の登録 OK（${reg.entries.length}件 / うち次の年度版を probe ${reg.entries.filter((e) => e.url && e.probe_next !== false).length}件・probe_next=false ${reg.entries.filter((e) => e.probe_next === false).length}件）`);
console.log(`  ※ title に年度を持つコラムの登録漏れは node tests/test_source_year_coverage.mjs が見る`);
