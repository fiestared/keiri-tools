import json, sys, re, os

d = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "corpus.json")))
name = sys.argv[1]
needle = sys.argv[2]
span = int(sys.argv[3]) if len(sys.argv) > 3 else 900
txt = d[name]
start = 0
n = 0
while True:
    i = txt.find(needle, start)
    if i < 0:
        break
    n += 1
    print("=== hit " + str(n) + " @ " + str(i) + " ===")
    print(txt[i:i + span])
    print()
    start = i + 1
    if n >= 4:
        break
if n == 0:
    print("NOT FOUND: " + needle)
