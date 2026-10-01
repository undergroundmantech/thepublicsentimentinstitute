"""TPSI Candidate Mode: candidate quality, strength and weakness from the 2026 primaries and the polls.

Four measures, each independent of the national environment because each is read inside one party or against the
model's own environment based fundamentals:

1. Party unity. The nominee's statewide share of their own party's primary vote, with runoffs averaged in as elsewhere
   in the model, against the median contested nominee. A nominee who won with a narrow plurality leads a divided party;
   one who swept it leads a unified one. An unopposed nominee is read as moderately unified. Each side's unity moves the
   race by 0.025 in log odds per log odds unit of unity, and the net shift is held to 0.05 either way.

2. Demographic strength. Across counties, the nominee's primary share is regressed on the county's shares of Black,
   Hispanic, and Asian and other adults, college graduates, adults under 30 and adults 65 and over, weighted by that
   party's primary vote and shrunk toward zero. The fit gives the nominee's support inside the party for each of the 32
   age, race and college cells, relative to the party as a whole. Where a nominee ran weak in the primary, that party's
   voters in the general election defect and stay home a little more; where the nominee ran strong they hold and turn
   out. Independents lean toward the side whose nominee is stronger with their cell. The effect is centered, so it moves
   where and among whom a candidate wins, not the party's statewide base.

3. Candidate strength against the environment. Where polls exist, the gap between the polling average and the model's
   own fundamentals, which already carry Trump approval, the Gallup environment, the census and TPSI electorate, the
   money and party unity, less the average gap across every polled race, which is the national environment, is what is
   left: the candidates themselves. Half of it, shrunk by the number of polls as
   n / (n + 4) and held to 0.12, moves the approval and census legs toward it.

4. Uncertainty. Every simulated election draws a candidate shock for the race, larger when either party is divided or
   the race has no polling, so a weak nominee can collapse and a strong one can overperform.
"""
import os, numpy as np, pandas as pd

K_UNITY, UNITY_CAP, UNOPPOSED_SHARE, UNITY_REF = (0.025 if os.environ.get("NO_RECENCY") else 0.028), 0.05, 0.75, None
K_DEMO_VOTE, K_DEMO_TURN, K_DEMO_IND, DEMO_CLIP, RIDGE = 0.30, 0.20, 0.15, 1.0, 0.5
K_POLL, POLL_CAP, POLL_N0 = 0.5, 0.12, 4.0
# the national gap between polls and fundamentals is the environment, not the candidates: it is the poll count weighted
# mean gap across all 58 polled Senate and governor races in a pre pass, and it is removed
POLL_CENTER = float(os.environ.get("CAND_POLL_CENTER", "-0.1005"))
SIG_CAND_BASE, SIG_CAND_DIV, SIG_CAND_NOPOLL, SIG_CAND_MAX = 0.02, 0.03, 0.02, 0.07
FEATS = ["Black", "Hispanic", "Asian and other", "college graduates", "under 30", "65 and over"]
lg = lambda p: np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4)))
PROFILES = {}

# Observed post primary loyalty. Where a survey asks the losing candidates' primary voters whom they back in the
# general election, it measures party unity directly instead of inferring it from the nominee's primary share.
# The two way loyalty rate is turned into an equivalent primary share, the share at which the model's usual
# assumption, LOYAL_REF of the losing side's voters coming home, gives the same consolidation, and blended with the
# primary based measure by the survey's effective size, n_eff / (n_eff + LOYAL_N0). Non probability samples are
# given a small effective size.
LOYAL_REF, LOYAL_N0 = 0.85, 300.0
OBS_LOYALTY = {
    # Fishback 2026 campaign SMS survey fielded 2026-09-18: 33,819 texted, 2,932 replies, supporters of the losing
    # Republican primary candidates. Two way Donalds share by prior support, weighted by each candidate's statewide
    # primary vote: Collins 88.4 percent of 24.5 points, Fishback 65.7 of 10.4, Renner 66.0 of 1.7.
    "FLG": dict(R=dict(loyalty=0.809, n_eff=300.0, source="Fishback 2026 campaign SMS survey, 2026-09-18")),
}

K_MOB, MOB_CLIP = 0.15, 0.30
# Primary priority, Sept 29 2026. This year's primaries now carry more of the candidate signal: party unity moves the race
# PRIMARY_BOOST times as far, with the cap raised in step, and the demographic, home ground and mobilization readings of
# each nominee's primary vote count half that much more. PRIMARY_BOOST=1 restores the Sept 28 settings.
PRIMARY_BOOST = float(os.environ.get("PRIMARY_BOOST", "1.5"))
_PB_HALF = 1.0 + (PRIMARY_BOOST - 1.0) / 2.0
K_UNITY, UNITY_CAP = K_UNITY * PRIMARY_BOOST, UNITY_CAP * PRIMARY_BOOST
K_DEMO_VOTE, K_DEMO_TURN, K_MOB = K_DEMO_VOTE * _PB_HALF, K_DEMO_TURN * _PB_HALF, K_MOB * _PB_HALF
# home ground: county residual of the nominee's primary share after the demographic fit
K_GEO_V, K_GEO_IND, K_GEO_T, GEO_N0, GEO_CLIP = 0.25, 0.10, 0.10, 500.0, 1.0
K_GEO_V = K_GEO_V * _PB_HALF
GROUPS = [("Black", lambda ai, ri, ci: ri == 1), ("Hispanic", lambda ai, ri, ci: ri == 2), ("Asian and other", lambda ai, ri, ci: ri == 3),
          ("white without a degree", lambda ai, ri, ci: ri == 0 and ci == 0), ("white with a degree", lambda ai, ri, ci: ri == 0 and ci == 1),
          ("under 30", lambda ai, ri, ci: ai == 0), ("65 and over", lambda ai, ri, ci: ai == 3)]

def primary_electorate(sm, model, st, fl):
    """[C, 32, 3] expected primary voters by cell and party: ACS adults, the TPSI party mix solved to the county's 2024
    result, and the DSMeridian likely voter propensity of that cell's regular voters, the people who vote in primaries."""
    import history as hi, electorate as ev
    reg = model["state_region"][sm.STATES[st].get("base", st[:2])]
    popc, x, meta = hi.cells(sm, fl, reg); L = hi.logits(sm, x)
    share = ev.groups(sm, model, fl, reg)["share"]
    P24 = sm.pres_frames(st)[2].reindex(fl)
    a24 = (P24.votes_dem / (P24.votes_dem + P24.votes_gop)).clip(0.01, 0.99).fillna(0.5).values
    tv = hi.inv(L["LVT"][:, :, 0]); vv = hi.inv(L["V"][:, :, 0])
    def f(z):
        m = hi.party_mix(share, z); w = popc[:, :, None] * m * tv[None]
        return (w * vv[None]).sum((1, 2)) / np.maximum(w.sum((1, 2)), 1e-9)
    a = hi.solve(f, a24, len(fl), -6, 6, 45)
    comp = popc[:, :, None] * hi.party_mix(share, a) * tv[None] ** 2
    return comp, meta

def eco_fit(comp_p, share_c, votes_c, Z, ridge=0.5):
    """Ecological inference on one party's primary: the nominee's support in each of the 32 cells is logistic in the
    cell's features, and the county share it implies, the expected primary voters of each cell times their support,
    is fit to every county's actual nominee share, weighted by that county's primary vote."""
    from scipy.optimize import minimize
    m = np.isfinite(share_c) & (votes_c > 0) & (comp_p.sum(1) > 0)
    if m.sum() < 8: return None
    Cm = comp_p[m]; y = lg(np.clip(share_c[m], 0.01, 0.99)); w = votes_c[m] / votes_c[m].mean()
    def loss(th):
        s_k = 1 / (1 + np.exp(-(th[0] + Z @ th[1:])))
        pred = (Cm * s_k[None]).sum(1) / Cm.sum(1)
        return float((w * (lg(pred) - y) ** 2).sum() / w.sum() + ridge * (th[1:] ** 2).sum() / len(y))
    th0 = np.r_[float(np.average(y, weights=w)), np.zeros(Z.shape[1])]
    r = minimize(loss, th0, method="L-BFGS-B")
    return r.x

def mob_fit(comp_p, votes_c, Z, ridge=0.5):
    """Who turned out in the primary beyond the likely voter expectation: primary votes by county against the expected
    primary electorate, with each cell's turnout multiplied by exp(delta . z)."""
    from scipy.optimize import minimize
    m = (votes_c > 0) & (comp_p.sum(1) > 0)
    if m.sum() < 8: return None
    Cm = comp_p[m]; y = np.log(votes_c[m]); w = np.sqrt(votes_c[m]); w = w / w.mean()
    def loss(th):
        pred = np.log(np.maximum((Cm * np.exp(Z @ th[1:])[None]).sum(1), 1e-9)) + th[0]
        return float((w * (pred - y) ** 2).sum() / w.sum() + ridge * (th[1:] ** 2).sum() / len(y))
    th0 = np.r_[float(np.average(y - np.log(Cm.sum(1)), weights=w)), np.zeros(Z.shape[1])]
    return minimize(loss, th0, method="L-BFGS-B").x

def side_kind(c):
    c = pd.Series(c).astype(float).dropna()
    if len(c) == 0: return "none"
    if c.std() < 1e-6 and abs(c.iloc[0] - 0.5) < 1e-6: return "none"         # no primary file, or nominee term neutral
    if c.min() > 0.999: return "unopposed"
    return "contested"

def set_reference(shares):
    global UNITY_REF
    UNITY_REF = float(np.median(shares)) if len(shares) else 0.6

def county_features(sm, fl):
    ageS, raceS, colR, adults = sm.county_cells(fl)
    col = (raceS * colR).sum(1)
    return np.column_stack([raceS[:, 1], raceS[:, 2], raceS[:, 3], col, ageS[:, 0], ageS[:, 3]]), adults

def cell_features(meta):
    X = np.zeros((32, 6))
    for k, (ai, ri, ci) in enumerate(meta):
        X[k] = [ri == 1, ri == 2, ri == 3, ci == 1, ai == 0, ai == 3]
    return X

def demo_fit(Xc, share, w):
    """Ridge weighted regression of logit nominee share on county composition, centered on the party's own mix."""
    m = np.isfinite(share) & (w > 0)
    if m.sum() < 8: return None, None
    X = Xc[m]; y = lg(share[m]); ww = w[m] / w[m].mean()
    xbar = (X * ww[:, None]).sum(0) / ww.sum(); ybar = (y * ww).sum() / ww.sum()
    Xs = X - xbar; ys = y - ybar
    XtX = Xs.T @ (Xs * ww[:, None]); lam = RIDGE * np.trace(XtX) / X.shape[1]
    A = XtX + lam * np.eye(X.shape[1])
    b = np.linalg.solve(A, Xs.T @ (ww * ys))
    return b, xbar

def profile(sm, st, fl, prim, meta, n_polls, incumbents, model=None):
    cfg = sm.STATES[st]
    Xk = cell_features(meta)
    comp = None
    if model is not None:
        try:
            comp, _ = primary_electorate(sm, model, st, fl)
        except Exception as e:
            comp = None
    out = dict(sides={})
    for j, s in enumerate("DR"):
        c = prim[f"cand{s}"].astype(float).values; w = prim[f"p{s}"].astype(float).fillna(0).values
        kind = side_kind(c)
        share = float((np.nan_to_num(c) * w).sum() / w.sum()) if w.sum() > 0 and kind == "contested" else None
        obs = None
        if kind == "contested":
            u = float(lg(share) - lg(UNITY_REF))
            o = OBS_LOYALTY.get(st, {}).get(s)
            if o:
                cons = share + (1 - share) * o["loyalty"]                       # observed consolidation behind the nominee
                s_eq = float(np.clip((cons - LOYAL_REF) / (1 - LOYAL_REF), 0.05, 0.95))
                u_obs = float(lg(s_eq) - lg(UNITY_REF))
                w_obs = o["n_eff"] / (o["n_eff"] + LOYAL_N0)
                obs = dict(loyalty=o["loyalty"], consolidation=round(cons, 4), equivalent_share=round(s_eq, 4),
                           unity_primary=round(u, 4), unity_observed=round(u_obs, 4), weight=round(w_obs, 3), source=o["source"])
                u = (1 - w_obs) * u + w_obs * u_obs
        elif kind == "unopposed":
            u = float(lg(UNOPPOSED_SHARE) - lg(UNITY_REF))
        else:
            u = 0.0
        dev = np.zeros(32); mob = np.zeros(32); strong = weak = None; groups = None; b = None; geo = np.zeros(len(fl))
        if kind == "contested" and np.nanstd(c) > 0.01 and comp is not None:
            cp = comp[:, :, j]
            th = eco_fit(cp, c, w, Xk)
            if th is not None:
                s_k = 1 / (1 + np.exp(-(th[0] + Xk @ th[1:])))
                wk = cp.sum(0)
                dev = np.clip(lg(s_k) - np.average(lg(s_k), weights=wk), -DEMO_CLIP, DEMO_CLIP)
                b = th[1:]
                groups = {}
                for g, f in GROUPS:
                    mk = np.array([f(*mm) for mm in meta], bool)
                    if wk[mk].sum() > 0: groups[g] = float(np.average(s_k[mk], weights=wk[mk]))
                gd = {g: v - share for g, v in groups.items()}
                strong = max(gd, key=gd.get); weak = min(gd, key=gd.get)
                # home ground: what the county result says beyond the county's demographics. A nominee who wins the state
                # but runs fifth in a county does worse there than its mix of voters predicts; the residual, shrunk by
                # the county's primary vote and centered on the party's statewide vote, is the candidate's local
                # strength or weakness among that party's voters there
                pred = (cp * s_k[None]).sum(1) / np.maximum(cp.sum(1), 1e-9)
                ok = np.isfinite(c) & (w > 0)
                res = np.where(ok, lg(np.clip(np.nan_to_num(c, nan=0.5), 0.01, 0.99)) - lg(pred), 0.0) * w / (w + GEO_N0)
                res = np.clip(res, -GEO_CLIP, GEO_CLIP)
                if w[ok].sum() > 0: res = np.where(ok, res - np.average(res[ok], weights=w[ok]), 0.0)
                geo = res
        if kind == "contested" and comp is not None:
            dm = mob_fit(comp[:, :, j], w, Xk)
            if dm is not None:
                raw = Xk @ dm[1:]
                mob = np.clip(raw - np.average(raw, weights=comp[:, :, j].sum(0)), -MOB_CLIP / K_MOB, MOB_CLIP / K_MOB)
        out["sides"][s] = dict(kind=kind, share=share, unity=u, observed_loyalty=obs, dev=dev, mob=mob, groups=groups, geo=geo,
                               beta=None if b is None else dict(zip(FEATS, map(float, b))), strongest=strong, weakest=weak)
    uD, uR = out["sides"]["D"]["unity"], out["sides"]["R"]["unity"]
    out["unity_shift"] = float(np.clip(K_UNITY * (uD - uR), -UNITY_CAP, UNITY_CAP))
    div = max(0.0, -uD) + max(0.0, -uR)
    out["sigma"] = float(min(SIG_CAND_MAX, SIG_CAND_BASE + SIG_CAND_DIV * div + (SIG_CAND_NOPOLL if n_polls == 0 else 0.0)))
    PROFILES[st] = out
    return out

def group_shifts(prof):
    """[32, 3] vote and turnout log odds shifts for Democrats, Republicans and independents."""
    dD, dR = prof["sides"]["D"]["dev"], prof["sides"]["R"]["dev"]
    vote = np.stack([K_DEMO_VOTE * dD, -K_DEMO_VOTE * dR, K_DEMO_IND * (dD - dR)], axis=1)
    mD, mR = prof["sides"]["D"].get("mob", np.zeros(32)), prof["sides"]["R"].get("mob", np.zeros(32))
    turn = np.stack([K_DEMO_TURN * dD + K_MOB * mD, K_DEMO_TURN * dR + K_MOB * mR, np.zeros(32)], axis=1)
    return vote, turn

def geo_shifts(prof, fl):
    """[C, 3] vote and turnout log odds shifts by county for Democrats, Republicans and independents."""
    gD = prof["sides"]["D"].get("geo"); gR = prof["sides"]["R"].get("geo")
    C = len(fl)
    gD = np.zeros(C) if gD is None or len(gD) != C else gD; gR = np.zeros(C) if gR is None or len(gR) != C else gR
    v = np.column_stack([K_GEO_V * gD, -K_GEO_V * gR, K_GEO_IND * (gD - gR)])
    t = np.column_stack([K_GEO_T * gD, K_GEO_T * gR, np.zeros(C)])
    return v, t

def poll_strength(n_polls, poll_d2, fund_d2):
    if not n_polls or poll_d2 is None: return 0.0, None
    gap = float(lg(poll_d2) - lg(fund_d2)) - POLL_CENTER
    return float(np.clip(K_POLL * n_polls / (n_polls + POLL_N0) * gap, -POLL_CAP, POLL_CAP)), gap
