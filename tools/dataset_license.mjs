/**
 * Dataset 構造化データの license と、本文に出す可視の利用条件の1文（正本）。
 *
 * 決定: 2026-10-16 Masahiro が CC BY 4.0 に決めた（gbrain decisions/keiri-dataset-license-ccby-2026-10-16）。
 * 範囲は「当サイトがまとめた表（編集物）」。料率・税率などの元データは各出典の公表値で、元データの出典表示は変えない。
 * Dataset を出すページを足したら、生成器でこの2つを使う（tests/test_dataset_license.mjs が全ページを見て落とす）。
 */
export const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
/** 本文から張るリンク先（日本語の要約ページ。同じライセンスの日本語表示） */
export const LICENSE_DEED_JA = "https://creativecommons.org/licenses/by/4.0/deed.ja";

/** 本文の可視の1文（結論先・各文120字以内）。what は「この表とCSV（当サイトがまとめた一覧）」など */
export function licenseNote(what, origin = "元データは各出典の公表値です。") {
  return `<p data-license="cc-by">${what}は<a href="${LICENSE_DEED_JA}" rel="license">CC BY 4.0</a>で利用できます。利用時は出典として当ページへのリンクを表示してください。${origin}</p>`;
}
