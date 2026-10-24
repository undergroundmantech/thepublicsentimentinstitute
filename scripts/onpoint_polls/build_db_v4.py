"""Unified respondent dataset v4, Oct 24 2026: v3 plus the On Point Iowa and Kansas respondents (Oct 19 to 21 2026), 477 and
470, harmonized to the five state layout by /tmp/fs5/iaks_build/desk_iaks.py, source_dataset onpoint_ia_ks_oct2026.
With the Iowa and Kansas file left out this script writes v3 byte for byte.

usage: python3 -I build_db_v4.py NATIONAL_CSV FIVE_STATE_CSV COUNTY_NAMES_CSV OUT_CSV AUDIT_JSON [EXTRA_POLL_CSV ...]

Unified respondent dataset v3, Oct 19 2026: the national waves plus the 2,994 On Point five state respondents
(OH, TX, MI, FL, SC, fielded Oct 16 to 19 2026), harmonized to the existing variables and kept as one dataset.

usage: python3 -I build_db_v3.py NATIONAL_CSV FIVE_STATE_CSV COUNTY_NAMES_CSV OUT_CSV AUDIT_JSON

What it adds
- source_dataset: tpsi_national for the existing rows, onpoint_five_state_oct2026 for the new ones
- zip (5 digit), county (name) and county_fips for every row where known; state and zip3 already existed
- the 2026 Senate, governor and Texas Railroad Commissioner choice as asked, party code and the leaner probability,
  the 12 Trump issue approvals and the data center item, as op5_ columns
- weights. weight_rv and weight_lv become pooled design weights: inside each of the five states the national rows
  and the five state rows share the weight the national rows carried there, split by effective sample size, so every
  state keeps its share of the national electorate and national estimates are not tilted toward the five states.
  The original wave and state weights are kept as weight_rv_design and weight_lv_design.
- generic ballot. The five state polls did not ask it. Rows without an observed generic ballot get a modeled one
  from a refreshed imputation model (see refresh_generic_ballot); the source and confidence columns mark them as
  modeled, so every consumer that drops modeled outcomes keeps dropping them.
"""
import sys, json, re
import numpy as np, pandas as pd

NAT, FIVE, CNAMES, OUT, AUD = sys.argv[1:6]
n = pd.read_csv(NAT, low_memory=False)
f = pd.read_csv(FIVE, low_memory=False, dtype={"zip": str, "county": str}); f["_src"] = "onpoint_five_state_oct2026"
_x = [pd.read_csv(p, low_memory=False, dtype={"zip": str, "county": str}).assign(_src="onpoint_ia_ks_oct2026") for p in sys.argv[6:]]
if _x: f = pd.concat([f] + _x, ignore_index=True)
cn = pd.read_csv(CNAMES, dtype={"county_fips": str})
audit = dict(national_rows=int(len(n)), five_state_rows=int(len(f)))

# geography --------------------------------------------------------------------------------------------------
AB = {'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT','Delaware':'DE',
      'District of Columbia':'DC','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
      'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN',
      'Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
      'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR',
      'Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT',
      'Vermont':'VT','Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'}
cn["st"] = cn.state_name.map(AB)
def norm(s):
    s = str(s).lower().replace("saint ", "st. ").replace("st ", "st. ")
    s = re.sub(r"\b(county|parish|borough|census area|municipality)\b", "", s)
    return re.sub(r"[^a-z]", "", s)
cn["k"] = cn.st + "|" + cn.county_name.map(norm)
CF = dict(zip(cn.k, cn.county_fips))
f["zip"] = f.zip.astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(5)
f["county_fips"] = (f.state + "|" + f.county.map(norm)).map(CF)
audit["five_state_county_matched"] = float(f.county_fips.notna().mean())
audit["five_state_county_unmatched"] = sorted(set((f.state + "|" + f.county.astype(str))[f.county_fips.isna()]))[:40]

REG8 = n.groupby("state").region8.agg(lambda s: s.mode().iat[0]).to_dict()
REG4 = n.groupby("state").census_region4.agg(lambda s: s.mode().iat[0]).to_dict()

# harmonize ---------------------------------------------------------------------------------------------------
m = pd.DataFrame(index=f.index)
m["respondent_id"] = "OP5-" + f.state + "-" + f.resp_id.astype(str)
m["source_dataset"] = f._src.values
m["wave"] = np.where(f._src == "onpoint_ia_ks_oct2026", "2026-10 On Point Iowa and Kansas Polls", "2026-10 On Point Five State Polls")
m["wave_group"] = np.where(f._src == "onpoint_ia_ks_oct2026", "Iowa and Kansas Oct 2026", "Five State Oct 2026"); m["wave_ym"] = "2026-10"
m["panel"] = "CINT/Qualtrics"; m["source_resp"] = f.cint_rid.astype(str); m["field_end"] = f.field_end
m["age_band"] = f.age_band.map({"18 to 29": "18-29", "30 to 44": "30-44", "45 to 64": "45-64", "65 plus": "65+"})
m["gender"] = f.gender; m["race4"] = f.race4; m["race_detail"] = f.survey_race; m["hispanic"] = (f.race4 == "Hispanic").astype(float)
m["state"] = f.state; m["region8"] = f.state.map(REG8); m["census_region4"] = f.state.map(REG4)
m["zip"] = f.zip; m["zip3"] = pd.to_numeric(f.zip.str[:3], errors="coerce"); m["county"] = f.county
m["county_fips"] = pd.to_numeric(f.county_fips, errors="coerce")
for y in (2024, 2022, 2020, 2018): m[f"voted_{y}"] = f[f"voted_{y}"].astype(int)
m["vote_history_years"] = [";".join(str(y) for y in (2024, 2022, 2020, 2018) if r[f"voted_{y}"] == 1) or np.nan for _, r in f.iterrows()]
m["hist_idx"] = f.vote_history_count.astype(int)
m["turnout_intent"] = f.vote_intent.map({
    "I am certain to vote and highly motivated to do so": "Certain / highly motivated",
    "I am very likely to vote and feel motivated": "Very likely / motivated",
    "I am somewhat likely to vote but not strongly motivated": "Somewhat likely",
    "I am motivated but unsure if I will actually vote": "Motivated but unsure",
    "I am not very likely to vote and feel little motivation": "Not very likely",
    "I am certain not to vote": "Certain not to vote"})
def method(s):
    s = str(s)
    if s.startswith("In person on Election Day"): return ("Election Day in person, location known" if "know my" in s else "Election Day in person, location unconfirmed"), "Election Day"
    if s.startswith("Early in-person"):
        return ("Early in person, already voted" if "already voted" in s else "Early in person, details known" if "I know" in s else "Early in person, details unknown"), "Early in person"
    if s.startswith(("Absentee", "Vote-by-mail", "Mail")):
        return ("Mail/absentee, already returned" if "returned" in s else "Mail/absentee, ballot in hand" if ("received" in s or "requested" in s) else "Mail/absentee, not yet requested"), "Mail"
    if "do not plan" in s: return "Does not plan to vote", "Not voting"
    if "decided" in s: return "Undecided on method", "Undecided on method"
    return np.nan, np.nan
mm = f.vote_method.map(method)
m["ballot_method"] = mm.str[0]; m["vote_method"] = mm.str[1]
m["already_voted"] = f.already_voted.astype(float)
m["close_contacts"] = f.contacts_voting.map({"All or nearly all of them": "All or nearly all", "Most of them": "Most", "About half": "About half",
                                             "A few of them": "A few", "Not sure": "Not sure", "None of them": "None of them"})
m["turnout_propensity"] = f.turnout_propensity
m["likely_voter"] = (f.turnout_propensity >= 0.5).astype(int)
m["recall_2024"] = f.recall_2024.map({"Donald Trump": "Trump", "Kamala Harris": "Harris", "Did not vote": "Did not vote", "Third party": "Third party"})
pid = f.party_id.replace({"Independent / Other": "Independent"})
reg = f.party_registration.map({"Republican Party": "Republican", "Democratic Party": "Democrat", "Independent Party of Florida": "Independent",
                                "No Party Affiliation, also called NPA": "Independent", "Another party, such as Libertarian": "Independent"})
m["party_id"] = pid.where(f.state != "FL", reg)
m["party_id_note"] = np.where(f.state == "FL", "Florida asked party registration; registration used as party",
                              np.where(f.state.isin(["IA", "KS"]), "Iowa and Kansas asked party registration; registration used as party", ""))
m["trump_approve"] = f.trump_approval
m["trump_approve_2way"] = f.trump_approval.map({"Strongly approve": "Approve", "Somewhat approve": "Approve", "Strongly disapprove": "Disapprove",
                                                "Somewhat disapprove": "Disapprove", "Neutral / no opinion": "Neutral"})
PT = sorted(n.political_type.dropna().unique())
def ptype(s):
    s = str(s)
    if s.startswith("None of these"): return "No clear preference"
    head = s.split(" (")[0].strip()
    return head if head in PT else np.nan
m["political_type"] = f.political_outlook.map(ptype)
m["issue_top1"] = f.top_issue
m["edu4"] = f.edu4; m["college"] = f.college.map({"College": "COLLEGE", "No college": "NON-COLLEGE"})
m["analysis_ready"] = 1; m["rqcm_flag"] = 0
# observed item bookkeeping, matching the unified file's conventions
for c in ["recall_2024", "trump_approve", "party_id", "political_type", "issue_top1"]:
    obs = m[c].notna()
    m[f"{c}_observed"] = m[c]; m[f"{c}_source"] = np.where(obs, "observed", None); m[f"{c}_confidence"] = np.where(obs, 1.0, np.nan)
    m[f"{c}_est"] = m[c]; m[f"{c}_src"] = np.where(obs, "observed", None); m[f"{c}_conf"] = np.where(obs, 1.0, np.nan)
    for pc in [x for x in n.columns if x.startswith(f"{c}_p_")]:
        lab = pc[len(c) + 3:]
        m[pc] = np.where(obs, (m[c].fillna("").str.lower().str.replace(r"[^a-z0-9]+", "_", regex=True).str[:len(lab)] == lab).astype(float), np.nan)
# 2026 races and items only these polls asked
for race, src in [("senate", "senate"), ("governor", "governor"), ("rrc", "railroad_comm")]:
    m[f"op5_{race}_choice"] = f[f"{src}_choice"]; m[f"op5_{race}_party"] = f[f"{src}_party"]; m[f"op5_{race}_undecided_p_dem"] = f[f"{src}_undecided_p_dem"]
for c in [x for x in f.columns if x.startswith("trump_on_")] + ["data_centers", "trump_approval_score", "political_outlook", "region", "zip_type", "race_edu"]:
    m[f"op5_{c}"] = f[c]
m["op5_state_region"] = f.region
m["weight_rv_design"] = f.weight_rv; m["weight_lv_design"] = f.weight_lv
m["weight_rv_pop"] = f.weight_rv_pop; m["weight_lv_pop"] = f.weight_lv_pop

n = n.copy()
n["source_dataset"] = "tpsi_national"
n["weight_rv_design"] = n.weight_rv; n["weight_lv_design"] = n.weight_lv

# pooled design weights -------------------------------------------------------------------------------------------
neff = lambda w: float(w.sum() ** 2 / (w ** 2).sum()) if len(w) else 0.0
pool = {}
wrv, wlv = n.weight_rv.astype(float).copy(), n.weight_lv.astype(float).copy()
m["weight_rv"] = np.nan; m["weight_lv"] = np.nan
for s in sorted(m.state.unique()):
    ni = n.state == s; fi = m.state == s
    Wr, Wl = float(n.weight_rv[ni].sum()), float(n.weight_lv[ni].sum())
    e_n, e_f = neff(n.weight_rv[ni]), neff(m.weight_rv_design[fi])
    a = e_n / (e_n + e_f)
    wrv[ni] *= a; wlv[ni] *= a
    m.loc[fi, "weight_rv"] = (1 - a) * Wr * m.weight_rv_pop[fi] / m.weight_rv_pop[fi].sum()
    m.loc[fi, "weight_lv"] = (1 - a) * Wl * m.weight_lv_pop[fi] / m.weight_lv_pop[fi].sum()
    pool[s] = dict(national_rows=int(ni.sum()), national_weight=round(Wr, 2), national_neff=round(e_n, 1), five_state_neff=round(e_f, 1),
                   national_share_kept=round(a, 3))
n["weight_rv"], n["weight_lv"] = wrv, wlv
audit["pooled_weights"] = pool

all_ = pd.concat([n, m[[c for c in m.columns]]], ignore_index=True, sort=False)

# refresh the generic ballot imputation ------------------------------------------------------------------------------
# A two way generic ballot model fitted on every observed national answer, with the five state respondents' 2026 votes
# as a second, down weighted label (each race half a vote, candidate effects average out across the two races).
def feats(d):
    X = pd.DataFrame(index=d.index)
    for c, levels in [("party_id", ["Democrat", "Republican"]), ("recall_2024", ["Harris", "Trump", "Did not vote"]),
                      ("trump_approve_2way", ["Approve", "Disapprove"]), ("race4", ["Black", "Hispanic", "Asian/Other"]),
                      ("age_band", ["18-29", "30-44", "65+"]), ("college", ["COLLEGE"]), ("gender", ["Female"])]:
        for l in levels: X[f"{c}={l}"] = (d[c] == l).astype(float)
    X["const"] = 1.0
    return X
def irls(X, y, w, lam=1.0, it=50):
    b = np.zeros(X.shape[1])
    for _ in range(it):
        p = 1 / (1 + np.exp(-X @ b)); W = w * p * (1 - p)
        H = X.T @ (X * W[:, None]) + lam * np.eye(X.shape[1]); g = X.T @ (w * (y - p)) - lam * b
        b = b + np.linalg.solve(H, g)
    return b
nat_obs = all_[(all_.source_dataset == "tpsi_national") & all_.gb_2way.isin(["Democrat", "Republican"])]
X0 = feats(nat_obs).values; y0 = (nat_obs.gb_2way == "Democrat").values.astype(float); w0 = np.ones(len(nat_obs))
b_nat = irls(X0, y0, w0)
# external check: how well the national generic ballot model predicts the five state race votes
fv = all_[all_.source_dataset == "onpoint_five_state_oct2026"]
fv_all = all_[all_.source_dataset.astype(str).str.startswith("onpoint_")]
chk = {}
for race in ("senate", "governor"):
    dd = fv[fv[f"op5_{race}_party"].isin(["D", "R"])]
    p = 1 / (1 + np.exp(-feats(dd).values @ b_nat)); y = (dd[f"op5_{race}_party"] == "D").values
    w = dd.weight_lv_design.values
    chk[race] = dict(n=int(len(dd)), predicted_D_two_way=round(float((w * p).sum() / w.sum()) * 100, 1),
                     actual_D_two_way=round(float((w * y).sum() / w.sum()) * 100, 1),
                     brier=round(float((w * (p - y) ** 2).sum() / w.sum()), 4))
audit["generic_ballot_model_vs_five_state_votes"] = chk
rows = []
for race in ("senate", "governor"):
    dd = fv_all[fv_all[f"op5_{race}_party"].isin(["D", "R"])]
    rows.append((feats(dd).values, (dd[f"op5_{race}_party"] == "D").values.astype(float), np.full(len(dd), 0.5)))
X1 = np.vstack([X0] + [r[0] for r in rows]); y1 = np.concatenate([y0] + [r[1] for r in rows]); w1 = np.concatenate([w0] + [r[2] for r in rows])
b_ref = irls(X1, y1, w1)
audit["generic_ballot_coefficients"] = dict(columns=list(feats(nat_obs).columns), national_only=[round(x, 3) for x in b_nat],
                                            refreshed=[round(x, 3) for x in b_ref])
# apply: every row without an observed generic ballot gets the refreshed two way estimate as a modeled value
need = all_.generic_ballot_observed.isna() if "generic_ballot_observed" in all_ else all_.generic_ballot.isna()
need = need & all_.generic_ballot.isna()
all_ = all_.copy()
P = pd.Series(1 / (1 + np.exp(-feats(all_[need]).values @ b_ref)), index=all_.index[need])
old_est = all_.loc[need & (all_.source_dataset == "tpsi_national"), "generic_ballot_est"].value_counts().to_dict()
# national rows: the earlier four way imputation keeps its undecided and third party mass; only the split of the
# two party mass between Democrat and Republican is refreshed, and the label is redrawn only inside the two parties
# rows that skipped party, recall and approval carry nothing for the model to work from; their earlier estimate stays
_have = all_[["party_id", "recall_2024", "trump_approve_2way"]].notna().sum(axis=1) >= 2
natn = need & (all_.source_dataset == "tpsi_national") & _have
pD0, pR0 = all_.loc[natn, "generic_ballot_p_democrat"].fillna(0.0), all_.loc[natn, "generic_ballot_p_republican"].fillna(0.0)
two = (pD0 + pR0).clip(lower=1e-9)
all_.loc[natn, "generic_ballot_p_democrat"] = two * P[natn]; all_.loc[natn, "generic_ballot_p_republican"] = two * (1 - P[natn])
inparty = natn & all_.generic_ballot_est.isin(["Democrat", "Republican"])
all_.loc[inparty, "generic_ballot_est"] = np.where(P[inparty] >= 0.5, "Democrat", "Republican")
# five state rows: no generic ballot was asked; the modeled two way value, marked as modeled
fsn = need & (all_.source_dataset != "tpsi_national")
all_.loc[fsn, "generic_ballot_est"] = np.where(P[fsn] >= 0.5, "Democrat", "Republican")
all_.loc[fsn, "generic_ballot_p_democrat"] = P[fsn]; all_.loc[fsn, "generic_ballot_p_republican"] = 1 - P[fsn]
all_.loc[fsn, "generic_ballot_conf"] = np.maximum(P[fsn], 1 - P[fsn]); all_.loc[fsn, "generic_ballot_confidence"] = np.maximum(P[fsn], 1 - P[fsn])
upd = natn | fsn
all_.loc[upd, "generic_ballot_src"] = "modeled"; all_.loc[upd, "generic_ballot_source"] = "imputed"
all_.loc[upd, "generic_ballot_imputation"] = "2026-10-19 refresh of the two party split with five state 2026 votes"
audit["generic_ballot_refreshed_rows"] = dict(national=int(natn.sum()), national_kept_no_predictors=int((need & (all_.source_dataset == "tpsi_national") & ~_have).sum()),
                                             five_state=int((need & (all_.source_dataset != "tpsi_national")).sum()),
                                             national_previous_est=old_est,
                                             national_new_est=all_.loc[need & (all_.source_dataset == "tpsi_national"), "generic_ballot_est"].value_counts().to_dict())
# national estimates are not tilted: compare pooled versus national only toplines
def top(d, c, val, w):
    x = d[d[c].notna()]; return round(100 * float((x[w] * (x[c] == val)).sum() / x[w].sum()), 2)
nat_only = all_[all_.source_dataset == "tpsi_national"]
audit["national_check"] = dict(
    trump_approve_strongly_disapprove=dict(national_only=top(nat_only, "trump_approve", "Strongly disapprove", "weight_rv_design"),
                                           pooled=top(all_, "trump_approve", "Strongly disapprove", "weight_rv")),
    recall_trump=dict(national_only=top(nat_only, "recall_2024", "Trump", "weight_rv_design"), pooled=top(all_, "recall_2024", "Trump", "weight_rv")),
    five_state_weight_share=dict(national_only=round(100 * float(nat_only[nat_only.state.isin(list(pool))].weight_rv_design.sum() / nat_only.weight_rv_design.sum()), 2),
                                 pooled=round(100 * float(all_[all_.state.isin(list(pool))].weight_rv.sum() / all_.weight_rv.sum()), 2)))
audit["rows_out"] = int(len(all_)); audit["columns_out"] = int(all_.shape[1])
all_.to_csv(OUT, index=False)
json.dump(audit, open(AUD, "w"), indent=1, default=str)
print(json.dumps(audit, indent=1, default=str)[:4000])
