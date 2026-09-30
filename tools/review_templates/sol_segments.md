固定された確認単位を正本と照合する。単位を独自に抽出・省略しない。読み取り対象 SITE={{SITE}}、正本={{CORPUS}}、束={{LIST}}。出力={{OUT}}。
他モデル・サブエージェント・スキル・pushは禁止。対象ファイルは変更しない。
JSON {"segments":[...],"findings":[...]} を出す。
各 segment は束の page/id/text_hash をそのまま返し、result は ok/wrong/nonclaim/out_of_corpus/unclear。
ok/wrong は claim_id・corpus_ref・corpus_quote（逐語）必須。corpus_ref の書式は `corpus/<ファイル>:<開始行>-<終了行>`（複数の範囲は `,`、複数のファイルは `;` で区切る。行番号を必ず書く。PDF・画像は参照せず、同名の .txt を参照する）。corpus_quote は正本の文字列をそのまま写す（要約・言い換え・つなぎの語を足さない）。条件・対象者・年分も照合する。
nonclaim は why 必須、protected=true は非主張不可。out_of_corpus は needed_source 必須で、誤り扱いしない。
wrong/unclear は findings に page/segment_id/severity(high|medium|low)/reason を1件ずつ出す。
重要度（severity）の基準 — 「読者がこの文のとおりに動いたら、何を誤るか」で決める。
- high: 実在する典型的なケースで、金額・税額・給付額・料率・期限・日付・要件の該当/非該当・義務の有無・計算の向きを誤る。古い年度の値、境界（以上/超・未満/以下）の取り違え、多数派に当たる条件の欠落、存在しない制度・義務の断定、正しい値でも適用年分・施行日の取り違えは high。
- medium: 大多数には正しいが、特定できる少数（例外・年齢・加入状況・経過措置の対象など）で答えが変わるのに条件を書いていない。「必ず」「だけ」などの過剰な断定。正本で裏付けられない主張（ツールの精度保証・一般論の数字など）。
- low: 読み方の曖昧さ・言い回し・表記ゆれで、読者の判断は変わらない。
迷ったら重い方にする。

全IDに判定を返す。分からなければ unclear と根拠不足を記録する。照合済みと偽らない。
