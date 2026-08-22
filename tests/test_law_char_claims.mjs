/**
 * 記事が書いた「法令名（N字）」を、tools/law_chars.json（正本台帳）と突き合わせる。
 *
 * 🔴 なぜこの検査が要るか（2026-08-22 第8便の実測）:
 *   同じサイトの記事が、同じ法人税法に **3通りの字数** を書いていた。
 *       601,115（law_text 生連結）/ 600,520（squash）/ 611,879（extract が \n を注入）
 *   どれも「e-Gov API v2 で全文を取得して実測」と名乗り、**どれも本当に実測されていた**。
 *   食い違いの正体は「どの関数で数えたか」。読者から見れば、同じサイトが同じ法律の
 *   長さを3通りに言っている＝**検算されたら終わり**の種類の傷。
 *
 *   人が気をつける形の対策（申し送りに「方法を明記する」と書く）は、
 *   **別の便が別の道具で数えた瞬間に破れる**。だから機械で縛る。
 *
 *   ★正本は squash（空白除去）。理由は tools/law_chars.py の docstring を読むこと。
 *   台帳を作り直すには: python3 tools/law_chars.py --scan /tmp/law_*.json
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ledger = JSON.parse(readFileSync(join(root, "tools/law_chars.json"), "utf8"));

// 記事中の略称 → 台帳の正式名
const ALIAS = {
  "財務諸表等規則": "財務諸表等の用語、様式及び作成方法に関する規則",
  "財規": "財務諸表等の用語、様式及び作成方法に関する規則",
  "電子帳簿保存法": "電子計算機を使用して作成する国税関係帳簿書類の保存方法等の特例に関する法律",
  "電子帳簿保存法施行規則": "電子計算機を使用して作成する国税関係帳簿書類の保存方法等の特例に関する法律施行規則",
  "耐用年数省令": "減価償却資産の耐用年数等に関する省令",
  "復興財確法": "東日本大震災からの復興のための施策を実施するために必要な財源の確保に関する特別措置法",
  "下請法": "製造委託等に係る中小受託事業者に対する代金の支払の遅延等の防止に関する法律",
};

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e === "index.html") out.push(p);
  }
  return out;
}

// ★名前で当てにいく（総称の正規表現で名前側を推測しない）。
// 旧実装は「([一-龥ぁ-ん]+?)（N字）」で名前を拾っていたが、非貪欲なので直前の助詞を
// 巻き込み（「は会社計算規則」）、台帳に無い名前として**黙って照合を素通り**していた。
// ＝ 実測 1件が緑のまますり抜けた。名前は台帳側から与える。
const names = new Map();               // 記事に出る表記 → 台帳の正式名
for (const k of Object.keys(ledger.laws)) names.set(k, k);
for (const [a, full] of Object.entries(ALIAS)) if (ledger.laws[full]) names.set(a, full);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// 「（600,520字」「（本文601,115字」「（同3,378,567字」を許す
// ★法令名と（N字）のあいだに入りうる語も飲む。
//   「会社法の全文（472,180字）」は名前直後が「の」なので、
//   ここを許さないと**照合されないまま「測定不能」に落ちて緑を保つ**（実測1件）。
//   括弧を伴わない「法人税法1,814,098字・施行令3,572,373字」の形もある（実測2件）。
//   括弧を必須にしていたあいだ、この2件は**どちらの正規表現にも当たらず存在ごと見えていなかった**。
//   つなぎの語は書き手ごとに違う（「の全文」「の取得結果の全文」…）。列挙すると必ず漏れるので、
//   **括弧を含まない短い『の…』を一般に許す**。実測: 「会社計算規則の取得結果の全文（116,933字）」が
//   列挙漏れで測定不能側に落ち、誤った字数のまま緑を保っていた。
//   ⚠ ただし「…・商法の本文合計4,253,426字」の『合計』は**その法令の字数ではない**。
//     つなぎを一般化した直後、8法令の合計が最後に並んだ商法の主張として誤検出された（実測）。
//     つなぎに「合計」を含めない。
const TAIL = "(?:の(?:(?!合計)[^（()）0-9]){0,14})?\\s*(?:[（(]\\s*)?(?:本文|同|全文で|全文)?\\s*([0-9]{1,3}(?:,[0-9]{3})+)\\s*字";

const bad = [];
const seen = new Set();                // 照合できた「slug+位置」
let checked = 0;
let tableChecked = 0;

const files = walk(join(root, "docs"));
for (const file of files) {
  const html = readFileSync(file, "utf8");
  const slug = file.replace(join(root, "docs") + "/", "").replace("/index.html", "");
  // 長い名前から先に当てる（「所得税法施行規則」が「所得税法」に食われないように）
  for (const disp of [...names.keys()].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(esc(disp) + TAIL, "g");
    for (const m of html.matchAll(re)) {
      // ★どちらの正規表現も「字」で終わるので、**終端**が主張1件を一意に決める。
      //   旧実装は開始位置＋40字の窓で「同じ主張」を判定しており、隣り合う別法令の
      //   主張まで巻き込んで消していた（実測: 所得税法施行規則（469,846字）が
      //   財規の主張の窓に入って**照合されず緑**になった）。
      //   なお短い名前が長い名前に食い込む心配は無い（「所得税法」の直後は「施」で、
      //   「（」ではないので、そもそもマッチしない）。
      const key = slug + ":" + (m.index + m[0].length);
      if (seen.has(key)) continue;
      seen.add(key);
      checked++;
      const rec = ledger.laws[names.get(disp)];
      const got = Number(m[1].replace(/,/g, ""));
      if (rec.chars !== got) {
        bad.push(`${slug}: ${disp}（${got.toLocaleString()}字）… 台帳は ${rec.chars.toLocaleString()}字 [${rec.law_revision_id}]`);
      }
    }
  }
}

// ★表の行も照合する（名前と数字が別のセルに入る形）。
//   🔴 実測: docs/column/genka-shokyaku-ruikeigaku/ は「法令｜種別｜本文の字数」の表を持ち、
//     名前と数字が <td> で隔てられているため、**隣接を前提にした上の正規表現には
//     1行も当たらなかった**。地の文の合計だけを直した結果、
//     「行の合計 4,412,173 ≠ 合計行 4,253,426」という**記事内で矛盾した状態**を作りかけた。
//   ＝ 隣接を仮定した検査は、表の中を素通りする。
for (const file of files) {
  const html = readFileSync(file, "utf8");
  const slug = file.replace(join(root, "docs") + "/", "").replace("/index.html", "");
  for (const tr of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
      .map((c) => c[1].replace(/<[^>]+>/g, "").trim());
    if (cells.length < 2) continue;
    const rec = ledger.laws[names.get(cells[0]) || ""];
    if (!rec) continue;
    for (const c of cells.slice(1)) {
      if (!/^[0-9]{1,3}(,[0-9]{3})+$/.test(c)) continue;   // 字数らしいセルだけ見る
      const got = Number(c.replace(/,/g, ""));
      if (got < 1000) continue;
      tableChecked++;
      if (rec.chars !== got) {
        bad.push(`${slug}: [表] ${cells[0]} = ${got.toLocaleString()}字 … 台帳は ${rec.chars.toLocaleString()}字 [${rec.law_revision_id}]`);
      }
      break;                                               // 行の最初の字数セルだけ
    }
  }
}

// ★台帳に無い法令名の主張＝**照合できていない**。緑の保証はここに及ばない。
// 🚫 これを失敗時に隠さない（旧実装は bad があると unknown を出さずに exit していた）。
const unknown = [];
const ANY = /([一-龥ぁ-んァ-ヶ][一-龥ぁ-んァ-ヶA-Za-z0-9・、]{1,40}?)\s*[（(]\s*(?:本文|同|全文で|全文)?\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*字/g;
for (const file of files) {
  const html = readFileSync(file, "utf8");
  const slug = file.replace(join(root, "docs") + "/", "").replace("/index.html", "");
  for (const m of html.matchAll(ANY)) {
    if (!seen.has(slug + ":" + (m.index + m[0].length))) {
      unknown.push(`${slug}: …${m[1]}（${m[2]}字）`);
    }
  }
}

if (unknown.length) {
  console.log(`  ※ 台帳に無く照合できない字数の主張 ${unknown.length}件（★測定不能。緑の保証はここには及ばない）:`);
  for (const u of unknown.slice(0, 12)) console.log("     " + u);
}

if (bad.length) {
  console.error(`✗ 台帳と食い違う字数 ${bad.length}件（正本の数え方=${ledger.method}）`);
  for (const b of bad) console.error("   " + b);
  console.error("   → 記事側を台帳の値に直すこと。台帳が古いなら python3 tools/law_chars.py --scan /tmp/law_*.json");
  process.exit(1);
}

console.log(`✓ 法令の字数 ${checked}件（うち表の行 ${tableChecked}件は別途）が台帳と一致（方法=${ledger.method}・測定日=${ledger.measured}）`);
