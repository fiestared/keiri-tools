# ga-dashboard

keiri-tools.com の**今日を含む過去21日のセッション数**、**時間帯別（今日 vs 前日 vs 先週同曜日）**、
**振込手数料記事の広告クリック数**、**アクセスページの内訳**をHTMLに焼き直す小さな道具。
GAを毎回開いて数字を見に行く手間をなくすために作った。

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

## 表示する日数

**画面に出すのは21日、GA4から取るのは28日**（`build.mjs` の `WINDOW_DAYS` / `FETCH_DAYS`）。
2026-08-25 に 14日表示→21日表示へ広げた。

🔴 **`FETCH_DAYS` は必ず `WINDOW_DAYS + 7` にすること。** 画面の各日には「前週同曜日」を
並べているので、**一番古い日のさらに7日前**まで取れていないと、先頭7日ぶんの比が丸ごと
「—」になる。`WINDOW_DAYS` だけ触ると静かにこの壊れ方をするので、定数側で
`WINDOW_DAYS + 7` と書いて外せないようにしてある。

クォータの実測（上の節）は**日次21日のときのもので、28日では取り直していない**。
上限に対して0.7%しか使っていないので多少増えても効かないが、数字としては未計測。

## 目標と Google トラック KPI（2026-09-07 追加 / **2026-09-10 置き直し**）

タイルの直下に **「目標: 日 2,400 セッション（2027-03-31まで）」** の欄がある。

★ **2026-09-10 に「日1万セッション」から置き直した**（Masahiro承認）。日1万は長期の方向としては
残すが、今期の事業目標からは下ろした。達成年数は置かない。根拠は Fable / Astra の独立分析と実測
（gbrain `learnings/keiri-tools-10k-sessions-analysis-2026-09-08`、ai-income-daily の
`.orca/reports/growth-10k/`）。正本は ai-income-daily の `prompt.md` と `growth_ledger.md` G-007。

**新しい目標（すべて7日平均・期日 2027-03-31）**

| 指標 | 2026-09-10 実測 | 目標 |
|---|---:|---:|
| Bing クリック/日 | 430 | **2,000** |
| Google クリック/日（GSC） | 2.9 | **100** |
| 非検索セッション/日 | 約30 | **300** |
| **合計セッション/日（GA4）** | **約486** | **2,400** |

- **Google クリック/日**（Search Console・7日平均）。**GA4 の google 流入ではなく GSC の値**。
  同じ SA `ga-reader@keiri-tools` が `sc-domain:keiri-tools.com` を読める（トークンのスコープに
  `webmasters.readonly` を足した）
- 通過点: 10月末 10 / 12月末 30 / 2027-03末 100（クリック/日・7日平均で判定）。
  現在2.9からの実現的な刻みへ置き直した。外れたら数字だけ動かさず方針ごと見直す
- 28日ぶんのクリック（棒）と表示（線）のグラフ。表示と順位はクリックより先に動く先行指標

**2026-09-12承認: 中間確認は年末休業前の完成7日で行う**

旧「12/31に表示7日平均18,000未満なら目標を下げる」は廃止。
判定窓は年末休業前（候補: Bing native日付12/18〜24）。7日平均と平日5日平均を併記し、
4指標の等率線と比べる。12月末の目安はBing 1,014 / Google 20.3 / 非検索89.5 / GA4 1,201。
等率線は予測ではなく遅れを見るための目安。残り期間に埋められる増分は実証済み施策だけで見積もる。
目標の定義は7日平均のまま、分岐判断は平日基準。正本: growth_ledger.md G-007。

**🚫 `pages` / `queries` は週次バケット。全行を足さない**
ラベルは **「週の終了日」**で、1ファイルに約6ラベル入っている。**`sum(全行)` を7で割ってはいけない。**
2026-09-08 に `pages` 全行 265,649 を「7日ぶん」として割り、天井を「3,800/日」と2.5倍過大に
見積もった（実体は6バケット合計）。
同じ週で揃えた実測（3スナップショットで再現）は **pages/traffic = 0.93〜0.98**（ほぼ完全・
重複計上ではない）、**queries/traffic = 0.33〜0.39**（上位N抜粋）。
サイト全体の分母は **`traffic`**。`pages` は返却URLの診断、`queries` は返却語群の診断に限る。
★この注意は prompt.md に **2026-08-08 から既に書かれていた**（「クエリ統計は週次バケットを
複数返す。足すな」）。古い写しから作業したせいで見落とした。
（gbrain メモ `bing-snapshot-weekly-buckets`）

Googleは全体のセッションと別にGSCクリックで追う。
サイト設定の正本は `build.mjs` の `SITES`（`sessionGoal` / `goalBy` / `googleKpi`）と
`GOOGLE_KPI_KEIRI`。キャッシュ中の古い目標よりコードの設定を優先する。
道しるべには経理の目標・広告クリック・AdSenseを出さず、同じ画面のタブで切り替える。

読み方の注意:

- **GSC は 2〜3 日遅れて届き、末端の 1〜2 日は後から増える。** 7日平均は「今日」ではなく
  GSC の末端の日で締めている（今日で締めると末尾がゼロ埋めされて必ず下振れする）。
  画面に末端の日付と遅れ日数を出している
- GSC が落ちて GA4 だけ取れた回は、画面全体を殺さず KPI 欄にだけ「取得に失敗」と出す
- 古い `data.json`（`gsc` を持たない）から `--offline` で描いた場合は「まだ取得していない」と出る

## 数字の読み方（ここを間違えると誤読する）

- **日付はすべてJST。** GA4プロパティのタイムゾーンが `Asia/Tokyo` なので、API の
  `today` / `NdaysAgo` はそのままJSTの日付になる
- **当日ぶんは集計途中。** 棒は斜線で描いてある。前日までの棒と高さを直接比べない
- 「今日」タイルの増減は**先週同曜日**と**昨日**の、どちらも**同じ時刻まで**との比較
  （0時〜cutoff直前の時間帯まで）。途中の数字を丸一日の数字と比べないためにこうしてある。
  🔴 **昨日比を単独で読まない** — このサイトは土日で平日の3〜4割まで落ちるので、月曜の
  「昨日比」は日曜との比較になり必ず大幅プラスに見える。だからラベルに曜日を出してある
  （「昨日日 0:00〜09:59 比」）。傾向を見るなら先週同曜日比の方を正とする
- **時間帯別チャートの今日の棒は cutoff で終わる。** その先が空白なのは「0件」ではなく
  「GA4がまだ出していない」。前日や先週同曜日の**合計**とではなく、同じ時間帯どうしで比べること。
  表示は今日＝青の棒、前日＝灰の階段面、先週同曜日＝橙の破線で、色以外の形でも区別する
- 🔴 **GA4 の `hour` ディメンションはゼロ埋めされない**（`"0"` / `"8"` / `"13"` が返る）。
  2桁に揃えてから引かないと **0〜9時が丸ごと抜ける**。2026-08-20 まで「今日」タイルの
  前週同曜日比がずっと「—」だったのはこれ（cutoffが午前だと比較区間が全部0〜9時になり、
  両日とも0になっていた）。数字が0でなく「—」に見えるので、壊れていることに気づきにくい
- 日次の数字と時間帯別の数字は GA4 の別集計なので、合計が数件ずれることがある。
  画面に出す日次の値は日次レポート側を正としている
- セッション0の日はAPIが行ごと返さないので、0で埋めてから描いている
- 当日の流入元が Unassigned に寄るのは処理待ちで、翌日には Organic に吸収される
  （gbrain `keiri-tools/ga4-intraday-unassigned`）
- 「振込手数料の記事」のクリック数は、対象ページ
  `/column/furikomi-tesuryo-hikaku/` が明示送信する `pr_click` の `eventCount`。GA4拡張計測の
  `click` は通常の外部リンクも含むため混ぜない。今日の値はPVと同じく集計途中
- アクセスページ内訳は `screenPageViews` を `pagePath` 単位で合算する。記事titleは月次更新で
  変わるため集計キーに使わず、表示名だけ最新日の `pageTitle` を使う
- ページ内訳の「直近7日」は昨日までの完了した7日間。「構成比」は上位12ページ内ではなく、
  同じ7日間の**全ページPV**に対する割合

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

## 本番送信はコミット済みコードから行う

`run.sh` は実行前、`build.mjs` は起動時と送信直前に `production-guard.mjs` で検査する。
マージ・rebase・cherry-pick途中、ga-dashboard内の未コミット/未追跡変更、実行中のHEAD変更は送信を止める。
生成データ・HTML・ログはGitの除外対象。コード3ファイルは実バイトもコミットと比較し、
assume-unchangedで隠れた変更も拒否する。編集は別作業場で検証してコミットし、本番生成元へ取り込む。
`--offline` は環境変数に送信先があっても送信しない。本番HTMLの `ga-source-commit` metaで生成元SHAを照合できる。
送信失敗時も終了コード1。既存Access認証の送信先と更新間隔はそのまま。

検証: `node ga-dashboard/test-production-guard.mjs`。
