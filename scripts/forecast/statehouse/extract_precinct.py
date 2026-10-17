"""From MIT Election Lab precinct files: state legislative results by district, and the top of ticket vote
(president in 2024, governor or U.S. Senate in 2022) aggregated to each state legislative district through
the precincts that voted in that district. usage: extract_precinct.py YEAR ZIP_GLOB OUT_DIR"""
import sys, glob, zipfile, re, os, collections
import pandas as pd
YEAR, GL, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
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
COLS = ["precinct", "office", "party_simplified", "votes", "county_fips", "jurisdiction_fips", "candidate", "district", "stage", "special", "writein", "state_po", "magnitude", "party_detailed"]
for zp in sorted(glob.glob(GL)):
    st = None
    res = collections.defaultdict(float); mag = {}; pk_sl = collections.defaultdict(float); top = collections.defaultdict(float); top_office = None
    z = zipfile.ZipFile(zp)
    names = [n for n in z.namelist() if n.endswith(".csv")]
    offices_seen = set()
    for n in names:
        with z.open(n) as f:
            for ch in pd.read_csv(f, usecols=lambda c: c.strip().lower() in COLS, dtype=str, chunksize=400000, encoding="latin-1", on_bad_lines="skip"):
                ch.columns = [c.strip().lower() for c in ch.columns]
                if "office" not in ch: break
                for c in COLS:
                    if c not in ch: ch[c] = ""
                ch = ch[ch.stage.fillna("GEN").str.upper().eq("GEN")]
                ch["votes"] = pd.to_numeric(ch.votes, errors="coerce").fillna(0)
                pdt = ch.party_detailed.fillna("").str.upper()
                fix = ~ch.party_simplified.fillna("").str.upper().isin(["DEMOCRAT", "REPUBLICAN"]) & pdt.str.match(r"^DEMOCRATIC(-| )(FARMER|NONPARTISAN|NPL)")
                ch.loc[fix, "party_simplified"] = "DEMOCRAT"
                st = st or ch.state_po.dropna().iloc[0] if len(ch) else st
                up = ch.office.str.upper()
                offices_seen |= set(up.unique())
                tops = ch[up.isin(["US PRESIDENT", "GOVERNOR", "US SENATE"])]
                for (o, pc, cf, jf, pr), v in tops.groupby(["office", "party_simplified", "county_fips", "jurisdiction_fips", "precinct"], dropna=False).votes.sum().items():
                    top[(o.upper(), str(pc).upper(), cf, jf, pr)] += v
                cd = [chamber_dist(o, d) for o, d in zip(ch.office, ch.district)]
                ch["chamber"] = [x[0] for x in cd]; ch["dist"] = [ndist(x[1]) if x[0] else None for x in cd]
                sl = ch[ch.chamber.notna()]
                if sl.empty: continue
                for (c, d, sp, cand, p, w), v in sl.groupby(["chamber", "dist", "special", "candidate", "party_simplified", "writein"], dropna=False).votes.sum().items():
                    res[(c, d, str(sp).upper() == "TRUE", cand, str(p).upper(), str(w).upper() == "TRUE")] += v
                for (c, d), m in sl.groupby(["chamber", "dist"]).magnitude.first().items():
                    try: mag[(c, d)] = max(mag.get((c, d), 1), int(float(m)))
                    except Exception: mag.setdefault((c, d), 1)
                for (c, d, cf, jf, pr), v in sl[~sl.special.astype(str).str.upper().eq("TRUE")].groupby(["chamber", "dist", "county_fips", "jurisdiction_fips", "precinct"], dropna=False).votes.sum().items():
                    pk_sl[(c, d, cf, jf, pr)] += v
    if not res: print(os.path.basename(zp), "no legislative rows"); continue
    # top of ticket office for the year
    tops_avail = {k[0] for k in top}
    tof = "US PRESIDENT" if "US PRESIDENT" in tops_avail else "GOVERNOR" if "GOVERNOR" in tops_avail else "US SENATE" if "US SENATE" in tops_avail else None
    # each precinct to its district, per chamber: the district with the most legislative votes there
    best = {}
    for (c, d, cf, jf, pr), v in pk_sl.items():
        k = (c, cf, jf, pr)
        if k not in best or v > best[k][1]: best[k] = (d, v)
    agg = collections.defaultdict(lambda: [0.0, 0.0, 0.0])
    if tof:
        for (o, pc, cf, jf, pr), v in top.items():
            if o != tof: continue
            for c in ("house", "senate"):
                b = best.get((c, cf, jf, pr))
                if not b: continue
                i = 0 if pc.startswith("DEM") else 1 if pc.startswith("REP") else 2
                agg[(c, b[0])][i] += v
    r = pd.DataFrame([dict(chamber=k[0], district=k[1], special=k[2], candidate=k[3], party=k[4], writein=k[5], votes=v) for k, v in res.items()])
    r["magnitude"] = [mag.get((c, d), 1) for c, d in zip(r.chamber, r.district)]
    t = pd.DataFrame([dict(chamber=k[0], district=k[1], top_office=tof, top_d=v[0], top_r=v[1], top_o=v[2]) for k, v in agg.items()])
    stc = os.path.basename(zp)[:2].upper() if os.path.basename(zp)[:2].isalpha() else st
    stc = re.search(r"([a-z]{2})(?:24|22|-local)", os.path.basename(zp)).group(1).upper() if re.search(r"([a-z]{2})(?:24|22|-local)", os.path.basename(zp)) else stc
    r.insert(0, "state", stc); r.insert(1, "year", YEAR); t.insert(0, "state", stc); t.insert(1, "year", YEAR)
    r.to_csv(f"{OUT}/{stc}_{YEAR}_results.csv", index=False); t.to_csv(f"{OUT}/{stc}_{YEAR}_top.csv", index=False)
    print(stc, YEAR, tof, len(r), "result rows", len(t), "districts with top of ticket", flush=True)
