"""TPSI voter behavior layer (Sept 29 2026).

Reads the unified respondent file through voters.prep and gives every simulated voter type three things:

1. Why it turns out. Six motivation factors are scored for every respondent:
     commitment   stated intent and a concrete ballot plan              intent_score, method_score, already_voted
     habit        past voting                                           hist_scalar
     social       how many close contacts will vote                     social_score
     intensity    strength of Trump approval or disapproval             trump_approve
     grievance    economic strain and the direction of the country      econ_strain, right_track
     activation   strong positions on the niche items                   deport_mass, israel_pac, kirk_blame, groyper,
                                                                        trust in the two parties
   A ridge fractional logit of each respondent's likely voter score on the six factors, age, race, college and
   party gives each factor's weight. A voter type's reasons are its donors' factor scores times those weights.

2. How its turnout moves. Every simulation draws a shock to the weight of each factor, nationally and by state:
   when commitment matters more, uncommitted voters drop off; when intensity matters more, soft approvers or soft
   disapprovers stay home. Approval intensity gets one shock for approvers and another for disapprovers, so the
   two coalitions can move apart. The shocks change who votes, not how anyone votes.

3. How loose its party vote is. Among respondents with a 2024 vote and a 2026 generic ballot choice, the share who
   switched party, placed between the least and the most switching their two margins allow. That looseness,
   pooled toward the party and vote history mean, sets how much a voter type splits its ticket between two races
   on the same ballot.

Everything is written to the run summary under behavior. The respondent rows never leave the model.
"""
import os
import numpy as np, pandas as pd

ON = os.environ.get("BEHAVIOR", "1") != "0"
FACTORS = ["commitment", "habit", "social", "intensity", "grievance", "activation"]
# share of each factor's weight that a one standard deviation simulation shock adds or removes
KAPPA_NAT = float(os.environ.get("BEHAVIOR_KAPPA_NAT", "0.25"))
KAPPA_ST = float(os.environ.get("BEHAVIOR_KAPPA_ST", "0.15"))
POOL_N = 30.0          # looseness pooled toward the party by vote history mean with this many pseudo respondents
_C = {}


def _z(x):
    x = pd.to_numeric(pd.Series(np.asarray(x)), errors="coerce").astype(float)
    x = x.fillna(x.mean())
    sd = x.std()
    return ((x - x.mean()) / sd).values if sd > 0 else np.zeros(len(x))


def scores(r):
    """[n, 6] standardized factor scores for the voters.prep frame."""
    if "S" in _C and _C.get("n") == len(r): return _C["S"]
    commit = 0.5 * _z(r.intent_score) + 0.5 * _z(r.method_score) + 0.5 * r.already_voted.fillna(0).values
    habit = _z(r.hist_scalar)
    social = _z(r.social_score)
    ap = r.trump_approve.fillna("Neutral / no opinion")
    inten = np.where(ap.str.startswith("Strongly"), 1.0, np.where(ap.str.startswith("Somewhat"), 0.5, 0.0))
    econ = r.econ_strain.map({"Very difficult": 3, "Somewhat difficult": 2, "Not very difficult": 1, "Not at all difficult": 0})
    track = r.right_track.map({"Wrong track": 1.0, "Right track": 0.0, "Not sure": 0.5})
    griev = 0.5 * _z(econ) + 0.5 * _z(track)
    act = (r.deport_mass.isin(["Strongly support", "Strongly oppose"]).astype(float)
           + r.israel_pac.isin(["Much more likely", "Much less likely"]).astype(float)
           + (r.kirk_blame.notna() & (r.kirk_blame != "Not sure / no opinion")).astype(float)
           + (r.groyper == "Yes").astype(float)
           + (pd.to_numeric(r.trust_net_rep, errors="coerce").abs().fillna(0) >= 2).astype(float))
    S = np.column_stack([_z(commit), habit, social, _z(inten), griev, _z(act)])
    _C["S"], _C["n"] = S, len(r)
    return S


def fit(sm, r):
    """Turnout driver weights: ridge fractional logit of the likely voter score."""
    if "beta" in _C: return _C["beta"]
    S = scores(r)
    y = np.clip(r.turnout_propensity.fillna(r.turnout_propensity.median()).values.astype(float), 0.01, 0.99)
    k = r.k.values; j = r.j.values
    age = np.column_stack([(k // 8 == a).astype(float) for a in (1, 2, 3)])
    race = np.column_stack([((k // 2) % 4 == x).astype(float) for x in (1, 2, 3)])
    col = (k % 2).astype(float)[:, None]
    party = np.column_stack([(j == 0).astype(float), (j == 1).astype(float)])
    X = np.column_stack([np.ones(len(r)), S, age, race, col, party])
    b = sm.irls(X, y, np.ones(len(r)), ridge=2.0)
    beta = b[1:1 + len(FACTORS)]
    # fit quality: correlation of fitted and observed likely voter score
    fitted = 1 / (1 + np.exp(-(X @ b)))
    _C["beta"] = beta; _C["fit_r"] = float(np.corrcoef(fitted, y)[0, 1]); _C["n_fit"] = int(len(r))
    return beta


def looseness(r):
    """Per respondent group (party j by history h), the switching looseness lambda in [0, 1] and per respondent
    switching indicators. Lambda = (observed switching minus the least possible) / (the most possible minus the least)."""
    if "lam_jh" in _C: return _C["lam_jh"], _C["lam_all"]
    both = r.recall.isin(["Harris", "Trump"]).values & r.gb_2way.isin(["Democrat", "Republican"]).values
    d = pd.DataFrame(dict(j=r.j.values, h=r.h.values, h24=(r.recall == "Harris").values.astype(float),
                          d26=(r.gb_2way == "Democrat").values.astype(float)))[both]
    def lam(g):
        p24, p26 = g.h24.mean(), g.d26.mean()
        s = ((g.h24 == 1) & (g.d26 == 0)).mean() + ((g.h24 == 0) & (g.d26 == 1)).mean()
        lo = abs(p24 - p26); hi = min(p24 + p26, 2 - p24 - p26)
        return float(np.clip((s - lo) / max(hi - lo, 1e-6), 0, 1)), len(g), float(s)
    lam_all, n_all, s_all = lam(d)
    out = {}
    for (jj, hh), g in d.groupby(["j", "h"]):
        l, n, s = lam(g)
        out[(int(jj), int(hh))] = dict(lam=(n * l + POOL_N * lam_all) / (n + POOL_N), n=n, switch=s,
                                        sw=(n * s + POOL_N * s_all) / (n + POOL_N))
    _C["lam_jh"], _C["lam_all"] = out, dict(lam=lam_all, n=n_all, switch=s_all)
    return out, _C["lam_all"]


def type_loadings(sm, Lh):
    """For the 1,152 voter file types of a state (3 approval states x 384 groups): [K, 6] factor scores, and [K]
    looseness. Donor weighted within each group; intensity is taken from the donors in the type's approval state."""
    import voters as vf
    r = vf.prep(sm); S = scores(r)
    F = Lh["F"]; IDX, W = F["IDX"], F["W"]
    G = IDX.shape[0]
    base = np.einsum("gd,gdf->gf", W, S[IDX])                                        # [384, 6]
    appr = np.asarray(r.appr.astype(str).tolist(), dtype=object)[IDX]
    rows = []
    for state in ("Approve", "Neutral", "Disapprove"):
        m = (appr == state).astype(float) * W
        ms = m.sum(1)
        inten = np.where(ms > 1e-9, (m * S[IDX][:, :, 3]).sum(1) / np.maximum(ms, 1e-9), base[:, 3])
        L = base.copy(); L[:, 3] = inten if state != "Neutral" else S[:, 3].min()
        rows.append(L)
    L = np.concatenate(rows, 0)                                                      # [1152, 6]
    lam_jh, lam_all = looseness(r)
    jj = np.tile((np.arange(384) // 4) % 3, 3); hh = np.tile(np.arange(384) % 4, 3)
    lam = np.array([lam_jh.get((int(a), int(b)), {"lam": lam_all["lam"]})["lam"] for a, b in zip(jj, hh)])
    sw = np.array([lam_jh.get((int(a), int(b)), {"sw": lam_all["switch"]})["sw"] for a, b in zip(jj, hh)])
    side = np.repeat(np.array([1, 0, -1]), G)                                        # approve, neutral, disapprove
    _C["sw_types"] = sw
    return L, lam, side


def shock_matrix(L, side, beta):
    """[K, 7] loading of each simulation shock on each voter type's turnout log odds: commitment, habit, social,
    grievance, activation, then intensity among approvers and intensity among disapprovers."""
    b = beta
    cols = [L[:, 0] * b[0], L[:, 1] * b[1], L[:, 2] * b[2], L[:, 4] * b[4], L[:, 5] * b[5],
            np.where(side == 1, L[:, 3] * b[3], 0.0), np.where(side == -1, L[:, 3] * b[3], 0.0)]
    return np.column_stack(cols)


SHOCKS = ["commitment", "habit", "social", "grievance", "activation", "approver intensity", "disapprover intensity"]


def analyse(pops, lt, eta, L, lam, side, beta, gg, rate_d, labels):
    """Deterministic behavior audit for one race from the final calibrated voter types.
    pops [C, K] adults, lt, eta [C, K] turnout and Democratic preference log odds, rate_d the Democratic share of the
    two party vote the race is calibrated to. Returns reasons, turnout scenarios and coalition shifts."""
    inv = lambda x: 1 / (1 + np.exp(-x))
    t = inv(lt); p = inv(eta)
    V = pops * t
    def margin(Vx):
        d = (Vx * p).sum(); return 100 * (2 * d / Vx.sum() - 1)
    base_m = margin(V); base_T = V.sum()
    jj = (gg // 4) % 3; hh = gg % 4
    party = np.array(["Democrat", "Republican", "Independent"])[jj]
    appr = np.where(side == 1, "Approve", np.where(side == -1, "Disapprove", "Neutral"))
    age = np.array(["18 to 29", "30 to 44", "45 to 64", "65+"])[gg // 96]
    def comp(Vx):
        out = {}
        for nm, lab in (("Party", party), ("Trump approval", appr), ("Age", age)):
            out[nm] = {k: round(100 * float(Vx[:, lab == k].sum() / Vx.sum()), 2) for k in pd.unique(lab)}
        return out
    base_c = comp(V)
    M = shock_matrix(L, side, beta)
    scen = []
    def run(name, dlt):
        Vx = pops * inv(lt + dlt)
        c = comp(Vx)
        mv = {cat: {k: round(c[cat][k] - base_c[cat][k], 2) for k in c[cat]} for cat in c}
        scen.append(dict(scenario=name, margin=round(margin(Vx), 2), margin_change=round(margin(Vx) - base_m, 2),
                         turnout_change_pct=round(100 * (Vx.sum() / base_T - 1), 1), composition_change=mv))
    # a uniform 15 percent drop, falling hardest on the least likely voters because it acts in log odds
    lo, hi = -3.0, 0.0
    for _ in range(40):
        m = (lo + hi) / 2
        lo, hi = (lo, m) if (pops * inv(lt + m)).sum() > 0.85 * base_T else (m, hi)
    run("Turnout 15 percent lower", (lo + hi) / 2)
    run("Everyone in the file votes", np.full_like(lt, 8.0))
    for k, nm in enumerate(SHOCKS):
        run(f"{nm} matters more", 2 * KAPPA_NAT * M[:, k][None, :])
        run(f"{nm} matters less", -2 * KAPPA_NAT * M[:, k][None, :])
    # reasons: each factor's lift to the electorate's turnout log odds over the adult population, and by group
    contrib = L * beta[None, :]                                                    # [K, 6] log odds
    def mean_w(w): return (w.sum(0)[:, None] * contrib).sum(0) / max(w.sum(), 1e-9)
    lift = mean_w(V) - mean_w(pops)
    reasons = {f: round(float(v), 3) for f, v in zip(FACTORS, lift)}
    groups = []
    for pa in ("Democrat", "Republican", "Independent"):
        for ap in ("Approve", "Neutral", "Disapprove"):
            m = (party == pa) & (appr == ap)
            if not m.any(): continue
            Vg = V[:, m]; Pg = pops[:, m]
            if Vg.sum() / V.sum() < 0.01: continue
            c = (Vg.sum(0)[:, None] * contrib[m]).sum(0) / Vg.sum()
            order = np.argsort(-c)
            groups.append(dict(group=f"{pa}, {ap.lower()}s" if ap != "Neutral" else f"{pa}, no opinion of Trump",
                               share_of_voters=round(100 * float(Vg.sum() / V.sum()), 1),
                               turnout=round(100 * float(Vg.sum() / Pg.sum()), 1),
                               democratic_share=round(100 * float((Vg * p[:, m]).sum() / Vg.sum()), 1),
                               top_reasons=[FACTORS[i] for i in order[:2]],
                               reason_lift={FACTORS[i]: round(float(c[i]), 3) for i in order[:3]},
                               looseness=round(float((Vg.sum(0) * lam[m]).sum() / Vg.sum()), 3)))
    loose = float((V.sum(0) * lam).sum() / V.sum())
    return dict(baseline_two_party_margin=round(base_m, 2), electorate=base_c, reasons_lift_log_odds=reasons, groups=groups,
                scenarios=scen, electorate_looseness=round(loose, 3))


def audit_meta():
    return dict(factors=FACTORS, weights=None if "beta" not in _C else {f: round(float(b), 3) for f, b in zip(FACTORS, _C["beta"])},
                fit_correlation=_C.get("fit_r"), respondents=_C.get("n_fit"), shock_kappa_national=KAPPA_NAT, shock_kappa_state=KAPPA_ST,
                looseness_overall=_C.get("lam_all"),
                looseness_by_party_history={f"{['D','R','I'][k[0]]}|{['both','2022 only','2024 only','neither'][k[1]]}": {kk: round(vv, 3) if isinstance(vv, float) else vv for kk, vv in v.items()}
                                            for k, v in (_C.get("lam_jh") or {}).items()})


def state_rho(sw_e):
    """Correlation of a state's Senate and governor state level shocks from the share of its electorate that switched
    party between the 2024 vote and the 2026 generic ballot: a fully partisan electorate moves both races together,
    a looser one lets them part. At the national switching rate of about 7 percent the two races share 0.79."""
    return float(np.clip(1.0 - 3.0 * sw_e, 0.5, 0.92))


def group_shock_matrix(sm, reg):
    """House districts simulate 384 groups with no approval split: [384, 7] shock loadings from each group's donors,
    with approval intensity carried separately by the group's approvers and its disapprovers."""
    import voters as vf
    r = vf.prep(sm); S = scores(r); beta = fit(sm, r)
    IDX, W, _ = vf.donors(sm, reg)
    base = np.einsum("gd,gdf->gf", W, S[IDX])
    appr = np.asarray(r.appr.astype(str).tolist(), dtype=object)[IDX]
    iA = (W * (appr == "Approve") * S[IDX][:, :, 3]).sum(1); iD = (W * (appr == "Disapprove") * S[IDX][:, :, 3]).sum(1)
    b = beta
    return np.column_stack([base[:, 0] * b[0], base[:, 1] * b[1], base[:, 2] * b[2], base[:, 4] * b[4], base[:, 5] * b[5],
                            iA * b[3], iD * b[3]])
