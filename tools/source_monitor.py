#!/usr/bin/env python3
"""Daily adapter. Preserve the two monitors' distinct statuses and exit codes."""
import argparse
import json
from pathlib import Path
import subprocess
import sys


def summarize(year, citation):
    if not isinstance(year,list) or not year:raise ValueError('empty/invalid year report')
    states={'found','absent','unknown','unregistered','skipped'}
    if any(r.get('state') not in states for r in year):raise ValueError('unknown year status')
    counts={k:sum(r['state']==k for r in year) for k in states}
    cc=citation['counts']
    if any(not isinstance(cc.get(k),int) for k in ['一致','ずれ','記載なし','未取得']):raise ValueError('invalid citation counts')
    return (f"年度監視: 発見 {counts['found']} / 未公表 {counts['absent']} / 確認不能 {counts['unknown']+counts['unregistered']}"
            f"（登録 {len(year)} / 停止 {counts['skipped']}）\n"
            f"引用日付: ずれ {cc['ずれ']} / 一致 {cc['一致']} / 確認不能 {cc['未取得']+cc['記載なし']}"
            f"（未取得 {cc['未取得']} / 出典記載なし {cc['記載なし']}）。一致は未公表と合算しない。\n")


def run(repo,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True);repo=Path(repo)
    commands=[('source-year',[sys.executable,str(repo/'tools/check_source_year.py'),'--json']),
              ('citation-date',[sys.executable,str(repo/'tools/check_citation_date.py')])]
    payloads={};rcs={};errors=[]
    for name,cmd in commands:
        try:
            p=subprocess.run(cmd,capture_output=True,text=True,timeout=900)
            (out/(name+'.json')).write_text(p.stdout);(out/(name+'.err')).write_text(p.stderr);rcs[name]=p.returncode
            allowed=(0,3,4) if name=='source-year' else (0,2,3,4)
            if p.returncode not in allowed:raise ValueError(f'exit {p.returncode}')
            payloads[name]=json.loads(p.stdout)
        except Exception as e:errors.append(name+': '+str(e))
    try:
        if errors:raise ValueError('; '.join(errors))
        summary=summarize(payloads['source-year'],payloads['citation-date'])
    except Exception as e:
        summary='正本監視: 発見 不明 / 未公表 不明 / 確認不能 1実行以上（監視処理の失敗。0件とは扱わない）\n'+str(e)+'\n'
        errors.append(str(e))
    (out/'source-monitor.md').write_text(summary)
    (out/'source-monitor-status.json').write_text(json.dumps({'exit_codes':rcs,'errors':errors},ensure_ascii=False,indent=2)+'\n')
    return 4 if errors else 0

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[1]);ap.add_argument('--out',type=Path,required=True)
    a=ap.parse_args();raise SystemExit(run(a.repo,a.out))
