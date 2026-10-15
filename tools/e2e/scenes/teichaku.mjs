// /teichaku/（就業促進定着手当）の入力欄の誤り表示。2026-10-15 追加。
// 正常系（公表例 91,500円）は harness.html の teichaku シーンにある。ここは「誤った入力で、欄に結び付いた誤りが出て、
// 答えは出ない」ことを見る。
import { uxFieldErrorExpect } from "../scene_lib.mjs";

// 離職前の賃金日額（zen）以外を正しく埋めた状態。zen を空欄で押す → zen に誤り → 10000 を入れて直すと答えが出る
const FILL = {
  shushoku: "2026-04-01",
  w1: "285000", w2: "285000", w3: "285000", w4: "285000", w5: "285000", w6: "285000",
  daily: "6307", remaining: "90",
};
// 金額の答え（「就業促進定着手当 ¥…」）が結果欄に出ていないこと
const NO_ANSWER = /就業促進定着手当\s*¥[\d,]+/;

export const scenes = [
  { name: "ux_field_error_teichaku", noCoverage: true, uxFieldError: true,
    expect: (s) => uxFieldErrorExpect()(s) && s.noAnswerOnError && /91,500/.test(s.resultAfter) },
  // 範囲外（離職時の年齢 70歳。この計算機は64歳まで）→ 年齢の欄に誤り・答えは出さない。直すと答えが出る
  { name: "ux_field_error_teichaku_age", noCoverage: true, expect: (s) =>
      s.ageInvalid && s.ageFocused && s.ageWarnLinked && /15〜64歳/.test(s.warn) && !s.answerOnError &&
      s.copyOnError === false && s.answerAfter === 91500 },
];

export const harness = (H) => ({
  async ux_field_error_teichaku() {
    const st = await H.fieldErrorScene({ path: "/docs/teichaku/", field: "zen", value: "10000", fill: FILL,
      // 誤りが出ている間の結果欄を、直す前に控える
      onError: (doc) => ({ noAnswerOnError: !NO_ANSWER.test(H.text(doc, "result")) }) })();
    return st;
  },
  async ux_field_error_teichaku_age() {
    const doc = await H.open("/docs/teichaku/");
    for (const [id, v] of Object.entries(FILL)) H.set(doc, id, v);
    H.set(doc, "zen", "10000");
    H.set(doc, "age", "70");
    const el = doc.getElementById("age");
    H.click(doc, "calc");
    await H.waitFor(() => el.getAttribute("aria-invalid") === "true", "年齢の欄の aria-invalid");
    const body = H.text(doc, "result");
    const out = {
      ageInvalid: true,
      ageFocused: doc.activeElement === el,
      ageWarnLinked: !!doc.querySelector('#result .warn[data-field="age"]'),
      warn: body,
      answerOnError: NO_ANSWER.test(body),
      copyOnError: H.copyShown(doc),
    };
    H.set(doc, "age", "35");
    H.click(doc, "calc");
    await H.waitFor(() => NO_ANSWER.test(H.text(doc, "result")), "直した後の計算結果");
    const m = H.text(doc, "result").match(/就業促進定着手当\s*¥([\d,]+)/);
    return { ...out, answerAfter: m ? Number(m[1].replace(/,/g, "")) : null };
  },
});
