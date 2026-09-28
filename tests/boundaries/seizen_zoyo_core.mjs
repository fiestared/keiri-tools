// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { kanenKasanMado } from "../../docs/assets/seizen_zoyo_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("seizen_zoyo_r08.json");
export const cases = [
  { name: "2031年以降の7年加算モデル: 最後の贈与が相続開始3年前なら全額加算帯", run: () => (kanenKasanMado(1, 3, D.kanen_kasan)), expected: {"nFull": 1, "nBand": 0, "nOut": 0}, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/sozoku/4161.htm", quote: "相続開始前3年以内に取得した財産" },
  { name: "2031年以降の7年加算モデル: 最後の贈与が相続開始4年前なら100万円控除帯", run: () => (kanenKasanMado(1, 4, D.kanen_kasan)), expected: {"nFull": 0, "nBand": 1, "nOut": 0}, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/sozoku/4161.htm", quote: "相続開始前3年以内に取得した財産以外の財産については、その財産の贈与時の価額の合計額から総額100万円までは相続税の課税価格に加算されません。" },
  { name: "2031年以降の7年加算モデル: 最後の贈与が相続開始7年前なら加算対象内", run: () => (kanenKasanMado(1, 7, D.kanen_kasan)), expected: {"nFull": 0, "nBand": 1, "nOut": 0}, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/sozoku/4161.htm", quote: "令和13年1月1日～ 相続開始前7年以内（死亡の日から遡って7年前の日から死亡の日までの間）" },
  { name: "2031年以降の7年加算モデル: 最後の贈与が相続開始8年前なら加算対象外", run: () => (kanenKasanMado(1, 8, D.kanen_kasan)), expected: {"nFull": 0, "nBand": 0, "nOut": 1}, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/sozoku/4161.htm", quote: "令和13年1月1日～ 相続開始前7年以内（死亡の日から遡って7年前の日から死亡の日までの間）" },
];
