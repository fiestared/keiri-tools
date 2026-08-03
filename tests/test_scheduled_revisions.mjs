/**
 * データが自分で申告している「予定されている改定」を、**施行日が来たら機械で赤くする**。
 *
 * ★なぜ要るのか（2026-08-03 のレビューで発見）:
 *   `fee_table.json` の `_meta.scheduled_revisions` に
 *     「GMOあおぞらネット銀行（法人）は 2026-08-17 に 130円 → 100円」
 *   と**書いてあるのに、それを見ているコードが1つも無かった**（grepで0件）。
 *   つまり 8/17 に人が思い出さなければ、**このシステムが防ぐために作られた種類の誤り
 *   （＝古い金額を出し続ける）が、既定で発生する**。
 *   実際 2026-08-01 の雇用保険の改定では、本番3ツールが古い上限額で答える事故が起きている。
 *
 * ★「予定を書いておく」は対策ではない。**施行日に落ちる検査**があって初めて対策になる。
 *
 * ★あわせて checked_date の鮮度も見る。
 *   出典を実読した日から時間が経てば、書いてある額そのものが黙って古くなる。
 *   落ちること自体が「もう一度公式ページを読め」という指示になる。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FEE = join(root, 'docs/assets/fee_table.json');

/** JSTの今日。★手で数えない・UTCを使わない */
const todayJst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

const D = JSON.parse(readFileSync(FEE, 'utf8'));
const today = todayJst();

// --- 1. 予定改定: 施行日が来ていたら、表がその額になっていること -----------------
const planned = D._meta?.scheduled_revisions || [];
let due = 0;
for (const r of planned) {
  // ★`fields` は必須。改定が「どの料金欄に効くか」をデータ側に言わせる。
  //   これが無いと欄を1つ決め打ちで見るしかなく、**見ていない欄が黙って古いまま残る**
  //   （実際 GMOあおぞら（法人）は under30k/over30k とも130円の一律で、over30k だけ見る検査は
  //    「over30k だけ100に直して under30k は130のまま」を緑で通した。2026-08-03 に実測で確認）。
  for (const k of ['bank', 'effective_date', 'current', 'after', 'source', 'fields']) {
    assert.ok(r[k] !== undefined, `scheduled_revisions に ${k} がありません: ${JSON.stringify(r)}`);
  }
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.effective_date),
    `effective_date の形式が YYYY-MM-DD ではありません: ${r.effective_date}`);
  assert.ok(Array.isArray(r.fields) && r.fields.length > 0,
    `${r.bank} の fields は「改定が効く料金欄」の配列にしてください（例 ["under30k","over30k"]）`);

  const bank = D.banks.find((b) => b.name === r.bank);
  assert.ok(bank, `scheduled_revisions の「${r.bank}」が banks に見つかりません（名前の変更漏れ）`);

  // 欄名の打ち間違いを落とす（undefined どうしの比較で素通しさせない）
  for (const f of r.fields) {
    assert.ok(typeof bank[f] === 'number',
      `${r.bank} に料金欄「${f}」がありません（fields の綴りを確認してください）`);
  }

  if (r.effective_date <= today) {
    due++;
    // ★施行日が来た。**fields の全欄**が新しい額になっていなければ落とす。
    for (const f of r.fields) {
      assert.strictEqual(bank[f], r.after,
        `★改定日が過ぎています（${r.effective_date}・本日${today}）。\n` +
        `  ${r.bank} の「${f}」は ${r.current}円 → ${r.after}円 のはずですが、表は ${bank[f]}円 のままです。\n` +
        `  ★対象の欄は ${r.fields.join(' / ')} です。**1つだけ直して終わりにしないこと。**\n` +
        `  出典を実読して docs/assets/fee_table.json を更新し、\n` +
        `  反映したら scheduled_revisions から該当行を消してください。\n` +
        `  出典: ${r.source}`);
    }
    assert.fail(
      `★${r.bank} の改定（${r.effective_date}）は反映済みのようですが、\n` +
      `  scheduled_revisions に予定が残ったままです。反映したら消してください。`);
  } else {
    // まだ来ていない場合は、fields の全欄が current と一致していること
    for (const f of r.fields) {
      assert.strictEqual(bank[f], r.current,
        `${r.bank} の「${f}」が ${bank[f]}円 で、scheduled_revisions の current(${r.current}円) と食い違っています`);
    }
  }
}

// --- 2. 出典を実読した日の鮮度 --------------------------------------------------
// ★落ちたら「読み直せ」の合図。データが間違っているという意味ではない。
const STALE_DAYS = 120;
const checked = D._meta?.checked_date;
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(checked || ''), '_meta.checked_date がありません');
const days = Math.floor((Date.parse(today) - Date.parse(checked)) / 86400000);
assert.ok(days <= STALE_DAYS,
  `振込手数料の表を最後に実読したのが ${checked}（${days}日前）です。\n` +
  `  ${STALE_DAYS}日を超えました。各行の公式ページを読み直して checked_date を更新してください。\n` +
  `  ★行ごとの source/verified_date が付いているものは、そちらの日付が正です。`);

// --- 3. 予定が「消し忘れ」で溜まっていないこと -----------------------------------
assert.ok(planned.length < 20, `scheduled_revisions が ${planned.length}件 あります（消し忘れの疑い）`);

const near = planned.filter((r) => r.effective_date > today)
  .sort((a, b) => a.effective_date.localeCompare(b.effective_date))[0];
console.log(`✓ test_scheduled_revisions: 予定${planned.length}件（施行済み${due}件）/ 実読から${days}日` +
  (near ? ` / 次の改定 ${near.effective_date} ${near.bank} ${near.current}→${near.after}円` : ''));
