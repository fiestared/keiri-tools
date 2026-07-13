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

// Amazonは領収書をPDFで配信していない。保存できるのは領収書ページのHTML
// (=電子取引データそのもの)。掲載文・UIともに「PDF」と名乗らないこと(出来ない約束になる)
const KT_PRO_FEATURES = [
  "全ページを自動で巡回して、期間中の全注文をまとめて索引簿CSVに",
  "領収書ページの一括保存（電帳法のファイル名規約つき・HTML）",
  "キャンセル注文の自動除外・要確認の自動判定（無料版にも搭載）",
];

/**
 * 現在のライセンス状態を取得する。
 * 決済の正は **ExtensionPay(Stripe)** で、service worker 経由で問い合わせる。
 * 取得に失敗したら直前のキャッシュを使い、それも無ければ無料版として動く。
 * **決済サーバーの障害で無料機能まで止めないこと**（有料機能だけが使えない状態が正しい）。
 */
async function ktGetLicense() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "getLicense" });
    if (res && !res.error) {
      const license = { pro: !!res.pro, email: res.email || null, checkedAt: Date.now() };
      await chrome.storage.local.set({ license });
      return { ...license, source: "extensionpay" };
    }
  } catch (e) {
    console.warn("[電帳法索引簿] ライセンス確認に失敗（キャッシュで判定します）", e);
  }
  // オフライン等: 直前の判定を使う
  const { license } = await chrome.storage.local.get("license");
  if (license && license.pro) return { ...license, source: "cache" };
  return { pro: false, source: "none" };
}

/** 購入ページ(ExtensionPay)を開く */
async function ktOpenPayment() {
  return chrome.runtime.sendMessage({ type: "openPayment" });
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
