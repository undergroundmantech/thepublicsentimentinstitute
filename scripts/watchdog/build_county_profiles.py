"""County profiles for the Watchdog county data center (Oct 22 2026).

For every county in a state with a 2026 Senate or governor forecast, reads that race's simulated voter types from
the forecast run the swingometer uses (behavior_types_<KEY>.npz: adults, turnout propensity and Democratic preference
by county for 1,152 types = 32 age, race and college cells x party x 2022/2024 vote history x Trump approval) and
writes the county's modeled electorate: turnout, propensity tiers, 2024 Trump and Harris voters split by propensity,
party by propensity, Trump approval groups, and age, race, college and vote history groups, each with its share and
its modeled 2026 margin. A type's 2024 vote is split the same way build_swing_types.py does it, from aggregates of
On Point Polling respondents of the same party, history and approval, with the parts moved by one common log odds
offset per county and type so they add back to that county type's own preference. Only county aggregates are written.

It also adds the TPSI county Trump approval file and the latest AAA county gas price.

Usage: python3 build_county_profiles.py SITE_DIR GAS_CSV
Margins are R minus D in points, the sign the site uses.
"""
import csv, glob, json, os, sys
import numpy as np

SITE, GAS = sys.argv[1], sys.argv[2]
MODEL_DIR = "/tmp/fcrun/TPSI_B/model"
APPROVAL = f"{MODEL_DIR}/41050065-TEXASMODELFINAL_2/TEXASMODELFINAL/TPSI_Trump_Approval_By_County_Combined_FULL.csv"
HI, MID = 0.80, 0.55
sys.path.insert(0, MODEL_DIR); os.chdir(MODEL_DIR)
import senate_mode as sm, voters as vf  # noqa: E402

inv = lambda x: 1 / (1 + np.exp(-x))
lg = lambda p: np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4)))

# respondent aggregates by party j, history h and approval a, exactly as build_swing_types.py
r = vf.prep(sm)
REC = ["Trump", "Harris", "Third party", "Did not vote"]; APP = ["Approve", "Neutral", "Disapprove"]
glob_rec = np.array([(r.recall == x).mean() for x in REC])
recw = np.zeros((3, 4, 3, 4)); qD = np.zeros((3, 4, 3, 4))
gb = r.gb_2way
qall = {x: ((gb == "Democrat") & (r.recall == x)).sum() / max(((gb.isin(["Democrat", "Republican"])) & (r.recall == x)).sum(), 1) for x in REC}
for j in range(3):
    for h in range(4):
        for a, an in enumerate(APP):
            g = r[(r.j == j) & (r.h == h) & (r.appr == an)]; gj = r[(r.j == j) & (r.h == h)]
            prior = np.array([(gj.recall == x).mean() if len(gj) else glob_rec[i] for i, x in enumerate(REC)])
            cnt = np.array([(g.recall == x).sum() for x in REC], float)
            w = (cnt + 8 * prior) / (cnt.sum() + 8)
            if h in (1, 3): w = np.array([0.0, 0.0, 0.0, 1.0])
            else: w[3] = 0.0
            recw[j, h, a] = w / max(w.sum(), 1e-9)
            for i, x in enumerate(REC):
                gg_ = g[(g.recall == x) & gb.loc[g.index].isin(["Democrat", "Republican"])]
                qD[j, h, a, i] = ((gb.loc[gg_.index] == "Democrat").sum() + 6 * qall[x]) / (len(gg_) + 6)

# Oct 23 2026: financial strain. Each respondent's chance of finding it very or somewhat difficult to pay the bills,
# the answer where they gave one and the dataset's own estimate where they did not. A type's share is the shrunk mean of
# its party, approval and age, race and college cell, built as additive log odds so thin cells lean on the wider ones.
_obs = r["econ_strain"].map({"Very difficult": 1.0, "Somewhat difficult": 1.0, "Not very difficult": 0.0, "Not at all difficult": 0.0})
_est = r["econ_strain_p_very_difficult"].astype(float) + r["econ_strain_p_somewhat_difficult"].astype(float)
r["_fin"] = _obs.where(_obs.notna(), _est).clip(0, 1)
_g = float(r["_fin"].mean())
def _eff(mask_fn, n_levels, prior=25):
    e = np.zeros(n_levels)
    for q in range(n_levels):
        x = r.loc[mask_fn(q), "_fin"]
        m = (x.sum() + prior * _g) / (len(x) + prior)
        e[q] = lg(np.array([m]))[0] - lg(np.array([_g]))[0]
    return e
_APPI = {"Approve": 0, "Neutral": 1, "Disapprove": 2}
E_J = _eff(lambda q: r.j == q, 3); E_A = _eff(lambda q: r.appr.map(_APPI) == q, 3); E_K = _eff(lambda q: r.k == q, 32)
FIN = np.zeros((3, 3, 32))
for jj in range(3):
    for aa in range(3):
        FIN[jj, aa] = inv(lg(np.array([_g]))[0] + E_J[jj] + E_A[aa] + E_K)

runs = json.load(open(f"{SITE}/public/forecast/swing_types.json"))["runs"]
# one race per state: the Senate race where there is one, else governor
pick = {}
for rid, tag in runs.items():
    o, st = rid.split("-")
    if st not in pick or o == "sen": pick[st] = (rid, tag, st + ("G" if o == "gov" else ""))

R1 = lambda x: round(float(x), 1)
out = {}
for st, (rid, tag, key) in sorted(pick.items()):
    f = sorted(glob.glob(f"/tmp/fcrun/runs/{tag}/lane*/behavior_types_{key}.npz"))[0]
    z = np.load(f)
    pops = z["pops"].astype(float); t = inv(z["lt"].astype(float)); p = inv(z["eta"].astype(float))
    gg = z["gg"].astype(int); side = z["side"].astype(int); fips = [str(x) for x in z["fips"]]
    k = gg // 12; j = (gg // 4) % 3; h = gg % 4; a = np.where(side == 1, 0, np.where(side == 0, 1, 2))
    age = k // 8; race = (k // 2) % 4; col = k % 2
    V = pops * t; tier = np.where(t >= HI, 0, np.where(t >= MID, 1, 2))
    W = recw[j, h, a]; Q = qD[j, h, a]                      # [K, 4]
    # per county and type, a common offset so the recall parts add back to the type's own preference
    delta = np.zeros_like(p)
    for _ in range(30):
        mix = (W[None] * inv(lg(Q)[None] + delta[..., None])).sum(-1)
        delta += lg(p) - lg(np.clip(mix, 1e-4, 1 - 1e-4))
    Pr = inv(lg(Q)[None] + delta[..., None])               # [C, K, 4]
    for c, fp in enumerate(fips):
        Vc, Pc, Ac = V[c], p[c], pops[c]
        ev, ad = Vc.sum(), Ac.sum()
        if ev <= 0: continue
        mar = lambda v, d: R1(100 * (1 - 2 * d / v)) if v > 0 else None     # R minus D
        def grp(m):
            v = (Vc * m).sum(); return [R1(100 * v / ev), mar(v, (Vc * m * Pc).sum())]
        prop = [[R1(100 * (Ac * (tier[c] == q)).sum() / ad), *grp(tier[c] == q)] for q in range(3)]
        vp = []
        for i in (0, 1):
            for hi in (True, False):
                m = ((tier[c] == 0) if hi else (tier[c] > 0)) * W[:, i]
                va = (Ac * m).sum(); vv = (Vc * m).sum()
                vp.append([int(round(va)), int(round(vv)), mar(vv, (Vc * m * Pr[c, :, i]).sum())])
        for i in (2, 3):
            m = W[:, i]; va = (Ac * m).sum(); vv = (Vc * m).sum()
            vp.append([int(round(va)), int(round(vv)), mar(vv, (Vc * m * Pr[c, :, i]).sum())])
        pp = [grp((j == jj) & ((tier[c] == 0) if hi else (tier[c] > 0))) for jj in range(3) for hi in (True, False)]
        S = FIN[j, a, k]
        fin = [grp(S), grp(1 - S)]
        out[fp] = {
            "race": rid, "run": tag, "ad": int(round(ad)), "ev": int(round(ev)), "to": R1(100 * ev / ad), "m": mar(ev, (Vc * Pc).sum()),
            "prop": prop, "vp": vp, "pp": pp,
            "ap": [grp(a == q) for q in range(3)],
            "age": [grp(age == q) for q in range(4)], "race_": [grp(race == q) for q in range(4)],
            "col": [grp(col == q) for q in range(2)], "hist": [grp(h == q) for q in range(4)],
            "fin": fin,
        }

# TPSI county Trump approval and AAA gas
for row in csv.DictReader(open(APPROVAL)):
    fp = row["county_fips"].zfill(5); d = out.setdefault(fp, {})
    try: d["appr"] = [R1(row["TRUMP APPROVE"]), R1(row["TRUMP DISAPPROVE"]), R1(row["no_opinion"]), R1(row["NET MARGIN"]), R1(row["tpsi_net_margin_se"])]
    except (ValueError, KeyError): pass
gas_date = None
for row in csv.DictReader(open(GAS)):
    try: out.setdefault(row["county_fips"].zfill(5), {})["gas"] = round(float(row["price_regular"]), 3); gas_date = row["date"]
    except (ValueError, KeyError): pass

meta = {"asOf": "2026-10-23", "gasDate": gas_date, "thresholds": {"high": HI, "medium": MID},
        "labels": {"prop": ["High propensity", "Medium propensity", "Low propensity"],
                   "vp": ["Trump voters, high propensity", "Trump voters, lower propensity", "Harris voters, high propensity", "Harris voters, lower propensity", "Third party voters", "Did not vote in 2024"],
                   "pp": ["Democrats, high", "Democrats, lower", "Republicans, high", "Republicans, lower", "Independents, high", "Independents, lower"],
                   "ap": ["Approve of Trump", "No opinion", "Disapprove of Trump"],
                   "age": ["18 to 29", "30 to 44", "45 to 64", "65+"], "race_": ["White", "Black", "Latino", "Asian and other"],
                   "col": ["No college degree", "College graduate"], "hist": ["Voted 2022 and 2024", "Voted 2022, not 2024", "Voted 2024, not 2022", "New or irregular voter"],
                   "fin": ["Struggling to pay the bills", "Getting by"]}}
json.dump({"meta": meta, "c": out}, open(f"{SITE}/public/watchdog/county_profiles.json", "w"), separators=(",", ":"))
print(len(out), "counties;", sum(1 for v in out.values() if "ev" in v), "modeled;", sum(1 for v in out.values() if "appr" in v), "approval;", sum(1 for v in out.values() if "gas" in v), "gas")
