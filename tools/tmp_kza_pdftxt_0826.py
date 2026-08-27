"""PDFの生テキストを読む。pdftotext が無い環境では pdfplumber / pypdf にフォールバックする。
ARTICLE_SPEC のとおり WebFetch は使わない（要約器を通さない）。"""
import shutil, subprocess, sys

path = sys.argv[1]
exe = shutil.which("pdftotext")
if exe:
    out = subprocess.run([exe, "-layout", path, "-"], capture_output=True)
    sys.stdout.write(out.stdout.decode("utf-8", "replace"))
    sys.exit(out.returncode)

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

if pdfplumber:
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            print("=== page %d ===" % i)
            print(page.extract_text() or "")
    sys.exit(0)

try:
    from pypdf import PdfReader
except ImportError:
    sys.stderr.write("pdftotext / pdfplumber / pypdf のいずれも無い＝測定不能\n")
    sys.exit(2)

for i, page in enumerate(PdfReader(path).pages, 1):
    print("=== page %d ===" % i)
    print(page.extract_text() or "")
