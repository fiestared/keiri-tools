import argparse
import hashlib
import json
from pathlib import Path
import sys
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import theme_round as runner


class Round(unittest.TestCase):
    def make_round(self,tmp):
        r=Path(tmp)/'round';(r/'batches').mkdir(parents=True);(r/'out').mkdir();(r/'corpus').mkdir()
        pages=['docs/a/index.html','docs/b/index.html']
        (r/'batches/t00').write_text('\n'.join(pages)+'\n')
        (r/'corpus/a.txt').write_text('正本の文章')
        (r/'corpus_desc.md').write_text('テスト正本')
        (r/'sol_theme.md').write_text('{{LIST}} {{OUT}} {{ROUND}} {{R}} {{THEME}} {{DATE}} {{CORPUS}} {{SITE}} {{CORPUS_DESC}} {{BATCH}}')
        (r/'astra_theme.md').write_text('{{R}} {{ROUND}}')
        hashes={str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for name in ['batches/t00','corpus/a.txt','corpus_desc.md','sol_theme.md','astra_theme.md'] for p in [r/name]}
        (r/'run.json').write_text(json.dumps({'theme':'t1','name':'test','round':'t1-fixture','pages':pages,'frozen_hashes':hashes}))
        args=argparse.Namespace(run_dir=r,theme='t1',pages=None,corpus_report=None,root=Path(tmp),repo=Path(tmp),prepare_only=False,check_only=False,worker='must-not-call-real-codex')
        return r,pages,args

    def valid(self,pages):
        return {'pages':[{'page':p,'status':'done','claims_total':1,'ok':1,'wrong':0,'out_of_corpus':0,'unclear':0} for p in pages],
                'claims':[{'page':p,'id':'c1','result':'ok'} for p in pages],'findings':[]}

    def test_green_then_missing_batch_blocks_and_resume(self):
        with tempfile.TemporaryDirectory() as tmp:
            r,pages,a=self.make_round(tmp);out=r/'out/t00.json';out.write_text(json.dumps(self.valid(pages)))
            a.check_only=True
            self.assertEqual(runner.run(a),0) # pristine baseline first
            out.unlink()
            with patch.object(runner,'execute') as worker:
                self.assertEqual(runner.run(a),4);worker.assert_not_called()
            self.assertTrue((r/'STOPPED').exists());self.assertIn('missing_batches=1',(r/'coverage.txt').read_text())
            # Resume only the missing sol batch, then Astra; never publish.
            calls=[]
            def fake(worker,model,prompt,run,log):
                calls.append(model);log.write_text('fixture only')
                if model=='gpt-5.6-sol':out.write_text(json.dumps(self.valid(pages)))
                else:(r/'fixes.md').write_text('Fixture report\nDONE\n')
                return 0,False
            a.check_only=False
            with patch.object(runner,'execute',side_effect=fake):self.assertEqual(runner.run(a),0)
            self.assertEqual(calls,['gpt-5.6-sol','gpt-6-astra']);self.assertFalse((r/'STOPPED').exists());self.assertTrue((r/'publish-request').exists())
            with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(a),0);worker.assert_not_called()

    def test_failed_sol_output_is_not_in_astra_input_glob(self):
        with tempfile.TemporaryDirectory() as tmp:
            r,pages,a=self.make_round(tmp)
            def fail(worker,model,prompt,run,log):
                (r/'out/t00.json').write_text(json.dumps(self.valid(pages)))
                return 1,True
            with patch.object(runner,'execute',side_effect=fail) as worker:
                self.assertEqual(runner.run(a),4)
                self.assertEqual(worker.call_count,1)
            self.assertEqual(list((r/'out').glob('t*.json')),[])
            self.assertEqual(len(list((r/'failed').glob('*.json'))),1)
            def resume(worker,model,prompt,run,log):
                if model=='gpt-5.6-sol':(r/'out/t00.json').write_text(json.dumps(self.valid(pages)))
                else:
                    self.assertEqual(len(list((r/'out').glob('t*.json'))),1)
                    (r/'fixes.md').write_text('New report\nDONE\n')
                return 0,False
            with patch.object(runner,'execute',side_effect=resume):self.assertEqual(runner.run(a),0)

    def test_partial_duplicate_counts_and_input_mutation(self):
        with tempfile.TemporaryDirectory() as tmp:
            r,pages,a=self.make_round(tmp);out=r/'out/t00.json';valid=self.valid(pages);out.write_text(json.dumps(valid))
            self.assertTrue(runner.batch_valid(out,pages))
            valid['pages'][0]['status']='partial';out.write_text(json.dumps(valid));self.assertFalse(runner.batch_valid(out,pages))
            valid=self.valid(pages);valid['claims'].append(valid['claims'][0]);out.write_text(json.dumps(valid));self.assertFalse(runner.batch_valid(out,pages))
            valid=self.valid(pages);valid['pages'][0]['ok']=9;out.write_text(json.dumps(valid));self.assertFalse(runner.batch_valid(out,pages))
            (r/'corpus/a.txt').write_text('壊した正本')
            with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(a),4);worker.assert_not_called()

    def test_quota_stops_and_completed_sol_not_repeated(self):
        with tempfile.TemporaryDirectory() as tmp:
            r,pages,a=self.make_round(tmp);out=r/'out/t00.json';out.write_text(json.dumps(self.valid(pages)))
            with patch.object(runner,'execute',return_value=(1,True)) as worker:
                self.assertEqual(runner.run(a),4);self.assertEqual(worker.call_args.args[1],'gpt-6-astra');self.assertEqual(worker.call_count,1)
            self.assertFalse((r/'.finished').exists());self.assertTrue((r/'STOPPED').exists())

    def test_prepare_uses_new_snapshot_and_only_impact_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);repo=root/'repo';repo.mkdir();legacy=root/'legacy';(legacy/'t1/corpus').mkdir(parents=True)
            (legacy/'t1/corpus/a.txt').write_text('旧版の文章')
            (legacy/'t1/corpus/a.html').write_text('<p>旧版の文章</p>')
            (legacy/'sol_theme.md').write_text('{{CORPUS}} {{LIST}} {{OUT}}')
            (legacy/'astra_theme.md').write_text('{{R}}')
            (repo/'tools').mkdir();(repo/'docs/a').mkdir(parents=True);(repo/'docs/a/index.html').write_text('<p>主張</p>')
            source={'id':'a','url':'https://www.nta.go.jp/a','themes':['t1'],'local_raw':'t1/corpus/a.html','local_text':'t1/corpus/a.txt','format':'html'}
            (repo/'tools/source_registry.json').write_text(json.dumps({'themes':{'t1':'fixture'},'sources':[source]}))
            def git(*args):subprocess.run(['git','-C',str(repo),*args],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            git('init','-q','--initial-branch=main');git('add','docs/a/index.html','tools/source_registry.json')
            git('-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','fixture')
            git('remote','add','origin',str(repo))
            snapshot=root/'snapshot';(snapshot/'a').mkdir(parents=True)
            raw='<p>新しい正本の文章</p>'.encode();text='新しい正本の文章\n'
            (snapshot/'a/original.html').write_bytes(raw);(snapshot/'a/text.txt').write_text(text)
            report=root/'impact.json';report.write_text(json.dumps({'theme':'t1','snapshot':str(snapshot),'errors':[],
                'sources':[{'id':'a','status':'ok','raw_sha256':hashlib.sha256(raw).hexdigest(),'text_sha256':hashlib.sha256(text.encode()).hexdigest()}],
                'quote_missing':[{'page':'docs/a/index.html','id':'c1'}]}))
            r=root/'new-round';a=argparse.Namespace(run_dir=r,theme='t1',pages=report,corpus_report=None,root=legacy,repo=repo,prepare_only=True,check_only=False,worker='must-not-call-codex')
            with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(a),0);worker.assert_not_called()
            self.assertEqual((r/'corpus/a.txt').read_text(),text)
            self.assertEqual((r/'pages_full.txt').read_text(),'docs/a/index.html\n')
            self.assertEqual((legacy/'t1/corpus/a.txt').read_text(),'旧版の文章')
            # Baseline succeeds first; a tampered new snapshot cannot start a review.
            (snapshot/'a/text.txt').write_text('破損')
            a.run_dir=root/'bad-round'
            with patch.object(runner,'execute') as worker:self.assertEqual(runner.run(a),4);worker.assert_not_called()
            self.assertIn('snapshot hash mismatch',(a.run_dir/'STOPPED').read_text())

    def test_stale_done_cannot_complete_a_new_attempt(self):
        with tempfile.TemporaryDirectory() as tmp:
            r,pages,a=self.make_round(tmp)
            (r/'out/t00.json').write_text(json.dumps(self.valid(pages)))
            (r/'fixes.md').write_text('Old report\nDONE\n')
            with patch.object(runner,'execute',return_value=(0,False)):
                self.assertEqual(runner.run(a),4)
            self.assertFalse((r/'.finished').exists())
            self.assertFalse((r/'publish-request').exists())

    def test_impact_pages_and_empty_scope(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'impact.json';p.write_text(json.dumps({'quote_missing':[{'page':'docs/b/index.html'},{'page':'docs/a/index.html'},{'page':'docs/a/index.html'}]}))
            self.assertEqual(runner.pages_from(p),['docs/a/index.html','docs/b/index.html'])
            p.write_text(json.dumps({'errors':[{'error':'offline'}],'quote_missing':[]}))
            with self.assertRaises(ValueError):runner.pages_from(p)
            p.write_text('{}')
            with self.assertRaises(ValueError):runner.pages_from(p)
            p.write_text(json.dumps({'quote_missing':[{'page':'../../oops'}]}))
            with self.assertRaises(ValueError):runner.pages_from(p)

if __name__=='__main__':unittest.main()
