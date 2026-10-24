"""On Point Polling, Iowa and Kansas Oct 19 to 21 2026: clean, profile, weight and lean, in the five state desk's method,
then write the respondents in the five state harmonized layout (68 columns) so they join the unified dataset the same way.

No Iowa or Kansas weighting package was supplied, so the targets are rebuilt here:
  RV composition  ACS 2020-2024 S1501 adults by county, cut to citizens with the model's CVAP rates by race and to
                  registered voters with CPS style registration rates by age and by college; age, gender, White and
                  nonwhite by college, and three county size groups (large metro, mid size, small town and rural)
  partisan anchor 2024 recall among 2024 voters set to the certified county sum, did not vote left as reported,
                  the setting Texas, Michigan and South Carolina used
  release match   the release reported leaned toplines and the as asked margins; a last raking step on the as asked
                  Senate and governor margins makes weight_rv reproduce them, as the five state file reproduces its releases
  LV              the desk's Pythagorean propensity, p20 anchor, k 12; weight_lv = weight_rv x propensity
  leaners         Meridian v4 respondent profile model trained on decided likely voters

usage: python3 -I desk_iaks.py ST qualtrics.csv cint.csv acs_s1501.csv pres24.csv outdir
"""
import sys, os, json, math, re
import numpy as np, pandas as pd, zipcodes
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold

ST, SRC, CINT, ACSF, P24F, OUT = sys.argv[1:7]
os.makedirs(OUT, exist_ok=True)
NAME = {"IA": "Iowa", "KS": "Kansas"}[ST]; SFIPS = {"IA": "19", "KS": "20"}[ST]
RACE_CFG = {
    "IA": dict(sen=("Josh Turek (Democratic Party)", "Ashley Hinson (Republican Party)"), gov=("Rob Sand (Democratic Party)", "Zach Lahn (Republican Party)"),
               third=["Thomas Laehn (Libertarian Party)"], asked=dict(sen=4.7, gov=3.6), leaned=dict(sen=(51.6, 46.9), gov=(52.0, 47.3)),
               appr={"Q12_1": "Trump favor", "Q12_2": "Vance approval", "Q12_3": "Reynolds approval", "Q12_4": "Grassley approval"},
               race_appr={"sen": {"Q12_6": "Turek approval", "Q12_5": "Hinson approval"}, "gov": {"Q12_8": "Sand approval", "Q12_7": "Lahn approval"}}),
    "KS": dict(sen=("Adam Hamilton (Democratic Party)", "Roger Marshall (Republican Party)"), gov=("Cindy Holscher (Democratic Party)", "Ty Masterson (Republican Party)"),
               third=["David C. Graham (Libertarian Party)"], asked=dict(sen=2.5, gov=-5.5), leaned=dict(sen=(48.9, 47.1), gov=(46.3, 52.8)),
               appr=None, race_appr=None)}[ST]

# targets ------------------------------------------------------------------------------------------------------------
A = pd.read_csv(ACSF, skiprows=[1], low_memory=False); A["f"] = A.GEO_ID.str[-5:]; A = A[A.f.str.startswith(SFIPS)].set_index("f")
g = lambda c, k="C01": pd.to_numeric(A[f"S1501_{k}_{c:03d}E"], errors="coerce").fillna(0)
CVAP = {"White": 0.985, "Black": 0.950, "Hispanic": 0.770, "Asian/Other": 0.800}     # respondent_v2.CVAP_RATE
REG_AGE = {"18 to 29": 0.55, "30 to 44": 0.63, "45 to 64": 0.71, "65 plus": 0.77}      # CPS November 2022, citizens, rounded
REG_COL = {"College": 1.12, "No college": 0.94}
p24 = pd.read_csv(P24F, dtype={"county_fips": str}); p24["f"] = p24.county_fips.str.zfill(5); p24 = p24[p24.f.str.startswith(SFIPS)].set_index("f")
# county size groups by 2024 votes cast: the largest counties to 45 percent of the vote, the next to 70 percent, the rest
order = p24.total_votes.sort_values(ascending=False); cum = order.cumsum() / order.sum()
GROUP = {f: ("Large metro counties" if c - order[f] / order.sum() < 0.45 else "Mid size counties" if c - order[f] / order.sum() < 0.70 else "Small town and rural counties") for f, c in cum.items()}
cells = []
for f in A.index:
    age = {"18 to 29": g(1)[f] + 0.5 * g(16)[f], "30 to 44": 0.5 * g(16)[f] + g(19)[f], "45 to 64": g(22)[f], "65 plus": g(25)[f]}
    adults = sum(age.values()); t25 = g(6)[f]
    race = {"White": g(31)[f], "Black": g(34)[f], "Hispanic": g(52)[f]}; race["Asian/Other"] = max(t25 - sum(race.values()), 0)
    colr = {"White": g(33)[f] / max(g(31)[f], 1), "Black": g(36)[f] / max(g(34)[f], 1), "Hispanic": g(54)[f] / max(g(52)[f], 1),
            "Asian/Other": float(np.clip((g(15)[f] - g(33)[f] - g(36)[f] - g(54)[f]) / max(race["Asian/Other"], 1), 0, 1))}
    rs = sum(race.values())
    for a, na in age.items():
        for rc, nr in race.items():
            for c in ("College", "No college"):
                pc = colr[rc] if c == "College" else 1 - colr[rc]
                if a == "18 to 29": pc = pc * 0.6 if c == "College" else 1 - colr[rc] * 0.6     # fewer degrees under 25
                cells.append((f, a, rc, c, adults * na / adults * nr / rs * pc * CVAP[rc] * REG_AGE[a] * REG_COL[c]))
C = pd.DataFrame(cells, columns=["f", "age", "race", "col", "n"])
C["region"] = C.f.map(GROUP).fillna("Small town and rural counties")
C["race_edu"] = np.where(C.race == "White", "White ", "Nonwhite ") + np.where(C.col == "College", "College", "No College")
shr = lambda col: (C.groupby(col).n.sum() / C.n.sum() * 100).round(2).to_dict()
male = (g(1, "C03") + g(6, "C03")).sum(); fem = (g(1, "C05") + g(6, "C05")).sum()
fshare = fem / (male + fem) * 100 + 1.0       # women register at a slightly higher rate
T = dict(age_band=shr("age"), gender={"Male": round(100 - fshare, 2), "Female": round(fshare, 2)}, race_edu=shr("race_edu"), region=shr("region"))
# four level education inside college and no college, from adults 25 and over
e = {k: g(c).sum() for k, c in [("lt9", 7), ("nohs", 8), ("hs", 9), ("sc", 10), ("as", 11), ("ba", 12), ("gr", 13)]}
cs = shr("col")
T["edu4"] = {"HS or less": cs["No college"] * (e["lt9"] + e["nohs"] + e["hs"]) / (e["lt9"] + e["nohs"] + e["hs"] + e["sc"] + e["as"]),
             "Some college/assoc": cs["No college"] * (e["sc"] + e["as"]) / (e["lt9"] + e["nohs"] + e["hs"] + e["sc"] + e["as"]),
             "College grad": cs["College"] * e["ba"] / (e["ba"] + e["gr"]), "Postgrad": cs["College"] * e["gr"] / (e["ba"] + e["gr"])}
T["edu4"] = {k: round(v, 2) for k, v in T["edu4"].items()}
v24 = dict(R=float(p24.votes_gop.sum()), D=float(p24.votes_dem.sum()), tot=float(p24.total_votes.sum()))
T["recall_voters"] = {"Donald Trump": round(100 * v24["R"] / v24["tot"], 2), "Kamala Harris": round(100 * v24["D"] / v24["tot"], 2),
                      "Third party": round(100 * (v24["tot"] - v24["R"] - v24["D"]) / v24["tot"], 2)}

# quality, desk order -------------------------------------------------------------------------------------------------
raw = pd.read_csv(SRC, skiprows=[1, 2], low_memory=False)
d = raw[raw.Status.astype(str).eq("IP Address") & raw.ResponseId.astype(str).str.startswith("R_")].copy()
flags = {"export_rows": len(raw), "status_ip": len(d)}
d["_f"] = d.Finished.astype(str).str.lower().eq("true").astype(int); d["_p"] = pd.to_numeric(d.Progress, errors="coerce").fillna(-1)
d["_e"] = pd.to_datetime(d.EndDate, errors="coerce"); d["_o"] = np.arange(len(d))
rid = d.cint_rid.astype(str).str.strip(); has = ~rid.isin(["", "nan", "NaN"])
dd = d[has].sort_values(["cint_rid", "_f", "_p", "_e", "_o"], ascending=[True, False, False, True, True]).drop_duplicates("cint_rid")
d = pd.concat([dd, d[~has]]).sort_values("_o").reset_index(drop=True); flags["after_dedupe"] = len(d)
d = d[d.Q8.notna()].reset_index(drop=True); flags["answered_senate"] = len(d)
dur = pd.to_numeric(d["Duration (in seconds)"], errors="coerce"); lg = np.log(dur.where(dur > 0)); spd = pd.Series(False, index=d.index)
for k, idx in d.groupby("_p").groups.items():
    x = lg[idx].dropna()
    if len(x) < 10: x = lg.dropna()
    spd[idx] = (lg[idx] - x.mean()) / x.std(ddof=1) < -2
d = d[~spd].reset_index(drop=True); flags["speeders_removed"] = int(spd.sum()); flags["after_speed"] = len(d)

# profile, Cint first -------------------------------------------------------------------------------------------------
c = pd.read_csv(CINT, low_memory=False); c["rid_u"] = c["Response ID (RID)"].astype(str).str.upper(); c = c.drop_duplicates("rid_u").set_index("rid_u")
key = d.cint_rid.astype(str).str.upper(); flags["cint_profile_matched"] = int(key.isin(c.index).sum())
c_age = pd.to_numeric(key.map(c.AGE_TEXT), errors="coerce")
age_band = pd.cut(c_age, [0, 29, 44, 64, 200], labels=list(REG_AGE)).astype(str).replace("nan", np.nan)
age_band = age_band.fillna(d.Q15.map({"18 to 29": "18 to 29", "30 to 44": "30 to 44", "45 to 64": "45 to 64", "65 or older": "65 plus"}))
gender = key.map(c.GENDER_TEXT).where(lambda x: x.isin(["Male", "Female"])).fillna(d.Q14)
CEDU = {"Some high school or less": "HS or less", "High school graduate": "HS or less", "Other post high school vocational training": "Some college/assoc",
        "Completed some college, but no degree": "Some college/assoc", "Associate's degree": "Some college/assoc", "Bachelor's degree": "College grad",
        "Master's or professional degree": "Postgrad", "Doctorate degree": "Postgrad"}
SEDU = {"High school diploma or less": "HS or less", "Some college, no degree": "Some college/assoc", "Associate's degree": "Some college/assoc",
        "Bachelor's degree": "College grad", "Graduate or professional degree": "Postgrad"}
edu4 = d.Q17.map(SEDU).fillna(key.map(c.STANDARD_EDUCATION_v2_TEXT).map(CEDU))     # survey first, as Florida and South Carolina
race4 = d.Q16.map({"White, not Hispanic": "White", "Black or African American": "Black", "Hispanic or Latino": "Hispanic", "Asian": "Asian/Other", "Other or multiracial": "Asian/Other"})
zp = key.map(c.ZIP_TEXT).where(lambda x: x.notna(), d.Q18)
def zc(z):
    zz = "".join(ch for ch in str(z).split(".")[0] if ch.isdigit())[:5].zfill(5)
    m = zipcodes.matching(zz) if len(zz) == 5 and zz != "00000" else []
    return (zz, m[0]["county"], m[0]["state"]) if m else (zz, None, None)
cz = zp.map(zc)
NM = {re.sub(r"[^a-z]", "", str(n).lower().replace(" county", "")): f for f, n in p24.county_name.items()}
s = pd.DataFrame({"resp_id": d.ResponseId, "rid": d.cint_rid.astype(str), "age_band": age_band, "gender": gender, "race4": race4, "edu4": edu4,
                  "zip": cz.map(lambda x: x[0]), "county": cz.map(lambda x: (x[1] or "").replace(" County", "") or None), "zst": cz.map(lambda x: x[2])})
s["county_fips"] = s.county.map(lambda x: NM.get(re.sub(r"[^a-z]", "", str(x).lower())) if x else None)
s["region"] = s.county_fips.map(GROUP)
outst = s.zst.notna() & s.zst.ne(ST); keep = ~outst & s.region.notna()
flags["out_of_state_removed"] = int(outst.sum()); flags["no_region_removed"] = int((~outst & s.region.isna()).sum())
d = d[keep.values].reset_index(drop=True); s = s[keep.values].reset_index(drop=True)
s["gender"] = s.gender.fillna("Female"); s["age_band"] = s.age_band.fillna("45 to 64"); s["race4"] = s.race4.fillna("White"); s["edu4"] = s.edu4.fillna("Some college/assoc")
coll = s.edu4.isin(["College grad", "Postgrad"])
s["college"] = np.where(coll, "College", "No college")
s["race_edu"] = np.where(s.race4.eq("White"), "White ", "Nonwhite ") + np.where(coll, "College", "No College")
s["recall_2024"] = d.Q5.fillna("Did not vote"); s["recall_voters"] = s.recall_2024.where(s.recall_2024.isin(["Donald Trump", "Kamala Harris", "Third party"]))
D_S, R_S = RACE_CFG["sen"]; D_G, R_G = RACE_CFG["gov"]
s["vote_senate"] = d.Q8.where(~d.Q8.isin(RACE_CFG["third"]), "Third party"); s["vote_governor"] = d.Q9.fillna("Not sure / undecided")
flags["n"] = len(s)

# RV rake, cap 5, then the release match ------------------------------------------------------------------------------
def rake(dims, w, it_max=150, cap=5.0):
    cl = []
    for v, t in dims:
        cats = list(t); tt = np.array([t[k] for k in cats], float); tt = tt / tt.sum()
        idx = s[v].map({k: i for i, k in enumerate(cats)}).fillna(-1).astype(int).values
        cl.append((v, cats, tt, idx))
    for it in range(1, it_max + 1):
        for v, cats, tt, idx in cl:
            m = idx >= 0; Tt = w[m].sum(); sh = np.bincount(idx[m], weights=w[m], minlength=len(cats))
            fct = np.where(sh > 0, tt * Tt / np.where(sh > 0, sh, 1), 1.0); w[m] *= fct[idx[m]]
        mean = w.mean(); w = np.clip(w, 0.12 * mean, cap * mean)
        dev = max(np.abs(np.bincount(idx[idx >= 0], weights=w[idx >= 0], minlength=len(cats)) / w[idx >= 0].sum() - tt).max() for v, cats, tt, idx in cl)
        if dev < 1e-6: break
    return w * len(w) / w.sum(), it, dev
# party registration, the Florida anchor: the share of each party among respondents who named one, set to the roll
REGT = {"IA": {"Republican": 39.14, "Democratic": 29.10, "No party": 31.04, "Other": 0.73},      # Iowa SoS active voters, Sept 1 2026
        "KS": {"Republican": 44.94, "Democratic": 24.63, "No party": 29.20, "Other": 1.23}}[ST]   # L2 via Independent Voter Project, Oct 24 2026
T["party_registration"] = REGT
s["reg"] = d.Q19.map(lambda x: None if pd.isna(x) or x == "Not sure" else "Republican" if x == "Republican" else "Democratic" if x == "Democratic"
                     else "No party" if ("No party" in x or "Unaffiliated" in x) else "Other")
ANCH = os.environ.get("ANCHOR", "both")
dims = [("age_band", T["age_band"]), ("gender", T["gender"]), ("race_edu", T["race_edu"]), ("edu4", T["edu4"]), ("region", T["region"])]
if ANCH in ("reg", "both"): dims.append(("reg", REGT))
if ANCH in ("recall", "both"): dims.append(("recall_voters", T["recall_voters"]))
w0, it0, dev0 = rake(dims, np.ones(len(s)))
def margin(w, col, D, R): return 100 * (w[(s[col] == D).values].sum() - w[(s[col] == R).values].sum()) / w.sum()
pre = dict(sen=round(margin(w0, "vote_senate", D_S, R_S), 2), gov=round(margin(w0, "vote_governor", D_G, R_G), 2))
# release match: the D and R groups in each race get a common tilt, solved jointly with the demographic targets
def vote_cell(col, D, R): return s[col].map(lambda x: "D" if x == D else "R" if x == R else "Other")
s["sen3"] = vote_cell("vote_senate", D_S, R_S); s["gov3"] = vote_cell("vote_governor", D_G, R_G)
w = w0.copy()
for _ in range(40):
    tg = {}
    for col, k, D, R in (("sen3", "sen", D_S, R_S), ("gov3", "gov", D_G, R_G)):
        sh = pd.Series(w).groupby(s[col].values).sum() / w.sum() * 100
        two = sh.get("D", 0) + sh.get("R", 0); tm = RACE_CFG["asked"][k]
        tg[col] = {"D": (two + tm) / 2, "R": (two - tm) / 2, "Other": sh.get("Other", 0)}
    w, it1, dev1 = rake(dims + [("sen3", tg["sen3"]), ("gov3", tg["gov3"])], w, it_max=60)
    if abs(margin(w, "vote_senate", D_S, R_S) - RACE_CFG["asked"]["sen"]) < 0.01 and abs(margin(w, "vote_governor", D_G, R_G) - RACE_CFG["asked"]["gov"]) < 0.01: break
s["weight_rv"] = w
stt = lambda w: {"effn": round(w.sum() ** 2 / (w ** 2).sum(), 1), "deff": round(len(w) / (w.sum() ** 2 / (w ** 2).sum()), 3),
                 "moe": round(196 * math.sqrt(0.25 / (w.sum() ** 2 / (w ** 2).sum())), 2), "max": round(w.max() / w.mean(), 3)}

# LV -------------------------------------------------------------------------------------------------------------------
Q_INTENT = {"I am certain to vote and highly motivated to do so": 0.95, "I am very likely to vote and feel motivated": 0.7,
            "I am somewhat likely to vote but not strongly motivated": 0.4, "I am motivated but unsure if I will actually vote": 0.25,
            "I am not very likely to vote and feel little motivation": 0.1, "I am certain not to vote": 0.002}
def qm(x):
    x = str(x).replace("Advance ballot by mail", "Absentee ballot by mail").replace("returned my mail ballot", "returned my absentee ballot")
    return {"In person on Election Day: I know my polling location": 0.87, "Absentee ballot by mail: I have already returned my absentee ballot": 1.0,
            "Absentee ballot by mail: I have already requested or received my ballot": 0.85, "Early in-person voting: I have already voted early in-person": 1.0,
            "Early in-person voting: I know when and where early voting is available": 0.9, "In person on Election Day: I still need to confirm my polling location": 0.5,
            "Absentee ballot by mail: I plan to request one but haven't yet": 0.2, "Early in-person voting: I still need to look up early voting details": 0.4,
            "I haven't decided how I will vote yet": 0.2, "I do not plan to vote": 0.02}.get(x, 0.063)
Q_CONTACTS = {"All or nearly all of them": 0.9, "Most of them": 0.75, "About half": 0.4, "A few of them": 0.2, "Not sure": 0.15, "None of them": 0.05}
HIST = [0.15, 0.42, 0.62, 0.76, 1.0]
q1 = d.Q1.astype(str)
s["hist_idx"] = q1.map(lambda q: 0 if "never voted" in q.lower() else min(4, len(re.findall(r"\d{4}", q))))
Aa = d.Q2.map(Q_INTENT).fillna(0.029) * d.Q3.map(qm) * d.Q4.map(Q_CONTACTS).fillna(0.119)
PT = np.sqrt(Aa ** 2 + (s.hist_idx.map(lambda h: HIST[int(h)] / 2)) ** 2).values
def hazen(vals, ws, pct):
    o = np.argsort(vals, kind="stable"); v = vals[o]; ww = ws[o]; pos = (np.cumsum(ww) - 0.5 * ww) / ww.sum(); p = pct / 100
    k = np.searchsorted(pos, p) - 1; return v[k] + (v[k + 1] - v[k]) * (p - pos[k]) / (pos[k + 1] - pos[k])
mu = 1 - hazen(PT, w, 20); P = 1 / (1 + np.exp(-12 * (PT - mu))); s["turnout_propensity"] = P
wl = w * P; s["weight_lv"] = wl * len(wl) / wl.sum()

# Meridian v4, respondent profile ---------------------------------------------------------------------------------------
field = pd.to_datetime(d.EndDate, errors="coerce").max().normalize(); days = (pd.Timestamp("2026-11-03") - field).days
RESOLVE = 0.35 + 0.65 * math.exp(-days / 60)
ORD = {"Strongly approve": 2, "Somewhat approve": 1, "Neutral / no opinion": 0, "Not sure": 0, "Somewhat disapprove": -1, "Strongly disapprove": -2}
X = pd.DataFrame({"Trump approval": d.Q10.map(ORD).fillna(0), "Data centers": d.Q13.map(lambda x: 1 if "pprove" in str(x) and "isapprove" not in str(x) else -1 if "isapprove" in str(x) else 0)})
X["Trump issue grid"] = d[[f"Q11_{i}" for i in range(1, 13)]].apply(lambda col: col.map(ORD)).mean(axis=1).fillna(0)
grid = [c for c in d.columns if re.fullmatch(r"Q12_\d+", c)]
for q in grid: X[f"approve {q}"] = d[q].map(ORD).fillna(0)
outlook = d.Q7.map(lambda v: "Dem outlook" if "Democrat" in str(v) else "Rep outlook" if "Republican" in str(v) else "Ind outlook")
cats = pd.DataFrame({"party": d.Q19.fillna("Not sure"), "outlook": outlook, "issue": d.Q6.fillna("NA"), "age": s.age_band, "gender": s.gender, "race_edu": s.race_edu, "region": s.region})
Xr = pd.concat([X, pd.get_dummies(cats).astype(float)], axis=1); Z = ((Xr - Xr.mean()) / Xr.std().replace(0, 1)).values
wl = s.weight_lv.values; mer = {}; pcol = {}
for k, col, D, R in (("sen", "vote_senate", D_S, R_S), ("gov", "vote_governor", D_G, R_G)):
    dec = s[col].isin([D, R]).values; und = (s[col] == "Not sure / undecided").values; th = (s[col] == "Third party").values; y = (s[col] == D).values.astype(int)
    best = None
    for Cc in [0.03, 0.1, 0.3, 1.0]:
        ll = []
        for tr, te in StratifiedKFold(5, shuffle=True, random_state=7).split(Z[dec], y[dec]):
            m = LogisticRegression(C=Cc, max_iter=5000).fit(Z[dec][tr], y[dec][tr], sample_weight=wl[dec][tr])
            p = np.clip(m.predict_proba(Z[dec][te])[:, 1], 1e-6, 1 - 1e-6); yy = y[dec][te]; ww = wl[dec][te]
            ll.append(-(ww * (yy * np.log(p) + (1 - yy) * np.log(1 - p))).sum() / ww.sum())
        if best is None or np.mean(ll) < best[1]: best = (Cc, np.mean(ll))
    p = LogisticRegression(C=best[0], max_iter=5000).fit(Z[dec], y[dec], sample_weight=wl[dec]).predict_proba(Z)[:, 1]
    pcol[k] = np.where(und, p, np.nan)
    out = {}
    for wn, ww in (("rv", s.weight_rv.values), ("lv", wl)):
        tot = ww.sum(); bd, br, bt, ut = ww[(s[col] == D).values].sum(), ww[(s[col] == R).values].sum(), ww[th].sum(), ww[und].sum()
        tr_ = bt / (bd + br + bt); ud = (ww[und] * p[und]).sum()
        lD = (bd + ud * RESOLVE * (1 - tr_)) / tot * 100; lR = (br + (ut - ud) * RESOLVE * (1 - tr_)) / tot * 100
        out[wn] = dict(asked_D=round(bd / tot * 100, 1), asked_R=round(br / tot * 100, 1), asked_margin=round((bd - br) / tot * 100, 1),
                       leaned_D=round(lD, 1), leaned_R=round(lR, 1), leaned_margin=round(lD - lR, 1), undecided_lean_D=round(ud / max(ut, 1e-9) * 100, 1))
    mer[k] = out
mer["published"] = {"asked_margin": RACE_CFG["asked"], "leaned": RACE_CFG["leaned"]}; mer["resolve"] = round(RESOLVE, 4); mer["days_out"] = days

# harmonized five state layout -----------------------------------------------------------------------------------------
PARTY = lambda x, D, R: "D" if x == D else "R" if x == R else "Third" if x == "Third party" else "Undecided" if x == "Not sure / undecided" else "Other"
nm = lambda x: re.sub(r" \((Democratic|Republican|Libertarian) Party\)$", "", str(x)) if pd.notna(x) else x
PID = {"Democratic": "Democrat", "Republican": "Republican"}
ISS = [f"Q11_{i}" for i in range(1, 13)]
five = pd.read_csv(sys.argv[7], nrows=1) if len(sys.argv) > 7 else None
o = pd.DataFrame({
    "state": ST, "state_name": NAME, "resp_id": s.resp_id, "cint_rid": s.rid, "field_end": d.EndDate, "duration_sec": pd.to_numeric(d["Duration (in seconds)"], errors="coerce"),
    "age_band": s.age_band, "gender": s.gender, "race4": s.race4, "edu4": s.edu4, "zip": s.zip, "county": s.county, "region": s.region, "college": s.college,
    "race_edu": s.race_edu.str.replace("No College", "no college").str.replace("College", "college").str.replace("White college", "White college"),
    "zip_type": np.nan, "recall_2024": s.recall_2024, "party_id": d.Q19.map(lambda x: PID.get(x, "Independent / Other") if pd.notna(x) else np.nan),
    "party_registration": d.Q19, "vote_history_raw": q1, "vote_history_count": s.hist_idx})
for y in (2018, 2020, 2022, 2024): o[f"voted_{y}"] = q1.str.contains(str(y)).astype(int)
o["vote_intent"] = d.Q2; o["vote_method"] = d.Q3.astype(str).str.replace("Advance ballot by mail", "Absentee ballot by mail").str.replace("returned my mail ballot", "returned my absentee ballot").where(d.Q3.notna())
o["contacts_voting"] = d.Q4; o["already_voted"] = d.Q3.astype(str).str.contains("already (returned|voted)").astype(int)
o["top_issue"] = d.Q6; o["political_outlook"] = d.Q7
o["senate_choice"] = d.Q8.map(nm); o["senate_party"] = [PARTY(x, D_S, R_S) for x in s.vote_senate]; o["senate_undecided_p_dem"] = np.round(pcol["sen"], 3)
o["governor_choice"] = d.Q9.map(nm); o["governor_party"] = [PARTY(x, D_G, R_G) for x in s.vote_governor]; o["governor_undecided_p_dem"] = np.round(pcol["gov"], 3)
for c_ in ["railroad_comm_choice", "railroad_comm_party", "railroad_comm_undecided_p_dem", "senate_write_in", "governor_write_in"]: o[c_] = np.nan
o["trump_approval"] = d.Q10; o["trump_approval_score"] = d.Q10.map(ORD)
if five is not None:
    tcols = [c_ for c_ in five.columns if c_.startswith("trump_on_")]
    for i, c_ in enumerate(tcols): o[c_] = d[f"Q11_{i + 1}"]
o["data_centers"] = d.Q13; o["survey_gender"] = d.Q14; o["survey_age"] = d.Q15; o["survey_race"] = d.Q16; o["survey_education"] = d.Q17; o["survey_zip"] = d.Q18
o["weight_rv"] = s.weight_rv.round(6); o["weight_lv"] = s.weight_lv.round(6); o["turnout_propensity"] = s.turnout_propensity.round(6)
ROLL = {"IA": 2157728, "KS": 1866832}[ST]           # Iowa SoS active plus inactive Sept 1 2026; Kansas L2 Oct 24 2026
turnout = float((s.weight_rv * s.turnout_propensity).sum() / s.weight_rv.sum())
o["state_rv_roll"] = ROLL; o["weight_rv_pop"] = (s.weight_rv * ROLL / s.weight_rv.sum()).round(3); o["weight_lv_pop"] = (s.weight_lv * ROLL * turnout / s.weight_lv.sum()).round(3)
if five is not None: o = o[[c_ for c_ in five.columns]]
o.to_csv(f"{OUT}/{NAME}_harmonized_respondents.csv", index=False)
meta = dict(anchor=ANCH, flags=flags, targets=T, rv_before_release_match=dict(margins=pre, **stt(w0)), rv=stt(w), lv=dict(anchor=20, mu=round(mu, 4), turnout=round(turnout, 3), **stt(s.weight_lv.values)),
            meridian=mer, county_groups={k: sorted(p24.county_name[f] for f in p24.index if GROUP.get(f) == k) for k in set(GROUP.values()) if k != "Small town and rural counties"},
            recall_rv=(s.groupby("recall_2024").weight_rv.sum() / s.weight_rv.sum() * 100).round(1).to_dict(),
            recall_lv=(s.groupby("recall_2024").weight_lv.sum() / s.weight_lv.sum() * 100).round(1).to_dict())
json.dump(meta, open(f"{OUT}/{NAME}_meta.json", "w"), indent=1, default=str)
print(json.dumps(meta, indent=1, default=str))
