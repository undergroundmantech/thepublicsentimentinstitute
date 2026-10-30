"""Ground up county electorate and vote, Oct 30 2026.

Every county is built from its potential voters. The On Point national dataset, all 5,932 respondents with every
answer completed by MRP, gives each respondent a turnout probability and a vote:

  turnout   the stated intention to vote, vote history in 2022 and 2024, how many of the people closest to them will
            vote, whether they already voted, and how they plan to vote, blended with the dataset's own calibrated
            turnout probability; respondents who already voted are certain
  vote      the leaned generic ballot, D, R or other, for respondents whose ballot answer is real (vote outcomes are
            never imputed), weighted by likely voter weight times the wave multiplier, so later waves count more

Both are fit on the respondents' cells, 2024 recalled vote by race, college, age, gender and area type, with region
and state effects shrunk hard. The vote model is how each 2024 group votes now, so a county inherits the shift its
own 2024 voters made: Trump voters by race and age, Harris voters, 2024 nonvoters, each by area. The issue items
(cost of living, immigration enforcement, Iran, the Epstein files, democratic socialists, transgender issues: more
likely D or R) and approval give each cell an intensity, how hard its voters lean this year, which scales the
turnout gap between the two sides' voters in the cell.

Each county's joint table of age, race, college and 2024 vote is seeded from its region and raked to the county's
marginals. Turnout is then moved by the reported field programs (a measured get out the vote edge raises the
turnout of the favored side's low and middle propensity voters by about a point) and Election Day weather (rain,
storms or snow keep some Election Day voters home, low propensity voters most, after the early vote already banked).
The national vote among the simulated electorate is levelled to the Oct 28 On Point national poll, D+13.1.

Then every county is simulated voter by voter, 300 times: each cell's voters turn out as independent draws from
their turnout probability and vote as independent draws from their vote probabilities, with a national shock, a
state shock, shocks shared by each 2024 vote by race group everywhere, and a county shock. Writes county_ground.csv:
the county's simulated two party Democratic share, its 10th and 90th percentiles, turnout relative to the base
projection, and swing_logit against its 2024 result, in the county MRP file layout the forecast reads.

usage: python3 voter_sim.py OUT_DIR
"""
import sys, os, json, numpy as np, pandas as pd

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/np1028/out/ground"
os.makedirs(OUT, exist_ok=True)
NAT = "/tmp/np1028/data/nat_full.csv"
FRAME = "/tmp/np1028/out/mrp_v2/national_county_frame.csv"
BASE = "/tmp/fcrun/blend2/county_mrp.csv"          # for d2_2024 by county
ENV = "/tmp/np1028/data/national_environment.json"
TURN = "/tmp/fcrun/turnout_research.json"
EVB = "/tmp/fcrun/fm/ev_enth.json"
TARGET_D2 = 0.5655                                 # D+13.1, the Oct 28 On Point national poll
SIMS, SEED = 300, 20261103
inv = lambda x: 1 / (1 + np.exp(-x)); lg = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))

N = pd.read_csv(NAT, low_memory=False)
F = pd.read_csv(FRAME, dtype={"fips": str})
B = pd.read_csv(BASE, dtype={"fips": str}).set_index("fips")
ENVJ = json.load(open(ENV)); MULT = ENVJ["pooled_dataset_fast_drift"]["wave_multipliers"]
TR = json.load(open(TURN)) if os.path.exists(TURN) else {"weather": {}, "gotv": {}}
EV = json.load(open(EVB)) if os.path.exists(EVB) else {}

# ------------------------------------------------------------ respondent behavior
N["area"] = N.area_type.map({"City": "City", "Suburban": "Suburban", "Rural and small town": "Rural"})
N["pool"] = N.wave.map(MULT).fillna(1.0)
INTENT = {"Certain / highly motivated": 0.90, "Very likely / motivated": 0.74, "Somewhat likely": 0.48, "Motivated but unsure": 0.42,
          "Not very likely": 0.18, "Certain not to vote": 0.04}
VH = {"Voted 2022 and 2024": 0.6, "Voted 2024, not 2022": 0.0, "Voted 2022, not 2024": 0.2, "Voted in neither": -0.9}
CONT = {"All or nearly all": 0.35, "Most": 0.15, "About half": 0.0, "A few": -0.3, "None of them": -0.6, "Not sure": -0.1}
t_items = lg(N.intent_answer.map(INTENT).fillna(0.5)) + N.vh_answer.map(VH).fillna(0) + N.contacts_answer.map(CONT).fillna(0)
t_i = inv(0.5 * t_items + 0.5 * lg(N.turnout_prob.clip(0.02, 0.995)))
t_i = np.where(N.already_answer == "Already voted", 0.995, t_i)
t_i = np.where(N.vm_answer == "Not voting", np.minimum(t_i, 0.08), t_i)
N["t"] = t_i
# intensity: the issue pushes and approval, D positive
EFF = ["eff_cost_of_living", "eff_epstein", "eff_iran", "eff_immigration_enforcement", "eff_dem_socialists", "eff_transgender"]
EMAP = {"More likely Democrat, much": 2, "More likely Democrat, somewhat": 1, "No difference": 0, "More likely Republican, somewhat": -1, "More likely Republican, much": -2}
APP = {"Strongly approve": -2, "Somewhat approve": -1, "Neutral / no opinion": 0, "Somewhat disapprove": 1, "Strongly disapprove": 2}
N["push"] = sum(N[f"{e}_answer"].map(EMAP).fillna(0) for e in EFF) / len(EFF) * 0.6 + N.app_answer.map(APP).fillna(0) * 0.4
N["intensity"] = N.push.abs()
N["ed_share"] = (N.vm_answer == "Election Day").astype(float)

REC = ["Harris", "Did not vote", "Third party"]; RACE = ["Black", "Hispanic", "Asian/Other"]; AGE = ["18-29", "30-44", "65+"]
WAVES = sorted(N.wave.unique()); LAST = "Oct 28 National Poll"; RECENT = ["September Benchmark", "October Benchmark", LAST]
REG = sorted(N.region8.dropna().unique()); STS = sorted(N.state.dropna().unique())
def X(d, wave=None):
    c = {}; wv = d.wave.values if wave is None else np.full(len(d), wave)
    c["const"] = np.ones(len(d))
    for v in REC: c[f"rec={v}"] = (d.recall_2024 == v).values.astype(float)
    for v in RACE: c[f"race={v}"] = (d.race4 == v).values.astype(float)
    c["college"] = (d.college == "COLLEGE").values.astype(float)
    c["white_college"] = ((d.race4 == "White") & (d.college == "COLLEGE")).values.astype(float)
    for v in AGE: c[f"age={v}"] = (d.age_band == v).values.astype(float)
    c["female"] = (d.gender == "Female").values.astype(float)
    rec_w = np.isin(wv, RECENT).astype(float)
    for a in ["City", "Rural"]:
        c[f"area={a}"] = (d.area == a).values.astype(float)
        for v in ["Trump", "Harris", "Did not vote"]:
            c[f"rec={v}:area={a}"] = ((d.recall_2024 == v) & (d.area == a)).values.astype(float)
            c[f"recent:rec={v}:area={a}"] = rec_w * c[f"rec={v}:area={a}"]
    for v in ["Hispanic", "Black", "Asian/Other"]:
        c[f"rec=Trump:race={v}"] = ((d.recall_2024 == "Trump") & (d.race4 == v)).values.astype(float)
        c[f"rec=Did not vote:race={v}"] = ((d.recall_2024 == "Did not vote") & (d.race4 == v)).values.astype(float)
    for v in AGE: c[f"rec=Trump:age={v}"] = ((d.recall_2024 == "Trump") & (d.age_band == v)).values.astype(float)
    c["rec=Did not vote:age=18-29"] = ((d.recall_2024 == "Did not vote") & (d.age_band == "18-29")).values.astype(float)
    for v in WAVES:
        if v != LAST: c[f"wave={v}"] = (wv == v).astype(float)
    for r in REG: c[f"reg={r}"] = (d.region8 == r).values.astype(float)
    for s in STS: c[f"st={s}"] = (d.state == s).values.astype(float)
    return pd.DataFrame(c)
def pen_of(cols): return np.array([0.0 if k == "const" else 25.0 if k.startswith("st=") else 8.0 if k.startswith("reg=") else 2.0 if k.startswith("wave=") else 1.0 for k in cols])
def fit(Xf, y, w, cols):
    A = Xf.values; b = np.zeros(A.shape[1]); pen = pen_of(cols)
    for _ in range(80):
        p = inv(A @ b); W = w * p * (1 - p)
        step = np.linalg.solve(A.T @ (A * W[:, None]) + np.diag(pen), A.T @ (w * (y - p)) - pen * b); b += step
        if np.abs(step).max() < 1e-7: break
    return b

ok = N.recall_2024.notna() & N.age_band.notna() & N.race4.notna() & N.area.notna()
wrv = N.weight_mrp_rv.astype(float); wrv = np.nan_to_num(wrv / np.nanmean(wrv), nan=1.0)
pD, pR = N.gb_p_democrat, N.gb_p_republican
# vote: real ballot answers only, likely voter weighted
fv = ok & (N.gb_source != "modeled") & ((pD + pR) > 0.05)
Xv = X(N[fv]); cols = list(Xv.columns)
bv = fit(Xv, (pD / (pD + pR))[fv].values, (wrv[fv] * N.pool[fv] * N.t[fv] * (pD + pR)[fv]).values, cols)
# other share among voters, by 2024 vote
oth = N[fv].assign(o=1 - (pD + pR)[fv]).groupby("recall_2024").apply(lambda g: np.average(g.o, weights=(wrv[g.index] * g.t).clip(1e-6))).to_dict()
# turnout: every respondent, registered voter weighted
Xt = X(N[ok]); bt = fit(Xt, N.t[ok].values, (wrv[ok] * N.pool[ok]).values, list(Xt.columns))
# intensity and Election Day share, by 2024 vote and race
grp = lambda d: d.recall_2024.astype(str) + "|" + d.race4.astype(str)
G = N[ok].assign(g=grp(N[ok]), w=wrv[ok] * N.pool[ok])
INTEN = G.groupby("g").apply(lambda g: np.average(g.intensity, weights=g.w)).to_dict()
EDS = G.groupby("g").apply(lambda g: np.average(g.ed_share, weights=g.w)).to_dict()
# the 2024 recall swing by group: 2026 two party D share among the group's likely voters against the group's 2024 vote
SW = []
for dim in ["race4", "age_band", "college", "area", "gender"]:
    for v, g in N[fv & N.recall_2024.isin(["Harris", "Trump"])].groupby(dim):
        w = (wrv[g.index] * g.pool * g.t).values
        d26 = float(np.average((g.gb_p_democrat / (g.gb_p_democrat + g.gb_p_republican)).values, weights=w))
        d24 = float(np.average((g.recall_2024 == "Harris").values, weights=w))
        SW.append(dict(group=dim, value=str(v), n=len(g), harris_2024=round(d24, 4), dem_2026=round(d26, 4), shift_pts=round(200 * (d26 - d24), 1)))
pd.DataFrame(SW).to_csv(f"{OUT}/group_shifts_from_2024_recall.csv", index=False)

# ------------------------------------------------------------ county tables
AG4 = ["18-29", "30-44", "45-64", "65+"]; RC4 = ["White", "Black", "Hispanic", "Asian/Other"]; CO2 = ["NON-COLLEGE", "COLLEGE"]; RE4 = ["Trump", "Harris", "Third party", "Did not vote"]
lv = N[ok]
def joint(d):
    t = np.full((4, 4, 2, 4), 0.5)
    ia = d.age_band.map({k: i for i, k in enumerate(AG4)}); ir = d.race4.map({k: i for i, k in enumerate(RC4)})
    ic = d.college.map({k: i for i, k in enumerate(CO2)}); ie = d.recall_2024.map({k: i for i, k in enumerate(RE4)})
    m = ia.notna() & ir.notna() & ic.notna() & ie.notna()
    np.add.at(t, (ia[m].astype(int), ir[m].astype(int), ic[m].astype(int), ie[m].astype(int)), d.weight_mrp_rv[m].values)
    return t / t.sum()
J_nat = joint(lv); J_reg = {r: joint(lv[lv.region8 == r]) for r in REG}
grid = pd.DataFrame([dict(age_band=a, race4=r, college=c, recall_2024=e) for a in AG4 for r in RC4 for c in CO2 for e in RE4]); grid["gender"] = "Female"
GKEY = (grid.recall_2024 + "|" + grid.race4).values
CACHE = {}
INK = np.array([INTEN.get(k, 0.5) for k in GKEY]); INK_MEAN = float(np.average(G.intensity, weights=G.w))
OTH = np.array([oth.get(k.split('|')[0], 0.02) for k in GKEY])
def cell(st, reg, area):
    k = (st, reg, area)
    if k not in CACHE:
        g = grid.copy(); g["state"] = st; g["region8"] = reg; g["area"] = area; g["wave"] = LAST
        A = X(g, LAST).reindex(columns=cols, fill_value=0.0).values
        fem_v = dict(zip(cols, bv)).get("female", 0.0); fem_t = dict(zip(cols, bt)).get("female", 0.0)
        CACHE[k] = (A @ bv - 0.5 * fem_v, A @ bt - 0.5 * fem_t)
    return CACHE[k]
W_ = TR.get("weather", {}); GV = TR.get("gotv", {})
def edge_of(st):
    e = (GV.get(st) or {}).get("edge", "unknown")
    # the Texas call rests on a New York Times story, a source the site does not use, so it is not counted
    return "unknown" if st == "TX" else e
rows = []
for x in F.itertuples():
    seed = 0.5 * J_reg.get(x.region8, J_nat) + 0.5 * J_nat; t = seed.copy()
    age = np.array([x.age_18_29, x.age_30_44, x.age_45_64, x.age_65_plus]); race = np.array([x.race_white, x.race_black, x.race_hispanic, x.race_asian_other])
    col = np.array([x.no_degree, x.college]); rec = np.array([x.vote24_trump, x.vote24_harris, x.vote24_third, x.vote24_nonvoter])
    for _ in range(40):
        t *= (age / np.maximum(t.sum((1, 2, 3)), 1e-12))[:, None, None, None]; t *= (race / np.maximum(t.sum((0, 2, 3)), 1e-12))[None, :, None, None]
        t *= (col / np.maximum(t.sum((0, 1, 3)), 1e-12))[None, None, :, None]; t *= (rec / np.maximum(t.sum((0, 1, 2)), 1e-12))[None, None, None, :]
    share = (t / t.sum()).ravel(); lv_v, lv_t = cell(x.state, x.region8, x.area)
    rows.append((x.fips, x.state, float(x.votes_2026), share, lv_v, lv_t))

# turnout modifiers: field programs and weather, then the base turnout level per county
def modify(st, tp, pd_):
    t = tp.copy()
    e = edge_of(st)
    if e in ("D", "R"):
        fav = pd_ if e == "D" else 1 - pd_
        t = t + 0.010 * np.clip((fav - 0.5) * 2, 0, 1) * np.clip((1 - t) / 0.5, 0, 1)
    sev = float((W_.get(st) or {}).get("severity", 0) or 0)
    if sev > 0:
        banked = float((EV.get(st) or {}).get("banked", 0.4) or 0.4)
        ed = np.array([EDS.get(k, 0.5) for k in GKEY])
        ed_left = np.clip(ed * (1 - banked) / max(1e-6, 1 - 0.4), 0, 1)     # Election Day voters still to come
        loss = (0.010 + 0.025 * np.clip((0.8 - t) / 0.5, 0, 1)) * sev       # low propensity voters stay home more
        t = t * (1 - loss * ed_left)
    return np.clip(t, 0.005, 0.999)

def county_vote(delta, mods=True, shocks=None):
    out = []
    for f, st, v26, share, lv_v, lv_t in rows:
        pdv = inv(lv_v + delta + (0 if shocks is None else shocks(f, st)))
        # intensity: cells whose voters feel this year's issues hardest turn out a little more
        tp = inv(lv_t + 0.10 * (INK - INK_MEAN))
        if mods: tp = modify(st, tp, pdv)
        out.append((f, st, v26, share, tp, pdv))
    return out
def national(delta):
    num = den = 0.0
    for f, st, v26, share, tp, pdv in county_vote(delta):
        e = share * tp; e = e / e.sum()
        o = OTH
        dd = float((e * pdv * (1 - o)).sum()); rr = float((e * (1 - pdv) * (1 - o)).sum())
        num += v26 * dd; den += v26 * (dd + rr)
    return num / den
lo, hi = -2.0, 2.0
for _ in range(45):
    mid = (lo + hi) / 2; (lo, hi) = (mid, hi) if national(mid) < TARGET_D2 else (lo, mid)
DELTA = (lo + hi) / 2

# base turnout per county without the modifiers, so the simulation moves totals only by field and weather
base_t = {f: float((share * inv(lv_t)).sum()) for f, st, v26, share, lv_v, lv_t in rows}

# ------------------------------------------------------------ voter by voter simulation
rng = np.random.default_rng(SEED)
STS_ALL = sorted(set(r[1] for r in rows)); GROUPS = sorted(set(GKEY))
nat_s = rng.normal(0, 0.06, SIMS); st_s = {s: rng.normal(0, 0.05, SIMS) for s in STS_ALL}
grp_s = {g: rng.normal(0, 0.04, SIMS) for g in GROUPS}; st_t = {s: rng.normal(0, 0.03, SIMS) for s in STS_ALL}
gidx = np.array([GROUPS.index(k) for k in GKEY]); GS = np.stack([grp_s[g] for g in GROUPS], 0)   # groups x sims
res = []
for f, st, v26, share, tp, pdv in county_vote(DELTA):
    pop = max(1.0, v26 / max(base_t[f], 0.05))                 # potential voters behind the base projection
    n_c = np.maximum(0, np.round(pop * share)).astype(np.int64)    # every cell's potential voters
    o = OTH
    lvv = lg(pdv)[:, None] + nat_s[None, :] + st_s[st][None, :] + GS[gidx] + rng.normal(0, 0.03, SIMS)[None, :]
    ltt = lg(tp)[:, None] + st_t[st][None, :]
    T = rng.binomial(n_c[:, None].repeat(SIMS, 1), inv(ltt))                 # who turns out
    O = rng.binomial(T, o[:, None].repeat(SIMS, 1))                           # third party votes
    Dv = rng.binomial(T - O, inv(lvv))                                        # Democratic votes among the rest
    Rv = T - O - Dv
    d2 = Dv.sum(0) / np.maximum(Dv.sum(0) + Rv.sum(0), 1)
    tot = T.sum(0)
    e = share * tp; e = e / e.sum(); d2m = float((e * pdv * (1 - o)).sum() / max((e * (1 - o)).sum(), 1e-9))
    res.append(dict(fips=f, state=st, votes_2026=v26, votes_sim=round(float(np.mean(tot)), 1), turnout_rel=round(float(np.mean(tot)) / max(v26, 1), 5),
                    d2_ground=round(float(np.mean(d2)), 5), d2_expected=round(d2m, 5), d2_p10=round(float(np.quantile(d2, 0.1)), 5), d2_p90=round(float(np.quantile(d2, 0.9)), 5)))
R = pd.DataFrame(res)
R["d2_2024"] = B.d2_2024.reindex(R.fips).values
R["margin_2024"] = (100 * (2 * R.d2_2024 - 1)).round(2); R["margin_ground"] = (100 * (2 * R.d2_ground - 1)).round(2)
R["swing_pts"] = (R.margin_ground - R.margin_2024).round(2)
R["swing_logit"] = (lg(R.d2_ground) - lg(R.d2_2024)).round(5)
R["d2_mrp"] = R.d2_ground
R.to_csv(f"{OUT}/county_ground.csv", index=False)
w = R.votes_sim
summ = dict(delta=round(DELTA, 4), national_d2=round(float((R.d2_ground * w).sum() / w.sum()), 4), counties=len(R), sims=SIMS,
            turnout_rel_mean=round(float((R.turnout_rel * R.votes_2026).sum() / R.votes_2026.sum()), 4),
            by_state={s: dict(d2=round(float((g.d2_ground * g.votes_sim).sum() / g.votes_sim.sum()), 4), margin=round(float(100 * (2 * (g.d2_ground * g.votes_sim).sum() / g.votes_sim.sum() - 1)), 2),
                              turnout_rel=round(float(g.votes_sim.sum() / g.votes_2026.sum()), 4), weather=(W_.get(s) or {}).get("severity", 0), field_edge=edge_of(s)) for s, g in R.groupby("state")})
json.dump(summ, open(f"{OUT}/ground_summary.json", "w"), indent=1)
print("delta", summ["delta"], "national two party D", summ["national_d2"], "turnout vs base", summ["turnout_rel_mean"])
for s in ["TX", "MI", "OH", "IA", "ME", "NC", "GA", "NH", "AK", "NE", "KS", "SC", "FL", "MN", "AZ", "WI", "PA", "NV"]:
    b = summ["by_state"].get(s); print(s, b)
