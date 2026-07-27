/**
 * test_fudosan_shutoku.mjs の壊しテスト。
 * 規則2: 壊す前に「無傷が緑」を確かめる（常に赤い検査は何を壊しても赤＝嘘の満点）。
 * 規則8: 各ケースに expect を持たせ、**狙った検査が落ちたか**まで判定する。
 *
 * ★この検査の存在理由は2つ:
 *   (a) 令和8年度改正の数字（免税点・床面積要件）を、コアと本文の**両方**で守ること。
 *       片方だけ直すと、画面は正しい顔のまま嘘の数字を出す。
 *   (b) 「45,000円」「1/2読替え」という、実務で最も間違えられる2点が消えても
 *       検査が気づくこと（本文の主張は要素を名指しして守る＝規則3〜5）。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(here, "../docs/fudosan-shutoku/index.html");
const CORE = path.join(here, "../docs/assets/fudosan_shutoku_core.js");
const TEST = path.join(here, "test_fudosan_shutoku.mjs");

const run = () => {
  try {
    execFileSync("node", [TEST], { stdio: "pipe" });
    return { green: true, out: "" };
  } catch (e) {
    return { green: false, out: String(e.stdout || "") + String(e.stderr || "") };
  }
};

const orig = { page: fs.readFileSync(PAGE, "utf8"), core: fs.readFileSync(CORE, "utf8") };
const restore = () => { fs.writeFileSync(PAGE, orig.page); fs.writeFileSync(CORE, orig.core); };

const base = run();
if (!base.green) {
  console.error("✗ ベースラインが赤。壊しテストは実施しない（嘘の満点を避ける）");
  console.error(base.out.slice(0, 1200));
  process.exit(1);
}
console.log("✓ ベースライン緑");

/** 一意に狙って壊す（規則8: 壊し方も一意でなければ「検査が弱い」と誤診する）。 */
const editFile = (file, origText, from, to) => {
  const i = origText.indexOf(from);
  if (i < 0) throw new Error("壊し対象が見つからない（壊し方が外れている）: " + from.slice(0, 70));
  if (origText.indexOf(from, i + 1) >= 0) throw new Error("壊し対象が一意でない: " + from.slice(0, 70));
  fs.writeFileSync(file, origText.slice(0, i) + to + origText.slice(i + from.length));
};
const editPage = (from, to) => editFile(PAGE, orig.page, from, to);
const editCore = (from, to) => editFile(CORE, orig.core, from, to);

const cases = [
  // ── コアの定数を改定する（ページは一切触らない）＝この検査の存在理由 ──
  {
    name: "① 改正後の免税点（土地16万円）を改正前の10万円に戻す",
    expect: "改正後の免税点（土地）は16万円",
    run: () => editCore('{ from: "2026-04-01", tochi: 160000', '{ from: "2026-04-01", tochi: 100000'),
  },
  {
    name: "② 改正後の免税点（建築66万円）を23万円に戻す",
    expect: "改正後の免税点（建築）は66万円",
    run: () => editCore("kenchiku: 660000", "kenchiku: 230000"),
  },
  {
    name: "③ 床面積の下限を40㎡→50㎡に戻す（改正を反映し忘れた状態）",
    expect: "改正後の床面積の下限は40㎡",
    run: () => editCore('{ from: "2026-04-01", min: 40', '{ from: "2026-04-01", min: 50'),
  },
  {
    name: "④ 新築住宅の控除を1,200万円→1,000万円にする",
    expect: "新築住宅の控除は1,200万円",
    run: () => editCore("shinchikuKojo: 12000000", "shinchikuKojo: 10000000"),
  },
  {
    name: "⑤ 住宅用土地の減額の基準額を「150万円」→「45,000円」にする（最も多い誤解）",
    expect: "住宅用土地の減額の基準額は150万円",
    run: () => editCore("tochiGenkakuBase: 1500000", "tochiGenkakuBase: 45000"),
  },
  {
    name: "⑥ 税率の特例を3％→4％にする",
    expect: "特例税率は3％",
    run: () => editCore("tokureiRate: 3", "tokureiRate: 4"),
  },

  // ── コアの計算そのものを壊す ──
  {
    name: "⑦ 減額の1㎡単価から宅地1/2の読替えを外す（減額が2倍になる＝税額が過小）",
    expect: "減額の1㎡単価は1/2読替え後の40,000円",
    run: () => editCore("land.unitPrice = land.kazeiHyojunPrice / landArea;", "land.unitPrice = land.value / landArea;"),
  },
  {
    name: "⑧ 住宅以外の家屋にも3％を当てる（税率の特例の対象を広げすぎる）",
    expect: "条文書き下しオラクルと全域一致",
    run: () => editCore(
      'const isTokureiTarget = kind === "tochi" || kind === "shinchiku" || kind === "chuko";',
      "const isTokureiTarget = true;"),
  },
  {
    name: "⑨ 中古住宅の収録範囲の門を外す（確認できない控除額で答えてしまう）",
    expect: "2017-04-01より前の新築は収録範囲外",
    run: () => editCore("built < SEIDO.chukoKojoVerifiedFrom", "false"),
  },
  {
    name: "⑩ 税額の100円未満切捨てを四捨五入にする（法20条の4の2第3項）",
    expect: "条文書き下しオラクルと全域一致",
    run: () => editCore("const floor100 = (n) => Math.floor(n / 100) * 100;",
      "const floor100 = (n) => Math.round(n / 100) * 100;"),
  },
  {
    name: "⑪ 家屋の評価額が0だと床面積を見ない状態に戻す（土地を買って家を建てる人の減額が消える）",
    expect: "条文書き下しオラクルと全域一致",
    run: () => editCore(
      "house.floorOk = kubun.jutaku && houseFloor >= yoken.min && houseFloor <= yoken.max;",
      "house.floorOk = kubun.jutaku && houseValue > 0 && houseFloor >= yoken.min && houseFloor <= yoken.max;"),
  },

  // ── 本文の主張を壊す（規則3〜5: 要素を名指ししていないと素通しする） ──
  {
    name: "⑫ 免税点の表の土地の行から改正後の16万円を消す",
    expect: "免税点の表の土地の行に10万円と16万円がある",
    run: () => editPage("<td>10万円</td><td><b>16万円</b></td>", "<td>10万円</td><td><b>10万円</b></td>"),
  },
  {
    name: "⑬ 「45,000円になるだけ」の限定を消して金額の断定にする",
    expect: "45,000円は税率3％のときだけ",
    run: () => editPage("45,000円になるだけで", "常に45,000円が引かれるので"),
  },
  {
    name: "⑭ 税率4％のときの60,000円を45,000円に書き換える",
    expect: "4％なら60,000円になると書いている",
    run: () => editPage("<b>税率が4％に戻れば60,000円</b>", "<b>税率が4％に戻っても45,000円</b>"),
  },
  {
    name: "⑮ 1/2読替えの根拠（附則11条の5第2項）を項番なしにする",
    expect: "1/2読替えの段落が附則11条の5第2項を名指ししている",
    run: () => editPage("附則11条の5第2項が73条の24", "附則11条の5が73条の24"),
  },
  {
    name: "⑯ 改正前の条文（貸家のかっこ書き）の対比を消す",
    expect: "床面積の段落に改正前の条文（50㎡・貸家のかっこ書き）がある",
    run: () => editPage(
      "改正前の条文は「五十平方メートル（当該住宅が貸家の用に供するものにあつては、四十平方メートル）以上二百四十平方メートル以下」と書かれていて、<b>40㎡台で控除を受けられるのは貸家だけ</b>でした。",
      "改正前は下限が高く設定されていました。"),
  },
  {
    name: "⑰ 収録範囲外の理由（推測になる）を消す",
    expect: "収録範囲外の申告に「推測になる」理由がある",
    run: () => editPage("それより前は<b>推測になるからです</b>", "それより前は対象外です"),
  },
  {
    name: "⑱ 「住宅以外の家屋は4％のまま」を消して一律3％と書く",
    expect: "税率の段落に住宅以外は4％のままと書いてある",
    run: () => editPage(
      "<b>店舗・事務所・倉庫といった住宅以外の家屋は特例の対象外で、4％のまま</b>です。",
      "住宅以外の家屋も同じ税率です。"),
  },
];

let caught = 0;
const missed = [];
for (const c of cases) {
  restore();
  try {
    c.run();
  } catch (e) {
    missed.push(`${c.name} — ${e.message}`);
    continue;
  }
  const r = run();
  if (r.green) {
    missed.push(`${c.name} — 壊したのに緑（素通し）`);
  } else if (!r.out.includes(c.expect)) {
    missed.push(`${c.name} — 落ちたが狙った検査ではない（期待: ${c.expect}）`);
  } else {
    caught++;
  }
}
restore();

console.log(`${caught}/${cases.length} 捕捉`);
if (missed.length) {
  for (const m of missed) console.log("  ✗ " + m);
  process.exit(1);
}
