"""Small donors for the donor map: every ActBlue and WinRed gift that the FEC's bulk file leaves out.

Why: the FEC bulk individual file only carries a donor once their total to a committee passes $200 (for ActBlue and WinRed,
$200 in the calendar year). ActBlue and WinRed still itemize every earmarked gift in their own monthly reports, with the
donor's ZIP code and the campaign it went to. This script reads those raw reports, keeps the gifts the bulk file skipped
(the donor's running total at ActBlue or WinRed was $200 or less), credits each to the candidate it was earmarked for and
adds them to the cycle outputs that fec_cycle_map.py wrote. Gifts that go straight to a campaign without ActBlue or WinRed
and stay under $200 are never itemized anywhere; the script also pulls each candidate's unitemized total from the FEC so
the map can show that number next to the candidate, unmapped.

Run in GitHub Codespaces (the On Point sandbox cannot reach fec.gov), after fec_cycle_map.py for the same cycle:

  The FEC key is picked up from a Codespaces secret or environment variable named FEC_API_KEY (or FEC_KEY, OPENFEC_API_KEY,
  API_DATA_GOV_KEY), or from that line in a .env or .env.local file at the repo root. It is only read, never written.
  python3 scripts/donors/conduit_pull.py --cycle 2026
  python3 scripts/donors/conduit_pull.py --cycle 2024
  python3 scripts/donors/conduit_pull.py --cycle 2022

Each monthly report is streamed straight from docquery.fec.gov and never saved; ActBlue's run to several GB each, so a
cycle takes a few hours. Progress is saved after every report in --work/<cycle>/conduit/, so a rerun picks up where it
stopped. Disk use stays under 1 GB. When every report is read, the small gifts are merged into
scripts/forecast/donors/data/cycles/<cycle>/ (counties.json, candidates.json, cand_county.json.gz, meta.json). The first
merge keeps the bulk only versions as *.bulk.json(.gz), and every later merge starts from those, so running it twice never
counts a gift twice. Rerunning fec_cycle_map.py replaces the bulk versions; run this again afterward.
Options: --merge-only to merge what has been read so far, --limit N to read only N reports (for a test).
"""
import argparse, csv, gzip, io, json, os, re, shutil, sys, time, urllib.parse, urllib.request, zipfile
from collections import defaultdict

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fec_links  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--cycle", type=int, required=True)
ap.add_argument("--work", default=os.path.expanduser("~/donorwork"))
ap.add_argument("--out", default=None)
ap.add_argument("--offices", default="H,S,P")
ap.add_argument("--limit", type=int, default=0)
ap.add_argument("--merge-only", action="store_true")
ap.add_argument("--chunk", type=int, default=1_000_000)
ap.add_argument("--no-unitemized", action="store_true", help="skip the FEC candidate totals call")
A = ap.parse_args()
CY, YY = A.cycle, str(A.cycle)[2:]
WORK = os.path.join(A.work, str(CY)); CW = os.path.join(WORK, "conduit"); os.makedirs(CW, exist_ok=True)
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = A.out or os.path.join(REPO, "scripts", "forecast", "donors", "data", "cycles", str(CY))
OFFICES = set(A.offices.split(","))
CONDUITS = {"C00401224": "ActBlue", "C00694323": "WinRed"}
START, END, SEP30 = int(f"{CY - 1}0101"), int(f"{CY}1231"), int(f"{CY}0930")
NAMES_ = ["FEC_API_KEY", "FEC_KEY", "OPENFEC_API_KEY", "OPEN_FEC_API_KEY", "API_DATA_GOV_KEY", "DATA_GOV_API_KEY", "DATAGOV_API_KEY"]


def find_key():
    """The FEC key from the environment (a Codespaces secret shows up there) or from a .env file in the repo. It is only
    read, never written anywhere, and only its source is printed."""
    for n in NAMES_:
        if os.environ.get(n): return os.environ[n].strip(), f"environment variable {n}"
    for f in (".env", ".env.local", ".env.development.local", ".env.production.local"):
        p = os.path.join(REPO, f)
        if not os.path.exists(p): continue
        for line in open(p, encoding="utf-8", errors="ignore"):
            k, _, v = line.strip().removeprefix("export ").partition("=")
            if k.strip() in NAMES_ and v.strip(): return v.strip().strip('"').strip("'"), f"{k.strip()} in {f}"
    return "DEMO_KEY", None


KEY, KEY_FROM = find_key()
API = "https://api.open.fec.gov/v1"
BULK = f"https://www.fec.gov/files/bulk-downloads/{CY}"
XWALK = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt"
UA = {"User-Agent": "OnPointPolitics donor map research (onpointpolitics.com)"}
EAR = re.compile(r"(C\d{8})")


def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0: return dest
    log("downloading", url)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(dest + ".part", "wb") as f: shutil.copyfileobj(r, f, 1 << 22)
    os.replace(dest + ".part", dest); return dest


def api(path, **q):
    q["api_key"] = KEY
    url = f"{API}{path}?{urllib.parse.urlencode(q, doseq=True)}"
    for k in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r: return json.load(r)
        except Exception as e:  # rate limits and timeouts: wait and retry
            log("  api retry", k + 1, str(e)[:80]); time.sleep(10 * (k + 1))
    raise RuntimeError(f"FEC API failed: {path}")


def zread(path, cols):
    z = zipfile.ZipFile(path); name = max(z.namelist(), key=lambda n: z.getinfo(n).file_size)
    return pd.read_csv(z.open(name), sep="|", header=None, names=cols, dtype=str, quoting=csv.QUOTE_NONE, encoding="latin-1", on_bad_lines="skip")


# ------------------------------------------------------------- committees to candidates, the same rules as fec_cycle_map.py
cn = zread(fetch(f"{BULK}/cn{YY}.zip", os.path.join(WORK, f"cn{YY}.zip")), ["CAND_ID", "CAND_NAME", "CAND_PTY_AFFILIATION", "CAND_ELECTION_YR", "CAND_OFFICE_ST", "CAND_OFFICE", "CAND_OFFICE_DISTRICT", "CAND_ICI", "CAND_STATUS", "CAND_PCC", "CAND_ST1", "CAND_ST2", "CAND_CITY", "CAND_ST", "CAND_ZIP"])
cn = cn[cn.CAND_OFFICE.isin(OFFICES)]
ccl = zread(fetch(f"{BULK}/ccl{YY}.zip", os.path.join(WORK, f"ccl{YY}.zip")), ["CAND_ID", "CAND_ELECTION_YR", "FEC_ELECTION_YR", "CMTE_ID", "CMTE_TP", "CMTE_DSGN", "LINKAGE_ID"])
cm = zread(fetch(f"{BULK}/cm{YY}.zip", os.path.join(WORK, f"cm{YY}.zip")), fec_links.CM)
cmte2cand, CAND, SPLIT = fec_links.build(cn, ccl, cm, CY, log)
log(f"{len(cmte2cand)} committees linked to {len(set(cmte2cand.values()))} candidates")
log(f"FEC key: from {KEY_FROM}" if KEY_FROM else "FEC key: none found, using DEMO_KEY, which is very slow. Looked for " + ", ".join(NAMES_) + " in the environment and in .env files at the repo root.")


# ------------------------------------------------------------- the reports
def reports():
    out = []
    for cid, nm in CONDUITS.items():
        page = 1
        while True:
            j = api("/filings/", committee_id=cid, form_type="F3X", most_recent="true", per_page=100, page=page, sort="coverage_start_date",
                    min_receipt_date=f"{CY - 1}-01-01", max_receipt_date=f"{CY + 1}-03-01")
            for f in j.get("results", []):
                cs, ce = (f.get("coverage_start_date") or "")[:10], (f.get("coverage_end_date") or "")[:10]
                if not cs or int(ce.replace("-", "") or 0) < START or int(cs.replace("-", "")) > END: continue
                out.append({"conduit": nm, "file": int(f["file_number"]), "start": cs, "end": ce, "receipts": f.get("total_receipts")})
            if page >= (j.get("pagination") or {}).get("pages", 1): break
            page += 1
    out.sort(key=lambda r: (r["conduit"], r["start"]))
    return out


def detect(rows):
    """Find the ZIP, date, amount and aggregate columns in Schedule A rows, whatever the format version."""
    DT, ZP = re.compile(r"(19|20)\d{6}"), re.compile(r"\d{5}(\d{4})?")
    frac = lambda c, rx: sum(1 for f in rows if c < len(f) and rx.fullmatch(f[c])) / max(1, len(rows))
    date = max(range(10, 30), key=lambda c: frac(c, DT))
    zipc = max(range(10, date), key=lambda c: frac(c, ZP))
    return {"date": date, "amt": date + 1, "agg": date + 2, "zip": zipc}


def read_report(r):
    url = f"https://docquery.fec.gov/dcdev/posted/{r['file']}.fec"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as resp:
        return parse_stream(io.TextIOWrapper(resp, encoding="latin-1", newline=""), r)


def parse_stream(text, r):
    """Read a report line by line: no big tables in memory, and only Schedule A individual lines are split."""
    agg = {}  # (candidate, ZIP, through Sep 30) -> [dollars, gifts]
    st = defaultdict(float)
    first = text.readline()
    FS = "\x1c" if "\x1c" in first else None
    split = (lambda line: line.rstrip("\r\n").split(FS)) if FS else (lambda line: next(csv.reader([line])))
    cols, buf, t0, lines = None, [], time.time(), 0

    def take(f):
        try:
            amt = float(f[cols["amt"]] or 0); ag = float(f[cols["agg"]] or 0); ymd = int(f[cols["date"]][:8] or 0)
        except (ValueError, IndexError):
            st["bad"] += 1; return
        st["rows"] += 1
        if ag > 200: st["over_200_usd"] += amt; return
        if amt <= 0 or ymd < START or ymd > END: return
        rcp = next((x for x in EAR.findall("\x1f".join(f[cols["agg"] + 1:])) if x not in CONDUITS), None)
        cand = cmte2cand.get(rcp)
        if cand is None: st["unlinked_usd"] += amt; return
        cand = SPLIT(cand, ymd)
        k = (cand, f[cols["zip"]][:5], ymd <= SEP30)
        a = agg.get(k)
        if a is None: agg[k] = [amt, 1]
        else: a[0] += amt; a[1] += 1
        st["kept"] += 1; st["kept_usd"] += amt

    kinds = defaultdict(int)  # the form types seen, to explain a report with no individual gifts
    for line in text:
        lines += 1
        if lines <= 500_000: kinds[re.split(r"[\x1c,]", line.lstrip('"'), maxsplit=1)[0].strip('"').upper()[:8]] += 1
        if lines % 2_000_000 == 0:
            log(f"  {r['conduit']} {r['start']}: {lines / 1e6:.0f}M lines, {st['rows'] / 1e6:.1f}M individual gifts, {st['kept'] / 1e6:.2f}M small ones kept, ${st['kept_usd'] / 1e6:.1f}M, {lines / max(1, time.time() - t0) / 1e3:.0f}K lines a second")
        if not line.lstrip('"')[:6].upper().startswith("SA11A"): continue
        f = split(line)
        if cols is None:
            buf.append(f)
            if len(buf) < 3000: continue
            cols = detect(buf); log("  columns", cols)
            for g in buf: take(g)
            buf = []
            continue
        take(f)
    if cols is None and buf:
        cols = detect(buf); log("  columns", cols)
        for g in buf: take(g)
    if not st["rows"]:
        top = ", ".join(f"{k} {v:,}" for k, v in sorted(kinds.items(), key=lambda x: -x[1])[:8])
        raise RuntimeError(f"no individual gift lines in {lines:,} lines; line types seen: {top or 'none'}; first line: {first[:120]!r}")
    rows = [[c, z, "", bool(sp), round(u, 2), n] for (c, z, sp), (u, n) in agg.items()]
    log(f"  done: {lines / 1e6:.1f}M lines, {st['kept'] / 1e6:.2f}M small gifts kept, ${st['kept_usd'] / 1e6:.1f}M, {len(rows):,} candidate and ZIP cells")
    return rows, dict(st)


if not A.merge_only:
    reps = reports()
    log(f"{len(reps)} ActBlue and WinRed monthly reports cover {CY - 1} and {CY}")
    done = 0
    for r in reps:
        dest = os.path.join(CW, f"{r['file']}.json.gz")
        if os.path.exists(dest): continue
        if A.limit and done >= A.limit: break
        log(f"reading {r['conduit']} report {r['file']}, {r['start']} to {r['end']}")
        try:
            rows, st = read_report(r)
        except Exception as e:
            log("  failed, will retry on the next run:", str(e)[:120]); continue
        with gzip.open(dest + ".part", "wt") as f: json.dump({"report": r, "stats": st, "rows": rows}, f)
        os.replace(dest + ".part", dest); done += 1

# ------------------------------------------------------------- merge into the cycle outputs
files = [os.path.join(CW, f) for f in os.listdir(CW) if f.endswith(".json.gz")]
if not files: raise SystemExit("No reports read yet.")
parts, stats = [], defaultdict(float)
for p in files:
    j = json.load(gzip.open(p, "rt"))
    for k, v in j["stats"].items(): stats[k] += v
    if j["rows"]: parts.append(pd.DataFrame(j["rows"], columns=["cand", "zip", "st", "sep", "usd", "n"]))
if not parts: raise SystemExit("The reports read so far have no small gifts in them. Delete ~/donorwork/<cycle>/conduit/ and rerun; if it happens again, send the 'line types seen' message.")
G = pd.concat(parts).groupby(["cand", "zip", "st", "sep"], as_index=False)[["usd", "n"]].sum()
log(f"{len(files)} reports, ${G.usd.sum() / 1e6:.1f}M in {G.n.sum():,.0f} small earmarked gifts to {G.cand.nunique()} candidates")

X = pd.read_csv(fetch(XWALK, os.path.join(A.work, "tab20_zcta520_county20_natl.txt")), sep="|", dtype=str)
X = X.rename(columns={c: c.upper() for c in X.columns})
zc, cc, land = next(c for c in X.columns if "ZCTA5" in c and "GEOID" in c), next(c for c in X.columns if "COUNTY" in c and "GEOID" in c), next(c for c in X.columns if "AREALAND_PART" in c)
X = X[X[zc].notna() & X[cc].notna()][[zc, cc, land]].rename(columns={zc: "zip", cc: "fips", land: "land"})
X["land"] = pd.to_numeric(X.land, errors="coerce").fillna(0.0)
X["w"] = X.land / X.groupby("zip").land.transform("sum").replace(0, 1)
M = G.merge(X[["zip", "fips", "w"]], on="zip", how="left")
stats["unmatched_zip_usd"] = float(M[M.fips.isna()].usd.sum())
M = M[M.fips.notna()].copy(); M["usd"] *= M.w; M["n"] *= M.w


# The bulk only versions of the outputs are kept once and merged from every time. A fresh fec_cycle_map.py run writes a
# meta.json without the conduit flag, which resets them; the flag is set before anything is written, so a merge that
# stops halfway never saves its half merged files as the bulk versions.
MP = os.path.join(OUT, "meta.json")
if not os.path.exists(MP): raise SystemExit(f"Run fec_cycle_map.py --cycle {CY} first: {MP} is missing.")
meta = json.load(open(MP))
OUTS = ["candidates.json", "counties.json", "cand_county.json.gz"]
bulk = lambda n: os.path.join(OUT, n.replace(".json", ".bulk.json"))
if not meta.get("conduit_small"):
    for n in OUTS: shutil.copyfile(os.path.join(OUT, n), bulk(n))
    meta["conduit_small"] = {"pending": True}; json.dump(meta, open(MP, "w"), indent=1)


def pristine(name): return os.path.join(OUT, name), bulk(name)


def party(cid):
    p = (CAND[cid].CAND_PTY_AFFILIATION if cid in CAND else "") or ""
    return "D" if p in ("DEM", "DFL") else "R" if p == "REP" else "O"


# candidates
cur, keep = pristine("candidates.json")
cands = json.load(open(keep)); byid = {c["cand_id"]: c for c in cands}
for cid, sub in G.groupby("cand"):
    c = byid.get(cid)
    if c is None:
        k = CAND.get(cid)
        if k is None: continue
        c = {"cand_id": cid, "name": k.CAND_NAME, "party": k.CAND_PTY_AFFILIATION, "p": party(cid), "office": k.CAND_OFFICE, "state": k.CAND_OFFICE_ST, "district": k.CAND_OFFICE_DISTRICT,
             "election_yr": k.CAND_ELECTION_YR, "ici": k.CAND_ICI, "home_state_share": None,
             "full": {"usd": 0, "n": 0, "bands_usd": [0] * 4, "bands_n": [0] * 4}, "sep30": {"usd": 0, "n": 0, "bands_usd": [0] * 4, "bands_n": [0] * 4}}
        cands.append(c); byid[cid] = c
    for w, s in (("full", sub), ("sep30", sub[sub.sep])):
        u, n = float(s.usd.sum()), int(s.n.sum())
        c[w]["usd"] = round(c[w]["usd"] + u); c[w]["n"] += n; c[w]["bands_usd"][0] = round(c[w]["bands_usd"][0] + u); c[w]["bands_n"][0] += n
    c["conduit_small_usd"] = round(float(sub.usd.sum()))
# each candidate's unitemized total, from the FEC's candidate totals: money that can never be placed on a map
unit = {}
for off in ([] if A.no_unitemized else sorted(OFFICES)):
    page = 1
    while True:
        j = api("/candidates/totals/", cycle=CY, office=off, election_full="true", per_page=100, page=page, sort="-receipts")
        for t in j.get("results", []):
            if t.get("individual_unitemized_contributions") is not None: unit[t["candidate_id"]] = round(float(t["individual_unitemized_contributions"] or 0))
        if page >= (j.get("pagination") or {}).get("pages", 1) or page >= 40: break
        page += 1
for c in cands:
    if c["cand_id"] in unit: c["unitemized"] = unit[c["cand_id"]]
cands.sort(key=lambda r: -r["full"]["usd"])
json.dump(cands, open(cur, "w"), separators=(",", ":"))

# counties
cur, keep = pristine("counties.json")
CJ = json.load(open(keep)); counties, NAMES = CJ["counties"], CJ.get("names", {})
for c in cands:
    if c["cand_id"] not in NAMES: NAMES[c["cand_id"]] = [c["name"], c["p"], c["office"], c["state"], c["district"]]
M["p"] = M.cand.map({c["cand_id"]: c["p"] for c in cands}).fillna("O")
M["o"] = M.cand.map({c["cand_id"]: c["office"] for c in cands}).fillna("X")
for w in ("full", "sep30"):
    S = M if w == "full" else M[M.sep]
    for scope in ["all"] + sorted(OFFICES):
        T = S if scope == "all" else S[S.o == scope]
        a = T.groupby("fips")[["usd", "n"]].sum()
        pd_ = T.groupby(["fips", "p"]).usd.sum()
        for f, r in a.iterrows():
            cell = counties.setdefault(f, {}).setdefault(w, {}).setdefault(scope, {"usd": [0] * 4, "n": [0] * 4, "D": [0] * 4, "R": [0] * 4})
            cell["usd"][0] = round(cell["usd"][0] + float(r.usd)); cell["n"][0] = round(cell["n"][0] + float(r.n))
            for p in ("D", "R"):
                v = float(pd_.get((f, p), 0.0))
                if v: cell.setdefault(p, [0] * 4)[0] = round(cell[p][0] + v)
CJ["names"] = NAMES
json.dump(CJ, open(cur, "w"), separators=(",", ":"))

# candidates by county, band 0 of both windows
cur, keep = pristine("cand_county.json.gz")
cc = json.load(gzip.open(keep, "rt"))
big = {c["cand_id"] for c in cands if c["full"]["usd"] >= 100_000}
for (cid, f, sep), v in M[M.cand.isin(big)].groupby(["cand", "fips", "sep"]).usd.sum().items():
    e = cc.setdefault(cid, {}).setdefault(f, [0] * 8)
    e[0] += round(float(v))
    if sep: e[4] += round(float(v))
with gzip.open(cur, "wt") as f: json.dump(cc, f, separators=(",", ":"))

meta["conduit_small"] = {"built": time.strftime("%Y-%m-%dT%H:%M:%S"), "reports": len(files), "stats": {k: round(v) for k, v in stats.items()},
                         "usd": round(float(G.usd.sum())), "gifts": int(G.n.sum()), "rule": "ActBlue and WinRed earmarked gifts whose donor's running total at the platform was $200 or less"}
json.dump(meta, open(MP, "w"), indent=1)
log("merged into", OUT, json.dumps(meta["conduit_small"]["stats"]))
