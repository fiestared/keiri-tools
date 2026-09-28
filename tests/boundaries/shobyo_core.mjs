// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { shikyuNissu, keizokuKyufu } from "../../docs/assets/shobyo_core.js";
export const cases = [
  { name: "待期3日境界の1日下（休業2日）", run: () => (shikyuNissu(2, false)), expected: 0, source: "https://laws.e-gov.go.jp/api/2/law_data/211AC0000000070?response_format=xml", quote: "その労務に服することができなくなった日から起算して三日を経過した日から労務に服することができない期間、傷病手当金を支給する。" },
  { name: "待期3日境界の1日上（休業4日）", run: () => (shikyuNissu(4, false)), expected: 1, source: "https://laws.e-gov.go.jp/api/2/law_data/211AC0000000070?response_format=xml", quote: "その労務に服することができなくなった日から起算して三日を経過した日から労務に服することができない期間、傷病手当金を支給する。" },
  { name: "資格喪失後継続給付の1年要件の1月下（11月）", run: () => (keizokuKyufu({hihokenshaMonths:11, receivingAtLoss:true}).ok), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/211AC0000000070?response_format=xml", quote: "被保険者の資格を喪失した日（任意継続被保険者の資格を喪失した者にあっては、その資格を取得した日）の前日まで引き続き一年以上被保険者（任意継続被保険者又は共済組合の組合員である被保険者を除く。）であった者（第百六条において「一年以上被保険者であった者」という。）であって、その資格を喪失した際に傷病手当金又は出産手当金の支給を受けているものは、被保険者として受けることができるはずであった期間、継続して同一の保険者からその給付を受けることができる。" },
  { name: "資格喪失後継続給付の1年要件の1月上（13月）", run: () => (keizokuKyufu({hihokenshaMonths:13, receivingAtLoss:true}).ok), expected: true, source: "https://laws.e-gov.go.jp/api/2/law_data/211AC0000000070?response_format=xml", quote: "被保険者の資格を喪失した日（任意継続被保険者の資格を喪失した者にあっては、その資格を取得した日）の前日まで引き続き一年以上被保険者（任意継続被保険者又は共済組合の組合員である被保険者を除く。）であった者（第百六条において「一年以上被保険者であった者」という。）であって、その資格を喪失した際に傷病手当金又は出産手当金の支給を受けているものは、被保険者として受けることができるはずであった期間、継続して同一の保険者からその給付を受けることができる。" },
];
