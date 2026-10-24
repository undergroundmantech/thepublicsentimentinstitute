"""Who has voted so far: the modeled electorate of the ballots already cast, county by county (Oct 23 2026).

For every county in a state with a 2026 Senate or governor forecast, this reads the forecast's own simulated 2026
electorate, the voter types of behavior_types_<KEY>.npz from the newest run that has the race: adults and turnout
chance by county for 32 age, race and college cells x party x 2022 and 2024 vote history x Trump approval. It then
splits every type's expected voters by how they will vote, by mail, early in person or on Election Day, with the
same multinomial logit on On Point Polling likely voters that the early vote party model uses (party, age, race,
college, vote history, local lean and the state's ballot rules). Two things the types do not carry are added from
respondent aggregates: the share of women in each age, race, college and party cell, set so the whole forecast
electorate is 53.3 percent women as in the Census Bureau's Current Population Survey of recent elections, and how
many of the last four general elections, 2018 to 2024, each voter cast a ballot in, from 2018 and 2020 turnout given
the type's 2022 and 2024 history and age.

The page multiplies these mixes by the live county ballot counts by party in the browser, so the electorate of the
ballots cast so far follows each new count. Only county and state aggregates are written; the respondent file never
leaves this machine.

Writes public/forecast/ev_cast/<ST>.json for each modeled state and public/forecast/ev_cast/US.json.
Each county row: t, expected 2026 voters; n, expected mail and early in person voters by party D, R, I over the whole early vote; s, six
mixes in the same order, each 15 shares in percent: age 18 to 29, 30 to 44, 45 to 64, 65 and over; White, Black,
Latino, Asian and other; women; college graduates; voted in 0, 1, 2, 3 and 4 of the last four general elections;
e, the same 15 shares for the whole expected 2026 electorate, then its party shares D, R, I.

Usage: python3 -I scripts/earlyvote/build_cast_electorate.py SITE_DIR RUN [RUN ...]   newest run first
"""
import glob, json, os, sys
import numpy as np
import pandas as pd

SITE, RUNS = sys.argv[1], sys.argv[2:]
MODEL_DIR = "/tmp/fcrun/TPSI_B/model"
DB = os.environ.get("TPSI_DB", f"{MODEL_DIR}/tpsi_db/TPSI_Unified_Respondent_Dataset.csv")
COUNTY = os.environ.get("TPSI_COUNTY", f"{MODEL_DIR}/41050065-TEXASMODELFINAL_2/TEXASMODELFINAL/TPSI_Trump_Approval_By_County_Combined_FULL.csv")
OUT = os.path.join(SITE, "public", "forecast", "ev_cast")
FEMALE_TARGET = 0.533

lg = lambda p: np.log(np.clip(p, 1e-9, 1 - 1e-9) / (1 - np.clip(p, 1e-9, 1 - 1e-9)))
inv = lambda z: 1 / (1 + np.exp(-z))

# ballot rules for the 2026 general, NCSL tables, the same classes as build_party_model.py
UNIVERSAL = set("CA CO HI NV OR UT VT WA DC".split())
PERMANENT = set("AZ IL ME MD MI MN MT NJ NM VA PA".split())
EXCUSE = set("AL AR CT DE IN KY LA MS MO NH SC TN TX WV".split())
REGIMES = ["request", "permanent", "excuse", "universal"]
regime = lambda st: "universal" if st in UNIVERSAL else "permanent" if st in PERMANENT else "excuse" if st in EXCUSE else "request"

c = pd.read_csv(COUNTY)
c["fips"] = c.county_fips.astype(int).map(lambda f: f"{f:05d}")
c["t"] = c.trump_2024_two_party_pct / 100
T24 = dict(zip(c.fips, c.t))
state_t = c.groupby("state_abbr").apply(lambda g: (g.t * g.adult_population_18plus).sum() / g.adult_population_18plus.sum())

d = pd.read_csv(DB, low_memory=False)
d = d[(d.analysis_ready == 1) & d.state.notna() & d.party_id.notna() & d.age_band.notna() & d.race4.notna()].copy()
bm = d.ballot_method.fillna("")
d["mode"] = np.select([bm.str.startswith("Mail"), bm.str.startswith("Early"), bm.str.startswith("Election Day")], [1, 2, 0], -1)
d["t"] = [T24.get(f"{int(f):05d}", state_t.get(s, np.nan)) if pd.notna(f) else state_t.get(s, np.nan) for f, s in zip(d.county_fips, d.state)]
AGE = ["18-29", "30-44", "45-64", "65+"]; RACE = ["White", "Black", "Hispanic", "Asian/Other"]
d["a"] = d.age_band.map({k: i for i, k in enumerate(AGE)})
d["b"] = d.race4.map({k: i for i, k in enumerate(RACE)})
d["col"] = (d.college.astype(str).str.upper() == "COLLEGE").astype(int)
d["j"] = d.party_id.map({"Democrat": 0, "Republican": 1, "Independent": 2})
v18, v20, v22, v24 = (d[f"voted_{y}"].fillna(0).astype(int) for y in (2018, 2020, 2022, 2024))
d["h"] = np.where((v22 == 1) & (v24 == 1), 0, np.where(v22 == 1, 1, np.where(v24 == 1, 2, 3)))
d["x"] = v18 + v20
d["fem"] = (d.gender == "Female").astype(float)
d["r"] = d.state.map(lambda s: REGIMES.index(regime(s)))
d = d[d.t.notna() & d.a.notna() & d.b.notna() & d.j.notna()].copy()
for k in ("a", "b", "j"): d[k] = d[k].astype(int)
LEAN_C = float(lg(d.t).mean())
fit = d[(d.likely_voter == 1) & (d["mode"] >= 0)].reset_index(drop=True)


def design(j, a, b, col, h, x, r):
    j, a, b, h, r = (np.asarray(v, int) for v in (j, a, b, h, r))
    one = np.ones(len(j), float)
    cols = [one, j == 1, j == 2, a == 1, a == 2, a == 3, b == 1, b == 2, b == 3, np.asarray(col, float), h == 1, h == 2, h == 3, np.asarray(x, float)]
    pen = [0.1] + [0.5] * 13
    for k in (1, 2, 3):
        rk = r == k
        cols += [rk, rk & (j == 1), rk & (j == 2), rk & (a == 3), rk & (a == 0)]
        pen += [0.5, 3.0, 3.0, 3.0, 3.0]
    return np.column_stack([np.asarray(v, float) for v in cols]), np.array(pen)


def softmax(eta):
    e = np.concatenate([np.zeros(eta.shape[:-1] + (1,)), eta], -1); e -= e.max(-1, keepdims=True); p = np.exp(e)
    return p / p.sum(-1, keepdims=True)


def mnl(F, y, w, pen):
    K = F.shape[1]; B = np.zeros((K, 2)); Y = np.eye(3)[y]; L = np.diag(np.concatenate([pen, pen]))
    for _ in range(60):
        P = softmax(F @ B)
        G = np.concatenate([F.T @ (w * (Y[:, k] - P[:, k])) for k in (1, 2)]) - L @ B.T.reshape(-1)
        H = np.zeros((2 * K, 2 * K))
        for a in (1, 2):
            for bb in (1, 2):
                s = w * P[:, a] * ((a == bb) - P[:, bb]); H[(a - 1) * K:a * K, (bb - 1) * K:bb * K] = -(F.T * s) @ F
        H -= L; step = np.linalg.solve(H, G); B -= step.reshape(2, K).T
        if np.abs(step).max() < 1e-8: break
    return B


F, pen = design(fit.j, fit.a, fit.b, fit.col, fit.h, lg(fit.t) - LEAN_C, fit.r)
BETA = mnl(F, fit["mode"].values.astype(int), fit.turnout_propensity.values, pen)

# women by age, race, college and party: cell means shrunk to the age and party cell, then to everyone
gF = d.fem.mean()
def shrunk(g, prior, k):
    return (g.fem.sum() + k * prior) / (len(g) + k)
FEM = np.zeros((4, 4, 2, 3))
for a in range(4):
    for j in range(3):
        aj = d[(d.a == a) & (d.j == j)]; p_aj = shrunk(aj, gF, 30)
        for b in range(4):
            for cc in range(2):
                FEM[a, b, cc, j] = shrunk(aj[(aj.b == b) & (aj.col == cc)], p_aj, 25)

# 2018 and 2020 turnout given the 2022 and 2024 history and age: P(x = 0, 1, 2), shrunk to the history group
XH = np.zeros((4, 4, 3))
for h in range(4):
    gh = d[d.h == h]; ph = np.array([(gh.x == k).mean() for k in range(3)]) if len(gh) else np.array([1 / 3] * 3)
    for a in range(4):
        g = gh[gh.a == a]; cnt = np.array([(g.x == k).sum() for k in range(3)], float)
        XH[a, h] = (cnt + 20 * ph) / (cnt.sum() + 20)
BASE = np.array([2, 1, 1, 0])   # elections of 2022 and 2024 voted in, by history group


def runs_with(key):
    for run in RUNS:
        hit = sorted(glob.glob(f"/tmp/fcrun/runs/{run}/lane*/behavior_types_{key}.npz"))
        if hit: return run, hit[0]
    return None, None


def features(gg, fem_off):
    """[K, 15] expected group shares of each type."""
    a, b, col, j, h = gg // 96, (gg // 24) % 4, (gg // 12) % 2, (gg // 4) % 3, gg % 4
    K = len(gg); G = np.zeros((K, 15))
    G[np.arange(K), a] = 1; G[np.arange(K), 4 + b] = 1
    G[:, 8] = inv(lg(FEM[a, b, col, j]) + fem_off); G[:, 9] = col
    for k in range(3): G[np.arange(K), 10 + BASE[h] + k] += XH[a, h, k]
    return G, j, a, b, col, h


STATES = sorted(set(c.state_abbr) - {"DC"})
loaded = {}
for st in STATES:
    run, p = runs_with(st)
    if not p: run, p = runs_with(st + "G")
    if not p: continue
    z = np.load(p, allow_pickle=True)
    loaded[st] = dict(run=run, pops=z["pops"].astype(float), lt=z["lt"].astype(float), gg=z["gg"].astype(int), fips=[str(f) for f in z["fips"]])

# one offset so the whole forecast electorate is FEMALE_TARGET women
def fem_share(off):
    num = den = 0.0
    for t in loaded.values():
        W = (t["pops"] * inv(t["lt"])).sum(0); G, *_ = features(t["gg"], off)
        num += (W * G[:, 8]).sum(); den += W.sum()
    return num / den
lo, hi = -2.0, 2.0
for _ in range(40):
    m = (lo + hi) / 2; lo, hi = (m, hi) if fem_share(m) < FEMALE_TARGET else (lo, m)
FEM_OFF = (lo + hi) / 2

os.makedirs(OUT, exist_ok=True)
pc = lambda v: [round(float(x) * 100, 1) for x in v]
US = {}
for st, t in loaded.items():
    G, j, a, b, col, h = features(t["gg"], FEM_OFF)
    W = t["pops"] * inv(t["lt"])                         # [C, K] expected 2026 voters
    rg = np.full(len(j), REGIMES.index(regime(st)))
    rows = {}; SN = np.zeros(6); SS = np.zeros((6, 15)); SE = np.zeros(15); SP = np.zeros(3); SW = 0.0
    for ci, f in enumerate(t["fips"]):
        x = lg(T24.get(f, state_t.get(st, 0.5))) - LEAN_C
        Fc, _ = design(j, a, b, col, h, np.full(len(j), x), rg)
        P = softmax(Fc @ BETA)                           # [K, 3] Election Day, mail, early
        n, s = [], []
        for m in (1, 2):
            for jj in range(3):
                w = W[ci] * P[:, m] * (j == jj); N = w.sum()
                n.append(N); mix = (w @ G) / N if N > 0 else np.zeros(15); s.append(mix)
        tot = W[ci].sum(); e = (W[ci] @ G) / tot if tot > 0 else np.zeros(15)
        party = np.array([W[ci][j == k].sum() for k in range(3)]) / max(tot, 1e-9)
        rows[f.zfill(5)] = dict(t=int(round(tot)), n=[int(round(v)) for v in n], s=[pc(v) for v in s], e=pc(e) + pc(party))
        SN += n; SS += np.array(s) * np.array(n)[:, None]; SE += e * tot; SP += party * tot; SW += tot
    ss = [pc(SS[i] / SN[i]) if SN[i] > 0 else [0] * 15 for i in range(6)]
    summ = dict(t=int(round(SW)), n=[int(round(v)) for v in SN], s=ss, e=pc(SE / SW) + pc(SP / SW))
    json.dump(dict(st=st, run=t["run"], state=summ, counties=rows), open(f"{OUT}/{st}.json", "w"), separators=(",", ":"))
    US[st] = summ
    print(st, t["run"], len(rows), "counties", "mail D R I", summ["n"][:3], "65+ of mail", summ["s"][0][3], "women", summ["e"][8])

LABELS = {"age": ["18 to 29", "30 to 44", "45 to 64", "65 and over"], "race": ["White", "Black", "Latino", "Asian and other"],
          "gender": ["Women", "Men"], "college": ["College graduates", "No college degree"],
          "hist": ["0 of 4", "1 of 4", "2 of 4", "3 of 4", "4 of 4"], "party": ["Democrats", "Republicans", "Independents"]}
json.dump(dict(built=pd.Timestamp.now().strftime("%Y-%m-%d"), runs=sorted({t["run"] for t in loaded.values()}), femaleTarget=FEMALE_TARGET,
               labels=LABELS, states=US), open(f"{OUT}/US.json", "w"), separators=(",", ":"))
print(len(US), "states; women offset", round(FEM_OFF, 3), "female share", round(fem_share(FEM_OFF), 4))
