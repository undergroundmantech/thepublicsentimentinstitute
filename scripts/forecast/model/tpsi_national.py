"""TPSI national generic ballot from the respondent database, on DSMeridian Model 13R3 Stages 2 and 3.

Stage 2  RV electorate: IPF rake on the locked separate national marginals, Age, Gender, Race4 and Region8, weights
         capped at 6 and floored at 0.12 of the mean, 150 iterations. Speeders flagged by RQCM are excluded.
Stage 3  LV electorate: RV weight times each respondent's PSI Pythagorean v8.1 likely voter propensity, the one the
         database carries from its own wave and panel anchor.
The generic ballot is the two party share of decided likely voters. No undecided allocation is applied, since the
Meridian step in Stage 4 is a house reporting convention and not a vote estimate.
"""
import numpy as np, pandas as pd, os
BASE = os.path.dirname(os.path.abspath(__file__))
T_AGE = {"18-29": 16.00, "30-44": 25.00, "45-64": 32.00, "65+": 27.00}
T_GENDER = {"Male": 48.21, "Female": 51.79}
T_RACE4 = {"White": 71.00, "Black": 11.00, "Hispanic": 11.00, "Asian/Other": 7.00}
T_REGION8 = {"New England": 4.80, "Mid-Atlantic": 15.00, "Southeast Atlantic": 17.00, "Appalachia / South Interior": 8.10,
             "Great Lakes": 17.20, "Lower Midwest / Plains": 6.10, "Southwest": 11.70, "West / Mountain / Pacific": 20.10}
TARGETS = {"age_band": T_AGE, "gender": T_GENDER, "race4": T_RACE4, "region8": T_REGION8}

def rake(df, targets, n_iter=150, cap=6.0, floor=0.12):
    w = np.ones(len(df))
    for _ in range(n_iter):
        for col, tgt in targets.items():
            tot = sum(tgt.values())
            for val, t in tgt.items():
                m = (df[col] == val).values
                cur = w[m].sum() / w.sum()
                if cur > 0: w[m] *= (t / tot) / cur
        w *= len(df) / w.sum(); w = np.clip(w, floor * w.mean(), cap * w.mean()); w *= len(df) / w.sum()
    return w

def estimate(waves=None):
    import sys as _s; _s.path.insert(0, BASE); import respondent_v2 as _rv2; r = _rv2.load(BASE)   # unified respondent file, same filters everywhere (Sept 29 2026)
    r = r[(r.rqcm_flag != 1) & r.age_band.isin(T_AGE) & r.gender.isin(T_GENDER) & r.race4.isin(T_RACE4) & r.region8.isin(T_REGION8)]
    if waves: r = r[r.wave_ym.isin(waves)]
    w_rv = rake(r, TARGETS); w_lv = w_rv * r.turnout_propensity.values
    gb = r.generic_ballot.values
    out = {}
    for nm, w in [("rv", w_rv), ("lv", w_lv)]:
        tot = w[pd.notna(gb)].sum()
        sh = {k: 100 * w[gb == k].sum() / tot for k in ["Democrat", "Republican", "Third party", "Undecided"]}
        out[nm] = dict(**sh, two_party_d=sh["Democrat"] / (sh["Democrat"] + sh["Republican"]), margin=sh["Democrat"] - sh["Republican"])
    out["n"] = int(len(r)); out["n_lv_eff"] = float(w_lv.sum() ** 2 / (w_lv ** 2).sum())
    out["waves"] = sorted(r.wave_ym.unique().tolist())
    return out

if __name__ == "__main__":
    import json
    print(json.dumps(estimate(), indent=1))
    print(json.dumps(estimate(["2026-09"]), indent=1))
