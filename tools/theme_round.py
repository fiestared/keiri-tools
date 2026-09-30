#!/usr/bin/env python3
"""theme_round.sh <theme> [--pages text-or-quote_missing.json]
Runs in a new isolated directory; use --run-dir DIR to resume a STOPPED round.
No publish/push/notification side effects. --prepare-only and --check-only call no models.
"""
import argparse
import os
import datetime
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import fcntl
import theme_segments

HERE=Path.home()/'Scripts/keiri-commander/runs/review-loop'


def pages_from(path):
    text=Path(path).read_text()
    if Path(path).suffix=='.json':
        d=json.loads(text)
        if not isinstance(d,dict) or not isinstance(d.get('quote_missing'),list):raise ValueError('missing quote_missing list')
        if d.get('errors'):raise ValueError('corpus fetch incomplete; cannot narrow scope')
        if any(not isinstance(q,dict) or not isinstance(q.get('page'),str) for q in d['quote_missing']):raise ValueError('invalid quote_missing page')
        pages=[q['page'] for q in d['quote_missing']]
    else:pages=text.splitlines()
    result=sorted(set(p.strip() for p in pages if p.strip()))
    if any(not re.fullmatch(r'docs/(?:[a-zA-Z0-9_-]+/)*index.html',p) for p in result):raise ValueError('invalid page path')
    return result


def batch_valid(path,pages):
    try:
        d=json.loads(path.read_text());rows=d['pages'];claims=d['claims'];findings=d['findings']
        if not isinstance(rows,list) or not isinstance(claims,list) or not isinstance(findings,list):return False
        if len(rows)!=len(pages) or {x['page'] for x in rows}!=set(pages):return False
        if any(x.get('status')!='done' for x in rows):return False
        if any(c.get('page') not in pages or c.get('result') not in ('ok','wrong','out_of_corpus','unclear') or not c.get('id') for c in claims):return False
        keys=[(c['page'],c['id']) for c in claims]
        if len(keys)!=len(set(keys)):return False
        for row in rows:
            cs=[c for c in claims if c['page']==row['page']]
            if row.get('claims_total')!=len(cs):return False
            for result in ('ok','wrong','out_of_corpus','unclear'):
                if row.get(result)!=sum(c['result']==result for c in cs):return False
        return True
    except (OSError,ValueError,KeyError,TypeError):return False


def fill(template,values):
    s=template.read_text()
    for k,v in values.items():s=s.replace('{{'+k+'}}',str(v))
    if re.search(r'\{\{[A-Z_]+\}\}',s):raise ValueError('unfilled template placeholder')
    return s


def stop(r,reason):
    (r/'STOPPED').write_text(reason+'\n');print(reason);return 4


# sol のモデル（2026-09-30 Masahiro「今後 sol に依頼するときは sol6.1 を使ってね」）。環境変数で差し替え可
SOL_MODEL=os.environ.get('KEIRI_SOL_MODEL','gpt-6.1-sol')

def execute(worker,model,prompt,r,log):
    with log.open('w') as f:
        p=subprocess.run([worker,'exec','-m',model,'-s','danger-full-access','--skip-git-repo-check','-C',str(r),prompt],stdin=subprocess.DEVNULL,stdout=f,stderr=subprocess.STDOUT)
    return p.returncode, bool(re.search(r'usage limit|rate limit|quota exceeded',log.read_text(),re.I))


def run(a):
    r=a.run_dir
    draft=getattr(a,'draft_worktree',None)
    if draft and (r.resolve()==draft.resolve() or draft.resolve() in r.resolve().parents):raise ValueError('run directory must be outside draft worktree')
    r.mkdir(parents=True,exist_ok=True)
    with (r/'.runner.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise ValueError('this round already running')
        try:return run_locked(a)
        except (OSError,ValueError,subprocess.CalledProcessError) as e:
            return stop(r,str(e))


def run_locked(a):
    r=a.run_dir
    segments=getattr(a,'segments',False)
    draft=getattr(a,'draft_worktree',None)
    config=r/'run.json'
    if config.exists():
        state=json.loads(config.read_text())
        if state.get('segments',False)!=segments:raise ValueError('resume mode mismatch')
        if state.get('draft_snapshot') and draft and str(draft.resolve())!=state['draft_snapshot']['source']:raise ValueError('resume draft mismatch')
        if state['theme']!=a.theme:raise ValueError('resume theme mismatch')
        if a.pages and pages_from(a.pages)!=state['pages']:raise ValueError('resume pages differ; use a new run directory')
        provided=a.corpus_report or (a.pages if a.pages and a.pages.suffix=='.json' else None)
        if provided and hashlib.sha256(provided.read_bytes()).hexdigest()!=state.get('corpus_report_sha256'):
            raise ValueError('resume corpus report differs; use a new run directory')

    else:
        reg=json.loads((getattr(a,'registry',None) or a.repo/'tools/source_registry.json').read_text())
        if a.theme not in reg['themes']:raise ValueError('unknown theme')
        pages=pages_from(a.pages or a.root/a.theme/'pages_full.txt')
        impact_path=a.corpus_report or (a.pages if a.pages and a.pages.suffix=='.json' else None)
        if impact_path:
            report=json.loads(impact_path.read_text())
            if report.get('theme')!=a.theme or report.get('errors') or not report.get('snapshot') or not isinstance(report.get('sources'),list):
                raise ValueError('invalid/incomplete corpus report')
        if not pages:
            (r/'.finished').write_text('no affected pages; no model called\n');return 0
        # All mutations stay inside this new run, never inside t1..t4/out.
        desc=a.root/a.theme/'corpus_desc.md'
        description=desc.read_text() if desc.exists() else '\n'.join(f"- {s['local_text']}: {s['url']}" for s in reg['sources'] if a.theme in s['themes'])
        shutil.copytree(getattr(a,'corpus_dir',None) or a.root/a.theme/'corpus',r/'corpus',dirs_exist_ok=True)
        if a.theme in ('t2','t4'):
            shutil.copytree(a.root/'t1/corpus',r/'t1-corpus',dirs_exist_ok=True)
            description=description.replace('~/Scripts/keiri-commander/runs/review-loop/t1/corpus/',str(r/'t1-corpus')+'/')
        impact_path=a.corpus_report or (a.pages if a.pages and a.pages.suffix=='.json' else None)
        if impact_path:
            impact=json.loads(impact_path.read_text())
            if impact.get('theme')!=a.theme or impact.get('errors') or not impact.get('snapshot'):
                raise ValueError('invalid/incomplete corpus report')
            snapshot=Path(impact['snapshot'])
            observed={item['id']:item for item in impact['sources']}
            notes=[]
            for source in reg['sources']:
                if a.theme not in source['themes']:continue
                record=observed.get(source['id'])
                if not record or record.get('status')!='ok':raise ValueError('source snapshot incomplete: '+source['id'])
                folder=snapshot/source['id']
                raw=folder/('original.'+source['format']);text=folder/'text.txt'
                if hashlib.sha256(raw.read_bytes()).hexdigest()!=record['raw_sha256'] or hashlib.sha256(text.read_bytes()).hexdigest()!=record['text_sha256']:
                    raise ValueError('snapshot hash mismatch: '+source['id'])
                local_theme,relative=source['local_text'].split('/corpus/',1)
                target=r/('corpus' if local_theme==a.theme else 't1-corpus')/relative
                target.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(text,target)
                raw_target=target.with_suffix(Path(source['local_raw']).suffix)
                shutil.copy2(raw,raw_target)
                notes.append(f'- {target}: {source["url"]}')
            # Keep theme caveats (e.g. out-of-corpus scope), append the precise frozen version.
            description+='\n\n今回の再取得正本（この版を照合。旧版の行番号を流用しない）:\n'+'\n'.join(notes)
        (r/'corpus_desc.md').write_text(description)
        for template in ('sol_theme.md','astra_theme.md'):shutil.copy2(a.root/template,r/template)
        draft_snapshot=None
        if draft:
            draft_snapshot=theme_segments.snapshot(draft,r/'site')
        else:
            subprocess.run(['git','-C',str(a.repo),'fetch','origin'],check=True)
            subprocess.run(['git','-C',str(a.repo),'worktree','add','--detach',str(r/'site'),'origin/main'],check=True)
        for page in pages:
            if not (r/'site'/page).is_file():raise ValueError('missing page '+page)
        (r/'batches').mkdir();(r/'out').mkdir()
        for i in range(0,len(pages),4):(r/'batches'/f't{i//4:02d}').write_text('\n'.join(pages[i:i+4])+'\n')
        (r/'pages_full.txt').write_text('\n'.join(pages)+'\n')
        state={'theme':a.theme,'name':reg['themes'][a.theme],'pages':pages,'round':a.theme+'-'+r.name,
               'segments':segments,'draft_snapshot':draft_snapshot,
               'base_sha':None if draft else subprocess.check_output(['git','-C',str(r/'site'),'rev-parse','HEAD'],text=True).strip()}
        state['corpus_report_sha256']=hashlib.sha256(impact_path.read_bytes()).hexdigest() if impact_path else None
        state['frozen_hashes']={str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ('corpus','t1-corpus','batches') for p in (r/folder).rglob('*') if p.is_file()}
        for name in ('corpus_desc.md','sol_theme.md','astra_theme.md'):state['frozen_hashes'][name]=hashlib.sha256((r/name).read_bytes()).hexdigest()
        if segments:
            for name in ('sol_segments.md','astra_segments.md'):
                shutil.copy2(a.repo/'tools/review_templates'/name,r/name);state['frozen_hashes'][name]=theme_segments.digest(r/name)
            state['frozen_hashes'].update(theme_segments.prepare(r,a.repo,pages))
        config.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n');(r/'.started').touch()
    for path,digest in state['frozen_hashes'].items():
        if not (r/path).exists() or hashlib.sha256((r/path).read_bytes()).hexdigest()!=digest:return stop(r,'frozen input changed: '+path)
    if state.get('base_sha'):
        head=subprocess.check_output(['git','-C',str(r/'site'),'rev-parse','HEAD'],text=True).strip()
        dirty=subprocess.check_output(['git','-C',str(r/'site'),'status','--porcelain','--untracked-files=no'],text=True)
        if head!=state['base_sha'] or dirty:return stop(r,'frozen site changed')
    if state.get('draft_snapshot') and not theme_segments.validate_snapshot(r/'site',state['draft_snapshot']):return stop(r,'frozen draft changed')
    if (r/'.finished').exists():print('already finished');return 0
    if a.prepare_only:print(r);return 0
    if segments:return theme_segments.run(a,state,execute,stop)
    values={'ROUND':state['round'],'R':r,'THEME':state['name'],'DATE':datetime.date.today().isoformat(),
            'CORPUS':r/'corpus','SITE':r/'site','CORPUS_DESC':(r/'corpus_desc.md').read_text()}
    batches=sorted((r/'batches').glob('t*'))
    expected=[state['pages'][i:i+4] for i in range(0,len(state['pages']),4)]
    if len(batches)!=len(expected) or any(b.read_text().splitlines()!=p for b,p in zip(batches,expected)):return stop(r,'missing/changed batch inputs')
    for b in batches:
        out=r/'out'/(b.name+'.json')
        if batch_valid(out,b.read_text().splitlines()):continue
        if a.check_only:continue
        prompt=fill(r/'sol_theme.md',{**values,'LIST':b,'OUT':out,'BATCH':state['round']+'-'+b.name})
        (r/'out'/(b.name+'.prompt.md')).write_text(prompt)
        rc,quota=execute(a.worker,SOL_MODEL,prompt,r,r/'out'/(b.name+'.log'))
        if rc or quota:
            # A nonzero worker must not become a successful batch just because it left JSON behind.
            if out.exists():
                (r/'failed').mkdir(exist_ok=True)
                out.rename(r/'failed'/f'{b.name}-{time.time_ns()}.json')
            return stop(r,f'sol stopped: {b.name} rc={rc} quota={quota}')
    missing=sum(not batch_valid(r/'out'/(b.name+'.json'),b.read_text().splitlines()) for b in batches)
    (r/'coverage.txt').write_text(f'pages={len(state["pages"])} batches={len(batches)} missing_batches={missing}\n')
    if missing:return stop(r,f'missing_batches={missing}; Astra not started')
    if a.check_only:return 0
    prompt=fill(r/'astra_theme.md',values);(r/'astra.prompt.md').write_text(prompt)
    started=time.time_ns()
    rc,quota=execute(a.worker,'gpt-6-astra',prompt,r,r/'astra-run.log')
    fixes=r/'fixes.md'
    if rc or quota or not fixes.exists() or fixes.stat().st_mtime_ns < started or not fixes.read_text().rstrip().endswith('\nDONE'):
        return stop(r,f'astra incomplete rc={rc} quota={quota}')
    request=(f'round={state["round"]}\nreport={fixes}\n'
             f'worktree={Path.home()}/Scripts/keiri-tools-astra-theme-{state["round"]}\n'
             f'branch=wt/astra-theme-{state["round"]}\nstatus=司令塔の検品待ち（未公開）\n')
    (r/'publish-request').write_text(request)
    (a.root/('publish-request-'+state['round'])).write_text(request)
    (r/'.finished').touch();(r/'STOPPED').unlink(missing_ok=True);print(r/'publish-request');return 0


def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('theme');ap.add_argument('--pages',type=Path);ap.add_argument('--corpus-report',type=Path)
    ap.add_argument('--root',type=Path,default=HERE);ap.add_argument('--repo',type=Path,default=Path.home()/'Scripts/keiri-tools')
    ap.add_argument('--run-dir',type=Path);ap.add_argument('--worker',default='codex')
    ap.add_argument('--prepare-only',action='store_true');ap.add_argument('--check-only',action='store_true')
    ap.add_argument('--segments',action='store_true');ap.add_argument('--draft-worktree',type=Path)
    ap.add_argument('--registry',type=Path);ap.add_argument('--corpus-dir',type=Path)
    a=ap.parse_args()
    if a.draft_worktree and not a.segments:ap.error('--draft-worktree requires --segments')
    a.root=a.root.resolve();a.repo=a.repo.resolve()
    if not re.fullmatch('[a-zA-Z0-9_-]+',a.theme):ap.error('invalid theme')
    if a.run_dir is None:
        parent=a.root/'theme-runs'/a.theme
        pending=sorted(p.parent for p in parent.glob('*/STOPPED'))
        if len(pending)>1:ap.error('multiple STOPPED rounds; specify --run-dir')
        a.run_dir=pending[0] if pending else parent/datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    a.run_dir=a.run_dir.resolve()
    if not re.fullmatch('[a-zA-Z0-9_-]+',a.run_dir.name):ap.error('run directory name must be a branch-safe identifier')
    if a.run_dir==a.repo or a.repo in a.run_dir.parents:ap.error('run directory must be outside site repository')
    if any(a.run_dir==a.root/t or a.root/t in a.run_dir.parents for t in ('t1','t2','t3','t4','t4b','t5','t6','t7')):ap.error('active t1..t4 directories are read-only')
    try:return run(a)
    except (OSError,ValueError,subprocess.CalledProcessError) as e:print(str(e),file=sys.stderr);return 4

if __name__=='__main__':raise SystemExit(main())
