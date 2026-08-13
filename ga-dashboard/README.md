# ga-dashboard

keiri-tools.com の**今日を含む過去14日のセッション数**をHTMLに焼き直すだけの小さな道具。
GAを毎回開いて当日のセッション数を見に行く手間をなくすために作った。

## 見る

```
file:///Users/masahiroyasu/Scripts/keiri-tools/ga-dashboard/index.html
```

ブラウザにブックマークしておく。開きっぱなしのタブは65秒ごとに自分で読み直すので、
放っておいても数字が古いままにはならない。

## 更新

launchd `com.masahiro.ga-dashboard` が **1分ごと**に `build.mjs` を回して `index.html` を作り直す。

```bash
node build.mjs              # 手で1回まわす
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
