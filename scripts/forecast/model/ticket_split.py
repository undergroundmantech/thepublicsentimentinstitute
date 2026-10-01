"""Ticket splitting between the Senate and governor races on one ballot (Sept 29 2026).
usage: python3 ticket_split.py OUT_DYN

For every state with both races, the two runs' voter types are matched county by county. Each type votes
Democratic for Senate with chance pS and for governor with chance pG. The share voting Democratic in both is placed
between the least splitting those two chances allow, min(pS, pG), and the most, max(0, pS + pG - 1), at the type's
looseness lambda from TPSI respondents (behavior.py): P(both D) = min - lambda x (min - floor). So a straight
partisan type splits only as much as the two races differ for it, and a loose independent type splits more.
Writes results[race]["ticket_splitting"] into run_summary.json and OUT_DYN/ticket_splitting.json."""
import sys, os, json
import numpy as np, pandas as pd

OUT = sys.argv[1]
inv = lambda x: 1 / (1 + np.exp(-x))
S = json.load(open(f"{OUT}/run_summary.json"))
R = S["results"]
AGE = ["18 to 29", "30 to 44", "45 to 64", "65+"]; RACE = ["White", "Black", "Latino", "Asian and other"]
PARTY = ["Democrat", "Republican", "Independent"]; APPR = {1: "Approve", 0: "No opinion", -1: "Disapprove"}
HIST = ["Voted 2022 and 2024", "Voted 2022, not 2024", "Voted 2024, not 2022", "New or irregular"]

def load(k):
    p = f"{OUT}/behavior_types_{k}.npz"
    return np.load(p, allow_pickle=True) if os.path.exists(p) else None

def sim_win(k):
    p = f"{OUT}/sim_margin_{k}.npy"
    return np.load(p) > 0 if os.path.exists(p) else None

report = {}
for sen in sorted(k for k in R if not k.endswith("G")):
    gov = sen + "G"
    if gov not in R: continue
    a, b = load(sen), load(gov)
    if a is None or b is None: continue
    fa, fb = list(a["fips"]), list(b["fips"])
    common = [f for f in fa if f in set(fb)]
    ia = np.array([fa.index(f) for f in common]); ib = np.array([fb.index(f) for f in common])
    Va = a["pops"][ia] * inv(a["lt"][ia]); Vb = b["pops"][ib] * inv(b["lt"][ib])
    V = 0.5 * (Va + Vb)                                                          # one electorate, the two runs' mean
    pS, pG = inv(a["eta"][ia]).astype(float), inv(b["eta"][ib]).astype(float)
    lam = a["lam"].astype(float)[None, :]
    mn = np.minimum(pS, pG); fl = np.maximum(0.0, pS + pG - 1)
    dd = mn - lam * (mn - fl)
    sDgR = pS - dd; sRgD = pG - dd
    gg = a["gg"].astype(int); side = a["side"].astype(int)
    tot = V.sum()
    def share(x, m=None):
        w = V if m is None else V[:, m]; xx = x if m is None else x[:, m]
        return round(100 * float((w * xx).sum() / w.sum()), 2)
    groups = []
    labs = [("Party", np.array(PARTY)[(gg // 4) % 3]), ("Trump approval", np.array([APPR[s] for s in side])),
            ("Age", np.array(AGE)[gg // 96]), ("Race", np.array(RACE)[((gg // 12) // 2) % 4]),
            ("Vote history", np.array(HIST)[gg % 4])]
    for cat, lab in labs:
        for v in pd.unique(lab):
            m = lab == v
            if V[:, m].sum() / tot < 0.01: continue
            groups.append(dict(cut=cat, group=str(v), share_of_voters=round(100 * float(V[:, m].sum() / tot), 1),
                               split=share(sDgR + sRgD, m), senate_d_governor_r=share(sDgR, m), senate_r_governor_d=share(sRgD, m)))
    # counties: where splitting is heaviest
    cs = (V * (sDgR + sRgD)).sum(1) / V.sum(1)
    top = np.argsort(-cs)[:5]
    wa, wb = sim_win(sen), sim_win(gov)
    joint = None
    if wa is not None and wb is not None and len(wa) == len(wb):
        joint = dict(both_democratic_side=round(100 * float((wa & wb).mean()), 1), both_republican=round(100 * float((~wa & ~wb).mean()), 1),
                     senate_d_governor_r=round(100 * float((wa & ~wb).mean()), 1), senate_r_governor_d=round(100 * float((~wa & wb).mean()), 1),
                     outcome_correlation=round(float(np.corrcoef(np.load(f"{OUT}/sim_margin_{sen}.npy"), np.load(f"{OUT}/sim_margin_{gov}.npy"))[0, 1]), 3))
    rep = dict(senate=sen, governor=gov, split_ticket_share=share(sDgR + sRgD), senate_d_governor_r=share(sDgR), senate_r_governor_d=share(sRgD),
               least_possible_split=share(np.abs(pS - pG)), groups=groups,
               heaviest_split_counties=[dict(fips=str(common[i]), split=round(100 * float(cs[i]), 1)) for i in top],
               simulated_outcomes=joint,
               method="P(both D) = min(pS, pG) - lambda x (min(pS, pG) - max(0, pS + pG - 1)), lambda from TPSI 2024 to 2026 switching by party and vote history")
    report[sen] = rep
    R[sen]["ticket_splitting"] = rep; R[gov]["ticket_splitting"] = rep
json.dump(S, open(f"{OUT}/run_summary.json", "w"), indent=1, default=float)
json.dump(report, open(f"{OUT}/ticket_splitting.json", "w"), indent=1)
for k, v in report.items():
    j = v["simulated_outcomes"] or {}
    print(f"{k:3s} split {v['split_ticket_share']:5.1f}  S-D/G-R {v['senate_d_governor_r']:5.1f}  S-R/G-D {v['senate_r_governor_d']:5.1f}  least {v['least_possible_split']:5.1f}  "
          f"split outcome {j.get('senate_d_governor_r', 0) + j.get('senate_r_governor_d', 0):5.1f}%  r {j.get('outcome_correlation')}")
