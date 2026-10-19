/**
 * sitemap の lastmod ＝「そのページの**本文**（tools/page_body.mjs）が最後に変わったコミットの日付」。
 *
 * ★決め方:
 *   1. 作業ツリーで変更中のファイルは、作業ツリーの本文と HEAD の本文を比べる。
 *      違えば今日（JST）。同じなら（導線・更新日・装飾だけの変更）2. へ。未追跡（新規ページ）は今日。
 *   2. git の履歴をそのファイルについて新しい順に辿り、各コミットの**変更前の版と変更後の版の本文**を比べる。
 *      最初に本文が違ったコミットの日付が lastmod。ファイルが生まれたコミット（変更前が無い）も本文の変更に数える。
 *      - マージは数えない（--no-merges）。マージの中身は取り込んだ側のコミットに日付つきで在る。
 *        数えると「main を取り込んだ日」が lastmod になる（2026-10-14 の実害。旧実装と同じ規則）。
 *      - 20ファイル以上の一括コミットも**除外しない**。旧実装はこれを丸ごと除外していたため、
 *        一括コミットの中の本物の改稿を落とし、tools/verified_content_dates.mjs に手で救済を書き足していた。
 *        本文を比べれば、一括の中の「導線だけ」は自然に落ち、「本文の改稿」は自然に残る（例外の台帳が要らない）。
 *   ★遡るのは「本文が変わったコミット」に当たるまで。たいてい数コミットで止まる。
 *     版ごとの本文ハッシュは git の共通ディレクトリにキャッシュする（blob の SHA が鍵＝内容が同じなら値も同じ）。
 *     キャッシュ名に BODY_VERSION を入れているので、本文の定義を変えたら古い値は使われない。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { bodyHash, BODY_VERSION } from "./page_body.mjs";

const ZERO = /^0+$/;
const MAXBUF = 1024 * 1024 * 1024;

/**
 * @param {object} o
 * @param {string} o.cwd    git を走らせるディレクトリ（docs）
 * @param {string[]} o.files 対象ファイル（絶対パス）
 * @param {string} o.today  YYYY-MM-DD（JST）
 * @param {Map} [o.why]     渡すと「どのコミットで本文が変わったか」を入れる（診断・検査用）
 * @returns {Map<string,string|null>} 絶対パス → lastmod
 */
export function bodyLastmods({ cwd, files, today, why = null }) {
  const git = (args, opt = {}) => execFileSync("git", args, { cwd, maxBuffer: MAXBUF, stdio: ["pipe", "pipe", "ignore"], ...opt });
  const gitS = (args) => { try { return git(args, { encoding: "utf8" }).replace(/\s+$/, ""); } catch { return ""; } };
  // ★経路は cwd からの相対＋prefix で作る。--show-toplevel は symlink を解決した実パス（/private/var/…）を返すので、
  //   渡されたパス（/var/…）と relative() すると ../ だらけになり、照合が全部外れる（使い捨てリポジトリで実測）。
  const prefix = gitS(["rev-parse", "--show-prefix"]);
  const commonDir = gitS(["rev-parse", "--git-common-dir"]);
  const cachePath = join(isAbsolute(commonDir) ? commonDir : join(cwd, commonDir), `keiri-body-hash-v${BODY_VERSION}.json`);
  let cache = {};
  try { if (existsSync(cachePath)) cache = JSON.parse(readFileSync(cachePath, "utf8")); } catch { cache = {}; }
  let cacheDirty = false;

  // cat-file --batch で blob をまとめて読み、本文ハッシュにする（spec は SHA でも "HEAD:path" でもよい）
  const hashSpecs = (specs) => {
    const out = new Map();
    for (let i = 0; i < specs.length; i += 200) {
      const chunk = specs.slice(i, i + 200);
      const buf = git(["cat-file", "--batch"], { input: chunk.join("\n") + "\n" });
      let p = 0;
      for (const spec of chunk) {
        const nl = buf.indexOf(10, p);
        const head = buf.slice(p, nl).toString("utf8");
        p = nl + 1;
        const m = head.match(/^([0-9a-f]{40}) blob (\d+)$/);
        if (!m) { out.set(spec, null); continue; }        // missing など
        const size = Number(m[2]);
        const h = bodyHash(buf.slice(p, p + size).toString("utf8"));
        p += size + 1;
        out.set(spec, h);
        cache[m[1]] = h; cacheDirty = true;
      }
    }
    return out;
  };

  const want = new Map(files.map((f) => [prefix + relative(cwd, f), f]));
  const result = new Map();

  // ---- 1. 作業ツリー ----
  const hasHead = gitS(["rev-parse", "--verify", "-q", "HEAD"]) !== "";
  // ★-uall: 未追跡ディレクトリを1行に畳ませない（新規ページの lastmod が落ちる。2026-07-14 /juminzei/）
  // ★末尾だけ削る（.trim() は1行目の状態カラムの空白まで削り、先頭ファイルの path を1文字食う。2026-07-17）
  const status = gitS(["status", "--porcelain", "-uall", "--", "."]).split("\n").filter(Boolean);
  const dirtyTracked = [];
  for (const l of status) {
    const rel = l.slice(3).split(" -> ").pop().replace(/^"|"$/g, "");
    if (!want.has(rel)) continue;
    if (l.startsWith("??") || !hasHead) { result.set(want.get(rel), today); continue; }
    dirtyTracked.push(rel);
  }
  if (dirtyTracked.length) {
    const heads = hashSpecs(dirtyTracked.map((r) => `HEAD:${r}`));
    for (const rel of dirtyTracked) {
      const abs = want.get(rel);
      const headHash = heads.get(`HEAD:${rel}`);
      if (!existsSync(abs)) continue;
      if (headHash === null) { result.set(abs, today); continue; }   // HEAD に無い（git add 済みの新規）
      if (bodyHash(readFileSync(abs, "utf8")) !== headHash) result.set(abs, today);
    }
  }

  // ---- 2. 履歴 ----
  const todo = [...want.keys()].filter((r) => !result.has(want.get(r)));
  const hist = new Map(todo.map((r) => [r, []]));
  if (hasHead && todo.length) {
    const log = git(["log", "--no-merges", "--no-renames", "--format=@@%cs %H", "--raw", "--no-abbrev", "--", "."], { encoding: "utf8" });
    let date = null, commit = null;
    for (const line of log.split("\n")) {
      if (line.startsWith("@@")) { [date, commit] = line.slice(2).split(" "); continue; }
      if (line[0] !== ":") continue;
      const tab = line.indexOf("\t");
      const rel = line.slice(tab + 1);
      const h = hist.get(rel);
      if (!h) continue;
      const [, , oldSha, newSha] = line.slice(1, tab).split(" ");
      h.push({ date, commit, oldSha, newSha });
    }
  }
  const idx = new Map(todo.map((r) => [r, 0]));
  let pending = todo.filter((r) => hist.get(r).length);
  for (const r of todo) if (!hist.get(r).length) result.set(want.get(r), hasHead ? null : today);
  while (pending.length) {
    const need = new Set();
    for (const r of pending) {
      const e = hist.get(r)[idx.get(r)];
      for (const s of [e.oldSha, e.newSha]) if (!ZERO.test(s) && !(s in cache)) need.add(s);
    }
    if (need.size) hashSpecs([...need]);
    const next = [];
    for (const r of pending) {
      const h = hist.get(r);
      const e = h[idx.get(r)];
      const changed = ZERO.test(e.oldSha) || ZERO.test(e.newSha) || cache[e.oldSha] !== cache[e.newSha];
      if (changed) { result.set(want.get(r), e.date); why?.set(want.get(r), e.commit); continue; }
      if (idx.get(r) + 1 >= h.length) { result.set(want.get(r), h[h.length - 1].date); continue; }
      idx.set(r, idx.get(r) + 1);
      next.push(r);
    }
    pending = next;
  }
  // 履歴が --no-merges で1件も見えないのに追跡されているファイル（マージの中でだけ生まれた）は、
  // マージ込みの最終コミット日に倒す（無言で lastmod を落とさない）
  for (const [rel, abs] of want) {
    if (result.get(abs) === null) result.set(abs, gitS(["log", "-1", "--format=%cs", "--", rel]) || today);
  }

  if (cacheDirty) {
    try {
      const tmp = `${cachePath}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(cache));
      renameSync(tmp, cachePath);
    } catch { /* キャッシュは速さのためだけ。書けなくても結果は同じ */ }
  }
  return result;
}

