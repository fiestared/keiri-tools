/**
 * 不動産取得税の計算コアの検査。
 *
 * 守りたいのは、画面が正常に見えたまま黙って誤答する急所:
 *   ① 令和8年度改正の免税点（10万/23万/12万 → 16万/66万/34万）を取得日で切り替える
 *   ② 同改正の床面積要件（50㎡ → 40㎡）を取得日で切り替える
 *   ③ 税率3％は住宅と土地だけ（住宅以外の家屋は4％）
 *   ④ 住宅用土地の減額は「45,000円」ではなく 150万円×税率
 *   ⑤ 減額の1㎡単価は宅地なら1/2読替え後（忘れると減額が2倍＝税額が過小）
 *   ⑥ 中古住宅は収録範囲外なら税額を出さない（推測した控除額で答えない）
 *
 * 検査の作り:
 *   §1 定数の自己整合（条文の値そのもの）
 *   §2 条文書き下しオラクル（コアを見ずに独立実装して全域で突き合わせる）
 *   §3 手計算の鎖（看板例）
 *   §4 改正の境界（取得日で版が切り替わること・両側の値）
 *   §5 収録範囲外の申告（fail closed）
 *   §6 単調性（評価額が増えて税額が減ることはない）
 *   §7 ページ要素の名指し照合（規則3〜5。主張が1回だけ現れる要素を名指しする）
 */
import { readFileSync } from "node:fs";
import {
  SEIDO, MENZEITEN, FLOOR_YOKEN, KAOKU_KUBUN,
  calcFudosanShutoku, menzeitenFor, floorYokenFor, rateFor,
} from "../docs/assets/fudosan_shutoku_core.js";

const PAGE = readFileSync(new URL("../docs/fudosan-shutoku/index.html", import.meta.url), "utf8");
/** タグを空白に置換した本文（属性値ごと消える点に注意して使う）。 */
const visible = PAGE.replace(/<[^>]+>/g, " ");

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, got, want) => ok(`${name}（got=${got} want=${want}）`, got === want);

/** 既定の入力（各検査はここから必要な項目だけ差し替える）。 */
const base = {
  acquireDate: "2026-07-01",
  houseKind: "shinchiku", houseValue: 15000000, houseFloor: 100,
  builtDate: "2020-04-01", selfUse: true,
  landValue: 12000000, landArea: 150, isTakuchi: true, landForHouse: true,
};
const run = (over = {}) => calcFudosanShutoku({ ...base, ...over });

// ── §1 定数の自己整合 ──────────────────────────────────────────────────────
{
  eq("§1 本則税率は4％（法73条の15）", SEIDO.honsokuRate, 4);
  eq("§1 特例税率は3％（附則11条の2）", SEIDO.tokureiRate, 3);
  eq("§1 税率の特例の期限は令和9年3月31日", SEIDO.tokureiUntil, "2027-03-31");
  eq("§1 宅地の課税標準は1/2（附則11条の5）", SEIDO.takuchiRatio, 0.5);
  eq("§1 新築住宅の控除は1,200万円（法73条の14第1項）", SEIDO.shinchikuKojo, 12000000);
  eq("§1 住宅用土地の減額の基準額は150万円（法73条の24）", SEIDO.tochiGenkakuBase, 1500000);
  eq("§1 減額の面積上限は200㎡", SEIDO.tochiGenkakuMaxM2, 200);
  eq("§1 減額の床面積の倍率は2倍", SEIDO.tochiGenkakuMultiplier, 2);
  eq("§1 耐震基準のみなし日は昭和57年1月1日", SEIDO.taishinFrom, "1982-01-01");

  // 免税点の表：改正後・改正前の両方が条文どおり入っていること
  const after = MENZEITEN.find((m) => m.from === "2026-04-01");
  const before = MENZEITEN.find((m) => m.from === "0000-01-01");
  eq("§1 改正後の免税点（土地）は16万円", after.tochi, 160000);
  eq("§1 改正後の免税点（建築）は66万円", after.kenchiku, 660000);
  eq("§1 改正後の免税点（その他）は34万円", after.sonota, 340000);
  eq("§1 改正前の免税点（土地）は10万円", before.tochi, 100000);
  eq("§1 改正前の免税点（建築）は23万円", before.kenchiku, 230000);
  eq("§1 改正前の免税点（その他）は12万円", before.sonota, 120000);

  const yAfter = FLOOR_YOKEN.find((y) => y.from === "2026-04-01");
  const yBefore = FLOOR_YOKEN.find((y) => y.from === "0000-01-01");
  eq("§1 改正後の床面積の下限は40㎡", yAfter.min, 40);
  eq("§1 改正前の床面積の下限は50㎡", yBefore.min, 50);
  eq("§1 床面積の上限は改正の前後とも240㎡", `${yAfter.max}/${yBefore.max}`, "240/240");

  // 家屋の区分は「など」で丸めず全部を持っていること（住宅以外を落とすと税率を誤る）
  eq("§1 家屋の区分は4つ", KAOKU_KUBUN.length, 4);
  ok("§1 住宅以外の家屋の区分がある", KAOKU_KUBUN.some((k) => k.key === "hijutaku" && k.jutaku === false));
}

// ── §2 条文書き下しオラクル（独立実装） ───────────────────────────────────
{
  // コアを見ずに条文から書き下した別実装。全域で突き合わせる。
  const oracle = (i) => {
    const d = i.acquireDate;
    const m = d >= "2026-04-01"
      ? { tochi: 160000, kenchiku: 660000, sonota: 340000 }
      : { tochi: 100000, kenchiku: 230000, sonota: 120000 };
    const fmin = d >= "2026-04-01" ? 40 : 50;
    const jutaku = i.houseKind === "shinchiku" || i.houseKind === "chuko";
    const rateHouse = jutaku && d <= "2027-03-31" ? 3 : 4;
    const rateLand = d <= "2027-03-31" ? 3 : 4;
    const f1000 = (n) => Math.floor(n / 1000) * 1000;
    const f100 = (n) => Math.floor(n / 100) * 100;

    // 家屋
    let houseTax = 0, floorOk = i.houseFloor >= fmin && i.houseFloor <= 240, kojo = 0;
    if (i.houseKind === "shinchiku" && floorOk) kojo = 12000000;
    if (i.houseKind === "chuko" && floorOk && i.selfUse && i.builtDate >= "2017-04-01") kojo = 12000000;
    const line = i.houseKind === "shinchiku" ? m.kenchiku : m.sonota;
    if (i.houseKind !== "none" && i.houseValue > 0 && i.houseValue >= line) {
      houseTax = f100((f1000(Math.max(0, i.houseValue - kojo)) * rateHouse) / 100);
    }
    // 土地
    let landTax = 0;
    if (i.landValue > 0) {
      const kh = i.isTakuchi && d <= "2027-03-31" ? i.landValue / 2 : i.landValue;
      if (kh >= m.tochi) {
        const before = (f1000(kh) * rateLand) / 100;
        let genkaku = 0;
        if (i.landForHouse && jutaku && floorOk && i.landArea > 0) {
          const unit = kh / i.landArea;
          const mm = Math.min(i.houseFloor * 2, 200);
          genkaku = (Math.max(1500000, unit * mm) * rateLand) / 100;
        }
        landTax = f100(Math.max(0, before - genkaku));
      }
    }
    return { houseTax, landTax };
  };

  let mismatch = 0, cases = 0;
  const dates = ["2025-06-01", "2026-03-31", "2026-04-01", "2026-07-01", "2027-03-31", "2027-04-01"];
  const kinds = ["shinchiku", "chuko", "hijutaku", "none"];
  const floors = [35, 40, 45, 50, 100, 240, 260];
  // ★端数が出る額を必ず混ぜる。全部が100円の倍数に落ちる入力だけだと、
  //   100円未満切捨てを四捨五入に変えても差が出ず、端数処理の検査が素通しする（規則6）。
  //   342,000×4％＝13,680／6,342,000×3％＝190,260 がその役。
  const hValues = [0, 200000, 342000, 500000, 700000, 12000000, 15000000, 40000000];
  const lValues = [0, 150000, 320000, 6342000, 12000000, 60000000];
  for (const acquireDate of dates)
    for (const houseKind of kinds)
      for (const houseFloor of floors)
        for (const houseValue of hValues)
          for (const landValue of lValues)
            for (const isTakuchi of [true, false]) {
              const i = { ...base, acquireDate, houseKind, houseFloor, houseValue, landValue, isTakuchi };
              const got = calcFudosanShutoku(i);
              if (got.uncomputable) continue; // 収録範囲外は §5 で見る
              const want = oracle(i);
              cases++;
              if (got.house.tax !== want.houseTax || got.land.tax !== want.landTax) {
                if (mismatch === 0) {
                  fails.push(`§2 オラクル不一致 ${acquireDate}/${houseKind}/床${houseFloor}/家${houseValue}/土${landValue}/宅地${isTakuchi} ` +
                    `got=(家${got.house.tax},土${got.land.tax}) want=(家${want.houseTax},土${want.landTax})`);
                }
                mismatch++;
              }
            }
  ok(`§2 条文書き下しオラクルと全域一致（${cases}通り・不一致${mismatch}）`, mismatch === 0);
  ok("§2 検査の母数が十分にある", cases > 3000);
}

// ── §3 手計算の鎖（看板例） ────────────────────────────────────────────────
{
  // 2026-07-01取得・宅地12,000,000円/150㎡・新築住宅15,000,000円/100㎡・その敷地
  const r = run();
  eq("§3 家屋の控除は1,200万円", r.house.kojo, 12000000);
  eq("§3 家屋の課税標準は 1,500万−1,200万＝300万円", r.house.base, 3000000);
  eq("§3 家屋の税率は3％（住宅）", r.house.rate, 3);
  eq("§3 家屋の税額は 300万×3％＝90,000円", r.house.tax, 90000);
  eq("§3 土地の課税標準は 1,200万×1/2＝600万円", r.land.base, 6000000);
  eq("§3 土地の減額前の税額は 600万×3％＝180,000円", r.land.taxBefore, 180000);
  // 1㎡単価＝600万÷150＝40,000円（★1/2読替え後）。床面積の2倍＝200㎡（上限）。
  eq("§3 減額の1㎡単価は1/2読替え後の40,000円", r.land.unitPrice, 40000);
  eq("§3 減額は 40,000×200㎡×3％＝240,000円", r.land.genkaku, 240000);
  eq("§3 減額が税額を上回るので土地は0円", r.land.tax, 0);
  eq("§3 合計は90,000円", r.total, 90000);

  // ★1/2読替えを忘れると単価が80,000円になり減額が480,000円＝2倍になる（過小に答える型）
  ok("§3 1/2読替えを忘れた場合の減額(480,000)とは違う", r.land.genkaku !== 480000);
}

// ── §4 改正の境界（取得日で版が切り替わる） ────────────────────────────────
{
  eq("§4 2026-03-31取得の免税点（土地）は10万円", menzeitenFor("2026-03-31").tochi, 100000);
  eq("§4 2026-04-01取得の免税点（土地）は16万円", menzeitenFor("2026-04-01").tochi, 160000);
  eq("§4 2026-03-31取得の床面積の下限は50㎡", floorYokenFor("2026-03-31").min, 50);
  eq("§4 2026-04-01取得の床面積の下限は40㎡", floorYokenFor("2026-04-01").min, 40);

  // 床面積45㎡の新築住宅：改正の前後で控除の有無が変わる（これがこのツールの目玉）
  const beforeK = run({ acquireDate: "2026-03-31", houseFloor: 45, houseValue: 15000000 });
  const afterK = run({ acquireDate: "2026-04-01", houseFloor: 45, houseValue: 15000000 });
  eq("§4 45㎡・改正前は控除なし", beforeK.house.kojo, 0);
  eq("§4 45㎡・改正後は1,200万円の控除あり", afterK.house.kojo, 12000000);
  ok("§4 45㎡で改正後のほうが家屋の税額が小さい", afterK.house.tax < beforeK.house.tax);

  // 免税点の境界（土地・宅地）：評価額32万円→課税標準16万円ちょうどは課税される
  eq("§4 宅地32万円（課税標準16万円）は課税される", run({ landValue: 320000, houseKind: "none", houseValue: 0 }).land.taxable, true);
  eq("§4 宅地31.8万円（課税標準15.9万円）は免税点未満", run({ landValue: 318000, houseKind: "none", houseValue: 0 }).land.taxable, false);
  // 同じ土地でも改正前の取得なら10万円が線なので課税される
  eq("§4 同じ31.8万円でも改正前の取得は課税される",
    run({ acquireDate: "2026-03-31", landValue: 318000, houseKind: "none", houseValue: 0 }).land.taxable, true);

  // 家屋の免税点は「建築に係るもの」と「その他」で線が違う
  eq("§4 新築家屋50万円は免税点66万円未満で非課税", run({ houseValue: 500000 }).house.taxable, false);
  eq("§4 住宅以外の家屋50万円は免税点34万円以上で課税", run({ houseKind: "hijutaku", houseValue: 500000 }).house.taxable, true);

  // 税率の特例は住宅と土地だけ・期限を過ぎたら本則に戻る
  eq("§5 住宅以外の家屋の税率は4％", rateFor("hijutaku", "2026-07-01"), 4);
  eq("§5 土地の税率は3％", rateFor("tochi", "2026-07-01"), 3);
  eq("§5 特例の期限を過ぎた土地は4％", rateFor("tochi", "2027-04-01"), 4);
  // 期限後は減額も 150万×4％＝60,000円になる（45,000円固定ではない）
  const late = run({ acquireDate: "2027-04-01", landValue: 3000000, landArea: 1000, houseValue: 15000000 });
  eq("§5 期限後の定額減額は150万×4％＝60,000円", late.land.genkaku, 60000);
  const now = run({ landValue: 3000000, landArea: 1000, houseValue: 15000000 });
  eq("§5 期限内の定額減額は150万×3％＝45,000円", now.land.genkaku, 45000);
}

// ── §5 収録範囲外の申告（fail closed） ─────────────────────────────────────
{
  const old = run({ houseKind: "chuko", builtDate: "1995-06-01" });
  eq("§5 2017-04-01より前の新築は収録範囲外", old.uncomputable, true);
  eq("§5 範囲外のとき家屋の税額は0のまま出さない", old.house.tax, 0);
  eq("§5 範囲外のとき合計はnull（推測した額を出さない）", old.total, null);
  ok("§5 範囲外の理由が入っている", old.house.uncomputableReason.includes("2017-04-01"));
  ok("§5 範囲外でも土地の計算は出る", old.land.base > 0);

  const noDate = run({ houseKind: "chuko", builtDate: "" });
  eq("§5 新築年月日が空でも黙って答えない", noDate.uncomputable, true);

  const inRange = run({ houseKind: "chuko", builtDate: "2020-04-01", houseValue: 15000000 });
  eq("§5 2017-04-01以後の中古は控除1,200万円", inRange.house.kojo, 12000000);
  eq("§5 中古で賃貸用なら控除なし（法73条の14第3項）", run({ houseKind: "chuko", selfUse: false }).house.kojo, 0);
  ok("§5 その理由が画面に出る文言として入っている",
    run({ houseKind: "chuko", selfUse: false }).house.kojoReason.includes("自己の居住"));
}

// ── §6 単調性 ──────────────────────────────────────────────────────────────
{
  let bad = 0;
  let prev = -1;
  for (let v = 0; v <= 40000000; v += 500000) {
    const t = run({ houseValue: v }).house.tax;
    if (t < prev) bad++;
    prev = t;
  }
  eq("§6 家屋の評価額が増えて税額が減ることはない", bad, 0);

  bad = 0; prev = -1;
  for (let v = 0; v <= 80000000; v += 1000000) {
    const t = run({ landValue: v, landForHouse: false }).land.tax;
    if (t < prev) bad++;
    prev = t;
  }
  eq("§6 土地の評価額が増えて税額が減ることはない", bad, 0);
}

// ── §7 ページ要素の名指し照合（規則3〜5） ──────────────────────────────────
{
  /**
   * 名指し: そのidを持つ要素の中身だけを取り出す（本文全体への正規表現は使わない）。
   * ★「最初の閉じタグまで」で切ると、中に <b> がある段落は <b> の閉じで切れて
   *   本文の大半が検査から落ちる（実際に7件が素通しした）。同じタグの入れ子を数えて閉じを探す。
   */
  const byId = (id) => {
    const open = PAGE.match(new RegExp(`<([a-z]+)([^>]*\\s)?id="${id}"[^>]*>`));
    if (!open) return "";
    const tag = open[1];
    let i = open.index + open[0].length;
    let depth = 1;
    const re = new RegExp(`</?${tag}[\\s>]`, "g");
    re.lastIndex = i;
    let m;
    while ((m = re.exec(PAGE))) {
      depth += m[0][1] === "/" ? -1 : 1;
      if (depth === 0) return PAGE.slice(i, m.index).replace(/<[^>]+>/g, " ");
    }
    return "";
  };
  /** 表の行を名指しする（主語のセルで一意に特定する＝規則4）。 */
  const rowOf = (tableId, subject) => {
    const t = PAGE.match(new RegExp(`id="${tableId}"[\\s\\S]*?</table>`));
    if (!t) return "";
    const rows = t[0].match(/<tr>[\s\S]*?<\/tr>/g) || [];
    const row = rows.find((r) => r.includes(subject));
    return row ? row.replace(/<[^>]+>/g, " ") : "";
  };

  // ① 免税点の表：改正前と改正後の両方の額が、その区分の行に載っていること
  const rTochi = rowOf("menzeiten-table", "土地");
  ok("§7 免税点の表の土地の行に10万円と16万円がある", rTochi.includes("10万円") && rTochi.includes("16万円"));
  const rKen = rowOf("menzeiten-table", "建築に係るもの");
  ok("§7 免税点の表の建築の行に23万円と66万円がある", rKen.includes("23万円") && rKen.includes("66万円"));
  const rSon = rowOf("menzeiten-table", "その他");
  ok("§7 免税点の表のその他の行に12万円と34万円がある", rSon.includes("12万円") && rSon.includes("34万円"));

  // ② 表の数字はコアの定数と一致していること（片方だけ改定されて嘘になるのを防ぐ）
  const after = menzeitenFor("2026-04-01"), before = menzeitenFor("2026-03-31");
  ok("§7 表の16万円はコアの定数と一致", after.tochi === 160000 && rTochi.includes("16万円"));
  ok("§7 表の10万円はコアの定数と一致", before.tochi === 100000 && rTochi.includes("10万円"));

  // ③ 改正の事実確認（どの施行版を比べたか）が本文の名指しした段落にある
  const kakunin = byId("menzeiten-kakunin");
  ok("§7 免税点の確認段落に2025年10月1日施行版がある", kakunin.includes("2025年10月1日施行版"));
  ok("§7 免税点の確認段落に改正法の番号がある", kakunin.includes("令和8年法律第2号"));

  // ④ 床面積の改正：条文の前後が、名指しした段落の中で対比されている
  const yoken = byId("yoken-jouban");
  ok("§7 床面積の段落に改正前の条文（50㎡・貸家のかっこ書き）がある",
    yoken.includes("五十平方メートル") && yoken.includes("貸家"));
  ok("§7 床面積の段落に「自己居住用でも40㎡から」の主張がある", yoken.includes("自己居住用でも40㎡から"));

  // ⑤ 45,000円の誤解を解く主張（このページの目玉）— 一意な要素を名指しする
  const g45 = byId("tochi-45000");
  ok("§7 45,000円は税率3％のときだけ、と書いている", g45.includes("45,000円になるだけ"));
  ok("§7 4％なら60,000円になると書いている", g45.includes("60,000円"));
  // 独立に計算した値と一致すること（本文の断定を実装で裏取りする）
  eq("§7 定額減額(3％)は本文の45,000円と一致", (SEIDO.tochiGenkakuBase * SEIDO.tokureiRate) / 100, 45000);
  eq("§7 定額減額(4％)は本文の60,000円と一致", (SEIDO.tochiGenkakuBase * SEIDO.honsokuRate) / 100, 60000);

  // ⑥ 1/2読替えの主張（忘れると減額が2倍になる急所）
  const half = byId("tochi-hanbun");
  ok("§7 1/2読替えの段落が附則11条の5第2項を名指ししている", half.includes("附則11条の5第2項"));
  ok("§7 1/2読替えを忘れると減額が2倍になると書いている", half.includes("減額が2倍"));

  // ⑦ 収録範囲の申告（fail closed）が本文にある
  const hani = byId("chuko-hani");
  ok("§7 収録範囲外の申告に2017年4月1日がある", hani.includes("2017年4月1日"));
  ok("§7 収録範囲外の申告に「推測になる」理由がある", hani.includes("推測になる"));
  ok("§7 収録範囲の下限がコアの定数と一致", SEIDO.chukoKojoVerifiedFrom === "2017-04-01");

  // ⑧ 税率の主張（住宅以外は4％）
  const zei = byId("zeiritsu-honbun");
  ok("§7 税率の段落に住宅以外は4％のままと書いてある", zei.includes("4％のまま"));
  ok("§7 税率の段落に25％過小になると書いてある", zei.includes("25％"));

  // ⑨ 評価額≠購入価格の注意（最も多い誤入力）
  ok("§7 評価額の注意が売買代金ではないと書いている", byId("hyoka-setsumei").includes("売買代金や建築工事費ではありません"));

  // ⑩ 計測タグと canonical（新規ページで最も落としやすい）
  ok("§7 GA4 のローダーが1文字列で入っている", PAGE.includes("gtag/js?id=G-E742DSDHPD"));
  ok("§7 AdSense スニペットがある", PAGE.includes("ca-pub-2635067516563578"));
  ok("§7 canonical が正しい", PAGE.includes('rel="canonical" href="https://keiri-tools.com/fudosan-shutoku/"'));

  // ⑪ title は60字以内（検索結果で切れないこと）
  const title = (PAGE.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  ok(`§7 title が60字以内（${title.length}字）`, title.length > 0 && title.length <= 60);

  // ⑫ 目次と h2 が対応している（片方だけ増えるのを防ぐ）
  const h2ids = [...PAGE.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
  const tocIds = [...(PAGE.match(/<nav class="toc">[\s\S]*?<\/nav>/) || [""])[0].matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  eq("§7 目次の項目数と h2 の数が一致", tocIds.length, h2ids.length);
  ok("§7 目次のリンク先が全て h2 に存在する", tocIds.every((id) => h2ids.includes(id)));

  // ⑬ 図解はインラインSVG（外部画像を使わない）
  ok("§7 figure 内にインラインSVGがある", /<figure>[\s\S]*?<svg[\s\S]*?<\/svg>[\s\S]*?<\/figure>/.test(PAGE));
  ok("§7 外部画像の img タグを使っていない", !/<img\s/.test(PAGE));
}

// ────────────────────────────────────────────────────────────────────────────
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log("  ✗ " + f);
  process.exit(1);
}
