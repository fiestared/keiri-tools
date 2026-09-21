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

const rawOrig = { page: fs.readFileSync(PAGE, "utf8"), core: fs.readFileSync(CORE, "utf8") };
const orig = { ...rawOrig, page: rawOrig.page.replace(/<td class="num">/g, "<td>") };
const restore = () => { fs.writeFileSync(PAGE, rawOrig.page); fs.writeFileSync(CORE, rawOrig.core); };

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

  // ── 2026-09-18 網羅便の追記（本文の要素だけを壊す。FAQ・出典には同じ数字が残る＝規則7） ──
  {
    name: "⑳ 長期優良住宅の控除を1,300万円→1,200万円にする（本文の段落だけ）",
    expect: "長期優良住宅の段落に1,300万円がある",
    run: () => editPage("控除額が<b>1,300万円</b>になります", "控除額が<b>1,200万円</b>になります"),
  },
  {
    name: "㉑ 土地が先の行を3年→2年にする（附則10条の3の延長を落とす）",
    expect: "土地が先の行は3年",
    run: () => editPage("土地の取得から<b>3年以内</b>に住宅が新築", "土地の取得から<b>2年以内</b>に住宅が新築"),
  },
  {
    name: "㉒ 中古住宅の控除表で平成元年〜の1,000万円を1,200万円にする",
    expect: "平成元年4月1日〜は1,000万円",
    run: () => editPage("<td>平成元年4月1日〜平成9年3月31日</td><td>1,000万円</td>", "<td>平成元年4月1日〜平成9年3月31日</td><td>1,200万円</td>"),
  },
  {
    name: "㉓ 東京都の申告期限を30日→60日にする（表の行だけ。FAQには30日が残る）",
    expect: "東京都は30日以内",
    run: () => editPage("<td>東京都</td><td>取得した日から30日以内</td>", "<td>東京都</td><td>取得した日から60日以内</td>"),
  },
  {
    name: "㉔ 宅地1/2の期限を令和9年→令和8年3月31日にする",
    expect: "宅地1/2の期限は令和9年3月31日",
    run: () => editPage("<b>平成18年1月1日から令和9年3月31日まで</b>", "<b>平成18年1月1日から令和8年3月31日まで</b>"),
  },
  {
    name: "㉕ 申告期限の根拠から「条例で定める期間内」を消す（一律の日数があるかのように書く）",
    expect: "申告の段落に「条例で定める期間内」がある",
    run: () => editPage("「条例で定める期間内」に申告・報告しなければならない", "取得から30日以内に申告しなければならない"),
  },

  // ── 2026-09-21 独立レビュー（Grok）で見つかった素通しを塞いだ分 ──
  //    どれも「条番号と見出しの語だけを見ていて、主張の数字・類型が守られていなかった」形。
  {
    name: "㉖ 耐震改修の例示を105,000円→150,000円にする（神奈川県の表は10万5,000円）",
    expect: "耐震改修の例示の減額は105,000円",
    run: () => editPage("350万円×3％＝105,000円", "350万円×3％＝150,000円"),
  },
  {
    name: "㉗ 耐震改修の例示の新築時期の控除額を350万円→420万円にする",
    expect: "耐震改修の例示は350万円",
    run: () => editPage("の新築で350万円×3％", "の新築で420万円×3％"),
  },
  {
    name: "㉘ 土地が先の行から「困難な場合は4年」を落とす（救済を消す）",
    expect: "土地が先の行に困難な場合の4年がある",
    run: () => editPage("政令で定める場合は4年）に延びています", "）に延びています"),
  },
  {
    name: "㉙ 土地が先の行の第2肢を譲受人から元の取得者に書き換える（類型が1つ消える）",
    expect: "土地が先の行が譲受人の新築を落としていない",
    run: () => editPage("その土地を譲り受けた人が新築する場合", "その土地を買った人が新築する場合"),
  },
  {
    name: "㉚ 中古住宅の行の「土地の取得から1年以内」を2年にする（素の「1年」検査は前1年で素通しした）",
    expect: "中古住宅の行は土地の取得から1年以内",
    run: () => editPage("土地の取得から1年以内に、またはその前1年", "土地の取得から2年以内に、またはその前1年"),
  },
  {
    name: "㉛ 中古住宅の行から「新築後1年を超えた未使用住宅」を落とす（73条の24第2項の類型が1つ消える）",
    expect: "中古住宅の行が新築後1年超の未使用住宅を落としていない",
    run: () => editPage("のほか、<b>新築から1年を超えた未使用の住宅</b>で上の3号の適用を受けないもの", ""),
  },
  {
    name: "㉜ FAQ の登記免除を4都府県一律に戻す（表は分けているのに FAQ だけ一律＝画面の中で矛盾）",
    expect: "FAQ（申告期限）が登記の免除を4都府県で一律にしていない",
    // ★同じ文が head の FAQ JSON-LD にも出るので、`<p>` ごと指定して本文の要素を狙う（規則8）。
    run: () => editPage(
      "<p>A. 期限は法律ではなく都道府県の条例で決まります（地方税法73条の18）。取得した日から、東京都は30日以内、神奈川県は10日以内、大阪府は20日以内、愛知県は60日以内です（2026年9月18日時点の各公式ページ）。登記をした場合に取得の申告が要らなくなる条件も都府県で違い、東京都と大阪府はその期間内に登記を申請した場合、神奈川県と愛知県は令和5年4月1日以降の取得について登記を申請していれば不要です。",
      "<p>A. 期限は法律ではなく都道府県の条例で決まります（地方税法73条の18）。取得した日から、東京都は30日以内、神奈川県は10日以内、大阪府は20日以内、愛知県は60日以内です（2026年9月18日時点の各公式ページ）。その期間内に登記を申請していれば取得の申告は原則として要りません。"),
  },
  {
    name: "㉝ 控除額表の出所から埼玉県の公表範囲の断りを落とす",
    expect: "控除額表の出所が埼玉県の公表範囲を断っている",
    run: () => editPage("埼玉県が公表しているのは昭和57年1月1日以後の4区分だけで、それより前は県税事務所に問い合わせる案内になっています",
                        "埼玉県も同じ額でした"),
  },
  {
    name: "㉞ 非課税の段落の「等価交換」を裸の「交換」にする（換地まで課税に見える）",
    expect: "非課税の段落は課税側を「等価交換」に限っている",
    run: () => editPage("<b>贈与や等価交換による取得は課税されます</b>", "<b>贈与や交換による取得は課税されます</b>"),
  },
  {
    name: "㉟ 非課税の段落から換地を落とす",
    expect: "非課税の段落が換地を非課税側に挙げている",
    run: () => editPage("土地区画整理事業の施行に伴う換地の取得", "土地の取得"),
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
