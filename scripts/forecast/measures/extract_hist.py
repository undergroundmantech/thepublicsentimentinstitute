"""Statewide ballot measure results by county, and 2024 presidential vote by county, from MIT Election Lab precinct files.
usage: extract_hist.py YEAR OUT ZIP [ZIP ...]"""
import sys, zipfile, re, collections, os
import pandas as pd
YEAR, OUT, ZIPS = sys.argv[1], sys.argv[2], sys.argv[3:]
YES = re.compile(r"^(YES|FOR|APPROVE|APPROVED|IN FAVOR|BOND YES|YES ON .*|FOR THE .*|FOR .*AMENDMENT.*|ADOPT|ADOPTED|RATIFY)$")
NO = re.compile(r"^(NO|AGAINST|REJECT|REJECTED|DISAPPROVE|NOT IN FAVOR|BOND NO|NO ON .*|AGAINST THE .*|AGAINST .*AMENDMENT.*)$")
MEAS = re.compile(r"AMENDMENT|PROPOSITION|QUESTION|MEASURE|ISSUE|PROPOSAL|INITIATIVE|REFERENDUM|REFERRED|BOND|PROP |STATE QUESTION|CONSTITUTIONAL|ACT|LAW|INITIATED|LEGISLATIVE|SQ ", re.I)
LOCAL = re.compile(r"COUNTY|CITY|TOWN|SCHOOL|DISTRICT|VILLAGE|BOROUGH|TOWNSHIP|PARISH|USD|ISD|ESD|FIRE|LIBRARY|WATER|SEWER|HOSPITAL|PARK|COLLEGE|MUNICIPAL|PRECINCT|WARD|CHARTER", re.I)
COLS = {"office", "candidate", "votes", "county_fips", "district", "stage", "state_po", "dataverse", "party_simplified", "year"}
meas = collections.defaultdict(float); pres = collections.defaultdict(float)
for zp in ZIPS:
    z = zipfile.ZipFile(zp)
    for n in [n for n in z.namelist() if n.endswith(".csv")]:
        with z.open(n) as f:
            for ch in pd.read_csv(f, usecols=lambda c: c.strip().lower() in COLS, dtype=str, chunksize=500000, encoding="latin-1", on_bad_lines="skip"):
                ch.columns = [c.strip().lower() for c in ch.columns]
                for c in COLS:
                    if c not in ch: ch[c] = ""
                ch = ch[ch.stage.fillna("GEN").str.upper().eq("GEN")]
                ch["votes"] = pd.to_numeric(ch.votes, errors="coerce").fillna(0)
                ch["cf"] = ch.county_fips.fillna("").astype(str).map(lambda v: v.split(".")[0].zfill(5))
                ch["office"] = ch.office.fillna("").astype(str).str.upper().str.strip()
                ch["cand"] = ch.candidate.fillna("").astype(str).str.upper().str.strip()
                if YEAR == "2024":
                    p = ch[ch.office == "US PRESIDENT"]
                    for (st, cf, ps), v in p.groupby(["state_po", "cf", p.party_simplified.fillna("").str.upper()]).votes.sum().items():
                        pres[(st, cf, "D" if ps.startswith("DEM") else "R" if ps.startswith("REP") else "O")] += v
                dist = ch.district.fillna("").astype(str).str.upper().str.strip()
                yn = ch.cand.str.match(YES) | ch.cand.str.match(NO)
                m = ch[yn & ch.office.str.contains(MEAS) & ~ch.office.str.contains(LOCAL) & (dist.isin(["STATEWIDE", "", "NAN", "000", "0"]))]
                if m.empty: continue
                side = m.cand.map(lambda c: "Y" if YES.match(c) else "N")
                for (st, off, cf, sd), v in m.assign(side=side).groupby(["state_po", "office", "cf", "side"]).votes.sum().items():
                    meas[(st, off, cf, sd)] += v
        print(os.path.basename(zp), len(meas), flush=True)
rows = {}
for (st, off, cf, sd), v in meas.items():
    r = rows.setdefault((st, off, cf), [0.0, 0.0]); r[0 if sd == "Y" else 1] += v
pd.DataFrame([dict(state=k[0], year=YEAR, office=k[1], fips=k[2], yes=v[0], no=v[1]) for k, v in rows.items()]).to_csv(f"{OUT}/measures_{YEAR}.csv", index=False)
if pres:
    pr = {}
    for (st, cf, p), v in pres.items(): pr.setdefault((st, cf), {"D": 0, "R": 0, "O": 0})[p] += v
    pd.DataFrame([dict(state=k[0], fips=k[1], D=v["D"], R=v["R"], O=v["O"]) for k, v in pr.items()]).to_csv(f"{OUT}/pres24_county.csv", index=False)
print("done", len(rows))
