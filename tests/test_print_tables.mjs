// Independently parse shipped HTML and OOXML; compare every row, type and source.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url).pathname;
execFileSync('python3', ['tools/gen_print_tables.py', '--check'], {cwd:root,stdio:'inherit'});
execFileSync('python3', ['-c', String.raw`
from pathlib import Path
import json, re, xml.etree.ElementTree as E
from zipfile import ZipFile
from html.parser import HTMLParser

class Table(HTMLParser):
    def __init__(self, id):
        super().__init__();self.id=id;self.active=False;self.row=None;self.cell=None;self.rows=[];self.skip=0;self.sources=[]
    def handle_starttag(self,t,a):
        a=dict(a)
        if t=='table' and a.get('id')==self.id:self.active=True
        if not self.active:return
        if t=='tr':self.row=[]
        if t in ('td','th'):self.cell=''
        if t=='span' and a.get('class')=='hint':self.skip+=1
        if t=='a':self.sources.append(a['href'])
    def handle_data(self,d):
        if self.active and self.cell is not None and not self.skip:self.cell+=d
    def handle_endtag(self,t):
        if not self.active:return
        if t=='span' and self.skip:self.skip-=1
        if t in ('td','th'):self.row.append(self.cell.strip());self.cell=None
        if t=='tr':self.rows.append(self.row)
        if t=='table':self.active=False

fixture=json.loads(Path('tests/fixtures/print_tables_primary.json').read_text())
stamp_data=json.loads(Path('docs/assets/inshi_r07.json').read_text())
stamp=stamp_data['docs']['k17_uriage']
assert stamp['hikazei_under']==50000 and stamp_data['_meta']['year']=='令和8年'
koyou=json.loads(Path('docs/assets/shaho_rates_r08.json').read_text())['koyou']
rosai=json.loads(Path('docs/assets/rosai_rates_r08.json').read_text())
expected={
 'inshi': [[f'記載金額が{stamp["hikazei_under"]:,}円未満',0]]+[[f'記載金額が{b["label"]}',b['tax']] for b in stamp['brackets']]+[['受取金額の記載がないもの（営業に関するもの）',stamp['noamount']]],
 'koyou': [[v['label'],v['worker_permille'],v['employer_permille'],v['total_permille']] for v in koyou['types'].values()],
 'rosai': [[r['category'],r['name'],r['permille']] for r in rosai['rows']],
}
# Public primary-source fixtures guard against wrong canonical JSON as well as stale generated copies.
assert [r[1] for r in expected['inshi']]==[r[1] for r in fixture['receipt']]
assert [r[0].removeprefix('記載金額が') for r in expected['inshi'][1:-1]]==[r[0] for r in fixture['receipt'][1:-1]]
assert [r[1:] for r in expected['koyou']]==fixture['koyou']
assert [koyou['previous'][key] for key in koyou['types']]==fixture['koyou_previous']
assert koyou['year']=='令和8年度' and koyou['applies_from']=='2026-04' and koyou['applies_to']=='2027-03'
assert [r[2] for r in expected['rosai']]==[r[2] for r in fixture['rosai']]
assert [r[1] for r in expected['rosai']]==[r[1] for r in fixture['rosai']]
assert [r[0] for r in expected['rosai']]==[category for category,count in fixture['rosai_categories'] for _ in range(count)]
assert len(expected['rosai'])==53
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
rel={'r':'http://schemas.openxmlformats.org/package/2006/relationships'}
for name,path,id,source in [
 ('inshi','docs/inshi','receipt-tax-table',fixture['receipt_source']),
 ('koyou','docs/column/koyou-hokenryo-ritsu','koyou-rate-table',fixture['koyou_source']),
 ('rosai','docs/column/rosai-hokenryoritsu','rosai-rate-table',fixture['rosai_source'])]:
    directory=Path(path);html=(directory/'index.html').read_text()
    table=Table(id);table.feed(html)
    assert table.sources==[source]*len(expected[name]),'source link required on every row'
    block=re.search(r'<section[^>]*data-print-tables="'+name+r'"[\s\S]*?</section>',html)[0]
    assert block.index('class="table-basis"')<block.index('<table'), 'basis must precede table'
    assert 'datetime="2026-10-14"' in block and 'data-print-table' in block
    with ZipFile(directory/(name+'-table.xlsx')) as z:
        assert z.testzip() is None
        sheet=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
        assert sheet.find('s:pageSetup',ns).attrib['fitToHeight']=='2'
        assert sheet.find('s:sheetViews/s:sheetView/s:pane',ns).attrib['state']=='frozen'
        rows=sheet.findall('s:sheetData/s:row',ns)
        def value(c):
            return float(c.find('s:v',ns).text) if c.attrib.get('t')=='n' else (c.find('s:is/s:t',ns).text or '')
        values=[[value(c) for c in r] for r in rows]
        assert len(values)==6+len(expected[name])
        assert values[2]==['確認日：2026-10-14']
        assert values[3]==['一次資料：'+source]
        assert len(table.rows[0])==len(values[5])
        assert values[5]==table.rows[0]
        assert [row[:-1] for row in values[6:]]==expected[name]
        assert [row[-1] for row in values[6:]]==[source]*len(expected[name])
        rels=E.fromstring(z.read('xl/worksheets/_rels/sheet1.xml.rels'))
        targets={r.attrib['Id']:r.attrib['Target'] for r in rels}
        hyperlinks=sheet.findall('s:hyperlinks/s:hyperlink',ns)
        assert len(hyperlinks)==len(expected[name])
        for link in hyperlinks:assert targets[link.attrib['{'+ns['s'].replace('/spreadsheetml/2006/main','/officeDocument/2006/relationships')+'}id']]==source
        for actual,expected_row in zip(table.rows[1:],values[6:]):
            for a,e in zip(actual[:-1],expected_row[:-1]):
                if isinstance(e,(int,float)):
                    assert a==('非課税（印紙不要）' if name=='inshi' and e==0 else f'{int(e):,}円' if name=='inshi' else f'{e:g}/1,000' if name=='koyou' else f'{e:g}')
                else:assert a==e
        # Rates/amounts stay usable as numbers; strings never turn into formulas.
        for r in rows[6:]:
            for c in r:assert c.find('s:f',ns) is None
        assert all(c.attrib['t']=='n' for r in rows[6:] for c in r if c.attrib['r'][0] in ({'B'} if name=='inshi' else {'B','C','D'} if name=='koyou' else {'C'}))
    print('PASS: primary oracle / all HTML & XLSX rows / types / source links / print settings:',name)
`], {cwd:root,stdio:'inherit'});
// Preserve the experiment's title and H1, including original inline markup.
for (const [page,title,h1] of [
 ['inshi','収入印紙の金額一覧表・判定機｜営業に関する紙の領収書と契約書【全20号】','収入印紙の金額 判定機＋<span class="keep-phrase">印紙税額一覧表</span><span class="keep-phrase">（全20号）</span>'],
 ['column/koyou-hokenryo-ritsu','雇用保険料率【令和8年度】一覧｜一般の事業 合計13.5/1,000・労働者5/1,000','雇用保険料率【令和8年度】一般の事業は合計13.5/1,000・労働者5/1,000'],
 ['column/rosai-hokenryoritsu','労災保険料率【令和8年度】53業種の一覧表と賃金総額からの計算方法','労災保険料率とは — 業種で35倍違う。令和8年度は据え置きで、全額が会社負担']]) {
 const html=readFileSync(new URL(`../docs/${page}/index.html`,import.meta.url),'utf8');
 assert.equal(html.match(/<title>(.*?)<\/title>/s)[1],title);
 assert.equal(html.match(/<h1>(.*?)<\/h1>/s)[1],h1);
}
