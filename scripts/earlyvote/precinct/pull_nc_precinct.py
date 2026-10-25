#!/usr/bin/env python3
"""North Carolina early vote by precinct, against the same point in 2024.

Run it in Codespaces, where the state's download server can be reached:

    python3 scripts/earlyvote/precinct/pull_nc_precinct.py

It downloads four public files from the NC State Board of Elections into .cache/nc_precinct:
  the 2026 absentee and early voting file, every accepted ballot with the voter's party and precinct
  the 2024 absentee and early voting file, cut to the same number of days before the election
  the 2024 precinct results, for the Trump and Harris vote in each precinct
  the statewide voter file, to tie each precinct's name to the code the results use and count active voters

Then every precinct is placed in a band by its 2024 presidential margin, and the script reports, for each band,
how many early ballots have come in against the same day in 2024, and the 2024 margin of the precincts the early
voters come from. Output: public/earlyvote-precinct/NC.json, which the North Carolina early vote page reads.
Pass --no-download to reuse the files already in the cache.
"""
import csv, io, json, os, re, sys, urllib.request, zipfile
from collections import defaultdict
from datetime import date, datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
CACHE = os.path.join(ROOT, ".cache/nc_precinct")
OUT = os.path.join(ROOT, "public/earlyvote-precinct/NC.json")
S3 = "https://s3.amazonaws.com/dl.ncsbe.gov"
FILES = {
    "ev26": f"{S3}/ENRS/2026_11_03/absentee_20261103.zip",
    "ev24": f"{S3}/ENRS/2024_11_05/absentee_20241105.zip",
    "res24": f"{S3}/ENRS/2024_11_05/results_pct_20241105.zip",
    "voters": f"{S3}/data/ncvoter_Statewide.zip",
}
E26, E24 = date(2026, 11, 3), date(2024, 11, 5)
BANDS = [("Safe D", -999, -30), ("Lean D", -30, -10), ("Middle", -10, 10), ("Lean R", 10, 30), ("Safe R", 30, 999)]
csv.field_size_limit(1 << 30)


def fetch(key):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, os.path.basename(FILES[key]))
    if "--no-download" in sys.argv and os.path.exists(path):
        return path
    print(f"downloading {FILES[key]}", flush=True)
    req = urllib.request.Request(FILES[key], headers={"User-Agent": "Mozilla/5.0 OnPointPolitics research"})
    with urllib.request.urlopen(req, timeout=600) as r, open(path + ".part", "wb") as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    os.replace(path + ".part", path)
    return path


def rows(zpath):
    """Every row of the first text file in a zip, as dicts with lowercase keys, whatever the delimiter."""
    with zipfile.ZipFile(zpath) as z:
        name = [n for n in z.namelist() if n.lower().endswith((".txt", ".csv"))][0]
        with z.open(name) as raw:
            head = raw.read(4)
        enc = "utf-16" if head[:2] in (b"\xff\xfe", b"\xfe\xff") else "latin-1"
        with z.open(name) as raw:
            t = io.TextIOWrapper(raw, encoding=enc, newline="")
            first = t.readline()
            delim = "\t" if first.count("\t") > first.count(",") else ","
            cols = [c.strip().strip('"').lower() for c in next(csv.reader([first], delimiter=delim))]
            for rec in csv.reader(t, delimiter=delim):
                if rec:
                    yield dict(zip(cols, (x.strip() for x in rec)))


norm = lambda s: re.sub(r"[^A-Z0-9]", "", (s or "").upper())
county_key = lambda s: norm(s)


def pdate(s):
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except Exception:
            pass
    return None


def ok(r):
    st = (r.get("ballot_rtn_status") or "").upper()
    return st.startswith("ACCEPTED") and pdate(r.get("ballot_rtn_dt") or "") is not None


def party(r):
    p = (r.get("voter_party_code") or "").upper()
    return p if p in ("DEM", "REP", "UNA") else "OTH"


def main():
    for k in FILES:
        fetch(k)

    # precinct names to the codes the results file uses, and active voters by party in each precinct
    print("reading the voter file", flush=True)
    desc2code, active = {}, defaultdict(lambda: defaultdict(int))
    for r in rows(os.path.join(CACHE, os.path.basename(FILES["voters"]))):
        c, ab, ds = county_key(r.get("county_desc")), r.get("precinct_abbrv", ""), r.get("precinct_desc", "")
        if not c or not ab:
            continue
        desc2code.setdefault((c, norm(ds)), norm(ab))
        if (r.get("voter_status_desc") or "").upper() == "ACTIVE":
            active[(c, norm(ab))][party({"voter_party_code": r.get("party_cd")})] += 1

    # 2024 presidential vote by precinct
    print("reading the 2024 precinct results", flush=True)
    pres = defaultdict(lambda: {"D": 0, "R": 0, "T": 0})
    for r in rows(os.path.join(CACHE, os.path.basename(FILES["res24"]))):
        if (r.get("contest name") or "").upper() != "US PRESIDENT":
            continue
        if (r.get("real precinct") or "Y").upper() == "N":
            continue
        k = (county_key(r.get("county")), norm(r.get("precinct")))
        v = int(float(r.get("total votes") or 0))
        p = (r.get("choice party") or "").upper()
        pres[k]["T"] += v
        if p == "DEM":
            pres[k]["D"] += v
        elif p == "REP":
            pres[k]["R"] += v

    def key_of(r):
        c = county_key(r.get("county_desc"))
        d = norm(r.get("precinct_desc"))
        code = desc2code.get((c, d))
        if code and (c, code) in pres:
            return (c, code)
        if (c, d) in pres:
            return (c, d)
        return None

    # 2026 ballots so far; the as of day is the latest return date in the file
    print("reading the 2026 early vote", flush=True)
    ev26, asof, miss26, n26 = defaultdict(lambda: defaultdict(int)), None, 0, 0
    for r in rows(os.path.join(CACHE, os.path.basename(FILES["ev26"]))):
        if not ok(r):
            continue
        d = pdate(r["ballot_rtn_dt"])
        asof = d if asof is None or d > asof else asof
        n26 += 1
        k = key_of(r)
        if not k:
            miss26 += 1
            continue
        ev26[k][party(r)] += 1
        ev26[k]["mail" if "MAIL" in (r.get("ballot_req_type") or "").upper() else "inperson"] += 1
    days_out = (E26 - asof).days
    cut24 = date.fromordinal(E24.toordinal() - days_out)
    print(f"2026 ballots {n26}, as of {asof}, {days_out} days out; 2024 cut at {cut24}", flush=True)

    print("reading the 2024 early vote", flush=True)
    ev24, miss24, n24 = defaultdict(lambda: defaultdict(int)), 0, 0
    for r in rows(os.path.join(CACHE, os.path.basename(FILES["ev24"]))):
        if not ok(r) or pdate(r["ballot_rtn_dt"]) > cut24:
            continue
        n24 += 1
        k = key_of(r)
        if not k:
            miss24 += 1
            continue
        ev24[k][party(r)] += 1

    # every precinct with a 2024 result
    prec = []
    for k, v in pres.items():
        if v["T"] <= 0:
            continue
        m = 100.0 * (v["R"] - v["D"]) / v["T"]
        a26, a24 = ev26.get(k, {}), ev24.get(k, {})
        t26 = sum(a26.get(p, 0) for p in ("DEM", "REP", "UNA", "OTH"))
        t24 = sum(a24.get(p, 0) for p in ("DEM", "REP", "UNA", "OTH"))
        prec.append({"c": k[0], "p": k[1], "m24": round(m, 1), "v24": v["T"], "e26": t26, "e24": t24,
                     "d": a26.get("DEM", 0), "r": a26.get("REP", 0), "u": a26.get("UNA", 0), "o": a26.get("OTH", 0),
                     "act": sum(active.get(k, {}).values())})

    def summary(ps):
        e26, e24, v24 = sum(p["e26"] for p in ps), sum(p["e24"] for p in ps), sum(p["v24"] for p in ps)
        D, R, U = sum(p["d"] for p in ps), sum(p["r"] for p in ps), sum(p["u"] for p in ps)
        return {"precincts": len(ps), "ev26": e26, "ev24": e24, "votes24": v24,
                "pace": round(e26 / e24, 3) if e24 else None, "shareOf2024Vote": round(e26 / v24, 4) if v24 else None,
                "party": {"dem": D, "rep": R, "una": U, "oth": e26 - D - R - U}}

    bands = []
    for name, lo, hi in BANDS:
        ps = [p for p in prec if lo <= p["m24"] < hi]
        bands.append({"band": name, "lo": lo, "hi": hi, **summary(ps)})
    tot = summary(prec)
    # each band's pace against the state's: above 1 means that band is turning out faster than the state as a whole
    for b in bands:
        b["relPace"] = round(b["pace"] / tot["pace"], 3) if b["pace"] and tot["pace"] else None
    wm = lambda key: sum(p["m24"] * p[key] for p in prec) / max(1, sum(p[key] for p in prec))
    m26, m24e = wm("e26"), wm("e24")
    state24 = 100.0 * (sum(v["R"] for v in pres.values()) - sum(v["D"] for v in pres.values())) / max(1, sum(v["T"] for v in pres.values()))
    out = {
        "state": "NC", "asof": asof.isoformat(), "daysOut": days_out, "cut2024": cut24.isoformat(), "built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "source": "NC State Board of Elections absentee and early voting files, 2024 precinct results and voter file",
        "matched": {"ev26": round(1 - miss26 / max(1, n26), 4), "ev24": round(1 - miss24 / max(1, n24), 4), "n26": n26, "n24": n24},
        # the 2024 presidential margin of the precincts the early voters come from, R minus D, weighted by their ballots
        "precinctLean": {"ev26": round(m26, 2), "ev24": round(m24e, 2), "shift": round(m26 - m24e, 2), "state2024": round(state24, 2)},
        "total": tot, "bands": bands,
        "precincts": [[p["c"], p["p"], p["m24"], p["v24"], p["e26"], p["e24"], p["d"], p["r"], p["u"]] for p in prec],
        "cols": ["county", "precinct", "m24", "votes24", "ev26", "ev24", "dem", "rep", "una"],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"matched {out['matched']['ev26']:.1%} of 2026 ballots and {out['matched']['ev24']:.1%} of 2024 ballots to a precinct")
    print(f"early voters come from precincts that voted R{m26:+.1f} in 2024; at this point in 2024 it was R{m24e:+.1f}; shift {m26 - m24e:+.1f}")
    for b in bands:
        print(f"  {b['band']:7s} pace vs 2024 {b['pace']}  against the state {b['relPace']}  ballots {b['ev26']:,}  same day 2024 {b['ev24']:,}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
