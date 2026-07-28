/**
 * 減価償却コア（genka_core.js）の単体テスト。
 *
 * ★オラクルの独立性（CLAUDE.md 一次情報の読み方）:
 *   期待値はコアの都合でなく、国税庁が公表した計算例そのもの（取得価額100万円・耐用年数10年）で照合する。
 *   - 定額法: 各年10万円・10年目99,999円（No.2106／別表第八）
 *   - 200%定率法（平成24年4月1日以後取得）: 1年目200,000…6年目65,536、7年目に償却保証額65,520円を
 *     下回り改定取得価額262,144×0.250＝65,536に切替、10年目65,535（1円残す）。
 *     （出典: 法人の減価償却制度の改正に関するQ&A・耐用年数省令別表第十）
 *   - 250%定率法（平成19年4月1日〜平成24年3月31日取得）: 償却率0.250・改定0.334・保証0.04448（別表第九）。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcGenka, floorYen, usedMonthsFromStart, chukoTaiyoNensu, formatYm, ASSET_TYPES } from '../docs/assets/genka_core.js';

const ASSETS = new URL('../docs/assets/', import.meta.url);
const D = JSON.parse(readFileSync(new URL('genka_rates.json', ASSETS)));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

// 100万円・耐用年数10年・1月取得（通年）を各方法で
const teigaku = calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2015-01' }, D);
const t200 = calcGenka({ method: 'teiritsu', cost: 1000000, life: 10, acqYm: '2015-01' }, D); // 200%
const t250 = calcGenka({ method: 'teiritsu', cost: 1000000, life: 10, acqYm: '2010-01' }, D); // 250%（1月取得＝通年）

// ── 1. ★定額法（別表第八の公表例）─────────────────────────────────────────────────
t('定額法 n10 100万: 1〜9年目=100,000 / 10年目=99,999 / 合計999,999 / 期末1円', () => {
  const dep = teigaku.schedule.map((r) => r.dep);
  assert.strictEqual(teigaku.rate, 0.100);
  for (let y = 0; y < 9; y++) assert.strictEqual(dep[y], 100000, `year${y + 1}`);
  assert.strictEqual(dep[9], 99999, 'year10 備忘1円');
  assert.strictEqual(teigaku.totalYears, 10);
  assert.strictEqual(teigaku.totalDep, 999999);
  assert.strictEqual(teigaku.schedule[9].closeBook, 1);
});

// ── 2. ★200%定率法（別表第十の公表例・償却保証額切替を逐語照合）────────────────────
t('200%定率法 n10 100万: 償却率0.200/改定0.250/保証0.06552・保証額65,520', () => {
  assert.strictEqual(t200.rate, 0.200);
  assert.strictEqual(t200.kaiteiRate, 0.250);
  assert.strictEqual(t200.hoshoRate, 0.06552);
  assert.strictEqual(t200.hoshoGaku, 65520);
  assert.ok(/200%/.test(t200.eraLabel), '200%のera表示');
});
t('200%定率法 n10 100万: 公表スケジュール（1年目200,000…7年目切替65,536…10年目65,535）', () => {
  const want = [200000, 160000, 128000, 102400, 81920, 65536, 65536, 65536, 65536, 65535];
  const dep = t200.schedule.map((r) => r.dep);
  assert.deepStrictEqual(dep, want);
  const openBook = t200.schedule.map((r) => r.openBook);
  assert.deepStrictEqual(openBook, [1000000, 800000, 640000, 512000, 409600, 327680, 262144, 196608, 131072, 65536]);
  assert.strictEqual(t200.totalDep, 999999);
  assert.strictEqual(t200.schedule[9].closeBook, 1, '10年目末は備忘1円');
});
t('200%定率法: 7年目に改定取得価額×改定償却率へ切替（毎年同額65,536）', () => {
  // 7・8・9年目が同額＝改定取得価額262,144×0.250
  assert.strictEqual(t200.schedule[6].dep, 65536);
  assert.strictEqual(t200.schedule[7].dep, 65536);
  assert.strictEqual(t200.schedule[8].dep, 65536);
});

// ── 3. ★250%定率法（平成24年3月以前取得＝別表第九）──────────────────────────────────
t('250%定率法 n10: 償却率0.250/改定0.334/保証0.04448・1年目=250,000・era表示250%', () => {
  assert.strictEqual(t250.rate, 0.250);
  assert.strictEqual(t250.kaiteiRate, 0.334);
  assert.strictEqual(t250.hoshoRate, 0.04448);
  assert.strictEqual(t250.schedule[0].dep, 250000);
  assert.ok(/250%/.test(t250.eraLabel));
  assert.strictEqual(t250.totalDep, 999999);
  assert.strictEqual(t250.schedule[t250.totalYears - 1].closeBook, 1);
  // ★端数は切り捨て（4年目 421,875×0.25=105,468.75→105,468。切上げなら105,469）
  assert.deepStrictEqual(t250.schedule.slice(0, 4).map((r) => r.dep), [250000, 187500, 140625, 105468]);
});
t('★同じ耐用年数でも取得時期で率が変わる（急所1）: 200%(0.200)≠250%(0.250)', () => {
  assert.notStrictEqual(t200.rate, t250.rate);
  assert.ok(t250.schedule[0].dep > t200.schedule[0].dep, '250%の初年度の方が大きい');
});

// ── 4. ★初年度の月割（急所4）──────────────────────────────────────────────────────
t('定額法 4月取得（9か月）: 1年目=75,000・以降100,000・11年目まで延び・合計999,999', () => {
  const r = calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2015-04' }, D);
  assert.strictEqual(r.usedMonths, 9);
  assert.strictEqual(r.schedule[0].dep, 75000); // 100,000×9/12
  assert.strictEqual(r.schedule[1].dep, 100000);
  assert.strictEqual(r.totalDep, 999999);
  assert.ok(r.totalYears === 11, `月割で1年延びる（${r.totalYears}）`);
});
t('月数: 1月→12 / 4月→9 / 12月→1', () => {
  assert.strictEqual(usedMonthsFromStart(1), 12);
  assert.strictEqual(usedMonthsFromStart(4), 9);
  assert.strictEqual(usedMonthsFromStart(12), 1);
});

// ── 5. ★備忘価額1円（急所3）── 取得価額を変えても最終年の期末は必ず1円 ─────────────────
t('備忘1円: 取得価額を変えても最終年末=1円・合計=取得価額−1', () => {
  for (const cost of [123456, 500000, 2000000, 30000]) {
    const r = calcGenka({ method: 'teiritsu', cost, life: 8, acqYm: '2016-01' }, D);
    assert.strictEqual(r.schedule[r.totalYears - 1].closeBook, 1, `cost=${cost} 期末1円`);
    assert.strictEqual(r.totalDep, cost - 1, `cost=${cost} 合計=cost-1`);
  }
});

// ── 6. ★事業専用割合（家事按分）── 必要経費は割合分・帳簿価額は全額で減る ─────────────
t('事業専用割合60%: 必要経費=償却費×60%・帳簿価額は全額で減る', () => {
  const r = calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2015-01', bizRatio: 60 }, D);
  assert.strictEqual(r.firstYearDep, 100000, '償却費は全額');
  assert.strictEqual(r.firstYearExpense, 60000, '必要経費は60%');
  assert.strictEqual(r.schedule[0].closeBook, 900000, '帳簿価額は全額100,000引く');
});

// ── 7. 端数切り捨て（急所6）── floorYen ─────────────────────────────────────────────
t('floorYen: 円未満切り捨て・負とNaNは0', () => {
  assert.strictEqual(floorYen(52428.8), 52428);
  assert.strictEqual(floorYen(100000), 100000);
  assert.strictEqual(floorYen(-5), 0);
  assert.strictEqual(floorYen(NaN), 0);
});

// ── 8. ★取得時期の適用表分岐（急所1）───────────────────────────────────────────────
t('定率法 era境界: 2012-04=200% / 2012-03=250%', () => {
  const a = calcGenka({ method: 'teiritsu', cost: 1000000, life: 10, acqYm: '2012-04' }, D);
  const b = calcGenka({ method: 'teiritsu', cost: 1000000, life: 10, acqYm: '2012-03' }, D);
  assert.strictEqual(a.rate, 0.200); assert.ok(/200%/.test(a.eraLabel));
  assert.strictEqual(b.rate, 0.250); assert.ok(/250%/.test(b.eraLabel));
});

// ── 9. fail closed: 黙って答えない（旧法・範囲外・不正入力）─────────────────────────────
t('fail closed: 平成19年3月以前取得は対象外', () => {
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2007-03' }, D), /対象外/);
});
t('fail closed: 耐用年数<2・>50・取得年月なし・取得価額0・方法未選択・データ無しは throw', () => {
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 1, acqYm: '2015-01' }, D), /耐用年数/);
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 51, acqYm: '2015-01' }, D), /耐用年数/);
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '' }, D), /取得/);
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 0, life: 10, acqYm: '2015-01' }, D), /取得価額/);
  assert.throws(() => calcGenka({ method: 'x', cost: 1000000, life: 10, acqYm: '2015-01' }, D), /償却方法/);
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2015-01' }, null), /genka_rates/);
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2015-01', bizRatio: 0 }, D), /事業専用割合/);
});

// ── 10. 定率法は定額法より初年度が大きい（加速償却の性質）──────────────────────────────
t('定率法の初年度償却費 > 定額法（加速償却）', () => {
  assert.ok(t200.firstYearDep > teigaku.firstYearDep, '200%>定額');
});

// ── 11. データ整合: 全区分で償却率が式（定額=切上げ1/n・定率=四捨五入k/n）に一致 ──────────
t('全耐用年数2〜50: 償却率が国税庁の式と一致（機械照合）', () => {
  const ceil3 = (x) => Math.ceil(Math.round(x * 1e6) / 1000) / 1000;
  const round3 = (x) => Math.floor(x * 1000 + 0.5) / 1000;
  for (let n = 2; n <= 50; n++) {
    if (n >= 3) assert.strictEqual(D.teigaku_rate[String(n)], ceil3(1 / n), `定額 n=${n}`);
    if (n >= 3) {
      assert.strictEqual(D.teiritsu_200[String(n)].rate, round3(2.0 / n), `200 n=${n}`);
      assert.strictEqual(D.teiritsu_250[String(n)].rate, round3(2.5 / n), `250 n=${n}`);
    }
  }
});

// ── 12. ★償却の限度額は資産の種類で変わる（所令134条1項2号イ／ロ）────────────────────
// イ 有形＝取得価額−1円まで ／ ロ 坑道・無形固定資産＝取得価額に相当する金額まで（1円を残さない）
t('無形固定資産（ソフトウエア）は1円を残さず取得価額まで償却する（134条1項2号ロ）', () => {
  const m = calcGenka({ method: 'teigaku', cost: 1000000, life: 5, acqYm: '2015-01', assetType: 'mukei' }, D);
  const last = m.schedule[m.schedule.length - 1];
  assert.strictEqual(m.residual, 0, '残す額は0円');
  assert.strictEqual(last.closeBook, 0, '最終年の期末帳簿価額は0円');
  assert.strictEqual(m.totalDep, 1000000, '償却費の合計＝取得価額（−1円ではない）');
  assert.strictEqual(m.totalYears, 5);
});

t('★対照: 同条件でも有形なら1円が残る（同じ入力で結果が分かれることを固定）', () => {
  const y = calcGenka({ method: 'teigaku', cost: 1000000, life: 5, acqYm: '2015-01', assetType: 'yukei' }, D);
  assert.strictEqual(y.residual, 1);
  assert.strictEqual(y.schedule[y.schedule.length - 1].closeBook, 1);
  assert.strictEqual(y.totalDep, 999999, '有形は取得価額−1円');
});

t('坑道も1円を残さない（134条1項2号ロは「坑道及び…無形固定資産」）', () => {
  const k = calcGenka({ method: 'teigaku', cost: 500000, life: 5, acqYm: '2015-01', assetType: 'kodo' }, D);
  assert.strictEqual(k.residual, 0);
  assert.strictEqual(k.schedule[k.schedule.length - 1].closeBook, 0);
  assert.strictEqual(k.totalDep, 500000);
});

t('assetType 省略＝有形（既定値。従来の呼び出しの結果を変えない）', () => {
  const d = calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2015-01' }, D);
  assert.strictEqual(d.assetType, 'yukei');
  assert.strictEqual(d.totalDep, teigaku.totalDep);
});

t('fail closed: 無形固定資産に定率法は選べない（所令120条の2第1項4号）／未知の種類は throw', () => {
  assert.throws(() => calcGenka({ method: 'teiritsu', cost: 1000000, life: 10, acqYm: '2015-01', assetType: 'mukei' }, D), /定率法/);
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2015-01', assetType: 'nazo' }, D), /資産の種類/);
  // 坑道は鉱業用減価償却資産なので定率法を選べる（同項3号ロ）＝止めてはいけない
  assert.doesNotThrow(() => calcGenka({ method: 'teiritsu', cost: 1000000, life: 10, acqYm: '2015-01', assetType: 'kodo' }, D));
});

t('無形の注記は「1円を残さない」と言う／有形の注記と取り違えていない', () => {
  const m = calcGenka({ method: 'teigaku', cost: 300000, life: 5, acqYm: '2015-01', assetType: 'mukei' }, D);
  const y = calcGenka({ method: 'teigaku', cost: 300000, life: 5, acqYm: '2015-01', assetType: 'yukei' }, D);
  assert.ok(m.notes.some((n) => /1円を残しません/.test(n)), '無形: ' + m.notes.join('|'));
  assert.ok(!m.notes.some((n) => /備忘価額1円を残します/.test(n)), '無形に有形の注記が混ざっている');
  assert.ok(y.notes.some((n) => /備忘価額1円を残します/.test(n)), '有形: ' + y.notes.join('|'));
});

// ── 13. ★中古資産の簡便法（耐令3条／外部オラクル No.5404）─────────────────────────────
t('★オラクル No.5404: 法定30年・経過10年 → 22年（国税庁の公表例を再現）', () => {
  const r = chukoTaiyoNensu({ houteiLife: 30, keikaYears: 10 });
  assert.strictEqual(r.unavailable, false);
  assert.strictEqual(r.years, 22);
  assert.strictEqual(r.zenbu, false, '一部経過（2号ロ）');
});

t('全部経過は法定×20%（2号イ）: 法定22年・経過25年 → 4年（22×0.2=4.4→切捨）', () => {
  const r = chukoTaiyoNensu({ houteiLife: 22, keikaYears: 25 });
  assert.strictEqual(r.zenbu, true);
  assert.strictEqual(r.years, 4);
});

t('経過＝法定ちょうども「全部経過」（境界。22年経過→4年であって22年ではない）', () => {
  const r = chukoTaiyoNensu({ houteiLife: 22, keikaYears: 22, keikaMonths: 0 });
  assert.strictEqual(r.zenbu, true);
  assert.strictEqual(r.years, 4);
});

t('★経過年数は月まで数える（耐令3条5項「暦に従つて計算し」）: 法定22年・築10年3か月 → 13年', () => {
  // (264-123)か月 + 123か月×20% = 141 + 24.6 = 165.6か月 = 13.8年 → 13年
  const r = chukoTaiyoNensu({ houteiLife: 22, keikaYears: 10, keikaMonths: 3 });
  assert.strictEqual(r.years, 13);
  assert.strictEqual(r.keikaTotalMonths, 123);
  assert.ok(Math.abs(r.rawMonths - 165.6) < 1e-9, 'rawMonths=' + r.rawMonths);
  // ★月を捨てて「10年」で計算すると14年になる＝月を数えないと1年ずれることを固定する
  assert.strictEqual(chukoTaiyoNensu({ houteiLife: 22, keikaYears: 10 }).years, 14);
});

t('2年未満は2年（2号かっこ書き）: 法定4年・全部経過 → 0.8年ではなく2年', () => {
  const r = chukoTaiyoNensu({ houteiLife: 4, keikaYears: 4 });
  assert.strictEqual(r.years, 2);
  assert.strictEqual(r.floored, true);
  assert.ok(r.notes.some((n) => /2年に満たない/.test(n)));
});

t('経過0か月なら法定耐用年数のまま（新品と同じ。短くならない）', () => {
  assert.strictEqual(chukoTaiyoNensu({ houteiLife: 6, keikaYears: 0, keikaMonths: 0 }).years, 6);
});

t('★ただし書: 資本的支出 > 取得価額×50% で簡便法は使えない（耐令3条1項ただし書）', () => {
  const ng = chukoTaiyoNensu({ houteiLife: 22, keikaYears: 10, cost: 1000000, shihontekiShishutsu: 500001 });
  assert.strictEqual(ng.unavailable, true);
  assert.strictEqual(ng.years, null, '使えないのに年数を返してはいけない');
  assert.ok(/50／|50％/.test(ng.reason) || /50%/.test(ng.reason), ng.reason);
  assert.ok(/再取得価額/.test(ng.reason), '再取得価額50%超＝法定耐用年数の case を落としていない');
  // ちょうど50%は「超える」に当たらない＝使える（境界）
  const ok = chukoTaiyoNensu({ houteiLife: 22, keikaYears: 10, cost: 1000000, shihontekiShishutsu: 500000 });
  assert.strictEqual(ok.unavailable, false, 'ちょうど50%は使える');
  assert.strictEqual(ok.years, 14);
});

t('fail closed: 法定耐用年数<2・経過が負・経過月が12以上は年数を返さない', () => {
  for (const bad of [{ houteiLife: 1, keikaYears: 0 }, { houteiLife: 22, keikaYears: -1 },
                     { houteiLife: 22, keikaYears: 0, keikaMonths: 12 }, { houteiLife: NaN, keikaYears: 0 }]) {
    const r = chukoTaiyoNensu(bad);
    assert.strictEqual(r.unavailable, true, JSON.stringify(bad));
    assert.strictEqual(r.years, null, JSON.stringify(bad));
  }
});

t('簡便法の年数は必ず 2 以上・法定耐用年数以下（全域スイープ 2〜60年 × 経過0〜80年）', () => {
  for (let h = 2; h <= 60; h++) {
    for (let k = 0; k <= 80; k++) {
      for (const m of [0, 5, 11]) {
        const r = chukoTaiyoNensu({ houteiLife: h, keikaYears: k, keikaMonths: m });
        assert.strictEqual(r.unavailable, false, `h=${h} k=${k} m=${m}`);
        assert.ok(r.years >= 2, `h=${h} k=${k} m=${m} → ${r.years}`);
        assert.ok(r.years <= Math.max(2, h), `中古なのに法定より長い h=${h} k=${k} m=${m} → ${r.years}`);
        assert.strictEqual(r.years, Math.floor(r.years), '整数年');
      }
    }
  }
});

t('簡便法の年数は経過が長いほど短くなる（単調非増加）', () => {
  for (const h of [4, 6, 22, 30, 47]) {
    let prev = Infinity;
    for (let mo = 0; mo <= h * 12 + 24; mo++) {
      const r = chukoTaiyoNensu({ houteiLife: h, keikaYears: Math.floor(mo / 12), keikaMonths: mo % 12 });
      assert.ok(r.years <= prev, `h=${h} ${mo}か月で増えた ${prev}→${r.years}`);
      prev = r.years;
    }
  }
});

t('formatYm: 165.6か月＝13年9.6か月 / 12か月＝1年 / 0は「0か月」', () => {
  assert.strictEqual(formatYm(165.6), '13年9.6か月');
  assert.strictEqual(formatYm(12), '1年');
  assert.strictEqual(formatYm(3), '3か月');
  assert.strictEqual(formatYm(0), '0か月');
});

t('ASSET_TYPES はイ／ロの2水準しか持たない（残す額は1円か0円だけ）', () => {
  const residuals = new Set(Object.values(ASSET_TYPES).map((a) => a.residual));
  assert.deepStrictEqual([...residuals].sort(), [0, 1]);
  assert.strictEqual(ASSET_TYPES.mukei.teiritsuOk, false);
  assert.strictEqual(ASSET_TYPES.kodo.teiritsuOk, true, '坑道は鉱業用＝定率法可');
});

console.log(`\n${fail ? '❌' : '✓'} 減価償却コア: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
