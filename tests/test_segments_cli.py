import json,os,shutil,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class CLI(unittest.TestCase):
 def test_existing_warning_new_ledger_gate_and_strict(self):
  with tempfile.TemporaryDirectory() as tmp:
   repo=Path(tmp);(repo/'tools').mkdir();(repo/'claims').mkdir();(repo/'docs/old').mkdir(parents=True)
   for name in ('check_claims.mjs','segment_claims.mjs','claims_sources.json'):shutil.copy2(ROOT/'tools'/name,repo/'tools'/name)
   modules=next(p/'node_modules' for p in ROOT.parents if (p/'node_modules/jsdom').exists());(repo/'node_modules').symlink_to(modules,target_is_directory=True)
   page=repo/'docs/old/index.html';page.write_text('<title>説明</title><p>この条件だけです。</p>')
   (repo/'claims/old.json').write_text(json.dumps({'claims':[]}))
   def git(*args):subprocess.run(['git','-C',str(repo),*args],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
   (repo/'docs/no-ledger').mkdir();(repo/'docs/no-ledger/index.html').write_text(page.read_text())
   git('init','-q','--initial-branch=main');git('add','docs/old/index.html','docs/no-ledger/index.html','claims/old.json');git('-c','user.name=fixture','-c','user.email=f@example.test','commit','-qm','baseline');git('update-ref','refs/remotes/origin/main','HEAD')
   def check(*args,strict=False):
    env=dict(os.environ);env['SEGMENTS_STRICT']='1' if strict else '0'
    return subprocess.run(['node','tools/check_claims.mjs','--segments',*args],cwd=repo,env=env,capture_output=True,text=True)
   self.assertEqual(check('docs/old/index.html').returncode,0)
   self.assertEqual(check('docs/no-ledger/index.html').returncode,0)
   self.assertEqual(check('docs/old/index.html',strict=True).returncode,1)
   (repo/'docs/new').mkdir();(repo/'docs/new/index.html').write_text(page.read_text())
   units=json.loads(subprocess.check_output(['node','tools/segment_claims.mjs','docs/new/index.html'],cwd=repo,text=True))
   ledger={'page':'docs/new/index.html','claims':[{'id':'c1','covers':[u['id'] for u in units]}]};lp=repo/'claims/new.json';lp.write_text(json.dumps(ledger))
   self.assertEqual(check('--changed').returncode,0) # pristine new article green first
   ledger['claims'][0]['covers'].pop();lp.write_text(json.dumps(ledger));self.assertEqual(check('--changed').returncode,1)
   # Committed additions still compare against origin/main, not just git status.
   git('add','docs/new/index.html','claims/new.json');git('-c','user.name=fixture','-c','user.email=f@example.test','commit','-qm','new article')
   self.assertEqual(check('--changed').returncode,1)
   ledger['claims'][0]['covers']=[u['id'] for u in units];lp.write_text(json.dumps(ledger));self.assertEqual(check('--changed').returncode,0)
   (repo/'claims/no-ledger.json').write_text(json.dumps({'page':'docs/no-ledger/index.html','claims':[]}))
   self.assertEqual(check('--changed').returncode,0) # 2026-09-29: 既存ページへの台帳だけの追加は関門にしない（新規記事だけ強制）
if __name__=='__main__':unittest.main()
