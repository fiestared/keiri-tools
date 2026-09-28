// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calcNiniKeizoku } from "../../docs/assets/nini_keizoku_core.js";
export const cases = [
  { name: "介護保険年齢下限の1歳下（39歳）", run: () => (calcNiniKeizoku({hyojunHoshu:320000,age:39,kenkoRate:9.85,kaigoRate:1.62,kosodateRate:0.23,capYen:320000}).total), expected: 32256, source: "https://www.kyoukaikenpo.or.jp/about/business/insurance_rate/rate_prefectures/r08/", quote: "40歳から64歳までの方（介護保険第2号被保険者）は、上記「健康保険料率」と「子ども・子育て支援金（0.23％）」に全国一律の介護保険料率（1.62％）が加わります。" },
  { name: "介護保険年齢下限到達（40歳）", run: () => (calcNiniKeizoku({hyojunHoshu:320000,age:40,kenkoRate:9.85,kaigoRate:1.62,kosodateRate:0.23,capYen:320000}).total), expected: 37440, source: "https://www.kyoukaikenpo.or.jp/about/business/insurance_rate/rate_prefectures/r08/", quote: "40歳から64歳までの方（介護保険第2号被保険者）は、上記「健康保険料率」と「子ども・子育て支援金（0.23％）」に全国一律の介護保険料率（1.62％）が加わります。" },
  { name: "介護保険年齢上限内（64歳）", run: () => (calcNiniKeizoku({hyojunHoshu:320000,age:64,kenkoRate:9.85,kaigoRate:1.62,kosodateRate:0.23,capYen:320000}).total), expected: 37440, source: "https://www.kyoukaikenpo.or.jp/about/business/insurance_rate/rate_prefectures/r08/", quote: "40歳から64歳までの方（介護保険第2号被保険者）は、上記「健康保険料率」と「子ども・子育て支援金（0.23％）」に全国一律の介護保険料率（1.62％）が加わります。" },
  { name: "介護保険年齢上限超過（65歳）", run: () => (calcNiniKeizoku({hyojunHoshu:320000,age:65,kenkoRate:9.85,kaigoRate:1.62,kosodateRate:0.23,capYen:320000}).total), expected: 32256, source: "https://www.kyoukaikenpo.or.jp/benefit/voluntary_continuation/", quote: "任意継続加入中に65歳になり介護保険第2号被保険者に該当しなくなった場合" },
];
