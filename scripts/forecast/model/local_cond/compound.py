"""Local conditions compound and local news amplifies them (LOCAL_CX=1). Rebuilt Oct 29 2026 at the user's request,
after the Oct 15 original was lost with the workspace, from the published method:

  compounding  a condition counts as active in a county when its term sits at least half a standard deviation of its
               national spread from zero. k is the active conditions pushing the county's way, by the sign of its
               combined term, less those pushing the other way, less one, held between 0 and 6, and the county's whole
               term is multiplied by exp(0.15 k). Conditions: the Oct 14 county terms (job growth, wage growth, tariff
               exposure, population growth, international migration, evangelical and Catholic shares, rurality, news
               desert) plus the current data center and gas terms, which replaced that file's own gas and data center
               columns.
  local news   z is the county's log local news outlets per 100,000 adult citizens against the nation, in standard
               deviations, held within 2; the term is multiplied by exp(0.25 z), about 0.6 in a news desert and about
               1.65 in the best covered places. Outlets: the sTechLab local news outlet dataset, 10,257 outlets, placed by
               their county FIPS, or by the county other outlets in the same city and state carry.
  sizes        the county term counts 2.0 times and the statewide parts 1.25 times, each statewide part taking its
               state's turnout weighted average multiplier; a county's combined term is held within 46 points of
               margin, about 1.0 in log odds.
Writes county_local_shift_cx.csv, dc_term_cx.csv and gas_term_cx.csv next to the plain tables."""
import os, sys, numpy as np, pandas as pd
D = os.path.dirname(os.path.abspath(__file__))
NEWS = sys.argv[1] if len(sys.argv) > 1 else "/tmp/newsdata/repo/local_news_outlets_dataset.csv"
TERMS = sys.argv[2] if len(sys.argv) > 2 else "/mnt/attach/outputs/local_conditions_county_terms.csv"
K_STEP, K_MAX, NEWS_B, Z_CAP, COUNTY_X, STATE_X, CAP = 0.15, 6, 0.25, 2.0, 2.0, 1.25, 1.0
loc = pd.read_csv(f"{D}/county_local_shift.csv", dtype={"fips": str}).set_index("fips")
dc = pd.read_csv(f"{D}/dc_term.csv", dtype={"fips": str}).set_index("fips")
gas = pd.read_csv(f"{D}/gas_term.csv", dtype={"fips": str}).set_index("fips")
T = pd.read_csv(TERMS, dtype={"fips": str}); T["fips"] = T.fips.str.zfill(5); T = T.set_index("fips")
comp = [c for c in T.columns if c.endswith("_pts") and not c.startswith(("county_shift", "state_part", "Gas price", "Data center"))]
F = T[comp].reindex(loc.index).fillna(0.0)
F["data_center"] = dc.dc_within.reindex(loc.index).fillna(0.0); F["gas"] = gas.gas_within.reindex(loc.index).fillna(0.0)
sd = F.std(); active = F.abs() >= 0.5 * sd
comb = loc.total + F["data_center"] + F["gas"]
way = np.sign(comb)
k = ((np.sign(F) == way.values[:, None]) & active).sum(1) - ((np.sign(F) == -way.values[:, None]) & active & (F != 0)).sum(1) - 1
k = k.clip(0, K_MAX)
# local news
n = pd.read_csv(NEWS, dtype={"CountyFIPS": str}, low_memory=False)
n["f"] = n.CountyFIPS.str.zfill(5)
city = n.dropna(subset=["f"]).groupby(["State", "City"]).f.agg(lambda s: s.mode().iat[0])
n["f"] = n.f.fillna(pd.Series([city.get((a, b)) for a, b in zip(n.State, n.City)], index=n.index))
cnt = n.dropna(subset=["f"]).groupby("f").size()
cv = pd.read_csv(f"{D}/../census/cvap_county_2020_2024.csv", dtype={"fips": str}).set_index("fips").cvap_tot
pop = cv.reindex(loc.index)
rate = np.log((cnt.reindex(loc.index).fillna(0) + 0.5) / pop.clip(lower=1000) * 1e5)
ok = pop.notna()
w = pop[ok]; mu = float((rate[ok] * w).sum() / w.sum()); s_ = float(np.sqrt((((rate[ok] - mu) ** 2) * w).sum() / w.sum()))
z = ((rate - mu) / s_).where(ok, 0.0).clip(-Z_CAP, Z_CAP)
mult = np.exp(K_STEP * k) * np.exp(NEWS_B * z)
st_ = loc.state
vw = pop.fillna(0)
smult = (mult * vw).groupby(st_).sum() / vw.groupby(st_).sum().clip(lower=1)
sm = st_.map(smult).fillna(1.0)
out = loc.copy(); out["total"] = (COUNTY_X * mult * loc.total).clip(-CAP, CAP)
if "state_part" in out: out["state_part"] = STATE_X * sm * loc.state_part
out["k"] = k; out["news_z"] = z.round(3); out["news_outlets"] = cnt.reindex(loc.index).fillna(0).astype(int); out["multiplier"] = mult.round(4)
out.to_csv(f"{D}/county_local_shift_cx.csv")
d2 = dc.copy(); d2["dc_within"] = (COUNTY_X * mult.reindex(dc.index).fillna(1.0) * dc.dc_within).clip(-CAP, CAP)
d2["dc_state"] = STATE_X * dc.state.map(smult).fillna(1.0) * dc.dc_state; d2.to_csv(f"{D}/dc_term_cx.csv")
g2 = gas.copy(); g2["gas_within"] = (COUNTY_X * mult.reindex(gas.index).fillna(1.0) * gas.gas_within).clip(-CAP, CAP)
g2["gas_state"] = STATE_X * gas.state.map(smult).fillna(1.0) * gas.gas_state; g2.to_csv(f"{D}/gas_term_cx.csv")
print("counties", len(out), "outlets placed", int(cnt.sum()), "of", len(n), "counties with none", int((out.news_outlets == 0).sum()))
print("k", k.value_counts().sort_index().to_dict()); print("multiplier", mult.describe().round(3).to_dict())
print("news multiplier desert vs best", round(float(np.exp(NEWS_B * z.min())), 2), round(float(np.exp(NEWS_B * z.max())), 2))
