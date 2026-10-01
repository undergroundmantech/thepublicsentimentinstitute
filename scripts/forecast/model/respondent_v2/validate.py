"""Validation checks for the Sept 29 2026 run: respondent component v2 and third party level.
usage: python3 validate.py NEW_DIR OLD_DIR OUT_JSON"""
import sys, json, numpy as np

new, old, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
A = json.load(open(f"{old}/run_summary.json")); B = json.load(open(f"{new}/run_summary.json"))
ra, rb = A["results"], B["results"]
chk = {}

# 1 national calibration
chk["national_lv_d2_before"] = A.get("national_lv_d2"); chk["national_lv_d2_after"] = B.get("national_lv_d2")

# 2 respondent source and filters
any_r = next(v for v in rb.values() if v.get("respondent_model"))
chk["respondent_source"] = any_r["respondent_model"]["source"]
chk["pooling"] = any_r["respondent_model"]["pooling"]

# 3 M2 and final changes
rows = []
for k in sorted(rb):
    if k not in ra: continue
    a, b = ra[k], rb[k]
    rows.append(dict(race=k, m2_before=a["components_statewide"]["M2"], m2_after=b["components_statewide"]["M2"],
                     final_before=a["components_statewide"]["final_d2"], final_after=b["components_statewide"]["final_d2"],
                     margin_before=a["margin"], margin_after=b["margin"],
                     win_before=a["simulation"]["win_prob_dem_side"], win_after=b["simulation"]["win_prob_dem_side"],
                     state_fx=((b.get("respondent_model") or {}).get("state_effect") or {}).get("pooled_logit")))
dm2 = np.array([r["m2_after"] - r["m2_before"] for r in rows]); dm = np.array([r["margin_after"] - r["margin_before"] for r in rows])
chk["m2_change_points"] = dict(mean=round(float(dm2.mean()), 2), abs_max=round(float(np.abs(dm2).max()), 2), sd=round(float(dm2.std()), 2))
chk["margin_change_points"] = dict(mean=round(float(dm.mean()), 2), abs_max=round(float(np.abs(dm).max()), 2), sd=round(float(dm.std()), 2))
chk["largest_margin_moves"] = sorted(({"race": r["race"], "before": round(r["margin_before"], 2), "after": round(r["margin_after"], 2)} for r in rows),
                                     key=lambda x: -abs(x["after"] - x["before"]))[:8]

# 4 polling calibration: races with polls, final two party share against the poll average
gaps = []
for k, b in rb.items():
    pa = b.get("poll_avg") or {}
    if b.get("n_polls", 0) >= 3 and pa.get("D2") and not str(k).startswith("AK"):
        gaps.append(b["components_statewide"]["final_d2"] - 100 * pa["D2"])
gaps = np.array(gaps)
chk["final_vs_poll_two_party_gap"] = dict(races=int(len(gaps)), mean=round(float(gaps.mean()), 2), rmse=round(float(np.sqrt((gaps ** 2).mean())), 2))

# 5 universe: modeled likely voters against the certified 2022 turnout and the model's own 2026 turnout
uni = []
for k, b in rb.items():
    u = (b.get("respondent_model") or {}).get("universe"); h = ((b.get("electorate") or {}).get("history") or {})
    if u and h.get("turnout_2022"):
        uni.append(dict(race=k, vap=u["vap"], cvap=u["cvap"], registered=u["registered"], likely=u["likely_voters"],
                        certified_2022=round(h["turnout_2022"]), forecast_2026=round(b["turnout"]),
                        likely_over_2022=round(u["likely_voters"] / h["turnout_2022"], 3)))
lr = np.array([x["likely_over_2022"] for x in uni])
chk["universe_likely_over_2022"] = dict(races=len(uni), median=round(float(np.median(lr)), 3), p10=round(float(np.percentile(lr, 10)), 3), p90=round(float(np.percentile(lr, 90)), 3))
chk["cvap_over_vap_median"] = round(float(np.median([x["cvap"] / x["vap"] for x in uni])), 3)

# 6 third parties
low, zero, named = [], [], 0
for k, b in rb.items():
    for nm, pty in b.get("third_parties", []):
        v = b["topline"].get(nm)
        if v is None: continue
        named += 1
        if v <= 0.05: zero.append((k, nm, round(v, 2)))
        elif v < 0.3: low.append((k, nm, round(v, 2)))
chk["third_party"] = dict(candidates=named, at_zero=zero, below_0_3=low)
before_zero = sum(1 for k, a in ra.items() for nm, _ in a.get("third_parties", []) if a["topline"].get(nm, 1) <= 0.05)
chk["third_party"]["at_zero_before"] = before_zero

# 7 crosstab constraint and ranges
errs, cover = [], []
for k, b in rb.items():
    xt = b.get("crosstabs")
    if not xt: continue
    errs.append(xt.get("max_county_error", 0))
    tot = xt["rows"][0]; rg = {(r[0], r[1]): r for r in xt.get("ranges", [])}
    if ("All voters", "Total") in rg and b.get("simulation"):
        cover.append(k)
chk["crosstab_max_county_error"] = float(max(errs)) if errs else None
chk["crosstab_ranges_present"] = len(cover)

json.dump(dict(checks=chk, races=rows, universe=uni), open(out_path, "w"), indent=1)
print(json.dumps(chk, indent=1))
