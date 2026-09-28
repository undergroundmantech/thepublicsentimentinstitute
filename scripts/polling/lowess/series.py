import json, re, numpy as np, pandas as pd
AVG = re.compile(r"\b(avg|average|aggregate|consensus)\b", re.I)
IMPUTED_HALF_FIELD = 1.5      # median field length on the site is 3 days
def series(agg):
    rows = []
    for p in agg["polls"]:
        if AVG.search(p["pollster"]) or p["a"] is None or p["b"] is None: continue
        end = pd.Timestamp(p["end"])
        mid = end - pd.Timedelta(days=IMPUTED_HALF_FIELD) if not p["start"] else pd.Timestamp(p["start"]) + (end - pd.Timestamp(p["start"])) / 2
        rows.append((mid, float(p["a"]) - float(p["b"])))
    rows.sort()
    if not rows: return None, None, None
    t0 = rows[0][0]
    x = np.array([(r[0] - t0).total_seconds() / 86400 for r in rows]); y = np.array([r[1] for r in rows])
    return t0, x, y
