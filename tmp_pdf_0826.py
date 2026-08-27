import sys
try:
    import pdfplumber
except ImportError:
    print("NO pdfplumber")
    sys.exit(1)
with pdfplumber.open("tmp_genbutsu_2026.pdf") as pdf:
    print("pages", len(pdf.pages))
    for p in pdf.pages:
        t = p.extract_text() or ""
        print(t[:4000])
