"""Build public/earlyvote-party-model.json, version 2 of the TPSI party estimate for
early vote ballots in states that report no party. October 1 2026.

Fourteen states send every early ballot as Unspecified: Hawaii, Idaho on requests,
Illinois, Indiana, Maryland on requests, Michigan, Minnesota, Mississippi, Montana,
North Dakota, Ohio, Virginia, Vermont and Wisconsin. The Early Vote page applies
this file to the live county counts in the browser.

The respondent file never leaves this machine. The page receives county party
mixes, statewide simulation offsets and public county figures only.

What changed from version 1
---------------------------
1. The electorate is the forecast's own. Version 1 rebuilt each county's party mix
   from its 2024 Trump share and the swing inside the TPSI sample, about two points
   toward Democrats. The forecast runs on a D+12 national environment, so the early
   vote page and the forecast disagreed on who is voting. Version 2 reads the
   forecast's simulated 2026 electorate, 1,152 voter types per county by age, race,
   college, party, vote history and Trump approval, each with its own turnout
   chance, from the latest statewide run.
2. Ballot rules by state. A request in Vermont or Hawaii, where every registered
   voter is mailed a ballot, is the voter file, not a self selected mail voter. A
   request in Michigan or Virginia comes largely from a permanent list. A request
   in Indiana or Mississippi needs an excuse, most often age. Each state is
   classed as universal mail, permanent list, request with no excuse, or excuse
   required, from the NCSL tables, and the mode model is fitted with those classes.
3. Mode choice by voter type. A multinomial logit on TPSI likely voters gives each
   type's chance of voting by mail, early in person or on Election Day from party,
   age, race, college, vote history, local lean and the state's ballot rules, with
   party and age allowed to matter differently under each rule. Each county's mail
   electorate is its forecast voters times their mail chance, type by type.
4. Calibrated on states that publish party. Florida, North Carolina, Pennsylvania
   and New Jersey report requests by party and publish their registration. The
   observed tilt of requesters against the registered file is compared with the
   model's tilt of mail voters against all voters, and the model's mail skew is
   scaled to match, with a leave one out test.
5. Demographic raking. Party mixes by age and race are shipped for every state and
   mode, so when a state publishes its early voters by age, as Michigan does, the
   page reweights the estimate to the ages actually voting.
6. Uncertainty. The mode model is refit on 200 bootstrap resamples of respondents,
   the calibration scale is drawn from its leave one out spread, and each state's
   electorate gets a party shock of 0.05 in log odds. The page runs every draw.

Run from the repository root:

    TPSI_DB=path/to/TPSI_Unified_Respondent_Dataset.csv \
    TPSI_COUNTY=path/to/TPSI_Trump_Approval_By_County_Combined_FULL.csv \
    FC_DIR=path/to/latest_statewide_run \
    python3 scripts/earlyvote/build_party_model.py
"""
import json, os, glob, datetime
import numpy as np
import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DB = os.environ.get("TPSI_DB", "TPSI_Unified_Respondent_Dataset.csv")
COUNTY = os.environ.get("TPSI_COUNTY", "TPSI_Trump_Approval_By_County_Combined_FULL.csv")
FC = os.environ.get("FC_DIR", "fc_latest")
DRAWS = int(os.environ.get("DRAWS", "200"))
OUT = os.environ.get("OUT", os.path.join(ROOT, "public", "earlyvote-party-model.json"))
rng = np.random.default_rng(20261001)

# ── ballot rules for the 2026 general, NCSL tables 3 and 1 ─────────────────────
UNIVERSAL = set("CA CO HI NV OR UT VT WA DC".split())
PERMANENT = set("AZ IL ME MD MI MN MT NJ NM VA PA".split())
EXCUSE = set("AL AR CT DE IN KY LA MS MO NH SC TN TX WV".split())
REGIMES = ["request", "permanent", "excuse", "universal"]
def regime(st):
    return "universal" if st in UNIVERSAL else "permanent" if st in PERMANENT else "excuse" if st in EXCUSE else "request"

# Universal mail states: requests are the voter file. Feed totals on October 1 set
# how far above the turnout chance a type's registration chance sits.
FILE_TOTAL = {"HI": 712132, "VT": 457404, "CO": 3998800, "NV": 2078790}

# Registration by party for the calibration states: R, D, all others. Florida active
# voters August 31 2026; North Carolina January 3 2026; Pennsylvania August 2026,
# Democrats ahead by about 206,000 of nearly 9 million; New Jersey November 1 2025.
REG = {"FL": (5649410, 4098139, 3832575), "NC": (2315067, 2312852, 3010000),
       "PA": (3670000, 3876000, 1350000), "NJ": (1673397, 2526861, 2432002)}
# States that publish party on returns but not on requests: their registration lets the
# page compare tilts instead of levels. Maryland active voters August 2026; Idaho
# October 1 2026, Independent Voter Project tabulation of the Secretary of State file.
REG_CHECK = {"MD": (1014245, 2222557, 1080941), "ID": (599551, 111628, 257429)}
# Requests by party in the feed on October 1 2026: R, D, others
REQ = {"FL": (661769, 835531, 426683), "NC": (16626, 41020, 40449),
       "PA": (247205, 688648, 101367), "NJ": (169576, 514883, 201549)}

lg = lambda p: np.log(np.clip(p, 1e-9, 1 - 1e-9) / (1 - np.clip(p, 1e-9, 1 - 1e-9)))
inv = lambda z: 1 / (1 + np.exp(-z))

# ── public county data ──────────────────────────────────────────────────────────
c = pd.read_csv(COUNTY)
c["fips"] = c.county_fips.astype(int).map(lambda f: f"{f:05d}")
c["t"] = c.trump_2024_two_party_pct / 100
c["st"] = c.state_abbr
T24 = dict(zip(c.fips, c.t)); ADULTS = dict(zip(c.fips, c.adult_population_18plus))
state_t = c.groupby("st").apply(lambda g: (g.t * g.adult_population_18plus).sum() / g.adult_population_18plus.sum())

# ── respondents: likely voters with a definite ballot plan ──────────────────────
d = pd.read_csv(DB, low_memory=False)
d = d[(d.analysis_ready == 1) & d.state.notna() & d.party_id.notna() & d.age_band.notna() & d.race4.notna()].copy()
bm = d.ballot_method.fillna("")
d["mode"] = np.select([bm.str.startswith("Mail"), bm.str.startswith("Early"), bm.str.startswith("Election Day")], [1, 2, 0], -1)
d["t"] = [T24.get(f"{int(f):05d}", state_t.get(s, np.nan)) if pd.notna(f) else state_t.get(s, np.nan)
          for f, s in zip(d.county_fips, d.state)]
AGE = ["18-29", "30-44", "45-64", "65+"]; RACE = ["White", "Black", "Hispanic", "Asian/Other"]
d["a"] = d.age_band.map({k: i for i, k in enumerate(AGE)})
d["b"] = d.race4.map({k: i for i, k in enumerate(RACE)})
d["col"] = (d.college.astype(str).str.upper() == "COLLEGE").astype(int)
d["j"] = d.party_id.map({"Democrat": 0, "Republican": 1, "Independent": 2})
v22, v24 = d.voted_2022.fillna(0).astype(int), d.voted_2024.fillna(0).astype(int)
d["h"] = np.where((v22 == 1) & (v24 == 1), 0, np.where(v22 == 1, 1, np.where(v24 == 1, 2, 3)))
d["r"] = d.state.map(lambda s: REGIMES.index(regime(s)))
d = d[d.t.notna() & d.a.notna() & d.b.notna() & d.j.notna()]
LEAN_C = float(lg(d.t).mean())
fit = d[(d.likely_voter == 1) & (d["mode"] >= 0)].reset_index(drop=True)


def design(j, a, b, col, h, x, r):
    """Mode model features. Party and age effects shift by ballot rule."""
    j, a, b, h, r = (np.asarray(v, int) for v in (j, a, b, h, r))
    one = np.ones(len(j), float)
    cols = [one, j == 1, j == 2, a == 1, a == 2, a == 3, b == 1, b == 2, b == 3, np.asarray(col, float),
            h == 1, h == 2, h == 3, np.asarray(x, float)]
    pen = [0.1] + [0.5] * 13
    for k in (1, 2, 3):                                    # permanent, excuse, universal
        rk = r == k
        cols += [rk, rk & (j == 1), rk & (j == 2), rk & (a == 3), rk & (a == 0)]
        pen += [0.5, 3.0, 3.0, 3.0, 3.0]
    return np.column_stack([np.asarray(v, float) for v in cols]), np.array(pen)


def softmax(eta):
    e = np.concatenate([np.zeros(eta.shape[:-1] + (1,)), eta], -1)
    e -= e.max(-1, keepdims=True)
    p = np.exp(e)
    return p / p.sum(-1, keepdims=True)


def mnl(F, y, w, pen):
    """Weighted multinomial logit, Election Day the reference, ridge by feature."""
    K = F.shape[1]; B = np.zeros((K, 2)); Y = np.eye(3)[y]
    L = np.diag(np.concatenate([pen, pen]))
    for _ in range(60):
        P = softmax(F @ B)
        G = np.concatenate([F.T @ (w * (Y[:, k] - P[:, k])) for k in (1, 2)]) - L @ B.T.reshape(-1)
        H = np.zeros((2 * K, 2 * K))
        for a in (1, 2):
            for bb in (1, 2):
                s = w * P[:, a] * ((a == bb) - P[:, bb])
                H[(a - 1) * K:a * K, (bb - 1) * K:bb * K] = -(F.T * s) @ F
        H -= L
        step = np.linalg.solve(H, G)
        B -= step.reshape(2, K).T
        if np.abs(step).max() < 1e-8:
            break
    return B


def fit_mode(s):
    F, pen = design(s.j, s.a, s.b, s.col, s.h, lg(s.t) - LEAN_C, s.r)
    return mnl(F, s["mode"].values.astype(int), s.turnout_propensity.values, pen)


def return_prior(s):
    """Republican and Independent mail voters' completion odds against Democrats', from turnout propensity."""
    mp = s[(s.likely_voter == 1) & (s["mode"] == 1)]
    pr = {k: np.clip(mp.turnout_propensity[mp.j == k].mean(), 0.05, 0.99) for k in (0, 1, 2)}
    return float(lg(pr[1]) - lg(pr[0])), float(lg(pr[2]) - lg(pr[0]))


# ── the forecast electorate, type by type ───────────────────────────────────────
def load_types(st):
    for k in (st, st + "G"):
        p = f"{FC}/behavior_types_{k}.npz"
        if os.path.exists(p):
            z = np.load(p, allow_pickle=True)
            return dict(pops=z["pops"].astype(float), lt=z["lt"].astype(float), gg=z["gg"].astype(int), fips=[str(f) for f in z["fips"]])
    return None

STATES = sorted(set(c.st) - {"DC"})
TYPES = {st: load_types(st) for st in STATES}
FALLBACK = [st for st in STATES if TYPES[st] is None]


def electorate(st, delta=None):
    """[C, K] expected voters, or registered adults when delta is given."""
    t = TYPES[st]
    return t["pops"] * inv(t["lt"] + (0.0 if delta is None else delta))


def type_parts(st):
    t = TYPES[st]; gg = t["gg"]
    return dict(a=gg // 96, b=(gg // 24) % 4, col=(gg // 12) % 2, j=(gg // 4) % 3, h=gg % 4)


def mode_probs(st, B):
    """[C, K, 3] chance of Election Day, mail and early for every county and type."""
    t = TYPES[st]; tp = type_parts(st); K = len(tp["j"])
    out = []
    for f in t["fips"]:
        x = lg(T24.get(f, state_t.get(st, 0.5))) - LEAN_C
        F, _ = design(tp["j"], tp["a"], tp["b"], tp["col"], tp["h"], np.full(K, x), np.full(K, REGIMES.index(regime(st))))
        out.append(softmax(F @ B))
    return np.stack(out)


def party_sum(W, j):
    return np.stack([W[..., j == k].sum(-1) for k in (0, 1, 2)], -1)


def lr(m):
    m = np.asarray(m, float)
    return np.stack([np.log(m[..., 1] / m[..., 0]), np.log(m[..., 2] / m[..., 0])], -1)


DELTA = {}
for st in UNIVERSAL & set(STATES):
    if TYPES[st] is None: continue
    if st in FILE_TOTAL:
        lo, hi = -2.0, 8.0
        for _ in range(50):
            m = (lo + hi) / 2
            lo, hi = (m, hi) if electorate(st, m).sum() < FILE_TOTAL[st] else (lo, m)
        DELTA[st] = (lo + hi) / 2
dmed = float(np.median(list(DELTA.values()))) if DELTA else 1.5
for st in UNIVERSAL & set(STATES):
    DELTA.setdefault(st, dmed)


def state_mixes(B, k=1.0):
    """County party mixes [C, mode, 3] for mode in mail, early, file, lv; plus statewide sums."""
    res = {}
    for st in STATES:
        if TYPES[st] is None: continue
        tp = type_parts(st); V = electorate(st); P = mode_probs(st, B)
        lv = party_sum(V, tp["j"])
        mail = party_sum(V * P[..., 1], tp["j"]); early = party_sum(V * P[..., 2], tp["j"])
        if st in UNIVERSAL:
            # every registered voter is mailed a ballot and nearly every voter returns it by
            # mail or drop box, so the mail electorate is the electorate itself
            fil = party_sum(electorate(st, DELTA[st]), tp["j"]); mail = lv.copy()
        else:
            fil = mail.copy()
        # calibration: scale the mail skew against all voters by k, county by county
        if st not in UNIVERSAL and k != 1.0:
            z = lr(lv) + k * (lr(mail) - lr(lv))
            n = mail.sum(-1, keepdims=True)
            e = np.concatenate([np.ones(z.shape[:-1] + (1,)), np.exp(z)], -1)
            mail = n * e / e.sum(-1, keepdims=True); fil = mail.copy()
        res[st] = dict(mail=mail, early=early, file=fil, lv=lv, fips=TYPES[st]["fips"])
    return res


def calib_k(res):
    """Observed requester tilt against the file over the model's mail tilt against all voters."""
    rows = []
    for st in REG:
        m = res[st]["mail"].sum(0); v = res[st]["lv"].sum(0)
        pred = float(np.log(m[1] / m[0]) - np.log(v[1] / v[0]))
        obs = float(np.log(REQ[st][0] / REQ[st][1]) - np.log(REG[st][0] / REG[st][1]))
        rows.append(dict(st=st, obs=obs, pred=pred, w=np.sqrt(sum(REQ[st]))))
    return rows


def k_from(rows):
    w = np.array([r["w"] for r in rows]); o = np.array([r["obs"] for r in rows]); p = np.array([r["pred"] for r in rows])
    return float((w * o * p).sum() / (w * p * p).sum())


# ── point fit, calibration, leave one out ───────────────────────────────────────
B0 = fit_mode(fit)
raw = state_mixes(B0)
crow = calib_k(raw)
K0 = k_from(crow)
loo = []
for r in crow:
    kk = k_from([q for q in crow if q["st"] != r["st"]])
    loo.append(dict(st=r["st"], observed=round(r["obs"], 3), uncalibrated=round(r["pred"], 3),
                    held_out=round(kk * r["pred"], 3), k_without=round(kk, 3)))
K_SD = float(np.std([q["k_without"] for q in loo]) * np.sqrt(len(loo) - 1)) + 0.05
print(f"mail skew scale k = {K0:.3f}, leave one out spread {K_SD:.3f}")
for q in loo: print("  ", q)
point = state_mixes(B0, K0)

# fallback states with no forecast race: borrow each county's mix from a regression on
# 2024 lean across every forecast county, by mode and ballot rule
X, Y = {m: [] for m in ("mail", "early", "file", "lv")}, {m: [] for m in ("mail", "early", "file", "lv")}
for st, r in point.items():
    xs = np.array([lg(T24.get(f, 0.5)) for f in r["fips"]])
    for m in X:
        X[m].append(np.column_stack([np.ones_like(xs), xs, xs ** 2, np.full_like(xs, REGIMES.index(regime(st)) == 2),
                                     np.full_like(xs, regime(st) == "permanent")]))
        Y[m].append(lr(r[m]))
COEF = {m: np.linalg.lstsq(np.concatenate(X[m]), np.concatenate(Y[m]), rcond=None)[0] for m in X}


def fallback_mix(st, fips):
    xs = np.array([lg(T24.get(f, 0.5)) for f in fips])
    A = np.column_stack([np.ones_like(xs), xs, xs ** 2, np.full_like(xs, regime(st) == "excuse"), np.full_like(xs, regime(st) == "permanent")])
    out = {}
    for m in ("mail", "early", "file", "lv"):
        z = A @ COEF[m]; e = np.concatenate([np.ones((len(xs), 1)), np.exp(z)], -1)
        out[m] = e / e.sum(-1, keepdims=True) * np.array([ADULTS.get(f, 1) for f in fips])[:, None]
    return out

for st in FALLBACK:
    fl = sorted(c.fips[c.st == st])
    point[st] = dict(fips=fl, **fallback_mix(st, fl))

MODES = ["mail", "early", "file"]

# ── demographic tables for raking: party mix by age and by race, per state and mode ─
def demo_tables(st, B):
    if TYPES[st] is None: return None
    tp = type_parts(st); V = electorate(st); P = mode_probs(st, B)
    W = {"mail": V * P[..., 1], "early": V * P[..., 2], "file": electorate(st, DELTA[st]) if st in UNIVERSAL else V * P[..., 1]}
    if st in UNIVERSAL: W["mail"] = V
    out = {}
    for m, w in W.items():
        tot = w.sum(0)
        rec = {}
        for dim, idx, nlev in (("age", tp["a"], 4), ("race", tp["b"], 4)):
            mix, share = [], []
            for lv_ in range(nlev):
                s = party_sum(tot[None, :] * (idx == lv_)[None, :], tp["j"])[0]
                share.append(s.sum()); mix.append(s / max(s.sum(), 1e-9))
            mix = np.array(mix)
            sh = np.array(share) / sum(share)
            rec[dim] = dict(share=[round(float(x), 4) for x in sh], mix=[[round(float(x), 4) for x in r] for r in mix])
        out[m] = rec
    return out

DEMO = {st: demo_tables(st, B0) for st in STATES if TYPES[st] is not None}

# ── simulation draws: statewide offsets in log odds, per state and mode ──────────
def state_lr(res, st, m):
    return lr(res[st][m].sum(0))

base_lr = {st: {m: state_lr(point, st, m) for m in MODES} for st in point}
OFF = {st: [] for st in point}
PRIOR = []
n = len(fit)
for it in range(DRAWS):
    s = fit.iloc[rng.integers(0, n, n)]
    Bd = fit_mode(s)
    kd = float(K0 + K_SD * rng.standard_normal())
    res = state_mixes(Bd, kd)
    PRIOR.append(return_prior(d.iloc[rng.integers(0, len(d), len(d))]))
    reg_off = {g: [] for g in REGIMES}
    for st in res:
        e = 0.05 * rng.standard_normal()                   # electorate party shock, shared across modes
        o = []
        for m in MODES:
            v = state_lr(res, st, m) - base_lr[st][m]
            o.append([round(float(v[0] + e), 3), round(float(v[1]), 3)])
        OFF[st].append(o); reg_off[regime(st)].append(o)
    for st in FALLBACK:
        pool = reg_off[regime(st)] or reg_off["request"]
        o = np.mean(np.array(pool), 0) + np.array([[0.05 * rng.standard_normal(), 0]] * 3)
        OFF[st].append([[round(float(a), 3), round(float(b), 3)] for a, b in o])
    if it % 25 == 0: print("draw", it)

# ── checks against states that do publish party ─────────────────────────────────
def margin(m): m = np.asarray(m, float); return float((m[0] - m[1]) / m.sum() * 100)
check = []
for st in REG:
    rq = REQ[st]; T = sum(rq)
    sims = []
    for o in OFF[st]:
        z = base_lr[st]["mail"] + np.array(o[0])
        e = np.array([1, np.exp(z[0]), np.exp(z[1])]); e /= e.sum(); sims.append((e[0] - e[1]) * 100)
    # the model is party identification and the feed is registration, so the comparison
    # is made on the tilt: the model's requesters against its own electorate, the feed's
    # requesters against the state's registered voters
    regm = (REG[st][1] - REG[st][0]) / sum(REG[st]) * 100
    lvm = margin(point[st]["lv"].sum(0))
    pm = margin(point[st]["mail"].sum(0))
    check.append(dict(st=st, modelMargin=round(pm, 1), lo=round(float(np.percentile(sims, 10)), 1),
                      hi=round(float(np.percentile(sims, 90)), 1), reportedMargin=round((rq[1] - rq[0]) / T * 100, 1),
                      modelTilt=round(pm - lvm, 1), reportedTilt=round((rq[1] - rq[0]) / T * 100 - regm, 1)))

pr = np.array(PRIOR)
FILE_RETURN = {st: round(float(point[st]["lv"].sum() / point[st]["file"].sum()), 3) for st in DELTA if TYPES.get(st) is not None}
_fr = float(np.median(list(FILE_RETURN.values())))
for st in UNIVERSAL & set(STATES):
    FILE_RETURN.setdefault(st, round(_fr, 3))
mix_out = {}
for st, r in point.items():
    for i, f in enumerate(r["fips"]):
        rows_ = []
        for m in MODES:
            v = np.maximum(r[m][i] / max(r[m][i].sum(), 1e-9), 0.003)   # no county is all one party
            rows_.append([round(float(x), 4) for x in v / v.sum()])
        mix_out[f] = rows_

out = {
    "meta": {
        "version": 2, "built": datetime.date.today().isoformat(), "respondents": int(len(fit)), "draws": DRAWS,
        "forecast": os.path.basename(os.path.normpath(FC)), "modes": MODES,
        "mailSkewScale": round(K0, 3), "mailSkewScaleSd": round(K_SD, 3), "calibration": loo,
        "fileDelta": {k: round(v, 3) for k, v in DELTA.items()},
        # universal mail states: expected ballots returned over ballots mailed, so a
        # county's return rate can be read against the share that will ever come back
        "fileReturn": FILE_RETURN,
        "fallbackStates": FALLBACK,
        # each state's whole 2026 electorate, so a live check on returns can compare tilts
        "lv": {st: [round(float(x), 4) for x in (r["lv"].sum(0) / r["lv"].sum())] for st, r in point.items()},
        # registration by party, R, D, others, for states whose returns or requests are checked
        "registration": {**{k: list(v) for k, v in REG.items()}, **{k: list(v) for k, v in REG_CHECK.items()}},
        "check": check,
        "paramKeys": ["returnPriorR", "returnPriorI"],
    },
    "regime": {st: regime(st) for st in STATES + ["DC"]},
    "point": [round(float(pr[:, 0].mean()), 4), round(float(pr[:, 1].mean()), 4)],
    "draws": [[round(float(a), 4), round(float(b), 4)] for a, b in pr],
    "mix": mix_out,                                   # fips: [[D,R,I] mail, [D,R,I] early, [D,R,I] file]
    "offsets": OFF,                                   # st: draws x modes x [R/D, I/D] log odds
    "demo": DEMO,                                     # st: mode: age|race: {share, mix}
    "counties": {f: [round(float(t), 4), int(p)] for f, t, p in zip(c.fips, c.t, c.adult_population_18plus)},
}
json.dump(out, open(OUT, "w"), separators=(",", ":"))
print(f"wrote {OUT}: {len(fit)} respondents, {DRAWS} draws, {len(mix_out)} counties, {os.path.getsize(OUT) // 1024} KB")
for r in check:
    print(f"  {r['st']}  model D{r['modelMargin']:+.1f} [{r['lo']:+.1f}, {r['hi']:+.1f}]  reported D{r['reportedMargin']:+.1f}"
          f"   tilt model {r['modelTilt']:+.1f} reported {r['reportedTilt']:+.1f}")
