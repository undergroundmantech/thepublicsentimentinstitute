"""The 2026 accuracy report: the frozen November 3 forecast scored against the count.

  python3 scripts/accuracy/build_accuracy.py RESULTS_OUT LEG_RESULTS_OUT [REPO]

RESULTS_OUT is the results tool's output folder (results_vs_forecast.csv, counties_vs_forecast.csv) and LEG_RESULTS_OUT
the legislature tool's (leg_districts_vs_forecast.csv, leg_chambers_vs_forecast.csv). The forecast side always comes from
public/forecast/archive/final-2026-11-03, the frozen copy, so nothing published after Election Day can touch the grade.
Writes public/accuracy/2026.json, which /accuracy, /forecast/2026 and the home page read at build time. Rerun it after a
fresh results pull and commit the one file; the pages follow on the next deploy.

Margins are Republican minus Democratic points. Error is result minus forecast, so a negative error means Democrats ran
ahead of the forecast. Races still counting are scored on the current count and flagged.
"""
import json, os, sys, datetime as dt
import numpy as np, pandas as pd

RES, LEG = sys.argv[1], sys.argv[2]
REPO = sys.argv[3] if len(sys.argv) > 3 else os.getcwd()
FZ = os.path.join(REPO, "public", "forecast", "archive", "final-2026-11-03")
OUT = os.path.join(REPO, "public", "accuracy", "2026.json")
HERE = os.path.dirname(os.path.abspath(__file__))
r1 = lambda x, k=2: None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), k)

def mtime(p): return dt.datetime.fromtimestamp(os.stat(p).st_mtime, dt.timezone.utc)

# ---------------------------------------------------------------- federal races
M = json.load(open(os.path.join(FZ, "model.json")))
F = {r["id"]: r for r in M["races"]}
R = pd.read_csv(os.path.join(RES, "results_vs_forecast.csv"))
rows = []
for _, x in R.iterrows():
    f = F.get(x.id)
    if f is None: continue
    e = f["est"]
    ind = any(c.get("party") == "IND" and c.get("name") == f.get("dem") for c in f.get("cands") or [])
    rows.append(dict(id=x.id, ind=ind, office=f["office"], st=f["st"], d=int(f.get("district") or 0), name=f["name"], dem=f.get("dem"), gop=f.get("gop"),
                     fm=float(e["margin"]), p=float(e["prob"]), p10=e.get("p10"), p90=e.get("p90"),
                     act=float(x.actual_margin) if pd.notna(x.actual_margin) else np.nan, dv=x.d_votes, rv=x.r_votes, tot=x.total_votes,
                     dn=x.d_name, rn=x.r_name, pct=float(x.pct_reporting) if pd.notna(x.pct_reporting) else 0.0, status=x.status, leader=x.leader))
a = pd.DataFrame(rows)
a["excl"] = ""
a.loc[a.fm.abs() >= 99, "excl"] = "Uncontested in the forecast"
a.loc[(a.dv.fillna(0) == 0) | (a.rv.fillna(0) == 0), "excl"] = "One major party missing from the count"
a.loc[a.id.str.startswith("house-LA"), "excl"] = "Louisiana count lists several candidates per party"
a.loc[a.id == "gov-RI", "excl"] = "The main rival was an independent, not the Republican"
a.loc[a.id.isin(["sen-AK", "gov-AK", "house-AK-01"]), "excl"] = "Alaska first round count, ranked choice still to run"
a["fav"] = np.where(a.p >= 0.5, "R", "D")
# seat side: the count's leader, or the forecast's side where the count cannot say (one party, same party, open primary)
nocount = a.excl.isin(["Uncontested in the forecast", "One major party missing from the count", "Louisiana count lists several candidates per party"])
a["side"] = np.where(nocount | a.leader.isna(), a.fav, a.leader)
a["right"] = a.side == a.fav
a["err"] = a.act - a.fm
a["won_R"] = (a.side == "R").astype(int)
a["final"] = a.status == "called"
a["in80"] = (a.act >= a.p10) & (a.act <= a.p90)
sc = a[a.excl == ""]          # scored on margin and odds

def blk(h):
    if not len(h): return None
    pfav = np.maximum(h.p, 1 - h.p); won = np.where(h.p >= 0.5, h.won_R, 1 - h.won_R); pr = np.clip(h.p, 1e-4, 1 - 1e-4)
    return dict(n=int(len(h)), right=int(h.right.sum()), share=r1(h.right.mean() * 100, 1), bias=r1(h.err.mean()), mae=r1(h.err.abs().mean()),
                rmse=r1(np.sqrt((h.err ** 2).mean())), median_miss=r1(h.err.abs().median()), in80=r1(h.in80.mean() * 100, 1),
                brier=r1(((h.p - h.won_R) ** 2).mean(), 4), logloss=r1(-(h.won_R * np.log(pr) + (1 - h.won_R) * np.log(1 - pr)).mean(), 4),
                mean_fav=r1(pfav.mean() * 100, 1), fav_won=r1(won.mean() * 100, 1), d_ahead=int((h.err < 0).sum()), counting=int((~h.final).sum()))

off = {"senate": "Senate", "governor": "Governor", "house": "House"}
headline = {}
for o in off:
    g = a[a.office == o]; s = sc[sc.office == o]
    headline[o] = dict(races=int(len(g)), called_right=int(g.right.sum()), counting=int((~g.final).sum()), scored=blk(s), scored_final=blk(s[s.final]),
                       competitive=blk(s[s.fm.abs() < 10]))
headline["all"] = dict(races=int(len(a)), called_right=int(a.right.sum()), counting=int((~a.final).sum()), scored=blk(sc), scored_final=blk(sc[sc.final]),
                       competitive=blk(sc[sc.fm.abs() < 10]))

# chamber control
def seats(o, notD, notR):
    g = a[a.office == o]; return int(notD + (g.side == "D").sum()), int(notR + (g.side == "R").sum())
ch = M["chambers"]; meta = M["meta"]
chambers = {}
for o, notD, notR, maj in [("senate", meta["senNotUpD"], meta["senNotUpR"], 51), ("house", 0, 0, 218), ("governor", meta["govNotUpD"], meta["govNotUpR"], 26)]:
    c = ch[o]; dS, rS = seats(o, notD, notR)
    # the forecast's seat count is the called winners, the side ahead in each race's final margin, plus seats not up
    g = a[a.office == o]
    pD = int(notD + (g.fm < 0).sum()); pR = int(notR + (g.fm > 0).sum()); pI = int(((g.fm < 0) & g.ind).sum())
    fav = "D" if pD >= maj else ("R" if pR >= maj else ("D" if c["demControl"] >= 0.5 else "R"))
    ctrl = "D" if dS >= maj else ("R" if rS >= maj else "none")
    chambers[o] = dict(seats=int(c["seatsTotal"]), majority=maj, projD=pD, projR=pR, projI=pI, seat_err=dS - pD, demControl=r1(c["demControl"], 4), demSeats=r1(c["demSeats"], 2), median=c.get("median"),
                       p10=c.get("demP10"), p90=c.get("demP90"), actualD=dS, actualR=rS, control=ctrl, favorite=fav, right=ctrl == fav,
                       inside80=bool(c.get("demP10", -1) <= dS <= c.get("demP90", 999)), counting=int((~a[a.office == o].final).sum()),
                       hist=c.get("hist"))

# calibration on the published odds
def calib(p, won):
    p = np.asarray(p); won = np.asarray(won); fp = np.maximum(p, 1 - p); fw = np.where(p >= 0.5, won, 1 - won)
    edges = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 1.0001]; out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        k = (fp >= lo) & (fp < hi)
        if k.sum(): out.append(dict(lo=round(lo * 100), hi=min(100, round(hi * 100)), n=int(k.sum()), expected=r1(fp[k].mean() * 100, 1), won=r1(fw[k].mean() * 100, 1), upsets=int((fw[k] == 0).sum())))
    return out
cal_fed = calib(sc.p, sc.won_R)
hist = np.histogram(sc.err.clip(-30, 30), bins=np.arange(-30, 31, 2))
err_hist = dict(edges=[int(x) for x in hist[1]], counts={o: [int(v) for v in np.histogram(sc[sc.office == o].err.clip(-30, 30), bins=hist[1])[0]] for o in off})
bands = []
for lo, hi in [(0, 2), (2, 5), (5, 10), (10, 20), (20, 40), (40, 99)]:
    h = sc[(sc.fm.abs() >= lo) & (sc.fm.abs() < hi)]; b = blk(h)
    if b: bands.append(dict(lo=lo, hi=hi, **b))
states = {}
for s, g in sc[sc.office != "house"].groupby("st"):
    states[s] = dict(n=int(len(g)), bias=r1(g.err.mean()), races=[dict(id=x.id, err=r1(x.err)) for x in g.itertuples()])

races = [dict(id=x.id, ind=bool(x.ind), o=x.office, st=x.st, d=x.d, name=x.name, dem=x.dem, gop=x.gop, fm=r1(x.fm), p=r1(x.p, 4), p10=r1(x.p10), p90=r1(x.p90),
              act=r1(x.act), err=r1(x.err), pct=r1(x.pct, 0), fin=bool(x.final), side=x.side, fav=x.fav, right=bool(x.right), in80=bool(x.in80),
              dn=x.dn if isinstance(x.dn, str) else None, rn=x.rn if isinstance(x.rn, str) else None, excl=x.excl or None) for x in a.itertuples()]

# ---------------------------------------------------------------- counties
C = pd.read_csv(os.path.join(RES, "counties_vs_forecast.csv"))
T = pd.read_csv(os.path.join(HERE, "county_types.csv"))
skip = set(a[a.excl != ""].id)
c = C[~C.race.str.startswith("house") & ~C.race.isin(skip)]
c = c[(c.pct_reporting >= 95) & c.forecast_margin.abs().lt(99) & c.actual_total.gt(0)].merge(T, on="fips", how="left")
c["w"] = c.actual_total
c["race_err"] = c.groupby("race").error.transform(lambda e: np.average(e, weights=c.loc[e.index, "w"]))
c["shp"] = c.error - c.race_err          # the miss left after the statewide miss is taken out
def cblk(h):
    return dict(counties=int(len(h)), votes=int(h.w.sum()), mae=r1(h.error.abs().mean()), wmae=r1(np.average(h.error.abs(), weights=h.w)),
                bias=r1(np.average(h.error, weights=h.w)), shape_mae=r1(np.average(h.shp.abs(), weights=h.w)), within5=r1((h.error.abs() <= 5).mean() * 100, 1))
counties = dict(all=cblk(c), races=int(c.race.nunique()),
                area=[dict(k=k, **cblk(g)) for k, g in c.groupby("area")],
                region=[dict(k=k, **cblk(g)) for k, g in c.groupby("region8")],
                by_race=sorted([dict(id=k, **cblk(g)) for k, g in c.groupby("race")], key=lambda z: z["wmae"]),
                worst=[dict(race=x.race, county=x.county, st=x.race[4:6], fm=r1(x.forecast_margin), act=r1(x.actual_margin), err=r1(x.error), votes=int(x.w))
                       for x in c[c.w >= 20000].assign(ae=lambda z: z.error.abs()).sort_values("ae", ascending=False).head(15).itertuples()],
                hist=dict(edges=list(range(-20, 21, 2)), counts=[int(v) for v in np.histogram(c.error.clip(-20, 20), bins=np.arange(-20, 21, 2))[0]]))

# ---------------------------------------------------------------- state legislatures
d = pd.read_csv(os.path.join(LEG, "leg_districts_vs_forecast.csv")); L = pd.read_csv(os.path.join(LEG, "leg_chambers_vs_forecast.csv"))
ind = d.status.eq("independent challenger")
d["dside"] = d.d_votes.fillna(0) + np.where(ind, d.other_votes.fillna(0), 0); d["rv"] = d.r_votes.fillna(0); tot = d.total_votes.fillna(0)
d["am"] = np.where(tot > 0, (d.rv - d.dside) / tot.replace(0, np.nan) * 100, np.nan)
d["two"] = (d.dside > 0) & (d.rv > 0); d["fcont"] = d.forecast_margin.abs() < 99.9; d["scored"] = d.fcont & d.two
d["err"] = d.am - d.forecast_margin
sD = d.seats_D.fillna(0) + np.where(ind, d.seats_O.fillna(0), 0); sR = d.seats_R.fillna(0); sO = d.seats_O.fillna(0) * np.where(ind, 0, 1)
d["aside"] = np.select([sD > sR, sR > sD], ["D", "R"], "tie"); d.loc[(sD + sR + sO) == 0, "aside"] = None
d["right"] = (d.aside == d.forecast_party).where(d.aside.notna())
d["won_D"] = (d.aside == "D").astype(float).where(d.aside.isin(["D", "R"]))
d["fin"] = (d.pct_reporting >= 95) | ((d.pct_reporting == 0) & (tot > 0))
s = d[d.scored & d.won_D.notna()].copy()
def lblk(x):
    if not len(x): return None
    return dict(n=int(len(x)), right=int(x.right.sum()), share=r1(x.right.mean() * 100, 1), bias=r1(x.err.mean()), mae=r1(x.err.abs().mean()),
                brier=r1(((x.forecast_prob_d - x.won_D) ** 2).mean(), 4))
lb = []
for lo, hi in [(0, 2), (2, 5), (5, 10), (10, 20), (20, 40), (40, 100)]:
    b = lblk(s[(s.forecast_margin.abs() >= lo) & (s.forecast_margin.abs() < hi)])
    if b: lb.append(dict(lo=lo, hi=hi, **b))
ll = []
for lo, hi in [(-100, -40), (-40, -20), (-20, -10), (-10, -5), (-5, 0), (0, 5), (5, 10), (10, 20), (20, 40), (40, 100)]:
    b = lblk(s[(s.forecast_margin > lo) & (s.forecast_margin <= hi)])
    if b: ll.append(dict(lo=lo, hi=hi, **b))
s["st"] = s.chamber.str[3:5]
lst = sorted([dict(st=k, **lblk(g)) for k, g in s.groupby("st")], key=lambda z: z["bias"])
L = L.set_index("chamber")
seat = d.assign(D=sD, R=sR, O=sO).groupby("chamber")[["D", "R", "O"]].sum()
fseat = d.assign(fD=np.where(d.forecast_party == "D", d.seats.fillna(1), 0), fR=np.where(d.forecast_party == "R", d.seats.fillna(1), 0)).groupby("chamber")[["fD", "fR"]].sum()
L["cD"] = fseat.fD + L.holdover_D; L["cR"] = fseat.fR + L.holdover_R
L["aD"] = seat.D + L.holdover_D; L["aR"] = seat.R + L.holdover_R; L["aO"] = seat.O + L.holdover_O
L["miss"] = L.seats_missing.fillna(0) if "seats_missing" in L else 0
L["ctrl"] = np.select([L.aD >= L.majority, L.aR >= L.majority], ["D", "R"], "none")
L["fav"] = np.select([L.cD >= L.majority, L.cR >= L.majority], ["D", "R"], np.where(L.forecast_dem_control >= L.forecast_gop_control, "D", "R"))
L["favp"] = np.where(L.fav == "D", L.forecast_dem_control, L.forecast_gop_control)
by_ch = {k: lblk(g) for k, g in s.groupby("chamber")}
crow = []
for k, x in L.iterrows():
    settled = bool(x.miss == 0 and x.ctrl != "none")
    crow.append(dict(id=k, st=x.state, name=x["name"], seats=int(x.seats), up=int(x.up), majority=int(x.majority), fD=r1(x.forecast_dem_seats, 1), cD=int(x.cD), cR=int(x.cR), p10=r1(x.forecast_p10, 0), p90=r1(x.forecast_p90, 0),
                     pD=r1(x.forecast_dem_control, 4), fav=x.fav, favp=r1(x.favp, 4), aD=r1(x.aD, 0), aR=r1(x.aR, 0), aO=r1(x.aO, 0), missing=int(x.miss), ctrl=x.ctrl,
                     settled=settled, right=bool(settled and x.ctrl == x.fav), in80=bool(x.forecast_p10 <= x.aD <= x.forecast_p90) if x.miss == 0 else None,
                     seat_err=r1(x.aD - x.cD, 0) if x.miss == 0 else None, districts=by_ch.get(k)))
ok = [r for r in crow if r["missing"] == 0]
leg = dict(scored=lblk(s), scored_final=lblk(s[s.fin]), called=int(d.right.notna().sum()), called_right=int(d.right.sum()),
           uncontested=int((~d.fcont).sum()), one_party=int((d.fcont & ~d.two & (tot > 0)).sum()),
           chambers=dict(n=len(crow), complete=len(ok), settled=sum(r["settled"] for r in crow), right=sum(r["right"] for r in crow),
                         in80=sum(1 for r in ok if r["in80"]), seat_mae=r1(np.mean([abs(r["seat_err"]) for r in ok]), 2), seat_bias=r1(np.mean([r["seat_err"] for r in ok]), 2)),
           calib=calib(1 - s.forecast_prob_d, 1 - s.won_D), bands=lb, lean=ll, states=lst, chamber_rows=sorted(crow, key=lambda r: (r["st"], r["id"])),
           wrong=[dict(ch=x.chamber, st=x.chamber[3:5], house=x.chamber[6:], dist=str(x.district), fm=r1(x.forecast_margin, 1), pD=r1(x.forecast_prob_d, 4), am=r1(x.am, 1),
                       err=r1(x.err, 1), winner=x.aside, pct=r1(x.pct_reporting, 0), wp=r1(x.forecast_prob_d if x.aside == "D" else 1 - x.forecast_prob_d, 4))
                  for x in s[s.right == 0].assign(wp=lambda z: np.where(z.aside == "D", z.forecast_prob_d, 1 - z.forecast_prob_d)).sort_values("wp").itertuples()])

# ---------------------------------------------------------------- write
asof = max(mtime(os.path.join(RES, "results_vs_forecast.csv")), mtime(os.path.join(LEG, "leg_districts_vs_forecast.csv")))
doc = dict(built=dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), results_asof=dict(federal=mtime(os.path.join(RES, "results_vs_forecast.csv")).strftime("%Y-%m-%dT%H:%MZ"),
           legislatures=mtime(os.path.join(LEG, "leg_districts_vs_forecast.csv")).strftime("%Y-%m-%dT%H:%MZ")),
           forecast=dict(frozen="2026-11-03", source="/forecast/archive/final-2026-11-03/model.json", sims=meta.get("sims")),
           headline=headline, chambers=chambers, calib=cal_fed, err_hist=err_hist, bands=bands, states=states, counties=counties, legislatures=leg,
           excluded=[dict(id=x.id, name=x.name, why=x.excl) for x in a[(a.excl != "") & (a.excl != "One major party missing from the count") & (a.excl != "Uncontested in the forecast")].itertuples()],
           one_party=int((a.excl.isin(["One major party missing from the count", "Uncontested in the forecast"])).sum()), races=races)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(doc, open(OUT, "w"), separators=(",", ":"), default=lambda o: o.item() if hasattr(o, "item") else str(o))
print(OUT, os.path.getsize(OUT))
print(json.dumps({k: doc[k] for k in ["results_asof", "chambers"]}, default=str)[:1800])
for o in ["senate", "governor", "house", "all"]: print(o, {k: v for k, v in headline[o].items() if k != "scored_final"})
print("legis", leg["chambers"], leg["scored"], leg["called"], leg["called_right"])
print("counties", counties["all"], counties["races"])
print("calib", cal_fed)
