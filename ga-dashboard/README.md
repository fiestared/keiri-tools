# ga-dashboard

keiri-tools.com の**今日を含む過去14日のセッション数**と、**時間帯別（今日 vs 前日）**を
HTMLに焼き直すだけの小さな道具。GAを毎回開いて当日のセッション数を見に行く手間をなくすために作った。

## 見る

手元（Mac）:

```
file:///Users/masahiroyasu/Scripts/keiri-tools/ga-dashboard/index.html
```

外から（スマホなど）: **payment-manager（資産管理アプリ）の `/ga`**。
🔴 **このリポジトリは公開なのでURLは書かない。** URL は `payment-manager/.env` の
`PM_API_URL`、または payment-manager の README にある。Cloudflare Access の内側なので
URLを知られただけで中身が見えるわけではないが、個人の資産管理アプリの所在を
公開リポジトリに置く必要は無い。

ブラウザにブックマークしておく。開きっぱなしのタブは65秒ごとに自分で読み直すので、
放っておいても数字が古いままにはならない。

**旧パス `~/Scripts/ga-dashboard/` もそのまま使える。** 2026-08-13 にこのリポジトリ配下へ
移した際、既存のブックマークが切れたのでシンボリックリンクを張った（`ls -l ~/Scripts/ga-dashboard`）。
今後もし置き場を動かすなら、**リンクの張り替えも一緒にやること** — 動かした瞬間に
ブックマークだけが黙って死ぬ。

## 外から見る（/ga）

**payment-manager（資産管理アプリ）の Worker に間借りしている。** 認証は payment-manager と
同じ Cloudflare Access（ワンタイムPIN）なので、本人以外には開けない。ここに置いたのは、
Access が既にあって「本人だけが外から見られる場所」がそれしか無かったから。

**Worker は GA4 を叩かない。** Mac 側が焼いた HTML を丸ごと預けて、`/ga` はそれをそのまま返すだけ。

```
[Mac] run.sh → build.mjs  ── 毎分 ──▶  POST /api/ga-push (Bearer + CF Access サービストークン)
                                              │  D1 テーブル ga_snapshot（常に1行）
                                              ▼
                                         GET /ga  ← ブラウザ
```

こうした理由は2つ。**GA4のサービスアカウント秘密鍵を Cloudflare 側に置かなくて済む**ことと、
**描画のコードが Mac 側の1箇所にしか無い**こと（Worker に複製すると必ずズレる）。

その代わり **Mac が止まれば `/ga` の数字も止まる**。外から見ている側にはそれが分からないので、
最後に届いてから **10分以上**空いたら画面の一番上に「Macからの更新が N分 止まっている」と出す。
この経路は D1 の `pushed_ms` を1時間巻き戻して実際に確認済み。

- 取得に**失敗した回は送らない**。失敗バナー付きのHTMLで上書きすると、Worker 側が
  「新しく届いた」状態になり、**Macが止まっている事実が隠れる**ため
- 送信に失敗しても**ローカルの `index.html` は作られる**（手元の画面は送信と独立）。
  失敗は `logs/launchd.out.log` と `logs/last-run.txt` に出る
- トークンは `payment-manager/.env` を `run.sh` が読む（`PM_API_URL` / `PM_COLLECTOR_TOKEN` /
  `CF_ACCESS_CLIENT_*`）。**わざと同じ .env を共有している** — 2箇所に置くと必ず片方だけ古くなる。
  `/ga` を出しているのは payment-manager の Worker なので、認証も payment-manager のものを使う
- Worker 側の実装は `payment-manager/src/index.js` の `/api/ga-push` と `/ga`、
  テーブルは `payment-manager/schema-ga.sql`

## 更新

launchd `com.masahiro.ga-dashboard` が **1分ごと**に `run.sh`（→ `build.mjs`）を回して
`index.html` を作り直し、同じHTMLを `/ga` へ送る。

```bash
./run.sh                    # 手で1回まわす（/ga への送信込み）
node build.mjs              # 送信せず index.html だけ作る
node build.mjs --artifact   # Artifact公開用の断片 artifact.html も出す
node build.mjs --offline    # APIを叩かず data.json から描き直すだけ（見た目をいじる時）

launchctl kickstart -k gui/$(id -u)/com.masahiro.ga-dashboard   # 今すぐ更新
cat logs/last-run.txt                                          # 最後に走った時刻と結果
tail -5 logs/launchd.out.log                                   # 数字が動いた時とエラーの記録
```

間隔を変える時は **plist の `StartInterval` と `build.mjs` の `INTERVAL_SEC` の両方**を直す
（後者は画面の文言とタブの再読込間隔に使っている）。

### 🔴 ログが伸びていない ≠ 動いていない

毎分走るので、標準出力に毎回書くと1日1,400行になる。そこで
**標準出力は「今日の数字が動いた時」と「エラーの時」だけ**にしてある。

- 「最後にいつ走ったか」は **`logs/last-run.txt`**（毎回上書き・1行）を見る
- `logs/launchd.out.log` は実質「数字が動いた履歴」になる
- 失敗すると終了コード1で `logs/launchd.err.log` と `launchctl print` にも残る

## 対象

keiri-tools.com = GA4 `properties/545217731`。サイトを足す/減らすのは `build.mjs` の `SITES`
（aitimes.jp = `properties/545695263` は 2026-08-13 に外した）。

認証は SA `ga-reader@keiri-tools.iam.gserviceaccount.com`、キーは `~/.keiri-analytics/sa.json`
（`KEIRI_SA_JSON` で上書き可）。**新しいGCPプロジェクトやSAを作らないこと** — 経緯は
gbrain `keiri-tools/analytics-access` にある。

### クォータ（2026-08-13 実測）

1回のビルドで消費するのは **約1トークン**（日次21日=1・時間帯別=0）。上限は
`tokensPerDay` 200,000 / `tokensPerHour` 40,000 / `tokensPerProjectPerHour` 14,000。
毎分回しても1日1,440トークン＝**上限の0.7%**。頻度の律速はクォータではなくGA4側の反映の速さ。

## 数字の読み方（ここを間違えると誤読する）

- **日付はすべてJST。** GA4プロパティのタイムゾーンが `Asia/Tokyo` なので、API の
  `today` / `NdaysAgo` はそのままJSTの日付になる
- **当日ぶんは集計途中。** 棒は斜線で描いてある。前日までの棒と高さを直接比べない
- 「今日」タイルの増減は**先週同曜日の同じ時刻まで**との比較（0時〜現在時）。
  途中の数字を丸一日の数字と比べないためにこうしてある
- **時間帯別チャートの今日の棒は cutoff で終わる。** その先が空白なのは「0件」ではなく
  「GA4がまだ出していない」。前日の**合計**とではなく、同じ時間帯どうしで比べること
- 🔴 **GA4 の `hour` ディメンションはゼロ埋めされない**（`"0"` / `"8"` / `"13"` が返る）。
  2桁に揃えてから引かないと **0〜9時が丸ごと抜ける**。2026-08-20 まで「今日」タイルの
  前週同曜日比がずっと「—」だったのはこれ（cutoffが午前だと比較区間が全部0〜9時になり、
  両日とも0になっていた）。数字が0でなく「—」に見えるので、壊れていることに気づきにくい
- 日次の数字と時間帯別の数字は GA4 の別集計なので、合計が数件ずれることがある。
  画面に出す日次の値は日次レポート側を正としている
- セッション0の日はAPIが行ごと返さないので、0で埋めてから描いている
- 当日の流入元が Unassigned に寄るのは処理待ちで、翌日には Organic に吸収される
  （gbrain `keiri-tools/ga4-intraday-unassigned`）

## 取得に失敗した時

`index.html` は**前回の `data.json` から描き直され、画面の上に「取得に失敗した・いつ時点の
数字か」が出る**。古い数字が黙って表示され続けることはない。この経路は実際に壊して確認済み。

## Artifact（外から見る用）

`artifact.html` は claude.ai に公開した版の元ファイル。**作った時点で固まるスナップショット**で、
自動更新はしない（Artifact は外部ホストへ通信できないため、ページ自身がGA4を叩けない）。
画面上にもそう書いてある。更新は `node build.mjs --artifact` してから同じURLへ再発行する。

## 生成物はコミットしない

`index.html` / `artifact.html` / `data.json` / `logs/` は `.gitignore` 済み。毎分変わるので
追跡するとdiffがそれで埋まる。
