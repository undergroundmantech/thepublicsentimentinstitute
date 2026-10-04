"""Realistic ceilings and floors, Sept 30 2026.

Three limits, each read from data rather than set by hand, and each applied softly: inside the range nothing
changes, and past it the value bends toward the limit and can pass it by at most TAU in log odds.

1. County support. A county's relative lean, its two party Democratic log odds minus the state's, is stable from
   cycle to cycle. Its ceiling and floor for 2026 are the most and least Democratic it has run relative to its state
   in every past result the model holds for the county: the 2016, 2020 and 2024 presidential results and the past
   races for this office. Room is added for its trend and for a 2026 primary that ran strong or weak there. When a
   county's projection passes its limit it tops out, and the statewide level, which the polls set, is restored by
   moving every county, so the votes a capped county cannot give come from counties that still have room.

2. Group support. How far a place can move a group from its national baseline is read from TPSI: the spread of
   each race by party group's generic ballot across the eight regions, shrunk toward the nation, plus a margin.
   Black Democrats vary little from region to region, white independents a great deal. In the voter simulation each
   voter type's county and simulation offsets are held inside its group's band, so a group that is already near its
   ceiling tops out and the rest of the county has to move instead.

3. Turnout. A county's 2026 turnout sits between 0.70 of its certified 2022 midterm turnout and the lesser of 1.35
   times 2022, 1.02 times its 2024 presidential turnout and 0.88 of its citizen voting age population. A state with no
   Senate or governor race on its 2022 ballot had a depressed 2022, so its midterm ceiling is 1.6 times 2022. Every voter
   type's turnout chance in the simulation stays between 2 and 97 percent.
"""
import os
import numpy as np, pandas as pd

ON = os.environ.get("BOUNDS", "1") != "0"
TAU = 0.12                  # log odds a value may pass its limit
# Oct 3 2026: the room past a county's own envelope is no longer set by hand. bounds_calib.json measures it on certified
# 2022 Senate and governor results: the narrowest room that held 95 percent of the 2022 vote inside each county's
# 2016 and 2020 presidential and 2018 same office envelope, with K_TREND of the county's trend added toward its side.
# The hand set values were DELTA 0.15 and K_TREND 0.5; the measured ones top out sooner.
_CAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bounds_calib.json")
if os.path.exists(_CAL) and os.environ.get("BOUNDS_CALIB", "1") != "0":
    import json as _json
    _c = _json.load(open(_CAL)); DELTA, K_TREND = float(_c["DELTA"]), float(_c["K_TREND"])
else:
    DELTA, K_TREND = 0.15, 0.5
K_PRIM = 0.25
TURN_LO, TURN_HI_MID, TURN_HI_PRES, TURN_HI_CVAP = 0.70, 1.35, 1.02, 0.88
T_TYPE_LO, T_TYPE_HI = 0.02, 0.97
BAND_MARGIN, BAND_POOL = 0.45, 60.0
AUDIT = {}
_B = {}

lg = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))
iv = lambda x: 1 / (1 + np.exp(-x))


def softclip(x, lo, hi, tau=TAU):
    x = np.asarray(x, float)
    up = hi + tau * np.tanh((x - hi) / tau)
    dn = lo - tau * np.tanh((lo - x) / tau)
    return np.where(x > hi, up, np.where(x < lo, dn, x))


# ── 1. county support ─────────────────────────────────────────────────────────────────────────────
def county_support(st, fl, d2, turnout, S, years, P16, P20, P24, prim):
    """d2 county Democratic two party share Series. Returns the bounded Series and an audit dict."""
    if not ON: return d2, None
    rel = []
    def add(D, R):
        D = pd.Series(D).reindex(fl).astype(float); R = pd.Series(R).reindex(fl).astype(float)
        ok = (D + R) > 0
        if ok.sum() < max(2, 0.5 * len(fl)): return
        stt = D[ok].sum() / (D[ok] + R[ok]).sum()
        rel.append((lg(D / (D + R)) - lg(stt)).where(ok))
    for P in (P16, P20, P24):
        try: add(P.votes_dem, P.votes_gop)
        except Exception: pass
    for y in years:
        try: add(S[y].D, S[y].R)
        except Exception: pass
    if len(rel) < 2:
        return d2, dict(applied=False, reason="fewer than two past results")
    R_ = pd.concat(rel, axis=1)
    rmax, rmin = R_.max(axis=1), R_.min(axis=1)
    # the last presidential cycle's drift, 2020 to 2024, the same one cycle trend the 2022 calibration measured
    trend = (R_.iloc[:, 2] - R_.iloc[:, 1]) if R_.shape[1] >= 3 else pd.Series(0.0, index=fl)
    up = DELTA + K_TREND * trend.clip(lower=0).fillna(0)
    dn = DELTA + K_TREND * (-trend).clip(lower=0).fillna(0)
    try:
        ps = prim.pD / (prim.pD + prim.pR); pst = prim.pD.sum() / (prim.pD.sum() + prim.pR.sum())
        # a primary electorate far more Democratic than the county's usual lean widens the ceiling, and the reverse
        pdev = (lg(ps) - lg(pst)).reindex(fl) - R_.mean(axis=1)
        up = up + K_PRIM * pdev.clip(lower=0).fillna(0).clip(upper=0.6)
        dn = dn + K_PRIM * (-pdev).clip(lower=0).fillna(0).clip(upper=0.6)
    except Exception:
        pass
    miss = rmax.isna()
    w = pd.Series(np.asarray(turnout, float), index=fl)
    x = lg(d2.values); target = float((d2 * w).sum() / w.sum())
    for _ in range(8):
        lvl = lg(target)
        hi = (lvl + rmax + up).values; lo = (lvl + rmin - dn).values
        hi = np.where(miss.values, np.inf, hi); lo = np.where(miss.values, -np.inf, lo)
        xc = softclip(x, lo, hi)
        # restore the statewide share with one shift, then clip again
        a, b = -2.0, 2.0
        for _ in range(50):
            m = (a + b) / 2
            v = float((iv(softclip(xc + m, lo, hi)) * w.values).sum() / w.sum())
            a, b = (m, b) if v < target else (a, m)
        x = softclip(xc + (a + b) / 2, lo, hi)
    out = pd.Series(iv(x), index=fl)
    moved = np.abs(out.values - d2.values)
    aud = dict(applied=True, results_in_envelope=int(R_.shape[1]), counties=int(len(fl)),
               counties_topped_out=int(((x > hi - 1e-9) | (x < lo + 1e-9)).sum()),
               counties_moved_over_half_point=int((moved > 0.005).sum()),
               largest_county_move_points=round(100 * float(moved.max()), 2),
               statewide_check=round(100 * float((out * w).sum() / w.sum() - target), 4))
    return out, aud


# ── 3. county turnout ─────────────────────────────────────────────────────────────────────────────
def county_turnout(fl, turnout, m22, P24, cvap_of, mid_mult=TURN_HI_MID):
    if not ON: return turnout, None
    t = pd.Series(np.asarray(turnout, float), index=fl)
    m = pd.Series(m22).reindex(fl).astype(float)
    p = P24.total_votes.reindex(fl).astype(float)
    cv = pd.Series([cvap_of(f) or np.nan for f in fl], index=fl).astype(float)
    hi = pd.concat([mid_mult * m, TURN_HI_PRES * p, TURN_HI_CVAP * cv], axis=1).min(axis=1)
    lo = TURN_LO * m
    ok = hi.notna() & lo.notna() & (hi > lo) & (m > 0)
    new = t.copy()
    tl = np.log(t[ok]); h = np.log(hi[ok]); l_ = np.log(lo[ok])
    new[ok] = np.exp(softclip(tl.values, l_.values, h.values, tau=0.05))
    aud = dict(counties_checked=int(ok.sum()), counties_capped=int((t[ok] > hi[ok]).sum()), counties_floored=int((t[ok] < lo[ok]).sum()),
               turnout_change_pct=round(100 * float(new.sum() / t.sum() - 1), 2))
    return new.values, aud


# ── 2. group bands from TPSI ──────────────────────────────────────────────────────────────────────
def group_bands(sm):
    """[4 race, 3 party] low and high offsets in log odds from TPSI regional spread of the generic ballot."""
    if "bands" in _B: return _B["bands"]
    import voters as vf
    r = vf.prep(sm)
    m = r.gb_2way.isin(["Democrat", "Republican"]).values
    d = pd.DataFrame(dict(race=((r.k.values // 2) % 4), j=r.j.values, reg=r.region8.values,
                          y=(r.gb_2way == "Democrat").values.astype(float), w=r.turnout_propensity.fillna(0.5).values))[m]
    lo = np.zeros((4, 3)); hi = np.zeros((4, 3)); info = {}
    for (rc, j), g in d.groupby(["race", "j"]):
        pn = np.clip((g.w * g.y).sum() / g.w.sum(), 0.02, 0.98)
        devs = []
        for reg, h in g.groupby("reg"):
            n = len(h); pr = (h.w * h.y).sum() / max(h.w.sum(), 1e-9)
            ps = (n * pr + BAND_POOL * pn) / (n + BAND_POOL)
            devs.append(lg(ps) - lg(pn))
        devs = np.array(devs) if devs else np.zeros(1)
        lo[rc, j] = min(devs.min(), 0) - BAND_MARGIN; hi[rc, j] = max(devs.max(), 0) + BAND_MARGIN
        info[f"{sm.RACE[rc]}|{['D','R','I'][j]}"] = dict(n=int(len(g)), national_d=round(float(pn), 3), low=round(float(lo[rc, j]), 3), high=round(float(hi[rc, j]), 3))
    _B["bands"] = (lo, hi); AUDIT["group_bands"] = info
    return lo, hi


def type_bands(sm, gg):
    """per voter type [K] low and high offsets, from its race and party"""
    lo, hi = group_bands(sm)
    kk = gg // 12; rc = (kk // 2) % 4; j = (gg // 4) % 3
    return lo[rc, j], hi[rc, j]


def widen_for_fit(err, LO, HI, C):
    """[C, K] bands widened in counties the bounded constants could not fit"""
    f = np.where(err > 0.002, 1.6, 1.0)[:, None]
    return LO[None, :] * f, HI[None, :] * f


# ── 4. statewide race group floors and ceilings ───────────────────────────────────────────────────
# Validated 2024 and 2020 vote by race, Pew Research Center, June 26 2025, two party Democratic share:
#   White 43.9 and 43.9, Black 84.7 and 92.0, Hispanic 51.5 and 62.9, Asian 58.8 and 70.0.
# The 2026 center for each group is the 2024 value moved by the national environment the model is anchored to,
# NAT_D2 against the 2024 result, with its 2020 value as the other end of recent history. A state's group can sit
# away from the national center by RACE_MARGIN plus the TPSI regional spread for that group, capped; whites vary by state far
# more than any band could honestly hold, so they get no statewide limit and absorb what the other groups cannot.
PEW = {"White": (0.439, 0.439), "Black": (0.847, 0.920), "Hispanic": (0.515, 0.629), "Asian/Other": (0.588, 0.700)}
RACE_MARGIN = 0.35
RACE_SPREAD_CAP = 0.25
RACE_LIMITED = ("Black", "Hispanic", "Asian/Other")


def race_limits(sm):
    if "race" in _B: return _B["race"]
    import voters as vf
    r = vf.prep(sm)
    m = r.gb_2way.isin(["Democrat", "Republican"]).values
    d = pd.DataFrame(dict(race=r.race4.values, reg=r.region8.values, y=(r.gb_2way == "Democrat").values.astype(float),
                          w=r.turnout_propensity.fillna(0.5).values))[m]
    env = lg(sm.NAT_D2) - lg(sm.NAT_2024_D2)
    out = {}
    for rc in RACE_LIMITED:
        g = d[d.race == rc]
        pn = (g.w * g.y).sum() / max(g.w.sum(), 1e-9)
        devs = [0.0]
        for reg, h in g.groupby("reg"):
            n = len(h); pr = (h.w * h.y).sum() / max(h.w.sum(), 1e-9)
            devs.append(lg((n * pr + BAND_POOL * pn) / (n + BAND_POOL)) - lg(pn))
        c24, c20 = PEW[rc]
        center_lo = min(lg(c24), lg(c20)) + env; center_hi = max(lg(c24), lg(c20)) + env
        # TPSI state and regional samples of these groups are small, so their spread widens the range by at most
        # RACE_SPREAD_CAP on either side
        lo = center_lo - RACE_MARGIN - min(RACE_SPREAD_CAP, -min(devs)); hi = center_hi + RACE_MARGIN + min(RACE_SPREAD_CAP, max(devs))
        out[rc] = (float(iv(lo)), float(iv(hi)))
    _B["race"] = out
    AUDIT["race_limits"] = {k: [round(v[0], 3), round(v[1], 3)] for k, v in out.items()}
    AUDIT["race_limits_env_logit"] = round(float(env), 3)
    return out


def enforce_race(race_of_col, shares_fn, n_iter=8):
    """race_of_col: race label per column. shares_fn(kappa dict) re-solves the county constants with each race's
    offset kappa and returns {race: statewide Democratic two party share}. Returns kappa and an audit."""
    lim = _B.get("race") or {}
    kap = {rc: 0.0 for rc in lim}
    sh = shares_fn(kap); start = dict(sh)
    for _ in range(n_iter):
        moved = False
        for rc, (lo, hi) in lim.items():
            s = sh.get(rc)
            if s is None or not np.isfinite(s): continue
            if s < lo: kap[rc] += float(lg(lo + 0.002) - lg(s)); moved = True
            elif s > hi: kap[rc] += float(lg(hi - 0.002) - lg(s)); moved = True
        if not moved: break
        sh = shares_fn(kap)
    aud = {rc: dict(before=round(100 * start[rc], 1), after=round(100 * sh[rc], 1), floor=round(100 * lim[rc][0], 1), ceiling=round(100 * lim[rc][1], 1),
                    offset_logit=round(kap[rc], 3)) for rc in lim if rc in sh and np.isfinite(sh[rc])}
    return kap, aud
