"""TPSI Vote History Mode: individual vote history, a 2026 turnout model that is not anchored to a turnout ratio, and
the groups the voter simulation draws from.

Every county's adults are split into 384 groups: 32 ACS cells of age, race and college, times Democrats, Republicans
and independents, times four vote histories:

    both        voted in the 2022 midterm and the 2024 presidential election
    2022 only   voted in 2022, skipped 2024
    2024 only   voted in 2024, skipped 2022
    neither     no vote in either, which includes new adults and people who never vote

1. Simulated vote history. TPSI respondents' validated recall gives, for every cell and party, the chance of having
   voted in 2022 and the chance of having voted in 2024 given the 2022 vote. Two constants per county move those
   chances until the county's history reproduces its certified 2022 midterm turnout and its certified 2024 presidential
   turnout exactly. Survey recall overstates voting; the calibration removes that, so each county's history is real.

2. How history becomes a midterm vote. From TPSI, the chance of voting in a midterm given the last midterm and the last
   presidential vote, fit on the 2022 vote given 2018 and 2020 history. That same transition is applied to 2026 with
   2022 and 2024 history. One national constant corrects survey recall, and it is set by a backtest: 2020 era history
   is built for every state from certified 2018 and 2020 turnout, the transition predicts 2022, and the constant is the
   one that makes the predicted national 2022 midterm vote match the certified one. No 2026 turnout total is imposed.

3. What is specific to 2026:
     * TPSI 2026 intent. The share of each party's respondents who say they are certain to vote, against the other
       parties, controlling for cell and history, moves each party's turnout by half of that gap in log odds.
     * Primary enthusiasm. The Electorate Mode state term from the 2026 Senate and governor primaries moves Democratic
       and Republican turnout apart.
     * County primary turnout. A county whose share of the state's 2026 primary vote runs ahead of its share of the
       2022 general vote turns out more, 0.15 times the log of that ratio, centered on the state.
     * Competition. The closest statewide 2026 race in the state raises turnout by up to 0.10 in log odds, centered on
       the median state.
     * The population. Adults are the 2024 ACS counts, so growth, aging and new adults without a vote history all move
       the electorate.
"""
import os, json, numpy as np, pandas as pd

H_NAMES = ["both", "2022 only", "2024 only", "neither"]
HM = np.array([1.0, 1.0, 0.0, 0.0])      # voted in the last midterm
HP = np.array([1.0, 0.0, 1.0, 0.0])      # voted in the last presidential election
LV_K, LV_ANCHOR_PCT = 12.0, 60.0
LAM_INTENT, K_PRIM_CTY, PRIM_CLIP, K_COMP, COMP_SCALE = 0.5, 0.15, 0.7, 0.10, 10.0
_FIT = {}
KAPPA = {"k": None, "backtest": {}}
NO_RACE_2022 = {"DE", "MS", "MT", "NJ", "VA", "WV"}   # no Senate or governor race on the 2022 ballot
LAST = {}
COMP = {}
# Demographic turnout calibration. Survey recall and stated intent overstate voting most among the young and among
# nonwhite adults, so a single county constant leaves the electorate too young and too diverse. The 2022 backtest sets one
# log odds offset for each age band, each race group and college, for the history transition and for the DSMeridian
# likely voter composition, so the predicted 2022 electorate matches the national 2022 electorate measured on the voter
# file by Catalist, What Happened 2022, House national: ages 18 to 29 10, 30 to 44 20, 45 to 64 36, 65 and over 33;
# the transition's turnout levels are left as backtested and only the likely voter composition carries the offsets;
# White 76, Black 10, Latino 8, Asian and other 6; white college graduates 32 and white non college 44.
DEMO_TARGET = dict(age=[10.0, 20.0, 36.0, 33.0], race=[76.0, 10.0, 8.0, 6.0], white_college=32.0 / 76.0)
DEMO_CAL = {"T": None, "LV": None}
LAM_CELL = None      # Voter File Mode: per cell scale of the county party mix shift, set by build
LV_MODE = os.environ.get("LV_MODE", "1") == "1"
VOTERFILE = os.environ.get("VOTERFILE", "1") == "1"
# State turnout blend, Oct 2 2026. The 2022 backtest above gets the national total right but misses individual states
# by up to a quarter. A second estimate comes from each state's own record: its 2024 vote, times the national 2026 to
# 2024 ratio this model projects, times how the state's midterm turnout has run against its presidential turnout,
# relative to the nation, in 2018 and 2022 (2018 alone where 2022 had no Senate or governor race). Tested the same way
# on 2022, with 2018 as the record, blending the two in logs cut the typical state miss from 12 to 9 percent; the best
# blend weight, turnout_hist.json "phi", is used here. The national level is unchanged by construction.
TURN_HIST = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "turnout_hist.json"))) if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "turnout_hist.json")) else None
STATE_TURN_ON = os.environ.get("CALIB26", "1") != "0" and TURN_HIST is not None
STATE_TURN_AUDIT = {}

def _state_turn_factor(st, model_total):
    if not STATE_TURN_ON: return 1.0
    rec = TURN_HIST["states"].get(st[:2])
    if not rec or not model_total or model_total <= 0: return 1.0
    return float((rec["hist26"] / model_total) ** TURN_HIST["phi"])

def _turn_offset(pop4, T, factor):
    """One log odds offset on every voter type's turnout so the state total moves by factor."""
    tgt = factor * float((pop4 * inv(T)).sum()); lo, hi = -2.0, 2.0
    for _ in range(50):
        m = (lo + hi) / 2
        lo, hi = (m, hi) if float((pop4 * inv(T + m)).sum()) < tgt else (lo, m)
    return (lo + hi) / 2

# turnout weighted national mean composition shift across the 45 Senate and governor states, measured in a likely voter pre pass
COMP_CENTER = float(os.environ.get("HIST_COMP_CENTER", "0.0620"))

inv = lambda z: 1 / (1 + np.exp(-z))
lg = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))

def _hx(m, p):
    return np.column_stack([m, p, m * p])

def fit(sm):
    if _FIT: return _FIT
    r = sm.RESP.dropna(subset=["age_band", "race4", "college", "region8", "party_id", "voted_2018", "voted_2020", "voted_2022", "voted_2024"]).copy()
    regions = sorted(r.region8.unique())
    X = np.vstack([sm.design(a, b, c, g, regions) for a, b, c, g in zip(r.age_band, r.race4, r.college, r.region8)])
    pdum = np.column_stack([(r.party_id == "Democrat").values, (r.party_id == "Republican").values]).astype(float)
    XP = np.hstack([X, pdum]); one = np.ones(len(r))
    v18, v20, v22, v24 = (r[f"voted_{y}"].values.astype(float) for y in (2018, 2020, 2022, 2024))
    F = dict(regions=regions, n=len(r))
    # history structure as of 2024 and, for the backtest, as of 2020
    F["bM"] = sm.irls(XP, v22, one); F["bP"] = sm.irls(np.hstack([XP, v22[:, None]]), v24, one)
    F["bM0"] = sm.irls(XP, v18, one); F["bP0"] = sm.irls(np.hstack([XP, v18[:, None]]), v20, one)
    # midterm vote given the last midterm and last presidential vote, fit on 2022 given 2018 and 2020
    F["bT"] = sm.irls(np.hstack([XP, _hx(v18, v20)]), v22, one)
    # 2026 intent: certain to vote, on cell, party and 2022/2024 history
    XH = np.hstack([XP, _hx(v22, v24)])
    cert = (r.turnout_intent == "Certain / highly motivated").values.astype(float)
    bI = sm.irls(XH, cert, one)
    pD_, pR_ = bI[X.shape[1]], bI[X.shape[1] + 1]
    wD, wR = pdum[:, 0].mean(), pdum[:, 1].mean(); wI = 1 - wD - wR
    mean_ = wD * pD_ + wR * pR_
    F["intent_party"] = LAM_INTENT * np.array([pD_ - mean_, pR_ - mean_, 0.0 - mean_])
    F["intent_raw"] = dict(D=float(pD_), R=float(pR_), certain_share={k: float(v) for k, v in r.groupby("party_id").turnout_intent.apply(lambda s: (s == "Certain / highly motivated").mean()).items()})
    # vote by cell, party and history, weighted by TPSI turnout propensity
    m = r.gb_2way.notna().values
    F["bV"] = sm.irls(XH[m], (r.gb_2way[m] == "Democrat").values.astype(float), r.turnout_propensity.values[m])
    # DSMeridian Model 13R3 Stage 3, PSI Pythagorean v8.1: A is the product of the intent, method and social scores,
    # B half the history scalar, PT their Pythagorean sum, and P = logistic(12 (PT - mu)) with mu = 1 minus the p60 of
    # PT. The respondent file carries each wave's own mu; one pooled p60 anchor is used here so the relative propensity
    # of a cell does not depend on which panel happened to field it.
    PT = r.turnout_PT.values.astype(float)
    mu = 1.0 - float(np.percentile(PT, LV_ANCHOR_PCT, method="hazen"))
    P_lv = 1.0 / (1.0 + np.exp(-LV_K * (PT - mu)))
    F["bLV"] = sm.irls(XH, P_lv, one); F["lv_mu"] = mu; F["lv_mean"] = float(P_lv.mean())
    F["nx"] = X.shape[1]
    _FIT.update(F)
    return _FIT

def cells(sm, fl, reg):
    """[C, 32] adults and [32, nx] design rows."""
    F = fit(sm)
    ageS, raceS, colR, adults = sm.county_cells(fl)
    C, K = len(fl), 32
    pop = np.zeros((C, K)); x = np.zeros((K, F["nx"])); meta = []
    k = 0
    for ai, a in enumerate(sm.AGE):
        for ri, rc in enumerate(sm.RACE):
            for ci, c in enumerate(sm.COL):
                pc = colR[:, ri] if c == "COLLEGE" else 1 - colR[:, ri]
                pop[:, k] = adults * ageS[:, ai] * raceS[:, ri] * pc
                x[k] = sm.design(a, rc, c, reg, F["regions"]); meta.append((ai, ri, ci)); k += 1
    return np.maximum(pop, 0), x, meta

def logits(sm, x):
    """Per cell and party [32, 3] logits, and per cell, party and history [32, 3, 4]."""
    F = fit(sm); nx = F["nx"]
    dums = np.array([[1, 0], [0, 1], [0, 0]], float)
    lin = lambda b, extra=None: np.stack([x @ b[:nx] + dums[j] @ b[nx:nx + 2] for j in range(3)], axis=1)
    L = {}
    L["M"] = lin(F["bM"]); L["P1"] = lin(F["bP"]) + F["bP"][-1]; L["P0"] = lin(F["bP"])
    L["M0"] = lin(F["bM0"]); L["P01"] = lin(F["bP0"]) + F["bP0"][-1]; L["P00"] = lin(F["bP0"])
    hx = _hx(HM, HP)                                                   # [4, 3]
    L["T"] = lin(F["bT"])[:, :, None] + (hx @ F["bT"][-3:])[None, None, :]
    L["V"] = lin(F["bV"])[:, :, None] + (hx @ F["bV"][-3:])[None, None, :]
    L["LVT"] = lin(F["bLV"])[:, :, None] + (hx @ F["bLV"][-3:])[None, None, :]
    if DEMO_CAL.get("T") is not None and x.shape[0] == 32:
        L["T"] = L["T"] + DEMO_CAL["T"][:, None, None]; L["LVT"] = L["LVT"] + DEMO_CAL["LV"][:, None, None]
    return L

def party_mix(share, a, lam=None):
    if lam is None: lam = LAM_CELL if LAM_CELL is not None else np.ones(share.shape[0])
    sh = share[None] * np.exp(np.array([1.0, -1.0, 0.0])[None, None, :] * a[:, None, None] * lam[None, :, None])
    return sh / sh.sum(2, keepdims=True)

def solve(fn, target, n, lo=-8.0, hi=8.0, it=55):
    lo = np.full(n, float(lo)); hi = np.full(n, float(hi))
    for _ in range(it):
        mid = (lo + hi) / 2; up = fn(mid) < target
        lo = np.where(up, mid, lo); hi = np.where(up, hi, mid)
    return (lo + hi) / 2

def hist_shares(lM, lP1, lP0, cM, cP):
    """[C, 32, 3, 4] conditional shares of the four histories given cell and party."""
    pm = inv(lM[None] + cM[:, None, None]); p1 = inv(lP1[None] + cP[:, None, None]); p0 = inv(lP0[None] + cP[:, None, None])
    return np.stack([pm * p1, pm * (1 - p1), (1 - pm) * p0, (1 - pm) * (1 - p0)], axis=3)

def calibrate(popc, sh, lM, lP1, lP0, mid_target, pres_target, mid_state=False):
    """County constants so the history reproduces certified midterm and presidential turnout."""
    C = popc.shape[0]; w = popc[:, :, None] * sh
    cap = 0.92 * popc.sum(1)
    mt = np.minimum(np.asarray(mid_target, float), cap); pt = np.minimum(np.asarray(pres_target, float), cap)
    if mid_state:
        tot = float(mt.sum())
        c = solve(lambda z: np.array([(w * inv(lM[None] + z[0])).sum()]), np.array([tot]), 1)[0]
        cM = np.full(C, c)
    else:
        cM = solve(lambda z: (w * inv(lM[None] + z[:, None, None])).sum((1, 2)), mt, C)
    pm = inv(lM[None] + cM[:, None, None])
    cP = solve(lambda z: (w * (pm * inv(lP1[None] + z[:, None, None]) + (1 - pm) * inv(lP0[None] + z[:, None, None]))).sum((1, 2)), pt, C)
    return cM, cP

def _clean(s, fl):
    return pd.Series(s).reindex(fl).astype(float).fillna(0.0).values

def backtest_kappa(sm, model, keys):
    """Build 2020 era history in every state, predict the 2022 midterm with the transition, and set the one national
    constant that makes the predicted 2022 vote equal the certified one. Per state errors are kept as the backtest."""
    import electorate as ev
    global LAM_CELL
    if VOTERFILE:
        import voters as vf
        LAM_CELL = vf.cell_lambda(sm)
    DEMO_CAL.update(T=None, LV=None)
    rows = {}; done = set()
    for k in keys:
        st2 = k[:2]
        if st2 in done: continue
        try:
            fl = sm.county_list(k); m22, t18 = sm.midterm_totals(k); P16, P20, P24 = sm.pres_frames(k)
        except Exception as e:
            continue
        reg = model["state_region"][sm.STATES[k].get("base", k[:2])]
        popc, x, _ = cells(sm, fl, reg); L = logits(sm, x)
        share = ev.groups(sm, model, fl, reg)["share"]
        p20 = P20.reindex(fl); a20 = (p20.votes_dem / (p20.votes_dem + p20.votes_gop)).clip(0.01, 0.99).fillna(0.5).values
        # party mix from the 2020 result, with 2020 voters weighted by the presidential history chance
        a = solve(lambda z: ((popc[:, :, None] * party_mix(share, z)) * inv(L["V"][None, :, :, 0])).sum((1, 2)) /
                  np.maximum((popc[:, :, None] * party_mix(share, z)).sum((1, 2)), 1e-9), a20, len(fl))
        sh = party_mix(share, a)
        cM, cP = calibrate(popc, sh, L["M0"], L["P01"], L["P00"], np.full(len(fl), t18 / len(fl)), _clean(p20.total_votes, fl), mid_state=True)
        H = hist_shares(L["M0"], L["P01"], L["P00"], cM, cP)
        w4 = popc[:, :, None, None] * sh[..., None] * H
        m22v = _clean(m22, fl)
        rows[st2] = dict(w4=w4, T=L["T"], LVT=L["LVT"], actual=float(m22v.sum()))
        done.add(st2)
    # 2022 had no Senate or governor race in six states; that depressed turnout is estimated alongside the constant
    race = {s_: r for s_, r in rows.items() if s_ not in NO_RACE_2022}; none = {s_: r for s_, r in rows.items() if s_ in NO_RACE_2022}
    def fit1(group, off=0.0):
        tot = sum(r["actual"] for r in group.values())
        f = lambda kap: sum(float((r["w4"] * inv(r["T"][None] + kap)).sum()) for r in group.values())
        lo, hi = -4.0, 4.0
        for _ in range(50):
            mid = (lo + hi) / 2
            if f(mid) < tot: lo = mid
            else: hi = mid
        return (lo + hi) / 2
    kap = fit1(race)
    beta = fit1(none) - kap if none else 0.0
    if os.environ.get("DEMO_CAL", "1") == "1":
        fit_demo(rows, kap, beta)
        kap = fit1(race, 0.0) if DEMO_CAL["T"] is None else _fit1_off(race, DEMO_CAL["T"])
        beta = (_fit1_off(none, DEMO_CAL["T"]) - kap) if none else 0.0
    bt = {}
    for s_, r in rows.items():
        k_ = kap + (beta if s_ in NO_RACE_2022 else 0.0)
        _off = DEMO_CAL["T"][None, :, None, None] if DEMO_CAL.get("T") is not None else 0.0
        bt[s_] = dict(predicted=float((r["w4"] * inv(r["T"][None] + _off + k_)).sum()), actual=r["actual"], no_race_2022=s_ in NO_RACE_2022)
        bt[s_]["error_pct"] = 100 * (bt[s_]["predicted"] / bt[s_]["actual"] - 1)
    KAPPA.update(k=float(kap), no_race_2022=float(beta), backtest=bt, states=len(bt),
                 demographic_calibration={k2: v2 for k2, v2 in DEMO_CAL.items() if k2 not in ("T", "LV")},
                 national_predicted=float(sum(v["predicted"] for v in bt.values())), national_actual=float(sum(v["actual"] for v in bt.values())),
                 mean_abs_state_error_pct=float(np.mean([abs(v["error_pct"]) for v in bt.values()])),
                 median_abs_state_error_pct=float(np.median([abs(v["error_pct"]) for v in bt.values()])))
    return KAPPA

def _cell_idx():
    k = np.arange(32); return k // 8, (k // 2) % 4, k % 2

def _offsets(th):
    ai, ri, ci = _cell_idx()
    da = np.r_[th[0:2], 0.0, th[2]]          # 45 to 64 is the base
    dr = np.r_[0.0, th[3:6]]                 # White is the base
    dc = np.r_[0.0, th[6]]
    return da[ai] + dr[ri] + dc[ci]

def _fit1_off(group, off):
    tot = sum(r["actual"] for r in group.values())
    f = lambda kap: sum(float((r["w4"] * inv(r["T"][None] + off[None, :, None, None] + kap)).sum()) for r in group.values())
    lo, hi_ = -4.0, 4.0
    for _ in range(50):
        mid = (lo + hi_) / 2
        if f(mid) < tot: lo = mid
        else: hi_ = mid
    return (lo + hi_) / 2

def _composition(W):
    """W [32] voters by cell: age shares, race shares, white college share."""
    ai, ri, ci = _cell_idx(); t = W.sum()
    age = np.array([W[ai == a].sum() for a in range(4)]) / t * 100
    race = np.array([W[ri == r].sum() for r in range(4)]) / t * 100
    wc = W[(ri == 0) & (ci == 1)].sum() / W[ri == 0].sum()
    return age, race, wc

def fit_demo(rows, kap, beta):
    """Fit the transition and the likely voter offsets to the national 2022 electorate."""
    from scipy.optimize import least_squares
    tgt = DEMO_TARGET
    def resid(W):
        age, race, wc = _composition(W)
        return np.r_[age[[0, 1, 3]] - np.array(tgt["age"])[[0, 1, 3]] * 100 / sum(tgt["age"]),
                     race[1:] - np.array(tgt["race"])[1:] * 100 / sum(tgt["race"]), 100 * (wc - tgt["white_college"])]
    def W_T(th):
        off = _offsets(th); W = np.zeros(32)
        for s_, r in rows.items():
            k_ = kap + (beta if s_ in NO_RACE_2022 else 0.0)
            W += (r["w4"] * inv(r["T"][None] + off[None, :, None, None] + k_)).sum((0, 2, 3))
        return W
    # the transition keeps its backtested state and county turnout levels; only who makes up that turnout is calibrated,
    # through the likely voter composition, with each state's predicted 2022 total held fixed
    class _Z: x = np.zeros(7)
    fT = _Z()
    # likely voter composition: the DSMeridian score plus one constant per state that keeps the state's predicted 2022 total
    def W_LV(th):
        off = _offsets(th); W = np.zeros(32)
        for s_, r in rows.items():
            base = r["LVT"][None] + off[None, :, None, None]
            k_ = kap + (beta if s_ in NO_RACE_2022 else 0.0)
            tot = float((r["w4"] * inv(r["T"][None] + _offsets(fT.x)[None, :, None, None] + k_)).sum())
            lo, hi_ = -8.0, 8.0
            for _ in range(40):
                mid = (lo + hi_) / 2
                if float((r["w4"] * inv(base + mid)).sum()) < tot: lo = mid
                else: hi_ = mid
            W += (r["w4"] * inv(base + (lo + hi_) / 2)).sum((0, 2, 3))
        return W
    fL = least_squares(lambda th: resid(W_LV(th)), np.zeros(7), method="lm")
    before_T = _composition(W_T(np.zeros(7))); before_LV = _composition(W_LV(np.zeros(7)))
    after_T = _composition(W_T(fT.x)); after_LV = _composition(W_LV(fL.x))
    DEMO_CAL.update(T=_offsets(fT.x), LV=_offsets(fL.x), theta_T=fT.x.tolist(), theta_LV=fL.x.tolist(),
                    report={nm: dict(age=[round(float(v), 1) for v in c[0]], race=[round(float(v), 1) for v in c[1]], white_college=round(float(c[2]), 3))
                            for nm, c in [("transition_before", before_T), ("transition_after", after_T), ("likely_voter_before", before_LV), ("likely_voter_after", after_LV)]},
                    target=DEMO_TARGET)
    return DEMO_CAL

def set_competition(margins):
    """margins: two letter state -> closest statewide 2026 margin in points, from the previous run."""
    vals = {s: float(np.exp(-abs(m) / COMP_SCALE)) for s, m in margins.items()}
    med = float(np.median(list(vals.values()))) if vals else 0.0
    COMP.clear(); COMP.update({s: dict(margin=float(margins[s]), term=K_COMP * (v - med)) for s, v in vals.items()})

def build(sm, model, st, fl, reg, actual24, turnout24, prim, enth):
    """The 2026 electorate for one race, and the arrays the voter simulation draws from."""
    import electorate as ev
    F = fit(sm)
    if KAPPA["k"] is None:
        raise RuntimeError("run backtest_kappa first")
    C = len(fl)
    popc, x, meta = cells(sm, fl, reg); L = logits(sm, x)
    share = ev.groups(sm, model, fl, reg)["share"]
    m22, _ = sm.midterm_totals(st)
    m22v = _clean(m22, fl); t24 = np.asarray(turnout24, float); a24 = np.asarray(actual24, float).clip(0.01, 0.99)
    # party mix and history calibrated together: 2024 voters reproduce the certified result
    a = np.zeros(C); cM = np.zeros(C); cP = np.zeros(C)
    global LAM_CELL
    if VOTERFILE:
        import voters as vf
        rH, rT = vf.recall_fractions(sm, reg)
        LAM_CELL = vf.cell_lambda(sm)
    for _ in range(4):
        sh = party_mix(share, a)
        cM, cP = calibrate(popc, sh, L["M"], L["P1"], L["P0"], m22v, t24)
        H = hist_shares(L["M"], L["P1"], L["P0"], cM, cP)
        if VOTERFILE:
            # Voter File Mode: the simulated voters' own recalled 2024 votes reproduce the certified result
            def share24(z):
                s_ = party_mix(share, z); w = popc[:, :, None, None] * s_[..., None] * H * HP[None, None, None, :]
                return (w * rH[None]).sum((1, 2, 3)) / np.maximum((w * (rH + rT)[None]).sum((1, 2, 3)), 1e-9)
        else:
            def share24(z):
                s_ = party_mix(share, z); w = popc[:, :, None, None] * s_[..., None] * H * HP[None, None, None, :]
                v = inv(L["V"][None] + 0.25 * z[:, None, None, None])
                return (w * v).sum((1, 2, 3)) / np.maximum(w.sum((1, 2, 3)), 1e-9)
        a = solve(share24, a24, C, -6, 6, 45)
    sh = party_mix(share, a); H = hist_shares(L["M"], L["P1"], L["P0"], cM, cP)
    pop4 = popc[:, :, None, None] * sh[..., None] * H
    # 2026 turnout
    lt = L["T"][None] + KAPPA["k"]
    lt = lt + F["intent_party"][None, None, :, None]
    lt = lt + np.array([enth, -enth, 0.0])[None, None, :, None]
    pt = (prim.pD.fillna(0) + prim.pR.fillna(0)).astype(float).reindex(fl).fillna(0).values if prim is not None else np.zeros(C)
    if pt.sum() > 0 and m22v.sum() > 0:
        rel = np.where((pt > 0) & (m22v > 0), np.log(np.maximum(pt / pt.sum(), 1e-9) / np.maximum(m22v / m22v.sum(), 1e-9)), 0.0).clip(-PRIM_CLIP, PRIM_CLIP)
        rel = rel - np.average(rel, weights=np.maximum(m22v, 1))
        prim_term = K_PRIM_CTY * rel
    else:
        prim_term = np.zeros(C)
    comp = COMP.get(st[:2], {}).get("term", 0.0)
    if st[:2] in NO_RACE_2022:
        # the 2022 skip in these states was partly the empty ballot: give back half of the estimated 2022 penalty to the
        # voters whose history is 2024 only or neither
        lt = lt + (-0.5 * KAPPA.get("no_race_2022", 0.0)) * (1 - HM)[None, None, None, :]
    lt = lt + prim_term[:, None, None, None] + comp
    lt = np.broadcast_to(lt, pop4.shape).copy()
    lv_info = {}
    if LV_MODE:
        # The level of 2026 turnout in every county comes from the history transition and the 2026 signals above.
        # Who makes up that turnout comes from the DSMeridian likely voter model: each group's PSI Pythagorean
        # propensity, plus the party enthusiasm from the primaries, with one county constant so the county total is
        # unchanged. Party intent is already inside the likely voter score, so it is not added a second time.
        V_level = (pop4 * inv(lt)).sum((1, 2, 3))
        base_lv = np.broadcast_to(L["LVT"][None] + np.array([enth, -enth, 0.0])[None, None, :, None], pop4.shape)
        c_lv = solve(lambda z: (pop4 * inv(base_lv + z[:, None, None, None])).sum((1, 2, 3)), V_level, C, -8, 8, 55)
        lt_old = lt
        lt = (base_lv + c_lv[:, None, None, None]).copy()
        lv_info = dict(lv_mu=F["lv_mu"], lv_anchor_pct=LV_ANCHOR_PCT, lv_k=LV_K,
                       lv_party_turnout={j: float((pop4[:, :, i] * inv(lt[:, :, i])).sum() / pop4[:, :, i].sum()) for i, j in enumerate("DRI")},
                       transition_party_turnout={j: float((pop4[:, :, i] * inv(lt_old[:, :, i])).sum() / pop4[:, :, i].sum()) for i, j in enumerate("DRI")})
    lv = np.broadcast_to(L["V"][None] + 0.25 * a[:, None, None, None], pop4.shape).copy()
    LVc = L["V"]; cand_cty = np.zeros(C)
    import candidate as cq
    if VOTERFILE:
        cv = ct = gv = gt = None
        if os.environ.get("CANDIDATE") and st in cq.PROFILES:
            cv, ct = cq.group_shifts(cq.PROFILES[st])
            gv, gt = cq.geo_shifts(cq.PROFILES[st], fl)
        F0 = vf.build_file(sm, st, fl, reg, pop4, lt)
        e0_26, _ = vf.electorate_pref(F0, HP)
        F = vf.build_file(sm, st, fl, reg, pop4, lt, cv, ct, gv, gt) if cv is not None else F0
        e26, e24 = vf.electorate_pref(F, HP)
        cand_cty = lg(e26) - lg(e0_26)
        Tg, Vg, REC = vf.collapse(F, C)
        V26 = (F["w"] * F["t"]).sum((1, 2))
        w26 = pop4 * inv(Tg)
        _fac = _state_turn_factor(st, float(V26.sum()))
        if _fac != 1.0:
            _dl = _turn_offset(pop4, Tg, _fac); _old = w26.sum((1, 2, 3))
            Tg = Tg + _dl; w26 = pop4 * inv(Tg); V26 = V26 * w26.sum((1, 2, 3)) / np.maximum(_old, 1e-9)
            REC["lt"] = REC["lt"] + _dl
            STATE_TURN_AUDIT[st] = dict(factor=round(_fac, 4), offset_logit=round(float(_dl), 4), history_total=round(TURN_HIST["states"][st[:2]]["hist26"]), blend_weight=TURN_HIST["phi"])
        hist_el = (w26.sum((0, 1, 2)) / w26.sum()).tolist(); hist_ad = (pop4.sum((0, 1, 2)) / pop4.sum()).tolist()
        dem_rep_turn = [float(w26[:, :, j].sum() / pop4[:, :, j].sum()) for j in range(3)]
        wt_ = F["w"] * F["t"]; pa_ = (wt_ * (1 - F["pn"]) * F["pa"]).sum() / (wt_ * (1 - F["pn"])).sum()
        vf_info = dict(voter_records_per_county=int((F["w"] > 0).sum((1, 2)).mean()), voter_file_d2_no_candidates=float(np.average(e0_26, weights=V26)),
                       voter_file_d2=float(np.average(e26, weights=V26)), electorate_trump_approval_two_way=float(pa_),
                       adult_trump_approval_target=float(np.average(F["approval_target"], weights=V26)))
        info = dict(turnout=float(V26.sum()), turnout_2022=float(m22v.sum()), turnout_2024=float(t24.sum()), adults=float(popc.sum()),
                    turnout_of_adults=float(V26.sum() / popc.sum()), vs_2022_pct=float(100 * (V26.sum() / max(m22v.sum(), 1) - 1)),
                    electorate_history=dict(zip(H_NAMES, hist_el)), adult_history=dict(zip(H_NAMES, hist_ad)),
                    party_turnout=dict(zip(["D", "R", "I"], dem_rep_turn)), competition_term=float(comp),
                    primary_term_range=[float(prim_term.min()), float(prim_term.max())], kappa=KAPPA["k"],
                    intent_party=dict(zip(["D", "R", "I"], map(float, fit(sm)["intent_party"]))), enthusiasm=float(enth),
                    composition_shift_logit=float(np.average(lg(e26) - lg(e24), weights=np.maximum(V26, 1))),
                    candidate_county_shift=cand_cty, candidate_statewide_demo_shift=float(np.average(cand_cty, weights=np.maximum(V26, 1))),
                    voter_file=vf_info, state_turnout_term=STATE_TURN_AUDIT.get(st), **lv_info)
        LAST[st] = dict(fl=list(fl), popc=popc, share=share, H=H, a=a, lt=Tg, LV=L["V"], VP=Vg, REC=REC, F=F, e0_26=e0_26, meta=meta, V26=V26, info=info)
        return pd.Series(lg(e26) - lg(e24) - COMP_CENTER, index=fl), pd.Series(V26, index=fl), info
    if os.environ.get("CANDIDATE") and st in cq.PROFILES:
        # candidate demographic strength: that party's voters in each cell hold or defect, and turn out or stay home
        w0 = pop4 * inv(lt); e0 = (w0 * inv(lv)).sum((1, 2, 3)) / np.maximum(w0.sum((1, 2, 3)), 1e-9)
        cv, ct = cq.group_shifts(cq.PROFILES[st])
        LVc = L["V"] + cv[:, :, None]
        lv = lv + cv[None, :, :, None]; lt = lt + ct[None, :, :, None]
        w1 = pop4 * inv(lt); e1 = (w1 * inv(lv)).sum((1, 2, 3)) / np.maximum(w1.sum((1, 2, 3)), 1e-9)
        cand_cty = lg(e1) - lg(e0)
    w26 = pop4 * inv(lt)
    e26 = (w26 * inv(lv)).sum((1, 2, 3)) / np.maximum(w26.sum((1, 2, 3)), 1e-9)
    w24 = pop4 * HP[None, None, None, :]
    e24 = (w24 * inv(lv)).sum((1, 2, 3)) / np.maximum(w24.sum((1, 2, 3)), 1e-9)
    _fac = _state_turn_factor(st, float(w26.sum()))
    if _fac != 1.0:
        _dl = _turn_offset(pop4, lt, _fac); lt = lt + _dl; w26 = pop4 * inv(lt)
        STATE_TURN_AUDIT[st] = dict(factor=round(_fac, 4), offset_logit=round(float(_dl), 4), history_total=round(TURN_HIST["states"][st[:2]]["hist26"]), blend_weight=TURN_HIST["phi"])
    V26 = w26.sum((1, 2, 3))
    hist_el = (w26.sum((0, 1, 2)) / w26.sum()).tolist()
    hist_ad = (pop4.sum((0, 1, 2)) / pop4.sum()).tolist()
    dem_rep_turn = [float(w26[:, :, j].sum() / pop4[:, :, j].sum()) for j in range(3)]
    info = dict(turnout=float(V26.sum()), turnout_2022=float(m22v.sum()), turnout_2024=float(t24.sum()), adults=float(popc.sum()),
                turnout_of_adults=float(V26.sum() / popc.sum()), vs_2022_pct=float(100 * (V26.sum() / max(m22v.sum(), 1) - 1)),
                electorate_history=dict(zip(H_NAMES, hist_el)), adult_history=dict(zip(H_NAMES, hist_ad)),
                party_turnout=dict(zip(["D", "R", "I"], dem_rep_turn)), competition_term=float(comp),
                primary_term_range=[float(prim_term.min()), float(prim_term.max())], kappa=KAPPA["k"],
                intent_party=dict(zip(["D", "R", "I"], map(float, F["intent_party"]))), enthusiasm=float(enth),
                composition_shift_logit=float(np.average(lg(e26) - lg(e24), weights=np.maximum(V26, 1))),
                candidate_county_shift=cand_cty, candidate_statewide_demo_shift=float(np.average(cand_cty, weights=np.maximum(V26, 1))), state_turnout_term=STATE_TURN_AUDIT.get(st), **lv_info)
    LAST[st] = dict(fl=list(fl), popc=popc, share=share, H=H, a=a, lt=lt, LV=LVc, meta=meta, V26=V26, info=info)
    # the national anchor is a likely voter vote, so it already describes the 2026 electorate: only the part of the
    # composition shift that differs from the national average is carried, which moves states and counties against
    # each other without moving the national level a second time
    return pd.Series(lg(e26) - lg(e24) - COMP_CENTER, index=fl), pd.Series(V26, index=fl), info

# demographic groups for the shared national shocks, on the 32 cells
DEMO = [("age 18 to 29", lambda ai, ri, ci: ai == 0), ("age 65 and over", lambda ai, ri, ci: ai == 3),
        ("Black", lambda ai, ri, ci: ri == 1), ("Hispanic", lambda ai, ri, ci: ri == 2), ("Asian and other", lambda ai, ri, ci: ri == 3),
        ("white without a degree", lambda ai, ri, ci: ri == 0 and ci == 0), ("white with a degree", lambda ai, ri, ci: ri == 0 and ci == 1)]

def demo_matrix(meta):
    M = np.zeros((32, len(DEMO)))
    for k, (ai, ri, ci) in enumerate(meta):
        for g, (_, f) in enumerate(DEMO):
            M[k, g] = 1.0 * f(ai, ri, ci)
    return M
