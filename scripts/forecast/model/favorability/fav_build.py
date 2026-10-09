"""Combine the researched favorability and approval readings into one net rating per candidate, then test on the 2026
cross section whether the D minus R net rating explains each race's candidate gap: the polls against the model's own
fundamentals, net of the national environment."""
import pandas as pd, numpy as np, json, glob
RR = "/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad/rerun"
F = pd.concat([pd.read_csv(f, dtype=str) for f in sorted(glob.glob("/tmp/fav/fav_*.csv"))], ignore_index=True)
for c in ("favorable", "unfavorable", "n"): F[c] = pd.to_numeric(F[c], errors="coerce")
F["end"] = pd.to_datetime(F.end_date, errors="coerce")
F["race"] = F.race.str.strip().str.split().str[0].str.upper(); F["party"] = F.party.str.strip().str.upper(); F["metric"] = F.metric.str.strip().str.lower()
F.to_csv(f"{RR}/favorability/favorability_readings_2026.csv", index=False)
ok = F.favorable.notna() & F.unfavorable.notna() & (F.end >= "2026-01-01")
G = F[ok].copy(); G["net"] = G.favorable - G.unfavorable
asof = pd.Timestamp("2026-10-03")
G["age"] = (asof - G.end).dt.days
# a reading counts more when recent (60 day half life), among likely voters, and as a favorability rating rather than job approval
G["wt"] = 0.5 ** (G.age / 60) * np.where(G["pop"].str.upper() == "LV", 1.0, 0.8) * np.where(G.metric == "fav", 1.0, 0.7)
# a reading from a campaign, party or partisan sponsored poll counts 0.7 and moves 1.5 points of net rating against the
# sponsor's side for each candidate, the same treatment partisan ballot polls get; bipartisan pairs such as AARP's are not partisan
_pl = G.pollster.fillna("")
_bip = _pl.str.contains("AARP|bipartisan", case=False) | (_pl.str.contains(r"\bR\b") & _pl.str.contains(r"\bD\b"))
_spD = (~_bip) & _pl.str.contains(r"\(D|D\)|Data for Progress|Andrews campaign", case=True, regex=True)
_spR = (~_bip) & (_pl.str.contains(r"\(R|R;|R\)", case=True, regex=True) | _pl.str.contains("Risch campaign|Sullivan Q1|Drazan campaign", case=False, regex=True))
G["partisan"] = np.where(_spD, "D", np.where(_spR, "R", ""))
G.loc[G.partisan != "", "wt"] *= 0.7
G.loc[(G.partisan == "D") & (G.party != "R"), "net"] -= 1.5; G.loc[(G.partisan == "D") & (G.party == "R"), "net"] += 1.5
G.loc[(G.partisan == "R") & (G.party == "R"), "net"] -= 1.5; G.loc[(G.partisan == "R") & (G.party != "R"), "net"] += 1.5
print(G[G.partisan != ""][["race", "candidate", "pollster", "partisan", "net"]].to_string())
def side(p): return "R" if p == "R" else "D"     # an independent running as the anti Republican candidate sits on the D side
G["side"] = G.party.map(side)
net = G.groupby(["race", "side"]).apply(lambda g: pd.Series(dict(net=np.average(g.net, weights=g.wt), readings=len(g), latest=g.end.max().date().isoformat())))
net = net.reset_index()
P = net.pivot(index="race", columns="side", values="net")
P["netdiff"] = P.get("D") - P.get("R")
R = json.load(open("/tmp/fc_v60/run_summary.json"))["results"]
rows = []
for k, r in R.items():
    c = r.get("candidate") or {}
    if k in P.index and np.isfinite(P.loc[k, "netdiff"]):
        rows.append(dict(race=k, netdiff=float(P.loc[k, "netdiff"]), gap=c.get("poll_gap"), n=r.get("n_polls", 0)))
T = pd.DataFrame(rows).dropna()
T["w"] = T.n / (T.n + 4.0)
x, y, w = T.netdiff.values, T.gap.values, T.w.values
b = float(np.sum(w * x * y) / np.sum(w * x * x))
r = float(np.corrcoef(x, y)[0, 1])
# leave one race out: predict each race's candidate gap from its net rating with the slope fit on the rest
pred = np.array([np.sum(np.delete(w * x * y, i)) / np.sum(np.delete(w * x * x, i)) * x[i] for i in range(len(x))])
mae0 = float(np.sum(w * np.abs(y)) / w.sum()); mae1 = float(np.sum(w * np.abs(y - pred)) / w.sum())
res = dict(races=int(len(T)), slope_logit_per_net_point=b, corr=r, loo_mae_no_term=mae0, loo_mae_with_term=mae1,
           slope_per_10_net_points_in_margin_pts=round(b * 10 * 50, 2))
print(json.dumps(res, indent=1))
print(T.assign(pred=pred).round(3).sort_values("netdiff").to_string(index=False))
json.dump(dict(fit=res, net={k: dict(D=(None if pd.isna(v.get("D")) else float(v.get("D"))), R=(None if pd.isna(v.get("R")) else float(v.get("R"))),
          netdiff=(None if pd.isna(v.get("netdiff")) else float(v.get("netdiff")))) for k, v in P.iterrows()},
          readings=net.to_dict(orient="records")), open(f"{RR}/favorability/favorability_fit.json", "w"), indent=1, default=str)
