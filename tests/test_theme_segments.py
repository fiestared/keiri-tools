import argparse,copy,hashlib,importlib.util,importlib.machinery,json,os
from pathlib import Path
import re,subprocess,sys,tempfile,unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
import theme_segments as units
import theme_round as runner

def writable(root):
    for p in [root,*root.rglob('*')]:
        if p.is_dir():p.chmod(0o755)
        elif p.is_file():p.chmod(0o644)

class Base(unittest.TestCase):
    def fixture(self,tmp):
        root=Path(tmp);repo=root/'repo';repo.mkdir();(repo/'docs/a').mkdir(parents=True)
        (repo/'docs/a/index.html').write_text('<title>対象</title><p>会社が対象。</p>')
        def git(*args):return subprocess.check_output(['git','-C',str(repo),*args],text=True,stderr=subprocess.DEVNULL).strip()
        git('init','-q','--initial-branch=main');git('add','docs/a/index.html');git('-c','user.name=fixture','-c','user.email=f@example.test','commit','-qm','baseline')
        # Both an edited tracked page and a new untracked page must be copied, without committing source.
        (repo/'docs/a/index.html').write_text('<title>対象</title><h1>範囲</h1><p>会社が対象です。</p><h2>手続</h2>'+''.join(f'<p>確認単位{i}。</p>' for i in range(43)))
        (repo/'docs/b').mkdir();(repo/'docs/b/index.html').write_text('<p>新規記事。</p>')
        legacy=root/'legacy';(legacy/'t1/corpus').mkdir(parents=True);(legacy/'t1/corpus/a.txt').write_text('会社が対象です。')
        for name in ('sol_theme.md','astra_theme.md'):(legacy/name).write_text('fixture')
        templates=ROOT/'tools/review_templates'
        for name in ('sol_segments.md','astra_segments.md'):(legacy/name).write_text((templates/name).read_text())
        pages=root/'pages.txt';pages.write_text('docs/a/index.html\ndocs/b/index.html\n')
        registry=root/'registry.json';registry.write_text(json.dumps({'themes':{'t1':'fixture'},'sources':[]}))
        a=argparse.Namespace(run_dir=root/'round',theme='t1',pages=pages,corpus_report=None,root=legacy,repo=ROOT,prepare_only=True,check_only=False,worker='never-real-model',segments=True,draft_worktree=repo,registry=registry,corpus_dir=None)
        return root,repo,a,git

    COND=[{'condition':'同じ条にただし書・注・別区分なし','corpus_ref':'corpus/a.txt:1','covered':'irrelevant'}]
    def outputs(self,r,model=None,conditions=True,wrong=()):
        for b in (r/'segment-batches').glob('*.json'):
            data=json.loads(b.read_text());rows=[{**u,'claim_id':'c-'+u['id'],'result':'ok','corpus_ref':'corpus/a.txt:1','corpus_quote':'会社が対象です。',**({'conditions':self.COND} if conditions else {})} for u in data]
            findings=[]
            for row in rows:
                if row['id'] in wrong:row['result']='wrong';row.pop('conditions',None);findings.append({'page':row['page'],'segment_id':row['id'],'severity':'high','reason':'fixture'})
            out=r/'out'/(model or '')/(b.stem+'.json');out.parent.mkdir(exist_ok=True)
            out.write_text(json.dumps({'segments':rows,'findings':findings}))


class Units(Base):
    def test_draft_pristine_then_missing_unknown_findings_and_no_astra(self):
        with tempfile.TemporaryDirectory() as tmp:
            root,repo,a,git=self.fixture(tmp)
            try:
                before=units.files(repo);status=git('status','--porcelain');head=git('rev-parse','HEAD')
                with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(a),0);worker.assert_not_called()
                r=a.run_dir;self.assertEqual(units.files(repo),before);self.assertEqual(git('status','--porcelain'),status);self.assertEqual(git('rev-parse','HEAD'),head)
                self.assertEqual((r/'site/docs/b/index.html').read_text(),'<p>新規記事。</p>')
                batches=sorted((r/'segment-batches').glob('*.json'));self.assertTrue(all(20<=len(json.loads(b.read_text()))<=40 for b in batches))
                self.outputs(r);a.prepare_only=False;a.check_only=True
                self.assertEqual(runner.run(a),0) # actual frozen draft and complete response pristine green
                out=r/'out'/(batches[0].stem+'.json');original=out.read_text();data=json.loads(original)
                for change in ('missing','unknown','no-verdict','wrong-no-finding','bad-quote','protected-nonclaim','ok-no-conditions','ok-empty-conditions','ok-uncovered-condition','ok-bad-condition'):
                    d=copy.deepcopy(data)
                    if change=='missing':d['segments'].pop()
                    elif change=='unknown':d['segments'][0]['id']='unknown'
                    elif change=='no-verdict':d['segments'][0].pop('result')
                    elif change=='wrong-no-finding':d['segments'][0]['result']='wrong'
                    elif change=='bad-quote':d['segments'][0]['corpus_quote']='正本に存在しない引用'
                    elif change=='ok-no-conditions':d['segments'][0].pop('conditions')
                    elif change=='ok-empty-conditions':  # 境界・対象者を含む単位は空の走査で ok にできない
                        target=next(x for x in d['segments'] if units.needs_conditions(x['text']));target['conditions']=[]
                    elif change=='ok-uncovered-condition':d['segments'][0]['conditions']=[{'condition':'ただし書: 派遣は除く','corpus_ref':'corpus/a.txt:1','covered':'no'}]
                    elif change=='ok-bad-condition':d['segments'][0]['conditions']=[{'condition':'','corpus_ref':'corpus/a.txt:1','covered':'yes'}]
                    else:
                        target=next(x for x in d['segments'] if x['protected']);target.update(result='nonclaim',why='案内')
                    out.write_text(json.dumps(d))
                    with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(a),4,change);worker.assert_not_called()
                out.write_text(original);self.assertEqual(runner.run(a),0)
                # Strict resume and independent Astra stub. Zero actual model invocations.
                a.check_only=False;calls=[]
                def fake(worker,model,prompt,r,log):
                    calls.append(model)
                    rows=[{'page':u['page'],'id':u['id'],'decision':'ok','reason':'fixture reviewed corpus/a.txt:1','conditions':'sol'} for u in json.loads((r/'segments.json').read_text())]
                    (r/'segment-adjudication.json').write_text(json.dumps({'segments':rows}));(r/'fixes.md').write_text('fixture only\nDONE\n');return 0,False
                with patch.object(runner,'execute',side_effect=fake):self.assertEqual(runner.run(a),0)
                self.assertEqual(calls,['gpt-6-astra']);review=json.loads((r/'review-summary.json').read_text())
                git('add','docs/a/index.html','docs/b/index.html');self.assertEqual(git('write-tree'),review['reviewed_tree'])
            finally:writable(root)

    def test_out_of_corpus_kept_unless_second_model_says_wrong(self):
        # 2026-09-30 Masahiro: 正本外は別モデルが誤りと判断しなければそのまま残す
        for case in ('not_wrong','unsure','wrong','incomplete'):
            with tempfile.TemporaryDirectory() as tmp:
                root,repo,a,git=self.fixture(tmp)
                try:
                    with patch.object(runner,'execute'):runner.run(a)
                    r=a.run_dir;self.outputs(r);a.prepare_only=False;a.check_only=False;calls=[]
                    def fake(worker,model,prompt,rr,log):
                        calls.append(model);us=json.loads((rr/'segments.json').read_text())
                        if model=='gpt-6-astra':
                            rows=[{'page':u['page'],'id':u['id'],'decision':'ok','reason':'fixture corpus/a.txt:1','conditions':'sol'} for u in us]
                            rows[0].update(decision='out_of_corpus',needed_source='資料X')
                            (rr/'segment-adjudication.json').write_text(json.dumps({'segments':rows}));(rr/'fixes.md').write_text('fixture\nDONE\n')
                        else:
                            listed=json.loads((rr/'oc-units.json').read_text());self.assertEqual(len(listed),1)
                            ops=[{'page':x['page'],'id':x['id'],'verdict':case if case!='incomplete' else 'not_wrong','reason':'fixture'} for x in listed]
                            if case=='incomplete':ops=[]
                            (rr/'oc-opinion.json').write_text(json.dumps({'units':ops}))
                        return 0,False
                    # Pin the primary reviewer so this fixture is independent of the caller's environment.
                    with patch.dict(os.environ, {'KEIRI_SOL_MODEL':'gpt-6.1-sol'}), patch.object(runner,'execute',side_effect=fake):rc=runner.run(a)
                    self.assertEqual(calls,['gpt-6-astra','gpt-5.6-sol'],case)
                    if case in ('not_wrong','unsure'):
                        self.assertEqual(rc,0,case);self.assertEqual(json.loads((r/'review-summary.json').read_text())['out_of_corpus_kept'],1)
                    else:
                        self.assertEqual(rc,4,case);self.assertFalse((r/'review-summary.json').exists(),case)
                        stopped=(r/'STOPPED').read_text()
                        self.assertIn('unresolved findings' if case=='wrong' else 'second opinion IDs incomplete',stopped,case)
                finally:writable(root)

    def test_snapshot_change_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root,repo,a,git=self.fixture(tmp)
            try:
                self.assertEqual(runner.run(a),0);self.outputs(a.run_dir);a.prepare_only=False;a.check_only=True;self.assertEqual(runner.run(a),0)
                p=a.run_dir/'site/docs/a/index.html';p.chmod(0o644);p.write_text('changed')
                with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(a),4);worker.assert_not_called()
            finally:writable(root)

class OnePass(Base):
    """2026-10-01 対策1〜4（gbrain audits/keiri-why-not-one-pass-2026-10-01）。各ケースは無傷が緑を確かめてから1か所だけ壊す。"""
    def adjudicate(self,rr,conditions='sol',high_ids=(),oc_first=False):
        us=json.loads((rr/'segments.json').read_text())
        rows=[{'page':u['page'],'id':u['id'],'decision':'ok','reason':'fixture corpus/a.txt:1','conditions':conditions} for u in us]
        for x in rows:
            if x['id'] in high_ids:x.update(decision='unresolved',severity='high');x.pop('conditions')
        (rr/'segment-adjudication.json').write_text(json.dumps({'segments':rows}));(rr/'fixes.md').write_text('fixture\nDONE\n')

    def dual(self,tmp,wrong_by=None,adj_high=(),adj_conditions='sol'):
        root,repo,a,git=self.fixture(tmp)
        with patch.object(runner,'execute'):runner.run(a)
        r=a.run_dir;a.prepare_only=False;a.sol_models='gpt-6.1-sol,gpt-5.6-sol';calls=[];lock=__import__('threading').Lock()
        ids=[u['id'] for u in json.loads((r/'segments.json').read_text())]
        def fake(worker,model,prompt,rr,log):
            with lock:calls.append(model)
            if model=='gpt-6-astra':self.adjudicate(rr,adj_conditions,[ids[i] for i in adj_high]);return 0,False
            out=Path(re.search(r'出力=(\S+?\.json)',prompt).group(1));batch=json.loads(Path(re.search(r'束=(\S+?\.json)',prompt).group(1)).read_text())
            rows=[{**u,'claim_id':'c','result':'ok','corpus_ref':'corpus/a.txt:1','corpus_quote':'会社が対象です。','conditions':self.COND} for u in batch];findings=[]
            for row in rows:
                if wrong_by and model==wrong_by[0] and row['id']==ids[wrong_by[1]]:
                    row['result']='wrong';findings.append({'page':row['page'],'segment_id':row['id'],'severity':'high','reason':'fixture'})
            out.write_text(json.dumps({'segments':rows,'findings':findings}));return 0,False
        with patch.object(runner,'execute',side_effect=fake):rc=runner.run(a)
        return root,r,rc,calls,ids

    def test_dual_sol_union_and_gate(self):
        import re as _re;globals()['re']=_re
        with tempfile.TemporaryDirectory() as tmp:
            # 無傷: 2モデルとも全束を照合し、審査が和集合を見て通る
            root,r,rc,calls,ids=self.dual(tmp)
            try:
                self.assertEqual(rc,0)
                self.assertEqual(sorted(set(calls)),['gpt-5.6-sol','gpt-6-astra','gpt-6.1-sol'])
                self.assertEqual(calls.count('gpt-6.1-sol'),calls.count('gpt-5.6-sol'));self.assertEqual(calls[-1],'gpt-6-astra')
                self.assertTrue(list((r/'out/gpt-5.6-sol').glob('s*.json')) and list((r/'out').glob('s*.json')))
                self.assertEqual(json.loads((r/'sol-models.json').read_text()),['gpt-6.1-sol','gpt-5.6-sol'])
                self.assertEqual(json.loads((r/'review-summary.json').read_text())['sol_models'],['gpt-6.1-sol','gpt-5.6-sol'])
                self.assertTrue(json.loads((r/'gate.json').read_text())['passed'])
            finally:writable(root)
        with tempfile.TemporaryDirectory() as tmp:
            # 2本目だけが指摘した単位も和集合に入り、審査が high にすれば通過判定の high に数える
            root,r,rc,calls,ids=self.dual(tmp,wrong_by=('gpt-5.6-sol',1),adj_high=(1,2))
            try:
                self.assertEqual(rc,4);u=json.loads((r/'sol-union.json').read_text())
                hit=next(x for x in u if x['id']==ids[1]);self.assertEqual(hit['results'],{'gpt-6.1-sol':'ok','gpt-5.6-sol':'wrong'});self.assertEqual(hit['findings'][0]['model'],'gpt-5.6-sol')
                g=json.loads((r/'gate.json').read_text())
                # 単位1は sol(5.6)も審査も要修正＝high。単位2は審査だけ＝次の周の候補（修正の対象には入る）
                self.assertEqual((g['unresolved'],g['unresolved_high'],g['unresolved_high_adjudication_only']),(2,1,1))
                self.assertIn('unresolved findings',(r/'STOPPED').read_text())
            finally:writable(root)

    def test_adjudication_ok_needs_conditions(self):
        import re as _re;globals()['re']=_re
        for conds,ok in (('sol',True),([{'condition':'注: 派遣は除く','corpus_ref':'corpus/a.txt:1','covered':'yes'}],True),(None,False),([],False),
                         ([{'condition':'注: 派遣は除く','corpus_ref':'corpus/a.txt:1','covered':'no'}],False)):
            with tempfile.TemporaryDirectory() as tmp:
                root,r,rc,calls,ids=self.dual(tmp,adj_conditions=conds)
                try:
                    self.assertEqual(rc,0 if ok else 4,conds)
                    if not ok:self.assertIn('adjudication ok with',(r/'STOPPED').read_text())
                finally:writable(root)

    def test_old_template_run_resumes_without_conditions(self):
        # 2026-10-01 以前に固定した run（ひな形に conditions が無い）を再開しても、旧形式の出力を未処理にしない
        with tempfile.TemporaryDirectory() as tmp:
            root,repo,a,git=self.fixture(tmp)
            try:
                with patch.object(runner,'execute'):runner.run(a)
                r=a.run_dir;state=json.loads((r/'run.json').read_text())
                for name in ('sol_segments.md','astra_segments.md'):  # 固定済みの旧ひな形（conditions の語が無い）
                    (r/name).write_text('旧ひな形 fixture');state['frozen_hashes'][name]=units.digest(r/name)
                (r/'run.json').write_text(json.dumps(state))
                self.assertEqual(runner.run(argparse.Namespace(**{**vars(a),'prepare_only':False,'check_only':True})),4)  # 旧ひな形でも出力が無ければ未処理
                self.outputs(r,conditions=False);a.prepare_only=False;a.check_only=True
                with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(a),0);worker.assert_not_called()
            finally:writable(root)

    def test_resume_with_other_models_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root,repo,a,git=self.fixture(tmp)
            try:
                with patch.object(runner,'execute'):runner.run(a)
                r=a.run_dir;self.outputs(r);a.prepare_only=False;a.check_only=True
                with patch.dict(os.environ,{'KEIRI_SOL_MODEL':'gpt-6.1-sol'}):self.assertEqual(runner.run(a),0)
                a.sol_models='gpt-6.1-sol,gpt-5.6-sol'
                with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(a),4);worker.assert_not_called()
                self.assertIn('resume sol models differ',(r/'STOPPED').read_text())
            finally:writable(root)

    def test_changed_since_rereviews_units_whose_local_context_changed(self):
        # 2026-10-09 局所文脈: 本文が同じでも、添えた文脈（表の前提）が変わったセルは照合し直す。前の run が旧出力なら従来どおり本文だけ
        with tempfile.TemporaryDirectory() as tmp:
            root,repo,a,git=self.fixture(tmp)
            try:
                p=repo/'docs/a/index.html';table='<table><tr><th>寄附額</th><th>控除</th></tr><tr><td>80,000円</td><td>58,621円</td></tr></table>'
                p.write_text(p.read_text()+'<p>両税率5％の算術例です。</p>'+table+'<h2>別</h2><p>前置き。</p><table><tr><th>年</th><th>額</th></tr><tr><td>1年目</td><td>100円</td></tr></table>')
                with patch.object(runner,'execute'):self.assertEqual(runner.run(a),0)
                prev=a.run_dir;before=json.loads((prev/'segments.json').read_text())
                self.assertTrue(all('context_hash' in u and u['context_hash'] is None for u in before))
                # 無傷: 何も変えなければ0単位
                b=argparse.Namespace(**{**vars(a),'run_dir':root/'recheck','changed_since':prev,'prepare_only':False})
                with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(b),0);worker.assert_not_called()
                # 表の直前の段落に印を付ける（どの単位の本文も変わらない）→ その表のセルだけが照合の対象。別の表・段落自身は対象外
                p.write_text(p.read_text().replace('<p>両税率5％の算術例です。</p>','<p data-review-context="before-table">両税率5％の算術例です。</p>'))
                c=argparse.Namespace(**{**vars(a),'run_dir':root/'recheck2','changed_since':prev,'prepare_only':True})
                with patch.object(runner,'execute'):self.assertEqual(runner.run(c),0)
                got=json.loads((root/'recheck2/segments.json').read_text())
                self.assertEqual(sorted(u['text'] for u in got),sorted(['寄附額','控除','80,000円','【行】80,000円 【列】控除 【値】58,621円']))
                self.assertTrue(all(u['context']=='【表の直前の説明】両税率5％の算術例です。' for u in got))
                self.assertEqual({u['id'] for u in got}-{u['id'] for u in before},set())
                # 前提の文を書き換える → 段落自身（本文が変わった）と、その表のセル（文脈が変わった）
                p.write_text(p.read_text().replace('両税率5％の算術例です。','両税率10％の算術例です。'))
                d=argparse.Namespace(**{**vars(a),'run_dir':root/'recheck3','changed_since':root/'recheck2','prepare_only':True})
                # recheck2 は変わった単位だけの segments.json。別の表・ほかの段落は「前に無い」ので対象に入る（従来どおりの保守的な挙動）
                with patch.object(runner,'execute'):self.assertEqual(runner.run(d),0)
                got3=json.loads((root/'recheck3/segments.json').read_text())
                self.assertIn('両税率10％の算術例です。',[u['text'] for u in got3])
                self.assertIn('【行】80,000円 【列】控除 【値】58,621円',[u['text'] for u in got3])
                # 前の run が文脈より前の出力（context_hash の欄が無い）なら本文だけで比べる＝印を足しただけでは0単位
                old=root/'old';old.mkdir();(old/'segments.json').write_text(json.dumps([{k:v for k,v in u.items() if k not in ('context','context_hash')} for u in before]))
                p.write_text(p.read_text().replace('両税率10％の算術例です。','両税率5％の算術例です。'))
                e=argparse.Namespace(**{**vars(a),'run_dir':root/'recheck4','changed_since':old,'prepare_only':False})
                with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(e),0);worker.assert_not_called()
                self.assertIn('no changed units',(root/'recheck4/.finished').read_text())
            finally:writable(root)

    def test_changed_since_reviews_only_changed_units(self):
        with tempfile.TemporaryDirectory() as tmp:
            root,repo,a,git=self.fixture(tmp)
            try:
                with patch.object(runner,'execute'):self.assertEqual(runner.run(a),0)
                prev=a.run_dir
                # 無傷: 本文が変わっていなければ照合する単位は0で、モデルを呼ばずに通過
                b=argparse.Namespace(**{**vars(a),'run_dir':root/'recheck','changed_since':prev,'prepare_only':False})
                with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(b),0);worker.assert_not_called()
                self.assertIn('no changed units',(root/'recheck/.finished').read_text())
                # 壊し: 1文だけ変える → その単位だけが照合の対象
                p=repo/'docs/a/index.html';p.write_text(p.read_text().replace('確認単位7。','確認単位7は年収130万円以上です。'))
                c=argparse.Namespace(**{**vars(a),'run_dir':root/'recheck2','changed_since':prev,'prepare_only':True})
                with patch.object(runner,'execute'):self.assertEqual(runner.run(c),0)
                got=json.loads((root/'recheck2/segments.json').read_text())
                self.assertEqual([u['text'] for u in got],['確認単位7は年収130万円以上です。'])
            finally:writable(root)


class QuoteRefFormats(unittest.TestCase):
    """2026-09-29 r13 実測: sol は複数の正本・複数の範囲をまとめて書き、行番号もずれる。
    受け付けるのは「参照したファイルに逐語で在る」引用だけ。別ファイル・画像・正本に無い文は不成立。"""
    def test_formats(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as d:
            run=Path(d);(run/'corpus').mkdir()
            (run/'corpus/a.txt').write_text('一行目\n\n\n\n\n\n\n\n\n\n会社が対象です。\n')
            (run/'corpus/b.txt').write_text('短時間労働者も加入します。\n')
            (run/'corpus/c.png').write_bytes(b'\x89PNG\r\n')
            qp=units.quote_present
            self.assertTrue(qp(run,'corpus/a.txt:11','会社が対象です。'))                       # 無傷
            self.assertTrue(qp(run,'corpus/a.txt:1','会社が対象です。'))                        # 行番号のずれ
            self.assertTrue(qp(run,'corpus/a.txt:1-2,11; corpus/b.txt:1','会社が対象です。\n短時間労働者も加入します。'))  # 複数の正本・範囲・断片
            self.assertTrue(qp(run,'corpus/a.txt:11;corpus/b.txt:1','会社が対象です。;短時間労働者も加入します。'))   # ; でつないだ引用（Grok）
            self.assertTrue(qp(run,'corpus/a.txt:11;corpus/b.txt:1','会社が対象です。 / 短時間労働者も加入します。'))  # 「 / 」でつないだ引用（Claude）
            self.assertFalse(qp(run,'corpus/a.txt:11;corpus/b.txt:1','会社が対象です。 / 正本に存在しない文です'))    # 「 / 」でも断片ごとに逐語を求める
            self.assertFalse(qp(run,'corpus/a.txt:11','短時間労働者も加入します。'))              # 参照していない別ファイルの文
            self.assertFalse(qp(run,'corpus/a.txt:11; corpus/b.txt:1','会社が対象です。\n正本に存在しない文です'))  # 断片の1つが正本に無い
            self.assertFalse(qp(run,'corpus/c.png:1','会社が対象です。'))                        # 画像
            self.assertFalse(qp(run,'corpus/a.txt','会社が対象です。'))                           # 行番号の無い参照は書式違反
            self.assertTrue(qp(run,'corpus/a.txt:11;corpus/b.txt:1',['会社が対象です。','短時間労働者も加入します。']))   # 配列の引用（2026-10-05 Opus）
            self.assertFalse(qp(run,'corpus/a.txt:11',['会社が対象です。','正本に存在しない文です']))           # 配列でも断片ごとに逐語
            (run/'corpus/d.csv').write_bytes('基準日,基準価額(円)\n2026/09/30,13022\n'.encode('cp932'))
            self.assertTrue(qp(run,'corpus/d.csv:2','2026/09/30,13022'))                           # Shift_JIS の CSV（2026-10-03）
            self.assertTrue(qp(run,'corpus/d.csv:1','基準日,基準価額(円)'))
            self.assertFalse(qp(run,'corpus/d.csv:2','2026/09/30,99999'))                          # CSV でも逐語でなければ不成立
            import json as _j
            (run/'corpus/law.json').write_text(_j.dumps({'law':{'Sentence':['市町村は指定しなければならない。','この場合においては通知する。']}},ensure_ascii=False))
            self.assertTrue(qp(run,'corpus/law.json:1','指定しなければならない。この場合において'))   # JSON の文の区切りをまたぐ引用（e-Gov・2026-10-04）
            self.assertFalse(qp(run,'corpus/law.json:1','指定しなければならない。その場合において'))  # つないでも逐語でなければ不成立
            (run/'corpus/egov.json').write_text(_j.dumps({'tag':'Paragraph','attr':{'Num':'2'},'children':[{'tag':'Sentence','attr':{'Num':'1'},'children':['定めなければならない。']},{'tag':'Sentence','attr':{'Num':'2'},'children':['この場合において通知する。']}]},ensure_ascii=False))
            self.assertTrue(qp(run,'corpus/egov.json:1','定めなければならない。この場合において'))   # e-Gov v2 の tag・attr を本文に混ぜない

class CoveredValue(unittest.TestCase):
    """covered は先頭の語で読む（理由書きつきを許す）。条件なし・未被覆・知らない値は従来どおり落とす（2026-10-02）。"""
    def test_covered_with_reason_is_accepted_and_others_still_fail(self):
        text='月額8.8万円以上が要件です。'
        cond=lambda v:[{'condition':'ただし書: 学生は除く','corpus_ref':'corpus/a.txt:1','covered':v}]
        for v in ('yes','irrelevant','irrelevant（単位は一般的な方向だけを述べる）','yes (同じ文に記載)','irrelevant: 別区分','yes、表の行に記載'):
            self.assertIsNone(units.conditions_error(cond(v),text),v)
        for v in ('no','no（書いていない）','no: 例外の記載なし'):
            self.assertEqual(units.conditions_error(cond(v),text),'ok with uncovered condition',v)
        for v in ('','maybe','not yes','yesterday','none','irrelevantish',None,'（irrelevant）'):
            self.assertEqual(units.conditions_error(cond(v),text),'ok without conditions',repr(v))
        self.assertEqual(units.conditions_error([],text),'ok without conditions')
        self.assertEqual(units.conditions_error(None,text),'ok without conditions')
        self.assertEqual(units.conditions_error([{'condition':'','corpus_ref':'corpus/a.txt:1','covered':'yes（理由）'}],text),'ok without conditions')
        self.assertEqual(units.conditions_error([{'condition':'注','corpus_ref':'','covered':'irrelevant（理由）'}],text),'ok without conditions')

if __name__=='__main__':unittest.main()
