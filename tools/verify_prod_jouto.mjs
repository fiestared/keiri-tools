/**
 * 本番（keiri-tools.com）に出た /fudosan-jouto/ を機械で検算する。
 *
 *   node tools/verify_prod_jouto.mjs
 *
 * ★「pushした」「ビルドが緑」は存在の確認であって動作の確認ではない。
 *   本番から core と参照データを実際に落として走らせ、看板の答えを再計算する。
 */
import { writeFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = "https://keiri-tools.com";
let pass = 0, fail = 0;
const log = [];
const ok = (label, cond, extra = "") => {
  cond ? pass++ : fail++;
  log.push(`${cond ? "  ok" : "FAIL"}  ${label}${cond || !extra ? "" : ` — ${extra}`}`);
};

const get = async (path) => {
  const r = await fetch(BASE + path, { headers: { "cache-control": "no-cache" } });
  return { status: r.status, text: r.status === 200 ? await r.text() : "" };
};

// ── 1. ページ・資産が本番に在ること ───────────────────────────────
const page = await get("/fudosan-jouto/");
ok("/fudosan-jouto/ が 200", page.status === 200, `status=${page.status}`);
if (page.status !== 200) {
  console.log(log.join("\n"));
  console.log(`\n❌ 未デプロイ: ${pass} passed, ${fail} failed`);
  process.exit(1);
}
const core = await get("/assets/jouto_core.js");
const data = await get("/assets/jouto_r08.json");
ok("/assets/jouto_core.js が 200", core.status === 200);
ok("/assets/jouto_r08.json が 200", data.status === 200);

// ── 2. ページに載っている主張（本文の断定） ───────────────────────
const H = page.text;
const has = (s) => H.includes(s);
ok("title に「不動産売却の税金」", /<title>[^<]*不動産売却の税金/.test(H));
ok("canonical が本番URL", has('rel="canonical" href="https://keiri-tools.com/fudosan-jouto/"'));
ok("GA4 が入っている", has("G-E742DSDHPD"));
ok("AdSense が入っている", has("ca-pub-2635067516563578"));
ok("FAQPage の構造化データがある", has('"@type": "FAQPage"'));
ok("WebApplication の構造化データがある", has('"@type": "WebApplication"'));
ok("★判定基準日の主張（譲渡した年の1月1日）", has("「譲渡した年の1月1日」で数えます"));
ok("★短期の具体例（4年7か月）", has("4年7か月"));
ok("長期の合計税率 20.315%", has("20.315%"));
ok("短期の合計税率 39.63%", has("39.63%"));
ok("軽減税率 14.21%", has("14.21%"));
ok("減価償却の算式", has("建物の取得価額 × 0.9 × 償却率 × 経過年数"));
ok("木造の償却率 0.031", has("償却率0.031"));
ok("減価償却の95%限度", has("建物の取得価額の95%が限度"));
ok("概算取得費が実額を下回るときも使える", has("5%を下回るときも"));
ok("3,000万円控除は短期にも使える", has("この控除は短期譲渡にも使えます"));
ok("空き家の相続人3人以上→2,000万円", has("控除額が3,000万円ではなく2,000万円"));
ok("空き家の1億円上限", has("譲渡対価が1億円を超えると"));
ok("空き家の適用期限（令和9年12月31日）", has("令和9年12月31日"));

// ── 3. 一覧・sitemap に載っていること ─────────────────────────────
const top = await get("/");
const sm = await get("/sitemap.xml");
ok("トップにツールカードのリンクがある", top.text.includes('href="fudosan-jouto/"'));
ok("sitemap に載っている", sm.text.includes("https://keiri-tools.com/fudosan-jouto/"));

// ── 4. ★本番のcoreと参照データを実際に走らせて検算する ───────────────
const dir = await mkdtemp(join(tmpdir(), "prodjouto-"));
const corePath = join(dir, "jouto_core.js");
await writeFile(corePath, core.text);
const D = JSON.parse(data.text);
const { calcJouto } = await import("file://" + corePath);

// 看板: 2021-05-01取得→2026-07-15譲渡・5,000万・譲渡費用170万・土地2,000万＋建物1,500万木造
const r = calcJouto({
  joutoKagaku: 50000000, joutoHiyo: 1700000,
  tochiShutokuhi: 20000000, tatemonoShutokuKagaku: 15000000,
  kozoKey: "mokuzo", shutokuBi: "2021-05-01", joutoBi: "2026-07-15",
}, D);
ok("★本番の計算: 短期と判定する（1月1日で数えている）", r.isChoki === false, `isChoki=${r.isChoki}`);
ok("★本番の計算: 課税譲渡所得 15,392,000円", r.kazei === 15392000, `kazei=${r.kazei}`);
ok("★本番の計算: 税額合計 6,099,849円", r.goukei === 6099849, `goukei=${r.goukei}`);
ok("★本番の計算: 翌年なら長期になる案内が出る", r.kurikoshi !== null);

// 外部オラクル（国税庁 No.3208）を本番の資産で再現する
const o = calcJouto({
  joutoKagaku: 145000000, joutoHiyo: 5000000,
  tochiShutokuhi: 100000000, tatemonoShutokuKagaku: 0,
  shutokuBi: "1996-06-01", joutoBi: "2026-05-20",
}, D);
ok("★本番の計算: 国税庁 No.3208 の所得税600万円", o.shotokuZei === 6000000, `${o.shotokuZei}`);
ok("★本番の計算: 国税庁 No.3208 の住民税200万円", o.juminZei === 2000000, `${o.juminZei}`);

// 参照データの値そのもの
ok("本番データ: 長期15%", D.zeiritsu.choki.shotoku_pct === 15);
ok("本番データ: 短期30%", D.zeiritsu.tanki.shotoku_pct === 30);
ok("本番データ: 木造の償却率0.031", D.shokyaku.kozo.find((k) => k.key === "mokuzo").ritsu === 0.031);
ok("本番データ: 空き家の期限 2027-12-31", D.tokubetsu_kojo.akiya.kigen === "2027-12-31");
ok("本番データ: 復興特別所得税の終期 2037", D.fukko.until_year === 2037);

console.log(log.join("\n"));
console.log(`\n${fail === 0 ? "✅" : "❌"} 本番検証: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
