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
import { readFileSync, mkdtempSync, openSync, closeSync, readSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { StringDecoder } from "node:string_decoder";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG_PATH = join(ROOT, "tools/nav_experiment.json");

/**
 * 生成器（gen_datemodified.mjs）が書く更新日の行。この行だけの差分は本文の改稿と数えない。
 * gen_datemodified.mjs（dateModified）と gen_index_sitemap.mjs（lastmod）が同じ定義を使う（基準を2つ持たない）。
 */
export const DATE_LINE = /"dateModified"|class="article-meta"|公開日:|更新日:|<time datetime=/;

/** 導線の目印。生成器が書くブロックは必ず1行に収め、この目印を同じ行に持つ
 * ★rel（ツール末尾の「関連する解説」。gen_tool_related.mjs が `<!--rel:S-->…<!--rel:E-->` を1行で書く）も導線（2026-10-14）。
 *   コラムを1本足すと、そのコラムがリンクしたツールの rel が書き換わる。20ファイル未満の生成物コミットだと
 *   **ツールの本文は1文字も変わっていないのに**更新日・lastmod が今日になっていた（2026-10-14 に14ツールで実測）。 */
export const NAV_LINE = /<!--(?:next-read|rail-next|nav-exp|rel)\b[^>]*-->/;

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
  const pins = c.nextReadPins || {};
  for (const [slug, list] of Object.entries(pins)) {
    if (!T.has(col(slug))) errors.push(`nextReadPins: 対象ではないページ ${slug}`);
    if (!Array.isArray(list) || list.length !== 3 || new Set(list).size !== 3) errors.push(`nextReadPins.${slug}: 重複なしの3本でない`);
    else for (const s of list) {
      const p = col(s);
      if (s === slug || C.has(p) || P.has(p)) errors.push(`nextReadPins.${slug}: 自分・対照・保護対象は指定できない（${s}）`);
    }
  }
  if (errors.length) throw new Error(`nav_experiment.json: ${errors.join(" / ")}`);
  return { base: c.base, T, C, P, F, treatment: c.treatment, control: c.control, tableFix: c.tableFix, pins };
}

/** 1行から導線の部分（生成器が書いたもの）だけを取り除く。gen_article_next_read.mjs の stripNav と同じ規則 */
export function stripNavSegments(line) {
  return line
    .replace(/<!--next-read:S-->[\s\S]*?<!--next-read:E-->/g, "")
    .replace(/<!--rail-next:S-->[\s\S]*?<!--rail-next:E-->/g, "")
    .replace(/<!--rel:S-->[\s\S]*?<!--rel:E-->/g, "")
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
  // 出典の外部リンクの追加・削除・URL訂正は、文言が同じなら本文の改稿ではない。
  // コミット済み履歴と作業ツリーの両方で、更新日を偽って進めない。
  const externalLink = /<a\b[^>]*\bhref=(["'])https?:\/\/[^"']*\1[^>]*>([\s\S]*?)<\/a>/gi;
  const links = [...removed, ...added].flatMap((l) => l.match(externalLink) ?? []);
  if (links.length) {
    // 同じ行に既存のサイト内リンクがあっても、それは残して外部リンクだけを比較する。
    const stripLinks = (ls) => ls.map((l) => l.replace(externalLink, (_, quote, label) => label));
    const r = stripLinks(removed), a = stripLinks(added);
    if (r.length === a.length && r.every((l, i) => l === a[i])) return true;
  }
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
 *
 * ★★★ git の出力をメモリに溜めない（2026-10-14 実測）。
 *   以前は `execFileSync(maxBuffer: 512MiB)` で `git log -p` 全体を1本の文字列に受け、失敗したら黙って空の Map を返していた。
 *   履歴が育って出力が 512MiB を超えた瞬間に ENOBUFS → catch → **空 ＝「導線だけのコミット」が1件も無い**扱いになり、
 *   次に読むのカードを差し替えただけの小さな生成物コミットが全部「本文の改稿」に化けた。
 *   実測: origin/main は 536,728,943 バイト（上限まで残り 141,969 バイト）で辛うじて動いており、
 *   新記事1本と main を取り込んだ公開用の枝は 539,014,608 バイトで上限を超えた。
 *   その枝で生成器を流すと、本文の変わっていない約80ページの dateModified と sitemap の lastmod が今日になり、
 *   test_generators_fresh が「lastmod が 2026-10-14 に集中（51%）」で執筆便 2026-10-14 の公開を2回止めた。
 *   maxBuffer を上げるだけでは直らない（V8 の文字列の上限が約512MiB）。→ 一時ファイルに書いてコミット単位で読む。
 * ★失敗を「空」に化けさせない。base が無いときだけ空を返し、それ以外の失敗は投げる（黙って間違えない）。
 */
export function navOnlyCommitFiles(base, extra = null) {
  const map = new Map();
  try { gitAt(["cat-file", "-e", `${base}^{commit}`]); } catch { return map; }
  const dir = mkdtempSync(join(tmpdir(), "nav-only-"));
  const path = join(dir, "log.patch");
  try {
    const out = openSync(path, "w");
    try {
      execFileSync("git", ["log", "--format=%x01%H", "-U0", "-p", `${base}..HEAD`, "--", "docs"],
        { cwd: ROOT, stdio: ["ignore", out, "pipe"] });
    } finally { closeSync(out); }
    let hash = null, lines = [];
    const flush = () => {
      if (!hash) return;
      const files = new Set();
      for (const [f, d] of changedLinesByFile(lines.join("\n"))) if (isNavOrExtraOnly(d, extra)) files.add(f);
      if (files.size) map.set(hash, files);
    };
    forEachLine(path, (line) => {
      if (line.startsWith("\x01")) { flush(); hash = line.slice(1).trim(); lines = []; }
      else lines.push(line);
    });
    flush();
  } finally { rmSync(dir, { recursive: true, force: true }); }
  return map;
}

/** ファイルを 16MiB ずつ読み、1行ずつ渡す（全体を1本の文字列にしない） */
function forEachLine(path, fn) {
  const fd = openSync(path, "r");
  const buf = Buffer.alloc(16 * 1024 * 1024);
  const dec = new StringDecoder("utf8");
  let rest = "";
  try {
    for (let n; (n = readSync(fd, buf, 0, buf.length, null)) > 0;) {
      const parts = (rest + dec.write(buf.subarray(0, n))).split("\n");
      rest = parts.pop();
      for (const l of parts) fn(l);
    }
    rest += dec.end();
    if (rest) fn(rest);
  } finally { closeSync(fd); }
}

/**
 * 差分が「導線だけ」か、extra（生成器ごとに見逃してよい行。更新日の行など）だけか。
 * ★作業ツリー側（worktreeNavOnly と gen_datemodified の DATE_LINE 判定）と同じ規則をコミット側にも効かせる（2026-09-23）。
 *   以前はコミット側に extra が無く、**生成器が書いた dateModified だけのコミット**が「本文の改稿」に数えられ、
 *   次の実行で日付がそのコミット日に動いた（生成器を流し忘れた後の追いつきコミットが必ず自家中毒する）。
 */
function isNavOrExtraOnly(d, extra) {
  if (!extra) return isNavOnlyDiff(d.removed, d.added);
  const keep = (l) => !extra.test(l);
  const removed = d.removed.filter(keep), added = d.added.filter(keep);
  if (removed.length === 0 && added.length === 0) return d.removed.length + d.added.length > 0;
  return isNavOnlyDiff(removed, added);
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
