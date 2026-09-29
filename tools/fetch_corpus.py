#!/usr/bin/env python3
"""Re-fetch a registered theme without changing its previous snapshot or repository.
Exit 0: unchanged and quotes present; 3: changes/quote_missing; 4: incomplete extraction.
Raw documents stay outside the repository. OCR is never accepted as verified text.
"""
import argparse
import datetime as dt
import difflib
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.request
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RUNS = Path.home() / 'Scripts/keiri-commander/runs/review-loop'
DEFAULT_STORE = Path.home() / 'Scripts/keiri-commander/corpus'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def decode_html(raw, content_type=''):
    labels = re.findall(r'charset\s*=\s*[\"\']?([\w-]+)', content_type, re.I)
    labels += re.findall(r'charset\s*=\s*[\"\']?([\w-]+)', raw[:8192].decode('ascii', 'ignore'), re.I)
    def canonical(s):
        return 'cp932' if s.lower().replace('-', '_') in ('shift_jis', 'sjis', 'windows_31j', 'cp932') else s.lower()
    encs = {canonical(s) for s in labels}
    if len(encs) > 1:
        raise ValueError('conflicting charset declarations: ' + str(encs))
    enc = next(iter(encs), 'utf-8-sig' if raw.startswith(b'\xef\xbb\xbf') else 'utf-8')
    return raw.decode(enc, errors='strict'), enc


class Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.hidden += 1
        if not self.hidden and tag in ('p','div','br','tr','li','h1','h2','h3','h4','td','th'): self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script','style'): self.hidden = max(0, self.hidden - 1)
        if not self.hidden and tag in ('p','div','tr','li','h1','h2','h3','h4'): self.parts.append('\n')
    def handle_data(self, data):
        if not self.hidden: self.parts.append(data)


def extract(raw, source, content_type=''):
    if source['format'] == 'pdf':
        if not raw.startswith(b'%PDF-'): raise ValueError('not a PDF')
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)/'source.pdf'; p.write_bytes(raw)
            result = subprocess.run(['pdftotext','-layout',str(p),'-'], capture_output=True, check=True)
            text = result.stdout.decode('utf-8', errors='strict')
        pages = text.split('\f')
        if pages and not pages[-1].strip(): pages.pop()
        # Check every page, including empty/Latin-only pages: these require review, never silent success.
        suspect = [i+1 for i,p in enumerate(pages) if not re.search('[ぁ-んァ-ン一-龯]',p)]
        status = 'image_pdf_unverified' if source.get('image_pdf') or suspect else 'ok'
        return text, None, status, suspect
    html, charset = decode_html(raw, content_type)
    parser = Text(); parser.feed(html)
    text = re.sub(r'\n[ \t]*\n+', '\n\n', ''.join(parser.parts)).strip()+'\n'
    if not re.search('[ぁ-んァ-ン一-龯]',text): raise ValueError('no Japanese text')
    return text, charset, 'ok', []


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent':'keiri-tools-corpus/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read(), response.url, response.headers.get('Content-Type','')


def quote_check(sources, texts, claims_dir):
    by_url = {s['url']:s['id'] for s in sources}
    missing=[]; unchecked=[]; checked=0
    for p in sorted(Path(claims_dir).rglob('*.json')):
        if p.name.startswith('_'): continue
        ledger=json.loads(p.read_text())
        for c in ledger.get('claims',[]):
            refs=[{'source_url':c.get('source_url'),'source_quote':c.get('source_quote')}]
            refs += c.get('supporting_sources',[])
            for ref in refs:
                url=ref.get('source_url',ref.get('url')); q=ref.get('source_quote',ref.get('quote',''))
                if url not in by_url: continue
                sid=by_url[url]
                if sid not in texts:
                    unchecked.append({'page':ledger.get('page'),'id':c.get('id'),'source_id':sid,'source_url':url,'reason':'source_unavailable'})
                    continue
                checked+=1
                if not q or q not in texts[sid]:
                    missing.append({'page':ledger.get('page'), 'id':c.get('id'), 'source_id':sid,
                                    'source_url':url,'reason':'quote_missing'})
    return checked, missing, unchecked


def previous_snapshot(store, theme):
    """Only a completed fetch can become the next comparison base (not a failed attempt)."""
    candidates=[]
    for path in (Path(store)/theme).glob('*/*/report.json'):
        try:
            report=json.loads(path.read_text())
            if report.get('theme')!=theme or report.get('errors')!=[]:continue
            if len(report.get('sources',[]))!=report.get('source_count'):continue
            if not report.get('source_count') or any(s.get('status')!='ok' for s in report['sources']):continue
            candidates.append((report['fetched_at'],path.parent))
        except (OSError,ValueError,KeyError,TypeError):continue
    return max(candidates,key=lambda x:x[0])[1] if candidates else None


def run(theme, registry, runs, store, claims_dir, baseline=None, fetcher=fetch, delay=1):
    sources=[s for s in registry['sources'] if theme in s['themes']]
    if not sources: raise ValueError('unknown/empty theme: '+theme)
    store=Path(store).expanduser().resolve()
    if store == ROOT or ROOT in store.parents: raise ValueError('corpus store must be outside repository')
    if baseline is None:baseline=previous_snapshot(store,theme)
    stamp=dt.datetime.now(dt.timezone.utc).astimezone(dt.timezone(dt.timedelta(hours=9))).isoformat()
    dest=store/theme/stamp[:10]/stamp[11:26].replace(':','').replace('.','-')
    dest.mkdir(parents=True,exist_ok=False)
    rows=[]; texts={}; changed=0; errors=[]
    for i,s in enumerate(sources):
        try:
            if i and delay: time.sleep(delay)
            raw,final,ctype=fetcher(s['url'])
            if urllib.parse.urlparse(final).hostname!=urllib.parse.urlparse(s['url']).hostname:
                raise ValueError('cross-host redirect requires review: '+final)
            folder=dest/s['id'];folder.mkdir()
            (folder/('original.'+s['format'])).write_bytes(raw)
            text,enc,status,suspect=extract(raw,s,ctype)
            (folder/'text.txt').write_text(text)
            old_raw=Path(runs)/s['local_raw'];old_text=Path(runs)/s['local_text']
            if baseline:
                old_raw=Path(baseline)/s['id']/('original.'+s['format']);old_text=Path(baseline)/s['id']/'text.txt'
            before=old_text.read_text() if old_text.exists() else ''
            diff=''.join(difflib.unified_diff(before.splitlines(True),text.splitlines(True),fromfile=str(old_text),tofile=str(folder/'text.txt')))
            (folder/'text.diff').write_text(diff)
            raw_equal=old_raw.exists() and sha(old_raw.read_bytes())==sha(raw)
            if not raw_equal or diff: changed+=1
            if status!='ok': errors.append({'id':s['id'],'error':status,'suspect_pages':suspect})
            else: texts[s['id']]=text
            rows.append({'id':s['id'],'url':s['url'],'final_url':final,'raw_sha256':sha(raw),
                         'text_sha256':sha(text.encode()),'raw_equal':raw_equal,'diff_lines':len(diff.splitlines()),'change_kind':'extraction_diff' if raw_equal and diff else 'raw_diff' if not raw_equal else 'unchanged',
                         'charset':enc,'status':status,'suspect_pages':suspect,
                         'japanese_char_ratio':len(re.findall('[ぁ-んァ-ン一-龯]',text))/max(1,len(text))})
        except Exception as e: errors.append({'id':s['id'],'error':str(e)})
    checked,missing,unchecked=quote_check(sources,texts,claims_dir)
    report={'schema_version':1,'theme':theme,'fetched_at':stamp,'snapshot':str(dest),'baseline':str(baseline) if baseline else 'legacy:'+str(runs),'sources':rows,
            'source_count':len(sources),'changed':changed,'errors':errors,'quotes_checked':checked,
            'quote_missing':missing,'quote_unchecked':unchecked,'affected_pages':sorted({m['page'] for m in missing if m['page']}),
            'exit_code':4 if errors else 3 if changed or missing else 0}
    (dest/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    return report


def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('theme')
    ap.add_argument('--registry',type=Path,default=ROOT/'tools/source_registry.json')
    ap.add_argument('--runs',type=Path,default=DEFAULT_RUNS);ap.add_argument('--store',type=Path,default=DEFAULT_STORE)
    ap.add_argument('--claims',type=Path,default=ROOT/'claims');ap.add_argument('--baseline',type=Path)
    ap.add_argument('--report',type=Path);ap.add_argument('--pages',type=Path)
    args=ap.parse_args();report=run(args.theme,json.loads(args.registry.read_text()),args.runs,args.store,args.claims,args.baseline)
    payload=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
    if args.report: args.report.write_text(payload)
    if args.pages: args.pages.write_text(''.join(p+'\n' for p in report['affected_pages']))
    print(payload);return report['exit_code']

if __name__=='__main__': raise SystemExit(main())
