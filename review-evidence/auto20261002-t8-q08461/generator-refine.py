from pathlib import Path
import json,re,subprocess
p=Path('tools/gen_bank_sections.mjs');s=p.read_text();s=s.replace('scoped: Boolean(b.scope_note),','scoped: Boolean(b.scope_note),\n      sourceNote: b.article?.source_note || null,')
s=s.replace("  const price = (s) => Number(String(s).replace(/[^0-9]/g, '')) || 0;\n",'')
s=s.replace('return h ? [0, price(h.over)] : [1, price(v[0].over)];','return h ? [0, h.rawOver ?? Infinity] : [1, v[0].rawOver ?? Infinity];')
s=s.replace("    notes.push(list.some(r => r.rawOver === null) ? '個人IBの3万円以上は掲載を保留しています' : withBoundary.length", "    if (list.some(r => r.rawOver === null)) notes.push('横浜銀行の法人EBの他行宛は、3万円未満385円・3万円以上550円です。個人IBの3万円以上は掲載を保留しています');\n    notes.push(withBoundary.length")
s=s.replace('（確認範囲は調査方法と出典をご参照ください）</p>`);','（${esc(list.find(r => r.sourceNote)?.sourceNote || "確認範囲は調査方法と出典をご参照ください")}）</p>`);')
p.write_text(s)
p=Path('docs/assets/fee_table.json');d=json.loads(p.read_text())
for b in d['banks']:
 b.setdefault('article',{})['source_note']='掲載額は公式資料で未確認' if any(k in b['name'] for k in ['みずほ','イオン','フィンサー']) else '資料取得日：2026年9月30日'
 if 'SMTB' in b['name'] and '法人' in b['name']:b['public_note']=b['public_note'].replace('総合振込は改定対象外','総合振込サービスは改定対象外')
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
