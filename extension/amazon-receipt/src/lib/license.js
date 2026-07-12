// license.js — 無料版/Pro版の境界とライセンス確認。
//
// 設計方針:
// - **無料版だけでも実用になる**(今開いているページの索引簿CSVは作れる)。
//   無料で価値を体験させてからProへ、が定着の近道。
// - Proの価値は「年間分をまとめて処理する」こと = 確定申告・電帳法対応の本番作業。
// - Chromeウェブストアの決済機能は廃止済みのため、外部決済(ExtensionPay/Stripe)を使う。
// - ライセンス確認に失敗したとき(オフライン等)は**Proとして扱わない**が、
//   無料機能は必ず動かす(壊れたライセンスサーバーで製品全体を止めない)。

"use strict";

const KT_FREE_LIMITS = {
  // 無料版: 表示中のページ(通常10件)の索引簿CSVまで。全ページ巡回と領収書保存はPro
  maxOrdersPerExport: 10,
  allowMultiPage: false,
  allowReceiptDownload: false,
};

const KT_PRO_FEATURES = [
  "全ページを自動で巡回して、期間中の全注文をまとめて索引簿CSVに",
  "領収書PDFの一括保存（電帳法のファイル名規約つき）",
  "キャンセル注文の自動除外・要確認の自動判定（無料版にも搭載）",
];

/** 現在のライセンス状態(拡張のstorageにキャッシュ) */
async function ktGetLicense() {
  const { license } = await chrome.storage.local.get("license");
  if (!license) return { pro: false, source: "none" };
  // 期限つきライセンスの失効チェック(買い切りはexpiresAtを持たない)
  if (license.expiresAt && Date.now() > license.expiresAt) {
    return { pro: false, source: "expired" };
  }
  return { pro: !!license.pro, source: license.source || "cache", email: license.email };
}

function ktLimits(license) {
  return license.pro
    ? { maxOrdersPerExport: Infinity, allowMultiPage: true, allowReceiptDownload: true }
    : KT_FREE_LIMITS;
}

/** 無料版の上限に達しているか(UIでのアップグレード導線に使う) */
function ktHitFreeLimit(orders, license) {
  if (license.pro) return false;
  return orders.length > KT_FREE_LIMITS.maxOrdersPerExport;
}
