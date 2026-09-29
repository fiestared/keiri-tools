独立審査。RUN={{R}}、読み取り専用の対象={{SITE}}。正本は RUN/corpus と corpus_desc.md。
他モデル・サブエージェント・orca・スキル・pushは禁止。
segments.json と out/s*.json を読み、全IDの判定を審査する。wrong/unclearと要約部は必ず正本を開き、残りのokも範囲を明示して審査する。
固定コピーと元の執筆作業場は変更しない。修正が必要なら未解決として書き手に返し、修正後の新snapshotで再照合する。
RUN/segment-adjudication.json: {"segments":[{"page":"...","id":"...","decision":"ok|nonclaim|out_of_corpus|unresolved","reason":"正本の箇所と採否理由","needed_source":"正本外の場合の必要資料"}]}。
全IDが必須。protected=true の nonclaim は禁止。未解決highをokへ変えて通さない。
RUN/fixes.md に審査結果・未解決・必要な修正を報告し、最後の行に DONE。
