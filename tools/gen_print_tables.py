#!/usr/bin/env python3
"""Generate HTML tables and reproducible XLSX from canonical JSON (stdlib only).

--check detects stale HTML/XLSX; --only inshi supports the existing receipt generator.
"""
import argparse
import json
import re
from html import escape
from pathlib import Path
from io import BytesIO
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'


def load(name):
    return json.loads((ROOT / 'docs/assets' / name).read_text())


def xlsx(title, metadata, headers, rows, widths, numeric_cols):
    """Amounts/rates are numeric, sources are per-row hyperlinks; no formulas."""
    last_col = chr(64 + len(headers))
    data = [[title], *[[v] for v in metadata], headers, *rows]
    header_row = len(metadata) + 2
    parts = {}
    sheet_rows = []
    for i, row in enumerate(data, 1):
        cells = []
        for j, value in enumerate(row):
            style = 1 if i in (1, header_row) else 2 if j in numeric_cols and i > header_row else 0
            ref = f'{chr(65+j)}{i}'
            if isinstance(value, (int, float)):
                cell = f'<c r="{ref}" s="{style}" t="n"><v>{value:g}</v></c>'
            else:
                cell = f'<c r="{ref}" s="{style}" t="inlineStr"><is><t xml:space="preserve">{escape(str(value))}</t></is></c>'
            cells.append(cell)
        # Long industry names and conditions must remain readable in Excel.
        height = 42 if i > header_row and max(len(str(v)) for v in row[:-1]) > 35 else 30
        if len(row) == 1 and 'https://' in str(row[0]):
            height = 42  # Source URL wraps across the merged row.
        if i == 5:
            height = 90  # Conditions are part of the usable table, not a clipped footnote.
        sheet_rows.append(f'<row r="{i}" ht="{height}" customHeight="1">{"".join(cells)}</row>')
    merges = ''.join(f'<mergeCell ref="A{i}:{last_col}{i}"/>' for i in range(1, header_row))
    targets = [(f'A{i}', str(row[0]).split('https://',1)[1]) for i,row in enumerate(data[:header_row-1],1)
               if len(row) == 1 and 'https://' in str(row[0])]
    targets = [(ref,'https://'+url) for ref,url in targets]
    targets += [(f'{last_col}{i}',str(data[i-1][-1])) for i in range(header_row+1,len(data)+1)]
    links = ''.join(f'<hyperlink ref="{ref}" r:id="rId{n}"/>' for n,(ref,url) in enumerate(targets,1))
    rels = ''.join(f'<Relationship Id="rId{n}" Type="{REL}/hyperlink" Target="{escape(url,quote=True)}" TargetMode="External"/>' for n,(ref,url) in enumerate(targets,1))
    parts['[Content_Types].xml'] = ('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>')
    parts['_rels/.rels'] = f'<Relationships xmlns="{PKG}"><Relationship Id="rId1" Type="{REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    parts['xl/workbook.xml'] = (f'<workbook xmlns="{NS}" xmlns:r="{REL}"><sheets><sheet name="一覧表" sheetId="1" r:id="rId1"/></sheets>'
        f'<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">一覧表!$A$1:${last_col}${len(data)}</definedName>'
        f'<definedName name="_xlnm.Print_Titles" localSheetId="0">一覧表!${header_row}:${header_row}</definedName></definedNames></workbook>')
    parts['xl/_rels/workbook.xml.rels'] = f'<Relationships xmlns="{PKG}"><Relationship Id="rId1" Type="{REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="{REL}/styles" Target="styles.xml"/></Relationships>'
    cols = ''.join(f'<col min="{i}" max="{i}" width="{w}" customWidth="1"/>' for i,w in enumerate(widths,1))
    parts['xl/worksheets/sheet1.xml'] = (f'<worksheet xmlns="{NS}" xmlns:r="{REL}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
        f'<dimension ref="A1:{last_col}{len(data)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="{header_row}" topLeftCell="A{header_row+1}" state="frozen"/></sheetView></sheetViews>'
        f'<cols>{cols}</cols><sheetData>{"".join(sheet_rows)}</sheetData><autoFilter ref="A{header_row}:{last_col}{len(data)}"/>'
        f'<mergeCells count="{header_row-1}">{merges}</mergeCells><hyperlinks>{links}</hyperlinks>'
        '<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>'
        '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="2"/></worksheet>')
    parts['xl/worksheets/_rels/sheet1.xml.rels'] = f'<Relationships xmlns="{PKG}">{rels}</Relationships>'
    parts['xl/styles.xml'] = (f'<styleSheet xmlns="{NS}"><fonts count="2"><font><sz val="11"/><name val="Yu Gothic"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Yu Gothic"/></font></fonts>'
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF245C4F"/><bgColor indexed="64"/></patternFill></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
        '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>'
        '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')
    # Rates use up to one decimal, amounts use thousands separators.
    if title != '領収書の収入印紙税額表':
        parts['xl/styles.xml'] = parts['xl/styles.xml'].replace('numFmtId="3"', 'numFmtId="2"')
    output = BytesIO()
    with ZipFile(output, 'w') as archive:
        for name, body in parts.items():
            info = ZipInfo(name, (2026, 10, 14, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            archive.writestr(info, ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+body).encode())
    return output.getvalue()


def write(path, value, check):
    value = value.encode() if isinstance(value, str) else value
    if check:
        if not path.exists() or path.read_bytes() != value:
            raise SystemExit(f'Stale generated file: {path.relative_to(ROOT)}')
    else:
        path.write_bytes(value)


def table(id_, headers, rows, numeric_cols, old=None, old_year=None):
    body = []
    for i, row in enumerate(rows):
        cells = []
        for j, v in enumerate(row):
            if j == len(row)-1:
                content = f'<a href="{escape(v, quote=True)}">一次資料</a>'
            else:
                content = escape(str(v))
                if old and j in numeric_cols:
                    content += f'<br><span class="hint">（{escape(old_year)} {old[i][j-1]}/1,000）</span>'
            tag = 'th scope="row"' if j == 0 else 'td'
            cls = ' class="num"' if j in numeric_cols else ''
            cells.append(f'<{tag}{cls}>{content}</{tag.split()[0]}>')
        body.append('<tr>'+''.join(cells)+'</tr>')
    return (f'<div class="scroll-wrap"><table class="tbl print-data-table" id="{id_}"><thead><tr>'+
        ''.join(f'<th scope="col"'+(' class="num"' if j in numeric_cols else '')+(' data-answer' if id_=='receipt-tax-table' and j==1 else '')+f'>{escape(v)}</th>' for j,v in enumerate(headers))+'</tr></thead><tbody>\n'+
        '\n'.join(body)+'\n</tbody></table></div>')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--only', choices=['inshi'])
    args = parser.parse_args()
    stamp = load('inshi_r07.json')
    doc = stamp['docs']['k17_uriage']
    source = stamp['_meta']['url2']
    receipt = [[f'記載金額が{doc["hikazei_under"]:,}円未満', 0, source]]
    receipt += [[f'記載金額が{b["label"]}',b['tax'],source] for b in doc['brackets']]
    receipt += [['受取金額の記載がないもの（営業に関するもの）',doc['noamount'],source]]
    receipt_note = '営業に関する紙の売上代金の領収書が対象。電子交付・営業に関しない受取書は対象外。'
    basis = f'{stamp["_meta"]["year"]}4月1日現在法令等'
    receipt_extra = '課税事業者が消費税額等を区分記載した場合はその額を除きます。免税事業者は除けません。売上代金とそれ以外が混ざる場合、非課税の判定は合計額、税額の階級は区分できた売上代金で判定します。'
    jobs = [('inshi','docs/inshi','receipt-table','receipt-tax-table','領収書の収入印紙税額表',basis,doc['checked'],source,
        ['記載金額','印紙税額（円・1通）','出典'],receipt,[1],[46,20,24],receipt_note+' '+receipt_extra,None)]
    if not args.only:
        koyou = load('shaho_rates_r08.json')['koyou']
        rows = [[t['label'],t['worker_permille'],t['employer_permille'],t['total_permille'],koyou['url']] for t in koyou['types'].values()]
        note = '賃金総額にかける率です。園芸サービス、牛馬の育成、酪農、養鶏、養豚、内水面養殖および特定の船員を雇用する事業には、一般の事業の率を適用します。'
        jobs.append(('koyou','docs/column/koyou-hokenryo-ritsu','print-rates','koyou-rate-table','雇用保険料率表',
            f'{koyou["year"]}・{koyou["applies_from"]}-01〜{koyou["applies_to"]}-31',koyou['checked'],koyou['url'],
            ['事業の種類','労働者負担（/1,000）','事業主負担（/1,000）','合計（/1,000）','出典'],rows,[1,2,3],[36,20,20,18,24],note,
            [koyou['previous'][key] for key in koyou['types']]))
        rosai = load('rosai_rates_r08.json')
        m = rosai['_meta']
        rows = [[r['category'],r['name'],r['permille'],m['url']] for r in rosai['rows']]
        jobs.append(('rosai','docs/column/rosai-hokenryoritsu','print-rates','rosai-rate-table','労災保険率表',
            f'{m["year"]}・{m["applies_from"]}施行の基準率を据え置き（{m["applies_until"]}までの年度）',m['checked'],m['url'],
            ['分類','事業の種類','基準率（/1,000）','出典'],rows,[2],[24,90,20,24],m['scope']+' 労災保険料は全額事業主負担です。',None))
    for name, directory, marker, id_, title, basis, checked, source, headers, rows, numeric_cols, widths, note, old in jobs:
        directory = ROOT/directory
        filename = f'{name}-table.xlsx'
        meta = [f'適用：{basis}',f'確認日：{checked}',f'一次資料：{source}',note]
        if name == 'rosai':
            meta.append(f'令和8年度の据え置きの案内：{rosai["_meta"]["current_url"]}')
        write(directory/filename,xlsx(title,meta,headers,rows,widths,numeric_cols),args.check)
        display = [[((('非課税（印紙不要）' if v==0 else f'{v:,}円') if name=='inshi' else f'{v:g}/1,000' if name=='koyou' else f'{v:g}') if isinstance(v,(int,float)) else v) for v in row] for row in rows]
        lead = '<p id="receipt-tax-basis">この表は<b>営業に関する紙の売上代金の領収書</b>が対象です。記載金額の決め方は<a href="#ryoshusho">領収書はいくらから？</a>で説明します。</p>' if name=='inshi' else ''
        current = f'・<a href="{escape(rosai["_meta"]["current_url"])}">{escape(rosai["_meta"]["year"])}の据え置きの案内</a>' if name=='rosai' else ''
        scope_source = f' <a href="{stamp["_meta"]["url_shohizei"]}">消費税額等の扱い（国税庁）</a>' if name=='inshi' else ''
        history = (f'\n<details class="rate-history"><summary>{escape(koyou["previous"]["year"])}との比較を開く</summary>' +
            table('koyou-rate-history',headers,display,numeric_cols,old,koyou['previous']['year'])+'</details>') if old else ''
        block = (f'<!-- {marker}:auto -->\n<section class="card print-table-sheet print-table-{name}" id="{name}-print-table" data-print-tables="{name}" aria-label="{title}">\n'
            f'<div class="table-actions"><button type="button" class="primary" data-print-table>この表を印刷する</button> <a href="{filename}" download>Excel（.xlsx）をダウンロード</a></div>\n'
            f'<p class="print-table-title">{title}</p>\n<p class="table-basis">適用：{escape(basis)}<br>確認日：<time datetime="{checked}">{checked}</time><br>'
            f'一次資料：<a href="{escape(source)}">{"国税庁 印紙税額の一覧表" if name=="inshi" else "厚生労働省 料率表（PDF）"}</a>{current}</p>\n'
            f'{lead}\n{table(id_,headers,display,numeric_cols)}\n<p class="print-table-scope" data-review-context="after-table">{escape(note)}{scope_source}</p>\n</section>{history}\n<!-- /{marker}:auto -->')
        page = directory/'index.html'
        html = page.read_text()
        pattern = rf'<!-- {marker}:auto -->[\s\S]*?<!-- /{marker}:auto -->'
        if not re.search(pattern,html):
            raise SystemExit(f'Missing marker: {page}')
        updated = re.sub(pattern,lambda _:block,html)
        # gen_layout_markup wraps numeric text without changing the table's content.
        normalize = lambda s: re.sub(r'<span class="numeric-token">([^<]*)</span>',r'\1',s)
        if args.check:
            if normalize(updated) != normalize(html):
                raise SystemExit(f'Stale generated HTML: {page.relative_to(ROOT)}')
        else:
            write(page,updated,False)
        print(f'{"checked" if args.check else "generated"}: {name} HTML / XLSX')


if __name__ == '__main__':
    main()
