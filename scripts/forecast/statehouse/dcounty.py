"""District by county vote totals from MIT Election Lab precinct files, to place each legislative district on the map.
usage: dcounty.py YEAR OUT_DIR ZIP [ZIP ...]"""
import sys, zipfile, re, os, collections
import pandas as pd
YEAR, OUT, ZIPS = sys.argv[1], sys.argv[2], sys.argv[3:]
WA = re.compile(r"LEGISLATIVE DISTRICT (\d+) - STATE (SENATOR|REPRESENTATIVE)(?: POS\. (\d))?", re.I)
def chamber_dist(office, district):
    o = str(office).upper().strip(); d = str(district).strip().upper()
    m = WA.match(o)
    if m: return ("senate" if m.group(2).upper() == "SENATOR" else "house"), m.group(1) + (f"-{m.group(3)}" if m.group(3) else "")
    if re.search(r"\bU\.?S\.?\b|CONGRESS", o): return None, None
    if o.startswith("STATE SENAT"): return "senate", d
    if o.startswith("STATE HOUSE") or o.startswith("STATE ASSEMBLY") or "HOUSE OF DELEGATES" in o or o.startswith("STATE REPRESENTATIVE"): return "house", d
    return None, None
def ndist(d):
    s = str(d).strip().upper()
    m = re.match(r"^0*(\d+)([A-Z]?)$", s)
    if m: return m.group(1) + m.group(2)
    m = re.match(r"^DISTRICT 0*(\d+) SEAT ([AB])$", s)
    if m: return f"{m.group(1)}{m.group(2)}"
    m = re.match(r"^0*(\d+)-(\d)$", s)
    if m: return f"{m.group(1)}-{m.group(2)}"
    return re.sub(r"\s+", " ", s)
COLS = ["office", "votes", "county_fips", "district", "stage", "special", "state_po"]
os.makedirs(OUT, exist_ok=True)
for zp in ZIPS:
    m = re.search(r"([a-z]{2})(?:24|22|-local)", os.path.basename(zp))
    st = m.group(1).upper() if m else os.path.basename(zp)[:2].upper()
    agg = collections.defaultdict(float)
    z = zipfile.ZipFile(zp)
    for n in [n for n in z.namelist() if n.endswith(".csv")]:
        with z.open(n) as f:
            for ch in pd.read_csv(f, usecols=lambda c: c.strip().lower() in COLS, dtype=str, chunksize=400000, encoding="latin-1", on_bad_lines="skip"):
                ch.columns = [c.strip().lower() for c in ch.columns]
                if "office" not in ch: break
                for c in COLS:
                    if c not in ch: ch[c] = ""
                up = ch.office.fillna("").str.upper()
                ch = ch[up.str.contains("STATE SENAT|STATE HOUSE|STATE ASSEMBLY|HOUSE OF DELEGATES|STATE REPRESENTATIVE|LEGISLATIVE DISTRICT", regex=True)]
                if ch.empty: continue
                ch = ch[ch.stage.fillna("GEN").str.upper().eq("GEN") & ~ch.special.astype(str).str.upper().eq("TRUE")]
                ch["votes"] = pd.to_numeric(ch.votes, errors="coerce").fillna(0)
                cd = [chamber_dist(o, d) for o, d in zip(ch.office, ch.district)]
                ch["chamber"] = [x[0] for x in cd]; ch["dist"] = [ndist(x[1]) if x[0] else None for x in cd]
                ch = ch[ch.chamber.notna()]
                for (c, d, cf), v in ch.groupby(["chamber", "dist", "county_fips"], dropna=False).votes.sum().items():
                    agg[(c, d, str(cf).split(".")[0].zfill(5))] += v
    if agg:
        pd.DataFrame([dict(state=st, chamber=k[0], district=k[1], fips=k[2], votes=v) for k, v in agg.items()]).to_csv(f"{OUT}/{st}_{YEAR}_dcounty.csv", index=False)
    print(st, YEAR, len(agg), flush=True)
