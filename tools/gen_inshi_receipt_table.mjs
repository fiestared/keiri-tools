/** 第17号の静的早見表。計算機と同じJSONを正本にし、--checkでは書かない。 */
import { readFileSync, writeFileSync } from 'node:fs';

const page = new URL('../docs/inshi/index.html', import.meta.url);
const data = JSON.parse(readFileSync(new URL('../docs/assets/inshi_r07.json', import.meta.url), 'utf8'));
const doc = data.docs.k17_uriage;
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const yen = n => `${n.toLocaleString('ja-JP')}円`;
const rows = [
  [`記載金額が${yen(doc.hikazei_under)}未満`, '非課税（印紙不要）'],
  ...doc.brackets.map(b => [`記載金額が${b.label}`, yen(b.tax)]),
  ['受取金額の記載がないもの（営業に関するもの）', yen(doc.noamount)],
];
if (doc.type !== 'bracket' || !doc.brackets.length || !data._meta.url2) throw new Error('第17号データの形式を確認してください');
const block = `<!-- receipt-table:auto -->
<section class="card" aria-label="領収書の収入印紙早見表">
  <p id="receipt-tax-basis">この表は<b>営業に関する紙の売上代金の領収書</b>が対象です。表の「記載金額」は次のとおり決めます。課税事業者が消費税額等を区分記載するか、税込・税抜価格の併記で明らかにしていれば、その額を除いた金額です（免税事業者は区分記載しても税込）。売上代金とそれ以外の金額を区分できる受取書は売上代金の金額で階級を選びますが、5万円未満で非課税かどうかは合計額で判定します。区分できなければ全額を売上代金の金額とします（国税庁 No.7105・No.6925）。</p>
  <div class="scroll-wrap">
  <table class="tbl num-nowrap" id="receipt-tax-table" aria-describedby="receipt-tax-basis">
    <caption>営業に関する紙の売上代金の領収書（第17号文書）の収入印紙（記載金額は表の上の決め方による）</caption>
    <thead><tr><th scope="col">記載金額の範囲（決め方は表の上）</th><th scope="col" class="num">印紙税額（1通／営業に関する紙の売上代金の領収書）</th></tr></thead>
    <tbody>
${rows.map(([label, tax]) => `      <tr><th scope="row">${esc(label)}</th><td class="num">${esc(tax)}</td></tr>`).join('\n')}
    </tbody>
  </table>
  </div>
  <p>営業に関する紙の領収書が対象です。電子交付だけの領収書や、営業に関しない受取書は非課税です。借入金など売上代金以外の受取書は、下の判定機で文書の種類を選んでください。</p>
  <p>消費税額等と混在の扱いの詳しい説明は、<a href="#ryoshusho">領収書の金額と消費税の説明</a>をご確認ください。</p>
  <p class="hint">出典：<a href="${esc(data._meta.url2)}">国税庁 No.7141 印紙税額の一覧表</a>（${esc(data._meta.year)}4月1日現在法令等。第17号の税額は2026年9月12日に再照合）。</p>
</section>
<!-- /receipt-table:auto -->`;
const html = readFileSync(page, 'utf8');
const marker = /<!-- receipt-table:auto -->[\s\S]*?<!-- \/receipt-table:auto -->/;
if (!marker.test(html)) throw new Error('静的表の生成位置がありません');
const updated = html.replace(marker, block);
if (updated !== html) {
  if (process.argv.includes('--check')) {
    console.error('第17号の静的表が正本JSONと一致していません');
    process.exitCode = 1;
  } else {
    writeFileSync(page, updated);
    console.log('第17号の静的表を生成しました');
  }
} else console.log('第17号の静的表は最新です');
