# auto20261002 t8-q08461 — 司令塔（Claude Opus）の確認と修正の記録（2026-10-02）

- 作業場: ~/Scripts/keiri-tools-astra-auto20261002-t8-q08461（wt/astra-auto20261002-t8-q08461）。push なし。codex・grok 不使用。
- recheck1 の未解決34件（high 5・medium 29）: **採用34・退けた0**。34件すべて Astra の2回目の修正 7c163845 で解消済みで、司令塔が本文・fee_table.json を新たに変えた箇所は無い。
- 変わった74単位の照合: ok 74・unresolved 0（adjudication.json）。

## 論点 → 単位ID（recheck1）→ 直っていた箇所 → 正本の行

1. **PayPay個人145円に残高優遇・給与受取無料の除外が無い**（4件＋逆引き1件）
   - s-fa5bb23188ab4b3d0183-1/-2, s-cc63cf32ec94807fdd54-1/-2, s-a42e2c9bb7ae2d1c344c-1（逆引き145円行。PayPay法人・楽天個人の除外も同時）
   - #kojin・#bank-paypay のセル、#gyakubiki 145円行、#bank-paypay の法人の例外の文、fee_table.json（fee_note・index_name・scope_note）
   - paypay_fee_transfer:14-28／paypay_business:14-21／rakuten_charge:48-56
2. **三井住友個人154/220円に Olive の無料回数の除外が無い**（5件＋逆引き2件）
   - s-5dd6c554e1854a662e2f-1/-2, s-8545ec3ea3b7c34e6079-1/-2, s-fef999b927ab708e8333-1（経路別の表）, s-209fd0aade25e655c6d1-1（154円行）, s-004ac1399b2b7b9fb113-1（220円行）
   - #kojin・#bank-smbc のセル、経路別の表のネットバンキングのセル、逆引き154円・220円行、fee_table.json
   - smbc_kojin:94-106,177-184
3. **三菱UFJ個人154/220円にメインバンク プラスの無料優遇の除外が無い**（5件＋本文1件。逆引きは論点2と同じ行）
   - s-154f42889e1c5ef6600c-1/-2, s-434e514a44fbffb5ed90-1/-2, s-b0b1eab6eab2224d98e0-1（経路別の表）, s-0a4d392649ba08554e30-1（「3倍」の文）
   - #kojin・#bank-mufg のセルと「主な例外」の文、経路別の表、リードと #hojin の「3倍」の文、逆引き154円・220円行（横浜のゼロ手数料の除外も同時）、fee_table.json（public_note）
   - mufg:16-28,44-46,128,196-206／boy:19-25
4. **個人の幅75〜440円から非居住者3,000円を除けていない**（2件）
   - s-60afbd0763ec2a003c13-1, s-02ebfa1f55397865be89-1（まとめ）
   - #kojin の下の文、まとめの1行目
   - japanpost_direct:40-43
5. **SMTB個人77円に三井住友信託あての除外が無い**（1件）
   - s-a89c56316110a93dc937-1 → #kojin の下の文 → charge_furikomi:29-46
6. **GMO法人100円に会員99円との区別が無い／1.3倍の前提**（2件）
   - s-9973cb03bc73d0ee4164-1（逆引き100円行）, s-70e39cdf0d6d2ba4905d-1（1.3倍）
   - #hojin・#bank-gmo-aozora のセルと節の文、#gap の表、逆引き100円行、fee_table.json
   - gmo_business:14-41／gmo:47-53
7. **ゆうちょBizダイレクト165円に通常・総合振込の限定（給与振込110円）が無い**（2件）
   - s-a3e494582fade1be705a-1（行見出し「165円」。文面は同じ。同じ行のセルで解消）, s-71885d33b51c40501267-1
   - #hojin・#bank-yucho のセルと節の文、逆引き165円行、fee_table.json
   - bizdirect:53-98
8. **SMTB法人100円: 提携の除外・優遇プログラム廃止の適用日・総合振込の除外・予約の受付日**（6件。うち high 4）
   - s-1db1587e0b0eb066a577-1, s-4d67eff252d3f1f65897-1, s-5abdef414b94ac34b466-1（high）, s-e08a739561a755d7f362-1（high・FAQ）, s-649373adb15bc2ab1267-1（high・FAQ）, s-e3ddc064eb2ba034fbdd-1（high・FAQ の JSON-LD 側と同文）
   - #bank-sbi-net の節の文、FAQ「法人で安いのは」と JSON-LD、fee_table.json（public_note）
   - press_2026_0902:15-27／hojin_charge:15-39
9. **年間差額67,200円の見出しに「他行宛・通常料金」が無い**（1件・high）
   - s-c753701282171eec427c-1 → #gap の見出し・目次・前提の文 → mufg:196-206／gmo_business:14-28
10. **ゆうちょダイレクトの振替: 利用口座間・非居住者・受入明細票の結びつけ**（2件）
   - s-778c5a4909387dc48baf-1, s-15d6fb44683aa0b300a4-1 → まとめの2行、経路別の表のゆうちょ（振替）のセル → japanpost_direct:34-39,62,68

## 司令塔が足したコミット
- 本文・データ・台帳の変更なし。review-evidence に、Astra が残した修正後の被覆（after.json）、全テストの記録（途中で止まっていたものを最後まで流し直した）、この審査の写しを入れた。SHA は gbrain と返答に記載。

## 検査
返答と gbrain（reviews/keiri-auto20261002-t8-q08461-commander-2026-10-02）に rc を記載。

DONE
