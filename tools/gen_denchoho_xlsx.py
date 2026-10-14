#!/usr/bin/env python3
"""Build real, reproducible XLSX templates from the existing UTF-8 BOM CSVs.

Python standard library only. Run with --check to compare without writing.
Dates use Excel's 1900 date system; amounts and sequence numbers are numeric.
"""
import argparse
import csv
from datetime import date
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'docs/denchoho-index'
NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'


def xml(body):
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + body


def build(csv_path):
    with csv_path.open(encoding='utf-8-sig', newline='') as source:
        rows = list(csv.reader(source))
    sheet_rows = []
    for row_no, row in enumerate(rows, 1):
        cells = []
        for col, value in enumerate(row):
            ref = f'{chr(65 + col)}{row_no}'
            style = 1 if row_no == 1 else {0: 4, 1: 2, 3: 3}.get(col, 0)
            if row_no > 1 and value and col in (0, 1, 3):
                numeric = (date.fromisoformat(value) - date(1899, 12, 30)).days if col == 1 else int(value)
                cells.append(f'<c r="{ref}" s="{style}" t="n"><v>{numeric}</v></c>')
            elif value:
                cells.append(f'<c r="{ref}" s="{style}" t="inlineStr"><is><t xml:space="preserve">{escape(value)}</t></is></c>')
            else:
                cells.append(f'<c r="{ref}" s="{style}"/>')
        sheet_rows.append(f'<row r="{row_no}" ht="30" customHeight="1">{"".join(cells)}</row>')
    last = len(rows)
    widths = [8, 16, 28, 16, 14, 28, 48, 24]
    cols = ''.join(f'<col min="{i}" max="{i}" width="{width}" customWidth="1"/>' for i, width in enumerate(widths, 1))
    parts = {
        '[Content_Types].xml': xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
        '_rels/.rels': xml(f'<Relationships xmlns="{PACKAGE_REL}"><Relationship Id="rId1" Type="{REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
        'xl/workbook.xml': xml(f'<workbook xmlns="{NS}" xmlns:r="{REL}"><workbookPr date1904="0"/><sheets><sheet name="索引簿" sheetId="1" r:id="rId1"/></sheets></workbook>'),
        'xl/_rels/workbook.xml.rels': xml(f'<Relationships xmlns="{PACKAGE_REL}">'
            f'<Relationship Id="rId1" Type="{REL}/worksheet" Target="worksheets/sheet1.xml"/>'
            f'<Relationship Id="rId2" Type="{REL}/styles" Target="styles.xml"/></Relationships>'),
        'xl/worksheets/sheet1.xml': xml(f'<worksheet xmlns="{NS}"><dimension ref="A1:H{last}"/>'
            '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            f'<sheetFormatPr defaultRowHeight="30"/><cols>{cols}</cols><sheetData>{"".join(sheet_rows)}</sheetData>'
            f'<autoFilter ref="A1:H{last}"/></worksheet>'),
        'xl/styles.xml': xml(f'<styleSheet xmlns="{NS}">'
            '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>'
            '<fonts count="2"><font><sz val="11"/><name val="Yu Gothic"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Yu Gothic"/></font></fonts>'
            '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF245C4F"/><bgColor indexed="64"/></patternFill></fill></fills>'
            '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFDDE5E1"/></bottom><diagonal/></border></borders>'
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            '<cellXfs count="5">'
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
            '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>'
            '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>'
            '<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>'
            '<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>'
            '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'),
    }
    output = BytesIO()
    with ZipFile(output, 'w') as archive:
        for name, body in parts.items():
            entry = ZipInfo(name, date_time=(2026, 7, 13, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o600 << 16
            archive.writestr(entry, body.encode('utf-8'))
    return output.getvalue()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for name in ['索引簿テンプレート', '索引簿テンプレート_記入例つき']:
        target = DIRECTORY / f'{name}.xlsx'
        data = build(DIRECTORY / f'{name}.csv')
        if args.check:
            if not target.exists() or target.read_bytes() != data:
                raise SystemExit(f'Stale XLSX: {target}')
        else:
            target.write_bytes(data)
        print(f'{"checked" if args.check else "generated"}: {target.name}')
