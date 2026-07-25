// セルフメディケーション税制の「適用期限」の検査。
//
// 背景（2026-07-25 第5便）: データもページも『適用期限は令和8年12月31日まで』とだけ書いていたが、
// 令和8年法律第12号（令和8年度税制改正）で延長・一部恒久化が**既に立法済み**だった。
// 「令和8年12月31日で終わる」と読ませるのは誤り。ここでは
//   ① 条文の書き下しオラクル（現行版／改正後版の逐語）
//   ② データ ⇔ 静的HTML の結合（2箇所が離れて腐らないように1文字ずつ固定）
//   ③ コアの挙動（令和8年分の 12,000円 / 88,000円）がデータから来ていること
//   ④ recheck_after を過ぎたら赤くなるカナリア
// を守る。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { selfmedKojo, calcIryohi } from "../docs/assets/iryohi_core.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(join(HERE, "../docs/assets/iryohi_r08.json"), "utf8"));
const JUMIN = JSON.parse(readFileSync(join(HERE, "../docs/assets/juminzei_r08.json"), "utf8"));
const PAGE = readFileSync(join(HERE, "../docs/iryohi/index.html"), "utf8");

// テスト内で「今日」を差し替えられるようにする（カナリアが施行日後の世界を再現できるように）。
const TODAY = process.env.IRYOHI_KIGEN_TODAY || new Date().toISOString().slice(0, 10);

let n = 0, bad = 0;
const ok = (cond, msg) => { n++; if (!cond) { bad++; console.error("  NG:", msg); } };
const eq = (a, b, msg) => ok(a === b, `${msg} — actual=${JSON.stringify(a)} expected=${JSON.stringify(b)}`);

// ── 入れ子のタグを数えて要素の中身を取り出す（07-25第4便で最初の </ で切れる実装が
//    偽陽性を出したため、数える実装にしてある）。抽出器自身の自己検査つき。
function elementById(html, id) {
  const open = new RegExp(`<([a-z]+)[^>]*\\bid="${id}"[^>]*>`, "i");
  const m = open.exec(html);
  if (!m) return null;
  const tag = m[1];
  let i = m.index + m[0].length, depth = 1;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = i;
  let mm;
  while ((mm = re.exec(html))) {
    depth += mm[1] ? -1 : 1;
    if (depth === 0) return html.slice(i, mm.index);
  }
  return null;
}
const visible = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// ===== 抽出器の自己検査（常に null / 常に空 を返す抽出器なら何を壊しても赤にならない）=====
ok(elementById(PAGE, "selfmed-kigen-note") !== null, "自己検査: selfmed-kigen-note を抽出できる");
ok(elementById(PAGE, "no-such-id-xyz") === null, "自己検査: 存在しないidは null");
ok(visible(elementById(PAGE, "selfmed-kigen-r9")).length > 40, "自己検査: r9 の中身が空でない");

// ===== ① 条文の書き下しオラクル =====================================================
const K = DATA.selfmed.kigen;
eq(DATA.selfmed.floor, 12000, "現行41条の17第1項の読替え『一万二千円』");
eq(DATA.selfmed.cap, 88000, "現行41条の17第1項の読替え『八万八千円』（所法73条1項の二百万円を読み替える）");
eq(K.r8_window_end, "2026-12-31", "現行条文『平成二十九年一月一日から令和八年十二月三十一日までの間に』の終期");
eq(DATA.selfmed.valid_until, K.r8_window_end, "valid_until と kigen.r8_window_end が食い違わない");

const R9 = K.r9_onward;
eq(R9.amend_law, "令和八年法律第十二号", "改正法＝令和8年法律第12号（令和8年度税制改正）");
eq(R9.enforced_from, "2027-01-01", "改正後条文の施行日（e-Gov law_revisions）");
eq(R9.applies_from_year, "令和9年分", "附則46条の適用年分");
ok(/令和九年分以後の所得税について適用し、令和八年分以前の所得税については、なお従前の例による/.test(R9.fusoku),
  "附則46条の逐語（★施行日ではなく適用年分を決めているのは附則）");
ok(/第四十一条の十七/.test(R9.fusoku), "附則46条が41条の17を名指ししている");

// ★2トラック構造：スイッチOTCは終期なし・その他は令和13年12月31日まで
eq(R9.track1_switch_otc.kikan_jobun, "平成二十九年一月一日以後の期間", "改正後1項1号の期間（逐語）");
eq(R9.track1_switch_otc.expires, null, "★1号は終期が書かれていない＝適用期限なし（恒久化）");
eq(R9.track2_sonota.kikan_jobun, "平成二十九年一月一日から令和十三年十二月三十一日までの期間", "改正後1項2号の期間（逐語）");
eq(R9.track2_sonota.expires, "2031-12-31", "★2号の終期＝令和13年12月31日");
ok(R9.track1_switch_otc.expires === null && R9.track2_sonota.expires !== null,
  "★改正後は『単一の適用期限』ではなくなる（区分ごとに別の期限）");
ok(/体外診断用医薬品/.test(R9._taisho_kakudai), "令和9年分から体外診断用医薬品が対象に加わる（2項3号新設）");
ok(/薬局製造販売医薬品/.test(R9._taisho_kakudai), "令和9年分から薬局製造販売医薬品が加わる");
ok(/令和8年分には.*適用されない|令和8年分にはこの/.test(R9._taisho_kakudai),
  "★対象拡大は令和8年分には及ばない（附則46条）ことがデータに書いてある");
ok(/一万二千円/.test(R9._kingaku) && /八万八千円/.test(R9._kingaku),
  "改正後も金額は据え置き（逐語確認の記録）");

// ===== ② データ ⇔ 静的HTML の結合 ====================================================
// 主張が1回だけ現れる最小の要素を名指しする（規則3・5）。
const noteR8 = visible(elementById(PAGE, "selfmed-kigen-r8"));
const noteR9 = visible(elementById(PAGE, "selfmed-kigen-r9"));
const noteTaisho = visible(elementById(PAGE, "selfmed-kigen-taisho"));
const noteAll = visible(elementById(PAGE, "selfmed-kigen-note"));

ok(/令和8年12月31日まで/.test(noteR8), "ページ: 令和8年分の窓の終わりを書いている");
ok(/令和8年分/.test(noteR8), "ページ: それが『令和8年分』の話だと明示している");
ok(/制度の終了ではありません|終わる』ではありません/.test(noteR8 + noteAll),
  "★ページ: 『令和8年12月31日＝制度の終了』ではないと明言している");

ok(/令和8年法律第12号/.test(noteR9), "ページ: 改正法を名指ししている");
ok(/附則46条/.test(noteR9), "ページ: 適用年分の根拠（附則46条）を書いている");
ok(/令和9年分以後/.test(noteR9), "ページ: 適用年分が令和9年分以後であること");
ok(/スイッチOTC医薬品は適用期限なし/.test(noteR9), "★ページ: 1号＝適用期限なし");
ok(/令和13年12月31日まで/.test(noteR9), "★ページ: 2号＝令和13年12月31日まで");
ok(/12,000円超・88,000円限度|12,000円/.test(noteR9), "ページ: 金額が据え置きであること");
ok(/体外診断用医薬品/.test(noteTaisho), "ページ: 対象拡大（体外診断用医薬品）を書いている");
ok(/令和8年分にはこの拡大は適用されない/.test(noteTaisho),
  "★ページ: 対象拡大が令和8年分に及ばないと明言している（過大に案内しない）");

// 「令和8年12月31日で終わる」と読ませる旧い断定が残っていないこと（本文全体）
ok(!/適用期限は<b>令和8年12月31日まで<\/b>で/.test(PAGE),
  "★旧い断定『適用期限は令和8年12月31日まで』がページから消えている");

// 静的HTMLの日付・金額がデータと一致する（2箇所が離れて腐らないように）
const jpDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `令和${y - 2018}年${m}月${d}日`;
};
ok(noteR8.includes(jpDate(K.r8_window_end)), `ページの令和8年分の終期がデータと一致（${jpDate(K.r8_window_end)}）`);
ok(noteR9.includes(jpDate(R9.track2_sonota.expires)), `ページの2号の終期がデータと一致（${jpDate(R9.track2_sonota.expires)}）`);
ok(noteR9.includes(R9.amend_law.replace(/八/g, "8").replace(/十二/, "12")) || noteR9.includes("令和8年法律第12号"),
  "ページの改正法名がデータと一致");

// ===== ③ コアの挙動が **データから** 来ていること ====================================
{
  const r = selfmedKojo(100000, DATA);
  eq(r.floor, DATA.selfmed.floor, "core: 足切りはデータの floor");
  eq(r.cap, DATA.selfmed.cap, "core: 上限はデータの cap");
  eq(r.kojo, 88000, "core: 購入費10万円 → 100,000−12,000=88,000（上限ちょうど）");
}
eq(selfmedKojo(12000, DATA).kojo, 0, "core: 12,000円ちょうどは控除0（『超える』部分だけ）");
eq(selfmedKojo(12001, DATA).kojo, 1, "core: 12,001円で1円");
eq(selfmedKojo(100001, DATA).kojo, 88000, "core: 上限で頭打ち");
eq(selfmedKojo(0, DATA).kojo, 0, "core: 0円は0");
// データを差し替えたら答えも動く（＝直書きでない）ことの証明
{
  const alt = JSON.parse(JSON.stringify(DATA));
  alt.selfmed.floor = 20000; alt.selfmed.cap = 50000;
  eq(selfmedKojo(100000, alt).kojo, 50000, "★core はデータ差し替えに追従する（直書きしていない）");
}

// ===== ④ カナリア ====================================================================
ok(typeof K.recheck_after === "string" && /^\d{4}-\d{2}-\d{2}$/.test(K.recheck_after),
  "recheck_after が日付で入っている");
ok(TODAY <= K.recheck_after,
  `★カナリア: recheck_after(${K.recheck_after}) を過ぎた。selfmed.kigen.expire_note の3分岐に従って令和9年分の扱いを決めること（今日=${TODAY}）`);
ok(K.recheck_after <= K.r8_window_end,
  "recheck_after は令和8年分の窓が閉じる前（＝手遅れになる前に見直す）");
ok(/3分岐|(a)/.test(K.expire_note) && K.expire_note.length > 100,
  "失効時の手順が expire_note に内蔵されている");
ok(/iryohi_r09|令和9年分のデータ/.test(K.expire_note), "expire_note が次に作るものを名指ししている");

// _meta の保守ノートが旧い誤りを「主張として」残していないこと（次に触る人を誤らせる型）。
// ★データは訂正の経緯として旧い誤りを**引用**する（それは正しい）。だから
//   「文字列が在るか」ではなく「誤りと明記されているか」で見る（規則3の要素名指しの発想）。
{
  const stale = "現行法のままなら令和9年分以降は使えなくなる";
  const reason = DATA._meta.next_review_reason;
  const selfmedNote = DATA.selfmed._note + JSON.stringify(DATA.selfmed.kigen);
  ok(!selfmedNote.includes(stale), "★旧い誤りが selfmed の説明文には残っていない");
  if (new RegExp(stale).test(reason)) {
    ok(/は誤りだった|誤りだった/.test(reason),
      "★旧い誤りを引用するなら『誤りだった』と明記されている（引用と主張を区別する）");
  }
  ok(!/^(?!.*誤り).*現行法のままなら令和9年分以降は使えなくなる/.test(reason),
    "★旧い誤りが訂正の注記なしで残っていない");
}
ok(/令和8年法律第12号/.test(DATA._meta.next_review_reason),
  "_meta.next_review_reason が改正の事実に更新されている");
ok(/延長・一部恒久化|適用期限なし/.test(DATA._meta.next_review_reason),
  "★_meta.next_review_reason が『延長された』という結論まで書いている");
ok(/令和9年分のデータを作るかの判断/.test(DATA._meta.next_review_reason),
  "★次の作業が『延長されたかの確認』から『令和9年分を作るかの判断』へ更新されている");

// 総合: 令和8年分の計算そのものは従来どおり正しい（改正は令和9年分以後）
{
  const r = calcIryohi({ kyuyoShunyu: 5000000, iryohi: 50000, selfmedPurchase: 100000 },
    { iryohiData: DATA, juminzeiData: JUMIN });
  eq(r.selfmed.kojo, 88000, "総合: 令和8年分でもセルフメディケーションは従来どおり計算される");
  eq(r.recommended, "selfmed", "総合: 控除額の大きいほうを推す");
}

console.log(bad === 0 ? `test_iryohi_selfmed_kigen: OK (${n})` : `test_iryohi_selfmed_kigen: ${bad}/${n} NG`);
process.exit(bad === 0 ? 0 : 1);
