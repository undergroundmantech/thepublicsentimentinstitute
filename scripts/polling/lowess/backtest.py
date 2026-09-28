import json, numpy as np, pandas as pd, sys
sys.path.insert(0, "."); from lowess import lowess; from series import series
D = json.load(open("polls.json"))
rows = []
for agg in D:
    t0, x, y = series(agg)
    if x is None or len(x) < 12: continue
    for h in (14, 28, 42):
        for c in np.arange(x.min() + 60, x.max() - h + 0.01, 7.0):
            past = x <= c
            if past.sum() < 8: continue
            win = (x >= c + h - 7) & (x <= c + h + 7)
            if win.sum() < 3: continue
            xp, yp = x[past], y[past]
            e = {f: lowess(xp, yp, f, 3, grid=np.array([xp.max()]))[1][0] for f in (0.30, 0.45, 0.60)}
            rows.append(dict(agg=agg["id"], cat=agg["category"], h=h, n=int(past.sum()), target_raw=float(np.median(y[win])),
                             L30=e[0.30], L45=e[0.45], L60=e[0.60], last_poll=yp[-1], mean_all=yp.mean()))
R = pd.DataFrame(rows); R.to_csv("bt2.csv", index=False)
# true Election Day endpoints: 2024 president and 2025 governor, target = median of the final 14 days of polls
E = []
for agg in D:
    if agg["category"] not in ("2024 President", "2025 Governor"): continue
    t0, x, y = series(agg)
    if x is None or len(x) < 15: continue
    eday = x.max()
    target = float(np.median(y[x >= eday - 14]))
    for h in (21, 35, 42, 56):
        past = x <= eday - h
        if past.sum() < 8: continue
        xp, yp = x[past], y[past]
        e = {f: lowess(xp, yp, f, 3, grid=np.array([xp.max()]))[1][0] for f in (0.30, 0.45, 0.60)}
        E.append(dict(agg=agg["id"], h=h, n=int(past.sum()), target=target, L30=e[0.30], L45=e[0.45], L60=e[0.60], last_poll=yp[-1]))
pd.DataFrame(E).to_csv("bt_eday.csv", index=False)
