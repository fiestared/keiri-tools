// break_screen_constants.mjs — test_screen_constants.mjs が本当に錠前として働くかを殴って確かめる。
//
// 規則2: 壊す前に「無傷が緑」を確かめる。常に赤い検査は何を壊しても赤く、嘘の満点を出す。
// 規則8: 素通しを見たら「検査が弱いのか、壊し方が外れたのか」を区別する。
//        → 各壊しに「落ちるべき検査の文言」を持たせ、**狙った検査が落ちたか**まで判定する。

import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const P = (p) => join(ROOT, p);

/** 検査を1回走らせ、{ ok, out } を返す（stderr も混ぜる: 例外死を「落ちた」と取り違えないため） */
async function check() {
  try {
    const { stdout, stderr } = await run("node", [P("tests/test_screen_constants.mjs")], { cwd: ROOT });
    return { ok: true, out: stdout + stderr };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") };
  }
}

const TARGETS = [
  "docs/jutaku/index.html",
  "docs/assets/jutaku_r07.json",
  "docs/papa-ikukyu/index.html",
  "docs/gensen-choshu/index.html",
  "docs/assets/gensen_core.js",
];

// ── ベースライン（規則2）────────────────────────────────────────────
const base = await check();
if (!base.ok) {
  console.error("✗ ベースラインが赤い。壊しテストは意味を持たないので降りる:\n" + base.out);
  process.exit(1);
}
console.log("✓ ベースライン緑（無傷の状態で検査が通る）");

// 原本を退避
const original = new Map();
for (const t of TARGETS) original.set(t, await readFile(P(t), "utf8"));
const restore = async () => {
  for (const [t, s] of original) await writeFile(P(t), s);
};

const BREAKS = [
  {
    name: "① /jutaku/ の入居年リストから 2027 を落とす（データにはある年が画面から消える）",
    file: "docs/jutaku/index.html",
    apply: (s) => s.replace("const FALLBACK_YEARS = [2022, 2023, 2024, 2025, 2026, 2027]",
                            "const FALLBACK_YEARS = [2022, 2023, 2024, 2025, 2026]"),
    expect: /入居年の選択肢が参照データの years とずれている/,
  },
  {
    name: "② 参照データに 2028 を足す（データに年を足したのに画面が追随していない状態）",
    file: "docs/assets/jutaku_r07.json",
    apply: (s) => {
      const d = JSON.parse(s);
      // 新築・認定住宅の years に 2028 を足す（2027の内容をそのまま複製）
      d.kubun.nintei.years["2028"] = d.kubun.nintei.years["2027"];
      return JSON.stringify(d, null, 2);
    },
    expect: /入居年の選択肢が参照データの years とずれている/,
  },
  {
    name: "③ /jutaku/ の既定の入居年をデータに無い年にする",
    file: "docs/jutaku/index.html",
    apply: (s) => s.replace("const DEFAULT_YEAR = 2026", "const DEFAULT_YEAR = 2030"),
    expect: /既定の入居年 2030 が参照データに無い/,
  },
  {
    name: "④ /jutaku/ がデータ到着後に選択肢を作り直すのをやめる（暫定リストで固定される）",
    file: "docs/jutaku/index.html",
    apply: (s) => s.replace("  if (years.length) buildYearOptions(years);", "  // (無効化)"),
    expect: /選択肢を作り直していない/,
  },
  {
    name: "⑤ /papa-ikukyu/ が 13% をページ内で直接掛ける（正本＝コアの RATE_SHIEN を使わない）",
    file: "docs/papa-ikukyu/index.html",
    apply: (s) => s.replace(
      "const would = shienKyufu(",
      "const wouldGetOld = Math.floor(r.daily * 14 * 0.13);\n    const would = shienKyufu(",
    ),
    expect: /13%\(0\.13\) を直接掛けている/,
  },
  {
    name: "⑥ /papa-ikukyu/ が SHIEN_MIN_DAYS の import をやめる",
    file: "docs/papa-ikukyu/index.html",
    apply: (s) => s.replace(
      "import { calcPapaIkukyu, shienKyufu, SHIEN_MIN_DAYS } from",
      "import { calcPapaIkukyu, shienKyufu } from",
    ),
    expect: /SHIEN_MIN_DAYS を import していない/,
  },
  {
    name: "⑦ /gensen-choshu/ が消費税率をページに書き戻す",
    file: "docs/gensen-choshu/index.html",
    apply: (s) => s.replace('taxMode === "none" ? 0 : RATE_SHOHIZEI', 'taxMode === "none" ? 0 : 0.1'),
    expect: /消費税率のリテラル/,
  },
  {
    name: "⑧ /gensen-choshu/ が表示ラベルだけ手書きに戻す（率と表示が別々に腐る形）",
    file: "docs/gensen-choshu/index.html",
    apply: (s) => s.replace("消費税（${RATE_SHOHIZEI_LABEL}）", "消費税（10%）"),
    expect: /RATE_SHOHIZEI_LABEL から描いていない/,
  },
  {
    // ★初版の壊し方（ラベルを "10%" に固定するだけ）は**素通しした**。率が 0.10 のうちは
    //   ハードコードでも値が一致するので、検査は正しく緑だった（＝壊し方が外れていた・規則8）。
    //   危険が現れるのは**率が変わったとき**なので、率の変更と複合させて初めて錠前を試せる。
    name: "⑨ ラベルを手書きに固定した上で率を8%に変える（片方だけ直る＝いちばん危ない形）",
    file: "docs/assets/gensen_core.js",
    apply: (s) => s
      .replace("export const RATE_SHOHIZEI = 0.10;", "export const RATE_SHOHIZEI = 0.08;")
      .replace(
        "export const RATE_SHOHIZEI_LABEL = `${RATE_SHOHIZEI * 100}%`;",
        'export const RATE_SHOHIZEI_LABEL = "10%";',
      ),
    // ★expect は**実際のメッセージから引き写す**（"RATE_SHOHIZEI から" と書いたが
    //   実メッセージは "RATE_SHOHIZEI（0.08）から" で、狙いどおり落ちているのに
    //   「狙い外れ」と報告された。前便までに何度も踏んでいる私の側の取り違え）。
    expect: /RATE_SHOHIZEI（[\d.]+）から導かれていない/,
  },
  {
    name: "⑩ コアの消費税率を8%に変える（ラベルが追随することの確認＝逆向きの検査）",
    file: "docs/assets/gensen_core.js",
    apply: (s) => s.replace("export const RATE_SHOHIZEI = 0.10;", "export const RATE_SHOHIZEI = 0.08;"),
    // ★これは**落ちてはいけない**壊し。率を変えればラベルも "8%" に追随するので検査は緑のまま。
    //   （率が変わったときに検査が邪魔をするなら、それは正しい商品を落とす検査になっている）
    expectPass: true,
  },
];

let caught = 0, missed = 0, offTarget = 0, wrongPass = 0;

for (const b of BREAKS) {
  const src = original.get(b.file);
  const broken = b.apply(src);
  if (broken === src) {
    console.log(`❌ 壊し方が外れた（置換が一致しなかった）: ${b.name}`);
    offTarget++;
    continue;
  }
  await writeFile(P(b.file), broken);
  const r = await check();
  await restore();

  if (b.expectPass) {
    if (r.ok) { console.log(`✓ 通るべきものが通った: ${b.name}`); caught++; }
    else { console.log(`❌ 正しい変更を落とした（過剰な検査）: ${b.name}\n   ${r.out.trim().split("\n")[1] || ""}`); wrongPass++; }
    continue;
  }

  if (r.ok) {
    console.log(`❌ 素通し: ${b.name}`);
    missed++;
  } else if (b.expect.test(r.out)) {
    console.log(`✓ 捕捉: ${b.name}`);
    caught++;
  } else {
    console.log(`⚠️ 赤いが狙いと違う検査が落ちた（壊し方が外れた可能性）: ${b.name}\n   出力: ${r.out.trim().slice(0, 200)}`);
    offTarget++;
  }
}

// 復元できたことを確認（壊したまま終わると、以後の検査が全部嘘になる）
const after = await check();
console.log(`\n復元後のベースライン: ${after.ok ? "✓ 緑" : "✗ 赤（壊れたまま！）"}`);

console.log(`\n捕捉 ${caught} / 素通し ${missed} / 狙い外れ ${offTarget} / 正しい変更を落とした ${wrongPass}`);
if (missed || wrongPass || !after.ok) process.exit(1);
