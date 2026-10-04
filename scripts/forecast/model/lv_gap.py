"""Measured likely voter adjustment, Oct 3 2026.

Some polls publish both a likely voter and a registered voter result from the same interviews. The difference between
the two, in log odds of the Democratic two party share, is how this cycle's likely electorate differs from registered
voters. It is measured from every 2026 Senate and governor poll on file that reports both, shrunk toward zero with a
prior spread of 2.5 points of margin (the gap was about 0 in 2018 and 3.5 points toward Republicans in 2022), and added
to polls that report registered voters only. Polls that report likely voters are untouched.

LV_ADJ=0 turns it off. The fit is written to lv_gap_2026.json each time this file is run.
"""
import json, os, re
import numpy as np, pandas as pd

BASE = os.path.dirname(os.path.abspath(__file__))
ON = os.environ.get("LV_ADJ", "1") != "0"
FILE = os.path.join(BASE, "lv_gap_2026.json")
PRIOR_PTS = 2.5

def pairs_2026(sm):
    import site_poll_sync as sps
    rows = []
    for st, cfg in sm.STATES.items():
        frames = []
        if cfg.get("polls_csv"):
            frames.append(pd.read_csv(f"{sm.PKG[st]}/{cfg['polls_csv']}"))
        ex = list(sm.EXTRA_POLLS.get(st) or []) + list(sps.SITE_SYNC.get(st) or [])
        if ex: frames.append(pd.DataFrame(ex))
        if not frames: continue
        p = pd.concat(frames, ignore_index=True)
        if "pop" not in p or "D" not in p: continue
        p["race"] = st
        rows.append(p[["race", "source", "dates", "pop", "D", "R"]])
    A = pd.concat(rows, ignore_index=True)
    A["pop"] = A["pop"].replace({"V": "RV", "A": "RV"})
    _k = lambda s: re.sub(r"[^a-z0-9]", "", str(s).lower())
    A["k"] = A.source.map(_k) + "|" + A.dates.map(_k) + "|" + A.race
    out = []
    for k, x in A.groupby("k"):
        if {"LV", "RV"} <= set(x["pop"]):
            lv = x[x["pop"] == "LV"].iloc[0]; rv = x[x["pop"] == "RV"].iloc[0]
            out.append(dict(race=lv.race, source=lv.source, dates=lv.dates,
                            gap=float(np.log(lv.D / lv.R) - np.log(rv.D / rv.R))))
    return pd.DataFrame(out)

def fit(Q):
    n = len(Q)
    if n < 3: return dict(n_pairs=n, raw_gap=None, gap=0.0)
    m, v = float(Q.gap.mean()), float(Q.gap.var())
    t2 = (PRIOR_PTS / 50.0) ** 2
    shrink = n * t2 / (n * t2 + v)
    return dict(n_pairs=n, raw_gap=m, raw_gap_pts=m * 50, se_pts=float(np.sqrt(v / n)) * 50, shrink=shrink,
                gap=m * shrink, gap_pts=m * shrink * 50)

_FIT = None
def load():
    global _FIT
    if _FIT is None and os.path.exists(FILE):
        _FIT = json.load(open(FILE))
    return _FIT

def apply(p):
    """Add the measured gap to registered voter only polls, D + R held fixed. Returns a copy."""
    f = load()
    if not ON or not f or not f.get("gap") or len(p) == 0 or "pop" not in p: return p
    p = p.copy()
    rv = (p["pop"] != "LV").values
    T = p.D.astype(float) + p.R.astype(float)
    d2 = (p.D.astype(float) / T).clip(1e-4, 1 - 1e-4)
    z = np.log(d2 / (1 - d2)) + np.where(rv, f["gap"], 0.0)
    d2n = 1 / (1 + np.exp(-z))
    p["lv_gap"] = np.where(rv, f["gap"], 0.0)
    p["D"], p["R"] = T * d2n, T * (1 - d2n)
    return p

if __name__ == "__main__":
    import sys
    sys.path.insert(0, BASE)
    os.environ.setdefault("AS_OF", "2026-10-03")
    import senate_mode as sm
    Q = pairs_2026(sm)
    f = fit(Q); f["as_of"] = os.environ["AS_OF"]
    json.dump(f, open(FILE, "w"), indent=1)
    Q.to_csv(os.path.join(BASE, "lv_gap_pairs_2026.csv"), index=False)
    print(json.dumps(f, indent=1))
