"""Midterm county calibration, Oct 2 2026.

The 2024 backtest found that every county adjustment the model made beyond a uniform swing from the last presidential
result made the counties worse, and that the 2026 model spread counties far wider than any midterm since 2018, with
Hispanic counties in Florida and Texas moving the opposite way from every recent midterm. This module measures, from
certified results only, how counties actually move between a presidential election and the next midterm:

  1. Midterm differential. For every state and every statewide Senate or governor race in 2018 and 2022, each county's
     lean relative to its state is compared with its lean in the presidential election two years before. That relative
     swing is fit on county demographics: Hispanic share in four region groups, Black share in and outside the South,
     Asian and other share, white college share, all college share and size. Fit on 2018 and checked on 2022, and the
     reverse; the persistence factor is how much of one midterm's fitted pattern showed up in the other.
  2. Trend. In 2022 the county's 2016 to 2020 presidential trend is added, so the carry of a presidential trend into
     the next midterm is measured, not assumed.
  3. Spread. What the demographics and the trend leave unexplained in each state's midterms, the turnout weighted
     standard deviation of the leftover relative swing, sets how far a forecast county may stray from its expected
     midterm pattern on the strength of anything else.

The forecast then builds each county as its 2024 presidential lean, plus the expected midterm differential and trend,
plus the candidate terms the model measures directly, plus the rest of what the model's three legs say, shrunk so its
spread does not exceed that state's measured midterm leftover. The statewide share is untouched.
"""
import os, sys, json, numpy as np, pandas as pd
BASE = os.path.dirname(os.path.abspath(__file__))
import county_demo as cdm
ON = os.environ.get("CALIB26", "1") != "0"
PATH = os.path.join(BASE, "calib26.json")
lg = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))
inv = lambda z: 1 / (1 + np.exp(-z))
SKIP = ("AK",)
_C = {}

def _rel(D, R, w):
    d = D / (D + R); ok = np.isfinite(d) & (D + R > 0)
    return lg(d) - lg(np.sum(w[ok] * d[ok]) / w[ok].sum())

def _ridge(X, y, w, lam=1.0):
    W = np.sqrt(w / w.mean()); A = X * W[:, None]
    return np.linalg.solve(A.T @ A + lam * np.eye(X.shape[1]), A.T @ (y * W))

def dataset(sm, keys, cache=None):
    rows = []; seen = set()
    for k in keys:
        st2 = k[:2]
        if st2 in SKIP: continue
        office = sm.STATES[k].get("office", "senate")
        try:
            S, years, fill = sm.history(k)
        except Exception:
            continue
        for y, py in ((2018, 2016), (2022, 2020)):
            if y not in S or (st2, y, office) in seen: continue
            g = S[y]; fl = [f for f in g.index if isinstance(f, str) and len(f) == 5]
            if len(fl) < 5: continue
            if fill.get(y, 0) > 0.05 * len(fl): continue
            P = sm.P16 if py == 2016 else sm.P20
            p = P.reindex(fl); g = g.reindex(fl)
            ok = (g.D + g.R > 0).values & (p.votes_dem + p.votes_gop > 0).values
            fl = list(np.array(fl)[ok]); g = g.reindex(fl); p = p.reindex(fl)
            w = (g.D + g.R).values.astype(float)
            ym = _rel(g.D.values.astype(float), g.R.values.astype(float), w)
            yp = _rel(p.votes_dem.values.astype(float), p.votes_gop.values.astype(float), w)
            tr = np.full(len(fl), np.nan)
            if y == 2022:
                p16 = sm.P16.reindex(fl)
                if (p16.votes_dem + p16.votes_gop > 0).all():
                    tr = yp - _rel(p16.votes_dem.values.astype(float), p16.votes_gop.values.astype(float), w)
            seen.add((st2, y, office))
            for i, f in enumerate(fl):
                rows.append(dict(f=f, st=st2, year=y, office=office, w=w[i], y=ym[i] - yp[i], tr=tr[i], rp=yp[i]))
    return pd.DataFrame(rows)

def _design(D):
    """Demographic contrasts centered within each race, so each race's statewide level drops out."""
    X = cdm.X(pd.Index(D.f)).values.astype(float)
    grp = (D.st + D.year.astype(str) + D.office).values
    for g_ in np.unique(grp):
        m = grp == g_; w = D.w.values[m]
        X[m] -= (X[m] * w[:, None]).sum(0) / w.sum()
    return X

def fit(sm, keys, lam=1.0):
    D = dataset(sm, keys)
    D = D[np.isfinite(D.y) & D.f.isin(cdm.table().index)].reset_index(drop=True)
    X = _design(D); yraw = D.y.values; w = D.w.values
    # A popular crossover candidate compresses the state: strong counties of either party swing against their lean.
    # That compression is a candidate effect the forecast measures for itself, so each race's compression slope on its
    # prior presidential lean is taken out before the demographic pattern is estimated.
    y = yraw.copy(); grp0 = (D.st + D.year.astype(str) + D.office).values; comp = {}
    for g_ in np.unique(grp0):
        m = grp0 == g_; x = D.rp.values[m]; ww = w[m]
        bslope = float(np.sum(ww * x * yraw[m]) / max(np.sum(ww * x * x), 1e-12)); y[m] = yraw[m] - bslope * x; comp[g_] = bslope
    cols = list(cdm.X(pd.Index(D.f[:1])).columns)
    a, b = (D.year == 2018).values, (D.year == 2022).values
    # trend term only where the 2016 to 2020 trend exists, centered within race
    t = D.tr.values.copy(); has_t = np.isfinite(t)
    grp = (D.st + D.year.astype(str) + D.office).values
    for g_ in np.unique(grp[has_t]):
        m = (grp == g_) & has_t; t[m] -= np.sum(t[m] * w[m]) / w[m].sum()
    t = np.where(has_t, t, 0.0)
    # 2022: demographics and trend together; 2018: demographics only
    Xb = np.column_stack([X[b], t[b]]); cb = _ridge(Xb, y[b], w[b], lam)
    ca = _ridge(X[a], y[a], w[a], lam)
    beta22, tau = cb[:-1], float(cb[-1])
    # out of sample persistence of the demographic midterm pattern, 2018 on 2022 and 2022 on 2018
    pa = X[b] @ ca; ka = float(np.sum(w[b] * pa * (y[b] - tau * t[b])) / np.sum(w[b] * pa ** 2))
    pb = X[a] @ beta22; kb = float(np.sum(w[a] * pb * y[a]) / np.sum(w[a] * pb ** 2))
    kappa = float(np.clip(0.5 * (ka + kb), 0.0, 1.0))
    beta = 0.5 * (ca + beta22)                                    # both midterms, equal weight
    # out of sample fit, each midterm predicted from the other
    pred = np.zeros(len(y)); pred[b] = kappa * (X[b] @ ca) + tau * t[b]; pred[a] = kappa * (X[a] @ beta22)
    # the spread a forecast may show beyond the expected pattern is what real midterms showed, compression included
    res = yraw - pred
    def wsd(v, ww): return float(np.sqrt(np.sum(ww * v ** 2) / ww.sum()))
    sd_nat = wsd(res, w)
    sig = {}
    for st2, g_ in D.assign(res=res).groupby("st"):
        n_r = g_.groupby(["year", "office"]).ngroups
        s_ = wsd(g_.res.values, g_.w.values)
        sig[st2] = float(np.sqrt((n_r * s_ ** 2 + 2 * sd_nat ** 2) / (n_r + 2)))       # two races' worth of shrink
    diag = dict(rows=int(len(D)), races=int(D.groupby(["st", "year", "office"]).ngroups), states=int(D.st.nunique()),
                kappa_2018_on_2022=ka, kappa_2022_on_2018=kb, tau_trend_into_midterm=tau,
                sd_relative_swing=wsd(y, w), sd_leftover_out_of_sample=sd_nat,
                share_explained_out_of_sample=float(1 - np.sum(w * res ** 2) / np.sum(w * yraw ** 2)),
                share_explained_net_of_compression=float(1 - np.sum(w * (y - pred) ** 2) / np.sum(w * y ** 2)),
                compression_slopes={k_: round(v_, 3) for k_, v_ in comp.items()},
                uniform_mae=float(np.sum(w * np.abs(yraw)) / w.sum()), calibrated_mae=float(np.sum(w * np.abs(res)) / w.sum()))
    C = dict(cols=cols, beta=list(map(float, beta)), kappa=kappa, tau=tau, sigma=sig, sigma_nat=sd_nat, diag=diag)
    json.dump(C, open(PATH, "w"), indent=1)
    _C.clear(); _C.update(C)
    return C

def load():
    if not _C and os.path.exists(PATH):
        _C.update(json.load(open(PATH)))
    return _C

def expected(fl, w, rel24, rel20):
    """Expected midterm relative swing from 2024 for each county: demographics times persistence, plus trend."""
    C = load(); w = np.asarray(w, float)
    X = cdm.X(pd.Index(fl), center_w=w).values
    dm = C["kappa"] * (X @ np.array(C["beta"]))
    tr = np.asarray(rel24, float) - np.asarray(rel20, float)
    tr = np.where(np.isfinite(tr), tr, 0.0)
    tr = tr - np.sum(w * tr) / w.sum()
    e = dm + C["tau"] * tr
    return e - np.sum(w * e) / w.sum(), dm, C["tau"] * tr

def apply(st, fl, d2, turnout, actual24, p20share, cand_rel=None):
    """County two party shares rebuilt as the 2024 lean, the expected midterm pattern, candidate terms and the rest of
    the model's own pattern at no more than the state's measured midterm spread. Returns new shares and an audit."""
    C = load()
    if not C: return d2, None
    w = np.asarray(turnout, float); d2 = np.clip(np.asarray(d2, float), 1e-4, 1 - 1e-4)
    a24 = np.clip(np.asarray(actual24, float), 1e-4, 1 - 1e-4); a20 = np.clip(np.asarray(p20share, float), 1e-4, 1 - 1e-4)
    cen = lambda x: x - np.sum(w * x) / w.sum()
    r_mod, r24, r20 = cen(lg(d2)), cen(lg(a24)), cen(lg(a20))
    exp_, dm, trm = expected(fl, w, r24, r20)
    cr = cen(np.asarray(cand_rel, float)) if cand_rel is not None else np.zeros(len(fl))
    dev = r_mod - r24 - exp_ - cr
    sd_ = lambda x: float(np.sqrt(np.sum(w * cen(x) ** 2) / w.sum()))
    sd_dev = sd_(dev)
    sig = C["sigma"].get(st[:2], C["sigma_nat"])
    # candidate terms the model measures directly stay whole; together with the rest of the model's pattern the county
    # spread beyond the expected midterm pattern may reach the state's measured midterm leftover, or the candidate
    # terms' own spread if that is larger
    tgt = max(sig, sd_(cr))
    lam = 1.0
    if sd_(cr + dev) > tgt:
        lo_, hi_ = 0.0, 1.0
        for _ in range(50):
            m_ = (lo_ + hi_) / 2
            lo_, hi_ = (m_, hi_) if sd_(cr + m_ * dev) < tgt else (lo_, m_)
        lam = (lo_ + hi_) / 2
    r_new = r24 + exp_ + cr + lam * dev
    target = float(np.sum(w * d2) / w.sum())
    lo, hi = -6.0, 6.0
    for _ in range(70):
        m = (lo + hi) / 2
        v = float(np.sum(w * inv(m + r_new)) / w.sum())
        lo, hi = (m, hi) if v < target else (lo, m)
    out = inv((lo + hi) / 2 + r_new)
    def spr(x): return float(np.sqrt(np.sum(w * cen(x) ** 2) / w.sum()))
    aud = dict(sigma_state=round(sig, 4), model_extra_spread=round(sd_dev, 4), shrink=round(lam, 4),
               expected_midterm_spread=round(spr(exp_), 4), candidate_spread=round(spr(cr), 4),
               swing_spread_before=round(spr(r_mod - r24), 4), swing_spread_after=round(spr(r_new - r24), 4),
               largest_county_moves_pts={str(fl[i]): round(float(100 * (out[i] - d2[i]) * 2), 2) for i in np.argsort(-np.abs(out - d2))[:3]})
    return out, aud

if __name__ == "__main__":
    os.environ.setdefault("APPROVAL_SRC", "combined")
    sys.path.insert(0, BASE)
    import senate_mode as sm
    keys = sorted(json.load(open(os.environ.get("KEYS_FROM", "/tmp/fc_v47/run_summary.json")))["results"])
    C = fit(sm, keys)
    print(json.dumps(C["diag"], indent=1))
    print(dict(zip(C["cols"], np.round(C["beta"], 3))), "kappa", round(C["kappa"], 3), "tau", round(C["tau"], 3))
    print({k: round(v, 3) for k, v in sorted(C["sigma"].items())})
