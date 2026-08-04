import assert from "node:assert";
import { readFileSync } from "node:fs";
import { calc } from "../docs/assets/juminzei_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/juminzei_r08.json", import.meta.url), "utf8"));

/**
 * /juminzei/ は「令和8年分の所得にもとづく計算」と表示する。表示と計算をそろえるため
 * zeisei:'r8' で計算する（2026-08-04 のペルソナレビュー指摘）。
 * ★ここは「表示と計算が一致していること」を数字で固定するテスト。
 *   令和7年分の規則に戻ると、収入220万円以下で給与所得控除が65万に下がり値が変わる。
 */
const base = (shunyu, shakai) => ({
  kyuyoShunyu: shunyu, shakaiHoken: shakai, family: { haigusha: "none" },
  jichitai: "tokyo23", kyuchi: "1",
});

// 令和8年分は給与所得控除74万（収入220万円以下）。令和7年分は65万
assert.equal(calc({ ...base(1_150_000, 170_000), zeisei: "r8" }, D).kyuyoShotoku, 410_000);
assert.equal(calc(base(1_150_000, 170_000), D).kyuyoShotoku, 500_000, "zeisei無しは令和7年分（＝表示と食い違う）");

// ★年収115万は令和8年分の規則では非課税になる（令和7年分では課税）
const r8 = calc({ ...base(1_150_000, 170_000), zeisei: "r8" }, D);
assert.equal(r8.hikazei.shotokuwariHikazei, true, "所得割は非課税");

// 収入220万円超は改正の影響を受けない（給与所得控除が同じ）
for (const shunyu of [3_000_000, 5_000_000, 8_000_000]) {
  const a = calc(base(shunyu, 0), D);
  const b = calc({ ...base(shunyu, 0), zeisei: "r8" }, D);
  assert.equal(a.kyuyoShotoku, b.kyuyoShotoku, `年収${shunyu}は給与所得が同じ`);
}

// 引き継ぎ先とそろえる年分: 所得税の基礎控除は令和8年分104万（令和7年分は68万）
import { shotokuzeiKisoKojo } from "../docs/assets/juminzei_core.js";
assert.equal(shotokuzeiKisoKojo(3_560_000, D, "r8"), 1_040_000);
assert.equal(shotokuzeiKisoKojo(3_560_000, D), 680_000);

console.log("✓ 住民税ツールの年分（令和8年分）OK");
