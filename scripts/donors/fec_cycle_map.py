"""FEC donor map for one cycle: every itemized individual gift to House, Senate and presidential candidates, ActBlue and
WinRed earmarks included, placed in the county the donor lives in. Run it in GitHub Codespaces; the On Point sandbox cannot
reach fec.gov or census.gov.

  python3 scripts/donors/fec_cycle_map.py --cycle 2024
  python3 scripts/donors/fec_cycle_map.py --cycle 2022
  python3 scripts/donors/fec_cycle_map.py --cycle 2026      # the same method on this cycle, for a like for like comparison

Method, the same rules as the October 20 2026 map:
  candidate committees: each candidate's principal and authorized committees for the cycle (ccl, designation P or A)
  campaign rows: receipts from individuals (entity IND) of type 15, 15E and refunds 22Y, memo rows (memo code X) dropped,
                 and earmark copies dropped: any 15E row, or any row whose memo or other id names ActBlue or WinRed, since
                 the platform's own line for the same gift is counted instead
  platform rows: every ActBlue (C00401224) and WinRed (C00694323) individual line whose memo names the recipient committee,
                 "EARMARKED FOR ... (C00123456)", credited to that committee's candidate
  bands by the size of each gift: under $200, $200 to $999, $1,000 to $2,499, $2,500 and up; refunds come off the dollars
  ZIP codes are placed in 2020 counties by the land area each ZIP code tabulation area has in each county (Census 2020
  ZCTA to county relationship file); ZIP codes that are not ZCTAs, mostly PO boxes, are reported as unmatched
  two windows: through Sep 30 of the election year, to compare with 2026 at the same point, and the full cycle
Outputs, in scripts/forecast/donors/data/cycles/<cycle>/ (commit and push these, about 5 to 20 MB):
  candidates.json    one row per candidate: totals, donations, home state share and bands, for both windows
  counties.json      every county: donations and dollars by band, Democratic and Republican dollars by band, overall and by
                     office (House, Senate, President), plus the top candidates
  cand_county.json.gz every candidate with $100,000 or more: dollars by band in every county, both windows
  meta.json          rows read, kept and dropped by rule, unmatched ZIP dollars, file dates
Needs about 15 GB of free disk for 2024 (the indiv file is large; it is read straight from the zip, never unpacked) and
4 GB of memory. Downloads are cached in --work, so a rerun does not download again. Takes 20 to 60 minutes.
"""
import argparse, csv, gzip, io, json, os, re, sys, time, urllib.request, zipfile
from collections import defaultdict

import pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument("--cycle", type=int, required=True)
ap.add_argument("--work", default=os.path.expanduser("~/donorwork"))
ap.add_argument("--out", default=None)
ap.add_argument("--chunk", type=int, default=2_000_000)
ap.add_argument("--offices", default="H,S,P")
ap.add_argument("--min-county", type=float, default=100_000, help="candidates at or above this many dollars get a county file entry")
A = ap.parse_args()
CY, YY = A.cycle, str(A.cycle)[2:]
WORK = os.path.join(A.work, str(CY)); os.makedirs(WORK, exist_ok=True)
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = A.out or os.path.join(REPO, "scripts", "forecast", "donors", "data", "cycles", str(CY)); os.makedirs(OUT, exist_ok=True)
OFFICES = set(A.offices.split(","))
CONDUITS = {"C00401224": "actblue", "C00694323": "winred"}
SEP30 = int(f"{CY}0930")
START = int(f"{CY - 1}0101")
BULK = f"https://www.fec.gov/files/bulk-downloads/{CY}"
FILES = {"indiv": f"{BULK}/indiv{YY}.zip", "cn": f"{BULK}/cn{YY}.zip", "ccl": f"{BULK}/ccl{YY}.zip", "cm": f"{BULK}/cm{YY}.zip"}
XWALK = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt"
UA = {"User-Agent": "OnPointPolitics donor map research (onpointpolitics.com)"}


def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        log("cached", os.path.basename(dest)); return dest
    log("downloading", url)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r, open(dest + ".part", "wb") as f:
        total = int(r.headers.get("Content-Length") or 0); got = 0; t0 = time.time()
        while True:
            b = r.read(1 << 22)
            if not b: break
            f.write(b); got += len(b)
            if time.time() - t0 > 15: log(f"  {got / 1e9:.2f} of {total / 1e9:.2f} GB"); t0 = time.time()
    os.replace(dest + ".part", dest)
    return dest


def zread(path, cols, **kw):
    z = zipfile.ZipFile(path); name = max(z.namelist(), key=lambda n: z.getinfo(n).file_size)
    return pd.read_csv(z.open(name), sep="|", header=None, names=cols, dtype=str, quoting=csv.QUOTE_NONE, encoding="latin-1", on_bad_lines="skip", **kw)


# ------------------------------------------------------------- candidates and their committees
paths = {k: fetch(u, os.path.join(WORK, os.path.basename(u))) for k, u in FILES.items()}
xw = fetch(XWALK, os.path.join(A.work, "tab20_zcta520_county20_natl.txt"))
CN = ["CAND_ID", "CAND_NAME", "CAND_PTY_AFFILIATION", "CAND_ELECTION_YR", "CAND_OFFICE_ST", "CAND_OFFICE", "CAND_OFFICE_DISTRICT", "CAND_ICI", "CAND_STATUS", "CAND_PCC", "CAND_ST1", "CAND_ST2", "CAND_CITY", "CAND_ST", "CAND_ZIP"]
CCL = ["CAND_ID", "CAND_ELECTION_YR", "FEC_ELECTION_YR", "CMTE_ID", "CMTE_TP", "CMTE_DSGN", "LINKAGE_ID"]
cn = zread(paths["cn"], CN)
cn = cn[cn.CAND_OFFICE.isin(OFFICES)]
cn_cy = cn[cn.CAND_ELECTION_YR == str(CY)]
ccl = zread(paths["ccl"], CCL)
ccl = ccl[ccl.CMTE_DSGN.isin(["P", "A"]) & ccl.CAND_ID.isin(set(cn.CAND_ID))]
cmte2cand = dict(zip(ccl.CMTE_ID, ccl.CAND_ID))
CAND = {r.CAND_ID: r for r in cn.itertuples()}
log(f"{len(cn_cy)} candidates on the {CY} ballot cycle, {len(cmte2cand)} committees linked")

# ------------------------------------------------------------- the gifts
IND = ["CMTE_ID", "AMNDT_IND", "RPT_TP", "TRANSACTION_PGI", "IMAGE_NUM", "TRANSACTION_TP", "ENTITY_TP", "NAME", "CITY", "STATE", "ZIP_CODE", "EMPLOYER", "OCCUPATION",
       "TRANSACTION_DT", "TRANSACTION_AMT", "OTHER_ID", "TRAN_ID", "FILE_NUM", "MEMO_CD", "MEMO_TEXT", "SUB_ID"]
USE = ["CMTE_ID", "TRANSACTION_TP", "ENTITY_TP", "STATE", "ZIP_CODE", "TRANSACTION_DT", "TRANSACTION_AMT", "OTHER_ID", "MEMO_CD", "MEMO_TEXT"]
cmtes = set(cmte2cand); conduits = set(CONDUITS)
stats = defaultdict(float)
parts = []
EAR = re.compile(r"\((C\d{8})\)")
BAD = re.compile(r"ACTBLUE|WINRED|EARMARK", re.I)
z = zipfile.ZipFile(paths["indiv"]); inner = max(z.namelist(), key=lambda n: z.getinfo(n).file_size)
log("reading", inner, f"{z.getinfo(inner).file_size / 1e9:.1f} GB unpacked")
reader = pd.read_csv(z.open(inner), sep="|", header=None, names=IND, usecols=USE, dtype=str, quoting=csv.QUOTE_NONE, encoding="latin-1", on_bad_lines="skip", chunksize=A.chunk)
for k, ch in enumerate(reader):
    stats["rows_read"] += len(ch)
    ch = ch[ch.CMTE_ID.isin(cmtes | conduits)]
    if not len(ch): continue
    ch = ch[ch.ENTITY_TP == "IND"]
    amt = pd.to_numeric(ch.TRANSACTION_AMT, errors="coerce").fillna(0.0)
    dt = ch.TRANSACTION_DT.fillna("")
    # MMDDYYYY to YYYYMMDD
    ymd = pd.to_numeric(dt.str[4:8] + dt.str[0:2] + dt.str[2:4], errors="coerce").fillna(0).astype("int64")
    memo = ch.MEMO_TEXT.fillna("")
    plat = ch.CMTE_ID.isin(conduits)
    # platform lines: the recipient committee is in the memo
    rcp = memo.where(plat, "").str.extract(EAR, expand=False)
    plat_ok = plat & rcp.isin(cmtes)
    stats["platform_rows_unlinked"] += float((plat & ~plat_ok).sum())
    # campaign lines
    camp = ~plat & ch.TRANSACTION_TP.isin(["15", "15E", "22Y"]) & (ch.MEMO_CD.fillna("") != "X")
    dup = camp & ((ch.TRANSACTION_TP == "15E") | ch.OTHER_ID.fillna("").isin(conduits) | memo.str.contains(BAD))
    stats["campaign_earmark_copies_dropped_usd"] += float(amt[dup].sum()); stats["campaign_earmark_copies_dropped_n"] += float(dup.sum())
    camp = camp & ~dup
    keep = plat_ok | camp
    if not keep.any(): continue
    cmte = ch.CMTE_ID.where(~plat_ok, rcp)
    d = pd.DataFrame({"cand": cmte[keep].map(cmte2cand), "zip": ch.ZIP_CODE[keep].fillna("").str[:5], "st": ch.STATE[keep].fillna(""),
                      "amt": amt[keep].where(ch.TRANSACTION_TP[keep] != "22Y", -amt[keep].abs()), "ymd": ymd[keep], "plat": plat_ok[keep]})
    d = d[(d.ymd >= START) & (d.ymd <= int(f"{CY}1231"))]
    a = d.amt.abs()
    d["band"] = (a >= 200).astype(int) + (a >= 1000).astype(int) + (a >= 2500).astype(int)
    d["cnt"] = (d.amt > 0).astype(int)
    d["sep"] = d.ymd <= SEP30
    stats["platform_usd"] += float(d.amt[d.plat].sum()); stats["campaign_usd"] += float(d.amt[~d.plat].sum())
    g = d.groupby(["cand", "zip", "band", "sep"], sort=False).agg(usd=("amt", "sum"), n=("cnt", "sum")).reset_index()
    gs = d.groupby(["cand", "st"], sort=False).amt.sum().reset_index()
    parts.append((g, gs))
    if len(parts) >= 12:
        g = pd.concat([p[0] for p in parts]).groupby(["cand", "zip", "band", "sep"], sort=False)[["usd", "n"]].sum().reset_index()
        gs = pd.concat([p[1] for p in parts]).groupby(["cand", "st"], sort=False).amt.sum().reset_index()
        parts = [(g, gs)]
    log(f"chunk {k + 1}: {stats['rows_read'] / 1e6:.0f}M rows read, kept so far {stats['platform_usd'] / 1e6:.0f}M platform and {stats['campaign_usd'] / 1e6:.0f}M campaign dollars")
G = pd.concat([p[0] for p in parts]).groupby(["cand", "zip", "band", "sep"], sort=False)[["usd", "n"]].sum().reset_index()
GS = pd.concat([p[1] for p in parts]).groupby(["cand", "st"], sort=False).amt.sum().reset_index()
log(f"{len(G):,} candidate, ZIP, band cells")

# ------------------------------------------------------------- ZIP codes to counties by land area
X = pd.read_csv(xw, sep="|", dtype=str)
X = X.rename(columns={c: c.upper() for c in X.columns})
zc, cc, land = next(c for c in X.columns if "ZCTA5" in c and "GEOID" in c), next(c for c in X.columns if "COUNTY" in c and "GEOID" in c), next(c for c in X.columns if "AREALAND_PART" in c)
X = X[X[zc].notna() & X[cc].notna()][[zc, cc, land]].rename(columns={zc: "zip", cc: "fips", land: "land"})
X["land"] = pd.to_numeric(X.land, errors="coerce").fillna(0.0)
X["w"] = X.land / X.groupby("zip").land.transform("sum").replace(0, 1)
M = G.merge(X[["zip", "fips", "w"]], on="zip", how="left")
unm = M[M.fips.isna()]
stats["unmatched_zip_usd"] = float(unm.usd.sum()); stats["matched_usd"] = float(M[M.fips.notna()].usd.sum())
M = M[M.fips.notna()].copy(); M["usd"] *= M.w; M["n"] *= M.w

# ------------------------------------------------------------- outputs
def party(cid):
    p = (CAND[cid].CAND_PTY_AFFILIATION if cid in CAND else "") or ""
    return "D" if p in ("DEM", "DFL") else "R" if p == "REP" else "O"


cands = []
for cid, sub in G.groupby("cand"):
    c = CAND.get(cid)
    if c is None: continue
    row = {"cand_id": cid, "name": c.CAND_NAME, "party": c.CAND_PTY_AFFILIATION, "p": party(cid), "office": c.CAND_OFFICE, "state": c.CAND_OFFICE_ST,
           "district": c.CAND_OFFICE_DISTRICT, "election_yr": c.CAND_ELECTION_YR, "ici": c.CAND_ICI}
    for w, sel in (("full", slice(None)), ("sep30", sub.sep)):
        s = sub if w == "full" else sub[sub.sep]
        b = s.groupby("band")[["usd", "n"]].sum().reindex(range(4), fill_value=0)
        row[w] = {"usd": round(float(s.usd.sum())), "n": int(s.n.sum()), "bands_usd": [round(float(x)) for x in b.usd], "bands_n": [int(x) for x in b.n]}
    home = GS[(GS.cand == cid)]
    tot = float(home.amt.sum()); row["home_state_share"] = round(float(home[home.st == c.CAND_OFFICE_ST].amt.sum()) / tot, 4) if tot > 0 and c.CAND_OFFICE != "P" else None
    cands.append(row)
cands.sort(key=lambda r: -r["full"]["usd"])
json.dump(cands, open(os.path.join(OUT, "candidates.json"), "w"), separators=(",", ":"))

PTY = {c["cand_id"]: c["p"] for c in cands}
OFFC = {c["cand_id"]: c["office"] for c in cands}
M["p"] = M.cand.map(PTY).fillna("O")
M["o"] = M.cand.map(OFFC).fillna("X")
NAMES = {c["cand_id"]: [c["name"], c["p"], c["office"], c["state"], c["district"]] for c in cands}
COLS = pd.MultiIndex.from_product([["usd", "n"], range(4)])


def cells(S):
    """fips -> {usd[4], n[4], D[4], R[4]} for one slice of the rows; other parties are usd minus D minus R"""
    a = S.groupby(["fips", "band"])[["usd", "n"]].sum().unstack("band", fill_value=0).reindex(columns=COLS, fill_value=0)
    out = {f: {"usd": [round(float(x)) for x in r["usd"]], "n": [round(float(x)) for x in r["n"]]} for f, r in a.iterrows()}
    for p in ("D", "R"):
        b = S[S.p == p].groupby(["fips", "band"]).usd.sum().unstack("band", fill_value=0).reindex(columns=range(4), fill_value=0)
        for f, r in b.iterrows(): out[f][p] = [round(float(x)) for x in r]
    for v in out.values():
        v.setdefault("D", [0] * 4); v.setdefault("R", [0] * 4)
    return out


# counties: fips -> {full|sep30: {all|H|S|P: cell, top: [[cand, usd], ...]}}
counties = {}
for w in ("full", "sep30"):
    S = M if w == "full" else M[M.sep]
    for scope in ["all"] + sorted(OFFICES):
        for f, cell in cells(S if scope == "all" else S[S.o == scope]).items():
            counties.setdefault(f, {}).setdefault(w, {})[scope] = cell
    top = S.groupby(["fips", "cand"]).usd.sum().reset_index().sort_values("usd", ascending=False).groupby("fips").head(6)
    for r in top.itertuples():
        counties.setdefault(r.fips, {}).setdefault(w, {}).setdefault("top", []).append([r.cand, round(float(r.usd))])
json.dump({"layout": "fips -> window (full, sep30) -> office (all, H, S, P) -> {usd[4], n[4], D[4], R[4]} by gift band; top: [cand, usd]",
           "names": NAMES, "counties": counties}, open(os.path.join(OUT, "counties.json"), "w"), separators=(",", ":"))

big = {c["cand_id"] for c in cands if c["full"]["usd"] >= A.min_county}
cc_out = {}
CC = M[M.cand.isin(big)].groupby(["cand", "fips", "sep", "band"]).usd.sum()
for (cid, f, sep, b), v in CC.items():
    e = cc_out.setdefault(cid, {}).setdefault(f, [0] * 8)
    e[b] += round(float(v))            # full cycle, bands 0 to 3
    if sep: e[4 + b] += round(float(v))  # through Sep 30, bands 0 to 3
with gzip.open(os.path.join(OUT, "cand_county.json.gz"), "wt") as f: json.dump(cc_out, f, separators=(",", ":"))

meta = {"cycle": CY, "window": [f"{CY - 1}-01-01", f"{CY}-12-31"], "sep30": f"{CY}-09-30", "built": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "files": {k: {"url": u, "bytes": os.path.getsize(paths[k]), "modified": time.ctime(os.path.getmtime(paths[k]))} for k, u in FILES.items()},
        "candidates": len(cands), "cand_county_candidates": len(cc_out), "counties": len(counties), "layout": "cand_county: cand -> fips -> [full b1..b4, sep30 b1..b4] dollars",
        "bands": ["Under $200", "$200 to $999", "$1,000 to $2,499", "$2,500 and up"], "stats": {k: round(v) for k, v in stats.items()},
        "unmatched_share": round(stats["unmatched_zip_usd"] / max(1.0, stats["unmatched_zip_usd"] + stats["matched_usd"]), 4),
        "method": __doc__.split("Outputs")[0].strip()}
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
log("done:", OUT, json.dumps(meta["stats"]), "unmatched share", meta["unmatched_share"])
