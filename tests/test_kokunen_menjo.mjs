/**
 * 国民年金保険料の免除・納付猶予・学生納付特例の判定コアの単体テスト。
 *
 * ★オラクルの置き方（規則1・規則2の趣旨）:
 *   基準額はデータJSONを読んで比べるのではなく、**施行令の条文から手で起こした定数**をここに置く。
 *   JSONを読んで比べると「JSONが正しいこと」を一度も確かめないまま緑になる。
 *   さらに、日本年金機構が公表している**外部の実額**（4,480/8,960/13,440円・40年全額免除で423,650円）を
 *   そのまま突き合わせて、実装が公表値を再現することを確かめる。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  hantei, kijunGaku, shotokuFor, fuyoNinzu, fuyoKojoGaku,
  getsugakuHokenryo, nenkinEizoku, kubunDef,
} from '../docs/assets/kokunen_menjo_core.js';

const DATA = JSON.parse(readFileSync(new URL('../docs/assets/kokunen_menjo_r08.json', import.meta.url)));
const NENKIN = JSON.parse(readFileSync(new URL('../docs/assets/nenkin_r08.json', import.meta.url)));

let n = 0;
const t = (name, fn) => { fn(); n++; };

/** 施行令から手で起こした基準額（JSONを読まない独立オラクル） */
const OYA = {
  zengaku_fuyo0: 1 * 350000 + 320000,   // 6条の7: (0+1)×35万+32万
  zengaku_fuyo1: 2 * 350000 + 320000,   // 扶養1人
  zengaku_fuyo3: 4 * 350000 + 320000,   // 扶養3人
  san_yon_fuyo0: 880000,                // 6条の8の2
  hangaku_fuyo0: 1280000,               // 6条の9
  ichi_yon_fuyo0: 1680000,              // 6条の9の2
  tokurei: 1350000,                     // 6条の8（障害者・寡婦・ひとり親）
};

const P = (o = {}) => ({ shotoku: 0, fuyo: {}, kojo: 0, ...o });

// ───────────────────────── 基準額（条文どおりか）

t('全額免除の基準額は (扶養親族等の数+1)×35万+32万', () => {
  const def = kubunDef('zengaku', DATA);
  assert.strictEqual(kijunGaku(P(), def, DATA), OYA.zengaku_fuyo0);
  assert.strictEqual(kijunGaku(P({ fuyo: { ippan: 1 } }), def, DATA), OYA.zengaku_fuyo1);
  assert.strictEqual(kijunGaku(P({ fuyo: { ippan: 1, tokutei: 1, rojin: 1 } }), def, DATA), OYA.zengaku_fuyo3);
});

t('★全額免除は扶養の区分を見ず頭数だけ数える（特定扶養でも一般でも同額）', () => {
  const def = kubunDef('zengaku', DATA);
  const a = kijunGaku(P({ fuyo: { ippan: 2 } }), def, DATA);
  const b = kijunGaku(P({ fuyo: { tokutei: 2 } }), def, DATA);
  assert.strictEqual(a, b, '施行令6条の7は区分を持たない');
  assert.strictEqual(a, 3 * 350000 + 320000);
});

t('一部免除の基準額は 88万/128万/168万 + 扶養親族等控除額', () => {
  assert.strictEqual(kijunGaku(P(), kubunDef('menjo_3_4', DATA), DATA), OYA.san_yon_fuyo0);
  assert.strictEqual(kijunGaku(P(), kubunDef('menjo_half', DATA), DATA), OYA.hangaku_fuyo0);
  assert.strictEqual(kijunGaku(P(), kubunDef('menjo_1_4', DATA), DATA), OYA.ichi_yon_fuyo0);
});

t('★一部免除の扶養加算は区分ごとの控除額（一般38万・老人48万・特定63万）', () => {
  const def = kubunDef('menjo_half', DATA);
  assert.strictEqual(kijunGaku(P({ fuyo: { ippan: 1 } }), def, DATA), 1280000 + 380000);
  assert.strictEqual(kijunGaku(P({ fuyo: { rojin: 1 } }), def, DATA), 1280000 + 480000);
  assert.strictEqual(kijunGaku(P({ fuyo: { tokutei: 1 } }), def, DATA), 1280000 + 630000);
  // 混在
  assert.strictEqual(fuyoKojoGaku({ ippan: 2, rojin: 1, tokutei: 1 }, DATA), 380000 * 2 + 480000 + 630000);
  assert.strictEqual(fuyoNinzu({ ippan: 2, rojin: 1, tokutei: 1 }), 4);
});

// ───────────────────────── ★急所1: 控除を引く区分と引かない区分

t('★★全額免除は社会保険料控除等を引かない（施行令6条の11に減算規定が無い）', () => {
  const p = P({ shotoku: 700000, kojo: 200000 });
  assert.strictEqual(shotokuFor(p, kubunDef('zengaku', DATA), DATA), 700000, '引いてはいけない');
  assert.strictEqual(shotokuFor(p, kubunDef('nofu_yuyo', DATA), DATA), 700000);
});

t('★★一部免除・学生納付特例は控除を引く（施行令6条の12第2項）', () => {
  const p = P({ shotoku: 700000, kojo: 200000 });
  assert.strictEqual(shotokuFor(p, kubunDef('menjo_3_4', DATA), DATA), 500000);
  assert.strictEqual(shotokuFor(p, kubunDef('gakusei', DATA), DATA), 500000);
});

t('★★この非対称は答えを反転させる（所得70万・社保控除20万・扶養0）', () => {
  // 全額免除の基準670,000 に対し、所得700,000 は超える → 全額免除は不可。
  // 一方 4分の3免除は 700,000-200,000=500,000 ≤ 880,000 で該当する。
  // 6区分に一律で控除を引く実装だと、500,000 ≤ 670,000 となり「全額免除されます」と誤答する。
  const r = hantei({ honnin: P({ shotoku: 700000, kojo: 200000 }), age: 30 }, DATA);
  const keys = r.available.map((x) => x.key);
  assert.ok(!keys.includes('zengaku'), '全額免除に該当してはいけない');
  assert.ok(keys.includes('menjo_3_4'), '4分の3免除には該当する');
  assert.strictEqual(r.best.key, 'menjo_3_4');
});

t('定額控除（障害者27万・特別障害者40万・寡婦27万・ひとり親35万・勤労学生27万）を引く', () => {
  const def = kubunDef('menjo_half', DATA);
  assert.strictEqual(shotokuFor(P({ shotoku: 1000000, shogaisha: true }), def, DATA), 730000);
  assert.strictEqual(shotokuFor(P({ shotoku: 1000000, tokuBetsuShogaisha: true }), def, DATA), 600000);
  assert.strictEqual(shotokuFor(P({ shotoku: 1000000, kafu: true }), def, DATA), 730000);
  assert.strictEqual(shotokuFor(P({ shotoku: 1000000, hitorioya: true }), def, DATA), 650000);
  assert.strictEqual(shotokuFor(P({ shotoku: 1000000, kinroGakusei: true }), def, DATA), 730000);
});

t('障害者控除は一般と特別を重ねない（特別を選んだら40万円ひとつ）', () => {
  const def = kubunDef('menjo_half', DATA);
  const p = P({ shotoku: 1000000, shogaisha: true, tokuBetsuShogaisha: true });
  assert.strictEqual(shotokuFor(p, def, DATA), 600000, '27万+40万=67万を引いてはいけない');
});

// ───────────────────────── 135万円の特例（法90条1項3号）

t('★障害者・寡婦・ひとり親は所得135万円以下なら全額免除（扶養加算を持たない定額）', () => {
  const def = kubunDef('zengaku', DATA);
  // 通常式なら670,000で落ちる所得だが、特例で通る
  assert.strictEqual(kijunGaku(P({ shogaisha: true }), def, DATA), OYA.tokurei);
  const r = hantei({ honnin: P({ shotoku: 1300000, hitorioya: true }), age: 30 }, DATA);
  assert.ok(r.available.map((x) => x.key).includes('zengaku'));
});

t('135万円ちょうどは該当し、1円超えると外れる（条文は「以下」）', () => {
  const ok = hantei({ honnin: P({ shotoku: 1350000, kafu: true }), age: 30 }, DATA);
  const ng = hantei({ honnin: P({ shotoku: 1350001, kafu: true }), age: 30 }, DATA);
  assert.ok(ok.available.map((x) => x.key).includes('zengaku'));
  assert.ok(!ng.available.map((x) => x.key).includes('zengaku'));
});

t('★135万円の特例は納付猶予には効かない（法90条1項3号は全額免除だけの号）', () => {
  const def = kubunDef('nofu_yuyo', DATA);
  assert.strictEqual(kijunGaku(P({ shogaisha: true }), def, DATA), OYA.zengaku_fuyo0, '猶予は通常式のまま');
});

t('通常式のほうが有利ならそちらを採る（扶養3人なら172万 > 135万）', () => {
  const def = kubunDef('zengaku', DATA);
  assert.strictEqual(kijunGaku(P({ fuyo: { ippan: 3 }, shogaisha: true }), def, DATA), OYA.zengaku_fuyo3);
});

// ───────────────────────── ★急所3: 誰の所得を見るか

t('★★親と同居（世帯主の所得が高い）と全額免除は落ちるが、納付猶予は通る', () => {
  const input = {
    honnin: P({ shotoku: 0 }),
    setainushi: P({ shotoku: 3000000 }),   // 親
    age: 25,
  };
  const r = hantei(input, DATA);
  const keys = r.available.map((x) => x.key);
  assert.ok(!keys.includes('zengaku'), '世帯主で落ちる');
  assert.ok(!keys.includes('menjo_3_4'), '一部免除も世帯主を見る');
  assert.ok(keys.includes('nofu_yuyo'), '納付猶予は世帯主を見ないので通る');

  // どの人が落としたのかを名指しで出していること（これが画面の主役）
  const zen = r.results.find((x) => x.key === 'zengaku');
  assert.strictEqual(zen.failed.length, 1);
  assert.strictEqual(zen.failed[0].who, 'setainushi');
  assert.strictEqual(zen.failed[0].label, '世帯主');
});

t('★配偶者の所得は納付猶予でも見る（世帯主だけが除かれる）', () => {
  const r = hantei({ honnin: P({ shotoku: 0 }), haigusha: P({ shotoku: 3000000 }), age: 25 }, DATA);
  assert.ok(!r.available.map((x) => x.key).includes('nofu_yuyo'));
  const y = r.results.find((x) => x.key === 'nofu_yuyo');
  assert.strictEqual(y.failed[0].who, 'haigusha');
});

t('居ない人（配偶者なし・本人が世帯主）は判定に加えない', () => {
  const r = hantei({ honnin: P({ shotoku: 0 }), age: 25 }, DATA);
  const zen = r.results.find((x) => x.key === 'zengaku');
  assert.strictEqual(zen.people.length, 1);
  assert.strictEqual(zen.people[0].who, 'honnin');
});

// ───────────────────────── 学生・年齢

t('★学生は免除・納付猶予の対象外で、学生納付特例だけが出る', () => {
  const r = hantei({ honnin: P({ shotoku: 1000000 }), age: 20, isStudent: true }, DATA);
  const keys = r.available.map((x) => x.key);
  assert.deepStrictEqual(keys, ['gakusei']);
  assert.strictEqual(r.results.find((x) => x.key === 'zengaku').blocked, 'student');
});

t('★学生でない人に学生納付特例を出さない', () => {
  const r = hantei({ honnin: P({ shotoku: 0 }), age: 20 }, DATA);
  assert.ok(!r.available.map((x) => x.key).includes('gakusei'));
  assert.strictEqual(r.results.find((x) => x.key === 'gakusei').blocked, 'not_student');
});

t('★学生納付特例は本人だけで判定する（親の所得を見ない）', () => {
  const r = hantei({
    honnin: P({ shotoku: 1200000, kojo: 0 }),
    setainushi: P({ shotoku: 9000000 }),
    age: 20, isStudent: true,
  }, DATA);
  assert.ok(r.available.map((x) => x.key).includes('gakusei'), '親の所得で落としてはいけない');
});

t('納付猶予は50歳未満（50歳ちょうどは対象外・境界）', () => {
  const at49 = hantei({ honnin: P({ shotoku: 0 }), setainushi: P({ shotoku: 9000000 }), age: 49 }, DATA);
  const at50 = hantei({ honnin: P({ shotoku: 0 }), setainushi: P({ shotoku: 9000000 }), age: 50 }, DATA);
  assert.ok(at49.available.map((x) => x.key).includes('nofu_yuyo'));
  assert.ok(!at50.available.map((x) => x.key).includes('nofu_yuyo'));
  assert.strictEqual(at50.results.find((x) => x.key === 'nofu_yuyo').blocked, 'age');
});

t('★年齢が未入力なら納付猶予を与えない（fail closed）', () => {
  const r = hantei({ honnin: P({ shotoku: 0 }), setainushi: P({ shotoku: 9000000 }) }, DATA);
  assert.ok(!r.available.map((x) => x.key).includes('nofu_yuyo'));
  assert.strictEqual(r.results.find((x) => x.key === 'nofu_yuyo').blocked, 'age_unknown');
});

// ───────────────────────── 境界（基準額は「以下」）

t('基準額ちょうどは該当し、1円超えると外れる', () => {
  for (const [key, kijun] of [['zengaku', OYA.zengaku_fuyo0], ['menjo_3_4', OYA.san_yon_fuyo0],
    ['menjo_half', OYA.hangaku_fuyo0], ['menjo_1_4', OYA.ichi_yon_fuyo0]]) {
    const ok = hantei({ honnin: P({ shotoku: kijun }), age: 30 }, DATA);
    const ng = hantei({ honnin: P({ shotoku: kijun + 1 }), age: 30 }, DATA);
    assert.ok(ok.available.map((x) => x.key).includes(key), `${key} は基準額ちょうどで該当`);
    assert.ok(!ng.available.map((x) => x.key).includes(key), `${key} は1円超で外れる`);
  }
});

t('有利な順に並び、best は最も有利な区分', () => {
  const r = hantei({ honnin: P({ shotoku: 0 }), age: 30 }, DATA);
  assert.strictEqual(r.best.key, 'zengaku');
  assert.strictEqual(r.available[0].key, 'zengaku');
});

// ───────────────────────── 外部オラクル: 日本年金機構の公表実額

t('★★毎月納める保険料が日本年金機構の公表額と一致する（4,480/8,960/13,440円）', () => {
  assert.strictEqual(getsugakuHokenryo(kubunDef('zengaku', DATA), DATA), 0);
  assert.strictEqual(getsugakuHokenryo(kubunDef('menjo_3_4', DATA), DATA), 4480);
  assert.strictEqual(getsugakuHokenryo(kubunDef('menjo_half', DATA), DATA), 8960);
  assert.strictEqual(getsugakuHokenryo(kubunDef('menjo_1_4', DATA), DATA), 13440);
  assert.strictEqual(getsugakuHokenryo(kubunDef('nofu_yuyo', DATA), DATA), 0);
  assert.strictEqual(getsugakuHokenryo(kubunDef('gakusei', DATA), DATA), 0);
});

t('★★40年すべて全額免除の老齢基礎年金が公表値 423,650円 と一致する', () => {
  // 日本年金機構の免除ページ「1年で受け取れる年金額のめやす」より
  //   40年納付 847,300円 / 40年全額免除（国庫負担2分の1） 423,650円
  const r = nenkinEizoku(kubunDef('zengaku', DATA), 480, NENKIN, '1990-01-01');
  assert.strictEqual(r.paidYen, 847300);
  assert.strictEqual(r.menjoYen, 423650);
  assert.strictEqual(r.diffYen, 847300 - 423650);
  assert.strictEqual(r.reflects, true);
});

t('★納付猶予・学生納付特例は年金額に1円も反映されない（全額免除の1/2と混同しない）', () => {
  for (const key of ['nofu_yuyo', 'gakusei']) {
    const r = nenkinEizoku(kubunDef(key, DATA), 480, NENKIN, '1990-01-01');
    assert.strictEqual(r.menjoYen, 0, `${key} は額に反映されない`);
    assert.strictEqual(r.reflects, false);
    assert.strictEqual(r.diffYen, r.paidYen);
  }
});

t('一部免除の反映率が国民年金法27条どおり（8分の5・4分の3・8分の7）', () => {
  const full = 847300;
  for (const [key, num, den] of [['menjo_3_4', 5, 8], ['menjo_half', 3, 4], ['menjo_1_4', 7, 8]]) {
    const r = nenkinEizoku(kubunDef(key, DATA), 480, NENKIN, '1990-01-01');
    assert.strictEqual(r.menjoYen, Math.round((full * num) / den), `${key} は${num}/${den}`);
  }
});

// ───────────────────────── 入力の頑健さ

t('未入力・負数・文字列を0として扱い、NaNを外へ出さない', () => {
  const r = hantei({ honnin: { shotoku: '', fuyo: { ippan: '' }, kojo: 'abc' }, age: 30 }, DATA);
  for (const x of r.results) {
    for (const p of x.people || []) {
      assert.ok(Number.isFinite(p.shotoku), 'shotoku が NaN');
      assert.ok(p.kijun == null || Number.isFinite(p.kijun), 'kijun が NaN');
    }
  }
  assert.strictEqual(r.best.key, 'zengaku');
});

t('未知の区分キーは黙って別の区分を選ばずnullを返す', () => {
  assert.strictEqual(kubunDef('sonzai_shinai', DATA), null);
  assert.strictEqual(kijunGaku(P(), null, DATA), null);
  assert.strictEqual(getsugakuHokenryo(null, DATA), null);
});

console.log(`test_kokunen_menjo: ${n}件 緑`);
