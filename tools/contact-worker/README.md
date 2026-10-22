# 問い合わせの受け口（Worker `keiri-contact` ＋ D1 `keiri-contact`）

## なぜ要るか（2026-10-22）
`/contact/` は Formspree（`f/mzdnbbyp`）に送るだけで、届く先は司令塔が読めないメールの箱だった。
「問い合わせが来たか」を誰も知らない状態だったので、同じ内容をここにも保存し、Slack に流す。

## 経路
```
/contact/ のフォーム ──┬─→ Formspree f/mzdnbbyp ─→ 登録アカウントのメール（従来どおり）
                       └─→ Worker keiri-contact ─→ D1 keiri-contact（submissions）
                                                        ↑ 10分おきに読む
                         Mac の launchd com.aibot.keiri-contact-poll
                         （~/Scripts/keiri-commander/tools/contact_poll.py）
                                                        ↓ notify.py --keiri action
                                              Slack C0C45MEDZT6（keiri のチャンネル）
```
- ページは**両方へ同時に送り、どちらか一方でも受けたら「送信しました」**と出す。成功したら GA4 に
  `contact_submit`（引数は `{form:"contact"}` だけ）を1回送る。
- **この Worker は secret を1つも持たない。** Slack の鍵は Mac 側（notify.py が Infisical から取る）だけ。
- Origin が keiri-tools.com 以外は 403。罠の欄（`_gotcha`）が埋まっていたら保存せず 200。
  同じ送り手は600秒に5回まで（IP は日替わりの塩でハッシュにして持つ。IP そのものは保存しない）。

## デプロイ
```
cd tools/contact-worker
npx wrangler@4 d1 execute keiri-contact --remote --file schema.sql   # 初回だけ
npx wrangler@4 deploy
```
URL: `https://keiri-contact.wellsmanager.workers.dev/contact`（ページの `CONTACT_WORKER` と一致させる）

## 読む
```
npx wrangler@4 d1 execute keiri-contact --remote --command "SELECT * FROM submissions ORDER BY id DESC LIMIT 20"
```
`created_at` は UTC。JST は +9h。

## 費用
Workers・D1 の無料枠の範囲（問い合わせは1日数件以下）。有料機能は使わない。

## 検査
- `node tests/test_contact_worker.mjs`（偽の D1 で受け口の振る舞い）
- `node tools/e2e/e2e.mjs 'contact_submit*'`（実ブラウザで、片方が落ちても成功と出ること・GA4 に個人情報が載らないこと）
