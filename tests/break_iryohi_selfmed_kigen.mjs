/**
 * test_iryohi_selfmed_kigen.mjs の壊しテスト。
 * 規則2: 壊す前に「無傷が緑」を確かめる（常に赤い検査は何を壊しても赤＝嘘の満点）。
 * 規則8: 素通しを見たら「検査が弱いのか、壊し方が外れたのか」を区別する。
 *   → 各ケースに expect（落ちるべき検査の文言）を持たせ、**狙った検査が落ちたか**まで判定する。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, "../docs/assets/iryohi_r08.json");
const PAGE = path.join(here, "../docs/iryohi/index.html");
const CORE = path.join(here, "../docs/assets/iryohi_core.js");
const TEST = path.join(here, "test_iryohi_selfmed_kigen.mjs");

const run = (env = {}) => {
  try {
    execFileSync("node", [TEST], { stdio: "pipe", env: { ...process.env, ...env } });
    return { green: true, out: "" };
  } catch (e) {
    return { green: false, out: String(e.stdout || "") + String(e.stderr || "") };
  }
};

const orig = {
  data: fs.readFileSync(DATA, "utf8"),
  page: fs.readFileSync(PAGE, "utf8"),
  core: fs.readFileSync(CORE, "utf8"),
};
const restore = () => {
  fs.writeFileSync(DATA, orig.data);
  fs.writeFileSync(PAGE, orig.page);
  fs.writeFileSync(CORE, orig.core);
};

// ── ベースライン（規則2）──
const base = run();
if (!base.green) {
  console.error("✗ ベースラインが赤。壊しテストは実施しない（嘘の満点を避ける）");
  console.error(base.out.slice(0, 900));
  process.exit(1);
}
console.log("✓ ベースライン緑");

const writeData = (mut) => {
  const d = JSON.parse(orig.data);
  mut(d);
  // ★元の整形（2スペース）を保つ。全体再整形の巨大差分を作らない
  fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
};

const cases = [
  // ===== データ側 =====
  {
    name: "① 2号の終期を令和13年→令和8年に戻す（延長の事実を消す）",
    expect: "2号の終期＝令和13年12月31日",
    apply: () => writeData((d) => { d.selfmed.kigen.r9_onward.track2_sonota.expires = "2026-12-31"; }),
  },
  {
    name: "② 1号の expires に日付を入れる（恒久化を消して単一期限に戻す）",
    expect: "1号は終期が書かれていない",
    apply: () => writeData((d) => { d.selfmed.kigen.r9_onward.track1_switch_otc.expires = "2031-12-31"; }),
  },
  {
    name: "③ 附則46条の適用年分を令和8年分に書き換える（施行日と適用年分の取り違えを再現）",
    expect: "附則46条の逐語",
    apply: () => writeData((d) => {
      d.selfmed.kigen.r9_onward.fusoku =
        "新租税特別措置法第四十一条の十七の規定は、令和八年分以後の所得税について適用する。";
    }),
  },
  {
    name: "④ 上限を88,000→100,000にする（金額の逐語オラクル）",
    expect: "八万八千円",
    apply: () => writeData((d) => { d.selfmed.cap = 100000; }),
  },
  {
    name: "⑤ recheck_after を過去にする（カナリア）",
    expect: "カナリア: recheck_after",
    apply: () => writeData((d) => { d.selfmed.kigen.recheck_after = "2026-01-01"; }),
  },
  {
    name: "⑥ recheck_after を令和8年分の窓より後ろへ延ばす（手遅れになる設定）",
    expect: "recheck_after は令和8年分の窓が閉じる前",
    apply: () => writeData((d) => { d.selfmed.kigen.recheck_after = "2027-06-01"; }),
  },
  {
    name: "⑦ expire_note から3分岐の手順を削る",
    expect: "失効時の手順が expire_note に内蔵されている",
    apply: () => writeData((d) => { d.selfmed.kigen.expire_note = "あとで見直す。"; }),
  },
  {
    name: "⑧ valid_until と kigen.r8_window_end を食い違わせる",
    expect: "valid_until と kigen.r8_window_end が食い違わない",
    apply: () => writeData((d) => { d.selfmed.valid_until = "2027-12-31"; }),
  },
  {
    name: "⑨ 対象拡大の記述から体外診断用医薬品を消す",
    expect: "体外診断用医薬品が対象に加わる",
    apply: () => writeData((d) => {
      d.selfmed.kigen.r9_onward._taisho_kakudai =
        "★令和9年分から対象が広がる: 薬局製造販売医薬品が追加。★令和8年分にはこの拡大は適用されない。";
    }),
  },
  {
    name: "⑩ _meta の保守ノートを旧い誤りのままに戻す",
    expect: "next_review_reason が改正の事実に更新されている",
    apply: () => writeData((d) => {
      d._meta.next_review_reason =
        "★セルフメディケーション税制は令和8年12月31日で適用期限。現行法のままなら令和9年分以降は使えなくなるので、延長されたか確認して selfmed を差し替える。";
    }),
  },
  // ===== ページ側 =====
  {
    name: "⑪ ページから『スイッチOTCは適用期限なし』を消す",
    expect: "ページ: 1号＝適用期限なし",
    apply: () => fs.writeFileSync(PAGE,
      orig.page.replace("<b>スイッチOTC医薬品は適用期限なし</b>", "スイッチOTC医薬品")),
  },
  {
    name: "⑫ ページの令和13年12月31日を令和8年12月31日に書き換える",
    expect: "2号＝令和13年12月31日",
    apply: () => fs.writeFileSync(PAGE,
      orig.page.replace("それ以外（体外診断用医薬品など）は令和13年12月31日まで",
        "それ以外（体外診断用医薬品など）は令和8年12月31日まで")),
  },
  {
    name: "⑬ ページから附則46条の根拠を消す",
    expect: "適用年分の根拠（附則46条）",
    apply: () => fs.writeFileSync(PAGE,
      orig.page.replace("（附則46条により令和9年分以後の所得税に適用）", "")),
  },
  {
    name: "⑭ ページに旧い断定を戻す（実害の再現）",
    expect: "旧い断定『適用期限は令和8年12月31日まで』がページから消えている",
    apply: () => fs.writeFileSync(PAGE,
      orig.page.replace("健康診査・予防接種など<b>一定の取組</b>をしていることが要件です。",
        "★セルフメディケーション税制の適用期限は<b>令和8年12月31日まで</b>で、健康診査・予防接種など一定の取組をしていることが要件です。")),
  },
  {
    name: "⑮ ページから『令和8年分には拡大が及ばない』を消す（過大に案内する向き）",
    expect: "対象拡大が令和8年分に及ばないと明言している",
    apply: () => fs.writeFileSync(PAGE,
      orig.page.replace("<b>令和8年分にはこの拡大は適用されない</b>ため、", "")),
  },
  {
    name: "⑯ ページの『制度の終了ではありません』を消す",
    expect: "『令和8年12月31日＝制度の終了』ではないと明言している",
    apply: () => fs.writeFileSync(PAGE,
      orig.page
        .replace("であって、制度の終了ではありません。", "です。")
        .replace('<b>★「セルフメディケーション税制は令和8年12月31日で終わる」ではありません。</b>',
          "<b>★セルフメディケーション税制の期限</b>")),
  },
  // ===== コア側 =====
  {
    name: "⑰ コアの上限をデータから読まず直書きに戻す（走査で探していた型）",
    expect: "core はデータ差し替えに追従する",
    apply: () => fs.writeFileSync(CORE,
      orig.core.replace("const kojo = Math.min(Math.max(0, p - S.floor), S.cap);",
        "const kojo = Math.min(Math.max(0, p - 12000), 88000);")),
  },
  {
    // ★当初は「ページの上限表示を直書きに戻す」を狙ったが、上限の表示は**実行時にJSで描く**ので
    //   静的HTMLを読む単体テストには原理的に見えない（＝壊し方が層を外していた・規則8）。
    //   実行時の結合は E2E シーン `iryohi_selfmed` が担当する。ここでは
    //   「静的HTMLの日付がデータに結合されているか」を壊して確かめる。
    name: "⑱ データの令和8年分の終期を動かす（静的HTML⇔データの結合）",
    expect: "ページの令和8年分の終期がデータと一致",
    apply: () => writeData((d) => { d.selfmed.kigen.r8_window_end = "2025-12-31"; }),
  },
];

let pass = 0, miss = 0;
for (const c of cases) {
  restore();
  c.apply();
  const r = run();
  restore();
  if (r.green) {
    console.error(`✗ 素通し: ${c.name}`);
    miss++;
    continue;
  }
  if (c.expect && !r.out.includes(c.expect)) {
    console.error(`✗ 赤くなったが狙いの検査ではない: ${c.name}`);
    console.error(`    期待した検査の文言: ${c.expect}`);
    console.error(`    実際に落ちた: ${(r.out.match(/NG:.*/g) || []).slice(0, 4).join(" / ")}`);
    miss++;
    continue;
  }
  console.log(`✓ 捕捉: ${c.name}`);
  pass++;
}

restore();
console.log(`\nbreak_iryohi_selfmed_kigen: ${pass}/${cases.length} 捕捉` + (miss ? `（素通し/取り違え ${miss}）` : ""));
process.exit(miss === 0 ? 0 : 1);
