import argparse,copy,hashlib,importlib.util,importlib.machinery,json,os
from pathlib import Path
import subprocess,sys,tempfile,unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
import theme_segments as units
import theme_round as runner

def writable(root):
    for p in [root,*root.rglob('*')]:
        if p.is_dir():p.chmod(0o755)
        elif p.is_file():p.chmod(0o644)

class Units(unittest.TestCase):
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

    def outputs(self,r):
        for b in (r/'segment-batches').glob('*.json'):
            data=json.loads(b.read_text());rows=[{**u,'claim_id':'c-'+u['id'],'result':'ok','corpus_ref':'corpus/a.txt:1','corpus_quote':'会社が対象です。'} for u in data]
            (r/'out'/(b.stem+'.json')).write_text(json.dumps({'segments':rows,'findings':[]}))

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
                for change in ('missing','unknown','no-verdict','wrong-no-finding','bad-quote','protected-nonclaim'):
                    d=copy.deepcopy(data)
                    if change=='missing':d['segments'].pop()
                    elif change=='unknown':d['segments'][0]['id']='unknown'
                    elif change=='no-verdict':d['segments'][0].pop('result')
                    elif change=='wrong-no-finding':d['segments'][0]['result']='wrong'
                    elif change=='bad-quote':d['segments'][0]['corpus_quote']='正本に存在しない引用'
                    else:
                        target=next(x for x in d['segments'] if x['protected']);target.update(result='nonclaim',why='案内')
                    out.write_text(json.dumps(d))
                    with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(a),4,change);worker.assert_not_called()
                out.write_text(original);self.assertEqual(runner.run(a),0)
                # Strict resume and independent Astra stub. Zero actual model invocations.
                a.check_only=False;calls=[]
                def fake(worker,model,prompt,r,log):
                    calls.append(model)
                    rows=[{'page':u['page'],'id':u['id'],'decision':'ok','reason':'fixture reviewed corpus/a.txt:1'} for u in json.loads((r/'segments.json').read_text())]
                    (r/'segment-adjudication.json').write_text(json.dumps({'segments':rows}));(r/'fixes.md').write_text('fixture only\nDONE\n');return 0,False
                with patch.object(runner,'execute',side_effect=fake):self.assertEqual(runner.run(a),0)
                self.assertEqual(calls,['gpt-6-astra']);review=json.loads((r/'review-summary.json').read_text())
                git('add','docs/a/index.html','docs/b/index.html');self.assertEqual(git('write-tree'),review['reviewed_tree'])
            finally:writable(root)

    def test_snapshot_change_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root,repo,a,git=self.fixture(tmp)
            try:
                self.assertEqual(runner.run(a),0);self.outputs(a.run_dir);a.prepare_only=False;a.check_only=True;self.assertEqual(runner.run(a),0)
                p=a.run_dir/'site/docs/a/index.html';p.chmod(0o644);p.write_text('changed')
                with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(a),4);worker.assert_not_called()
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
            self.assertFalse(qp(run,'corpus/a.txt:11','短時間労働者も加入します。'))              # 参照していない別ファイルの文
            self.assertFalse(qp(run,'corpus/a.txt:11; corpus/b.txt:1','会社が対象です。\n正本に存在しない文です'))  # 断片の1つが正本に無い
            self.assertFalse(qp(run,'corpus/c.png:1','会社が対象です。'))                        # 画像
            self.assertFalse(qp(run,'corpus/a.txt','会社が対象です。'))                           # 行番号の無い参照は書式違反

if __name__=='__main__':unittest.main()
