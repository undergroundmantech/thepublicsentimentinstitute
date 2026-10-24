"""Harmonize the user's Iowa or Kansas desk output into the five state respondent layout, and match weight_lv to the
published as asked margins with a small last raking step that holds every other weighted share where the desk put it.
usage: python3 -I harmonize_user.py ST qualtrics.csv weighted.csv mer_undecided.csv five_state.csv roll out.csv meta.json"""
import sys, re, json, numpy as np, pandas as pd
ST, RAW, WCSV, MER, FIVE, ROLL, OUT, META = sys.argv[1:9]; ROLL = float(ROLL)
NAME = {"IA": "Iowa", "KS": "Kansas"}[ST]
CFG = {"IA": dict(sen=("Josh Turek (Democratic Party)", "Ashley Hinson (Republican Party)"), gov=("Rob Sand (Democratic Party)", "Zach Lahn (Republican Party)"), asked=dict(sen=4.7, gov=3.6)),
       "KS": dict(sen=("Adam Hamilton (Democratic Party)", "Roger Marshall (Republican Party)"), gov=("Cindy Holscher (Democratic Party)", "Ty Masterson (Republican Party)"), asked=dict(sen=2.5, gov=-5.5))}[ST]
raw = pd.read_csv(RAW, skiprows=[1, 2], low_memory=False, dtype={"Q18": str}).set_index("ResponseId")
s = pd.read_csv(WCSV, low_memory=False, dtype={"zip": str}); d = raw.reindex(s.resp_id); d.index = s.index
mer = pd.read_csv(MER)
pS = s.resp_id.map(mer[mer.race == "Senate"].set_index("resp_id").p_dem); pG = s.resp_id.map(mer[mer.race == "Governor"].set_index("resp_id").p_dem)
D_S, R_S = CFG["sen"]; D_G, R_G = CFG["gov"]
cell = lambda col, D, R: s[col].map(lambda x: "D" if x == D else "R" if x == R else "Other")
s["sen3"], s["gov3"] = cell("vote_senate", D_S, R_S), cell("vote_governor", D_G, R_G)
w = s.weight_lv.values.astype(float).copy()
def margin(w, c): return 100 * (w[(s[c] == "D").values].sum() - w[(s[c] == "R").values].sum()) / w.sum()
before = dict(sen=round(margin(w, "sen3"), 2), gov=round(margin(w, "gov3"), 2))
hold = ["age_band", "gender", "race_edu", "region", "recall_2024", "party_reg"]
held = {v: (pd.Series(w).groupby(s[v].fillna("NA").values).sum() / w.sum()).to_dict() for v in hold}
for _ in range(300):
    for c, k in (("sen3", "sen"), ("gov3", "gov")):
        sh = pd.Series(w).groupby(s[c].values).sum() / w.sum(); two = sh.get("D", 0) + sh.get("R", 0); m = CFG["asked"][k] / 100
        tg = {"D": (two + m) / 2, "R": (two - m) / 2, "Other": sh.get("Other", 0)}
        w = w * s[c].map({g: tg[g] / sh[g] for g in tg if sh.get(g, 0) > 0}).values
    for v in hold:
        sh = pd.Series(w).groupby(s[v].fillna("NA").values).sum() / w.sum()
        w = w * s[v].fillna("NA").map({g: held[v][g] / sh[g] for g in sh.index if sh[g] > 0}).values
    w = np.minimum(w, 5 * w.mean())
w = w * len(w) / w.sum()
after = dict(sen=round(margin(w, "sen3"), 2), gov=round(margin(w, "gov3"), 2))
ORD = {"Strongly approve": 2, "Somewhat approve": 1, "Neutral / no opinion": 0, "Not sure": 0, "Somewhat disapprove": -1, "Strongly disapprove": -2}
PARTY = lambda x, D, R: "D" if x == D else "R" if x == R else "Third" if x == "Third party" else "Undecided" if x == "Not sure / undecided" else ("Other" if pd.notna(x) else np.nan)
nm = lambda x: re.sub(r" \((Democratic|Republican|Libertarian) Party\)$", "", str(x)) if pd.notna(x) else x
five = pd.read_csv(FIVE, nrows=1)
coll = s.edu4.isin(["College grad", "Postgrad"])
o = pd.DataFrame({"state": ST, "state_name": NAME, "resp_id": s.resp_id, "cint_rid": s.rid, "field_end": d.EndDate.values,
    "duration_sec": pd.to_numeric(d["Duration (in seconds)"], errors="coerce").values, "age_band": s.age_band, "gender": s.gender, "race4": s.race4, "edu4": s.edu4,
    "zip": s.zip.astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(5), "county": s.county, "region": s.region,
    "college": np.where(coll, "College", "No college"), "race_edu": s.race_edu.str.replace("No College", "no college").str.replace("College", "college"),
    "zip_type": np.nan, "recall_2024": s.recall_2024, "party_id": d.Q19.map(lambda x: {"Democratic": "Democrat", "Republican": "Republican"}.get(x, "Independent / Other") if pd.notna(x) else np.nan).values,
    "party_registration": d.Q19.values, "vote_history_raw": s.q1, "vote_history_count": s.hist_idx})
for y in (2018, 2020, 2022, 2024): o[f"voted_{y}"] = s.q1.astype(str).str.contains(str(y)).astype(int)
o["vote_intent"] = s.q3; o["vote_method"] = s.q4.astype(str).str.replace("Advance ballot by mail", "Absentee ballot by mail").str.replace("returned my mail ballot", "returned my absentee ballot").where(s.q4.notna())
o["contacts_voting"] = s.q5; o["already_voted"] = s.q4.astype(str).str.contains("already returned|already voted").astype(int)
o["top_issue"] = s.issue; o["political_outlook"] = s.outlook7
o["senate_choice"] = s.sen.map(nm); o["senate_party"] = [PARTY(x, D_S, R_S) for x in s.vote_senate]; o["senate_undecided_p_dem"] = pS.round(3)
o["governor_choice"] = s.gov.map(nm); o["governor_party"] = [PARTY(x, D_G, R_G) for x in s.vote_governor]; o["governor_undecided_p_dem"] = pG.round(3)
for c_ in ["railroad_comm_choice", "railroad_comm_party", "railroad_comm_undecided_p_dem", "senate_write_in", "governor_write_in"]: o[c_] = np.nan
o["senate_write_in"] = s.write_in
o["trump_approval"] = s.s_ins; o["trump_approval_score"] = s.s_ins.map(ORD)
for i, c_ in enumerate([c for c in five.columns if c.startswith("trump_on_")]): o[c_] = d[f"Q11_{i + 1}"].values
o["data_centers"] = s.dc; o["survey_gender"] = d.Q14.values; o["survey_age"] = d.Q15.values; o["survey_race"] = d.Q16.values; o["survey_education"] = d.Q17.values; o["survey_zip"] = d.Q18.values
turnout = float((s.weight_rv * s.turnout_propensity).sum() / s.weight_rv.sum())
o["weight_rv"] = s.weight_rv.round(6); o["weight_lv"] = np.round(w, 6); o["turnout_propensity"] = s.turnout_propensity.round(6)
o["state_rv_roll"] = ROLL; o["weight_rv_pop"] = (s.weight_rv * ROLL / s.weight_rv.sum()).round(3); o["weight_lv_pop"] = (w * ROLL * turnout / w.sum()).round(3)
o = o[list(five.columns)]; o.to_csv(OUT, index=False)
neff = lambda x: float(x.sum() ** 2 / (x ** 2).sum())
json.dump(dict(n=len(o), lv_asked_margin_before_match=before, lv_asked_margin_after=after, lv_deff_before=round(len(w) / neff(s.weight_lv.values), 3),
               lv_deff_after=round(len(w) / neff(w), 3), max_weight_change_ratio=round(float(np.max(w / s.weight_lv.values)), 3)), open(META, "w"), indent=1)
print(open(META).read())
