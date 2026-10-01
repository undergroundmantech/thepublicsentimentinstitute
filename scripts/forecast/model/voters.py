"""TPSI Voter File Mode: a simulated voter file for every county, built from individual TPSI respondents.

Every adult in a county belongs to one of 384 groups: 32 ACS cells of age, race and college, times Democrats,
Republicans and independents, times four vote histories (Vote History Mode sets how many adults are in each group and
calibrates the histories to certified 2022 and 2024 turnout). Each group is filled with real TPSI respondents who share
its cell, party and vote history, so every simulated voter carries a full respondent profile: gender, income, ideology,
2024 vote, Trump approval, right or wrong track, economic strain, top issue, immigration opinion and the DSMeridian
likely voter score. Where a group has too few respondents, respondents who match it on race, college, party and history
are borrowed at a lower weight, then race, party and history, then party and history. Respondents from the state's
region count double.

For each simulated voter:
  * Turnout propensity is the group's 2026 turnout (the history transition, the DSMeridian likely voter composition,
    party enthusiasm, county primary turnout and competition, from Vote History Mode) moved by half of the voter's own
    DSMeridian score against the group's average, with one constant per county and group keeping that group's
    expected 2026 turnout, so the spread of individual scores never changes who the electorate is.
  * Trump approval is simulated from the TPSI county approval file. A ridge logistic model of approving against
    disapproving, on every other attribute, gives each voter a chance of approving; one county constant makes the
    county's likely voters reproduce the county's TPSI two way approval. A second model gives the chance of having no
    opinion.
  * Vote preference comes from a ridge logistic model of the TPSI generic ballot on every attribute, evaluated under
    each approval state and mixed by that voter's approval chances. Candidate effects from the primaries then move the
    voters of each party in each cell and county.
  * The county's party mix is solved so the simulated voters' own recalled 2024 votes reproduce the county's certified
    2024 presidential result.

The electorate is the voter file weighted by turnout propensity. Its preference feeds the approval leg, the
difference between the 2026 electorate and the 2024 electorate feeds the census leg, the election simulation draws
from it, and every race's crosstabs are read from it.
"""
import os, json, numpy as np, pandas as pd

MIN_DONORS, MAX_DONORS = 8, 24
REGION_W = 2.0
LEVEL_W = [1.0, 0.5, 0.25, 0.1]
LAM_OWN = 0.5
inv = lambda z: 1 / (1 + np.exp(-z))
lg = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))
_M = {}
_DON = {}
NATIONAL = {}          # county fips -> no candidate 2026 electorate preference, from vf_national.py
CACHE = os.environ.get("VF_CACHE", "/tmp/pvi/vf_national.csv")
APPR = ["Approve", "Neutral", "Disapprove"]

def _cat(s, levels, other=None):
    s = s.astype(object).where(s.notna(), other)
    return pd.Categorical(s, categories=levels)

def prep(sm):
    if "R" in _M: return _M["R"]
    r = sm.RESP.copy()
    r = r[(r.analysis_ready == 1) & r.age_band.notna() & r.race4.notna() & r.college.notna() & r.region8.notna() & r.party_id.notna()].reset_index(drop=True)
    r["k"] = [sm.AGE.index(a) * 8 + sm.RACE.index(b) * 2 + sm.COL.index(c) for a, b, c in zip(r.age_band, r.race4, r.college)]
    r["j"] = r.party_id.map({"Democrat": 0, "Republican": 1, "Independent": 2}).astype(int)
    v22, v24 = r.voted_2022.fillna(0).astype(int), r.voted_2024.fillna(0).astype(int)
    r["h"] = np.where((v22 == 1) & (v24 == 1), 0, np.where(v22 == 1, 1, np.where(v24 == 1, 2, 3)))
    PT = r.turnout_PT.values.astype(float)
    mu = 1.0 - float(np.percentile(PT, 60.0, method="hazen"))
    r["plv"] = np.clip(1.0 / (1.0 + np.exp(-12.0 * (PT - mu))), 0.01, 0.99)
    ap = r.trump_approve.fillna("Neutral / no opinion")
    r["appr"] = np.where(ap.str.contains("disapprove"), "Disapprove", np.where(ap.str.contains("approve"), "Approve", "Neutral"))
    r["appr_strong"] = ap.str.startswith("Strongly").astype(float)
    r["sex"] = np.where(r.gender == "Female", "Women", "Men")
    ide = r.ideology5.fillna("Unclassified")
    r["ide"] = ide.replace({"Unclassified": "Moderate"})
    r["recall"] = r.recall_2024.fillna("Did not vote")
    r["track"] = r.right_track.fillna("Not sure")
    r["econ"] = r.econ_strain.fillna("Not asked").replace({"Not sure": "Not asked"})
    top = ["Economy, Jobs & Cost of Living", "Healthcare, Social Security & Medicare", "Political Corruption, Lobbying & Money in Politics",
           "Immigration & Border Security", "Civil Rights, Personal Freedoms & Social Issues", "Energy, Climate & the Environment",
           "Crime, Public Safety & Policing"]
    r["issue"] = np.where(r.issue_top1.isin(top), r.issue_top1, "Other")
    r["deport"] = r.deport_mass.fillna("Not asked").replace({"Not sure / no opinion": "Not asked"})
    r["inc"] = r.income_band.fillna("$50k-$79k")
    _M["R"] = r; _M["mu"] = mu
    return r

BASE_F = [("age_band", ["18-29", "30-44", "45-64", "65+"]), ("race4", ["White", "Black", "Hispanic", "Asian/Other"]),
          ("college", ["NON-COLLEGE", "COLLEGE"]), ("sex", ["Men", "Women"]), ("region8", None),
          ("inc", ["$50k-$79k", "Under $25k", "$25k-$49k", "$80k-$124k", "$125k+"]),
          ("party_id", ["Independent", "Democrat", "Republican"]),
          ("ide", ["Moderate", "Very liberal", "Liberal", "Lean liberal", "Conservative", "Very conservative"]),
          ("recall", ["Did not vote", "Harris", "Trump", "Third party"]),
          ("track", ["Not sure", "Right track", "Wrong track"]),
          ("econ", ["Not asked", "Very difficult", "Somewhat difficult", "Not very difficult", "Not at all difficult"]),
          ("issue", ["Other", "Economy, Jobs & Cost of Living", "Healthcare, Social Security & Medicare", "Political Corruption, Lobbying & Money in Politics",
                     "Immigration & Border Security", "Civil Rights, Personal Freedoms & Social Issues", "Energy, Climate & the Environment", "Crime, Public Safety & Policing"]),
          ("deport", ["Not asked", "Strongly support", "Somewhat support", "Somewhat oppose", "Strongly oppose"])]

def base_X(r, regions):
    cols = [np.ones(len(r))]; names = ["const"]
    for f, lv in BASE_F:
        lv = lv or regions
        v = r[f].values
        for x in lv[1:]:
            cols.append((v == x).astype(float)); names.append(f"{f}={x}")
    return np.column_stack(cols), names

def appr_X(appr, strong, ind):
    """approval block: approve, disapprove (neutral base), strength, and each against independents"""
    A = (appr == "Approve").astype(float); D = (appr == "Disapprove").astype(float)
    return np.column_stack([A, D, A * strong, D * strong, A * ind, D * ind])

def _cv(X, y, w, ridge, sm, folds=5):
    rng = np.random.default_rng(7); idx = rng.permutation(len(y)); ll = 0.0; tw = 0.0
    for f in range(folds):
        te = idx[f::folds]; tr = np.setdiff1d(idx, te)
        b = sm.irls(X[tr], y[tr], w[tr], ridge=ridge)
        p = np.clip(inv(X[te] @ b), 1e-4, 1 - 1e-4)
        ll += float(-(w[te] * (y[te] * np.log(p) + (1 - y[te]) * np.log(1 - p))).sum()); tw += float(w[te].sum())
    return ll / tw

def fit(sm):
    if "pref" in _M: return _M
    r = prep(sm); regions = sorted(r.region8.unique())
    XB, names = base_X(r, regions)
    ind = (r.j == 2).values.astype(float)
    XA = appr_X(r.appr.values, r.appr_strong.values, ind)
    w = r.turnout_propensity.values.astype(float)
    m = r.gb_2way.notna().values; y = (r.gb_2way == "Democrat").values.astype(float)
    X = np.hstack([XB, XA])
    ridges = [1.0, 3.0, 10.0, 30.0]
    cv = {rg: _cv(X[m], y[m], w[m], rg, sm) for rg in ridges}
    rp = min(cv, key=cv.get)
    b = sm.irls(X[m], y[m], w[m], ridge=rp)
    # the model the crosstabs used before, for comparison on the same folds
    import crosstabs as xt_old
    Xo = xt_old.X_of(xt_old.R); mo = xt_old.R.gb_2way.notna().values
    cv_old = _cv(Xo[mo], (xt_old.R.gb_2way[mo] == "Democrat").values.astype(float), xt_old.LV[mo], 2.0, sm)
    # approval: approve against disapprove, and no opinion against any opinion, on every attribute but approval
    ma = r.appr.values != "Neutral"
    ya = (r.appr.values == "Approve").astype(float)
    cva = {rg: _cv(XB[ma], ya[ma], w[ma], rg, sm) for rg in ridges}; ra = min(cva, key=cva.get)
    ba = sm.irls(XB[ma], ya[ma], w[ma], ridge=ra)
    yn = (r.appr.values == "Neutral").astype(float)
    bn = sm.irls(XB, yn, w, ridge=10.0)
    nb = XB.shape[1]
    # each respondent's preference logit under each approval state; strength set to the respondent's own
    s_ = r.appr_strong.values
    lp = {}
    for st_ in APPR:
        XA_ = appr_X(np.full(len(r), st_), s_ if st_ != "Neutral" else np.zeros(len(r)), ind)
        lp[st_] = np.hstack([XB, XA_]) @ b
    la = XB @ ba; pn = np.clip(inv(XB @ bn), 0.005, 0.6)
    _M.update(pref=b, ridge_pref=rp, cv_pref=cv, cv_old=cv_old, appr=ba, ridge_appr=ra, cv_appr=cva, neutral=bn,
              names=names + ["approve", "disapprove", "approve strongly", "disapprove strongly", "approve x independent", "disapprove x independent"],
              lpA=lp["Approve"], lpN=lp["Neutral"], lpD=lp["Disapprove"], la=la, pn=pn, regions=regions, n=len(r), n_pref=int(m.sum()))
    return _M

def _cell_terms(b, names, age, race, col):
    nm = {n: i for i, n in enumerate(names)}
    v = np.zeros(len(age))
    for f, vals in (("age_band", age), ("race4", race), ("college", col)):
        for i, x in enumerate(vals):
            j = nm.get(f"{f}={x}")
            if j is not None and j < len(b): v[i] += b[j]
    return v

def cell_contrib(sm):
    """Each respondent's age, race and college part of the preference and approval logits, and the same for each of the
    32 cells, so a respondent borrowed into a group of another age, race or college takes on the group's traits."""
    if "cc" in _M: return _M["cc"]
    M = fit(sm); r = prep(sm)
    k = np.arange(32); A = [sm.AGE[i // 8] for i in k]; R_ = [sm.RACE[(i // 2) % 4] for i in k]; Cc = [sm.COL[i % 2] for i in k]
    out = dict(pref_r=_cell_terms(M["pref"], M["names"], r.age_band.values, r.race4.values, r.college.values),
               pref_k=_cell_terms(M["pref"], M["names"], A, R_, Cc),
               appr_r=_cell_terms(M["appr"], M["names"], r.age_band.values, r.race4.values, r.college.values),
               appr_k=_cell_terms(M["appr"], M["names"], A, R_, Cc),
               neut_r=_cell_terms(M["neutral"], M["names"], r.age_band.values, r.race4.values, r.college.values),
               neut_k=_cell_terms(M["neutral"], M["names"], A, R_, Cc))
    _M["cc"] = out
    return out

def group_logits(sm, IDX):
    """[G, D] preference logits under each approval state, approval logit and no opinion chance, with the group's own
    age, race and college in place of the borrowed respondent's."""
    M = fit(sm); cc = cell_contrib(sm)
    kk = np.repeat(np.arange(32), 12)[:, None]
    dp = cc["pref_k"][kk] - cc["pref_r"][IDX]; da = cc["appr_k"][kk] - cc["appr_r"][IDX]; dn = cc["neut_k"][kk] - cc["neut_r"][IDX]
    lpA, lpN, lpD = M["lpA"][IDX] + dp, M["lpN"][IDX] + dp, M["lpD"][IDX] + dp
    la = M["la"][IDX] + da
    pn = np.clip(inv(lg(M["pn"][IDX]) + dn), 0.005, 0.6)
    return lpA, lpN, lpD, la, pn

def donors(sm, reg):
    """For one region: per group g = (cell, party, history), respondent indices and weights, padded to MAX_DONORS."""
    if reg in _DON: return _DON[reg]
    r = prep(sm)
    k, j, h = r.k.values, r.j.values, r.h.values
    race = k // 2 % 4; col = k % 2
    regw = np.where(r.region8.values == reg, REGION_W, 1.0)
    rng = np.random.default_rng(abs(hash(reg)) % (2 ** 31))
    IDX = np.zeros((384, MAX_DONORS), int); W = np.zeros((384, MAX_DONORS)); LEV = np.zeros(384)
    for kk in range(32):
        rr, cc = kk // 2 % 4, kk % 2
        for jj in range(3):
            for hh in range(4):
                g = kk * 12 + jj * 4 + hh
                masks = [(k == kk) & (j == jj) & (h == hh), (race == rr) & (col == cc) & (j == jj) & (h == hh),
                         (race == rr) & (j == jj) & (h == hh), (j == jj) & (h == hh)]
                sel, ww = [], []
                seen = np.zeros(len(r), bool)
                for lvl, mk in enumerate(masks):
                    ids = np.where(mk & ~seen)[0]
                    sel.extend(ids); ww.extend(regw[ids] * LEVEL_W[lvl]); seen[ids] = True
                    if len(sel) >= MIN_DONORS: LEV[g] = lvl; break
                sel = np.array(sel); ww = np.array(ww, float)
                if len(sel) > MAX_DONORS:
                    keep = rng.choice(len(sel), MAX_DONORS, replace=False, p=ww / ww.sum()); sel, ww = sel[keep], np.ones(MAX_DONORS)
                IDX[g, :len(sel)] = sel; W[g, :len(sel)] = ww / ww.sum()
    _DON[reg] = (IDX, W, LEV)
    return _DON[reg]

def recall_fractions(sm, reg):
    """[32, 3, 4] share of each group's donors who recall Harris and who recall Trump."""
    r = prep(sm); IDX, W, _ = donors(sm, reg)
    har = (r.recall.values == "Harris").astype(float)[IDX]; tru = (r.recall.values == "Trump").astype(float)[IDX]
    return (W * har).sum(1).reshape(32, 3, 4), (W * tru).sum(1).reshape(32, 3, 4)

def county_approval(sm, fl):
    app, dis, noop, cal = sm.calibrated_approval(fl)
    two = (app / (app + dis)).values.astype(float)
    return np.where(np.isfinite(two), two, np.nanmean(two))

def solve(fn, target, n, lo=-8.0, hi=8.0, it=50):
    lo = np.full(n, float(lo)); hi = np.full(n, float(hi))
    for _ in range(it):
        mid = (lo + hi) / 2; up = fn(mid) < target
        lo = np.where(up, mid, lo); hi = np.where(up, hi, mid)
    return (lo + hi) / 2

def build_file(sm, st, fl, reg, pop4, lt, cv=None, ct=None, geo_v=None, geo_t=None):
    """pop4 [C,32,3,4] adults, lt [C,32,3,4] group turnout log odds. cv, ct [32,3] candidate vote and turnout shifts by
    cell and party; geo_v, geo_t [C,3] candidate home county vote and turnout shifts by party. Returns the voter file arrays."""
    M = fit(sm); r = prep(sm)
    IDX, W, LEV = donors(sm, reg)
    C = pop4.shape[0]; G = 384
    w = pop4.reshape(C, G)[:, :, None] * W[None]                                   # [C, G, D] adults per voter record
    own = lg(r.plv.values)[IDX]
    own = own - (W * own).sum(1, keepdims=True)
    lt_g = lt.reshape(C, G).copy()
    kk = np.repeat(np.arange(32), 12); jj = np.tile(np.repeat(np.arange(3), 4), 32); hh = np.tile(np.arange(4), 96)
    if ct is not None: lt_g = lt_g + ct[kk, jj][None]
    if geo_t is not None: lt_g = lt_g + geo_t[:, jj]
    ltr = lt_g[:, :, None] + LAM_OWN * own[None]
    # the spread of individual scores is centered in turnout, not in log odds: one constant per county and group keeps
    # every group's expected turnout exactly at its Vote History Mode rate. Centering in log odds alone would lift low
    # turnout groups, young and irregular voters above all, because a symmetric spread raises the mean of a small chance
    tgt = inv(lt_g)
    Wd = W[None]
    c_g = solve(lambda z: (Wd * inv(ltr + z.reshape(C, G)[:, :, None])).sum(2).ravel(), tgt.ravel(), C * G, -4, 4, 40).reshape(C, G)
    ltr = ltr + c_g[:, :, None]
    c_t = c_g.mean(1)
    t = inv(ltr)
    lpA_g, lpN_g, lpD_g, la, pn = group_logits(sm, IDX)
    target = county_approval(sm, fl)
    wt = w * t * (1 - pn[None])
    c_a = solve(lambda z: (wt * inv(la[None] + z[:, None, None])).sum((1, 2)) / np.maximum(wt.sum((1, 2)), 1e-9), target, C, -6, 6, 45)
    pa = inv(la[None] + c_a[:, None, None])
    x = np.zeros((C, G))
    if cv is not None: x = x + cv[kk, jj][None]
    if geo_v is not None: x = x + geo_v[:, jj]
    lpA, lpN, lpD = lpA_g, lpN_g, lpD_g
    pA = inv(lpA[None] + x[:, :, None]); pN = inv(lpN[None] + x[:, :, None]); pD = inv(lpD[None] + x[:, :, None])
    p = pn[None] * pN + (1 - pn[None]) * (pa * pA + (1 - pa) * pD)
    return dict(w=w, t=t, ltr=ltr, pa=pa, pn=np.broadcast_to(pn[None], w.shape), p=p, x=x, IDX=IDX, W=W, LEV=LEV, c_a=c_a, c_t=c_t, lpA=lpA, lpN=lpN, lpD=lpD,
                approval_target=target, kk=kk, jj=jj, hh=hh)

def electorate_pref(F, HP):
    """2026 electorate and 2024 electorate Democratic share of the two party vote, per county."""
    w, t, p = F["w"], F["t"], F["p"]
    e26 = (w * t * p).sum((1, 2)) / np.maximum((w * t).sum((1, 2)), 1e-9)
    hp = HP[F["hh"]][None, :, None]
    e24 = (w * hp * p).sum((1, 2)) / np.maximum((w * hp).sum((1, 2)), 1e-9)
    return e26, e24

def collapse(F, C):
    """Group level turnout and preference [C,32,3,4] log odds, and sim records split by approval state [C, 1152]."""
    w, t, p, pa, pn = F["w"], F["t"], F["p"], F["pa"], F["pn"]
    IDX = F["IDX"]
    x = F["x"]
    lpA, lpN, lpD = F["lpA"], F["lpN"], F["lpD"]
    wt = w * t
    Tg = wt.sum(2) / np.maximum(w.sum(2), 1e-12)
    Vg = (wt * p).sum(2) / np.maximum(wt.sum(2), 1e-12)
    recs = []
    for s_, pr_, lp_ in (("A", (1 - pn) * pa, lpA), ("N", pn, lpN), ("D", (1 - pn) * (1 - pa), lpD)):
        ww = w * pr_; wwt = ww * t
        pop = ww.sum(2); tt = wwt.sum(2) / np.maximum(pop, 1e-12)
        vv = (wwt * inv(lp_[None] + x[:, :, None])).sum(2) / np.maximum(wwt.sum(2), 1e-12)
        recs.append((pop, tt, vv))
    pop = np.concatenate([a for a, _, _ in recs], 1); tt = np.concatenate([b for _, b, _ in recs], 1); vv = np.concatenate([c for _, _, c in recs], 1)
    return (lg(Tg).reshape(C, 32, 3, 4), lg(Vg).reshape(C, 32, 3, 4), dict(pop=pop, lt=lg(np.clip(tt, 1e-5, 1 - 1e-5)),
            eta=lg(np.clip(vv, 1e-5, 1 - 1e-5)), g=np.tile(np.arange(384), 3), appr=np.repeat(np.array(["Approve", "Neutral", "Disapprove"]), 384)))

def load_national():
    if NATIONAL: return NATIONAL
    if os.path.exists(CACHE):
        d = pd.read_csv(CACHE, dtype={"f": str}).set_index("f")
        NATIONAL.update(d.e26.to_dict())
    return NATIONAL

def summary():
    M = _M
    return dict(respondents=M.get("n"), respondents_with_ballot=M.get("n_pref"), ridge_pref=M.get("ridge_pref"),
                cv_logloss_pref=M.get("cv_pref"), cv_logloss_previous_crosstab_model=M.get("cv_old"),
                ridge_approval=M.get("ridge_appr"), cv_logloss_approval=M.get("cv_appr"))

def _minor_g(pty, j):
    if pty == "D": return np.array([3.0, 0.3, 1.0])[j]
    if pty == "R": return np.array([0.3, 3.0, 1.0])[j]
    return np.array([1.0, 1.0, 2.5])[j]

def crosstab(sm, Lh, ix, tshift, dshare, rname, rshare, thirds, votes, zband=None):
    """Estimated exit poll for one race, read from its simulated electorate. Each county's voters are weighted by their
    simulated turnout, minor candidates' county shares go to voters by party, and one preference constant per county
    makes the voters reproduce the county's projected result, so every crosstab adds up to the published forecast."""
    M = _M; r = prep(sm); F = Lh["F"]
    w = F["w"][ix]; ltr = F["ltr"][ix]; pa = F["pa"][ix]; pn = F["pn"][ix]; x = F["x"][ix]; IDX = F["IDX"]
    C, G, D = w.shape
    u = w * inv(ltr + tshift[:, None, None])
    u = u * (np.asarray(votes, float) / np.maximum(u.sum((1, 2)), 1e-9))[:, None, None]
    jj = np.tile(np.repeat(np.arange(3), 4), 32); hh = np.tile(np.arange(4), 96)
    om_k = []
    for nm, pty, sh in thirds:
        g = _minor_g(pty, jj)[None, :, None] * np.ones_like(u)
        c = np.asarray(sh, float) * u.sum((1, 2)) / np.maximum((u * g).sum((1, 2)), 1e-12)
        om_k.append(np.clip(c[:, None, None] * g, 0, 0.9))
    om = np.clip(sum(om_k), 0, 0.95) if om_k else np.zeros_like(u)
    if om_k:
        f = om / np.maximum(sum(om_k), 1e-12); om_k = [o * f for o in om_k]
    dtot = sum(np.asarray(v, float) for v in dshare.values())
    q = np.clip(dtot / np.maximum(dtot + np.asarray(rshare, float), 1e-9), 1e-4, 1 - 1e-4)
    lpA, lpN, lpD = F["lpA"][None] + x[:, :, None], F["lpN"][None] + x[:, :, None], F["lpD"][None] + x[:, :, None]
    import bounds as _bd
    if _bd.ON:
        _glo, _ghi = _bd.type_bands(sm, np.arange(G))
        GLO = np.tile(_glo[None, :, None], (C, 1, 1)); GHI = np.tile(_ghi[None, :, None], (C, 1, 1))
    def pref(z):
        zz = _bd.softclip(z[:, None, None], GLO, GHI) if _bd.ON else z[:, None, None]
        return pn * inv(lpN + zz) + (1 - pn) * (pa * inv(lpA + zz) + (1 - pa) * inv(lpD + zz))
    u2 = u * (1 - om)
    def _fitz():
        for _wid in range(6):
            z = solve(lambda z_: (u2 * pref(z_)).sum((1, 2)) / np.maximum(u2.sum((1, 2)), 1e-9), q, C, -8, 8, 45)
            bad = np.abs((u2 * pref(z)).sum((1, 2)) / np.maximum(u2.sum((1, 2)), 1e-9) - q) > 5e-4
            if not _bd.ON or not bad.any(): break
            GLO[bad] *= 1.5; GHI[bad] *= 1.5
        return z
    z = _fitz()
    race_aud = None
    if _bd.ON:
        # statewide floors and ceilings for Black, Hispanic and Asian and other voters (bounds.race_limits)
        _bd.race_limits(sm)
        _rg = np.array(sm.RACE)[((np.arange(G) // 12) // 2) % 4]
        lp0 = (lpA.copy(), lpN.copy(), lpD.copy())
        def _shares(kap):
            nonlocal lpA, lpN, lpD, z
            off = np.array([kap.get(x, 0.0) for x in _rg])[:, None]
            lpA, lpN, lpD = lp0[0] + off, lp0[1] + off, lp0[2] + off
            z = _fitz(); P = pref(z)
            return {x: float((u2[:, _rg == x] * P[:, _rg == x]).sum() / max(u2[:, _rg == x].sum(), 1e-9)) for x in sm.RACE}
        _kap, race_aud = _bd.enforce_race(_rg, _shares)
    zz = _bd.softclip(z[:, None, None], GLO, GHI) if _bd.ON else z[:, None, None]
    clipz = (lambda z_: _bd.softclip(z_[:, None, None], GLO, GHI)) if _bd.ON else (lambda z_: z_[:, None, None])
    frac = {nm: (np.asarray(v, float) / np.maximum(dtot, 1e-12))[:, None, None] for nm, v in dshare.items()}
    names = list(dshare) + [rname] + [nm for nm, _, _ in thirds]
    def votes_of(pD):
        out = [(1 - om) * pD * frac[nm] for nm in dshare] + [(1 - om) * (1 - pD)] + list(om_k)
        return out
    V_all = votes_of(pref(z))
    err = float(np.max(np.abs((u2 * pref(z)).sum((1, 2)) / u2.sum((1, 2)) - q)))
    A = lambda col: np.asarray(r[col].astype(str).tolist())[IDX][None]
    ide = A("ide"); inc = A("inc"); sex = A("sex")
    # age, race and college are the group's own, since a borrowed respondent takes on the group's cell
    kk = np.repeat(np.arange(32), 12)
    GC = lambda arr: np.broadcast_to(np.asarray(arr)[kk][None, :, None], (1, G, D))
    race = GC([sm.RACE[(k // 2) % 4] for k in range(32)]); col = GC([sm.COL[k % 2] for k in range(32)])
    age_g = GC([sm.AGE[k // 8] for k in range(32)])
    ad = Lh["popc"][ix].sum(1)
    size = np.where(ad >= 250_000, "Large, 250K+ adults", np.where(ad >= 50_000, "Midsize, 50K to 250K", "Small, under 50K"))[:, None, None]
    lab_race = np.where(race == "Hispanic", "Latino", np.where(race == "Asian/Other", "Asian and other", race))
    defs = [
        ("Gender", sex, ["Men", "Women"]),
        ("Age", np.char.replace(age_g, "-", " to "), ["18 to 29", "30 to 44", "45 to 64", "65+"]),
        ("Race", lab_race, ["White", "Black", "Latino", "Asian and other"]),
        ("Race and gender", np.where(race == "White", np.char.add("White ", np.char.lower(sex)), np.where(race == "Black", np.char.add("Black ", np.char.lower(sex)),
                            np.where(race == "Hispanic", np.char.add("Latino ", np.char.lower(sex)), "All other races"))),
         ["White men", "White women", "Black men", "Black women", "Latino men", "Latino women", "All other races"]),
        ("Education", np.where(col == "COLLEGE", "College graduate", "No college degree"), ["College graduate", "No college degree"]),
        ("Race and education", np.where(race == "White", np.where(col == "COLLEGE", "White college graduates", "White, no college degree"),
                                        np.where(col == "COLLEGE", "Nonwhite college graduates", "Nonwhite, no college degree")),
         ["White college graduates", "White, no college degree", "Nonwhite college graduates", "Nonwhite, no college degree"]),
        ("Income", np.where(np.isin(inc, ["Under $25k", "$25k-$49k"]), "Under $50K", np.where(np.isin(inc, ["$50k-$79k", "$80k-$124k"]), "$50K to $124K", "$125K and up")),
         ["Under $50K", "$50K to $124K", "$125K and up"]),
        ("Party ID", np.broadcast_to(np.array(["Democrat", "Republican", "Independent"])[jj][None, :, None], (1, G, D)), ["Democrat", "Republican", "Independent"]),
        ("Ideology", np.where(np.isin(ide, ["Very liberal", "Liberal", "Lean liberal"]), "Liberal", np.where(np.isin(ide, ["Conservative", "Very conservative"]), "Conservative", "Moderate")),
         ["Liberal", "Moderate", "Conservative"]),
        ("2024 presidential vote", np.where(A("recall") == "Harris", "Harris", np.where(A("recall") == "Trump", "Trump", "Other or did not vote")), ["Harris", "Trump", "Other or did not vote"]),
        ("Direction of the country", A("track"), ["Right track", "Wrong track"]),
        ("Affording daily costs", np.where(np.isin(A("econ"), ["Very difficult", "Somewhat difficult"]), "Difficult", np.where(np.isin(A("econ"), ["Not very difficult", "Not at all difficult"]), "Not difficult", "Not asked")),
         ["Difficult", "Not difficult"]),
        ("Top issue", np.where(A("issue") == "Economy, Jobs & Cost of Living", "Economy and cost of living", np.where(A("issue") == "Healthcare, Social Security & Medicare", "Health care and Social Security",
                       np.where(A("issue") == "Immigration & Border Security", "Immigration", np.where(A("issue") == "Political Corruption, Lobbying & Money in Politics", "Corruption", "Something else")))),
         ["Economy and cost of living", "Health care and Social Security", "Immigration", "Corruption", "Something else"]),
        ("Vote history", np.broadcast_to(np.array(["Voted in 2022 and 2024", "Voted in 2022, not 2024", "Voted in 2024, not 2022", "New or irregular voter"])[hh][None, :, None], (1, G, D)),
         ["Voted in 2022 and 2024", "Voted in 2024, not 2022", "Voted in 2022, not 2024", "New or irregular voter"]),
        ("County size", np.broadcast_to(size, (C, 1, 1)), ["Large, 250K+ adults", "Midsize, 50K to 250K", "Small, under 50K"]),
    ]
    rows = []
    total = u.sum()
    def add(cat, label, mw, V, denom):
        tw = (u * mw).sum()
        if tw / total < 0.01: return
        rows.append([cat, label, round(100 * tw / denom, 1)] + [round(100 * float((u * mw * v).sum() / tw), 1) for v in V])
    add("All voters", "Total", 1.0, V_all, total)
    for cat, vals, order in defs:
        vals = np.broadcast_to(vals, u.shape) if vals.shape != u.shape else vals
        known = sum((u * (vals == lab)).sum() for lab in order)
        for lab in order:
            add(cat, lab, (vals == lab).astype(float), V_all, known)
    # approval is simulated for each voter, so its rows mix each voter's approval chances and the vote under each
    for lab, wa, lp in (("Approve", (1 - pn) * pa, lpA), ("Disapprove", (1 - pn) * (1 - pa), lpD)):
        Vs = votes_of(inv(lp + zz)); tw = (u * wa).sum()
        rows.append(["Trump job approval", lab, round(100 * tw / (u * (1 - pn)).sum(), 1)] + [round(100 * float((u * wa * v).sum() / tw), 1) for v in Vs])
    order_cat = [d[0] for d in defs[:10]] + ["Trump job approval"] + [d[0] for d in defs[10:]]
    rows.sort(key=lambda rr: -1 if rr[0] == "All voters" else order_cat.index(rr[0]))
    out = dict(cands=names, rows=rows, max_county_error=err, race_limits=race_aud,
               electorate_approval_two_way=float((u * (1 - pn) * pa).sum() / (u * (1 - pn)).sum()))
    if zband is not None:
        out["ranges"] = _ranges(u, defs, votes_of, pref, z, zband, len(dshare), lpA, lpD, pn, pa, sm, clipz)
    return out

def _ranges(u, defs, votes_of, pref, z, zband, nd, lpA, lpD, pn, pa, sm, clipz=None):
    """80 percent ranges for each group's Democratic and Republican share (Sept 29 2026).
    Two sources of uncertainty, combined in log odds:
      the race itself: every county's preference constant moves together by the state's 10th and 90th percentile
      simulated swing, so each group moves by its own sensitivity and every range stays consistent with the topline;
      the group estimate: a group holding share s of the electorate is read from about s x N TPSI respondents, where N
      is the respondent count after quality filters, giving a sampling spread of 1 / sqrt(s N p (1 - p)), plus the
      pooled state effect's own spread from respondent_v2."""
    import respondent_v2 as _rv
    N = max((_rv.AUDIT.get("load") or {}).get("rows_used", len(sm.RESP)), 1)
    total = u.sum()
    def table(zz_):
        V = votes_of(pref(zz_)); zzz = clipz(zz_) if clipz else zz_[:, None, None]; res = {}
        def put(cat, lab, mw, VV):
            tw = (u * mw).sum()
            if tw / total < 0.01: return
            dsh = float(sum((u * mw * v).sum() for v in VV[:nd]) / tw); rsh = float((u * mw * VV[nd]).sum() / tw)
            res[(cat, lab)] = (dsh, rsh, float(tw / total))
        put("All voters", "Total", 1.0, V)
        for cat, vals, order in defs:
            vals = np.broadcast_to(vals, u.shape) if vals.shape != u.shape else vals
            for lab in order: put(cat, lab, (vals == lab).astype(float), V)
        for lab, wa, lp in (("Approve", (1 - pn) * pa, lpA), ("Disapprove", (1 - pn) * (1 - pa), lpD)):
            put("Trump job approval", lab, wa, votes_of(inv(lp + zzz)))
        return res
    # zband holds the state's 10th and 90th percentile simulated two party shares. One common shift of every county's
    # preference constant is solved so the electorate as a whole lands on each, so every group moves by its own
    # sensitivity and the Total row reproduces the simulated range exactly.
    def _tot(dz):
        V = votes_of(pref(z + dz)); d = float(sum((u * v).sum() for v in V[:nd])); r = float((u * V[nd]).sum())
        return d / (d + r)
    def _shift(target):
        a, b = -4.0, 4.0
        for _ in range(22):
            m = (a + b) / 2
            a, b = (m, b) if _tot(m) < target else (a, m)
        return (a + b) / 2
    mid, lo, hi = table(z), table(z + _shift(zband[0])), table(z + _shift(zband[1]))
    lg = lambda p: np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4)))
    sfx = float(np.median([v["sd"] for v in _rv.STATE_FX.values()])) if _rv.STATE_FX else 0.0
    out = []
    for key, (d, r, s) in mid.items():
        row = [key[0], key[1]]
        for j, p in enumerate((d, r)):
            a, b = lo[key][j], hi[key][j]
            sd_race = abs(lg(b) - lg(a)) / (2 * 1.2816)
            sd_grp = 0.0 if key[0] == "All voters" else 1 / np.sqrt(max(s * N * p * (1 - p), 1.0))
            sd = np.sqrt(sd_race ** 2 + sd_grp ** 2 + (0.0 if key[0] == "All voters" else sfx ** 2))
            row += [round(100 * float(inv(lg(p) - 1.2816 * sd)), 1), round(100 * float(inv(lg(p) + 1.2816 * sd)), 1)]
        out.append(row)
    return out

def race_lambda(sm, n0=100.0):
    """How far each race group's party identification moves with its county's partisanship, relative to white adults,
    from TPSI respondents: the slope of Democratic over Republican identification on the respondent's county 2024 vote,
    shrunk toward one by n / (n + 100) and held between 0.3 and 1. Used so a county's party mix moves each group by its
    own amount: a Black voter in a deep red county stays far more Democratic than a white voter there."""
    if "lam" in _M: return _M["lam"]
    r = sm.RESP.copy()
    f = pd.to_numeric(r.county_fips, errors="coerce"); r = r[f.notna()].copy(); r["f"] = f[f.notna()].astype(int).astype(str).str.zfill(5)
    p = sm.P24; a = (p.votes_dem / (p.votes_dem + p.votes_gop)); r["a24"] = r.f.map(a)
    r = r[r.a24.notna() & r.party_id.isin(["Democrat", "Republican"])]
    x = sm.logit(r.a24.clip(.02, .98)).values; y = (r.party_id == "Democrat").values.astype(float)
    sl = {}
    for race in sm.RACE:
        m = (r.race4 == race).values
        X = np.column_stack([np.ones(m.sum()), x[m]]); b = sm.irls(X, y[m], np.ones(m.sum()), ridge=0.1)
        sl[race] = (float(b[1]), int(m.sum()))
    w0 = sl["White"][0]
    lam = {}
    for race, (b, n) in sl.items():
        s = n / (n + n0); lam[race] = float(np.clip(s * (b / w0) + (1 - s), 0.3, 1.0)) if race != "White" else 1.0
    _M["lam"] = lam; _M["lam_raw"] = sl
    return lam

def cell_lambda(sm):
    lam = race_lambda(sm)
    return np.array([lam[sm.RACE[k // 2 % 4]] for k in range(32)])
