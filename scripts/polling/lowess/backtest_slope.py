import json, numpy as np, pandas as pd, sys, itertools
sys.path.insert(0, "."); from lowess import lowess; from series import series
D = json.load(open("polls.json"))
FR = (0.30, 0.45, 0.60)
rows = []
for agg in D:
    t0, x, y = series(agg)
    if x is None or len(x) < 12: continue
    # target: the full data balanced trend at the horizon date
    for h in (14, 28, 42):
        last = x.max()
        for c in np.arange(x.min() + 60, last - h + 0.01, 7.0):
            past = x <= c
            if past.sum() < 8: continue
            fut = (x > c) & (x <= c + h + 7)
            if fut.sum() < 2 or x[x > c].min() > c + h: continue     # the target needs real polls near c+h
            xp, yp = x[past], y[past]
            ends = {}
            for f in FR:
                _, g, _ = lowess(xp, yp, f, 3, grid=np.array([xp.max() - 14, xp.max()]))
                ends[f] = (g[1], (g[1] - g[0]) / 14.0)
            # target from all polls through c+h+7 only, evaluated at c+h
            sel = x <= c + h + 7
            _, gt, _ = lowess(x[sel], y[sel], 0.45, 3, grid=np.array([c + h]))
            gap = c + h - xp.max()
            rows.append(dict(agg=agg["id"], cat=agg["category"], h=h, gap=gap, n=int(past.sum()), target=gt[0],
                             L30=ends[0.30][0], L45=ends[0.45][0], L60=ends[0.60][0],
                             S30=ends[0.30][1], S45=ends[0.45][1], S60=ends[0.60][1], last_poll=yp[-1]))
R = pd.DataFrame(rows); R.to_csv("bt.csv", index=False)
print(len(R), "forecast points from", R.agg.nunique(), "aggregates;", R.groupby("h").size().to_dict())
