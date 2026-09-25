"""TPSI Dynamic House Mode: the House on the same method as Dynamic Senate Mode and Dynamic Governor Mode.

Everything House Mode already did stays: the district spine on the lines in force, the incumbent and redrawn terms,
measured ticket splitting, district primary participation, district polls, FEC money, top two one party generals and
unopposed seats. On top of it, each state now runs the Senate machinery:

  M1       TPSI county by county Trump approval alone, calibrated and converted with the TPSI respondent crosstab
  M2       the certified 2024 county result moved by the TPSI demographic swing, then carried from the 2024 presidential
           electorate to the 2026 electorate built by Vote History Mode
  M3       the 2024 level moved by the national swing to the generic ballot
  turnout  Vote History Mode: every county's 2026 turnout is the sum of its 384 groups' own turnout chances, and each
           district's share of the state follows the 2026 turnout rate the state's counties show at its partisan lean
  elastic  each county's elasticity from the national demographic fit and its own presidential swings; a district takes
           the turnout weighted elasticity of the counties that look like it, updated with its own 2020 to 2024 swing
  quality  party unity from each nominee's share of their own party's 2026 primary vote, and candidate strength where a
           district poll sits away from the model's own fundamentals
  voters   every district's electorate is rebuilt from 384 groups, drawn from the counties that look like it, and the
           election is run 2,000 times with the same national environment, demographic and irregular voter shocks as the
           Senate and governor runs, so the House, Senate and governor results move together in every run
"""
import os, sys, json, re
os.environ.setdefault("APPROVAL_SRC", "tpsi"); os.environ.setdefault("DYNAMIC", "1"); os.environ.setdefault("ELECTORATE", "1")
os.environ.setdefault("HISTORY", "1"); os.environ.setdefault("SPINE", "pvi_real"); os.environ.setdefault("N_SIMS", "2000")
HERE = os.path.dirname(os.path.abspath(__file__)); BASE = os.path.dirname(HERE)
sys.path.insert(0, BASE); os.chdir(HERE)
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
import dynamic_mode as dm
sm, ev, hi, el = dm.sm, dm.ev, dm.hi, dm.el
logit, inv = sm.logit, sm.inv

# District poll weight, Sept 24 2026. This was a flat 0.5 on every district with a poll, whatever
# the poll's age or the district's coverage, while the statewide side ran an adaptive ramp. The
# POLLS table stores one pre blended figure per district and no poll count, so the house count ramp
# cannot be applied here; what can be applied is the proximity curve, so the weight now moves with
# days to election. The table's entries are themselves recency and sample weighted averages of
# several surveys, so the midpoint of the day's band is the right read rather than its floor.
W_POLL_DIST = float(os.environ.get("W_POLL_DIST", 0.5 * (sm.M3_LO + sm.M3_HI)))
# Third party share by ballot label, Sept 24 2026. This was one flat 0.015 for every district with
# any third candidate. No district level prior third party share exists in the inputs, so the label
# is the only signal available; these are judgement values, not fitted, and THIRD_OVERRIDE still wins.
THIRD_BY_PARTY = {"L": 0.018, "G": 0.011, "I": 0.022, "NPA": 0.022, "IP": 0.018,
                  "C": 0.010, "SWP": 0.006, "WP": 0.008, "FWD": 0.012, "AP": 0.008}
THIRD_DEFAULT = 0.015
OUT = os.environ.get("OUT_HOUSE_DYN", "/tmp/pvi/house_dyn"); os.makedirs(OUT, exist_ok=True)

# House Mode tables and terms, without its run calls
_src = open(f"{HERE}/house_mode.py").read()
_body = _src.split('\nrun("FL", FL')[0]
H = {"__name__": "house_mode_tables", "__file__": f"{HERE}/house_mode.py"}
exec(compile(_body, "house_mode.py", "exec"), H)
model, shift, nat_swing = H["model"], H["shift"], H["nat_swing"]
RUNS = re.findall(r'^run\("([A-Z]+)", ([A-Z]+), "([a-z_]+)", "([A-Za-z ]+)"\)', _src, re.M)

N = dm.N; NAT = dm.NAT; BATCH = 100; SEED = dm.SEED
SIG_STATE_H, SIG_DIST, SIG_TURN_ST, SIG_TURN_DIST = 0.07, 0.05, 0.06, 0.04
K_UNITY, UNITY_CAP, UNOPPOSED_SHARE = 0.025, 0.05, 0.75
KERNEL = 0.25          # log odds width of the county analog kernel
OWN_SWING_W = 0.25     # weight of a district's own 2020 to 2024 swing in its elasticity
NOMS = json.load(open("/tmp/pvi/house_nominee_shares.json"))
_contested = [x[s]["share"] for x in NOMS.values() for s in "DR" if x.get(s) and x[s]["share"] < 0.999]
UNITY_REF = float(np.median(_contested))
PVI_ROWS = {}
for _ln in open("/tmp/pvi/pvi.csv").read().strip().split("\n")[1:]:
    _f = _ln.split(","); PVI_ROWS[(_f[1], int(_f[2]))] = dict(m24=float(_f[3]), m20=float(_f[4]), imputed20=int(_f[5]))
NO_STATEWIDE_2026 = {"WA", "MO", "IN", "UT", "ND"}   # no Senate or governor race on the 2026 ballot

def unity(side):
    if side is None: return 0.0, "none", None
    s = side["share"]
    if s >= 0.999: return float(logit(UNOPPOSED_SHARE) - logit(UNITY_REF)), "unopposed", s
    return float(logit(min(max(s, 0.05), 0.95)) - logit(UNITY_REF)), "contested", s

def solve(fn, target, n, lo=-8.0, hi=8.0, it=55):
    lo = np.full(n, float(lo)); hi_ = np.full(n, float(hi))
    for _ in range(it):
        mid = (lo + hi_) / 2; up = fn(mid) < target
        lo = np.where(up, mid, lo); hi_ = np.where(up, hi_, mid)
    return (lo + hi_) / 2

def state_setup(st):
    fl = sm.county_list(st); F16, F20, F24 = sm.pres_frames(st)
    P24 = F24.reindex(fl); P20 = F20.reindex(fl)
    a24 = (P24.votes_dem / (P24.votes_dem + P24.votes_gop)).clip(0.01, 0.99).fillna(0.5).values
    reg = model["state_region"][st[:2]]
    try:
        prim, _ = sm.primaries(st); prim = prim.reindex(fl)
    except Exception:
        prim = None
    enth = ev.STATE_ENTH.get(st[:2], {}).get("enth", 0.0)
    ev.CURRENT["st"] = st
    delta, V26, info = hi.build(sm, model, st, fl, reg, a24, P24.total_votes.fillna(0).values, prim, enth)
    L = hi.LAST[st]
    if st[:2] in NO_STATEWIDE_2026:
        # nothing statewide on the 2026 ballot: the penalty the 2022 backtest measured for an empty ballot applies
        L["lt"] = L["lt"] + hi.KAPPA.get("no_race_2022", 0.0)
        pop4 = L["popc"][:, :, None, None] * hi.party_mix(L["share"], L["a"])[..., None] * L["H"]
        V26 = pd.Series((pop4 * inv(L["lt"])).sum((1, 2, 3)), index=fl)
        info["turnout"] = float(V26.sum()); info["no_statewide_race"] = True
    comps = sm.census_components(model, fl, lambda f: reg)
    e, e0, own, used = el.county_elasticity(sm, st, {}, fl, model, shift, comps, {}, [], F16, F20, F24, V26.values, a24)
    return dict(fl=fl, P24=P24, P20=P20, a24=a24, reg=reg, comps=comps, delta=delta.values, V26=V26.values, info=info,
                L=L, e=e.values)

def run(st, table, slug, name):
    S = state_setup(st)
    fl, V26, a24 = S["fl"], S["V26"], S["a24"]
    df = pd.DataFrame(table, columns=H["COLS"])
    df["d2_24"] = 0.5 - df.margin24 / 200.0
    df["d2_pvi"] = [H["PVI_SPINE"][(st[:2], int(d))][0] for d in df.district]
    df["pvi_imputed"] = [H["PVI_SPINE"][(st[:2], int(d))][1] for d in df.district]
    df["d2_spine"] = np.where(df.pvi_imputed.values == 1, df.d2_24.values, df.d2_pvi.values)
    unc = H["UNCONTESTED"][st]; same = H["SAMEPARTY"].get(st, {})
    INC_PTS, REDRAWN_PTS, CROSSOVER_PTS = H["INC_PTS"], H["REDRAWN_PTS"], H["CROSSOVER_PTS"]
    def cand_points(r):
        if r.district in unc or r.district in same: return 0.0
        if r.inc == "D*": return CROSSOVER_PTS
        if r.inc == "R*": return -CROSSOVER_PTS
        if r.inc == "D": return CROSSOVER_PTS if r.margin24 > 0 else INC_PTS
        if r.inc == "R": return -(CROSSOVER_PTS if r.margin24 < 0 else INC_PTS)
        return 0.0
    df["cand_pts"] = df.apply(cand_points, axis=1)
    Dn = len(df)
    state_d2_24 = float(S["P24"].votes_dem.sum() / (S["P24"].votes_dem + S["P24"].votes_gop).sum())

    # the three legs, weighted by each county's 2026 turnout
    r_ = sm.RESP
    ct = pd.crosstab(r_.trump_approve_2way, r_.generic_ballot, values=r_.turnout_propensity, aggfunc="sum", normalize="index")
    app, dis, noop, cal = sm.calibrated_approval(fl)
    Dv = dis * ct.loc["Disapprove", "Democrat"] + app * ct.loc["Approve", "Democrat"] + noop * ct.loc["Neutral", "Democrat"]
    Rv = dis * ct.loc["Disapprove", "Republican"] + app * ct.loc["Approve", "Republican"] + noop * ct.loc["Neutral", "Republican"]
    w = V26
    import anchors as _an0; an_vf_on = _an0.vf_on
    M1 = float((inv(np.asarray(sm.m1_county(fl, Dv, Rv), float)) * w).sum() / w.sum())
    # Voter File Mode's approval leg already moves with a unit slope on the county's 2024 lean (1.02 across every
    # county), so the old slope correction for the crosstab conversion is only applied when that mode is off
    if not an_vf_on():
        M1 = M1 + (1.0 - 0.659) * (state_d2_24 - 0.4925)
    g26, turn_idx, adults = sm.census_predict(model, fl, lambda f: S["reg"], shift[0], S["comps"])
    g24, _, _ = sm.census_predict(model, fl, lambda f: S["reg"], shift[1], S["comps"], use24=True)
    import anchors as an
    _mean, _k2 = an.m2_params(sm, model, shift); ec = an.county_e(sm, model, shift, fl)
    m2c = inv(logit(a24) + (logit(g26) - logit(g24)) - _mean + ec * _k2 + S["delta"])
    M2 = float((m2c * w).sum() / w.sum())
    M3 = float((inv(logit(a24) + ec * an.m3_constant(sm, model, shift)) * w).sum() / w.sum())
    LEVEL = sm.W_FUND * M1 + sm.W_CENSUS * M2 + sm.W_HIST * M3

    # district turnout: the state's 2026 total, split by the 2026 turnout rate its counties show at each lean
    ad = np.maximum(adults, 1.0); rate = np.clip(V26 / ad, 0.02, 0.95)
    Xr = np.column_stack([np.ones(len(fl)), logit(a24)]); Wr = ad
    br = np.linalg.solve(Xr.T @ (Xr * Wr[:, None]) + 1e-6 * np.eye(2), Xr.T @ (Wr * logit(rate)))
    drate = inv(br[0] + br[1] * logit(df.d2_24.values))
    tshare = drate / drate.sum()
    state_votes = float(V26.sum())

    # district elasticity: county analogs by lean, then the district's own presidential swing
    ld = logit(df.d2_24.values); lc = logit(a24)
    Kw = V26[None, :] * np.exp(-((lc[None, :] - ld[:, None]) ** 2) / (2 * KERNEL ** 2)) + 1e-12
    Kw = Kw / Kw.sum(1, keepdims=True)
    e_an = Kw @ S["e"]
    s20 = float(S["P20"].votes_dem.sum() / (S["P20"].votes_dem + S["P20"].votes_gop).sum())
    ssw = logit(state_d2_24) - logit(s20)
    e_own = np.full(Dn, np.nan)
    for j, dnum in enumerate(df.district):
        pv = PVI_ROWS.get((st[:2], int(dnum)))
        if pv and pv["imputed20"] == 0 and abs(ssw) > 0.03:
            e_own[j] = (logit(0.5 - pv["m24"] / 200) - logit(0.5 - pv["m20"] / 200)) / ssw
    e_d = np.where(np.isfinite(e_own), (1 - OWN_SWING_W) * e_an + OWN_SWING_W * np.clip(e_own, 0.35, 2.0), e_an)
    e_d = np.clip(e_d, 0.35, 2.0)
    e_d = e_d / np.average(e_d, weights=tshare)
    df["elasticity"] = e_d

    df["prim_term"] = [H["PRIMARY_TERM"].get("%s-%02d" % (st[:2], int(d)), 0.0) for d in df.district]
    df["ticket_term"] = [H["TICKET_TERM"].get("%s-%02d" % (st[:2], int(d)), 0.0) for d in df.district]
    df.loc[df.ticket_term != 0.0, "cand_pts"] = 0.0
    base = logit(df.d2_spine.values) + df.cand_pts.values / 200.0 * 4.0 + H["K_PRIMARY_PARTY"] * df.prim_term.values + df.ticket_term.values

    # candidate quality: party unity behind each nominee
    uD, uR, kD, kR, sD, sR = [], [], [], [], [], []
    for d in df.district:
        rec = NOMS.get("%s-%02d" % (st[:2], int(d)), {})
        a_, b_, c_ = unity(rec.get("D")); uD.append(a_); kD.append(b_); sD.append(c_)
        a_, b_, c_ = unity(rec.get("R")); uR.append(a_); kR.append(b_); sR.append(c_)
    uD, uR = np.array(uD), np.array(uR)
    ush = np.clip(K_UNITY * (uD - uR), -UNITY_CAP, UNITY_CAP)
    ush = np.where([(d in unc or d in same) for d in df.district], 0.0, ush)
    df["dem_primary_kind"], df["rep_primary_kind"] = kD, kR
    df["dem_primary_share"], df["rep_primary_share"] = sD, sR
    df["unity_shift"] = ush

    def level_shift(target, extra):
        lo, hi_ = -3.0, 3.0
        for _ in range(80):
            mid = (lo + hi_) / 2
            v = float((inv(base + e_d * mid + extra) * tshare).sum())
            lo, hi_ = (mid, hi_) if v < target else (lo, mid)
        return (lo + hi_) / 2
    fin = np.zeros(Dn)
    for j, r in enumerate(df.itertuples()):
        key = "%s-%02d" % (st[:2], int(r.district))
        sh_, why_ = sm.finance_term(key, 0, float(r.d2_24), book=H["HOUSE_FINANCE"], k=H["K_FINANCE_HOUSE"], max_polls=999)
        fin[j] = sh_ * (sm.W_FUND + sm.W_CENSUS)
    df["finance_term"] = fin
    cand = ush * (sm.W_FUND + sm.W_CENSUS)
    x0 = level_shift(LEVEL, 0.0)
    df["model_d2"] = inv(base + e_d * x0 + fin + cand)

    # district polls, and candidate strength where a poll sits away from the fundamentals
    df["poll_d2"] = np.nan
    for i, r in df.iterrows():
        p = H["POLLS"][st].get(r.district)
        if p: df.loc[i, "poll_d2"] = p["d"] / (p["d"] + p["r"])
    df["poll_gap"] = np.where(df.poll_d2.notna(), logit(df.poll_d2.fillna(0.5).values) - logit(df.model_d2.values), np.nan)
    df["final_d2"] = np.where(df.poll_d2.notna(), (1 - W_POLL_DIST) * df.model_d2 + W_POLL_DIST * df.poll_d2.fillna(0), df.model_d2)
    df["third_share"] = np.where(df.third.astype(bool),
                                 [THIRD_BY_PARTY.get(str(tp), THIRD_DEFAULT) for tp in df.third_party.fillna("")], 0.0)
    for dnum, share in H["THIRD_OVERRIDE"].get(st, {}).items():
        df.loc[df.index[df.district == dnum][0], "third_share"] = share
    df["projected_votes"] = (state_votes * tshare).round(0)
    df["fixed"] = [same.get(d, "") for d in df.district]
    return dict(st=st, slug=slug, name=name, S=S, df=df, base=base, e_d=e_d, tshare=tshare, fin=fin, cand=cand, unc=unc,
                same=same, LEVEL=LEVEL, M=(M1, M2, M3), state_votes=state_votes, level_shift=level_shift, Kw=Kw)

def poll_strength_all(runs):
    # The centre is the mean district poll gap across the states in this invocation, so a subset
    # run centres on itself and silently deletes its own deviation. POLL_GAP_CENTER pins it to the
    # value a full run produced, which is what makes a single state re-run comparable to the board.
    gaps = [g for R in runs for g in R["df"].poll_gap.dropna().values]
    center = float(os.environ["POLL_GAP_CENTER"]) if os.environ.get("POLL_GAP_CENTER") else (float(np.mean(gaps)) if gaps else 0.0)
    for R in runs:
        df = R["df"]
        ps = np.where(df.poll_gap.notna(), np.clip(0.5 * 1 / (1 + 4) * (df.poll_gap.fillna(0).values - center), -0.12, 0.12), 0.0)
        df["poll_strength"] = ps
        m = df.poll_d2.notna().values
        df.loc[m, "model_d2"] = inv(logit(df.model_d2.values[m]) + ps[m] * (sm.W_FUND + sm.W_CENSUS))
        df["final_d2"] = np.where(m, (1 - W_POLL_DIST) * df.model_d2 + W_POLL_DIST * df.poll_d2.fillna(0), df.model_d2)
    return center

def district_groups(R):
    """[D, 384] adults per group, turnout log odds and vote log odds for every district, from its county analogs."""
    L = R["S"]["L"]; Kw = R["Kw"]
    pop4 = L["popc"][:, :, None, None] * hi.party_mix(L["share"], L["a"])[..., None] * L["H"]      # [C,32,3,4]
    tp = inv(L["lt"]); vp = inv(L["VP"]) if "VP" in L else inv(L["LV"][None] + 0.25 * L["a"][:, None, None, None])
    C = pop4.shape[0]
    P = pop4.reshape(C, -1)
    W = Kw @ (P / np.maximum(P.sum(1, keepdims=True), 1e-9))                   # per adult composition [D, 384]
    T = Kw @ (P * tp.reshape(C, -1)) / np.maximum(Kw @ P, 1e-12)
    V = Kw @ (P * vp.reshape(C, -1)) / np.maximum(Kw @ P, 1e-12)
    return W, logit(np.clip(T, 1e-5, 1 - 1e-5)), logit(np.clip(V, 1e-5, 1 - 1e-5)), L["meta"]

def simulate(R):
    df = R["df"]; Dn = len(df)
    rng = np.random.default_rng(SEED + sum(map(ord, R["st"])) * 104729)
    Wc, LT, LV, meta = district_groups(R)
    Tt = df.projected_votes.values.astype(float)
    q = np.clip(df.final_d2.values, 1e-4, 1 - 1e-4)
    third = df.third_share.values
    psg = np.tile(np.repeat(np.array([1.0, -1.0, 0.0]), 4), 32)                 # party of each of the 384 groups
    def mix(a):
        # party mix moved by a inside each cell: Democrats up, Republicans down, cell totals kept
        f = np.exp(psg[None, :] * a[:, None])
        wv = Wc * f
        cell = wv.reshape(Dn, 32, 12).sum(2, keepdims=True); cell0 = Wc.reshape(Dn, 32, 12).sum(2, keepdims=True)
        return (wv.reshape(Dn, 32, 12) * cell0 / np.maximum(cell, 1e-12)).reshape(Dn, -1)
    a = np.zeros(Dn); b = np.zeros(Dn); scale = Tt / np.maximum((Wc * inv(LT)).sum(1), 1e-9)
    for _ in range(4):
        def share(z):
            w_ = mix(z) * scale[:, None] * inv(LT + b[:, None]); return (w_ * inv(LV + 0.25 * z[:, None])).sum(1) / np.maximum(w_.sum(1), 1e-9)
        a = solve(share, q, Dn, -8, 8)
        wa = mix(a) * scale[:, None]
        b = solve(lambda x: (wa * inv(LT + x[:, None])).sum(1), Tt, Dn, -4, 4)
    pops = mix(a) * scale[:, None]; lt = LT + b[:, None]; eta = LV + 0.25 * a[:, None]
    popi = np.round(pops).astype(np.int64)
    Wv = pops * inv(lt); chk = (Wv * inv(eta)).sum(1) / Wv.sum(1)
    Pp = inv(eta); hvar = (Wv * Pp * (1 - Pp)).sum(1) / Wv.sum(1) / np.maximum(chk * (1 - chk), 1e-9)
    hfac = 1.0 / np.clip(hvar, 0.05, 1.0)
    Mc = hi.demo_matrix(meta); demo_idx = np.repeat(Mc, 12, axis=0)
    irreg = np.tile(1 - hi.HM, 96)
    demo_v, demo_t = NAT["demo_vote"] @ demo_idx.T, NAT["demo_turn"] @ demo_idx.T
    e = R["e_d"]
    divs = np.maximum(0, -np.array([unity(NOMS.get("%s-%02d" % (R["st"][:2], int(d)), {}).get("D"))[0] for d in df.district])) + \
           np.maximum(0, -np.array([unity(NOMS.get("%s-%02d" % (R["st"][:2], int(d)), {}).get("R"))[0] for d in df.district]))
    sig_c = np.minimum(0.07, 0.02 + 0.03 * divs + np.where(df.poll_d2.isna().values, 0.02, 0.0))
    fixed = np.array([(d in R["unc"]) or (d in R["same"]) for d in df.district])

    def draw(rg, sl, B, pops_, lt_, eta_, expected=False):
        env = NAT["env"][sl] + rg.normal(0, SIG_STATE_H, B)
        shock = (e[None, :] * env[:, None] + rg.normal(0, 1, (B, Dn)) * (SIG_DIST + 0 * sig_c)[None, :] + rg.normal(0, 1, (B, Dn)) * sig_c[None, :]) * hfac[None, :]
        tsh = NAT["turn"][sl][:, None] + rg.normal(0, SIG_TURN_ST, B)[:, None] + rg.normal(0, SIG_TURN_DIST, (B, Dn))
        en = NAT["enth"][sl] + rg.normal(0, dm.SIG_ENTH_ST, B)
        gv = demo_v[sl][:, None, :] * hfac[None, :, None]
        gt = demo_t[sl][:, None, :] + (NAT["irreg"][sl] + rg.normal(0, dm.SIG_IRREG_ST, B))[:, None, None] * irreg[None, None, :]
        p = inv(eta_[None] + shock[:, :, None] + gv)
        tp = inv(lt_[None] + tsh[:, :, None] + gt + en[:, None, None] * psg[None, None, :])
        if expected:
            nn = pops_[None] * tp
            return nn, nn * p
        n = rg.binomial(popi[None], tp)
        th = rg.binomial(n, np.clip(third * np.exp(rg.normal(0, 0.15, (B, Dn))), 0, 0.9)[:, :, None]) if third.max() > 0 else np.zeros_like(n)
        dv = rg.binomial(n - th, p)
        return n, th, dv

    # pilot: re-center every district so the mean of the runs equals its projection
    prng = np.random.default_rng(SEED + 99); PN = min(300, N)
    for _ in range(3):
        ED = np.zeros(Dn); EN = np.zeros(Dn)
        for p0 in range(0, PN, BATCH):
            Bp = min(BATCH, PN - p0); nn, dd = draw(prng, slice(p0, p0 + Bp), Bp, pops, lt, eta, expected=True)
            ED += dd.sum((0, 2)); EN += nn.sum((0, 2))
        mD = ED / np.maximum(EN, 1e-9); mN = EN / PN
        eta = eta + (logit(q) - logit(np.clip(mD, 1e-6, 1 - 1e-6)))[:, None]
        lt = lt + np.log(Tt / np.maximum(mN, 1e-9))[:, None]
    acc = dict(N=np.zeros(Dn), D=np.zeros(Dn), R=np.zeros(Dn), TH=np.zeros(Dn))
    win = np.zeros((N, Dn), bool); marg = np.zeros((N, Dn), np.float32)
    for s0 in range(0, N, BATCH):
        B = min(BATCH, N - s0); sl = slice(s0, s0 + B)
        n, th, dv = draw(rng, sl, B, pops, lt, eta)
        Nc, THc, Dc = n.sum(2).astype(float), th.sum(2).astype(float), dv.sum(2).astype(float); Rc = Nc - THc - Dc
        acc["N"] += Nc.sum(0); acc["D"] += Dc.sum(0); acc["R"] += Rc.sum(0); acc["TH"] += THc.sum(0)
        win[sl] = Dc > Rc; marg[sl] = 100 * (Dc - Rc) / np.maximum(Nc, 1)
    for j, d in enumerate(df.district):
        if d in R["unc"]:
            win[:, j] = R["unc"][d] == "D"; marg[:, j] = 100 if R["unc"][d] == "D" else -100
        if d in R["same"]:
            win[:, j] = R["same"][d] == "D"; marg[:, j] = 100 if R["same"][d] == "D" else -100
    Nm = acc["N"] / N
    return dict(Nm=Nm, Dm=acc["D"] / N, Rm=acc["R"] / N, THm=acc["TH"] / N, win=win, marg=marg,
                pilot_err=dict(share=float(np.max(np.abs(mD - q))), turnout=float(np.max(np.abs(mN / Tt - 1)))),
                sig_c=sig_c, hfac=hfac)

def finish(R, Sm):
    df = R["df"]; st, slug, name = R["st"], R["slug"], R["name"]; unc, same = R["unc"], R["same"]
    two = 1 - df.third_share.values
    Nm = np.where(Sm["Nm"] > 0, Sm["Nm"], df.projected_votes.values)
    df["dem_pct"] = 100 * Sm["Dm"] / np.maximum(Nm, 1); df["rep_pct"] = 100 * Sm["Rm"] / np.maximum(Nm, 1); df["third_pct"] = 100 * Sm["THm"] / np.maximum(Nm, 1)
    df["deterministic_margin"] = 100 * (2 * df.final_d2.values - 1) * two
    for dnum, party in unc.items():
        i = df.index[df.district == dnum][0]
        df.loc[i, ["dem_pct", "rep_pct", "third_pct"]] = (100.0, 0.0, 0.0) if party == "D" else (0.0, 100.0, 0.0)
    df["margin"] = df.dem_pct - df.rep_pct
    for dnum, party in same.items():
        i = df.index[df.district == dnum][0]
        df.loc[i, ["dem_pct", "rep_pct", "third_pct", "margin"]] = np.nan
    df["projected_votes"] = Nm.round(0)
    for c in ["dem", "rep", "third"]:
        df[f"{c}_votes"] = (df.projected_votes * df[f"{c}_pct"] / 100).round(0)
    def rating(m):
        a = abs(m); return ("Tilt " if a < 2 else "Lean " if a < 6 else "Likely " if a < 12 else "Safe ") + ("D" if m > 0 else "R")
    df["rating"] = df.margin.map(lambda m: rating(m) if pd.notna(m) else "")
    df.loc[df.fixed != "", "rating"] = df.loc[df.fixed != "", "fixed"].map({"D": "D hold", "R": "R hold"})
    df["dem_win_prob"] = 100 * Sm["win"].mean(0)
    df["margin_p10"] = np.percentile(Sm["marg"], 10, axis=0); df["margin_p90"] = np.percentile(Sm["marg"], 90, axis=0)
    df["candidate_sigma"] = Sm["sig_c"]
    dseats = Sm["win"].sum(1)
    base, e_d, tshare, extra = R["base"], R["e_d"], R["tshare"], R["fin"] + R["cand"]
    ls = R["level_shift"]
    stw2 = 100 * (2 * R["LEVEL"] - 1); step = 2 if abs(stw2) < 8 else 5
    sens = []
    for env in [round(stw2 + step * k, 1) for k in (4, 3, 2, 1, 0, -1, -2, -3)]:
        m = 100 * (2 * inv(base + e_d * ls(0.5 + env / 200.0, 0.0) + extra) - 1)
        for dnum in unc: m[df.index[df.district == dnum][0]] = 100
        for dnum, party in same.items(): m[df.index[df.district == dnum][0]] = 100 if party == "D" else -100
        sens.append(dict(statewide_margin=env, dem_seats=int((m > 0).sum()), rep_seats=int((m < 0).sum())))
    grid = np.arange(min(-12.0, stw2 - 30), max(16.0, stw2 + 20) + 0.01, 0.25)
    curves = np.array([100 * (2 * inv(base + e_d * ls(0.5 + g / 200.0, 0.0) + extra) - 1) for g in grid])
    df["flip"] = [None if df.fixed.iloc[i] else (float(grid[np.argmax(curves[:, i] > 0)]) if (curves[:, i] > 0).any() else None) for i in range(len(df))]
    M1, M2, M3 = R["M"]
    summary = dict(state=name, abbr=st, districts=len(df), components=dict(M1=100 * M1, M2=100 * M2, M3=100 * M3, blend=100 * R["LEVEL"]),
                   state_2024_d2=None, spine=os.environ.get("SPINE"),
                   districts_with_primary_term=int((df.prim_term != 0).sum()), districts_with_ticket_term=int((df.ticket_term != 0).sum()),
                   statewide_house_margin=100 * (2 * R["LEVEL"] - 1),
                   contested_margin=float((df.margin.fillna(0) * tshare).sum() / max(tshare[df.margin.notna().values].sum(), 1e-9)),
                   state_votes=int(df.projected_votes.sum()), dem_votes=int(df.dem_votes.sum()), rep_votes=int(df.rep_votes.sum()),
                   dem_seats_point=int((df.margin > 0).sum() + sum(1 for p in same.values() if p == "D")),
                   rep_seats_point=int((df.margin < 0).sum() + sum(1 for p in same.values() if p == "R")),
                   same_party={str(k): v for k, v in same.items()},
                   simulation=dict(n=N, mean_dem_seats=float(dseats.mean()), median_dem_seats=float(np.median(dseats)),
                                   dist={int(k): int(v) for k, v in zip(*np.unique(dseats, return_counts=True))}, pilot_recentering_error=Sm["pilot_err"]),
                   sensitivity=sens, national_generic_d2=100 * sm.NAT_D2,
                   electorate={k: v for k, v in R["S"]["info"].items() if k != "candidate_county_shift"},
                   elasticity=dict(p10=float(np.percentile(e_d, 10)), median=float(np.median(e_d)), p90=float(np.percentile(e_d, 90))),
                   unity_reference_share=UNITY_REF)
    df.to_csv(f"{OUT}/{slug}_2026_house_district_forecast.csv", index=False)
    json.dump(summary, open(f"{OUT}/{slug}_house_run_summary.json", "w"), indent=1, default=float)
    np.save(f"{OUT}/win_{slug}.npy", Sm["win"])
    county_projection(R, df)
    print(f"{name:15s} {summary['dem_seats_point']:3d} D / {summary['rep_seats_point']:3d} R  sim mean D {dseats.mean():6.2f}  "
          f"votes {summary['state_votes']:>11,}  M {100*M1:.1f}/{100*M2:.1f}/{100*M3:.1f}  e {summary['elasticity']['median']:.2f}  "
          f"pilot {Sm['pilot_err']['share']:.4f}", flush=True)
    return summary

_ch = open(f"{HERE}/county_house.py").read()
_lab = {"sm": sm}
exec(_ch[_ch.index("SUFFIXED ="):_ch.index("def run(")], _lab)
label = _lab["label"]

def county_projection(R, df):
    """County layer of the state page: the three legs by county, levelled with county elasticity to the House vote the
    districts sum to, on the 2026 turnout from Vote History Mode."""
    S = R["S"]; fl = S["fl"]; a24 = S["a24"]; V26 = S["V26"]
    r_ = sm.RESP
    ct = pd.crosstab(r_.trump_approve_2way, r_.generic_ballot, values=r_.turnout_propensity, aggfunc="sum", normalize="index")
    app, dis, noop, cal = sm.calibrated_approval(fl)
    Dv = dis * ct.loc["Disapprove", "Democrat"] + app * ct.loc["Approve", "Democrat"] + noop * ct.loc["Neutral", "Democrat"]
    Rv = dis * ct.loc["Disapprove", "Republican"] + app * ct.loc["Approve", "Republican"] + noop * ct.loc["Neutral", "Republican"]
    m1 = inv(np.asarray(sm.m1_county(fl, Dv, Rv), float))
    g26, _, _ = sm.census_predict(model, fl, lambda f: S["reg"], shift[0], S["comps"])
    g24, _, _ = sm.census_predict(model, fl, lambda f: S["reg"], shift[1], S["comps"], use24=True)
    import anchors as an
    _mean, _k2 = an.m2_params(sm, model, shift); ec = an.county_e(sm, model, shift, fl)
    m2 = inv(logit(a24) + (logit(g26) - logit(g24)) - _mean + ec * _k2 + S["delta"])
    m3 = inv(logit(a24) + ec * an.m3_constant(sm, model, shift))
    d2 = sm.W_FUND * m1 + sm.W_CENSUS * m2 + sm.W_HIST * m3
    dv, rv = df.dem_votes.fillna(0).sum(), df.rep_votes.fillna(0).sum()
    fx = df.fixed.astype(str) != ""
    two = (1 - df.third_share.values)
    dv = dv + float((df.projected_votes[fx] * df.final_d2[fx] * two[fx]).sum()); rv = rv + float((df.projected_votes[fx] * (1 - df.final_d2[fx]) * two[fx]).sum())
    target = dv / max(dv + rv, 1)
    e = S["e"]; lo, hi_ = -3.0, 3.0
    for _ in range(70):
        mid = (lo + hi_) / 2
        v = float((inv(logit(d2) + e * mid) * V26).sum() / V26.sum())
        lo, hi_ = (mid, hi_) if v < target else (lo, mid)
    d2f = inv(logit(d2) + e * (lo + hi_) / 2)
    out = pd.DataFrame(dict(county_fips=fl, county=[label(R["st"], f) for f in fl], dem_pct=100 * d2f, rep_pct=100 * (1 - d2f),
                            dem_margin=100 * (2 * d2f - 1), projected_turnout=np.round(V26), dem_votes=np.round(V26 * d2f),
                            rep_votes=np.round(V26 * (1 - d2f)), m1_fundamental_d2=100 * m1, m2_census_d2=100 * m2, m3_history_d2=100 * m3,
                            pres_2024_d2=100 * a24, elasticity=e)).sort_values("dem_margin", ascending=False)
    out.to_csv(f"{OUT}/{R['slug']}_2026_house_county_projection.csv", index=False)

def main():
    allk = sorted(json.load(open(f"{BASE}/output/run_summary.json"))["results"])
    ev.state_enthusiasm(sm, allk)
    hi.backtest_kappa(sm, model, allk)
    prev = json.load(open(os.environ.get("COMP_FROM", "/tmp/pvi/pre_history/output/run_summary.json")))["results"]
    mm = {}
    for k, v in prev.items():
        x = abs(v.get("rcv_final_margin", v.get("margin", 99))); mm[k[:2]] = min(mm.get(k[:2], 99), x)
    hi.set_competition(mm)
    el.fit_prior(sm, model, shift)
    only = sys.argv[1:]
    todo = [r for r in RUNS if not only or r[0] in only]
    runs = []
    for st, tab, slug, name in todo:
        runs.append(run(st, H[tab], slug, name))
    center = poll_strength_all(runs)
    print("district poll gap center", round(center, 4), "unity reference", round(UNITY_REF, 3), flush=True)
    sums = {}
    for R in runs:
        sums[R["slug"]] = finish(R, simulate(R))
    wins = [np.load(f"{OUT}/win_{R['slug']}.npy") for R in runs]
    seats = sum(w.sum(1) for w in wins)
    nat = dict(n=N, mean=float(seats.mean()), median=float(np.median(seats)), p10=float(np.percentile(seats, 10)), p90=float(np.percentile(seats, 90)),
               d_majority=float((seats >= 218).mean() * 100), districts=int(sum(w.shape[1] for w in wins)),
               poll_gap_center=center, unity_reference_share=UNITY_REF, kappa=hi.KAPPA.get("k"))
    json.dump(nat, open(f"{OUT}/national_summary.json", "w"), indent=1, default=float)
    np.save(f"{OUT}/national_dem_seats.npy", seats)
    print("NATIONAL", nat)

if __name__ == "__main__":
    main()
