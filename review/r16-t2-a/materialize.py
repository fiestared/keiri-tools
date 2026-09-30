from pathlib import Path
import json,subprocess,shutil
p=Path('review/r16-t2-a')
assert not Path('.run_tests.lock').exists(), 'baseline tests still running; do not mutate docs'
subprocess.run(['python3',str(p/'prepare_edits.py')],check=True)
for script in ['apply_edits.mjs','build_ledgers.mjs','audit.mjs']:
 subprocess.run(['node',str(p/script)],check=True)
edits=json.loads((p/'edits.json').read_text())
for slug in ['gensen-choshuhyo-mikata','kyuyo-shiharai-hokokusho','shiharai-chosho']:
 shutil.copyfile(p/f'candidate-{slug}.html',f'docs/column/{slug}/index.html')
 shutil.copyfile(p/f'ledger-{slug}.json',f'claims/column/{slug}.json')
shutil.copyfile(p/'stale-values-after.json','tests/stale_values.json')
shutil.copyfile(p/'stale-rules-after.mjs','tests/test_stale_values_rules.mjs')
lines=['# 修正単位対応（入力の順番、1始まり）','','99単位。unresolved 91、正本外wrong 8。重要度は元の審査を維持し、正本外8件は修正担当が付与。','']
for x in edits:lines.extend([f"## #{x['ordinal']} {x['severity']} — {x['page']}",f"- 単位: `{x['id']}`",'- 修正前: '+x['text'].replace('\n',' '),'- 修正後: '+x['replacement'].replace('\n',' '),''])
(p/'changes.md').write_text('\n'.join(lines))
print('Materialized 3 HTML pages, 3 ledgers, stale registry and 7 regression cases')
