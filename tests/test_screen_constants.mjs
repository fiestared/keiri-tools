// test_screen_constants.mjs — 画面が手書きしている「率・年」が、正本（コアの定数／参照データ）と
// 一致していることを機械で守る。**手で2箇所を同期し続ける設計は必ず腐る**（CLAUDE.md）。
//
// なぜ要るか（2026-07-26 第4便に実在した3件）:
//   ① /papa-ikukyu/ が `Math.floor(r.daily * 14 * 0.13)` と**ページに率を手書き**していた。
//      コアには検証済みの `RATE_SHIEN = 0.13` / `SHIEN_MIN_DAYS = 14` があるのに使っていない。
//      率が変われば**コアだけ直って画面が古い率で誘導する**（しかも金額は「約」なので気づけない）。
//   ② /gensen-choshu/ が消費税率を `0.1` と書き、表示ラベルを別に「消費税（10%）」と書いていた。
//      **同じ量を2箇所で持つ**ので、税率が変わった日に片方だけ直る（計算は新率・表示は旧率、逆もある）。
//   ③ /jutaku/ が入居年の選択肢を `[2022…2027]` と手書きし、参照データの years と**手で同期**していた。
//      データに令和10年を足しても**選択肢に出ない＝利用者がその年に辿り着けない**（収録済みなのに）。
//
// ★単体テストはコアだけを見る（ページ内スクリプトは素通し）。E2Eは自分で入力を与える。
//   「ページが正本を使わず自分で数値を持っている」ことは、**そのどちらも検査していない**。
//
// 設計（test_enumeration_completeness.mjs と同型）:
//   - 正本（コアの export / データの JSON）から**実際に値を読み**、画面側の手書きと突き合わせる。
//   - 「無いこと」の検査（禁止リテラル）は、対象を**ページ内スクリプトに限定**する。
//     本文の説明文の「13%」「10%」は制度の呼称なので禁止しない（消すと日本語が壊れる）。

import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RATE_SHIEN, SHIEN_MIN_DAYS } from "../docs/assets/ikuji_core.js";
import { RATE_SHOHIZEI, RATE_SHOHIZEI_LABEL } from "../docs/assets/gensen_core.js";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const read = (p) => readFile(join(ROOT, p), "utf8");

/** ページ内の `<script type="module">` の中身だけを取り出す（本文の説明文を巻き込まない） */
function scriptOf(html) {
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  return m ? m[1] : null;
}

let checks = 0;
const problems = [];
const bad = (msg) => problems.push(msg);

// ── §1 /jutaku/ の入居年の選択肢 == 参照データの years ──────────────────────────
{
  const html = await read("docs/jutaku/index.html");
  const D = JSON.parse(await read("docs/assets/jutaku_r07.json"));

  const dataYears = [...new Set([
    ...Object.keys(D.kubun.nintei.years),
    ...Object.keys(D.chuko.kubun.nintei.years),
  ].map(Number))].sort((a, b) => a - b);

  const m = html.match(/const FALLBACK_YEARS = \[([\d,\s]+)\]/);
  checks++;
  if (!m) {
    bad("docs/jutaku/index.html: 入居年の暫定リスト（const FALLBACK_YEARS = [...]）が見つからない。" +
        "選択肢の作り方を変えたなら、この検査も作り直すこと（正本＝データの years との一致を誰も見なくなる）。");
  } else {
    const pageYears = m[1].split(",").map((s) => Number(s.trim())).filter(Number.isFinite).sort((a, b) => a - b);
    checks++;
    if (JSON.stringify(pageYears) !== JSON.stringify(dataYears)) {
      bad(
        `docs/jutaku/index.html: 入居年の選択肢が参照データの years とずれている。\n` +
        `      画面(FALLBACK_YEARS) = [${pageYears}]\n` +
        `      データ(jutaku_r07.json の years) = [${dataYears}]\n` +
        `      → データにある年が画面に無いと、**収録済みの年なのに利用者が選べない**（住宅ローン控除は\n` +
        `        入居年で借入限度額が決まるので、選べない年の人はツールに辿り着けない）。\n` +
        `        逆に画面にだけある年は、選んだ瞬間「収録範囲の外です」と言われる。`
      );
    }
  }

  // 既定値がデータに実在すること（既定が収録外だと、開いた瞬間「範囲外」の画面になる）
  const dm = html.match(/const DEFAULT_YEAR = (\d+)/);
  checks++;
  if (!dm) bad("docs/jutaku/index.html: 既定の入居年（const DEFAULT_YEAR）が見つからない。");
  else if (!dataYears.includes(Number(dm[1]))) {
    bad(`docs/jutaku/index.html: 既定の入居年 ${dm[1]} が参照データに無い（years=[${dataYears}]）。` +
        `ページを開いた瞬間に「収録範囲の外です」と表示される。`);
  }

  // データ到着後に選択肢を作り直しているか（＝データが正本であることが実装に現れているか）
  // ★`buildYearOptions(` の**存在**で見てはいけない（定義と初回の暫定リスト呼び出しにも出るので、
  //   再構築を消しても素通しする＝規則3。実際に壊しテスト④が素通しして分かった）。
  //   **データから作った years を渡して呼んでいること**まで見る。
  checks++;
  const script = scriptOf(html) || "";
  if (!/buildYearOptions\(years\)/.test(script) || !/D\.kubun\.nintei\.years/.test(script)) {
    bad("docs/jutaku/index.html: 参照データ到着後に、データの years から入居年の選択肢を作り直していない。" +
        "暫定リストだけだと、データに年を足しても画面に出ない（収録済みの年に利用者が辿り着けない）。");
  }
}

// ── §2 /papa-ikukyu/ が 13% と 14日 を手書きしていないこと（コアの定数を使う）──────────
{
  const html = await read("docs/papa-ikukyu/index.html");
  const script = scriptOf(html);
  checks++;
  if (!script) bad("docs/papa-ikukyu/index.html: <script type=\"module\"> が見つからない。");
  else {
    checks++;
    if (/\bimport\s*{[^}]*\bSHIEN_MIN_DAYS\b[^}]*}\s*from/.test(script) === false) {
      bad("docs/papa-ikukyu/index.html: コアの SHIEN_MIN_DAYS を import していない。" +
          "14日の要件をページ側に持つと、法が変われば画面だけ古い日数で案内する。");
    }
    // 率をページ内で掛けていないか（コアの shienKyufu / RATE_SHIEN を使うべき）
    checks++;
    const litRate = script.match(/[*×]\s*0\.13\b|\b0\.13\s*[*×]/);
    if (litRate) {
      bad(`docs/papa-ikukyu/index.html: ページ内スクリプトで 13%(0.13) を直接掛けている（"${litRate[0]}"）。` +
          `コアの RATE_SHIEN（現在 ${RATE_SHIEN}）を使うこと。`);
    }
    // 14日の閾値をページ内で引き算していないか
    checks++;
    const litDays = script.match(/\b14\s*-\s*r\.payDays\b/);
    if (litDays) {
      bad(`docs/papa-ikukyu/index.html: ページ内スクリプトで 14日 を直接書いている（"${litDays[0]}"）。` +
          `コアの SHIEN_MIN_DAYS（現在 ${SHIEN_MIN_DAYS}）を使うこと。`);
    }
  }

  // 本文が名乗る「13%」がコアの率と一致していること（説明文だけ古い率になるのを防ぐ）
  checks++;
  const label = `${RATE_SHIEN * 100}%`; // "13%"
  if (!html.includes(label)) {
    bad(`docs/papa-ikukyu/index.html: 本文にコアの率 ${label}（RATE_SHIEN=${RATE_SHIEN}）が出てこない。` +
        `コアの率を変えたなら、画面の説明文も直すこと。`);
  }
}

// ── §3 /gensen-choshu/ の消費税率が1つの正本から描かれていること ────────────────────
{
  const html = await read("docs/gensen-choshu/index.html");
  const script = scriptOf(html);
  checks++;
  if (!script) bad("docs/gensen-choshu/index.html: <script type=\"module\"> が見つからない。");
  else {
    checks++;
    if (!/\bimport\s*{[^}]*\bRATE_SHOHIZEI\b[^}]*}\s*from/.test(script)) {
      bad("docs/gensen-choshu/index.html: コアの RATE_SHOHIZEI を import していない。");
    }
    // 税率のリテラルが残っていないか。0.1021（源泉徴収の率）は別物なので当てない
    checks++;
    const lit = script.match(/[:=]\s*0\.1(?![0-9])/);
    if (lit) {
      bad(`docs/gensen-choshu/index.html: ページ内スクリプトに消費税率のリテラル（"${lit[0].trim()}"）が残っている。` +
          `コアの RATE_SHOHIZEI（現在 ${RATE_SHOHIZEI}）を使うこと。`);
    }
    // 表示ラベルも同じ正本から描いているか（率と表示を別々に持つと片方だけ直る）
    // ★`RATE_SHOHIZEI_LABEL` の**存在**で見てはいけない（import 行に名前が残るので、
    //   表示側を手書きに戻しても素通しする＝規則3。壊しテスト⑧が素通しして分かった）。
    //   **ハードコードされた率の表示が無いこと**を直接見る。
    checks++;
    const hardLabel = script.match(/消費税（\s*\d+(?:\.\d+)?\s*%\s*）/);
    if (hardLabel) {
      bad(`docs/gensen-choshu/index.html: 消費税の表示ラベルを手書きしている（"${hardLabel[0]}"）。` +
          `RATE_SHOHIZEI_LABEL（現在 ${RATE_SHOHIZEI_LABEL}）から描くこと。` +
          `率と表示を別々に持つと、税率が変わった日に片方だけ直る。`);
    }
    checks++;
    if (!/消費税（\$\{RATE_SHOHIZEI_LABEL\}）/.test(script)) {
      bad("docs/gensen-choshu/index.html: 結果表の消費税の表示ラベルを RATE_SHOHIZEI_LABEL から描いていない。");
    }
  }

  // ラベルが率から導かれていること（コア側の自己整合）
  checks++;
  if (RATE_SHOHIZEI_LABEL !== `${RATE_SHOHIZEI * 100}%`) {
    bad(`gensen_core.js: RATE_SHOHIZEI_LABEL（${RATE_SHOHIZEI_LABEL}）が RATE_SHOHIZEI（${RATE_SHOHIZEI}）から導かれていない。`);
  }
}

// ── §4 トップページの再就職手当カードが名指ししている2つの額 ─────────────────────
// ★トップは静的HTMLなので、ツールのページと違って**データから描けない**。だから額を書くなら
//   「書いてよい代わりに、改定日に必ず赤くする」錠前が要る。
//   この2つ（45〜59歳の基本手当日額の上限 / 再就職手当の計算に使う日額の上限）は
//   **毎年8月1日に一緒に改定される**ので、放置すると**トップだけが古い額を名乗る**。
//   カードの主張は「9,110円が6,745円で頭打ち」という**対比そのもの**なので、
//   片方だけ古くなると主張が壊れる（両方を正本と突き合わせる）。
{
  const html = await read("docs/index.html");
  const D = JSON.parse(await read("docs/assets/kihonteate_r07.json"));
  const { saishushokuCap } = await import("../docs/assets/saishushoku_core.js");

  // カードの中だけを見る（規則3: 本文のどこかに在る、では素通しする）
  const card = html.match(/<a class="tool-card" href="saishushoku\/">[\s\S]*?<\/a>/)?.[0];
  checks++;
  if (!card) {
    bad("docs/index.html: 再就職手当のツールカードが見つからない（カードを消したなら、この§も消すこと）。");
  } else {
    const yen = (n) => n.toLocaleString("ja-JP");
    for (const [label, want] of [
      ["45〜59歳の基本手当日額の上限", D.kihon_nichigaku_max.age45_59],
      ["再就職手当の計算に使う日額の上限（59歳以下）", saishushokuCap(45, D)],
    ]) {
      checks++;
      if (!card.includes(yen(want))) {
        bad(`docs/index.html の再就職手当カード: ${label}が正本と一致しない（正本 ${yen(want)} 円が` +
            `カードに書かれていない）。毎年8月1日に改定される額なので、カードの文言を書き換えること。`);
      }
    }
  }
}

if (problems.length) {
  console.error(`✗ test_screen_constants: ${problems.length}件`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`✓ test_screen_constants: ${checks} checks`);
