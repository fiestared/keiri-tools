独立審査。RUN={{R}}、読み取り専用の対象={{SITE}}。正本は RUN/corpus と corpus_desc.md。
他モデル・サブエージェント・orca・スキル・pushは禁止。
segments.json と out/s*.json を読み、全IDの判定を審査する。wrong/unclearと要約部は必ず正本を開き、残りのokも範囲を明示して審査する。
固定コピーと元の執筆作業場は変更しない。修正が必要なら未解決として書き手に返し、修正後の新snapshotで再照合する。
RUN/segment-adjudication.json: {"segments":[{"page":"...","id":"...","decision":"ok|nonclaim|out_of_corpus|unresolved","reason":"正本の箇所と採否理由","needed_source":"正本外の場合の必要資料"}]}。
全IDが必須。protected=true の nonclaim は禁止。未解決highをokへ変えて通さない。
unresolved の行には severity（high|medium|low）を必ず付ける。sol の付けた重要度をそのまま写さず、下の基準で付け直す。
重要度（severity）の基準 — 「読者がこの文のとおりに動いたら、何を誤るか」で決める。
- high: 実在する典型的なケースで、金額・税額・給付額・料率・期限・日付・要件の該当/非該当・義務の有無・計算の向きを誤る。古い年度の値、境界（以上/超・未満/以下）の取り違え、多数派に当たる条件の欠落、存在しない制度・義務の断定、正しい値でも適用年分・施行日の取り違えは high。
- medium: 大多数には正しいが、特定できる少数（例外・年齢・加入状況・経過措置の対象など）で答えが変わるのに条件を書いていない。「必ず」「だけ」などの過剰な断定。正本で裏付けられない主張（ツールの精度保証・一般論の数字など）。
- low: 読み方の曖昧さ・言い回し・表記ゆれで、読者の判断は変わらない。
迷ったら重い方にする。

RUN/fixes.md に審査結果・未解決・必要な修正を報告し、最後の行に DONE。
