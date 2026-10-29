"""TPSI Electorate Mode: an estimate of the actual 2026 electorate in every state, used by the Senate and Governor
forecasts and by the Dynamic Mode voter simulation.

Every county's adults are split into 96 groups: 32 ACS cells of age, race and college, each divided into Democrats,
Republicans and independents. For each group the TPSI national respondent database gives

  * its party mix              party_id on age, race, college and region
  * its 2026 midterm turnout   validated recall of voting in 2022 or 2018, on the same cell plus party
  * its 2024 turnout           voted_2024, same terms, so the model knows how a presidential electorate differs
  * its vote                   generic ballot, two way, same terms, weighted by TPSI turnout propensity

Three pieces of 2026 evidence then shape each state's electorate:

  1. County turnout. The county's share of the statewide vote blends its 2022 midterm vote grown for population
     (60 percent), its 2026 primary turnout (20 percent) and the TPSI demographic midterm turnout of its adults
     (20 percent). Counties with no primary record fall back to their 2022 share. The statewide total is unchanged:
     the national midterm ratio times the state's own midterm history.
  2. Partisan enthusiasm. Each party's 2026 primary turnout in a state is the larger of its Senate and governor primary
     totals. The Democratic share of those two, against the state's 2024 presidential result and centered on the median
     state, moves Democratic and Republican turnout apart by a fifth of the gap in log odds, capped at 0.10. A state whose
     centered gap is beyond 0.8 log odds has a one sided or uncontested primary and gets no enthusiasm term.
  3. The midterm electorate. Each county's party mix is solved so its 2024 presidential electorate reproduces the
     certified 2024 result. The same county's 2026 midterm electorate is then built from the midterm turnout model plus
     the enthusiasm term, and the difference between the two electorates is carried into the census leg, which is
     anchored on 2024 presidential voters and would otherwise assume a presidential turnout electorate.

The voter simulation draws turnout and votes group by group from these 96 groups per county.
"""
import os, numpy as np, pandas as pd

PARTIES = ["D", "R", "I"]
K_ENTH, ENTH_CAP = 0.20, 0.10
W_HIST, W_PRIM, W_DEMO = 0.60, 0.20, 0.20
_FIT = {}

def fit(sm):
    if _FIT: return _FIT
    r = sm.RESP.dropna(subset=["age_band", "race4", "college", "region8", "party_id"]).copy()
    regions = sorted(r.region8.unique())
    X = np.vstack([sm.design(a, b, c, g, regions) for a, b, c, g in zip(r.age_band, r.race4, r.college, r.region8)])
    pdum = np.column_stack([(r.party_id == "Democrat").values, (r.party_id == "Republican").values]).astype(float)
    XP = np.hstack([X, pdum])
    isD = (r.party_id == "Democrat").values.astype(float)
    bD = sm.irls(X, isD, np.ones(len(r)))
    nd = ~(r.party_id == "Democrat").values
    bR = sm.irls(X[nd], (r.party_id[nd] == "Republican").values.astype(float), np.ones(nd.sum()))
    mid = ((r.voted_2022 == 1) | (r.voted_2018 == 1)).values.astype(float)
    bMid = sm.irls(XP, mid, np.ones(len(r)))
    bPres = sm.irls(XP, (r.voted_2024 == 1).values.astype(float), np.ones(len(r)))
    m = r.gb_2way.notna().values
    bVote = sm.irls(XP[m], (r.gb_2way[m] == "Democrat").values.astype(float), r.turnout_propensity.values[m])
    _FIT.update(regions=regions, bD=bD, bR=bR, bMid=bMid, bPres=bPres, bVote=bVote, n=len(r))
    return _FIT

def groups(sm, model, fl, reg):
    """Arrays [county, 32 cells, 3 parties]: adults, party share, midterm and presidential turnout log odds, vote log odds."""
    F = fit(sm)
    ageS, raceS, colR, adults = sm.county_cells(fl)
    C = len(fl); K = 32
    pop = np.zeros((C, K)); x = np.zeros((K, len(F["bD"])))
    k = 0
    for ai, a in enumerate(sm.AGE):
        for ri, rc in enumerate(sm.RACE):
            for ci, c in enumerate(sm.COL):
                pc = colR[:, ri] if c == "COLLEGE" else 1 - colR[:, ri]
                pop[:, k] = adults * ageS[:, ai] * raceS[:, ri] * pc
                x[k] = sm.design(a, rc, c, reg, F["regions"])
                k += 1
    pD = sm.inv(x @ F["bD"]); pR = (1 - pD) * sm.inv(x @ F["bR"]); pI = 1 - pD - pR
    share = np.stack([pD, pR, pI], axis=1)                                  # [K, 3]
    dums = np.array([[1, 0], [0, 1], [0, 0]], float)
    lin = lambda b: np.stack([x @ b[:-2] + dums[j] @ b[-2:] for j in range(3)], axis=1)   # [K, 3]
    return dict(pop=np.maximum(pop, 0), share=share, lmid=lin(F["bMid"]), lpres=lin(F["bPres"]), lvote=lin(F["bVote"]))

def composed(G, a, turn_logit, extra_turn=0.0, enth=0.0, vshift=None):
    """County party mix moved by a (Democrats up, Republicans down in log odds), then the electorate's two party D share."""
    sh = G["share"][None] * np.exp(np.array([1.0, -1.0, 0.0])[None, None, :] * a[:, None, None])
    sh = sh / sh.sum(2, keepdims=True)
    ent = np.array([enth, -enth, 0.0])[None, None, :]
    ex = np.asarray(extra_turn, float).reshape(-1, 1, 1) if np.ndim(extra_turn) else extra_turn
    t = sm_inv(turn_logit[None] + ent + ex)
    v = sm_inv(G["lvote"][None] + (0.25 * a[:, None, None] if vshift is None else vshift))
    w = G["pop"][:, :, None] * sh * t
    return (w * v).sum((1, 2)) / np.maximum(w.sum((1, 2)), 1e-9), w, sh, t, v

def sm_inv(z):
    return 1 / (1 + np.exp(-z))

def solve(fn, target, n, lo=-6.0, hi=6.0, it=50):
    lo = np.full(n, lo); hi = np.full(n, hi)
    for _ in range(it):
        mid = (lo + hi) / 2; up = fn(mid) < target
        lo = np.where(up, mid, lo); hi = np.where(up, hi, mid)
    return (lo + hi) / 2

def enthusiasm(prim, actual24_state):
    pD, pR = float(np.nansum(prim.pD)), float(np.nansum(prim.pR))
    if pD <= 0 or pR <= 0 or not np.isfinite(pD + pR):
        return 0.0, None
    ps = pD / (pD + pR)
    gap = np.log(ps / (1 - ps)) - np.log(actual24_state / (1 - actual24_state))
    return float(np.clip(K_ENTH * gap, -ENTH_CAP, ENTH_CAP)), float(100 * ps)

STATE_ENTH = {}      # two letter state -> dict(enth, dem_share, gap, used), from state_enthusiasm()
CURRENT = {"st": None}
HISTORY_INFO = {}
OUTLIER_GAP = 0.8    # a centered gap beyond this many log odds is a one sided or uncontested primary, not enthusiasm

ENTH_REAL_ONLY = os.environ.get("ENTH_REAL_ONLY") == "1"
def _proxied_sides(note):
    """Which party sides of a primary note are not 2026 primary ballots."""
    n = str(note or "").lower(); out = set()
    if "both sides proxied" in n or "2022 governor county vote used for the party term" in n and "republican county vote" not in n:
        return {"D", "R"}
    if "anti republican side" in n: out.add("D"); n = n.replace("anti republican side", "")
    if "republican side" in n or "2022 governor republican county vote" in n: out.add("R")
    if "democratic side" in n: out.add("D")
    if "unopposed" in n:
        if "hobbs unopposed" in n: out.add("D")
    if "no democratic primary contest" in n: out.add("D")
    return out

def state_enthusiasm(sm, keys):
    """Party primary turnout per state is the larger of its Senate and governor primary totals for that party, since a
    voter who took a party ballot shows up in whichever contest drew the most votes. The gap against the 2024 result is
    centered on the median state, because the national environment already enters through Gallup and the polls, and a
    state whose centered gap is extreme is read as a one sided primary and given no enthusiasm term."""
    by = {}
    for k in keys:
        st2 = k[:2]
        try:
            prim, _note = sm.primaries(k)
        except Exception:
            continue
        fl = sm.county_list(k); prim = prim.reindex(fl)
        d = by.setdefault(st2, dict(pD=0.0, pR=0.0, fl=fl, k=k))
        # Oct 29 2026, at the user's request (ENTH_REAL_ONLY=1): only this year's primary ballots count. A side whose
        # primary is proxied by an older general election vote (2020 or 2022 county votes), or an unopposed side with no
        # 2026 ballots, says nothing about the 2026 electorate, so it is left out; a state without a real 2026 count on both
        # sides gets no primary term and its 2026 electorate comes from the early vote correction instead.
        _px = _proxied_sides(_note) if ENTH_REAL_ONLY else set()
        if "D" not in _px: d["pD"] = max(d["pD"], float(np.nansum(prim.pD)))
        if "R" not in _px: d["pR"] = max(d["pR"], float(np.nansum(prim.pR)))
        d.setdefault("notes", []).append(str(_note)[:160])
    gaps = {}
    for st2, d in by.items():
        P16, P20, P24 = sm.pres_frames(d["k"]); p = P24.reindex(d["fl"])
        s24 = float(p.votes_dem.sum() / (p.votes_dem.sum() + p.votes_gop.sum()))
        if d["pD"] <= 0 or d["pR"] <= 0: continue
        ps = d["pD"] / (d["pD"] + d["pR"])
        gaps[st2] = (np.log(ps / (1 - ps)) - np.log(s24 / (1 - s24)), ps)
    center = float(np.median([g for g, _ in gaps.values()])) if gaps else 0.0
    for st2, (g, ps) in gaps.items():
        c = g - center
        used = abs(c) <= OUTLIER_GAP
        STATE_ENTH[st2] = dict(enth=float(np.clip(K_ENTH * c, -ENTH_CAP, ENTH_CAP)) if used else 0.0,
                               dem_share=float(100 * ps), gap=float(g), centered=float(c), used=bool(used), center=center)
    for st2 in [x for x in os.environ.get("ENTH_OFF", "").split(",") if x]:
        if st2 in STATE_ENTH: STATE_ENTH[st2]["enth"] = 0.0
    # Oct 26 2026, by the user's choice (EV_ELECTORATE=path): the early vote enters the forecast here, as the party
    # electorate, instead of through ev_adjust.py after the run. The file gives each state's partisan turnout term solved
    # from its final party electorate (civicAPI early vote, the On Point Polling party modeler and party identification
    # from the On Point Polling database, /tmp/fcrun/fm/ev_electorate.py); it adds to the primary term, capped at EV_ENTH_CAP.
    _evp = os.environ.get("EV_ELECTORATE")
    if _evp:
        import json as _json
        _cap = float(os.environ.get("EV_ENTH_CAP", "0.30"))
        for st2, x in _json.load(open(_evp)).items():
            d = STATE_ENTH.setdefault(st2, dict(enth=0.0, dem_share=None, gap=None, centered=None, used=False, center=None))
            d["enth_primary"] = d["enth"]; d["enth_ev"] = float(x["enth_ev"]); d["ev_party_gap_pts"] = x.get("party_gap_pts")
            d["enth"] = float(np.clip(d["enth"] + d["enth_ev"], -_cap, _cap))
    return STATE_ENTH

def midterm_shift(sm, model, fl, reg, actual24, turnout24, prim):
    """Log odds difference between the county's 2026 midterm electorate and its 2024 presidential electorate."""
    G = groups(sm, model, fl, reg)
    C = len(fl)
    a24 = np.asarray(actual24, float).clip(0.01, 0.99)
    st24 = float((a24 * np.asarray(turnout24, float)).sum() / np.asarray(turnout24, float).sum())
    if CURRENT["st"] and CURRENT["st"][:2] in STATE_ENTH:
        _e = STATE_ENTH[CURRENT["st"][:2]]; enth, prim_share = _e["enth"], _e["dem_share"]
    elif STATE_ENTH:
        enth, prim_share = 0.0, None
    else:
        enth, prim_share = enthusiasm(prim, st24)
    if os.environ.get("HISTORY"):
        import history as _hi
        delta, w26, info = _hi.build(sm, model, CURRENT["st"], fl, reg, a24, turnout24, prim, enth)
        HISTORY_INFO[CURRENT["st"]] = info
        return delta, w26, enth, prim_share, G, None
    a = solve(lambda z: composed(G, z, G["lpres"])[0], a24, C)
    e24 = composed(G, a, G["lpres"])[0]
    e26 = composed(G, a, G["lmid"], enth=enth)[0]
    lg = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))
    delta = lg(e26) - lg(e24)
    w = composed(G, a, G["lmid"], enth=enth)[1].sum((1, 2))       # expected 2026 voters per county, before calibration
    return pd.Series(delta, index=fl), pd.Series(w, index=fl), enth, prim_share, G, a
