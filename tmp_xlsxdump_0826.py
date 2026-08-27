import zipfile, sys, xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
T = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'
ROW = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'


def dump(path, maxrows=90):
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        r = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in r.findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter(T)))
    for n in sorted(x for x in z.namelist() if x.startswith('xl/worksheets/sheet')):
        print('----', path, n)
        r = ET.fromstring(z.read(n))
        for i, row in enumerate(r.iter(ROW)):
            if i >= maxrows:
                print('  ...(truncated)')
                break
            cells = []
            for c in row:
                v = c.find('m:v', NS)
                if v is None:
                    continue
                val = shared[int(v.text)] if c.get('t') == 's' else v.text
                cells.append(c.get('r') + '=' + str(val))
            if cells:
                print(' ', ' | '.join(cells))


for p in sys.argv[1:]:
    dump(p)
