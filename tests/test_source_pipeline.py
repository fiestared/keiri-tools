import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import fetch_corpus as fc
import import_sol_claims as ic
import source_monitor as monitor
import check_source_year as year


def pdf_fixture():
    # A real raster-only PDF; built in a temporary test, never committed as a PDF asset.
    stream=b'q 100 0 0 100 0 0 cm /Im0 Do Q\n'
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
             b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>',
             f'<< /Length {len(stream)} >>\nstream\n'.encode()+stream+b'endstream',
             b'<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n'+bytes([0])+b'\nendstream']
    out=b'%PDF-1.4\n';offsets=[]
    for i,obj in enumerate(objects,1):offsets.append(len(out));out+=str(i).encode()+b' 0 obj\n'+obj+b'\nendobj\n'
    pos=len(out);out+=f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()
    for n in offsets:out+=f'{n:010d} 00000 n \n'.encode()
    return out+f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{pos}\n%%EOF\n'.encode()


class Pipeline(unittest.TestCase):
    def test_registry_contract(self):
        registry=json.loads((ROOT/'tools/source_registry.json').read_text())
        sources=registry['sources']
        self.assertEqual(len(sources),67)
        self.assertEqual(len({s['id'] for s in sources}),67)
        self.assertEqual(len({s['url'] for s in sources}),67)
        for source in sources:
            self.assertTrue(source['url'].startswith('https://'))
            self.assertTrue(source['publisher'])
            self.assertIsInstance(source['image_pdf'],bool)
            self.assertFalse(Path(source['local_raw']).is_absolute())
            self.assertNotIn('..',Path(source['local_raw']).parts)
            self.assertIn(source['format'],['pdf','html'])
        self.assertEqual(sum(s['image_pdf'] for s in sources),2)
        self.assertEqual(sum('t1' in s['themes'] for s in sources),22)

    def test_charset_and_image_pdf(self):
        raw='<meta charset="Shift_JIS"><p>令和８年度の保険料です。</p>'.encode('cp932')
        text,charset,status,_=fc.extract(raw,{'format':'html'})
        self.assertEqual(charset,'cp932');self.assertIn('令和８年度',text);self.assertEqual(status,'ok')
        with self.assertRaises(ValueError):fc.decode_html(raw,'text/html; charset=UTF-8')
        with self.assertRaises(UnicodeDecodeError):fc.decode_html(b'<meta charset="utf-8">\xff')
        _,_,status,pages=fc.extract(pdf_fixture(),{'format':'pdf','image_pdf':True})
        self.assertEqual(status,'image_pdf_unverified');self.assertEqual(pages,[1])

    def test_snapshot_green_then_line_mutation_red(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=Path(tmp);(r/'old').mkdir();(r/'claims').mkdir()
            raw='<meta charset="utf-8"><p>令和８年度の料率は百分の一です。</p>'.encode()
            source={'id':'fixture','url':'https://www.nta.go.jp/fixture','themes':['t1'],'format':'html','image_pdf':False,'local_raw':'old/a.html','local_text':'old/a.txt'}
            text=fc.extract(raw,source)[0];(r/'old/a.html').write_bytes(raw);(r/'old/a.txt').write_text(text)
            (r/'claims/a.json').write_text(json.dumps({'page':'docs/a/index.html','claims':[{'id':'c1','source_url':source['url'],'source_quote':'令和８年度の料率は百分の一です。'}]}))
            fetch=lambda url:(raw,url,'text/html; charset=utf-8')
            green=fc.run('t1',{'sources':[source]},r,r/'store',r/'claims',fetcher=fetch,delay=0)
            self.assertEqual(green['exit_code'],0);self.assertEqual(green['changed'],0);self.assertEqual(green['quotes_checked'],1);self.assertEqual(green['quote_missing'],[])
            before=(Path(green['snapshot'])/'fixture/text.txt').read_bytes()
            bad=raw.replace('百分の一'.encode(),'百分の二'.encode())
            red=fc.run('t1',{'sources':[source]},r,r/'store2',r/'claims',fetcher=lambda url:(bad,url,''),delay=0)
            self.assertEqual(red['exit_code'],3);self.assertEqual(red['changed'],1);self.assertEqual(len(red['quote_missing']),1)
            self.assertEqual((Path(green['snapshot'])/'fixture/text.txt').read_bytes(),before)
            failure=fc.run('t1',{'sources':[source]},r,r/'store3',r/'claims',fetcher=lambda url:(_ for _ in ()).throw(OSError('offline')),delay=0)
            self.assertEqual(failure['exit_code'],4);self.assertEqual(len(failure['errors']),1)
            self.assertEqual(failure['quote_missing'],[])
            self.assertEqual(len(failure['quote_unchecked']),1)
            self.assertEqual(failure['quotes_checked'],0)

    def test_default_baseline_is_previous_successful_fetch(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=Path(tmp);(r/'old').mkdir();(r/'claims').mkdir()
            source={'id':'a','url':'https://www.nta.go.jp/a','themes':['t1'],'format':'html','image_pdf':False,'local_raw':'old/a.html','local_text':'old/a.txt'}
            old='<meta charset="utf-8"><p>旧版の正本です。</p>'.encode()
            new='<meta charset="utf-8"><p>新版の正本です。</p>'.encode()
            (r/'old/a.html').write_bytes(old);(r/'old/a.txt').write_text(fc.extract(old,source)[0])
            fetch=lambda raw:lambda url:(raw,url,'')
            green=fc.run('t1',{'sources':[source]},r,r/'store',r/'claims',fetcher=fetch(old),delay=0)
            self.assertEqual(green['exit_code'],0)
            changed=fc.run('t1',{'sources':[source]},r,r/'store',r/'claims',fetcher=fetch(new),delay=0)
            self.assertEqual(changed['exit_code'],3);self.assertEqual(changed['baseline'],green['snapshot'])
            failed=fc.run('t1',{'sources':[source]},r,r/'store',r/'claims',fetcher=lambda url:(_ for _ in ()).throw(OSError('offline')),delay=0)
            self.assertEqual(failed['exit_code'],4)
            # Failed fetch is not a new baseline; repeat should compare with the preceding good new edition.
            unchanged=fc.run('t1',{'sources':[source]},r,r/'store',r/'claims',fetcher=fetch(new),delay=0)
            self.assertEqual(unchanged['baseline'],changed['snapshot'])
            self.assertEqual(unchanged['changed'],0);self.assertEqual(unchanged['exit_code'],0)

    def test_import_preserves_deduplicates_and_excludes_ocr(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=Path(tmp);repo=r/'repo';runs=r/'runs';(repo/'tools').mkdir(parents=True);(repo/'claims').mkdir()
            for name in ['check_claims.mjs','claims_sources.json']:shutil.copy2(ROOT/'tools'/name,repo/'tools'/name)
            (runs/'t1/out').mkdir(parents=True);(runs/'t1/corpus').mkdir()
            original='原文の保険料は100円です。\n例外は次のとおりです。\n'
            (runs/'t1/corpus/a.txt').write_text(original)
            reg={'sources':[{'id':'a','url':'https://www.nta.go.jp/a','themes':['t1'],'local_text':'t1/corpus/a.txt','local_raw':'t1/corpus/a.pdf','image_pdf':False},
                             {'id':'scan','url':'https://www.nta.go.jp/scan','themes':['t1'],'local_text':'t1/corpus/scan.txt','local_raw':'t1/corpus/scan.pdf','image_pdf':True}]}
            old={'id':'old','text':'既存の主張は消さない','numbers':[]};(repo/'claims/a.json').write_text(json.dumps({'page':'docs/a/index.html','claims':[old]}))
            c={'page':'docs/a/index.html','id':'c1','claim':'保険料は100円','result':'ok','corpus_ref':'a.txt:1-2','corpus_quote':'保険料…100円'}
            cs=[c,{**c,'id':'c2','result':'wrong'},{**c,'id':'c3','corpus_ref':'scan.pdf:画像1頁'}]
            src=runs/'t1/out/t00.json';src.write_text(json.dumps({'claims':cs,'findings':[]}));before=src.read_bytes()
            first=ic.import_claims(runs,repo,reg,['t1']);self.assertEqual(first['represented'],1);self.assertEqual(first['counts']['t1']['ocr_excluded'],1)
            ledger=json.loads((repo/'claims/a.json').read_text());self.assertEqual(ledger['claims'][0],old);self.assertEqual(len(ledger['claims']),2)
            self.assertEqual(ledger['claims'][1]['source_quote'],original.rstrip('\n'))
            self.assertIn(ledger['claims'][1]['source_quote'],original)
            saved=(repo/'claims/a.json').read_bytes();again=ic.import_claims(runs,repo,reg,['t1'])
            self.assertEqual(again['counts']['t1']['already_present'],1);self.assertEqual((repo/'claims/a.json').read_bytes(),saved);self.assertEqual(src.read_bytes(),before)
            # Baseline was green. Break the locator, ensure it cannot become an imported claim.
            with self.assertRaises(ValueError):ic.resolve_quotes('a.txt:999-1000','t1',reg,runs)
            changed=json.loads(src.read_text());changed['claims'][0]['claim']='後から違う主張へ変更'
            src.write_text(json.dumps(changed))
            drift=ic.import_claims(runs,repo,reg,['t1']);self.assertEqual(drift['unresolved'],1)
            self.assertEqual(drift['counts']['t1']['input_changed'],1)

    def test_corrected_wrong_uses_existing_correct_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=Path(tmp);repo=r/'repo';runs=r/'runs';(repo/'claims').mkdir(parents=True);(runs/'t1/out').mkdir(parents=True);(runs/'t1/corpus').mkdir()
            quote='正本では支払額は200円です。'
            (runs/'t1/corpus/a.txt').write_text(quote)
            reg={'sources':[{'id':'a','url':'https://www.nta.go.jp/a','themes':['t1'],'local_text':'t1/corpus/a.txt','local_raw':'t1/corpus/a.pdf','image_pdf':False}]}
            corrected={'id':'fixed','text':'支払額は200円','source_url':'https://www.nta.go.jp/a','source_quote':quote,'adjudication':'t00-F0'}
            (repo/'claims/a.json').write_text(json.dumps({'page':'docs/a/index.html','claims':[corrected]}))
            wrong={'page':'docs/a/index.html','id':'c1','claim':'支払額は100円','result':'wrong','corpus_ref':'a.txt:1','corpus_quote':'要約'}
            (runs/'t1/out/t00.json').write_text(json.dumps({'claims':[wrong],'findings':[{'page':wrong['page'],'claim_id':'c1','correct':'支払額は200円'}]}))
            report=ic.import_claims(runs,repo,reg,['t1'])
            self.assertEqual(report['counts']['t1']['corrected_existing'],1)
            claims=json.loads((repo/'claims/a.json').read_text())['claims']
            self.assertEqual(len(claims),1);self.assertEqual(claims[0]['text'],'支払額は200円')
            self.assertNotIn('100円',json.dumps(claims,ensure_ascii=False))

    def test_year_green_then_covers_rollback_found(self):
        class Response:
            status=200;headers={'Content-Type':'text/html; charset=utf-8'}
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self):return '<h1>令和８年度の雇用保険料率</h1>'.encode()
        with patch.object(year.urllib.request,'build_opener') as opener:
            opener.return_value.open.return_value=Response()
            covers=2026
            self.assertEqual(year.probe('https://example.test',year.wareki(covers+1)+'度',kind='in_place')[0],'absent')
            covers-=1
            self.assertEqual(year.probe('https://example.test',year.wareki(covers+1)+'度',kind='in_place')[0],'found')
            with patch.object(Response,'read',return_value=b'<h1>Not found</h1>'):
                self.assertEqual(year.probe('https://example.test','令和9年度',kind='in_place')[0],'unknown')

    def test_daily_counts_and_failure(self):
        summary=monitor.summarize([{'state':s} for s in ['found','absent','unknown','unregistered']],{'counts':{'一致':2,'ずれ':1,'記載なし':3,'未取得':4}})
        self.assertIn('発見 1 / 未公表 1 / 確認不能 2',summary);self.assertIn('確認不能 7',summary)
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(monitor.run(Path(tmp)/'missing',tmp),4)
            self.assertIn('発見 不明',(Path(tmp)/'source-monitor.md').read_text())

if __name__=='__main__':unittest.main()
