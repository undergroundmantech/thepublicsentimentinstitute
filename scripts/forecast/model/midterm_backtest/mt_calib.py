"""Fix 1: calibrate the statewide poll weight and shock sizes on 2018 and 2022, fit on one cycle, scored on the other.

Inputs: mt_races.csv from mt_data.py. Everything is in log odds of the Democratic two party share.
Prints the live settings' scores next to the calibrated ones and writes mt_calib.json.
"""
import json, math, os
import numpy as np, pandas as pd
from scipy.stats import norm
from scipy.optimize import minimize

HERE = os.path.dirname(os.path.abspath(__file__))
L = lambda p: np.log(p / (1 - p))
d = pd.read_csv(f"{HERE}/mt_races.csv")
d["y"] = L(d.actual_d2)
d["poll"] = L(d.poll_d2.clip(0.02, 0.98))
d["has_poll"] = d.n_polls > 0
d["gov"] = (d.office == "governor").astype(float)

# ── live blend, replicated from senate_mode.py and candidate.py ────────────────────────────────────────────────
PROX = [(180.0, 0.48, 0.28), (60.0, 0.68, 0.36), (21.0, 0.83, 0.44)]
FUND_BOOST, RAMP_LO, RAMP_HI = 0.05, 1.0, 8.0
K_POLL, POLL_CAP, POLL_N0 = 0.5, 0.12, 4.0
def prox(days):
    if days >= PROX[0][0]: return PROX[0][1], PROX[0][2]
    if days <= PROX[-1][0]: return PROX[-1][1], PROX[-1][2]
    for (d0, h0, l0), (d1, h1, l1) in zip(PROX, PROX[1:]):
        if d1 <= days <= d0:
            f = (d0 - days) / (d0 - d1); return h0 + f * (h1 - h0), l0 + f * (l1 - l0)
def live_w3(x, days):
    hi, lo = prox(days); hi -= FUND_BOOST; lo -= FUND_BOOST
    f = min(max((x - RAMP_LO) / (RAMP_HI - RAMP_LO), 0.0), 1.0)
    return lo + f * (hi - lo)
def live_level(r, fund):
    if not r.has_poll: return fund
    w3 = live_w3(r.houses, r.days_out)
    a = r.n_polls / (r.n_polls + POLL_N0)
    f2 = fund + float(np.clip(K_POLL * a * (r.poll - fund), -POLL_CAP, POLL_CAP))
    return w3 * r.poll + (1 - w3) * f2
# the live simulation's statewide spread, measured from the Oct 3 run's 2,000 simulations of each race (logit sd):
# about 0.145 with no polls, 0.12 with polls but under one fresh house, 0.114 with one house or more; it does not
# narrow as election day nears
def live_sd(r):
    return 0.145 if not r.has_poll else (0.12 if r.houses < 1 else 0.114)

# ── fundamentals proxy: presidential lean, national environment, incumbency, fit by office ──────────────────────
def fit_fund(tr):
    t = tr[tr.days_out == tr.days_out.max()]
    X = np.c_[np.ones(len(t)), t.lean, t.nat, t.inc, t.open_party, t.gov * t.lean, t.gov * t.inc, t.gov]
    # the national environment enters at a fixed coefficient of 1 (two cycles cannot identify it)
    yy = t.y - t.nat
    Xr = np.delete(X, 2, axis=1)
    lam = np.diag([0, 0, 1, 1, 1, 1, 1]) * 2.0
    b = np.linalg.solve(Xr.T @ Xr + lam, Xr.T @ yy)
    return b
def pred_fund(b, t):
    Xr = np.c_[np.ones(len(t)), t.lean, t.inc, t.open_party, t.gov * t.lean, t.gov * t.inc, t.gov]
    return Xr @ b + t.nat

# ── candidate blend: effective poll weight w(x) = w0 + (w1 - w0) * ramp(x), by horizon ─────────────────────────
def ramp(x): return np.clip((x - RAMP_LO) / (RAMP_HI - RAMP_LO), 0, 1)
def cal_level(t, fund, w):
    w0, w1 = w
    ww = w0 + (w1 - w0) * ramp(t.houses.values)
    return np.where(t.has_poll, ww * t.poll.values + (1 - ww) * fund, fund)
def fit_w(t, fund):
    best = None
    for w0 in np.linspace(0, 1, 41):
        for w1 in np.linspace(0, 1, 41):
            if w1 < w0: continue
            e = t.y.values - cal_level(t, fund, (w0, w1)); s = (e[t.has_poll.values] ** 2).sum()
            if best is None or s < best[0]: best = (s, w0, w1)
    return best[1:]

# ── spread: total sd = sqrt(nat^2 + state(x)^2), state by poll bucket ──────────────────────────────────────────
def bucket(t):
    return np.where(~t.has_poll, 0, np.where(t.houses < 1, 1, np.where(t.houses < 4, 2, 3)))
def fit_sd(t, e):
    b = bucket(t); grp = (t.cycle.astype(str) + t.office).values
    # national: the cycle and office mean miss, net of its own sampling noise
    gm = pd.Series(e).groupby(grp).agg(["mean", "var", "size"])
    nat2 = max(float((gm["mean"] ** 2).mean() - (gm["var"] / gm["size"]).mean()), 0.0)
    out = {}
    for k in range(4):
        m = b == k
        if m.sum() < 4: continue
        out[k] = float(math.sqrt(max(np.mean(e[m] ** 2) - nat2, 1e-4)))
    return math.sqrt(nat2), out

def score(y, mu, sd):
    pw = norm.cdf(mu / sd); win = (y > 0).astype(float)
    z = (y - mu) / sd
    return dict(n=int(len(y)), brier=float(np.mean((pw - win) ** 2)),
                logloss=float(-np.mean(win * np.log(np.clip(pw, 1e-6, 1)) + (1 - win) * np.log(np.clip(1 - pw, 1e-6, 1)))),
                cover50=float(np.mean(np.abs(z) < 0.6745)), cover80=float(np.mean(np.abs(z) < 1.2816)),
                cover95=float(np.mean(np.abs(z) < 1.96)), mae_pts=float(np.mean(np.abs(200 * (1 / (1 + np.exp(-y)) - 1 / (1 + np.exp(-mu)))))),
                calls=float(np.mean(np.sign(mu) == np.sign(y))),
                nll=float(-np.mean(norm.logpdf(y, mu, sd))))

res = dict(by_horizon={})
for H in sorted(d.days_out.unique(), reverse=True):
    rows = []
    out = dict(folds={})
    for test in (2018, 2022):
        tr = d[(d.cycle != test)]; te = d[(d.cycle == test) & (d.days_out == H)].copy()
        trH = tr[tr.days_out == H].copy()
        b = fit_fund(tr)
        fte = pred_fund(b, te); ftr = pred_fund(b, trH)
        live_mu = np.array([live_level(r, f) for r, f in zip(te.itertuples(), fte)])
        live_s = np.array([live_sd(r) for r in te.itertuples()])
        w = fit_w(trH, ftr)
        e_tr = trH.y.values - cal_level(trH, ftr, w)
        nat, st = fit_sd(trH, e_tr)
        cal_mu = cal_level(te, fte, w)
        bk = bucket(te)
        cal_s = np.array([math.sqrt(nat ** 2 + st.get(k, max(st.values())) ** 2) for k in bk])
        te["live_mu"], te["live_sd"], te["cal_mu"], te["cal_sd"], te["fund"] = live_mu, live_s, cal_mu, cal_s, fte
        rows.append(te)
        out["folds"][int(test)] = dict(fund_coef=[round(float(x), 4) for x in b], poll_weight=dict(w_at_1_house=w[0], w_at_8_houses=w[1]),
                                     sd_nat=round(nat, 4), sd_state={int(k): round(v, 4) for k, v in st.items()})
    T = pd.concat(rows)
    out["live"] = score(T.y.values, T.live_mu.values, T.live_sd.values)
    out["calibrated"] = score(T.y.values, T.cal_mu.values, T.cal_sd.values)
    out["live_level_cal_sd"] = score(T.y.values, T.live_mu.values, T.cal_sd.values)
    P = T[T.has_poll]
    out["polled_only"] = dict(live=score(P.y.values, P.live_mu.values, P.live_sd.values),
                              calibrated=score(P.y.values, P.cal_mu.values, P.cal_sd.values),
                              poll_alone=score(P.y.values, P.poll.values, P.cal_sd.values),
                              fund_alone=score(P.y.values, P.fund.values, P.cal_sd.values))
    # pooled fit on both cycles for the values the live model takes
    dH = d[d.days_out == H].copy(); b = fit_fund(d); fH = pred_fund(b, dH); w = fit_w(dH, fH)
    e = dH.y.values - cal_level(dH, fH, w); nat, st = fit_sd(dH, e)
    # the live blend's own errors and the spread they imply, the like for like check on the live shock sizes
    lm = np.array([live_level(r, f) for r, f in zip(dH.itertuples(), fH)]); el = dH.y.values - lm
    natL, stL = fit_sd(dH, el)
    out["pooled"] = dict(fund_coef=[round(float(x), 4) for x in b], w_at_1_house=w[0], w_at_8_houses=w[1], sd_nat=round(nat, 4),
                         sd_state={int(k): round(v, 4) for k, v in st.items()},
                         sd_total={int(k): round(math.sqrt(nat ** 2 + v ** 2), 4) for k, v in st.items()},
                         live_blend_sd_total={int(k): round(math.sqrt(natL ** 2 + v ** 2), 4) for k, v in stL.items()},
                         live_blend_sd_nat=round(natL, 4),
                         bucket_counts={int(k): int((bucket(dH) == k).sum()) for k in range(4)},
                         mean_miss_by_cycle_office={k: round(float(v) * 100, 2) for k, v in pd.Series(e).groupby((dH.cycle.astype(str) + dH.office).values).mean().items()})
    T.to_csv(f"{HERE}/mt_scored_{H}d.csv", index=False)
    res["by_horizon"][int(H)] = out

json.dump(res, open(f"{HERE}/mt_calib.json", "w"), indent=1)
for H, o in res["by_horizon"].items():
    print(f"\n=== {H} days out ===")
    for k in ("live", "calibrated", "live_level_cal_sd"):
        s = o[k]; print(f"{k:18s} n={s['n']} brier={s['brier']:.4f} logloss={s['logloss']:.4f} nll={s['nll']:.3f} c50={s['cover50']:.2f} c80={s['cover80']:.2f} c95={s['cover95']:.2f} mae={s['mae_pts']:.2f} calls={s['calls']:.3f}")
    for k, s in o["polled_only"].items():
        print(f"  polled {k:12s} n={s['n']} brier={s['brier']:.4f} mae={s['mae_pts']:.2f} c80={s['cover80']:.2f} nll={s['nll']:.3f}")
    print(" folds", json.dumps(o["folds"]))
    print(" pooled", json.dumps(o["pooled"]))
