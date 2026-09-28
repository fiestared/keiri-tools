// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { checkDigit, classify } from "../../docs/assets/invoice_bangou_core.js";
export const cases = [
  { name: "12桁は登録番号の形式不適合", run: () => (classify('870011000590').status), expected: "format", source: "https://www.invoice-kohyo.nta.go.jp/about-toroku/index.html", quote: "法人番号を有する課税事業者 「T」（ローマ字）＋法人番号（数字13桁）" },
  { name: "公式例の13桁法人番号は検査用数字一致", run: () => (classify('T8700110005901').status), expected: "houjin", source: "https://www.houjin-bangou.nta.go.jp/documents/checkdigit.pdf", quote: "この場合の法人番号は、会社法人等番号「７００１１０００５９０１」の前にチェックデジット「８」を付した「８７００１１０００５９０１」となります。" },
  { name: "14桁は登録番号の形式不適合", run: () => (classify('87001100059010').status), expected: "format", source: "https://www.invoice-kohyo.nta.go.jp/about-toroku/index.html", quote: "上記以外の課税事業者（個人事業者、人格のない社団等） 「T」（ローマ字）＋数字13桁（注）" },
  { name: "公式例の基礎番号の検査用数字は8", run: () => (checkDigit('700110005901')), expected: 8, source: "https://www.houjin-bangou.nta.go.jp/documents/checkdigit.pdf", quote: "9－1＝8（チェックデジット）" },
];
