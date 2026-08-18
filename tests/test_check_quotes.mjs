// tools/check_quotes.py の検査。
// ★「発火する側」と「発火しない側」の両方を固定する(申し送り866)。
// とくに③④は 2026-08-19 第3便で実際に起きた壊れ方をそのまま再現したもの。
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOOL = new URL("../tools/check_quotes.py", import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error("  ✗ " + m); } };

const dir = mkdtempSync(join(tmpdir(), "ckq-"));
const w = (n, o) => { const p = join(dir, n); writeFileSync(p, typeof o === "string" ? o : JSON.stringify(o)); return p; };

// e-Gov の形をした最小の法令JSON。本文は children にだけ入り、
// tag 名と attr は本文ではない(ここを拾うと誤ってマッチする)。
const sentence = (t) => ({ tag: "Sentence", attr: { Num: "ZZATTRMARKERZZ" }, children: [t] });
const filler = "以下は分量を満たすためのダミー条文である。".repeat(600);
const law = w("law.json", {
  law_info: { law_id: "TEST" },
  law_full_text: {
    tag: "Law", attr: { Lang: "ja" },
    children: [{
      tag: "Article", attr: { Num: "1" },
      children: [sentence("掛金は、分割して納付することができない。"), sentence(filler)],
    }],
  },
});

const article = (bq) => w(`a${Math.random().toString(36).slice(2)}.html`,
  `<html><body><article><blockquote>${bq}</blockquote></article></body></html>`);

function run(args) {
  try {
    const out = execFileSync("python3", [TOOL, ...args], { encoding: "utf-8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || "") + (e.stderr || "") };
  }
}

// ① 正しい引用 → 合格
{
  const r = run([article("掛金は、分割して納付することができない。"), "--law", law]);
  ok(r.code === 0, `正しい引用は exit 0 のはず (got ${r.code})\n${r.out}`);
  ok(/全一致/.test(r.out), "「全一致」と印字するはず");
}

// ② 誤った引用 → 不一致(exit 1)。ここが落ちないなら検査は何も見ていない
{
  const r = run([article("掛金は、分割して納付することができる。"), "--law", law]);
  ok(r.code === 1, `誤った引用は exit 1 のはず (got ${r.code})`);
  ok(/ここから外れる/.test(r.out), "どこから外れたかを出すはず");
}

// ③ ★コーパスが空/極小 → 「一致」ではなく測定不能(exit 2)。
//    第3便の実際の壊れ方。空コーパスでは全断片が不一致になるうえ、
//    改ざん対照は 100% 通過するので、対照だけ見ていると健全に見えてしまう。
{
  const empty = w("empty.json", { law_info: {}, law_full_text: { tag: "Law", children: [] } });
  const r = run([article("掛金は、分割して納付することができない。"), "--law", empty]);
  ok(r.code === 2, `空コーパスは exit 2(測定不能) のはず (got ${r.code})`);
  ok(/測定不能/.test(r.out), "「測定不能」と言うはず(「不一致」ではない)");
  ok(!/全一致/.test(r.out), "空コーパスで「全一致」と言ってはいけない");
}

// ④ ★tag名・属性値を本文として拾っていないか。
//    拾っていると、条文に無い tag 名 'Sentence' や属性値がコーパスに入り、
//    「条文に書いていない文字列」が当たってしまう。
//    ⚠ 最初この検査は "Sentenceproviso" を引いていたが、attr の Num="1" が
//    あいだに挟まるため壊し版でも当たらず、**発火しない検査**だった(実測)。
//    tag 名と属性値を単独で引くこと。
{
  const r = run([article("Sentence"), "--law", law]);
  ok(r.code === 1, `tag名 'Sentence' は条文本文ではないので不一致のはず (got ${r.code})`);
}
{
  const r = run([article("ZZATTRMARKERZZ"), "--law", law]);
  ok(r.code === 1, `属性値は条文本文ではないので不一致のはず (got ${r.code})`);
}

// ⑤ 省略記号「…」をまたぐ引用は、断片ごとに照合される(発火しない側)
{
  const r = run([article("掛金は、…納付することができない。"), "--law", law]);
  ok(r.code === 0, `「…」で切れば一致するはず (got ${r.code})\n${r.out}`);
}

// ⑥ blockquote が無い → 測定不能。0件を「合格」と読ませない
{
  const none = w("none.html", "<html><body><article><p>本文だけ</p></article></body></html>");
  const r = run([none, "--law", law]);
  ok(r.code === 2, `blockquote 0件は exit 2 のはず (got ${r.code})`);
}

rmSync(dir, { recursive: true, force: true });
console.log(`check_quotes: ${pass} 緑 / ${fail} 赤`);
if (fail) process.exit(1);
