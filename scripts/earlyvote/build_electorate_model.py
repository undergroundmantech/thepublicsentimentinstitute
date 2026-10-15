"""Build public/earlyvote-electorate.json: the TPSI electorate estimator for the Early Vote page. October 15 2026.

For every county, state and the nation it estimates how the 2026 vote will be cast, by mail, early in person and on
Election Day, and who will cast it, measured against the 2024 presidential vote: how many of each mode's voters are
returning Trump voters, returning Harris voters, and voters who skipped 2024 or voted third party. The Early Vote
page sets the live civicAPI counts against these expectations, so a reader can see whether the early vote so far is
running ahead or behind for a party and where the final electorate is heading.

Inputs
------
1. The forecast's projected 2026 vote in every county, from public/forecast/counties.json (the statewide House vote,
   which covers every county in every state).
2. The certified 2024 presidential vote by county (rerun/geo/pres24.csv).
3. TPSI likely voters (rerun/tpsi_db/TPSI_Unified_Respondent_Dataset.csv). The respondent file never leaves this
   machine; only fitted rates and county aggregates are written.
   - The 2026 generic ballot by recalled 2024 vote gives how many Trump voters cross to Democrats and Harris voters
     to Republicans, and how voters who skipped 2024 lean.
   - Ballot method by recalled 2024 vote, age and the state's ballot rules gives each group's chance of voting by
     mail, early in person or on Election Day.
4. The 2024 EAVS, Executive Summary Table 1 (scripts/earlyvote/data/eavs_2024_modes.csv): each state's actual
   ballots by mode. The TPSI mode model sets who votes which way; EAVS sets each state's mode totals, since a national
   survey cannot see that Georgia and Texas vote early in person while New York and New Hampshire do not.
5. ACS 2024 five year adults by age band for every county (S1501), so older counties lean toward mail.

How a county is built
---------------------
- Its 2026 two party vote V and Democratic share d come from the forecast.
- V is split into returning Trump voters, returning Harris voters and new voters. The new share n and its lean come
  from TPSI. The two retention rates kT and kH solve the county's own V and d exactly:
      kT T + kH H = (1 - n) V
      kT T xT + kH H (1 - xH) = d V - n V dn
  where T and H are the county's 2024 Trump and Harris votes, xT is the share of Trump voters voting Democratic in
  2026 and xH the share of Harris voters voting Republican. Rates are held between 0.2 and 1.4.
- Each group's mode chances come from the TPSI multinomial logit at the county's age mix and the state's rule, then
  every state's Democratic, Republican and new groups are shifted together in log odds until the state's turnout
  weighted mode shares match its 2024 EAVS shares.

Run from the repository root:

    RR=path/to/rerun python3 scripts/earlyvote/build_electorate_model.py
"""
import json, os, glob, datetime
import numpy as np
import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RR = os.environ.get("RR", "rerun")
OUT = os.environ.get("OUT", os.path.join(ROOT, "public", "earlyvote-electorate.json"))
MODES = ["mail", "early", "eday"]
GROUPS = ["trump", "harris", "new"]

FIPS_ST = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID",
  "17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT",
  "31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC",
  "46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"}
REGIME = json.load(open(os.path.join(ROOT, "public", "earlyvote-party-model.json")))["regime"]

# ── 1. TPSI fits ─────────────────────────────────────────────────────────────
R = pd.read_csv(f"{RR}/tpsi_db/TPSI_Unified_Respondent_Dataset.csv", low_memory=False,
                usecols=["state", "age_band", "recall_2024", "generic_ballot", "ballot_method", "likely_voter", "party_id"])
LV = R[R.likely_voter.astype(str).isin(["1", "1.0", "True"])].copy()
grp = LV.recall_2024.map({"Trump": "trump", "Harris": "harris"}).fillna("new")
LV["g"] = grp
gb = LV.generic_ballot
def two_d(sub):
    d, r = (sub == "Democrat").sum(), (sub == "Republican").sum()
    return d / max(d + r, 1)
xT = two_d(gb[LV.g == "trump"])                      # Trump voters voting Democratic, two party
xH = 1 - two_d(gb[LV.g == "harris"])                  # Harris voters voting Republican
dn = two_d(gb[LV.g == "new"])                         # new voters' Democratic share
n_new = float((LV.g == "new").mean())
# party registration to 2024 vote, for reading a reported party mix as a 2024 electorate
pr = pd.crosstab(LV.party_id, LV.g, normalize="index")
PARTY_TO_GROUP = {p: [round(float(pr.loc[p].get(g, 0)), 4) for g in GROUPS] for p in ["Democrat", "Republican", "Independent"] if p in pr.index}

METHOD = {
    "Mail/absentee, ballot in hand": "mail", "Mail/absentee, already returned": "mail", "Mail/absentee, not yet requested": "mail",
    "Early in person, details known": "early", "Early in person, details unknown": "early", "Early in person, already voted": "early",
    "Election Day in person, location known": "eday", "Election Day in person, location unconfirmed": "eday",
}
M = LV[LV.ballot_method.isin(METHOD)].copy()
M["m"] = M.ballot_method.map(METHOD)
M["rg"] = M.state.map(lambda s: REGIME.get(str(s), "request"))
AGES = ["18-29", "30-44", "45-64", "65+"]
M = M[M.age_band.isin(AGES)]
# multinomial logit by hand, Election Day the base: regime, group, age and regime x age effects, light ridge
REGS = ["universal", "permanent", "request", "excuse"]
def design(rg, g, a):
    x = [1.0]
    x += [1.0 if rg == r else 0.0 for r in REGS[1:]]
    x += [1.0 if g == k else 0.0 for k in GROUPS[1:]]
    x += [1.0 if a == k else 0.0 for k in AGES[1:]]
    x += [1.0 if (rg == r and a == "65+") else 0.0 for r in REGS[1:]]
    return np.array(x)
X = np.stack([design(r.rg, r.g, r.age_band) for r in M.itertuples()])
Y = np.stack([(M.m == k).values.astype(float) for k in MODES], 1)
B = np.zeros((X.shape[1], 2))
for it in range(400):
    Z = np.concatenate([X @ B, np.zeros((len(X), 1))], 1)
    P = np.exp(Z - Z.max(1, keepdims=True)); P /= P.sum(1, keepdims=True)
    G = X.T @ (Y[:, :2] - P[:, :2]) - 0.5 * B
    B += 0.6 * G / len(X) * 10
def pmode(rg, g, a):
    z = np.append(design(rg, g, a) @ B, 0.0); p = np.exp(z - z.max()); return p / p.sum()

# ── 2. counties ──────────────────────────────────────────────────────────────
C = json.load(open(os.path.join(ROOT, "public", "forecast", "counties.json")))
rows = {}
for k, v in C.items():
    if not k.startswith("house-") or not isinstance(v, dict): continue
    for f, r in v.items():
        if isinstance(r, list) and len(r) >= 4: rows[f] = r
P24 = pd.read_csv(f"{RR}/../geo/pres24.csv", dtype={"county_fips": str})
P24["f"] = P24.county_fips.str.zfill(5); P24 = P24.set_index("f")
acs_f = glob.glob(f"{RR}/fc2609fd*/JULIUISMICHIGAN/ACSST5Y2024.S1501_*/*Data.csv")[0]
A = pd.read_csv(acs_f, skiprows=[1], low_memory=False); A["f"] = A.GEO_ID.str[-5:]; A = A.set_index("f")
num = lambda c: pd.to_numeric(A[c], errors="coerce").fillna(0)
ag = pd.DataFrame({"a18": num("S1501_C01_001E") + 0.5 * num("S1501_C01_016E"),
                   "a30": 0.5 * num("S1501_C01_016E") + num("S1501_C01_019E"),
                   "a45": num("S1501_C01_022E"), "a65": num("S1501_C01_025E")})
# voters by age band: ACS adults times TPSI likely voter rates by age
lvr = R.assign(lv=R.likely_voter.astype(str).isin(["1", "1.0", "True"])).groupby("age_band").lv.mean().reindex(AGES).values
EAVS = pd.read_csv(os.path.join(ROOT, "scripts", "earlyvote", "data", "eavs_2024_modes.csv")).set_index("state")

# state two party Democratic share of the 2026 forecast, for counties with no 2024 county vote on file
_sd = {}
for f, r in rows.items():
    st = FIPS_ST.get(f[:2])
    if st: a_ = _sd.setdefault(st, [0.0, 0.0]); a_[0] += float(r[1]); a_[1] += float(r[1]) + float(r[2])
ST24_D = {"AK": 0.4317}   # Harris two party share in Alaska, which certifies 2024 by House district, not borough
lg = lambda p: np.log(p / (1 - p)); il = lambda x: 1 / (1 + np.exp(-x))
cty = {}
for f, r in rows.items():
    st = FIPS_ST.get(f[:2]);
    if not st: continue
    m, dv, rv, tv = r[0], float(r[1]), float(r[2]), float(r[3])
    V2 = dv + rv
    if V2 <= 0: continue
    d = dv / V2
    if f in P24.index and st != "AK":   # Alaska certifies 2024 by House district, whose codes collide with borough fips
        T, H, tot24 = float(P24.at[f, "votes_gop"]), float(P24.at[f, "votes_dem"]), float(P24.at[f, "total_votes"])
    else:
        # no 2024 county vote on file (Alaska's boroughs): the forecast's own split, so both retention rates come out equal
        d24 = il(lg(min(max(d, 0.02), 0.98)) - (lg(_sd[st][0] / _sd[st][1]) - lg(ST24_D.get(st, _sd[st][0] / _sd[st][1]))))
        tot24 = tv / 0.8; T, H = tot24 * 0.97 * (1 - d24), tot24 * 0.97 * d24
    # solve the two retention rates
    a = np.array([[T, H], [T * xT, H * (1 - xH)]]); b = np.array([(1 - n_new) * V2, d * V2 - n_new * V2 * dn])
    try: kT, kH = np.linalg.solve(a, b)
    except np.linalg.LinAlgError: kT = kH = (1 - n_new) * V2 / max(T + H, 1)
    kT, kH = float(np.clip(kT, 0.2, 1.4)), float(np.clip(kH, 0.2, 1.4))
    N = np.array([kT * T, kH * H, n_new * V2]); N *= V2 / N.sum()
    age = ag.loc[f].values * lvr if f in ag.index else np.array([0.15, 0.22, 0.35, 0.28])
    age = age / age.sum() if age.sum() > 0 else np.array([0.15, 0.22, 0.35, 0.28])
    rg = REGIME.get(st, "request")
    pm = np.stack([sum(age[i] * pmode(rg, g, AGES[i]) for i in range(4)) for g in GROUPS])   # group x mode
    cty[f] = dict(st=st, N=N, pm=pm, tv=tv, tot24=tot24, T=T, H=H)

# ── 3. calibrate each state's mode shares to EAVS 2024 ───────────────────────
def target(st, tot):
    e = EAVS.loc[st] if st in EAVS.index else None
    reg = REGIME.get(st, "request")
    if st in ("OR", "WA"): return np.array([1.0, 0.0, 0.0])
    if e is None: return None
    mail, early, eday = e.mail, e.early_inperson, e.eday
    if st == "AL": early = 0.0
    if st == "PA": early = 0.0
    vals = [mail, early, eday]
    if all(pd.isna(v) for v in vals): return None
    known = [v for v in vals if not pd.isna(v)]
    if not any(pd.isna(v) for v in vals):
        s = np.array(vals, float); return s / s.sum() if s.sum() > 0 else None
    if sum(pd.isna(v) for v in vals) == 1:
        miss = [i for i, v in enumerate(vals) if pd.isna(v)][0]
        vals[miss] = max(0.0, tot - sum(known))
        s = np.array(vals, float); return s / s.sum()
    return None
st_tot = {}
for f, c in cty.items(): st_tot[c["st"]] = st_tot.get(c["st"], 0) + c["tot24"]
targets = {st: target(st, st_tot[st]) for st in st_tot}
# states with too little EAVS data take their regime's average
reg_avg = {}
for rg in REGS:
    ts = [t for st, t in targets.items() if t is not None and REGIME.get(st) == rg]
    reg_avg[rg] = np.mean(ts, 0) if ts else np.array([0.3, 0.3, 0.4])
filled = {st: (t is None) for st, t in targets.items()}
targets = {st: (t if t is not None else reg_avg[REGIME.get(st, "request")]) for st, t in targets.items()}

off = {}
for st in st_tot:
    fs = [f for f, c in cty.items() if c["st"] == st]
    tgt = np.clip(targets[st], 1e-4, None); tgt /= tgt.sum()
    o = np.zeros(2)
    for it in range(200):
        tot = np.zeros(3)
        for f in fs:
            c = cty[f]; lp = np.log(np.clip(c["pm"], 1e-6, None)); lp[:, :2] += o
            p = np.exp(lp); p /= p.sum(1, keepdims=True); tot += (c["N"][:, None] * p).sum(0)
        sh = tot / tot.sum()
        g = np.log(tgt[:2] / tgt[2]) - np.log(np.clip(sh[:2], 1e-6, None) / max(sh[2], 1e-6))
        o += 0.8 * g
        if np.abs(g).max() < 1e-4: break
    off[st] = o

# ── 4. write ─────────────────────────────────────────────────────────────────
def mode_table(c, o):
    lp = np.log(np.clip(c["pm"], 1e-6, None)); lp[:, :2] += o
    p = np.exp(lp); p /= p.sum(1, keepdims=True)
    return c["N"][:, None] * p          # group x mode votes, two party
out_c, states = {}, {}
nat = np.zeros((3, 3)); nat24 = np.zeros(3)
for f, c in cty.items():
    gm = mode_table(c, off[c["st"]])
    V = gm.sum()
    scale = c["tv"] / V if V > 0 else 1.0            # back to all votes, third parties included
    gm_all = gm * scale
    mv = gm_all.sum(0)                                # votes by mode
    tshare = gm[0] / np.clip(gm.sum(0), 1e-9, None)   # returning Trump voters share of each mode
    hshare = gm[1] / np.clip(gm.sum(0), 1e-9, None)
    t24 = c["T"] / max(c["T"] + c["H"], 1)
    out_c[f] = [round(c["tv"]), *[round(float(x)) for x in mv], *[round(float(x), 4) for x in tshare], *[round(float(x), 4) for x in hshare], round(float(t24), 4)]
    s = states.setdefault(c["st"], {"gm": np.zeros((3, 3)), "T": 0.0, "H": 0.0, "tot24": 0.0})
    s["gm"] += gm_all; s["T"] += c["T"]; s["H"] += c["H"]; s["tot24"] += c["tot24"]
    nat += gm_all; nat24 += np.array([c["T"], c["H"], c["tot24"]])

def summ(gm, T, H, tot24, st=None):
    mv = gm.sum(0); tv = mv.sum()
    out = dict(turnout=round(float(tv)), modes={m: round(float(v)) for m, v in zip(MODES, mv)},
               modeShare={m: round(float(v / tv), 4) for m, v in zip(MODES, mv)},
               groupShare={m: [round(float(x), 4) for x in gm[:, i] / max(gm[:, i].sum(), 1e-9)] for i, m in enumerate(MODES)},
               electorate=[round(float(x), 4) for x in gm.sum(1) / max(gm.sum(), 1e-9)],
               trump24=round(float(T / max(T + H, 1)), 4), votes24=round(tot24))
    if st:
        out["eavs2024"] = [round(float(x), 4) for x in targets[st]]
        out["eavsFilled"] = bool(filled[st])
        out["regime"] = REGIME.get(st, "request")
    return out
st_out = {st: summ(s["gm"], s["T"], s["H"], s["tot24"], st) for st, s in sorted(states.items())}
payload = {
    "meta": {
        "version": 1, "built": datetime.date.today().isoformat(), "respondents": int(len(M)), "likelyVoters": int(len(LV)),
        "modes": MODES, "groups": GROUPS,
        "crossover": {"trumpToD": round(float(xT), 4), "harrisToR": round(float(xH), 4), "newShare": round(n_new, 4), "newD": round(float(dn), 4)},
        "partyToGroup": PARTY_TO_GROUP,
        "countyCols": ["turnout", "mail", "early", "eday", "trumpMail", "trumpEarly", "trumpEday", "harrisMail", "harrisEarly", "harrisEday", "trump24"],
        "sources": ["On Point Politics forecast, county House vote", "2024 certified presidential vote by county",
                    "TPSI likely voters", "EAC 2024 EAVS Executive Summary Table 1", "ACS 2024 five year S1501"],
    },
    "nation": summ(nat, nat24[0], nat24[1], nat24[2]),
    "states": st_out,
    "counties": out_c,
}
json.dump(payload, open(OUT, "w"), separators=(",", ":"))
print(f"wrote {OUT}: {len(out_c)} counties, {len(st_out)} states, {os.path.getsize(OUT)//1024} KB")
print("crossover", payload["meta"]["crossover"])
print("nation", payload["nation"])
for st in ["GA", "NC", "TX", "FL", "PA", "MI", "AZ", "NV", "WI", "OH", "IA", "ME", "NE", "KS", "AK", "NY", "CA"]:
    s = st_out.get(st)
    if s: print(st, s["regime"], "modes", s["modeShare"], "eavs", s["eavs2024"], "electorate T/H/new", s["electorate"], "trump24", s["trump24"])
