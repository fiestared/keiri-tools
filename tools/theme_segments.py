"""Strict unit batches and frozen, read-only draft snapshots for theme_round."""
import hashlib,json,os,re,shutil,subprocess,tempfile,threading,time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# 2026-10-01 対策1（gbrain audits/keiri-why-not-one-pass-2026-10-01）: 数字・境界・対象者・期限・義務・列挙・言い切りを含む単位は、
# ok にする前に同じ条・表・節のただし書・かっこ書・注・別区分を走査した記録（conditions）が要る。
CONDITIONAL=re.compile(r'[0-9０-９]|[一二三四五六七八九十百千万億]+(?:円|年|月|日|割|歳|人)|以上|以下|未満|超|以内|まで|以後|以降|対象|義務|必要|不要|期限|要件|だけ|のみ|必ず|一律|すべて|全て|全員|限り|除|免除|非課税|課税|控除')
def needs_conditions(text):return bool(CONDITIONAL.search(text or ''))
COVERED=re.compile(r'(yes|no|irrelevant)(?=$|[\s（(:：、,。.])')
def covered_value(c):
    """covered の値。先頭の語が yes|no|irrelevant ならそれを返す（後ろの理由書きは許す）。それ以外は None。
    2026-10-02 実害: gpt-5.6-sol が "irrelevant（単位は…だけを述べる）" と理由をかっこで足して返し、完全一致だけを見ていた検査が
    中身の正しい束（28単位）を3回続けて不成立にして、再照合が止まった（同じ日に「不成立の束」16回）。"""
    m=COVERED.match(str(c.get('covered','')).strip())
    return m.group(1) if m else None
def conditions_error(conds,text):
    """None なら有効。ok の conditions: [{condition, corpus_ref, covered: yes|no|irrelevant}]。no があれば ok にできない。"""
    if not isinstance(conds,list):return 'ok without conditions'
    if needs_conditions(text) and not conds:return 'ok without conditions'
    for c in conds:
        if not isinstance(c,dict) or not str(c.get('condition','')).strip() or not str(c.get('corpus_ref','')).strip() or covered_value(c) is None:return 'ok without conditions'
    if any(covered_value(c)=='no' for c in conds):return 'ok with uncovered condition'
    return None

MODEL_NAME=re.compile(r'[a-zA-Z0-9._-]+')
def sol_models(a,state,r):
    """この run の sol のモデル（2026-10-01 対策2: 1周目から 6.1 と 5.6 を並走し、審査は和集合を見る）。
    --sol-models > KEIRI_SOL_MODELS > KEIRI_SOL_MODEL（既定 gpt-6.1-sol の1本）。一度決めたら run.json に残し、再開で変えない。"""
    given=getattr(a,'sol_models',None) or os.environ.get('KEIRI_SOL_MODELS') or None
    want=[m.strip() for m in given.split(',') if m.strip()] if isinstance(given,str) else given
    saved=state.get('sol_models')
    if saved:
        if want and list(want)!=list(saved):raise ValueError('resume sol models differ; use a new run directory')
        return list(saved)
    models=list(want or [os.environ.get('KEIRI_SOL_MODEL','gpt-6.1-sol')])
    if not models or len(set(models))!=len(models) or any(not MODEL_NAME.fullmatch(m) for m in models):raise ValueError('invalid sol models')
    state['sol_models']=models
    config=r/'run.json'
    if config.exists():
        d=json.loads(config.read_text());d['sol_models']=models;config.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
    return models
def sol_out(r,models,model,stem):
    """1本目は従来どおり out/<束>.json（既存の集計・再開と互換）。2本目以降は out/<モデル>/<束>.json。"""
    return r/'out'/(stem+'.json') if model==models[0] else r/'out'/model/(stem+'.json')

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def files(repo):
    names=subprocess.check_output(['git','-C',str(repo),'ls-files','-z','--cached','--others','--exclude-standard']).decode().split('\0')
    result={}
    for name in sorted(set(filter(None,names))):
        p=repo/name
        if p.is_symlink():raise ValueError('symlink draft file: '+name)
        if not p.exists():continue
        if p.is_symlink() or not p.is_file():raise ValueError('unsupported draft file: '+name)
        result[name]={'sha256':digest(p),'executable':bool(p.stat().st_mode & 0o111)}
    return result

def snapshot(source,target):
    source=source.resolve();before=files(source)
    target.mkdir()
    for name in before:
        out=target/name;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,out)
    if before!=files(source):raise ValueError('draft changed during copy; retry in a new run')
    # A private index/object database computes the exact future commit tree. Source stays untouched.
    subprocess.run(['git','init','-q',str(target)],check=True)
    subprocess.run(['git','-C',str(target),'add','-f','--pathspec-from-file=-','--pathspec-file-nul'],input='\0'.join(before)+'\0',text=True,check=True)
    tree=subprocess.check_output(['git','-C',str(target),'write-tree'],text=True).strip()
    shutil.rmtree(target/'.git')
    for name in before:(target/name).chmod(0o555 if before[name]['executable'] else 0o444)
    for p in sorted(target.rglob('*'),reverse=True):
        if p.is_dir():p.chmod(0o555)
    target.chmod(0o555)
    return {'source':str(source),'tree':tree,'files':before}

def validate_snapshot(site,snapshot):
    actual={str(p.relative_to(site)):{'sha256':digest(p),'executable':bool(p.stat().st_mode & 0o111)} for p in site.rglob('*') if p.is_file() and not p.is_symlink()}
    return actual==snapshot['files']

def prepare(r,repo,pages,since=None):
    units=json.loads(subprocess.check_output(['node',str(repo/'tools/segment_claims.mjs'),*pages],cwd=r/'site',text=True))
    if since is not None:
        # 2026-10-01 対策4: 修正で変わった単位だけを照合し直す（前の run の segments.json に同じページ・同じ本文の単位が無いもの）
        before={(u['page'],u['text_hash']) for u in json.loads((since/'segments.json').read_text())}
        units=[u for u in units if (u['page'],u['text_hash']) not in before]
        if not units:
            (r/'segments.json').write_text('[]\n');(r/'segment-batches').mkdir()
            return {'segments.json':digest(r/'segments.json')}
    if not units:raise ValueError('empty segment scope')
    (r/'segments.json').write_text(json.dumps(units,ensure_ascii=False,indent=2)+'\n')
    (r/'segment-batches').mkdir()
    # 20–40 units per batch, except a scope smaller than 20.
    n=(len(units)+39)//40
    size=(len(units)+n-1)//n
    for i in range(0,len(units),size):
        (r/'segment-batches'/f's{i//size:04d}.json').write_text(json.dumps(units[i:i+size],ensure_ascii=False,indent=2)+'\n')
    (r/'coverage.json').write_text(json.dumps({'total':len(units),'confirmed':0,'nonclaims':0,'out_of_corpus':0,'unclear':0,'unprocessed':len(units),'links':[],'errors':[]},ensure_ascii=False,indent=2)+'\n')
    paths=[r/'segments.json',*(r/'segment-batches').glob('*.json')]
    return {str(p.relative_to(r)):digest(p) for p in paths}

def quote_present(run,ref,quote):
    """引用 quote が、参照 ref の指す正本の範囲に逐語（空白を除く）で在るか。
    ref は `corpus/<file>:<start>-<end>`。複数の範囲は `,`、複数のファイルは `;` で区切ってよい（2026-09-29 r13 実測:
    sol は複数の正本・複数の範囲をまとめて書く。1ファイル1範囲しか読めず 566 件が不成立になった）。
    行番号は目安（全文で照合）。引用が複数箇所をつないだものなら断片ごとに照合。別ファイル・画像/PDF・正本に無い文は不成立のまま。"""
    if not isinstance(ref,str) or not isinstance(quote,str) or not quote.strip():return False
    norm=lambda text:re.sub(r'\s+','',text)
    want=norm(quote);base=run.resolve();pool=[]
    for part in [x.strip() for x in ref.split(';') if x.strip()]:
        match=re.fullmatch(r'(.+?):((?:L?\d+(?:-L?\d+)?)(?:\s*,\s*L?\d+(?:-L?\d+)?)*)',part)
        if not match:return False
        name,spans=match.groups();path=None
        for candidate in (run/name,run/'corpus'/name):
            c=candidate.resolve()
            if any(c.is_relative_to(base/folder) for folder in ('corpus','t1-corpus')) and c.is_file():path=c;break
        if path is None or path.suffix.lower() not in ('.txt','.md','.htm','.html','.xml','.json'):return False
        try:lines=path.read_text().splitlines()
        except (UnicodeDecodeError,OSError):return False
        for span in spans.split(','):
            a,_,b=span.strip().replace('L','').partition('-');a=int(a);b=int(b or a)
            if a<1 or b<a or a>len(lines):return False
        # 行番号は目安として扱い、照合は参照したファイルの全文で行う（pdftotext の段組みで行番号が大きくずれる。r13 実測 176 件）。
        # 別ファイル・存在しない引用は不成立のまま＝「正本に逐語で在る」ことは保つ。
        pool.append('\n'.join(lines))
    if not pool:return False
    # sol は複数箇所の引用を改行・「…」・「 | 」でつないで1つに書く。断片ごとに、参照したどれかの正本に逐語で在ることを求める。
    frags=[norm(f) for f in re.split(r'\n|…|\.\.\.|\s\|\s|／|[;；]',quote)]  # 2026-09-30: Grok は複数箇所を ; でつなぐ
    frags=[f for f in frags if len(f)>=2] or [want]  # 短い断片（例「二半製品」）も断片として照合する（2026-09-30: 同じ短文を2つの正本から ; で並べた引用が不成立になった）
    text=[norm(chunk) for chunk in pool]
    return all(any(f in t for t in text) for f in frags)

def run_root(path):
    """out/<束>.json と out/<モデル>/<束>.json のどちらからも run の直下を返す。"""
    p=path.parent
    while p.name!='out' and p!=p.parent:p=p.parent
    return p.parent

def inspect(path,units,require_conditions=True):
    errors=[];done={};expected={(u['page'],u['id']):u for u in units}
    try:
        d=json.loads(path.read_text());rows=d['segments'];findings=d['findings']
        if not isinstance(rows,list) or not isinstance(findings,list) or any(not isinstance(x,dict) for x in rows+findings):raise ValueError('invalid arrays')
        for row in rows:
            key=(row['page'],row['id']);u=expected.get(key);result=row.get('result')
            if not u or key in done:errors.append('unknown/duplicate ID');continue
            if row.get('text_hash')!=u['text_hash']:errors.append('text hash mismatch');continue
            if result not in ('ok','wrong','nonclaim','out_of_corpus','unclear'):errors.append('missing verdict');continue
            if result=='nonclaim' and (u['protected'] or not row.get('why','').strip()):errors.append('invalid nonclaim');continue
            if result in ('ok','wrong') and (not row.get('claim_id') or not row.get('corpus_ref') or not row.get('corpus_quote')):errors.append('missing claim/source');continue
            if result in ('ok','wrong') and not quote_present(run_root(path),row['corpus_ref'],row['corpus_quote']):errors.append('corpus quote not present at reference');continue
            if require_conditions and result=='ok' and (err:=conditions_error(row.get('conditions'),u.get('text'))):errors.append(err);continue
            if result=='out_of_corpus' and not row.get('needed_source'):errors.append('missing needed source');continue
            matches=[f for f in findings if (f.get('page'),f.get('segment_id'))==key]
            if result in ('wrong','unclear') and (len(matches)!=1 or matches[0].get('severity') not in ('high','medium','low') or not matches[0].get('reason')):errors.append('missing finding');continue
            done[key]=row
        if any((f.get('page'),f.get('segment_id')) not in expected for f in findings):errors.append('unknown finding')
        if set(done)!=set(expected):errors.append('unprocessed units')
    except (OSError,ValueError,KeyError,TypeError,AttributeError):errors.append('missing/invalid batch')
    return done,errors

def frozen_ok(r,state):
    for name,sha in state['frozen_hashes'].items():
        p=r/name
        if not p.is_file() or digest(p)!=sha:return False
    if state.get('draft_snapshot'):return validate_snapshot(r/'site',state['draft_snapshot'])
    if state.get('base_sha'):
        head=subprocess.check_output(['git','-C',str(r/'site'),'rev-parse','HEAD'],text=True).strip()
        dirty=subprocess.check_output(['git','-C',str(r/'site'),'status','--porcelain'],text=True).strip()
        return head==state['base_sha'] and not dirty
    return True

def run(a,state,execute,stop):
    r=a.run_dir;units=json.loads((r/'segments.json').read_text());batches=sorted((r/'segment-batches').glob('*.json'))
    expected=[u for b in batches for u in json.loads(b.read_text())]
    if expected!=units:return stop(r,'segment scope changed')
    models=sol_models(a,state,r)
    # conditions を課すのは、この run に固定したひな形が conditions を求めている場合だけ（2026-10-01 以前に始まった run を再開しても
    # 旧ひな形の出力を「未処理」にして無限に照合し直さないため）。
    sol_conds='conditions' in (r/'sol_segments.md').read_text();astra_conds='conditions' in (r/'astra_segments.md').read_text()
    failures=[];failed=threading.Event();lock=threading.Lock()
    def lane(model):
        # 各モデルは同じ束を順に照合する。モデルどうしは並走（2026-10-01 対策2）。
        for b in batches:
            if failed.is_set():return
            out=sol_out(r,models,model,b.stem);batch=json.loads(b.read_text())
            if not inspect(out,batch,sol_conds)[1] or a.check_only:continue
            out.parent.mkdir(exist_ok=True)
            prompt=(r/'sol_segments.md').read_text().replace('{{SITE}}',str(r/'site')).replace('{{CORPUS}}',str(r/'corpus')).replace('{{LIST}}',str(b)).replace('{{OUT}}',str(out))
            out.with_suffix('.prompt.md').write_text(prompt)
            rc,quota=execute(a.worker,model,prompt,r,out.with_suffix('.log'))
            if rc or quota:
                with lock:
                    if out.exists():
                        (r/'failed').mkdir(exist_ok=True);out.rename(r/'failed'/f'{b.stem}-{"" if model==models[0] else model+"-"}{time.time_ns()}.json')
                    failures.append(f'sol stopped rc={rc} quota={quota}'+(f' model={model}' if len(models)>1 else ''))
                failed.set();return
    if len(models)==1:lane(models[0])
    else:
        with ThreadPoolExecutor(len(models)) as pool:list(pool.map(lane,models))
    if failures:return stop(r,failures[0])
    if not frozen_ok(r,state):return stop(r,'frozen input changed during sol')
    done={};errors=[];per_model={}
    for model in models:
        got={}
        for b in batches:
            rows,errs=inspect(sol_out(r,models,model,b.stem),json.loads(b.read_text()),sol_conds);got.update(rows)
            errors.extend(errs if model==models[0] else [f'{model}: {e}' for e in errs])
        per_model[model]=got
    done=per_model[models[0]]
    coverage={'total':len(units),'confirmed':sum(x['result'] in ('ok','wrong') for x in done.values()),'nonclaims':sum(x['result']=='nonclaim' for x in done.values()),'out_of_corpus':sum(x['result']=='out_of_corpus' for x in done.values()),'unclear':sum(x['result']=='unclear' for x in done.values()),'unprocessed':len(units)-len(done),'links':[{'page':k[0],'id':k[1],'claim_id':v.get('claim_id'),'result':v['result']} for k,v in done.items()],'errors':errors,
              'sol_models':models,'unprocessed_by_model':{m:len(units)-len(per_model[m]) for m in models}}
    (r/'coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2)+'\n')
    # 審査が見る和集合（2026-10-01 対策2）。どれか1つのモデルでも wrong/unclear なら、その単位は「sol が指摘した」。
    findings_all={}
    for model in models:
        for b in batches:
            try:
                for f in json.loads(sol_out(r,models,model,b.stem).read_text()).get('findings',[]):
                    if isinstance(f,dict):findings_all.setdefault((f.get('page'),f.get('segment_id')),[]).append({'model':model,'severity':f.get('severity'),'reason':f.get('reason')})
            except (OSError,ValueError,TypeError,AttributeError):pass
    union=[]
    for u in units:
        k=(u['page'],u['id'])
        union.append({'page':u['page'],'id':u['id'],'text':u['text'],'results':{m:per_model[m].get(k,{}).get('result') for m in models},
                      'conditions':{m:per_model[m][k].get('conditions') for m in models if per_model[m].get(k,{}).get('result')=='ok'},
                      'findings':findings_all.get(k,[])})
    (r/'sol-models.json').write_text(json.dumps(models)+'\n')
    (r/'sol-union.json').write_text(json.dumps(union,ensure_ascii=False,indent=1)+'\n')
    flagged={(x['page'],x['id']) for x in union if any(v in ('wrong','unclear') for v in x['results'].values())}
    origins=[]
    for (page,seg),fs in findings_all.items():
        for f in fs:
            if f['severity']=='high':origins.append({'page':page,'segment_id':seg,'severity':'high','reason':f['reason'],'model':f['model'],'status':'sol_candidate','high_origin':{'introduced_commit':None,'first_seen_run':state['round'],'detected_stage':'sol_review','origin_stage':'unknown','origin_evidence':str(r/'sol-union.json')}})
    (r/'high-origin.json').write_text(json.dumps(origins,ensure_ascii=False,indent=2)+'\n')
    if errors or coverage['unprocessed']:return stop(r,'incomplete segment batches; Astra not started')
    if a.check_only:return 0
    prompt=(r/'astra_segments.md').read_text().replace('{{R}}',str(r)).replace('{{SITE}}',str(r/'site'))
    (r/'astra.prompt.md').write_text(prompt);started=time.time_ns()
    rc,quota=execute(a.worker,'gpt-6-astra',prompt,r,r/'astra-run.log')
    verdict=r/'segment-adjudication.json';fixes=r/'fixes.md'
    if rc or quota or not verdict.exists() or verdict.stat().st_mtime_ns<started or not fixes.exists() or fixes.stat().st_mtime_ns<started or not fixes.read_text().rstrip().endswith('\nDONE'):return stop(r,'Astra incomplete')
    try:
        review=json.loads(verdict.read_text());rows=review['segments']
        if not isinstance(rows,list) or any(not isinstance(x,dict) for x in rows):raise ValueError('invalid adjudication array')
        keys=[(x['page'],x['id']) for x in rows]
        if len(keys)!=len(set(keys)) or set(keys)!={(u['page'],u['id']) for u in units}:raise ValueError('adjudication IDs incomplete')
        if any(x.get('decision') not in ('ok','nonclaim','out_of_corpus','unresolved') or not x.get('reason') for x in rows):raise ValueError('adjudication verdict missing')
        if any(x['decision']=='out_of_corpus' and not x.get('needed_source') for x in rows):raise ValueError('required source missing')
        protected={(u['page'],u['id']) for u in units if u['protected']}
        if any(x['decision']=='nonclaim' and (x['page'],x['id']) in protected for x in rows):raise ValueError('protected nonclaim')
        # 審査の ok も条件・例外の走査が要る（2026-10-01 対策1）。sol の conditions で足りるときは "conditions":"sol"
        # （そのときは、どれかのモデルが有効な conditions つきで ok を返していること）。
        text={(u['page'],u['id']):u['text'] for u in units};bad={}
        for x in rows:
            if x['decision']!='ok' or not astra_conds:continue
            k=(x['page'],x['id']);c=x.get('conditions')
            if c=='sol':
                err=None if any(per_model[m].get(k,{}).get('result')=='ok' and not conditions_error(per_model[m][k].get('conditions'),text[k]) for m in models) else 'ok without conditions (no sol conditions to reuse)'
            else:err=conditions_error(c,text[k])
            if err:bad[err]=bad.get(err,0)+1
        if bad:raise ValueError('adjudication '+', '.join(f'{k}: {v}' for k,v in sorted(bad.items())))
    except (ValueError,KeyError,TypeError,AttributeError) as e:return stop(r,str(e))
    # 正本外は「別のモデルが誤りと判断しなければ、そのまま残す」（2026-09-30 Masahiro「照合できない主張で正本がない場合は、
    # 書き直すんじゃなくて他のモデルがダメだと思わなければそのままでいいよ」）。
    # 別のモデル = この周の sol と別の sol。一般知識で wrong / not_wrong / unsure を付け、wrong だけを修正対象にする。
    oc=[x for x in rows if x['decision']=='out_of_corpus']
    wrong=[]
    if oc:
        opinion=r/'oc-opinion.json'
        if not opinion.exists() or opinion.stat().st_mtime_ns<verdict.stat().st_mtime_ns:
            text={(u['page'],u['id']):u['text'] for u in units}
            listing=r/'oc-units.json'
            listing.write_text(json.dumps([{'page':x['page'],'id':x['id'],'text':text[(x['page'],x['id'])],'adjudication_reason':x['reason'],'needed_source':x['needed_source']} for x in oc],ensure_ascii=False,indent=1)+'\n')
            template=Path(__file__).resolve().parent/'review_templates/oc_opinion.md'
            prompt=template.read_text().replace('{{LIST}}',str(listing)).replace('{{OUT}}',str(opinion))
            (r/'oc-opinion.prompt.md').write_text(prompt)
            sol=models[0];other='gpt-5.6-sol' if sol=='gpt-6.1-sol' else 'gpt-6.1-sol'
            rc,quota=execute(a.worker,other,prompt,r,r/'oc-opinion.log')
            if rc or quota or not opinion.exists():return stop(r,'second opinion on out_of_corpus incomplete')
        try:
            ops=json.loads(opinion.read_text())['units']
            got={(x['page'],x['id']):x for x in ops}
            if set(got)!={(x['page'],x['id']) for x in oc}:raise ValueError('second opinion IDs incomplete')
            if any(x.get('verdict') not in ('not_wrong','unsure','wrong') or not x.get('reason') for x in ops):raise ValueError('second opinion verdict missing')
        except (OSError,ValueError,KeyError,TypeError) as e:return stop(r,str(e))
        wrong=[x for x in ops if x['verdict']=='wrong']
    unresolved=[x for x in rows if x['decision']=='unresolved']
    # 関門の数え方（2026-10-01 残りの番の対策）: 修正の対象は unresolved 全部＋別モデルが wrong とした正本外（下の stop）。
    # 徹底チェックの通過判定に使う high は「sol（どれかのモデル）も審査も要修正」と言ったものだけ。審査だけの high は次の周の候補。
    # keiri-commander tools/thorough_status.py が同じ規則で数える（gate.json を正本にする）。
    sev={k:[f['severity'] for f in fs] for k,fs in findings_all.items()}
    def severity(x):return x.get('severity') or next(iter(sev.get((x['page'],x['id']),[])),None)
    high=[x for x in unresolved if severity(x)=='high']
    confirmed=[x for x in high if (x['page'],x['id']) in flagged]
    (r/'gate.json').write_text(json.dumps({'sol_models':models,'unresolved':len(unresolved),'unresolved_high':len(confirmed),'unresolved_high_adjudication_only':len(high)-len(confirmed),
        'out_of_corpus':len(oc),'out_of_corpus_judged_wrong':len(wrong),'passed':not unresolved and not wrong,
        'rule':'修正の対象: unresolved 全部と、別モデルが wrong とした正本外。通過判定の high: 審査が high かつ sol のどれかが wrong/unclear'},ensure_ascii=False,indent=2)+'\n')
    if unresolved or wrong:
        return stop(r,f'unresolved findings; fix and review a new snapshot (unresolved {len(unresolved)}, out_of_corpus judged wrong {len(wrong)})')
    if not frozen_ok(r,state):return stop(r,'frozen input changed during Astra')
    tree=state.get('draft_snapshot',{}).get('tree') or subprocess.check_output(['git','-C',str(r/'site'),'rev-parse','HEAD^{tree}'],text=True).strip()
    (r/'review-summary.json').write_text(json.dumps({'status':'reviewed','reviewed_tree':tree,'scope':state['pages'],'unprocessed':0,'unresolved_high':0,'out_of_corpus_kept':len(oc),'sol_models':models,'evidence':str(verdict),'evidence_sha256':digest(verdict)},ensure_ascii=False,indent=2)+'\n')
    (r/'publish-request').write_text('司令塔の検品待ち（未公開）\n'+str(r/'review-summary.json')+'\n')
    (r/'.finished').touch();(r/'STOPPED').unlink(missing_ok=True);return 0
