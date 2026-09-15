/**
 * 回遊の局所改修（2026-09-16）の名簿と、「導線だけの変更は本文の更新に数えない」判定。
 *
 * ★なぜ要るか:
 *   次に読む・右レールの差し替えは 15本だけに入れる。更新日の生成器（gen_datemodified.mjs）と
 *   sitemap の lastmod（gen_index_sitemap.mjs）は「20ファイル未満の変更＝本文の改稿」と数えるので、
 *   本数を絞るほど**導線を替えただけの15本が「今日更新」を名乗る**（偽の鮮度信号。対照群とも条件がずれる）。
 *   → 削除行・追加行から導線の部分を取り除いて一致するなら、そのファイルは本文が変わっていないとみなす。
 *
 * ★基点より前の履歴には効かせない:
 *   旧来の「次に読む」だけのコミットも過去にある。そこまで除外すると、今回触っていない
 *   多数のページの更新日が一斉に動く。判定を変えるのは base（公開中の e9e1abc0）より後のコミットだけ。
 *   🚫 20ファイルの閾値（BULK_FILES）はここに持たない。基準を2つ持たない。
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG_PATH = join(ROOT, "tools/nav_experiment.json");

/** 導線の目印。生成器が書くブロックは必ず1行に収め、この目印を同じ行に持つ */
export const NAV_LINE = /<!--(?:next-read|rail-next|nav-exp)\b[^>]*-->/;

/** 名簿を読み、欠落・重複・衝突で止める（未指定を「全件」の意味にしない） */
export function loadNavExperiment(path = CONFIG_PATH) {
  const c = JSON.parse(readFileSync(path, "utf8"));
  const errors = [];
  for (const k of ["treatment", "control", "protectedPaths", "tableFix"]) {
    if (!Array.isArray(c[k]) || c[k].length === 0) errors.push(`${k} が空`);
  }
  if (typeof c.base !== "string" || !/^[0-9a-f]{40}$/.test(c.base)) errors.push("base が40桁のコミットでない");
  if (errors.length) throw new Error(`nav_experiment.json: ${errors.join(" / ")}`);
  const dup = (a) => a.filter((x, i) => a.indexOf(x) !== i);
  for (const k of ["treatment", "control", "protectedPaths", "tableFix"]) {
    if (dup(c[k]).length) errors.push(`${k} に重複: ${dup(c[k]).join(",")}`);
  }
  if (c.treatment.length !== c.control.length) errors.push("treatment と control の本数が違う（対応組が崩れる）");
  const col = (s) => `/column/${s}/`;
  const T = new Set(c.treatment.map(col));
  const C = new Set(c.control.map(col));
  const P = new Set(c.protectedPaths);
  const F = new Set(c.tableFix.map(col));
  for (const p of T) {
    if (C.has(p)) errors.push(`対象と対照の両方にある: ${p}`);
    if (P.has(p)) errors.push(`対象が保護対象に入っている: ${p}`);
    if (F.has(p)) errors.push(`対象が表の施策と重なる: ${p}`);
  }
  for (const p of C) if (P.has(p) || F.has(p)) errors.push(`対照が保護対象・表の施策と重なる: ${p}`);
  if (errors.length) throw new Error(`nav_experiment.json: ${errors.join(" / ")}`);
  return { base: c.base, T, C, P, F, treatment: c.treatment, control: c.control, tableFix: c.tableFix };
}

/** 1行から導線の部分（生成器が書いたもの）だけを取り除く。gen_article_next_read.mjs の stripNav と同じ規則 */
export function stripNavSegments(line) {
  return line
    .replace(/<!--next-read:S-->[\s\S]*?<!--next-read:E-->/g, "")
    .replace(/<!--rail-next:S-->[\s\S]*?<!--rail-next:E-->/g, "")
    .replace('<!--rail-next:wrap--><div class="side-rail" data-nav-exp="wrap">', "")
    .replace("</div><!--rail-next:wrapE-->", "")
    .replace(/<!--nav-exp:style S-->[\s\S]*?<!--nav-exp:style E-->/g, "")
    .replace(/<!--nav-exp:([a-z0-9-]+) S-->[\s\S]*?<!--nav-exp:\1 E-->/g, "");
}

/**
 * ファイルの差分が「導線だけ」か。
 * 削除行と追加行のそれぞれから導線の部分を取り除き、残りの（空でない）行の並びが一致すればよい。
 * ★行単位で「目印を含むか」だけを見ると、目次の行を包み直したとき（元の行を削除して目印つきの行を追加）を
 *   本文の変更と誤判定する（2026-09-16 実測）。削除側と追加側を突き合わせる。
 */
export function isNavOnlyDiff(removed, added) {
  const touchesNav = [...removed, ...added].some((l) => NAV_LINE.test(l));
  if (!touchesNav) return false;
  const norm = (ls) => ls.map(stripNavSegments).filter((l) => l.trim() !== "");
  const r = norm(removed), a = norm(added);
  return r.length === a.length && r.every((l, i) => l === a[i]);
}

/** unified diff（-U0）から、ファイルごとの削除行・追加行を取り出す */
function changedLinesByFile(patch) {
  const out = new Map();
  let file = null;
  const slot = (f) => { if (!out.has(f)) out.set(f, { removed: [], added: [] }); return out.get(f); };
  let minus = null;
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) { file = null; minus = null; continue; }
    if (line.startsWith("--- ")) { const p = line.slice(4); minus = p === "/dev/null" ? null : p.replace(/^a\//, ""); continue; }
    if (line.startsWith("+++ ")) {
      const p = line.slice(4);
      file = p === "/dev/null" ? minus : p.replace(/^b\//, "");
      if (file) slot(file);
      continue;
    }
    if (!file) continue;
    if (line[0] === "-") slot(file).removed.push(line.slice(1));
    else if (line[0] === "+") slot(file).added.push(line.slice(1));
  }
  return out;
}

// stderr は捨てる（基点が無い使い捨てリポジトリで "Invalid revision range" が出るのは想定内。その場合は空＝従来の判定）
const gitAt = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 512 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

/**
 * base より後のコミットで「導線の行しか変えていない」ファイル。Map<コミットhash, Set<リポジトリ相対パス>>
 * base が履歴に無い（別リポジトリ・浅いクローン）ときは空を返す＝従来どおりの判定になる。
 */
export function navOnlyCommitFiles(base) {
  const map = new Map();
  let patch;
  try { patch = gitAt(["log", "--format=%x01%H", "-U0", "-p", `${base}..HEAD`, "--", "docs"]); }
  catch { return map; }
  for (const chunk of patch.split("\x01").filter(Boolean)) {
    const nl = chunk.indexOf("\n");
    const hash = chunk.slice(0, nl).trim();
    const files = new Set();
    for (const [f, d] of changedLinesByFile(chunk.slice(nl + 1))) if (isNavOnlyDiff(d.removed, d.added)) files.add(f);
    if (files.size) map.set(hash, files);
  }
  return map;
}

/** 作業ツリーの未コミット変更が導線だけか（extra は生成器ごとに見逃してよい行。更新日の行など） */
export function worktreeNavOnly(rel, extra = null) {
  let diff;
  try { diff = gitAt(["diff", "HEAD", "--no-color", "-U0", "--", rel]); } catch { return false; }
  if (!diff) return false; // 未追跡＝新規ページは導線だけの変更ではない
  const d = [...changedLinesByFile(diff).values()][0];
  if (!d) return false;
  const keep = (l) => !(extra && extra.test(l));
  return isNavOnlyDiff(d.removed.filter(keep), d.added.filter(keep));
}
