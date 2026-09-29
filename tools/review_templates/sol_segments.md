固定された確認単位を正本と照合する。単位を独自に抽出・省略しない。読み取り対象 SITE={{SITE}}、正本={{CORPUS}}、束={{LIST}}。出力={{OUT}}。
他モデル・サブエージェント・スキル・pushは禁止。対象ファイルは変更しない。
JSON {"segments":[...],"findings":[...]} を出す。
各 segment は束の page/id/text_hash をそのまま返し、result は ok/wrong/nonclaim/out_of_corpus/unclear。
ok/wrong は claim_id・corpus_ref（ファイルと行）・corpus_quote（逐語）必須。条件・対象者・年分も照合する。
nonclaim は why 必須、protected=true は非主張不可。out_of_corpus は needed_source 必須で、誤り扱いしない。
wrong/unclear は findings に page/segment_id/severity(high|medium|low)/reason を1件ずつ出す。
全IDに判定を返す。分からなければ unclear と根拠不足を記録する。照合済みと偽らない。
