"""Every statewide poll as the pollster published it, for the race pages' poll tables.

The forecast counts each poll after its house effect and undecided handling; the race page tables show the poll as
published so the site never prints an adjusted number as a result. Reads the model's poll files: the per race csvs,
the Ohio and Michigan hook file and the inline Ohio and Michigan lists in senate_mode.py.
usage: python3 -I build_published_polls.py MODEL_DIR POLL_FILES_JSON SITE"""
import sys, os, re, csv, json, glob, ast
M, FILES, SITE = sys.argv[1:4]
files = json.load(open(FILES))["files"]
for f in glob.glob(f"{M}/**/polls_*.csv", recursive=True):
    if "backtest" in f: continue
    k = re.sub(r"_block$", "", os.path.basename(f)[6:-4]).upper()
    files.setdefault(k, f)
num = lambda v: float(v) if str(v).strip() not in ("", "None", "nan") else None
out = {}
def add(key, src, end, n, R, D):
    rid = ("gov-" + key[:-1]) if key.endswith("G") and len(key) == 3 else ("sen-" + key)
    if R is None or D is None or re.search(r"wedgewood", src or "", re.I): return
    L = out.setdefault(rid, [])
    row = {"p": src, "end": end, "n": int(float(n)) if n not in (None, "") else 0, "R": R, "D": D}
    if row not in L: L.append(row)
for k, f in sorted(files.items()):
    if not os.path.exists(f) or not re.fullmatch(r"[A-Z]{2}G?", k): continue
    for r in csv.DictReader(open(f)):
            add(k, (r.get("source") or "").strip(), r.get("end"), r.get("n"), num(r.get("R")), num(r.get("D")))
h = json.load(open(f"{M}/polls_oct12_hook.json"))
for st, rows in h.items():
    for r in rows:
        add(st, r.get("source") or r.get("pollster"), str(r.get("end")), r.get("n"), num(r.get("R")), num(r.get("D")))
src = open(f"{M}/senate_mode.py").read()
for st in ("MI", "OH"):
    i = src.find(f'    "{st}": [')
    if i < 0: continue
    j = src.find("\n    ],", i)
    for m in re.finditer(r"dict\(([^()]*)\)", src[i:j]):
        try: d = eval("dict(" + m.group(1) + ")", {"dict": dict})
        except Exception: continue
        add(st, d.get("source"), d.get("end"), d.get("n"), d.get("R"), d.get("D"))
for L in out.values(): L.sort(key=lambda x: x["end"] or "", reverse=True)
os.makedirs(f"{SITE}/public/forecast", exist_ok=True)
json.dump(out, open(f"{SITE}/public/forecast/polls_published.json", "w"), separators=(",", ":"))
print(len(out), "races", sum(len(v) for v in out.values()), "polls")
