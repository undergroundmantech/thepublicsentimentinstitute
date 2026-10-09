"""DSMeridian Model 13R3 on every response in the TPSI national respondent database.

Each wave is run on its own, exactly as the production script runs a wave:
  Stage 2  IPF rake on the locked separate marginals Age, Gender, Race4, Region8 (cap 6, floor 0.12, 150 iterations)
  Stage 3  LV weight = RV weight x the respondent's PSI Pythagorean v8.1 propensity carried in the database
  Stage 4  aggregate only Meridian: high engagement decided anchors (intent score 0.70 or more), weighted category
           distributions of each signal for the Democratic and Republican anchor pools and for the undecided pool,
           match scores combined with the locked signal weights, one softmax at T = 8, and the days aware allocation
           fraction f(d) = 0.35 + 0.65 exp(-d / 60) from that wave's field close to Nov. 3, 2026
The waves are then pooled in proportion to their size. Signal columns in the database: Trump approval for the
Q12 insecurity signal, right track for Q9, age by gender, the vote history index, the economic strain item for the
Q19_7 economy signal and mass deportation support for Q19_15. The Q19_19 family values item was not carried into the
database, so its 0.02 weight is dropped and the others renormalized, as the production script already does by
dividing by the weight sum. A signal a wave did not ask is missing for everyone in that wave, so it matches equally
for both parties and moves nothing.
"""
import math, json, os
from datetime import date
import numpy as np, pandas as pd
BASE = os.path.dirname(os.path.abspath(__file__))
import tpsi_national as tn
ELECTION = date(2026, 11, 3)
SIGNAL_WEIGHTS = {"s_ins": .08, "s_bet": .08, "demo": .04, "hist_c": .04, "s_fin": .02, "s_rep": .02}
SOFTMAX_T, ANCHOR_Q3_MIN = 8.0, 0.70
RESOLVE_ELECTION_DAY, RESOLVE_LONG_RUN, RESOLVE_TAU_DAYS = 1.00, 0.35, 60.0
DEM, REP, THIRD, UND = "Democrat", "Republican", "Third party", "Undecided"

def resolve_share(d):
    return RESOLVE_ELECTION_DAY if d <= 0 else RESOLVE_LONG_RUN + (RESOLVE_ELECTION_DAY - RESOLVE_LONG_RUN) * math.exp(-d / RESOLVE_TAU_DAYS)

def dist(values, w):
    v = pd.Series(values, dtype=object).where(pd.notna(values), "__MISSING__")
    t = pd.DataFrame({"v": v.values, "w": w}).groupby("v")["w"].sum()
    return (t / t.sum()).to_dict() if t.sum() > 0 else {}

def stage4(s, w_lv, days):
    sig = {k: v / sum(SIGNAL_WEIGHTS.values()) for k, v in SIGNAL_WEIGHTS.items()}
    vote = s.generic_ballot.values
    dec = np.isin(vote, [DEM, REP]); und = vote == UND
    anchor = dec & (s.intent_score.values >= ANCHOR_Q3_MIN)
    prof = {c: {g: dist(s.loc[anchor & (vote == c), g].values, w_lv[anchor & (vote == c)]) for g in sig} for c in (DEM, REP)}
    up = {g: dist(s.loc[und, g].values, w_lv[und]) for g in sig}
    score = {c: sum(gw * sum(up[g].get(v, 0) * prof[c][g].get(v, 0) for v in set(up[g]) | set(prof[c][g])) for g, gw in sig.items()) for c in (DEM, REP)}
    ed, er = math.exp(SOFTMAX_T * score[DEM]), math.exp(SOFTMAX_T * score[REP]); sd = ed / (ed + er)
    alloc = resolve_share(days)
    bd, br, bt = (w_lv * (vote == DEM)).sum(), (w_lv * (vote == REP)).sum(), (w_lv * (vote == THIRD)).sum()
    ut = w_lv[und].sum(); tr = bt / max(bd + br + bt, 1e-12); res = ut * alloc
    wd = bd + res * (1 - tr) * sd; wr = br + res * (1 - tr) * (1 - sd); wt = bt + res * tr; wu = ut * (1 - alloc)
    tot = wd + wr + wt + wu
    return dict(D=100 * wd / tot, R=100 * wr / tot, T=100 * wt / tot, U=100 * wu / tot, observed_D=100 * bd / tot, observed_R=100 * br / tot,
                undecided_share_to_D=sd, alloc=alloc, days_out=days, anchors=int(anchor.sum()), n_und=int(und.sum()))

def run():
    import sys as _s; _s.path.insert(0, BASE); import respondent_v2 as _rv2; r = _rv2.load(BASE)   # unified respondent file, same filters everywhere (Sept 29 2026)
    r = r[(r.rqcm_flag != 1) & r.age_band.isin(tn.T_AGE) & r.gender.isin(tn.T_GENDER) & r.race4.isin(tn.T_RACE4) & r.region8.isin(tn.T_REGION8) & r.generic_ballot.notna()].copy()
    r["s_ins"] = r.trump_approve; r["s_bet"] = r.right_track; r["demo"] = r.age_band + "|" + r.gender
    r["hist_c"] = r.hist_idx.astype(str); r["s_fin"] = r.econ_strain; r["s_rep"] = r.deport_mass
    waves = {}
    for wv, g in r.groupby("wave_ym"):
        g = g.reset_index(drop=True)
        w_rv = tn.rake(g, tn.TARGETS); w_lv = w_rv * g.turnout_propensity.values; w_lv = w_lv * len(g) / w_lv.sum()
        days = (ELECTION - date.fromisoformat(str(g.field_end.max()))).days
        out = stage4(g, w_lv, days); out["n"] = len(g); waves[wv] = out
    n = sum(v["n"] for v in waves.values())
    pooled = {k: sum(v[k] * v["n"] for v in waves.values()) / n for k in ("D", "R", "T", "U", "observed_D", "observed_R")}
    pooled["two_party_d"] = pooled["D"] / (pooled["D"] + pooled["R"]); pooled["margin"] = pooled["D"] - pooled["R"]
    pooled["observed_two_party_d"] = pooled["observed_D"] / (pooled["observed_D"] + pooled["observed_R"]); pooled["n"] = n
    return dict(pooled=pooled, waves=waves)

if __name__ == "__main__":
    print(json.dumps(run(), indent=1, default=float))
