// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { jigyonushiFutan } from "../../docs/assets/hoteifukuri_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const S = load("shaho_rates_r08.json");
export const cases = [
  { name: "介護保険第2号でない区分は介護保険の会社負担0円", run: () => (jigyonushiFutan({hyojun:300000,chingin:300000,kenkoPct:9.85,kaigo:false,koyouType:'general',rousaiSen:3}, S).kaigo), expected: 0, source: "https://www.kyoukaikenpo.or.jp/about/business/insurance_rate/rate_prefectures/r08", quote: "40歳から64歳までの方（介護保険第2号被保険者）は、上記「健康保険料率」と「子ども・子育て支援金（0.23％）」に全国一律の介護保険料率（1.62％）が加わります。" },
  { name: "介護保険第2号区分は標準報酬30万円・1.62%の会社負担2430円", run: () => (jigyonushiFutan({hyojun:300000,chingin:300000,kenkoPct:9.85,kaigo:true,koyouType:'general',rousaiSen:3}, S).kaigo), expected: 2430, source: "https://www.kyoukaikenpo.or.jp/about/business/insurance_rate/rate_prefectures/r08", quote: "40歳から64歳までの方（介護保険第2号被保険者）は、上記「健康保険料率」と「子ども・子育て支援金（0.23％）」に全国一律の介護保険料率（1.62％）が加わります。" },
  { name: "厚生年金標準報酬月額65万円で会社負担5万9475円", run: () => (jigyonushiFutan({hyojun:650000,chingin:300000,kenkoPct:9.85,kaigo:false,koyouType:'general',rousaiSen:3}, S).kosei), expected: 59475, source: "https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/ryogakuhyo/20200825.html", quote: "令和2年9月分（10月納付分）から、厚生年金保険の標準報酬月額の上限（32等級）が650千円となりました。" },
  { name: "現行上限65万円を1円超えても厚生年金の会社負担は増えない", run: () => (jigyonushiFutan({hyojun:650001,chingin:300000,kenkoPct:9.85,kaigo:false,koyouType:'general',rousaiSen:3}, S).kosei), expected: 59475, source: "https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/ryogakuhyo/20200825.html", quote: "厚生年金保険の標準報酬月額の上限（32等級）が650千円となりました。" },
];
