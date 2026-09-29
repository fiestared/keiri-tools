#!/usr/bin/env python3
"""Import read-only sol out/*.json, resolving cited lines to literal source excerpts.
Never promote wrong claims without an already corrected, adjudicated ledger entry.
Keeps existing claims, identifies imports by round/batch/page/id, and reports exclusions.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parents[1]


def locator_sources(ref, theme, registry):
    found=[]
    if any(s['image_pdf'] and Path(s['local_raw']).stem in ref for s in registry['sources']):
        raise ValueError('ocr_excluded')
    # Paths can be absolute, ../t1/corpus, corpus/, or relative to the theme corpus.
    pattern=r'([\w./~-]+\.txt)\s*[:：]\s*([0-9]+(?:\s*[-–〜]\s*[0-9]+)?(?:\s*[,、]\s*[0-9]+(?:\s*[-–〜]\s*[0-9]+)?)*)'
    for m in re.finditer(pattern,ref):
        token=m[1]; candidates=[]
        for s in registry['sources']:
            local=s['local_text'];tail=local.split('/corpus/',1)[1]
            if token.endswith(local) or token=='../'+local or token==local:
                candidates=[s];break
            if theme in s['themes'] and (token==tail or token=='corpus/'+tail or token.endswith('/corpus/'+tail)):candidates.append(s)
        if len(candidates)!=1:raise ValueError('unresolved/ambiguous path: '+token)
        found.append((candidates[0],m[2]))
    if not found:raise ValueError('no text line locator')
    if '.ocr.' in ref or '.png' in ref or 'OCR' in ref or any(s['image_pdf'] for s,_ in found):
        raise ValueError('ocr_excluded')
    return found


def resolve_quotes(ref,theme,registry,runs):
    refs=[]
    for s,ranges in locator_sources(ref,theme,registry):
        text=(Path(runs)/s['local_text']).read_text()
        # Keep form feed as a character: sol uses grep/nl line numbers, not splitlines() PDF pages.
        lines=text.split('\n')
        for match in re.finditer(r'(\d+)(?:\s*[-–〜]\s*(\d+))?',ranges):
            a=int(match[1]);b=int(match[2]) if match[2] else min(len(lines),a+12)
            if not 1<=a<=b<=len(lines):raise ValueError('line range out of bounds')
            quote='\n'.join(lines[a-1:b])
            if len(quote.strip())<8:raise ValueError('cited excerpt too short; requires review')
            assert quote in text
            refs.append({'url':s['url'],'quote':quote,'corpus_ref':s['local_text']+f':{a}-{b}',
                         'source_text_sha256':hashlib.sha256(text.encode()).hexdigest()})
    return refs


def year_scope(text, theme, registry):
    years=sorted(set(int(y)+2018 for y in re.findall(r'令和\s*([0-9０-９]+)\s*年',text)))
    return {'years':years,'axis':'explicit_claim_year' if years else 'unspecified',
            'review_theme':theme}


def import_claims(runs,repo,registry,themes):
    repo=Path(repo); report={'inputs':[],'counts':{},'rows':[]};ledgers={}
    for theme in themes:
        files=sorted((Path(runs)/theme/'out').glob('*.json'))
        if not files:raise ValueError('no sol output for '+theme)
        for f in files:
            raw=f.read_bytes();d=json.loads(raw)
            identities=[(c['page'],c['id']) for c in d['claims']]
            if len(identities)!=len(set(identities)):raise ValueError('duplicate sol claim id: '+str(f))
            report['inputs'].append({'file':str(f),'sha256':hashlib.sha256(raw).hexdigest()})
            for c in d.get('claims',[]):
                page=c['page'];key=f'{theme}/{f.stem}/{page}/{c["id"]}'
                fingerprint=hashlib.sha256(json.dumps(c,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
                row={'key':key,'theme':theme,'page':page,'result':c['result']}
                report['rows'].append(row)
                if c['result'] not in ('ok','wrong'):row['status']='not_eligible';continue
                if not re.fullmatch(r'docs/(?:[a-zA-Z0-9_-]+/)*index.html',page):raise ValueError('unsafe page: '+page)
                target=repo/'claims'/(page[5:-11]+'.json')
                if target not in ledgers:
                    ledgers[target]=json.loads(target.read_text()) if target.exists() else {'page':page,'claims':[]}
                ledger=ledgers[target];claims=ledger['claims']
                prior=next((x for x in claims if key in x.get('import_keys',[])),None)
                if prior is not None:
                    if prior.get('import_inputs',{}).get(key,fingerprint)!=fingerprint:
                        row['status']='input_changed';continue
                    prior.setdefault('import_inputs',{})[key]=fingerprint
                    row['status']='already_present';continue
                if c['result']=='wrong':
                    # Only corrected claims already adopted in the repository can be linked.
                    findings=[(i,x) for i,x in enumerate(d.get('findings',[])) if x.get('claim_id')==c['id'] and x.get('page')==page]
                    ids={f'{f.stem}-F{i}' for i,_ in findings}
                    existing=next((x for x in claims if (theme=='t1' and x.get('adjudication') in ids) or any(x.get('text')==finding.get('correct') and finding.get('correct') for _,finding in findings)),None)
                    if existing:
                        if not existing.get('text') or existing['text']==c['claim']:row['status']='wrong_pending';continue
                        sources=[existing]+existing.get('supporting_sources',[])
                        valid=True
                        for x in sources:
                            url=x.get('source_url',x.get('url'));quote=x.get('source_quote',x.get('quote'))
                            ss=[s for s in registry['sources'] if s['url']==url and not s['image_pdf']]
                            if not quote or not any(quote in (Path(runs)/s['local_text']).read_text() for s in ss):valid=False
                        if valid:existing.setdefault('import_keys',[]).append(key);existing.setdefault('import_inputs',{})[key]=fingerprint;row['status']='corrected_existing';continue
                    row['status']='wrong_pending';continue
                try:refs=resolve_quotes(c.get('corpus_ref',''),theme,registry,runs)
                except ValueError as e:
                    row.update(status='ocr_excluded' if str(e)=='ocr_excluded' or re.search(r'ocr|\.png',c.get('corpus_ref',''),re.I) else 'locator_unresolved',reason=str(e));continue
                existing=next((x for x in claims if re.sub(r'\s','',x.get('text',''))==re.sub(r'\s','',c['claim'])),None)
                if existing:existing.setdefault('import_keys',[]).append(key);existing.setdefault('import_inputs',{})[key]=fingerprint;row['status']='duplicate_existing';continue
                scope=year_scope(c['claim'],theme,registry)
                claim={'id':'sol-'+hashlib.sha256(key.encode()).hexdigest()[:16],'text':c['claim'],'numbers':[],
                       'where':c.get('where',[]),'applies':'、'.join(str(y)+'年' for y in scope['years']) or '対象年は引用箇所・主張本文による（未特定）',
                       'applies_period':scope,'source_url':refs[0]['url'],'source_quote':refs[0]['quote'],
                       'supporting_sources':refs[1:], 'exceptions':'sol の ok 判定を移行。要件・例外は引用範囲を参照。別途の例外審査済みとはしない。',
                       'import_keys':[key],'import_inputs':{key:fingerprint},'corpus_ref':refs[0]['corpus_ref'],'source_text_sha256':refs[0]['source_text_sha256'],
                       'review_result':'sol_ok','sol_quote':c.get('corpus_quote','')}
                claims.append(claim);row['status']='added'
    # Reuse the existing number parser rather than creating a different number net.
    pending=[c for l in ledgers.values() for c in l['claims'] if c.get('id','').startswith('sol-')]
    if pending:
        js="import {findNumbers} from './tools/check_claims.mjs'; let s=''; for await (const b of process.stdin) s+=b; console.log(JSON.stringify(JSON.parse(s).map(x=>[...findNumbers(x)])));"
        res=subprocess.run(['node','--input-type=module','-e',js],cwd=repo,input=json.dumps([c['text'] for c in pending]),text=True,capture_output=True,check=True)
        for c,nums in zip(pending,json.loads(res.stdout)):c['numbers']=nums
    for target,ledger in ledgers.items():
        if not ledger['claims']:continue
        target.parent.mkdir(parents=True,exist_ok=True)
        payload=json.dumps(ledger,ensure_ascii=False,indent=2)+'\n'
        if not target.exists() or target.read_text()!=payload:
            temporary=target.with_suffix('.json.tmp');temporary.write_text(payload);temporary.replace(target)
    for row in report['rows']:
        k=row['theme'];count=report['counts'].setdefault(k,{'total':0});count['total']+=1
        count[row['status']]=count.get(row['status'],0)+1
    report['eligible']=sum(r['result'] in ('ok','wrong') for r in report['rows'])
    report['represented']=sum(r['status'] in ('added','already_present','corrected_existing','duplicate_existing') for r in report['rows'])
    report['unresolved']=sum(r['status'] in ('locator_unresolved','input_changed') for r in report['rows'])
    report['wrong_not_imported']=sum(r['status']=='wrong_pending' for r in report['rows'])
    report['accounted_total']=sum(v['total'] for v in report['counts'].values())
    return report


def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--runs',type=Path,required=True)
    ap.add_argument('--repo',type=Path,default=ROOT);ap.add_argument('--registry',type=Path,default=ROOT/'tools/source_registry.json')
    ap.add_argument('--themes',nargs='+',default=['t1','t2','t3','t4']);ap.add_argument('--report',type=Path,required=True)
    a=ap.parse_args();r=import_claims(a.runs,a.repo,json.loads(a.registry.read_text()),a.themes)
    a.report.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps(r['counts'],ensure_ascii=False,indent=2))
    return 4 if r['unresolved'] else 0

if __name__=='__main__':raise SystemExit(main())
