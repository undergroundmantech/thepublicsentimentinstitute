"""Make every Senate and governor county map add up to its race's published vote.

patch_sweep moves each county by its own change between two runs and ev_adjust recentres its own correction, so after
many publishes a state's counties no longer sum to the race total on the page; Texas showed D +1.4 on the race and D +1.2
on the map. This rakes each race's county candidate shares, weighted by each county's projected votes, so the Democratic
and Republican shares hit the race's votes exactly and every other candidate keeps their share of the remaining vote,
then rebuilds each county's votes and margin. Candidate percentages on the race are set from the same totals, which also
clears stale third candidate shares. Run after patch_sweep and ev_adjust, before sync_site_numbers.
usage: python3 -I reconcile_counties.py PUBLIC_FORECAST_DIR"""
import json, sys
import numpy as np
PUB = sys.argv[1]
M = json.load(open(f"{PUB}/model.json")); C = json.load(open(f"{PUB}/counties.json"))
log = []
for r in M["races"]:
    if r["office"] not in ("senate", "governor") or not r.get("votes") or r["id"] not in C: continue
    cc = C[r["id"]]; keys = [f for f in cc if not f.startswith("_")]
    if not keys: continue
    rows = [cc[f] for f in keys]; T = np.array([float(v[3]) for v in rows])
    has = all(len(v) > 4 for v in rows)
    # some maps carry only the two party votes: read them as Democrat, Republican and everyone else
    P = np.array([v[4] for v in rows] if has else [[100 * v[1] / max(v[3], 1), 100 * v[2] / max(v[3], 1), max(0.0, 100 - 100 * (v[1] + v[2]) / max(v[3], 1))] for v in rows], dtype=float)
    if P.ndim != 2 or (T <= 0).all(): continue
    P = P / np.maximum(P.sum(1, keepdims=True), 1e-9) * 100
    big = int(np.argmax(T)); dshare, rshare = 100 * rows[big][1] / T[big], 100 * rows[big][2] / T[big]
    jd, jr = (int(np.argmin(np.abs(P[big] - dshare))), int(np.argmin(np.abs(P[big] - rshare)))) if has else (0, 1)
    # the county votes are what patch_sweep and ev_adjust keep current; the share vector is not always moved with them,
    # so the two main shares come from the votes and the other candidates split what is left in their stored proportions
    if has:
        dv0 = np.array([100 * v[1] / max(v[3], 1) for v in rows]); rv0 = np.array([100 * v[2] / max(v[3], 1) for v in rows])
        restj = [j for j in range(P.shape[1]) if j not in (jd, jr)]
        left = np.clip(100 - dv0 - rv0, 0, None); rs = P[:, restj].sum(1) if restj else np.zeros(len(rows))
        P[:, jd], P[:, jr] = dv0, rv0
        for j in restj: P[:, j] = np.where(rs > 0, left * P[:, j] / np.maximum(rs, 1e-9), left / len(restj))
    if jd == jr: log.append((r["id"], "could not tell the two main slots apart, skipped")); continue
    v = r["votes"]; tot = float(v["total"])
    w = T / T.sum(); cur = w @ P
    tgt = cur.copy(); tgt[jd] = 100 * v["dem"] / tot; tgt[jr] = 100 * v["rep"] / tot
    rest = [j for j in range(P.shape[1]) if j not in (jd, jr)]
    oth = 100 - tgt[jd] - tgt[jr]
    if rest:
        s = cur[rest].sum()
        for j in rest: tgt[j] = oth * cur[j] / s if s > 0 else oth / len(rest)
    before = float(w @ (P[:, jr] - P[:, jd]))
    Q = P.copy()
    for _ in range(200):
        k = tgt / np.maximum(w @ Q, 1e-12); Q = Q * k; Q = Q / Q.sum(1, keepdims=True) * 100
        if np.abs(w @ Q - tgt).max() < 1e-7: break
    for i, f in enumerate(keys):
        row = cc[f]; t = T[i]
        dv = t * Q[i, jd] / 100; rv = t * Q[i, jr] / 100
        row[1] = int(round(dv)); row[2] = int(round(rv)); row[0] = round(100 * (rv - dv) / t, 2) if t > 0 else row[0]
        if has: row[4] = [round(x, 1) for x in Q[i]]
    # candidate percentages on the race page, in the same slot order as the county shares
    if has and r.get("cands") and len(r["cands"]) == len(tgt):
        for j, c in enumerate(r["cands"]): c["pct"] = round(float(tgt[j]), 2)
    after = float(w @ (Q[:, jr] - Q[:, jd]))
    log.append((r["id"], round(before, 2), round(after, 2), round(100 * (v["rep"] - v["dem"]) / tot, 2)))
json.dump(C, open(f"{PUB}/counties.json", "w"), separators=(",", ":"))
json.dump(M, open(f"{PUB}/model.json", "w"), separators=(",", ":"))
moved = [x for x in log if len(x) == 4 and abs(x[1] - x[2]) >= 0.05]
print(len(log), "races checked;", len(moved), "county maps moved by 0.05 points or more")
for x in sorted(moved, key=lambda x: -abs(x[1] - x[2]))[:15]: print(" ", x[0], "map", x[1], "now", x[2], "race votes", x[3])
for x in log:
    if len(x) != 4: print(" ", x)
