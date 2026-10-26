"""The early vote as the forecast's party electorate, Oct 26 2026.

For every state the final electorate by 2024 vote group is the forecast's expected 2026 mix moved by what the early vote
shows (ev_signals.ts from the civicAPI feeds and the On Point Polling party modeler): the full move where the state
reports party, 0.35 of it where party is estimated. Each group is read as party identification with the On Point Polling
likely voter database. The change in the Democratic minus Republican share of the electorate is then turned into the
engine's partisan turnout term (electorate.py, Democrats up and Republicans down in turnout log odds), solved so the
electorate's party mix moves by exactly that much at a typical midterm turnout. This replaces ev_adjust.py, which moved
the published races after the fact; now the early vote is inside the electorate the forecast simulates, once.
Writes /tmp/fcrun/fm/ev_enth.json.  usage: python3 -I ev_electorate.py EV_SIGNALS_JSON
"""
import json, sys, math
import pandas as pd
EV = json.load(open(sys.argv[1]))["states"]
E = json.load(open("/tmp/site/public/earlyvote-electorate.json"))
R = pd.read_csv("/tmp/fcrun/TPSI_B/model/tpsi_db/TPSI_Unified_Respondent_Dataset.csv", low_memory=False, usecols=["party_id", "recall_2024", "weight_lv"])
R = R[R.weight_lv > 0]; R["g"] = R.recall_2024.map({"Trump": 0, "Harris": 1}).fillna(2).astype(int)
P = ["Democrat", "Republican", "Independent"]
pg = R.groupby(["g", "party_id"]).weight_lv.sum().unstack().reindex(columns=P).fillna(0); pg = pg.div(pg.sum(1), axis=0)
mix = lambda g: [sum(g[i] * pg.iloc[i][p] for i in range(3)) for p in P]
inv = lambda x: 1 / (1 + math.exp(-x))
T0 = 0.0     # typical midterm turnout log odds, turnout one half
def moved(s, e):
    w = [s[0] * inv(T0 + e), s[1] * inv(T0 - e), s[2] * inv(T0)]; t = sum(w)
    return [x / t for x in w]
out = {}
for st, v in EV.items():
    if st not in E["states"] or not v.get("projected"): continue
    fc = v["forecastElectorate"]; k = 0.35 if (v.get("estimatedShare") or 0) >= 0.5 else 1.0
    g = [fc[i] + k * (v["projected"][i] - fc[i]) for i in range(3)]; g = [x / sum(g) for x in g]
    s0, s1 = mix(fc), mix(g)
    gap = (s1[0] - s1[1]) - (s0[0] - s0[1])           # change in D minus R share of the electorate
    lo, hi = -1.5, 1.5
    for _ in range(60):
        e = 0.5 * (lo + hi); m = moved(s0, e)
        lo, hi = (e, hi) if (m[0] - m[1]) - (s0[0] - s0[1]) < gap else (lo, e)
    out[st] = dict(enth_ev=round(0.5 * (lo + hi), 4), party_gap_pts=round(100 * gap, 2), strength=k,
                   ballots=v["ballots"], banked=round(v["ballots"] / max(1, v.get("expectedTotal") or 1), 3),
                   final_party_rd=round(100 * (s1[1] - s1[0]), 2), expected_party_rd=round(100 * (s0[1] - s0[0]), 2))
json.dump(out, open("/tmp/fcrun/fm/ev_enth.json", "w"), indent=1)
for st in ("FL", "GA", "NC", "PA", "MI", "TX", "NE", "AZ", "NV", "IA", "KS", "ME"):
    if st in out: print(st, out[st])
