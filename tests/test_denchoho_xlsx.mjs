// Independent ZIP/XML reader: validates the shipped workbooks, not generator internals.
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url).pathname;
execFileSync('python3', ['tools/gen_denchoho_xlsx.py', '--check'], { cwd: root, stdio: 'inherit' });
execFileSync('python3', ['-c', String.raw`
import csv
from datetime import date, timedelta
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

directory = Path('docs/denchoho-index')
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
rel_ns = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
ct_ns = {'c': 'http://schemas.openxmlformats.org/package/2006/content-types'}
headers = ['連番', '取引年月日', '取引先', '取引金額', '書類種別', '書類番号', '保存ファイル名', '備考']
for stem in ['索引簿テンプレート', '索引簿テンプレート_記入例つき']:
    path = directory / (stem + '.xlsx')
    assert path.read_bytes()[:4] == b'PK\x03\x04'
    with ZipFile(path) as archive:
        assert archive.testzip() is None, 'ZIP CRC failure'
        xmls = {name: ET.fromstring(archive.read(name)) for name in archive.namelist()}
        assert all('\ufffd' not in archive.read(name).decode('utf-8') for name in archive.namelist())
        types = {e.attrib['PartName']: e.attrib['ContentType'] for e in xmls['[Content_Types].xml'].findall('c:Override', ct_ns)}
        assert types['/xl/workbook.xml'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'
        assert types['/xl/worksheets/sheet1.xml'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'
        root_rel = xmls['_rels/.rels'].find('r:Relationship', rel_ns)
        assert root_rel.attrib['Target'] == 'xl/workbook.xml'
        workbook = xmls['xl/workbook.xml']
        assert workbook.find('s:workbookPr', ns).attrib['date1904'] == '0'
        sheets = workbook.findall('s:sheets/s:sheet', ns)
        assert len(sheets) == 1 and sheets[0].attrib['name'] == '索引簿'
        rid = sheets[0].attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        rels = {r.attrib['Id']: r.attrib['Target'] for r in xmls['xl/_rels/workbook.xml.rels'].findall('r:Relationship', rel_ns)}
        assert rels[rid] == 'worksheets/sheet1.xml'
        assert 'styles.xml' in rels.values()
        sheet = xmls['xl/' + rels[rid]]
        rows = sheet.findall('s:sheetData/s:row', ns)
        csv_rows = list(csv.reader((directory / (stem + '.csv')).open(encoding='utf-8-sig', newline='')))
        assert len(rows) == len(csv_rows)
        assert [c.find('s:is/s:t', ns).text for c in rows[0]] == headers
        assert sheet.find('s:autoFilter', ns).attrib['ref'] == 'A1:H' + str(len(rows))
        assert sheet.find('s:sheetViews/s:sheetView/s:pane', ns).attrib['state'] == 'frozen'
        styles = xmls['xl/styles.xml']
        formats = {int(f.attrib['numFmtId']): f.attrib['formatCode'] for f in styles.findall('s:numFmts/s:numFmt', ns)}
        xfs = styles.findall('s:cellXfs/s:xf', ns)
        for row_no, (row, source) in enumerate(zip(rows[1:], csv_rows[1:]), 2):
            cells = list(row)
            assert len(cells) == 8
            for col, (cell, value) in enumerate(zip(cells, source)):
                assert cell.attrib['r'] == chr(65 + col) + str(row_no)
                fmt = int(xfs[int(cell.attrib['s'])].attrib['numFmtId'])
                if col == 1: assert formats[fmt] == 'yyyy-mm-dd', 'Date format missing, even in blank template'
                if col == 3: assert fmt == 3, 'Amount must use numeric format'
                if not value:
                    assert cell.find('s:v', ns) is None and cell.find('s:is', ns) is None, 'Blank must stay blank'
                elif col in (0, 1, 3):
                    assert cell.attrib['t'] == 'n', 'Dates/amounts must be numeric cells'
                    number = int(cell.find('s:v', ns).text)
                    if col == 1: assert date(1899, 12, 30) + timedelta(days=number) == date.fromisoformat(value)
                    else: assert number == int(value)
                else:
                    assert cell.attrib['t'] == 'inlineStr'
                    assert cell.find('s:is/s:t', ns).text == value, 'Japanese text/filename changed'
        if '記入例' in stem:
            assert len(rows) == 4
            assert rows[2][2].find('s:is/s:t', ns).text == '株式会社ヤマダ商事'
            assert rows[1][3].find('s:v', ns).text == '8978'
        else: assert len(rows) == 31
    print('PASS ZIP, content types, relationships, Japanese sheet/text, date/amount types, filter: ' + path.name)
`], { cwd: root, stdio: 'inherit' });
