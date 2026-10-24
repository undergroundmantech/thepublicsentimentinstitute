"""Multilevel model of 2026 vote from the On Point state polls, version 2, Oct 19 2026; Oct 24: seven states, Iowa and Kansas added.

usage (from the model folder, flags sourced): python3 /tmp/fs5/work/mrp7.py OUTDIR

Oct 24 changes only: STATES adds IA and KS, both anchored to the certified 2024 recall among voters; their turnout gap
is measured from the harmonized respondents; their leaned toplines are the published ones.


usage (from the model folder, flags sourced): python3 /tmp/fs5/work/mrp5.py OUTDIR

Why version 2. A direct demographic model of 2026 vote (mrp5_direct.py) failed leave one state out: with five states,
race group and county lean coefficients cannot tell Florida Hispanic voters from Texas Hispanic voters, so held out
Florida came out D+15 against a poll at R+7. This version keeps each place's own 2024 vote as the baseline and models
only how 2024 voters move, which is what transfers between states.

Model. Each respondent is in one 2024 recall group g: Trump, Harris, or other (did not vote or third party).
    Trump voters:   logit P(vote D in race r)      = X_i b_T + u_T,r
    Harris voters:  logit P(vote R in race r)      = X_i b_H + u_H,r
    other voters:   logit P(vote D in race r | D or R) = X_i b_O + u_O,r
X_i: race group, age, gender, college, White x college, county 2024 Harris two party log odds, county Hispanic,
Black and college shares. u_g,r = m_g,s + c_g,r: the state's environment in that group and the race's candidate
effect. Penalized weighted IRLS on likely voter weights, D versus R as asked; the leaned version adds undecided voters
at the leaner model's probability. Variances: candidate effects from the within state Senate minus governor gap, state
environments by DerSimonian and Laird around their mean.

Electorate. Every county's 32 citizen adult cells (age x race x college) at the census leg's 2026 turnout. Inside a
cell, 2024 Harris and Trump voters split as the census leg's 2024 cell model, calibrated county by county to the
certified 2024 result. The likely electorate is then tilted by the turnout gap: in log odds of Harris among 2024
voters, the state's measured gap where we polled, else the mean of the three states whose recall was anchored to the
certified result (Texas, Michigan, South Carolina). 2024 nonvoters are a share of each cell by age, from the polls.
"""
import os, sys, json, glob
import numpy as np, pandas as pd
sys.path.insert(0, os.getcwd())
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
import senate_mode as sm
import respondent_v2 as rv
import county_demo as cdm

inv = lambda x: 1 / (1 + np.exp(-x)); logit = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))
FEMALE = 0.54
STATES5 = ["OH", "TX", "MI", "FL", "SC", "IA", "KS"]
ANCHORED = ["TX", "MI", "SC", "IA", "KS"]           # 2024 recall among voters weighted to the certified result
GROUPS = ["T", "H", "O"]
AGE, RACE, COL = sm.AGE, sm.RACE, sm.COL

F = rv.FIVE_ROWS[0].copy()
F["county_fips"] = F.county_fips.astype("Int64").astype(str).str.zfill(5)
F["g"] = F.recall_2024.map({"Trump": "T", "Harris": "H"}).fillna("O")
P24 = pd.read_csv(f"{sm.BASE}/../geo/pres24.csv", dtype={"county_fips": str}).set_index("county_fips")
a24c = (P24.votes_dem / (P24.votes_dem + P24.votes_gop)).clip(0.02, 0.98)
CT = cdm.table()
st24 = P24.groupby(P24.index.str[:2]).apply(lambda g: g.votes_dem.sum() / (g.votes_dem.sum() + g.votes_gop.sum()))
FIPS2 = rv._AB2F

INAMES = ["age_30_44", "age_45_64", "age_65", "black", "hispanic", "asian_other", "college", "white_x_college", "female"]
CNAMES = ["county_harris24_logit", "county_hispanic", "county_black", "county_college"]
def indiv(age, race, col, fem):
    age, race, col = np.asarray(age), np.asarray(race), np.asarray(col)
    return np.column_stack([age == "30-44", age == "45-64", age == "65+", race == "Black", race == "Hispanic", race == "Asian/Other",
                            col == "COLLEGE", (race == "White") & (col == "COLLEGE"), np.asarray(fem)]).astype(float)
def county_feats(fips):
    t = CT.reindex(fips).fillna(CT.median())
    a = a24c.reindex(fips).fillna(0.45).values
    return np.column_stack([logit(a), t.his.values, t.blk.values, t.col.values])

def long_frame(F, leaned):
    rows = []
    for o, col in (("S", "op5_senate"), ("G", "op5_governor")):
        p = F[f"{col}_party"]; pdem = F[f"{col}_undecided_p_dem"]
        keep = p.isin(["D", "R"]) | (leaned & (p == "Undecided") & pdem.notna())
        d = F[keep].copy()
        d["yD"] = np.where(p[keep] == "D", 1.0, np.where(p[keep] == "R", 0.0, pdem[keep]))
        d["race_key"] = d.state + "-" + o; d["office"] = o
        rows.append(d)
    L = pd.concat(rows, ignore_index=True)
    L["w"] = L.weight_lv_design * L.groupby("state").weight_lv_design.transform(lambda s: len(s) / s.sum())
    X = np.column_stack([indiv(L.age_band, L.race4, L.college, (L.gender == "Female").astype(float)), county_feats(L.county_fips.tolist())])
    return L, X

def fit(X, y, w, groups, lam_fixed=2.0, lam_group=0.05, it=80):
    G = sorted(set(groups)); Z = np.column_stack([np.asarray(groups) == g for g in G]).astype(float)
    A = np.column_stack([X, Z]); k = X.shape[1]
    pen = np.r_[np.full(k, lam_fixed), np.full(len(G), lam_group)]
    b = np.zeros(A.shape[1]); b[k:] = logit(np.clip(np.average(y, weights=w), 0.02, 0.98))
    for _ in range(it):
        p = inv(A @ b); W = w * p * (1 - p)
        H = A.T @ (A * W[:, None]) + np.diag(pen); g = A.T @ (w * (y - p)) - pen * b
        step = np.linalg.solve(H, g); b = b + step
        if np.max(np.abs(step)) < 1e-8: break
    deff = len(w) * (w ** 2).sum() / w.sum() ** 2
    return dict(b=b[:k], u=dict(zip(G, b[k:])), V=np.linalg.inv(H) * deff, k=k, G=G, deff=float(deff))

def fit_groups(L, X, mask=None):
    m = np.ones(len(L), bool) if mask is None else mask
    out = {}
    for g in GROUPS:
        s = m & (L.g.values == g)
        y = L.yD.values[s] if g != "H" else 1 - L.yD.values[s]      # Harris voters: probability of voting Republican
        out[g] = fit(X[s], y, L.w.values[s], L.race_key.values[s])
    return out

def decompose(f_):
    G, k, V = f_["G"], f_["k"], f_["V"]
    st = sorted({g.split("-")[0] for g in G if g.endswith("-S") and g.replace("-S", "-G") in G})
    m, v, gaps, gse = {}, {}, [], []
    for s in st:
        iS, iG = k + G.index(f"{s}-S"), k + G.index(f"{s}-G")
        m[s] = 0.5 * (f_["u"][f"{s}-S"] + f_["u"][f"{s}-G"]); v[s] = 0.25 * (V[iS, iS] + V[iG, iG] + 2 * V[iS, iG])
        gaps.append(f_["u"][f"{s}-S"] - f_["u"][f"{s}-G"]); gse.append(V[iS, iS] + V[iG, iG] - 2 * V[iS, iG])
    gaps, gse = np.array(gaps), np.array(gse)
    off = float(gaps.mean())
    tau_c2 = max(0.0, (np.sum((gaps - off) ** 2) / max(len(gaps) - 1, 1) - np.mean(gse)) / 2)
    est = np.array([m[s] for s in st]); var = np.array([v[s] for s in st]) + tau_c2 / 2
    tau_s2, _, _ = rv._dl(est, var)
    w = 1 / (var + tau_s2); mu = float((w * est).sum() / w.sum())
    return dict(mu=mu, mu_se=float(np.sqrt(1 / w.sum())), tau_state=float(np.sqrt(tau_s2)), tau_cand=float(np.sqrt(tau_c2)),
                office_gap=off, state_env={s: float(m[s]) for s in st}, state_env_se={s: float(np.sqrt(v[s])) for s in st},
                candidate={g: float(f_["u"][g] - m[g.split("-")[0]]) for g in G if g.split("-")[0] in m})

# ── electorate frame ─────────────────────────────────────────────────────────────────────────────────────
print("census cells ...", flush=True)
model = sm.fit_respondents()
shift, nat, nat_turn = sm.national_shift(model)
ACS_US = sm.ACS[sm.ACS.index.str.match(r"^\d{5}$") & ~sm.ACS.index.str.startswith("72")]
ALLF = [f for f in ACS_US.index if f in sm.APPROVAL.index]
abbr = sm.APPROVAL.state_abbr.to_dict()
region_of = lambda f: model["state_region"].get(abbr.get(f), model["regions"][0])
pops, eta, turn, adults, eta24 = sm.census_components(model, ALLF, region_of)
LVW = np.maximum(pops * turn, 0.0)
ST_OF = np.array([abbr.get(f) for f in ALLF])
A24 = a24c.reindex(ALLF).fillna(0.45).values
V24 = P24.total_votes.reindex(ALLF).fillna(0).values
# calibrate the 2024 cell model to each county's certified result
lo, hi = np.full(len(ALLF), -6.0), np.full(len(ALLF), 6.0)
for _ in range(60):
    mid = (lo + hi) / 2
    d = (LVW * inv(eta24 + shift[1] + mid[:, None])).sum(1) / np.maximum(LVW.sum(1), 1e-9)
    lo, hi = np.where(d < A24, mid, lo), np.where(d < A24, hi, mid)
H_CELL = inv(eta24 + shift[1] + ((lo + hi) / 2)[:, None])            # P(Harris | 2024 two party voter, cell, county)
CELL = [(a, r, c) for a in AGE for r in RACE for c in COL]
XI_cells = indiv([x[0] for x in CELL], [x[1] for x in CELL], [x[2] for x in CELL], np.zeros(32))
XC_all = county_feats(ALLF)
AGE_OF_CELL = np.array([AGE.index(x[0]) for x in CELL])

# measured turnout gap and nonvoter shares from the polls
PI = pd.read_csv(glob.glob("/tmp/fs5/resp/*/OnPoint_Five_State_Poll_Index.csv")[0]).set_index("state")
TP = pd.read_csv(glob.glob("/tmp/fs5/wt/*/Transferable_Parameters_by_Race.csv")[0])
GAP = {}
for s in [x for x in STATES5 if x in set(TP.state)]:
    t = TP[TP.state == s].iloc[0]
    # LV recall margin among 2024 voters versus the certified margin, in log odds of Harris among two party voters
    lv_h = 0.5 - t.lv_recall_trump_margin_among_2024_voters / 200; act_h = 0.5 - t.trump_margin_2024 / 200
    GAP[s] = float(logit(lv_h) - logit(act_h))
for s in ("IA", "KS"):
    g = F[F.state == s]; w = g.weight_lv_design
    H, T = w[g.recall_2024 == "Harris"].sum(), w[g.recall_2024 == "Trump"].sum()
    GAP[s] = float(logit(H / (H + T)) - logit(float(st24[FIPS2[s]])))
for s, v in {"IA": dict(senate_leaned_D=51.6, senate_leaned_R=46.9, governor_leaned_D=52.0, governor_leaned_R=47.3),
             "KS": dict(senate_leaned_D=48.9, senate_leaned_R=47.1, governor_leaned_D=46.3, governor_leaned_R=52.8)}.items():
    for k, x in v.items(): PI.loc[s, k] = x
def nv_share(states):
    g = F[F.state.isin(states)]
    w = g.weight_lv_design
    return np.array([float(w[(g.age_band == a) & (g.g == "O")].sum() / max(w[g.age_band == a].sum(), 1e-9)) for a in AGE])

def predict_counties(fits, u_of, gap_of, nv, mask=None, fem=FEMALE):
    """D two party share per county. fits: group fits; u_of(group, state) -> intercept; gap_of(state) -> logit tilt."""
    idx = np.arange(len(ALLF)) if mask is None else np.where(mask)[0]
    out = np.zeros(len(idx)); W = LVW[idx]
    for j, i in enumerate(idx):
        s = ST_OF[i]
        h = inv(logit(H_CELL[i]) + gap_of(s))                      # Harris share of 2024 two party voters in the LV electorate
        nvs = nv[AGE_OF_CELL]
        pD = np.zeros(32)
        for g in GROUPS:
            b = fits[g]["b"]; ki = XI_cells.shape[1]
            e = XI_cells @ b[:ki] + XC_all[i] @ b[ki:] + u_of(g, s)
            p = fem * inv(e + b[INAMES.index("female")]) + (1 - fem) * inv(e)
            if g == "T": pD += (1 - nvs) * (1 - h) * p
            elif g == "H": pD += (1 - nvs) * h * (1 - p)
            else: pD += nvs * p
        out[j] = (W[j] * pD).sum() / max(W[j].sum(), 1e-9)
    return out, W.sum(1)

def state_margin(fits, u_of, gap_of, nv, s):
    m = ST_OF == s
    p, w = predict_counties(fits, u_of, gap_of, nv, m)
    return float(100 * (2 * (p * w).sum() / w.sum() - 1))

pres = {s: float(100 * (2 * st24[FIPS2[s]] - 1)) for s in STATES5}
obs = {}
for s in STATES5:
    g = F[F.state == s]
    for o, col, key in (("S", "op5_senate", "senate"), ("G", "op5_governor", "governor")):
        w = g.weight_lv_design; p = g[f"{col}_party"]; D, R = w[p == "D"].sum(), w[p == "R"].sum()
        lD, lR = PI.loc[s, f"{key}_leaned_D"], PI.loc[s, f"{key}_leaned_R"]
        obs[f"{s}-{o}"] = dict(as_asked=float(100 * (D - R) / (D + R)), leaned=float(100 * (lD - lR) / (lD + lR)))

# ── full fits, in sample check ─────────────────────────────────────────────────────────────────────────────
res = {}
for tag, leaned in (("as_asked", False), ("leaned", True)):
    L, X = long_frame(F, leaned)
    fits = fit_groups(L, X)
    dec = {g: decompose(fits[g]) for g in GROUPS}
    nv = nv_share(STATES5)
    ins = {}
    for r in fits["T"]["G"]:
        s = r.split("-")[0]
        ins[r] = dict(model=state_margin(fits, lambda g, ss, r=r: fits[g]["u"][r], lambda ss: GAP[s], nv_share([s]), s), poll=obs[r][tag])
    res[tag] = dict(L=L, X=X, fits=fits, dec=dec, in_sample=ins)

# ── leave one state out ───────────────────────────────────────────────────────────────────────────────────
loso = []
for tag, leaned in (("as_asked", False), ("leaned", True)):
    L, X = res[tag]["L"], res[tag]["X"]
    for h in STATES5:
        tr = (L.state != h).values
        fits = fit_groups(L, X, tr)
        dec = {g: decompose(fits[g]) for g in GROUPS}
        others = [s for s in STATES5 if s != h]
        anch = [s for s in ANCHORED if s != h]
        gap_h = float(np.mean([GAP[s] for s in anch]))
        nv = nv_share(others)
        for o in ("S", "G"):
            sgn = 0.5 if o == "S" else -0.5
            u_of = lambda g, ss, sgn=sgn: dec[g]["mu"] + sgn * dec[g]["office_gap"]
            pm = state_margin(fits, u_of, lambda ss: gap_h, nv, h)
            pm0 = state_margin(fits, u_of, lambda ss: 0.0, nv, h)
            sw = np.mean([obs[f"{s}-{o}"][tag] - pres[s] for s in others])
            sw_all = np.mean([obs[f"{s}-{oo}"][tag] - pres[s] for s in others for oo in ("S", "G")])
            loso.append(dict(version=tag, race=f"{h}-{o}", poll=obs[f"{h}-{o}"][tag], pres_2024=pres[h],
                             mrp=pm, mrp_no_turnout_gap=pm0, uniform_swing_same_office=pres[h] + sw, uniform_swing=pres[h] + sw_all))
LO = pd.DataFrame(loso)
for c in ("mrp", "mrp_no_turnout_gap", "uniform_swing_same_office", "uniform_swing"):
    LO[f"err_{c}"] = LO[c] - LO.poll

# ── national environment and priors ─────────────────────────────────────────────────────────────────────────
tag = "leaned"; fits, dec = res[tag]["fits"], res[tag]["dec"]
gap_bar = float(np.mean([GAP[s] for s in ANCHORED]))
nv_all = nv_share(STATES5)
u_env = lambda g, ss: dec[g]["mu"]
def gap_unpolled(s): return GAP[s] if s in GAP else gap_bar
p_env, w_env = predict_counties(fits, u_env, lambda s: gap_bar, nv_all)          # every county at the pooled gap
p_env0, _ = predict_counties(fits, u_env, lambda s: 0.0, nv_all)
NAT24 = float(100 * (2 * sm.NAT_2024_D2 - 1))
env = dict(point=float(100 * (2 * (p_env * w_env).sum() / w_env.sum() - 1)),
           no_turnout_gap=float(100 * (2 * (p_env0 * w_env).sum() / w_env.sum() - 1)),
           nat_2024_two_party_margin=NAT24, turnout_gap_logit_used=gap_bar, turnout_gap_by_state_logit=GAP)
# uncertainty: the environment intercepts' standard errors, the spread of state environments (a new state is a draw),
# and the turnout gap spread across the three anchored states, propagated by simulation through the poststratification
rng = np.random.default_rng(20261019)
sims = []
for _ in range(80):
    dmu = {g: rng.normal(0, np.hypot(dec[g]["mu_se"], 0.0)) for g in GROUPS}
    gz = rng.normal(gap_bar, np.std([GAP[s] for s in ANCHORED], ddof=1))
    p_, w_ = predict_counties(fits, lambda g, ss: dec[g]["mu"] + dmu[g], lambda s: gz, nv_all)
    sims.append(float(100 * (2 * (p_ * w_).sum() / w_.sum() - 1)))
env.update(sd=float(np.std(sims)), p10=float(np.percentile(sims, 10)), p90=float(np.percentile(sims, 90)))
gallup_lv = float(sm._T26)
env["gallup_anchor"] = dict(adults_D=sm.GALLUP_D, adults_R=sm.GALLUP_R, adults_margin=sm.GALLUP_D - sm.GALLUP_R,
                            census_leg_lv_two_party_margin=float(100 * (2 * gallup_lv - 1)))
env["simple_average_swing"] = dict(senate=float(np.mean([obs[f"{s}-S"]["leaned"] - pres[s] for s in STATES5])),
                                   governor=float(np.mean([obs[f"{s}-G"]["leaned"] - pres[s] for s in STATES5])))
env["simple_average_swing_implied_national"] = dict(senate=NAT24 + env["simple_average_swing"]["senate"], governor=NAT24 + env["simple_average_swing"]["governor"])

# priors at the pooled turnout gap for every state, and for the polled states also at their own gap
COUNTY = pd.DataFrame(dict(fips=ALLF, st=ST_OF, d2_26=p_env, lv=w_env, a24=A24, v24=V24))
COUNTY["swing_logit"] = logit(COUNTY.d2_26) - logit(COUNTY.a24)
STATE = COUNTY.groupby("st").apply(lambda g: pd.Series(dict(prior_d2=(g.d2_26 * g.lv).sum() / g.lv.sum(), pres24_d2=(g.a24 * g.v24).sum() / g.v24.sum()))).reset_index()
STATE["prior_margin"] = 100 * (2 * STATE.prior_d2 - 1); STATE["pres24_margin"] = 100 * (2 * STATE.pres24_d2 - 1)
STATE["modeled_swing"] = STATE.prior_margin - STATE.pres24_margin
nat_sw = env["point"] - NAT24
STATE["relative_swing"] = STATE.modeled_swing - nat_sw
pvi = pd.read_csv(f"{sm.BASE}/../pvi/pvi.csv")
KERNEL = 0.25
drows = []
for _, r in pvi.iterrows():
    g = COUNTY[COUNTY.st == r.state]
    if not len(g): continue
    d24 = 0.5 - r.m24 / 200
    k = g.v24.values * np.exp(-((logit(g.a24.values) - logit(d24)) ** 2) / (2 * KERNEL ** 2)) + 1e-12
    sw = float((k * g.swing_logit.values).sum() / k.sum())
    drows.append(dict(district=r.district, state=r.state, pres24_margin=-r.m24, prior_margin=100 * (2 * inv(logit(d24) + sw) - 1), swing_logit=sw))
DIST = pd.DataFrame(drows); DIST["modeled_swing"] = DIST.prior_margin - DIST.pres24_margin
DIST["relative_swing"] = DIST.modeled_swing - nat_sw

# group defection and swing tables by state, for the census leg, elasticities and the House
grp = []
F2 = F.copy(); F2["is_col"] = F2.college.eq("COLLEGE")
GM = dict(All=pd.Series(True, index=F2.index), Black=F2.race4.eq("Black"), Hispanic=F2.race4.eq("Hispanic"), White=F2.race4.eq("White"),
          White_college=F2.race4.eq("White") & F2.is_col, White_non_college=F2.race4.eq("White") & ~F2.is_col,
          College=F2.is_col, Non_college=~F2.is_col, Age_18_29=F2.age_band.eq("18-29"), Age_30_44=F2.age_band.eq("30-44"),
          Age_45_64=F2.age_band.eq("45-64"), Age_65_plus=F2.age_band.eq("65+"), Women=F2.gender.eq("Female"), Men=F2.gender.eq("Male"))
for s in STATES5 + ["ALL"]:
    for gname, msk in GM.items():
        g = F2[msk & ((F2.state == s) if s != "ALL" else True)]
        w = g.weight_lv_pop if s == "ALL" else g.weight_lv_design
        r24 = g.recall_2024; H, T = w[r24 == "Harris"].sum(), w[r24 == "Trump"].sum()
        row = dict(state=s, group=gname, n=int(len(g)), recall_2p_margin=float(100 * (H - T) / max(H + T, 1e-9)))
        for o, col in (("senate", "op5_senate"), ("governor", "op5_governor")):
            p = g[f"{col}_party"]; D, R = w[p == "D"].sum(), w[p == "R"].sum()
            row[f"{o}_2p_margin"] = float(100 * (D - R) / max(D + R, 1e-9)); row[f"{o}_swing_vs_recall"] = row[f"{o}_2p_margin"] - row["recall_2p_margin"]
            tv, hv = (r24 == "Trump"), (r24 == "Harris")
            row[f"{o}_trump_voters_to_D"] = float(100 * w[tv & (p == "D")].sum() / max(w[tv].sum(), 1e-9))
            row[f"{o}_harris_voters_to_R"] = float(100 * w[hv & (p == "R")].sum() / max(w[hv].sum(), 1e-9))
        row["directional_only"] = row["n"] < 50
        grp.append(row)
GRP = pd.DataFrame(grp)

def coefs(f_, names):
    se = np.sqrt(np.diag(f_["V"])[:f_["k"]])
    return [dict(term=n_, coef=round(float(b_), 4), se=round(float(s_), 4)) for n_, b_, s_ in zip(names, f_["b"], se)]
out = dict(model="recall group defection model, version 2", n={t: int(len(res[t]["L"])) for t in res},
           coefficients={t: {g: coefs(res[t]["fits"][g], INAMES + CNAMES) for g in GROUPS} for t in res},
           intercepts={t: {g: {k: round(float(v), 4) for k, v in res[t]["fits"][g]["u"].items()} for g in GROUPS} for t in res},
           decomposition={t: res[t]["dec"] for t in res}, in_sample={t: res[t]["in_sample"] for t in res},
           environment=env, observed=obs, pres24=pres, nonvoter_share_by_age=dict(zip(AGE, nv_all.round(4).tolist())))
json.dump(out, open(f"{OUT}/mrp7_fit.json", "w"), indent=1, default=float)
LO.to_csv(f"{OUT}/loso.csv", index=False); STATE.to_csv(f"{OUT}/state_priors.csv", index=False)
DIST.to_csv(f"{OUT}/district_priors.csv", index=False); COUNTY.to_csv(f"{OUT}/county_priors.csv", index=False); GRP.to_csv(f"{OUT}/group_swings.csv", index=False)
print(json.dumps(env, indent=1, default=float))
print(json.dumps({t: {g: dict(tau_cand=round(res[t]["dec"][g]["tau_cand"], 3), tau_state=round(res[t]["dec"][g]["tau_state"], 3), mu=round(res[t]["dec"][g]["mu"], 3)) for g in GROUPS} for t in res}, indent=1))
pd.set_option("display.width", 220)
print(LO.round(1).to_string())
print(LO.groupby("version")[[c for c in LO.columns if c.startswith("err_")]].apply(lambda d: d.abs().mean()).round(2))
print(json.dumps(res["leaned"]["in_sample"], indent=0, default=float))
