"""Build public/forecast/atlas/us.json: the county atlas behind the forecast map explorer.

One file carries every county in the country three ways:
  geometry  each county path moved from its state frame (900x620) into the national frame (975x610),
            so the explorer can draw a national county map and zoom into any state
  layers    one value per county per layer: 2024 result, gas price, data centers, jobs, wages, growth,
            migration, rurality, faith, news deserts, tariff exposure, low propensity voters, local
            conditions push, projected turnout
  centers   every mapped data center, placed in both the national and the state frame

Inputs (environment variables, defaults are the build machine paths):
  FEATURES   county_features.csv            county covariates used by the model
  COVARS     county_covariates.csv          raw covariate values
  GAS        aaa_county_gas_YYYY-MM-DD.csv  AAA county regular gas price
  LOCAL      county_local_shift.csv         local conditions term, within state and state part
  SEGS       county_segments_cal.csv        TPSI voter segments by county
  DCPTS      datacenter_points.csv          data center points, lat lon
  ZIPC       zip_county.csv                 zip to county, for county lat lon centroids
  PRES24     pres24.csv                     2024 presidential by county
  FCDIR      the statewide forecast run, for projected turnout
  DCTERM     dc_term.csv, the data center proximity term by county
  GASTERM    gas_term.csv, gas prices through financial strain by county
Run from the repo root: python3 scripts/forecast/build_atlas.py
"""
import os, re, json, glob, math
import numpy as np, pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUB = os.path.join(ROOT, "public", "forecast")
UP = "/root/.claude/uploads/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e"
E = lambda k, d: os.environ.get(k, d)
FEATURES = E("FEATURES", "/tmp/covx/county_features.csv")
COVARS = E("COVARS", f"{UP}/675891cf-county_covariates.csv")
GAS = E("GAS", f"{UP}/72a1ecf2-aaa_county_gas_2026-10-15.csv")
LOCAL = E("LOCAL", "/tmp/covx/county_local_shift.csv")
SEGS = E("SEGS", "/tmp/seg/county_segments_cal.csv")
DCPTS = E("DCPTS", f"{UP}/6b2b7c1d-datacenter_points.csv")
ZIPC = E("ZIPC", "/tmp/covx/zip_county.csv")
FCDIR = E("FCDIR", "/tmp/fc_v116")
DCT = E("DCTERM", "/tmp/dcx/dc_term.csv")
GST = E("GASTERM", "/tmp/gasx2/gas_term.csv")
GEO = E("GEODIR", "/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad/geo")
PRES24 = E("PRES24", "")

NUM = re.compile(r"-?\d+(?:\.\d+)?")


def pts(d):
    a = np.array([float(x) for x in NUM.findall(d)])
    return a.reshape(-1, 2)


def rnd(v, k=2):
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return None
    return round(float(v), k)


geo = json.load(open(f"{PUB}/geo.json"))
BOX = geo["box"]
STATES = sorted(os.path.basename(p)[:2] for p in glob.glob(f"{PUB}/states/*.json"))

# ---------- county lat lon centroids from zip centroids ----------
import zipcodes  # noqa: E402
zc = pd.read_csv(ZIPC, dtype=str).rename(columns={"Unnamed: 0": "zip"})
zc.columns = ["zip", "f"]
ll = {}
for z in zipcodes.list_all():
    try:
        ll[z["zip_code"]] = (float(z["lat"]), float(z["long"]))
    except Exception:
        pass
zc["lat"] = zc.zip.map(lambda z: ll.get(z, (np.nan, np.nan))[0])
zc["lon"] = zc.zip.map(lambda z: ll.get(z, (np.nan, np.nan))[1])
CLL = zc.dropna().groupby("f")[["lat", "lon"]].median()

# ---------- layers ----------
F = pd.read_csv(FEATURES, dtype={"fips": str}).set_index("fips")
C = pd.read_csv(COVARS, dtype={"fips": str}).set_index("fips")
G = pd.read_csv(GAS, dtype={"county_fips": str}).drop_duplicates("county_fips").set_index("county_fips")
L = pd.read_csv(LOCAL, dtype={"fips": str}).set_index("fips")
S = pd.read_csv(SEGS, dtype={"fips": str}).set_index("fips")
if PRES24:
    P = pd.read_csv(PRES24, dtype={"county_fips": str})
else:
    P = pd.read_csv(f"{GEO}/pres24.csv", dtype={"county_fips": str})
P["f"] = P.county_fips.str.zfill(5); P = P.set_index("f")
ct = glob.glob(E("CTG", "/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad/rerun/CTG/ct_county_pres24.csv"))
if ct:
    c2 = pd.read_csv(ct[0], dtype={"county_fips": str}).set_index("county_fips")
    P = pd.concat([P[~P.index.str.startswith("091")], c2[["votes_dem", "votes_gop", "total_votes"]]])

DCX = pd.read_csv(DCT, dtype={"fips": str}).set_index("fips") if os.path.exists(DCT) else pd.DataFrame()
GSX = pd.read_csv(GST, dtype={"fips": str}).set_index("fips") if os.path.exists(GST) else pd.DataFrame()
# projected turnout: the Senate race where there is one, else the governor's race
TURN = {}
for pth in sorted(glob.glob(f"{FCDIR}/*_2026_governor_county_forecast.csv")) + sorted(glob.glob(f"{FCDIR}/*_2026_senate_county_forecast.csv")):
    try:
        d = pd.read_csv(pth, dtype={"county_fips": str})
    except Exception:
        continue
    if "projected_turnout" not in d:
        continue
    for f, t in zip(d.county_fips.str.zfill(5), d.projected_turnout):
        TURN[f] = float(t)


def inv(x):
    return 1 / (1 + math.exp(-x))


LAYERS = [
    # key, label, unit, kind (div = diverging R/D, seq = sequential), palette, note
    ("p24", "2024 presidential margin", "pts", "div", "party", "Trump against Harris, certified county results"),
    ("gas", "Gas price", "$", "seq", "fuel", "AAA average regular unleaded, county"),
    ("gasr", "Gas price rise", "$", "seq", "fuel", "Rise in regular gas since Oct 2025: the county's AAA price over the nearest metro's year ago change within 50 km, else the state's"),
    ("dc", "Data centers", "sites", "seq", "grid", "Mapped data center sites in the county"),
    ("dcx", "Data center pull", "pts", "div", "party", "How far nearby and planned data centers move the county margin, from the Economist and YouGov distance curve, scaled to three quarters of the 6.3 point gap measured within 2 km today"),
    ("gasx", "Gas price rise pull", "pts", "div", "party", "How far the county's gas price rise since Oct 2025, against the national rise both ways, moves the margin through financially strained voters: above the national rise toward Democrats, below it toward Republicans"),
    ("emp", "Job growth", "%", "div", "growth", "Total employment change, year over year, QCEW"),
    ("wage", "Wage growth", "%", "div", "growth", "Average weekly wage change, year over year, QCEW"),
    ("tariff", "Tariff exposure", "index", "seq", "heat", "Manufacturing and farm employment exposed to tariffs"),
    ("popg", "Population growth", "%", "div", "growth", "Change since 2020, Census estimates"),
    ("mig", "International migration", "%", "seq", "cool", "Net international migration since 2020, share of 2020 population"),
    ("rural", "Rurality", "1 to 9", "seq", "earth", "USDA rural urban continuum code, 1 is the largest metros"),
    ("evang", "Evangelical share", "%", "seq", "earth", "Evangelical and nondenominational adherents per 100 residents"),
    ("news", "News outlets", "per 100k", "seq", "cool", "Local news outlets per 100,000 residents"),
    ("lpT", "Low propensity Trump voters", "% adults", "seq", "red", "TPSI segment placed by county through the census"),
    ("lpH", "Low propensity Harris voters", "% adults", "seq", "blue", "TPSI segment placed by county through the census"),
    ("loc", "Local conditions push", "pts", "div", "party", "What gas, jobs, growth, migration and data centers add to the county margin"),
    ("turn", "Projected turnout", "% adults", "seq", "cool", "Projected 2026 votes per adult resident"),
]
KEYS = [k[0] for k in LAYERS]


def layer_row(f):
    r = {}
    if f in P.index:
        p = P.loc[f]
        tv = float(p.total_votes) if float(p.total_votes) > 0 else float(p.votes_dem + p.votes_gop)
        r["p24"] = 100 * (float(p.votes_gop) - float(p.votes_dem)) / max(tv, 1)
    if f in G.index:
        r["gas"] = G.loc[f, "price_regular"]
    elif f in F.index:
        r["gas"] = F.loc[f, "gas"]
    if f in F.index:
        x = F.loc[f]
        r["dc"] = x.dc_count; r["emp"] = x.emp_chg; r["wage"] = x.wage_chg; r["tariff"] = x.tariff
        r["popg"] = x.pop_grow; r["mig"] = x.intl_mig; r["rural"] = x.rural; r["evang"] = x.evang
    if f in C.index:
        r["news"] = C.loc[f, "news_outlets_per_100k"]
    if f in S.index:
        s = S.loc[f]; r["lpT"] = 100 * s["LP Trump"]; r["lpH"] = 100 * s["LP Harris"]
        if f in TURN and s.adults > 0:
            r["turn"] = min(100 * TURN[f] / s.adults, 99)
    if f in DCX.index:
        r["dcx"] = -2.0 * float(DCX.loc[f, "d2_shift_pts"])   # GOP positive margin points
    if f in GSX.index:
        r["gasx"] = -2.0 * float(GSX.loc[f, "d2_shift_pts"])   # GOP positive margin points
        if "gas_rise" in GSX.columns: r["gasr"] = float(GSX.loc[f, "gas_rise"])
    if f in L.index:
        t = float(os.environ.get("LOCAL_WT", "1.5")) * float(L.loc[f, "within"]) + float(os.environ.get("LOCAL_SWT", "1.0")) * float(L.loc[f, "state_part"])
        r["loc"] = -100 * (2 * inv(t) - 1)  # GOP positive, like every margin on the site
    return [rnd(r.get(k), 3 if k == "tariff" else (3 if k in ("gas", "gasr") else 1)) for k in KEYS]


# ---------- geometry: state frame to national frame ----------
county_rows, centers, state_xf = [], [], {}
names = {}
try:
    names = json.load(open(f"{PUB}/counties.json")).get("_n", {})
except Exception:
    pass
for st in STATES:
    sj = json.load(open(f"{PUB}/states/{st}.json"))
    cs = sj["counties"]
    allp = np.vstack([pts(c["d"]) for c in cs])
    mn, mx = allp.min(0), allp.max(0)
    if st not in BOX:
        continue
    bx, by, bw, bh = BOX[st]
    s = min(bw / max(mx[0] - mn[0], 1e-9), bh / max(mx[1] - mn[1], 1e-9))
    ox = bx + (bw - s * (mx[0] - mn[0])) / 2 - s * mn[0]
    oy = by + (bh - s * (mx[1] - mn[1])) / 2 - s * mn[1]
    state_xf[st] = [round(s, 6), round(ox, 3), round(oy, 3)]
    # lat lon to state frame, an affine least squares fit on county centroids
    A, B = [], []
    for c in cs:
        f = "11001" if c["id"].startswith("DC-") else c["id"]
        q = pts(c["d"])
        cx, cy = q.mean(0)
        fid = f
        if fid in CLL.index:
            la, lo = CLL.loc[fid]
            A.append([lo * math.cos(math.radians(la)), la, 1.0]); B.append([cx, cy])
        nf = []
        for m in re.finditer(r"([ML])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)|Z", c["d"]):
            if m.group(0) == "Z":
                nf.append("Z"); continue
            x = s * float(m.group(2)) + ox; y = s * float(m.group(3)) + oy
            nf.append(f"{m.group(1)}{x:.1f},{y:.1f}")
        # drop repeated points after rounding to keep the file small
        out, last = [], None
        for t in nf:
            if t != "Z" and t[1:] == last:
                continue
            out.append(t); last = t[1:] if t != "Z" else None
        county_rows.append([f, st, names.get(f, F.loc[f, "county_name"] if f in F.index else f), int(F.loc[f, "pop"]) if f in F.index and F.loc[f, "pop"] == F.loc[f, "pop"] else 0, "".join(out)] + layer_row(f))
    fit = None
    if len(A) >= 4:
        A_, B_ = np.array(A), np.array(B)
        fit, *_ = np.linalg.lstsq(A_, B_, rcond=None)
    state_xf[st].append(fit.round(5).tolist() if fit is not None else None)

DC = pd.read_csv(DCPTS, dtype={"fips": str})
DC["st"] = DC.fips.map(lambda f: F.loc[f, "state"] if isinstance(f, str) and f in F.index else None)
for _, r in DC.iterrows():
    st = r.st
    if not st or st not in state_xf or state_xf[st][3] is None:
        continue
    s, ox, oy, fit = state_xf[st]
    v = np.array([r.lon * math.cos(math.radians(r.lat)), r.lat, 1.0]) @ np.array(fit)
    sx, sy = float(v[0]), float(v[1])
    if not (-20 < sx < 920 and -20 < sy < 640):
        continue
    nm = r["name"] if isinstance(r["name"], str) else ""
    op = r.operator if isinstance(r.operator, str) else ""
    centers.append([r.fips, st, round(s * sx + ox, 1), round(s * sy + oy, 1), round(sx, 1), round(sy, 1), nm[:60], op[:40]])

# state summaries: population weighted
pop = F["pop"].to_dict()
summ = {}
for st in STATES:
    rows = [r for r in county_rows if r[1] == st]
    w = np.array([pop.get(r[0], 1.0) or 1.0 for r in rows])
    out = []
    for i, k in enumerate(KEYS):
        v = np.array([r[5 + i] if r[5 + i] is not None else np.nan for r in rows], float)
        ok = ~np.isnan(v)
        if not ok.any():
            out.append(None); continue
        out.append(rnd(v[ok].sum() if k == "dc" else np.average(v[ok], weights=w[ok]), 3 if k in ("gas", "gasr", "tariff") else 1))
    summ[st] = out

res = dict(
    built=E("UPDATED", "2026-10-14"),
    layers=[dict(key=k, label=l, unit=u, kind=kd, pal=pl, note=n) for k, l, u, kd, pl, n in LAYERS],
    cols=["fips", "st", "name", "pop", "d"] + KEYS,
    counties=county_rows,
    centers=centers,
    centerCols=["fips", "st", "x", "y", "sx", "sy", "name", "operator"],
    states=summ,
    xf={k: v[:3] for k, v in state_xf.items()},
)
os.makedirs(f"{PUB}/atlas", exist_ok=True)
json.dump(res, open(f"{PUB}/atlas/us.json", "w"), separators=(",", ":"))
print("counties", len(county_rows), "centers", len(centers), "bytes", os.path.getsize(f"{PUB}/atlas/us.json"))
miss = {k: sum(1 for r in county_rows if r[5 + i] is None) for i, k in enumerate(KEYS)}
print("missing", miss)
