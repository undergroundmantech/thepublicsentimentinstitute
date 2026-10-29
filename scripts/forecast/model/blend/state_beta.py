"""State response to the national environment, Oct 29 2026, at the user's request.
For each state: beta_hist from its 2016 to 2020 and 2020 to 2024 presidential swings against the nation's (logit, through
the origin), beta_mrp from the Oct 28 state MRP's shift from 2024 at the D+13 national target against the national shift,
each with a standard error, combined with a prior of 1 (sd 0.25) by precision. Writes beta.json and a county elasticity
cache whose turnout weighted state mean equals beta, keeping each county's shape within its state."""
import json, numpy as np, pandas as pd
G = "/tmp/fcrun/TPSI_B/geo"; OUT = "/tmp/fcrun/blend"
lg = lambda p: np.log(p / (1 - p))
def pres(y):
    if y == 2016:
        d = pd.read_csv(f"{G}/pres16.csv"); d["f"] = d.combined_fips.astype(int).astype(str).str.zfill(5)
    else:
        d = pd.read_csv(f"{G}/pres{str(y)[2:]}.csv", dtype={"county_fips": str}); d["f"] = d.county_fips.str.zfill(5)
    d = d.set_index("f")[["votes_dem", "votes_gop", "total_votes"]].astype(float); d["st"] = d.index.str[:2]
    return d
P = {y: pres(y) for y in (2016, 2020, 2024)}
FIPS2AB = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"}
def st2(y):
    g = P[y].groupby("st")[["votes_dem", "votes_gop"]].sum(); return lg(g.votes_dem / (g.votes_dem + g.votes_gop))
def nat(y):
    s = P[y][["votes_dem", "votes_gop"]].sum(); return lg(s.votes_dem / (s.votes_dem + s.votes_gop))
S = {y: st2(y) for y in P}; N = {y: nat(y) for y in P}
dn = np.array([N[2020] - N[2016], N[2024] - N[2020]])
mrp = pd.read_csv("/tmp/np1028/out/mrp/state_generic_mrp.csv").set_index("state")
nat_shift_pts = 13.0 - (-1.41)                              # national 2024 margin -1.41 to the D+13 target
PRIOR_SD = 0.25
out = {}
for f2, ab in FIPS2AB.items():
    if f2 not in S[2024].index or ab == "DC": continue
    ds = np.array([S[2020][f2] - S[2016][f2], S[2024][f2] - S[2020][f2]])
    b_h = float((ds * dn).sum() / (dn ** 2).sum())
    res = ds - b_h * dn; se_h = float(max(0.20, np.sqrt((res ** 2).sum() / 1.0) / np.sqrt((dn ** 2).sum())))
    terms = [(1.0, PRIOR_SD), (b_h, se_h)]
    b_m = se_m = None
    if ab in mrp.index:
        r = mrp.loc[ab]; n = max(float(r.respondents), 1.0)
        b_m = float((r.mrp_poll_target - r.pres_2024) / nat_shift_pts)
        se_pts = 1.5 * 100.0 / np.sqrt(n)                     # two party margin standard error with a 1.5 design effect
        se_m = float(np.hypot(se_pts / nat_shift_pts, 0.15))  # plus model error in the MRP itself
        terms.append((b_m, se_m))
    w = np.array([1 / s ** 2 for _, s in terms]); b = float((np.array([v for v, _ in terms]) * w).sum() / w.sum())
    out[ab] = dict(beta=round(b, 4), beta_hist=round(b_h, 3), se_hist=round(se_h, 3), beta_mrp=None if b_m is None else round(b_m, 3),
                   se_mrp=None if se_m is None else round(se_m, 3), respondents=None if ab not in mrp.index else int(mrp.loc[ab].respondents))
json.dump(out, open(f"{OUT}/beta.json", "w"), indent=1)
e = pd.read_csv("/tmp/pvi/nat_elasticity.csv", dtype={"f": str}).set_index("f").e
v = P[2024].total_votes.reindex(e.index).fillna(0)
df = pd.DataFrame(dict(e=e, v=v)); df["st"] = df.index.str[:2]
ebar = df.groupby("st").apply(lambda x: float((x.e * x.v).sum() / max(x.v.sum(), 1)))
df["ab"] = df.st.map(FIPS2AB)
df["e2"] = [r.e * (out[r.ab]["beta"] / ebar[r.st]) if r.ab in out and ebar[r.st] > 0 else r.e for r in df.itertuples()]
for ab in out: out[ab]["ebar_before"] = round(float(ebar[[k for k, a in FIPS2AB.items() if a == ab][0]]), 3)
json.dump(out, open(f"{OUT}/beta.json", "w"), indent=1)
df[["e2"]].rename(columns={"e2": "e"}).to_csv(f"{OUT}/nat_elasticity_beta.csv", index_label="f")
print(pd.DataFrame(out).T.sort_values("beta").to_string())
