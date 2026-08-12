/**
 * 補助金の経理・税務（圧縮記帳）の検査。
 *
 * ★オラクルは条文（法人税法42条・43条・44条・22条2項）。
 *   「補助金をもらった＝圧縮記帳」と実装すると、返還不要が未確定の年度に
 *   圧縮してしまう。分岐の境目をここで固定する。
 */
import { readFileSync } from 'node:fs';
import { bunki, assyukuGendo, shoukyaku, shiwake, BUNKI } from '../docs/assets/hojokin_zeimu_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/hojokin_zeimu_r08.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (c, m) => { checks++; if (!c) { console.log('  ✗ ' + m); fail++; } };
const eq = (a, b, m) => ok(a === b, `${m}（期待 ${b} / 実際 ${a}）`);

// ── データが条文と一致するか ────────────────────────────────────
console.log('★データ');
eq(D.bunki.kakutei_zumi.jobun, '法人税法42条1項', '確定済みは42条');
eq(D.bunki.mikakutei.jobun, '法人税法43条1項', '未確定は43条');
eq(D.bunki.ato_de_kakutei.jobun, '法人税法44条1項', 'あとで確定は44条');
ok(D.bunki.kakutei_zumi.youken.includes('当該事業年度終了の時までに確定した'),
  '★42条の要件は「期末までに確定した」');
ok(D.bunki.mikakutei.youken.includes('確定していない'), '★43条の要件は「確定していない」');
ok(D.bunki.mikakutei.shori.includes('特別勘定'), '★43条は特別勘定');
ok(D.juzoueki._note.includes('繰り延べ'), '★圧縮記帳は課税の繰延べだと書いてある（非課税ではない）');
eq(D.assyuku.houshiki.length, 2, '方式は2つ');
ok(D.shouhizei._henkan.includes('交付要綱'),
  '★消費税の仕入控除税額の返還は交付要綱に基づくもので、消費税法の規定ではないと書いてある');

// ── ★分岐 ────────────────────────────────────────────────
console.log('★分岐');
eq(bunki({ kakuteiZumi: true, shutokuZumi: true }, D).key, BUNKI.KAKUTEI,
  '確定＋取得済み → 42条の圧縮記帳');
eq(bunki({ kakuteiZumi: false, shutokuZumi: true }, D).key, BUNKI.MIKAKUTEI,
  '★未確定なら、資産を取得していても43条の特別勘定');
eq(bunki({ kakuteiZumi: true, shutokuZumi: false }, D).key, BUNKI.MIKAKUTEI,
  '★確定していても、対象資産を取得していなければ42条では処理できない');
eq(bunki({ kakuteiZumi: true, shutokuZumi: true, tokubetsuArii: true }, D).key, BUNKI.ATODE,
  '★特別勘定があって確定したら44条');
eq(bunki({ kakuteiZumi: false, shutokuZumi: false }, D).key, BUNKI.MIKAKUTEI, '両方まだなら特別勘定');
ok(bunki({ kakuteiZumi: true, shutokuZumi: false }, D)._note.includes('取得'),
  '取得していないことを理由として名指しする');

// ── ★圧縮限度額 ──────────────────────────────────────────────
console.log('★圧縮限度額');
{
  const r = assyukuGendo(3000000, 10000000);
  eq(r.gendo, 3000000, '補助金 < 取得価額なら補助金の額');
  ok(!r.capped, '頭打ちにならない');
}
{
  // ★補助金のほうが大きいケース（取得価額を超えて減額できない）
  const r = assyukuGendo(12000000, 10000000);
  eq(r.gendo, 10000000, '★取得価額で頭打ち');
  ok(r.capped, '頭打ちになったことを申告する');
}
eq(assyukuGendo(3000000, 3000000).gendo, 3000000, '同額なら全額');
eq(assyukuGendo(0, 10000000).gendo, 0, '補助金0なら0');
eq(assyukuGendo(-5, 100).gendo, 0, '負の入力は0に倒す');

// ── ★2つの方式で減価償却が変わる ────────────────────────────────
console.log('★方式の違い');
{
  const base = { shutokuKagaku: 10000000, gendo: 3000000, shoukyakuRitsu: 0.1, tsukisu: 12 };
  const c = shoukyaku({ ...base, houshiki: 'chokusetsu' });
  const t = shoukyaku({ ...base, houshiki: 'tsumitate' });
  eq(c.base, 7000000, '★直接減額は圧縮後の700万円で償却する');
  eq(c.genka, 700000, '700万 × 10%');
  eq(t.base, 10000000, '★積立金方式は簿価が下がらないので1,000万円で償却する');
  eq(t.genka, 1000000, '1,000万 × 10%');
  ok(t.genka - c.genka === 300000,
    `★同じ補助金でも当期の減価償却費が ${(t.genka - c.genka).toLocaleString()}円 違う`);
  checks++;
  eq(c.kaikeiBoka, 7000000, '直接減額の会計簿価');
  eq(t.kaikeiBoka, 10000000, '積立金方式の会計簿価');
}
{
  // 期中供用は月割り
  const r = shoukyaku({ shutokuKagaku: 12000000, gendo: 0, houshiki: 'tsumitate', shoukyakuRitsu: 0.1, tsukisu: 6 });
  eq(r.genka, 600000, '★6か月なら半分（1,200万×10%×6/12）');
}
eq(shoukyaku({ shutokuKagaku: 100, gendo: 200, houshiki: 'chokusetsu', shoukyakuRitsu: 0.1 }).base, 0,
  '圧縮額が価額を超えても基礎はマイナスにしない');

// ── ★仕訳 ────────────────────────────────────────────────
console.log('★仕訳');
{
  const rows = shiwake({ bunkiKey: BUNKI.KAKUTEI, hojokin: 3000000, gendo: 3000000, houshiki: 'chokusetsu' });
  ok(rows[0].cr.includes('国庫補助金収入'), '受入れは収益に立てる');
  ok(rows[0].note.includes('益金'), '★補助金が益金に入ることを言う');
  ok(rows.some((r) => r.dr === '固定資産圧縮損'), '直接減額は圧縮損');
  ok(!rows.some((r) => r.cr === '国庫補助金等特別勘定'), '確定済みなら特別勘定は出さない');
}
{
  const rows = shiwake({ bunkiKey: BUNKI.KAKUTEI, hojokin: 3000000, gendo: 3000000, houshiki: 'tsumitate' });
  ok(rows.some((r) => r.cr === '圧縮積立金'), '積立金方式は圧縮積立金');
  ok(rows.some((r) => r.dr === '繰越利益剰余金'), '★剰余金の処分で積む');
  ok(!rows.some((r) => r.dr === '固定資産圧縮損'), '積立金方式で圧縮損は出さない');
}
{
  const rows = shiwake({ bunkiKey: BUNKI.MIKAKUTEI, hojokin: 3000000, gendo: 0, houshiki: 'chokusetsu' });
  ok(rows.some((r) => r.cr === '国庫補助金等特別勘定'), '★未確定なら特別勘定を積む');
  ok(!rows.some((r) => r.dr === '固定資産圧縮損'), '★未確定なら圧縮記帳の仕訳を出さない');
  ok(rows.some((r) => r.note.includes('43条')), '根拠の条文を言う');
}
{
  const rows = shiwake({ bunkiKey: BUNKI.ATODE, hojokin: 3000000, gendo: 3000000, houshiki: 'chokusetsu' });
  ok(rows.some((r) => r.dr === '国庫補助金等特別勘定'), '★44条では特別勘定を取り崩す');
  ok(rows.some((r) => r.dr === '固定資産圧縮損'), '同時に圧縮記帳する');
}

// ── ★壊しテスト ─────────────────────────────────────────────
console.log('★壊しテスト');
{
  // 「補助金をもらった＝圧縮記帳」と書いた実装との違い
  const seikai = bunki({ kakuteiZumi: false, shutokuZumi: true }, D).key;
  const machigai = BUNKI.KAKUTEI;   // もらった時点で圧縮すると考えた場合
  ok(seikai === BUNKI.MIKAKUTEI && seikai !== machigai,
    '★返還不要が未確定なのに圧縮記帳すると、確定していない年度に損金を立てることになる');
  checks++;
  console.log('  ok   未確定: 条文どおり→特別勘定(43条) / 「もらった＝圧縮」実装→圧縮記帳(42条)');
}
{
  // 圧縮限度額に取得価額の頭打ちを入れない実装
  const seikai = assyukuGendo(12000000, 10000000).gendo;
  const machigai = 12000000;
  ok(seikai === 10000000 && seikai < machigai,
    `★頭打ちが無いと ${machigai.toLocaleString()}円 まで減額でき、帳簿価額が負になる`);
  checks++;
}

console.log(`\n${fail ? '✗' : '✓'} test_hojokin_zeimu: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
