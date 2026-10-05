"""National anchors, applied county by county through elasticity rather than as one flat shift.

Two national numbers feed the three legs:

  Meridian ballot   DSMeridian Model 13R3 run on every response in the TPSI database (meridian_all.py). It sets the
                    approval leg and, in the House, the history leg.
  Gallup party ID   50 D to 39 R among adults, Oct 2026, with leaners. Party identification is not a vote, so it is converted:
                    the TPSI party mix of every ACS cell in every county is moved until the nation's adults identify
                    50 D, 39 R and 11 independent; each cell and party then turns out at its DSMeridian likely voter
                    propensity and votes at its TPSI vote chance. The result is the likely voter two party vote that
                    Gallup's party identification implies, and it sets the census leg.

Neither number is added to every county alike. Each county's elasticity, from the national demographic fit and its
own 2016 to 2020 and 2020 to 2024 presidential swings, scales one national constant, so swing counties move further
than locked ones and the constant is solved so the 2024 vote weighted national average lands exactly on the anchor.
"""
import os, json, numpy as np, pandas as pd

CACHE = os.environ.get("NAT_ELAST_CACHE", "/tmp/pvi/nat_elasticity.csv")
GALLUP_D, GALLUP_R = 50.0, 39.0   # Gallup, Oct 2026 release
_A = {}

def _sm():
    import senate_mode as sm
    return sm

def national_counties(sm):
    ACS_US = sm.ACS[sm.ACS.index.str.match(r"^\d{5}$") & ~sm.ACS.index.str.startswith("72")]
    # Alaska is left out of the national solves: the national county presidential files carry Alaska by state house district
    # or as repeated statewide totals, not by borough, so its rows there are not county results. Alaska's own races use the
    # borough frames built in senate_mode.pres_frames, and its counties take the national elasticity fallback of 1.
    fl = [f for f in ACS_US.index if f in sm.APPROVAL.index and f in sm.P24.index and not f.startswith("02")]
    return fl

def region_fn(sm, model):
    abbr = sm.APPROVAL.state_abbr.to_dict()
    return lambda f: model["state_region"].get(abbr.get(f), model["regions"][0]), abbr

def gallup_lv_d2(sm, model):
    """Likely voter two party Democratic share implied by Gallup's adult party identification."""
    if "gallup" in _A: return _A["gallup"]
    import electorate as ev, history as hi
    fl = national_counties(sm); rf, abbr = region_fn(sm, model)
    F = hi.fit(sm); nx = F["nx"]
    pops, shares, lv, vv = [], [], [], []
    by = {}
    for f in fl: by.setdefault(rf(f), []).append(f)
    dums = np.array([[1, 0], [0, 1], [0, 0]], float)
    for reg, fls in by.items():
        popc, x, meta = hi.cells(sm, fls, reg)
        G = ev.groups(sm, model, fls, reg)
        # likely voter propensity by cell and party, the DSMeridian score averaged over the TPSI vote history mix
        L = hi.logits(sm, x)
        pm = hi.inv(L["M"]); p1 = hi.inv(L["P1"]); p0 = hi.inv(L["P0"])
        Hs = np.stack([pm * p1, pm * (1 - p1), (1 - pm) * p0, (1 - pm) * (1 - p0)], axis=2)
        plv = (Hs * hi.inv(L["LVT"])).sum(2)
        pv = (Hs * hi.inv(L["V"])).sum(2)
        pops.append(popc.sum(0)); shares.append(G["share"]); lv.append(plv); vv.append(pv)
    pops, shares, lv, vv = np.array(pops), np.array(shares), np.array(lv), np.array(vv)      # [R,32], [R,32,3]
    def mix(a, b):
        s = shares * np.exp(np.array([a, -a, b])[None, None, :])
        return s / s.sum(2, keepdims=True)
    def adults(a, b):
        m = mix(a, b); w = pops[:, :, None] * m
        return w[..., 0].sum() / w.sum(), w[..., 1].sum() / w.sum()
    a, b = 0.0, 0.0
    tD, tR = GALLUP_D / 100, GALLUP_R / 100
    for _ in range(200):
        d, r = adults(a, b)
        a += 0.5 * (np.log(d / r) - np.log(tD / tR)) * -1
        b += 0.5 * (np.log(1 - d - r) - np.log(1 - tD - tR)) * -1
    m = mix(a, b); w = pops[:, :, None] * m * lv
    d2 = float((w * vv).sum() / w.sum())
    d_, r_ = adults(a, b)
    _A["gallup"] = d2; _A["gallup_detail"] = dict(adult_D=d_, adult_R=r_, party_shift=a, independent_shift=b, lv_two_party_d=d2)
    return d2

def nat_elasticity(sm, model, shift):
    if "e" in _A: return _A["e"]
    if os.path.exists(CACHE):
        s = pd.read_csv(CACHE, dtype={"f": str}).set_index("f").e
        _A["e"] = s; return s
    import elasticity as el
    el.fit_prior(sm, model, shift)
    fl = national_counties(sm); rf, abbr = region_fn(sm, model)
    out = {}
    by = {}
    for f in fl: by.setdefault(abbr.get(f, "??"), []).append(f)
    for st, fls in by.items():
        try:
            comps = sm.census_components(model, fls, rf)
            P16, P20, P24 = sm.P16, sm.P20, sm.P24
            p = P24.reindex(fls); d = (p.votes_dem / (p.votes_dem + p.votes_gop)).clip(0.01, 0.99).fillna(0.5).values
            e, e0, own, used = el.county_elasticity(sm, st, {}, fls, model, shift, comps, {}, [], P16, P20, P24,
                                                    p.total_votes.fillna(1).values, d)
            for f, v in zip(fls, e.values): out[f] = float(v) if np.isfinite(v) else 1.0
        except Exception:
            for f in fls: out[f] = 1.0
    s = pd.Series(out); s.index.name = "f"
    s.rename("e").to_frame().to_csv(CACHE)
    _A["e"] = s
    return s

def _solve(x, e, w, target):
    lo, hi = -3.0, 3.0
    for _ in range(70):
        mid = (lo + hi) / 2
        if float((1 / (1 + np.exp(-(x + e * mid))) * w).sum() / w.sum()) < target: lo = mid
        else: hi = mid
    return (lo + hi) / 2

def vf_on():
    import voters as vf
    return os.environ.get("VOTERFILE", "1") == "1" and bool(vf.load_national())

def m1_constant(sm, model, shift):
    """Approval leg: county approval converted with the TPSI crosstab, moved by elasticity times one constant.
    In Voter File Mode the county value is the simulated 2026 electorate's preference, with each voter's Trump
    approval simulated from the TPSI county approval file, and the same elasticity times one constant sets its level."""
    if "k1" in _A: return _A["k1"]
    fl = national_counties(sm)
    if vf_on():
        import voters as vf
        N = vf.load_national()
        fl = [f for f in fl if f in N]
        x = sm.logit(np.clip(np.array([N[f] for f in fl]), 1e-4, 1 - 1e-4))
        e = nat_elasticity(sm, model, shift).reindex(fl).fillna(1.0).values
        vw = sm.P24.reindex(fl).total_votes.fillna(0).values
        _A["k1"] = _solve(x, e, vw, sm.NAT_D2)
        _A["m1_before"] = float((sm.inv(x) * vw).sum() / vw.sum()); _A["m1_source"] = "voter file"
        return _A["k1"]
    r = sm.RESP; w = r.turnout_propensity
    ct = pd.crosstab(r.trump_approve_2way, r.generic_ballot, values=w, aggfunc="sum", normalize="index")
    app, dis, noop, cal = sm.calibrated_approval(fl)
    Dv = dis * ct.loc["Disapprove", "Democrat"] + app * ct.loc["Approve", "Democrat"] + noop * ct.loc["Neutral", "Democrat"]
    Rv = dis * ct.loc["Disapprove", "Republican"] + app * ct.loc["Approve", "Republican"] + noop * ct.loc["Neutral", "Republican"]
    x = sm.logit((Dv / (Dv + Rv)).values); e = nat_elasticity(sm, model, shift).reindex(fl).fillna(1.0).values
    vw = sm.P24.reindex(fl).total_votes.fillna(0).values
    _A["k1"] = _solve(x, e, vw, sm.NAT_D2)
    _A["m1_before"] = float((sm.inv(x) * vw).sum() / vw.sum())
    return _A["k1"]

def m2_params(sm, model, shift):
    """Census leg: the TPSI demographic swing keeps its county to county shape; its national level is replaced by
    elasticity times one constant solved to Gallup's likely voter implication."""
    if "k2" in _A: return _A["m2_mean"], _A["k2"]
    fl = national_counties(sm); rf, abbr = region_fn(sm, model)
    comps = sm.census_components(model, fl, rf)
    g26, _, _ = sm.census_predict(model, fl, rf, shift[0], comps)
    g24, _, _ = sm.census_predict(model, fl, rf, shift[1], comps, use24=True)
    p = sm.P24.reindex(fl); a24 = (p.votes_dem / (p.votes_dem + p.votes_gop)).clip(0.01, 0.99).values
    vw = p.total_votes.fillna(0).values
    sw = sm.logit(g26) - sm.logit(g24)
    mean = float((sw * vw).sum() / vw.sum())
    e = nat_elasticity(sm, model, shift).reindex(fl).fillna(1.0).values
    target = gallup_lv_d2(sm, model) if getattr(sm, "M2_ANCHOR", "meridian") == "gallup" else sm.NAT_D2
    k2 = _solve(sm.logit(a24) + (sw - mean), e, vw, target); _A["m2_target"] = target
    _A["m2_mean"], _A["k2"] = mean, k2
    return mean, k2

def m3_constant(sm, model, shift):
    """History leg where no poll levels it: the certified 2024 county result moved by elasticity times one constant
    solved to the Meridian ballot."""
    if "k3" in _A: return _A["k3"]
    fl = national_counties(sm)
    p = sm.P24.reindex(fl); a24 = (p.votes_dem / (p.votes_dem + p.votes_gop)).clip(0.01, 0.99).values
    vw = p.total_votes.fillna(0).values
    e = nat_elasticity(sm, model, shift).reindex(fl).fillna(1.0).values
    _A["k3"] = _solve(sm.logit(a24), e, vw, sm.NAT_D2)
    return _A["k3"]

def county_e(sm, model, shift, fl):
    return nat_elasticity(sm, model, shift).reindex(fl).fillna(1.0).values

def summary():
    return {k: v for k, v in _A.items() if k != "e"}
