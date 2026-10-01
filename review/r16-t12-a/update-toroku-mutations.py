from pathlib import Path
p=Path('tests/break_toroku_jutaku.mjs');t=p.read_text();t=t.replace('jutakuKeigen: tokiBi <= K.jutaku_kigen','jutakuKeigen: (shutokuBi ?? tokiBi) <= K.jutaku_kigen').replace('jutakuKeigen: tokiBi < K.jutaku_kigen','jutakuKeigen: (shutokuBi ?? tokiBi) < K.jutaku_kigen')
needle='// ── 結果'
i=t.index(needle);t=t[:i]+'''// r16: 取得日を無視する旧判定へ戻すと、期限内取得・翌日登記の境界で落ちる。
breakCore('18. 住宅の取得期限を登記日で判定する旧実装へ戻す',
  'return { ok: true, jutakuKeigen: (shutokuBi ?? tokiBi) <= K.jutaku_kigen };',
  'return { ok: true, jutakuKeigen: tokiBi <= K.jutaku_kigen };');

'''+t[i:];p.write_text(t)
