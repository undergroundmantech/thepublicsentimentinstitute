"""State MRP of the 2026 generic ballot, Senate and governor environment, and the rural, suburban and urban shift,
from the unified respondent dataset v5 (Oct 28 2026). Report only: nothing here feeds the forecast.

  area      every ZIP is City, Suburban or Rural and small town (the National Poll Desk ZIP table); a county takes the
            mix of its ZIPs (Ledger ZIP to county table). Respondents with a ZIP use their own ZIP type, the rest their
            county's dominant type.
  model     survey weighted (likely voter weights), penalized logistic regression of the two way 2026 vote, Democrat versus Republican, on 2024 vote, race,
            college, white by college, age, gender, area, 2024 vote by area, 2024 vote by race, region and state (state
            and region shrunk harder), with a wave effect; recent waves count more (half life 45 days). The prediction
            is made at the Oct 28 wave.
  frame     each county's projected 2026 electorate from the forecast's own county cells (public/watchdog/
            county_profiles.json): age, race, college and 2024 vote margins, joined by raking a seed of the same four
            way table from the database's likely voters in the county's region.
  level     the poststratified national margin is lined up by one logit shift on two national targets: the Oct 28 poll,
            D+13.0, and the Gallup party ID shift, 2024 national result plus 14 points (R 48 D 45 in 2024 Q3 to D 50 R 39
            in 2026 Q3). The published estimate takes the average of the two.
Version 2, Oct 29 2026 evening, at the user's request:
  data      the national dataset completed by MRP (TPSI_National_MRP_Completed.csv): waves pooled by the fast drift
            multipliers in place of the 45 day half life, and the vote leaned, undecided voters counting by their lean.
            Respondents whose ballot answer is itself modeled stay out of the fit.
  targets   the pooled likely voter margin, D+11.4, and the Gallup shift on the 2024 result, D+12.6.
  baseline  each state's partisan baseline is no longer Trump's 2024 margin alone: its lean against the nation in 2024
            (weight 0.5), 2020 (0.25) and the 2022 midterm (0.25: the 2024 lean moved by the state's House vote change from
            2022 to 2024 against the nation's, contested districts only), added to the 2024 national margin.
  elasticity  a demographic elasticity from the database's own group shifts: the same cell model with every state and
            region effect removed, poststratified on each state's frame, so a state's shift comes only from who lives
            there and how those groups moved, Hispanic and rural voters included. elasticity_demo is that shift over the
            national shift.
usage: python3 -I mrp_states_v2.py SITE DB_CSV OUT_DIR"""
import sys, os, json, re, numpy as np, pandas as pd
SITE, DBF, OUT = sys.argv[1:4]
os.makedirs(OUT, exist_ok=True)
DESK = "/root/.claude/uploads/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/508b8a6a-National_Poll_Desk_12.html"
ZTS = "/tmp/ledger_full/src/data/zips.ts"
POLL_TARGET = 11.39
GALLUP_SHIFT = (50 - 39) - (45 - 48)          # 14 points toward the Democrats
inv = lambda x: 1 / (1 + np.exp(-x)); logit = lambda p: np.log(p / (1 - p))

# ---------------------------------------------------------------- area types
s = open(DESK).read()
nd = json.loads(re.search(r'<script type="application/json" id="nat-data">(.*?)</script>', s, re.S).group(1))
zs, states = nd["zips"], nd["states"]
ZT = ["City", "Suburban", "Rural"]
ztype = {}
for i in range(0, len(zs) - 6, 7):
    t = zs[i + 6]
    if t != "-": ztype[zs[i:i + 5]] = ZT[int(t)]
zt = open(ZTS).read(); zt = zt[zt.index('"') + 1: zt.rindex('"')]
zc = {}
for item in zt.split(";"):
    if ":" in item:
        z, rest = item.split(":", 1); p = rest.split(",")
        if len(p) >= 4: zc[z] = p[3].zfill(5)
cz = pd.DataFrame([(zc[z], ztype[z]) for z in zc if z in ztype], columns=["f", "t"])
mix = pd.crosstab(cz.f, cz.t, normalize="index").reindex(columns=ZT, fill_value=0)
prof = {f: x for f, x in json.load(open(f"{SITE}/public/watchdog/county_profiles.json"))["c"].items() if "ev" in x and "vp" in x}
# counties the profiles leave out, in states with no statewide race this year: race from citizen adults, college from
# the ACS, age from the national electorate, 2024 vote from the certified county result with the national share of
# 2024 nonvoters, and 2026 voters at the midterm ratio of the 2024 vote
_P24 = json.load(open(f"{SITE}/public/forecast/pres24_counties.json"))["c"]
_cv = pd.read_csv("/tmp/fcrun/TPSI_B/model/census/cvap_county_2020_2024.csv", dtype={"fips": str}).set_index("fips")
import glob as _g
_acs = pd.read_csv(_g.glob("/tmp/fcrun/TPSI_B/model/fc2609fd*/JULIUISMICHIGAN/ACSST5Y2024.S1501*/*Data.csv")[0], skiprows=[1], low_memory=False)
_acs["f"] = _acs.GEO_ID.str[-5:]; _acs = _acs.set_index("f")
_col = (pd.to_numeric(_acs["S1501_C01_015E"], errors="coerce") / pd.to_numeric(_acs["S1501_C01_006E"], errors="coerce").clip(lower=1))
_age_nat = np.array([12.5, 22.0, 34.0, 31.5]); _added = 0
for f, (dd, rr, oo) in _P24.items():
    if f in prof or f not in _cv.index: continue
    c = _cv.loc[f]; tot = max(1.0, float(c.cvap_tot))
    race = [max(0.0, tot - c.cvap_bnh - c.cvap_his - c.cvap_oth) / tot * 100, c.cvap_bnh / tot * 100, c.cvap_his / tot * 100, c.cvap_oth / tot * 100]
    cl = float(_col.get(f, 0.3)) if pd.notna(_col.get(f, np.nan)) else 0.3
    v = 0.75 * (dd + rr + oo); dnv = 0.045 * v
    prof[f] = {"ev": v, "vp": [[0, 0.75 * rr, 0], [0, 0, 0], [0, 0.75 * dd, 0], [0, 0, 0], [0, 0.75 * oo, 0], [0, dnv, 0]],
               "age": [[a, 0] for a in _age_nat], "race_": [[x, 0] for x in race], "col": [[100 * (1 - cl), 0], [100 * cl, 0]]}
    _added += 1
ev = pd.Series({f: x["ev"] for f, x in prof.items()})
def ctype(f):
    if f not in mix.index: return "Rural" if ev.get(f, 0) < 50000 else "Suburban"
    m = mix.loc[f]; size = ev.get(f, 0)
    if m.City >= 0.35 and size >= 150000: return "City"
    if m.Rural >= 0.55 and size < 120000: return "Rural"
    if m.Rural >= 0.75: return "Rural"
    return "Suburban"
CT = {f: ctype(f) for f in prof}

# ---------------------------------------------------------------- respondents
db = pd.read_csv(DBF, low_memory=False)
db = db[(db.analysis_ready == 1) & (db.rqcm_flag.fillna(0) != 1)].copy()
db["f"] = db.county_fips.dropna().astype(int).astype(str).str.zfill(5).reindex(db.index)
own = db.zip_type.map({"City": "City", "Suburban": "Suburban", "Rural and small town": "Rural"}) if "zip_type" in db else pd.Series(np.nan, index=db.index)
if "op5_zip_type" in db:
    own = own.fillna(db.op5_zip_type.map({"City": "City", "Suburban": "Suburban", "Rural and small town": "Rural", "Rural": "Rural"}))
db["area"] = own.fillna(db.f.map(CT))
db["area_county"] = db.f.map(CT)
nat = db[db.source_dataset == "tpsi_national"].copy()
new = nat[nat.wave == "2026-10 October 28 National Poll"].copy()
agree = float((new.zip_type.map({"City": "City", "Suburban": "Suburban", "Rural and small town": "Rural"}) == new.area_county).mean())

# ---------------------------------------------------------------- the shift by area
P24 = json.load(open(f"{SITE}/public/forecast/pres24_counties.json"))["c"]
p24 = pd.DataFrame(P24, index=["d", "r", "o"]).T
p24["t"] = p24.index.map(lambda f: CT.get(f, ctype(f)))
cert = p24.groupby("t")[["d", "r", "o"]].sum()
cert_m = (100 * (cert.d - cert.r) / (cert.d + cert.r)).round(1).to_dict()
NAT24 = 100 * (p24.d.sum() - p24.r.sum()) / (p24.d.sum() + p24.r.sum())
def area_table(d, wcol):
    rows = []
    for a in ZT:
        x = d[d.area == a]; w = x[wcol]
        two = x.gb_2way.isin(["Democrat", "Republican"]); ww = w[two]
        m26 = 100 * float((ww * np.where(x.gb_2way[two] == "Democrat", 1, -1)).sum() / ww.sum()) if ww.sum() else np.nan
        rc = x.recall_2024.isin(["Harris", "Trump"]); wr = w[rc]
        m24 = 100 * float((wr * np.where(x.recall_2024[rc] == "Harris", 1, -1)).sum() / wr.sum()) if wr.sum() else np.nan
        t = x[x.recall_2024 == "Trump"]; h = x[x.recall_2024 == "Harris"]; dn = x[x.recall_2024 == "Did not vote"]
        sh = lambda g, v: round(100 * float((g[wcol] * (g.gb_2way == v)).sum() / g[wcol][g.gb_2way.notna()].sum()), 1) if g[wcol][g.gb_2way.notna()].sum() else None
        rows.append(dict(area=a, n=int(len(x)), share=round(100 * float(w.sum() / d[wcol].sum()), 1), recall_margin=round(m24, 1),
                         gb_margin=round(m26, 1), swing_vs_recall=round(m26 - m24, 1), certified_2024=cert_m.get(a),
                         swing_vs_certified=round(m26 - cert_m.get(a, np.nan), 1),
                         trump_voters_to_D=sh(t, "Democrat"), harris_voters_to_R=sh(h, "Republican"), nonvoters_D=sh(dn, "Democrat")))
    return rows
recent = nat[nat.wave.isin(["2026-09 September Benchmark", "2026-10 October Benchmark", "2026-10 October 28 National Poll"])]
early = nat[nat.wave.isin(["2026-02 National Poll", "2026-03 March National Poll", "2026-05 May Benchmark", "2026-06 June Benchmark", "2026-07 July America 250"])]
AREA = dict(oct28_poll_LV=area_table(new, "weight_lv"), oct28_poll_RV=area_table(new, "weight_rv"),
            sep_oct_waves_LV=area_table(recent, "weight_lv"), feb_jul_waves_LV=area_table(early, "weight_lv"),
            all_national_LV=area_table(nat, "weight_lv"), certified_2024_by_county_type=cert_m,
            county_type_agreement_with_own_zip=round(agree, 3),
            county_types=pd.Series(CT).value_counts().to_dict())

# ---------------------------------------------------------------- model
sys.path.insert(0, "/tmp/fcrun/TPSI_B/model"); import mrp_national as _mn
_C = _mn.data().set_index("respondent_id"); _MULT = _mn.multipliers(); POOL = _mn.pool()
nat["pD"] = nat.respondent_id.map(_C.gb_p_democrat); nat["pR"] = nat.respondent_id.map(_C.gb_p_republican)
nat["gbsrc"] = nat.respondent_id.map(_C.gb_source); nat["pool"] = nat.respondent_id.map(_C.wave.map(_MULT))
fit = nat[(nat.gbsrc != "modeled") & ((nat.pD + nat.pR) > 0.05) & nat.recall_2024.notna() & nat.age_band.notna() & nat.race4.notna() & nat.area.notna()].copy()
WAVES = sorted(nat.wave.unique()); LAST = "2026-10 October 28 National Poll"
fe = pd.to_datetime(fit.field_end, errors="coerce").fillna(pd.Timestamp("2026-06-15"))
fit["rw"] = fit["pool"].fillna(1.0) * (fit.pD + fit.pR)
REC = ["Harris", "Did not vote", "Third party"]; RACE = ["Black", "Hispanic", "Asian/Other"]; AGE = ["18-29", "30-44", "65+"]
REG = sorted(nat.region8.dropna().unique()); STS = sorted(nat.state.dropna().unique())
def X(d, wave=None):
    c = {}
    wv = d.wave.values if wave is None else np.full(len(d), wave)
    c["const"] = np.ones(len(d))
    for v in REC: c[f"rec={v}"] = (d.recall_2024 == v).values.astype(float)
    for v in RACE: c[f"race={v}"] = (d.race4 == v).values.astype(float)
    c["college"] = (d.college == "COLLEGE").values.astype(float)
    c["white_college"] = ((d.race4 == "White") & (d.college == "COLLEGE")).values.astype(float)
    for v in AGE: c[f"age={v}"] = (d.age_band == v).values.astype(float)
    c["female"] = (d.gender == "Female").values.astype(float)
    for a in ["City", "Rural"]:
        c[f"area={a}"] = (d.area == a).values.astype(float)
        for v in ["Trump", "Harris"]: c[f"rec={v}:area={a}"] = ((d.recall_2024 == v) & (d.area == a)).values.astype(float)
    rec_w = np.isin(wv, ["2026-09 September Benchmark", "2026-10 October Benchmark", "2026-10 October 28 National Poll"]).astype(float)
    for a in ["City", "Rural"]:
        for v in ["Trump", "Harris"]: c[f"recent:rec={v}:area={a}"] = rec_w * ((d.recall_2024 == v) & (d.area == a)).values.astype(float)
    for v in ["Hispanic", "Black"]: c[f"rec=Trump:race={v}"] = ((d.recall_2024 == "Trump") & (d.race4 == v)).values.astype(float)
    c["rec=Trump:age=18-29"] = ((d.recall_2024 == "Trump") & (d.age_band == "18-29")).values.astype(float)
    for v in WAVES:
        if v != LAST: c[f"wave={v}"] = (wv == v).astype(float)
    for r in REG: c[f"reg={r}"] = (d.region8 == r).values.astype(float)
    for st in STS: c[f"st={st}"] = (d.state == st).values.astype(float)
    return pd.DataFrame(c)
Xf = X(fit); cols = list(Xf.columns)
pen = np.array([0.0 if k == "const" else 25.0 if k.startswith("st=") else 8.0 if k.startswith("reg=") else 2.0 if k.startswith("wave=") else 1.0 for k in cols])
y = (fit.pD / (fit.pD + fit.pR)).values.astype(float)
ww_ = fit.weight_lv.astype(float).values; ww_ = ww_ / np.nanmean(ww_)
w = fit.rw.values * np.nan_to_num(ww_, nan=1.0)
A = Xf.values; b = np.zeros(A.shape[1])
for _ in range(60):
    p = inv(A @ b); W = w * p * (1 - p)
    H = A.T @ (A * W[:, None]) + np.diag(pen); g = A.T @ (w * (y - p)) - pen * b
    step = np.linalg.solve(H, g); b += step
    if np.abs(step).max() < 1e-7: break
COEF = dict(zip(cols, b))

# ---------------------------------------------------------------- frame
lv = nat[nat.recall_2024.notna() & nat.age_band.notna() & nat.race4.notna()].copy()
AG4 = ["18-29", "30-44", "45-64", "65+"]; RC4 = ["White", "Black", "Hispanic", "Asian/Other"]; CO2 = ["NON-COLLEGE", "COLLEGE"]; RE4 = ["Trump", "Harris", "Third party", "Did not vote"]
def joint(d):
    t = np.full((4, 4, 2, 4), 0.5)
    ia = d.age_band.map({k: i for i, k in enumerate(AG4)}); ir = d.race4.map({k: i for i, k in enumerate(RC4)})
    ic = d.college.map({k: i for i, k in enumerate(CO2)}); ie = d.recall_2024.map({k: i for i, k in enumerate(RE4)})
    ok = ia.notna() & ir.notna() & ic.notna() & ie.notna()
    np.add.at(t, (ia[ok].astype(int), ir[ok].astype(int), ic[ok].astype(int), ie[ok].astype(int)), d.weight_lv[ok].values)
    return t / t.sum()
J_nat = joint(lv); J_reg = {r: joint(lv[lv.region8 == r]) for r in REG}
S2R = nat.groupby("state").region8.agg(lambda x: x.mode().iat[0]).to_dict()
F2S = {}
for f in prof:
    pass
fips_state = pd.read_csv(f"{SITE}/public/forecast/pres24_counties.json".replace("pres24_counties.json", "pres24_counties.json"), nrows=0) if False else None
AB = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"}
cells = []
for f, x in prof.items():
    st = AB.get(f[:2])
    if not st: continue
    seed = 0.5 * J_reg.get(S2R.get(st), J_nat) + 0.5 * J_nat
    vt = np.array([g[1] for g in x["vp"]], float)
    rec = np.array([vt[0] + vt[1], vt[2] + vt[3], vt[4], vt[5]]); rec = rec / rec.sum()
    age = np.array([g[0] for g in x["age"]]) / 100; age = age / age.sum()
    race = np.array([g[0] for g in x["race_"]]) / 100; race = race / race.sum()
    col = np.array([g[0] for g in x["col"]]) / 100; col = col / col.sum()
    t = seed.copy()
    for _ in range(40):
        t *= (age / np.maximum(t.sum((1, 2, 3)), 1e-12))[:, None, None, None]
        t *= (race / np.maximum(t.sum((0, 2, 3)), 1e-12))[None, :, None, None]
        t *= (col / np.maximum(t.sum((0, 1, 3)), 1e-12))[None, None, :, None]
        t *= (rec / np.maximum(t.sum((0, 1, 2)), 1e-12))[None, None, None, :]
    cells.append((f, st, x["ev"], t))
# design for every cell type once per area, region and state
grid = pd.DataFrame([dict(age_band=a, race4=r, college=c, recall_2024=e) for a in AG4 for r in RC4 for c in CO2 for e in RE4])
grid["gender"] = "Female"
def cellp(st, area):
    g = grid.copy(); g["state"] = st; g["region8"] = S2R.get(st); g["area"] = area; g["wave"] = LAST
    Xm = X(g, LAST).reindex(columns=cols, fill_value=0.0).values
    lm = Xm @ b
    # half the electorate is women: average the female term
    lm = lm - 0.5 * COEF["female"]
    return lm.reshape(4, 4, 2, 4)
def cellp_demo(st, area):
    g = grid.copy(); g["state"] = "__none__"; g["region8"] = "__none__"; g["area"] = area; g["wave"] = LAST
    Xm = X(g, LAST).reindex(columns=cols, fill_value=0.0).values
    return (Xm @ b - 0.5 * COEF["female"]).reshape(4, 4, 2, 4)
CACHE = {}; CACHE_D = {}
st_rows = {}
for f, st, votes, t in cells:
    k = (st, CT.get(f, "Suburban"))
    if k not in CACHE: CACHE[k] = cellp(*k)
    lm = CACHE[k]
    if k[1] not in CACHE_D: CACHE_D[k[1]] = cellp_demo(None, k[1])
    r = st_rows.setdefault(st, dict(votes=0.0, lm=[], wt=[], ld=[]))
    r["votes"] += votes; r["lm"].append(lm.ravel()); r["wt"].append(votes * t.ravel()); r["ld"].append(CACHE_D[k[1]].ravel())
def nat_margin(delta):
    num = den = 0.0
    for st, r in st_rows.items():
        L = np.concatenate(r["lm"]); Wt = np.concatenate(r["wt"])
        p = inv(L + delta); num += (Wt * (2 * p - 1)).sum(); den += Wt.sum()
    return 100 * num / den
def solve(target):
    lo, hi = -2.0, 2.0
    for _ in range(50):
        mid = 0.5 * (lo + hi)
        (lo, hi) = (mid, hi) if nat_margin(mid) < target else (lo, mid)
    return 0.5 * (lo + hi)
raw_nat = nat_margin(0.0)
T_gal = NAT24 + GALLUP_SHIFT; T_poll = POLL_TARGET; T_blend = 0.5 * (T_gal + T_poll)
d_poll, d_gal, d_bl = solve(T_poll), solve(T_gal), solve(T_blend)
def nat_margin_d(delta):
    num = den = 0.0
    for st, r in st_rows.items():
        L = np.concatenate(r["ld"]); Wt = np.concatenate(r["wt"]); p = inv(L + delta); num += (Wt * (2 * p - 1)).sum(); den += Wt.sum()
    return 100 * num / den
lo, hi = -2.0, 2.0
for _ in range(50):
    mid = 0.5 * (lo + hi); (lo, hi) = (mid, hi) if nat_margin_d(mid) < T_poll else (lo, mid)
d_dm = 0.5 * (lo + hi)
E = pd.read_csv("/tmp/pvi/nat_elasticity.csv", dtype={"f": str}).set_index("f").e
p24s = p24.copy(); p24s["st"] = p24s.index.str[:2].map(AB)
stp = p24s.groupby("st")[["d", "r", "o"]].sum()
p24s["e"] = E.reindex(p24s.index).fillna(1.0)
st_el = p24s.groupby("st").apply(lambda g: float((g.e * (g.d + g.r)).sum() / (g.d + g.r).sum()))
# composite partisan baseline, as lean against the nation
_P20 = pd.read_csv("/tmp/fcrun/TPSI_B/geo/pres20.csv", dtype={"county_fips": str}); _P20["st"] = _P20.county_fips.str.zfill(5).str[:2].map(AB)
_s20 = _P20.groupby("st")[["votes_dem", "votes_gop"]].sum(); NAT20 = 100 * float((_s20.votes_dem.sum() - _s20.votes_gop.sum()) / (_s20.votes_dem.sum() + _s20.votes_gop.sum()))
LEAN20 = (100 * (_s20.votes_dem - _s20.votes_gop) / (_s20.votes_dem + _s20.votes_gop) - NAT20).to_dict()
# 2022 midterm: each state's House vote in 2022 against its House vote in 2024, district by district where both years were
# contested, net of the nation's change, shrunk by n / (n + 3) districts; added to the 2024 presidential lean. Statewide
# 2022 races are not used: their candidate effects, Phil Scott, Sununu, Kelly, Shapiro, swamp the partisan signal.
_hh = pd.read_csv("/mnt/attach/outputs/house_2024_2022_general_results.csv"); _hh["st"] = _hh.district.str[:2]
_hh = _hh[_hh.uncontested.isna() & (_hh.dem_votes > 0) & (_hh.rep_votes > 0)].copy()
_hh["m"] = 100 * (_hh.dem_votes - _hh.rep_votes) / (_hh.dem_votes + _hh.rep_votes); _hh["v"] = _hh.dem_votes + _hh.rep_votes
_pv = _hh.pivot_table(index=["st", "district"], columns="year", values=["m", "v"]).dropna(); _pv.columns = [f"{x}{y}" for x, y in _pv.columns]
_pv["d"] = _pv.m2022 - _pv.m2024; _nd = float((_pv.d * _pv.v2022).sum() / _pv.v2022.sum())
DEV22 = _pv.groupby("st").apply(lambda g: (float((g.d * g.v2022).sum() / g.v2022.sum()) - _nd) * len(g) / (len(g) + 3.0)).to_dict()
LEAN22 = {}
def baseline(st, pres24):
    l24 = pres24 - NAT24; l20 = LEAN20.get(st, l24); l22 = l24 + DEV22.get(st, 0.0)
    lean = 0.5 * l24 + 0.25 * l20 + 0.25 * l22
    return NAT24 + lean, l24, l20, l22
DEMO_NAT = None
model = json.load(open(f"{SITE}/public/forecast/model.json"))
RACES = {r["id"]: r for r in model["races"]}
out = []
for st, r in sorted(st_rows.items()):
    L = np.concatenate(r["lm"]); Wt = np.concatenate(r["wt"])
    m = lambda dl: 100 * float((Wt * (2 * inv(L + dl) - 1)).sum() / Wt.sum())
    pres = 100 * float((stp.d[st] - stp.r[st]) / (stp.d[st] + stp.r[st])) if st in stp.index else np.nan
    LD = np.concatenate(r["ld"]); md = lambda dl: 100 * float((Wt * (2 * inv(LD + dl) - 1)).sum() / Wt.sum())
    base, l24, l20, l22 = baseline(st, pres)
    demo_shift = md(d_dm) - pres                        # demographic only, at the poll target
    el_demo = demo_shift / (T_poll - NAT24)
    swing_el = base + (T_blend - NAT24) * el_demo
    mb = m(d_bl)
    row = dict(state=st, votes_2026=round(r["votes"]), pres_2024=round(pres, 1), lean_2024=round(l24, 1), lean_2020=round(l20, 1),
               lean_2022=None if l22 is None else round(l22, 1), baseline=round(base, 1), baseline_vs_2024=round(base - pres, 1),
               demo_only=round(md(d_dm), 1), elasticity_demo=round(el_demo, 3), elasticity=round(st_el.get(st, 1.0), 2),
               mrp_raw=round(m(0.0), 1), mrp_poll_target=round(m(d_poll), 1), mrp_gallup_target=round(m(d_gal), 1), mrp_blend=round(mb, 1),
               swing_model=round(swing_el, 1), estimate=round(0.5 * (mb + swing_el), 1),
               shift_vs_2024=round(0.5 * (mb + swing_el) - pres, 1), respondents=int((nat.state == st).sum()))
    for off, key in (("senate", "sen-"), ("governor", "gov-")):
        rc = RACES.get(key + st)
        if rc:
            row[f"{off}_forecast"] = round(-rc["est"]["margin"], 1); row[f"{off}_poll_avg"] = None if rc.get("pollAvg") is None else round(-rc["pollAvg"], 1)
            row[f"{off}_vs_environment"] = round(-rc["est"]["margin"] - row["estimate"], 1)
            row[f"{off}_dem"] = rc.get("dem"); row[f"{off}_gop"] = rc.get("gop")
    out.append(row)
T = pd.DataFrame(out)

# ---------------------------------------------------------------- Senate and governor MRP from the On Point state respondents
five = db[db.source_dataset.astype(str).str.startswith("onpoint_")].copy()
race_rows = []
for off, col in (("senate", "op5_senate_party"), ("governor", "op5_governor_party")):
    pdem = five[f"op5_{off}_undecided_p_dem"]
    lab = np.where(five[col] == "D", 1.0, np.where(five[col] == "R", 0.0, np.where(five[col] == "Undecided", np.where(pdem >= 0.5, 1.0, 0.0), np.nan)))
    lab = np.where((five[col] == "Undecided") & pdem.isna(), np.nan, lab)
    ff = five.assign(y=lab, wave=LAST)
    ff = ff[ff.y.notna() & ff.recall_2024.notna() & ff.age_band.notna() & ff.race4.notna() & ff.area.notna()]
    for st in sorted(ff.state.unique()):
        g = ff[ff.state == st]
        if len(g) < 150: continue
        A2 = X(g, LAST).reindex(columns=cols, fill_value=0.0).values
        # start from the generic ballot model and refit the intercept, 2024 vote, race and area terms on the state's race vote
        free = [i for i, k in enumerate(cols) if k == "const" or k.startswith(("rec=", "race=", "area=", "age=", "college", "white_college"))]
        bb = b.copy(); pn = np.full(len(cols), 1e6); pn[free] = 4.0; pn[cols.index("const")] = 0.0
        for _ in range(60):
            p = inv(A2 @ bb); sw = g.weight_lv_design.astype(float).values; sw = sw / sw.mean(); W2 = sw * p * (1 - p)
            H = A2.T @ (A2 * W2[:, None]) + np.diag(pn); gr = A2.T @ (sw * (g.y.values - p)) - pn * (bb - b)
            st_ = np.linalg.solve(H, gr); bb += st_
            if np.abs(st_).max() < 1e-7: break
        num = den = 0.0
        for f, s2, votes, t in cells:
            if s2 != st: continue
            gg = grid.copy(); gg["state"] = st; gg["region8"] = S2R.get(st); gg["area"] = CT.get(f, "Suburban"); gg["wave"] = LAST
            Xm = X(gg, LAST).reindex(columns=cols, fill_value=0.0).values
            pp = inv(Xm @ bb - 0.5 * bb[cols.index("female")]).reshape(4, 4, 2, 4)
            num += votes * float((t * (2 * pp - 1)).sum()); den += votes
        rc = RACES.get(("sen-" if off == "senate" else "gov-") + st)
        env = float(T.set_index("state").estimate.get(st, np.nan))
        race_rows.append(dict(state=st, office=off, respondents=int(len(g)), race_mrp=round(100 * num / den, 1), environment=round(env, 1),
                              candidate_effect=round(100 * num / den - env, 1),
                              forecast=None if not rc else round(-rc["est"]["margin"], 1), poll_avg=None if not rc or rc.get("pollAvg") is None else round(-rc["pollAvg"], 1),
                              dem=None if not rc else rc.get("dem"), gop=None if not rc else rc.get("gop")))
R5 = pd.DataFrame(race_rows)
T.to_csv(f"{OUT}/state_generic_mrp.csv", index=False); R5.to_csv(f"{OUT}/race_mrp_onpoint_states.csv", index=False)
coef_show = {k: round(v, 3) for k, v in COEF.items() if not k.startswith(("st=", "reg=", "wave="))}
summ = dict(national_2024_margin=round(NAT24, 2), targets=dict(poll=T_poll, gallup=round(T_gal, 2), blend=round(T_blend, 2)),
            mrp_raw_national=round(raw_nat, 2), logit_shift=dict(poll=round(d_poll, 4), gallup=round(d_gal, 4), blend=round(d_bl, 4)),
            fit_rows=int(len(fit)), waves=WAVES, coefficients=coef_show, area=AREA)
json.dump(summ, open(f"{OUT}/mrp_summary.json", "w"), indent=1, default=str)
print(json.dumps({k: v for k, v in summ.items() if k != "area"}, indent=1, default=str))
print(json.dumps(AREA, indent=1, default=str)[:5000])
pd.set_option("display.width", 250); pd.set_option("display.max_rows", 100)
print(T[["state", "pres_2024", "baseline", "demo_only", "elasticity_demo", "mrp_poll_target", "mrp_gallup_target", "swing_model", "estimate", "shift_vs_2024", "respondents"]].to_string())
print(R5.to_string())
