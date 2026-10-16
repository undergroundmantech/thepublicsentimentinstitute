"""Build public/earlyvote-party-model.json, the TPSI party estimate for early vote
ballots in states that report no party. Version 2 October 1 2026; version 3, the
registration basis, October 13; version 4, county registration, October 16.

Version 4 puts every state on the same party registration basis as the states that
report party. Each party registration state is read from its published registration,
county by county from public/voterreg, against the forecast's own registered voters,
so requesters keep their mail skew instead of being set to the registration mix.
States that publish party on requests are pinned to those requests statewide and
spread across counties by their registration. States without party registration keep
the L2 style primary history model, with the pooled gap now measured across every
registration state. Set VOTERREG to a different voterreg folder if needed.

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
import json, os, glob, datetime, re, unicodedata
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

# ── registration basis, version 3, October 13 2026 ──────────────────────────────
# The forecast electorate carries party identification. The feed, and L2's dashboards,
# carry party registration, or in states without it a modeled party built mostly on
# which primary ballot a voter has pulled. The two differ by state and the differences
# are large: Wyoming Democrats who register Republican to vote in the only primary that
# matters, the old Democratic registrations of North Carolina, Oklahoma and Iowa,
# Rhode Island's unaffiliated Democrats. So each state takes the best evidence it has:
#   1. party on its requests in the feed: its own measured gap, request mix reported
#      against request mix modeled;
#   2. party registration with no party in the feed: its published registration totals
#      against the model's voter file;
#   3. no party registration: what L2 does, a modeled party built from primary history
#      where a voter has one, county by county from the 2026 primaries and shrunk by
#      primary turnout, and the pooled registration gap for everyone else;
#   4. anything else: the pooled gap.
# The pool is a robust mean over the measured states, every state counted once, since
# the spread between states, not sampling noise, is what limits it.
# ── version 4, October 16 2026: published registration, county by county ────────────
# Version 3 set Kentucky, Maryland and Idaho requests to the statewide registration mix,
# which erased their mail skew, and gave every other registration state the pooled gap.
# Version 4 reads the published registration of every party registration state, county by
# county where the state reports it, against the forecast's own registered voters: the
# forecast's adults with each type's registration chance set so the state's total matches.
# The gap that comes out is applied to every mode, so requesters keep their own skew.
VR = os.environ.get("VOTERREG", os.path.join(ROOT, "public", "voterreg"))
VRS = {x["abbr"]: x for x in json.load(open(os.path.join(VR, "summary.json")))["states"]}
_nm = lambda x: re.sub(r"[^a-z]", "", unicodedata.normalize("NFKD", str(x)).encode("ascii", "ignore").decode().lower()
                      .replace("county", "").replace("parish", "").replace("saint", "st"))
CFIPS = {(st_, _nm(n_)): f_ for f_, n_, st_ in zip(c.fips, c.COUNTY, c.st)}
TOWN = {}
try:                                   # New England towns report registration; the model runs on counties
    import zipcodes
    _tv = {}
    for z_ in zipcodes.list_all():
        if z_["state"] in ("CT", "NH", "RI", "VT", "ME", "MA"):
            f_ = CFIPS.get((z_["state"], _nm(z_["county"])))
            if f_: _tv.setdefault((z_["state"], _nm(z_["city"])), []).append(f_)
    TOWN = {k_: max(set(v_), key=v_.count) for k_, v_ in _tv.items()}
except ImportError:
    print("zipcodes not installed: town level registration falls back to the state total")
def county_reg(st):
    s_ = VRS.get(st)
    if not s_ or not s_.get("registers_by_party") or not s_.get("party"): return None
    P_ = s_["party"]; tot = np.array([P_["DEM"], P_["REP"], P_.get("UNA", 0) + P_.get("OTH", 0)], float)
    out_ = {}
    p_ = os.path.join(VR, "counties", f"{st}.json")
    if os.path.exists(p_):
        for r_ in json.load(open(p_)).get("counties", []):
            f_ = str(r_["fips"]).zfill(5) if r_.get("fips") else TOWN.get((st, _nm(re.sub(r"\s+(town|city|plantation)$", "", r_["name"], flags=re.I))))
            if not f_ or not r_.get("party"): continue
            q_ = r_["party"]; out_[f_] = out_.get(f_, 0) + np.array([q_["DEM"], q_["REP"], q_.get("UNA", 0) + q_.get("OTH", 0)], float)
    return tot, out_, s_["as_of"]
N_REG0 = 1500.0        # county readings shrink toward the state's own gap below about this many registrants
def reg_universe(st, total):
    """[C, 3] registered voters by party in the forecast's terms, D, R, I."""
    if TYPES.get(st) is None:
        m_ = point[st]["lv"]; return m_ * total / m_.sum()
    lo_, hi_ = -3.0, 10.0
    for _ in range(60):
        mid = (lo_ + hi_) / 2
        lo_, hi_ = (mid, hi_) if electorate(st, mid).sum() < total else (lo_, mid)
    return party_sum(electorate(st, (lo_ + hi_) / 2), type_parts(st)["j"])
def reg_gaps(st):
    cr = county_reg(st)
    if cr is None or st not in point: return None
    tot, cty, asof = cr
    U = reg_universe(st, tot.sum()); fips_ = point[st]["fips"]; nC_ = len(fips_)
    m_ = U.sum(0)
    gR_ = float(np.log(tot[1] / tot[0]) - np.log(m_[1] / m_[0])); gI_ = float(np.log(tot[2] / tot[0]) - np.log(m_[2] / m_[0]))
    cR, cI = np.full(nC_, gR_), np.full(nC_, gI_); covered = 0.0
    for i_, f_ in enumerate(fips_):
        v_ = cty.get(f_)
        if v_ is None or min(v_[0], v_[1]) <= 0 or min(U[i_]) <= 0: continue
        w_ = v_.sum() / (v_.sum() + N_REG0); covered += v_.sum()
        cR[i_] = gR_ + w_ * float(np.clip(np.log(v_[1] / v_[0]) - np.log(U[i_, 1] / U[i_, 0]) - gR_, -2.5, 2.5))
        if v_[2] > 0:
            cI[i_] = gI_ + w_ * float(np.clip(np.log(v_[2] / v_[0]) - np.log(U[i_, 2] / U[i_, 0]) - gI_, -2.5, 2.5))
    # the shifted universe must add up to the state's published totals exactly
    for _ in range(30):
        z_ = lr(U) + np.column_stack([cR, cI]); e_ = np.concatenate([np.ones((nC_, 1)), np.exp(z_)], -1)
        sm = (U.sum(-1, keepdims=True) * e_ / e_.sum(-1, keepdims=True)).sum(0)
        dR = np.log(tot[1] / tot[0]) - np.log(sm[1] / sm[0]); dI = np.log(tot[2] / tot[0]) - np.log(sm[2] / sm[0])
        cR += dR; cI += dI
        if abs(dR) + abs(dI) < 1e-6: break
    return dict(gR=gR_, gI=gI_, cR=cR, cI=cI, cover=round(covered / tot.sum(), 3), asof=asof, tot=tot)
PRIM = json.load(open(os.environ.get("PRIM_FILE", os.path.join(os.path.dirname(os.path.abspath(__file__)), "county_primaries_2026.json"))))
# requests by party in the feed, October 12 2026: R, D, all others
OBS = {"AZ": (1140446, 1040747, 1057237), "CO": (884686, 993105, 2148724), "CT": (5979, 17278, 9962),
       "FL": (601617, 764570, 409690), "IA": (30857, 64777, 18466), "ME": (22916, 69118, 38603),
       "NC": (22780, 52537, 53208), "NE": (95120, 75172, 35092), "NJ": (171412, 520598, 205676),
       "NM": (16774, 48164, 15083), "NV": (570013, 576398, 937802), "OK": (23547, 22187, 7868),
       "PA": (263028, 729989, 112394), "RI": (1789, 13795, 10778), "SD": (13694, 8347, 4880), "WY": (18919, 4623, 1872)}
# statewide registration, R, D, others, for party registration states the feed reports
# without party: California September 4 2026 report of registration; Kentucky
# September 2026 monthly report, 48% R, 41% D, 11% other of about 3.33 million;
# Maryland and Idaho as above.
REG_FILE = {"CA": (5747193, 10405618, 7012166), "KY": (1600000, 1366000, 364000),
            "MD": REG_CHECK["MD"], "ID": REG_CHECK["ID"]}
NO_REG = set("AL AR GA HI IL IN MI MN MO MS MT ND OH SC TN TX VA VT WA WI".split())
PRIM_N0 = 400.0
# share of a state's voters whose L2 party comes from primary history: several cycles of
# primary ballots reach about 1.7 times one cycle's primary electorate, capped at 60%
HIST_MULT, LAM_CAP = 1.7, 0.6
def _prim(st, fips=None):
    P = PRIM.get(st, {}); rows = [P[f] for f in (fips or P) if f in P]
    d = sum(r[0] for r in rows); r = sum(r[1] for r in rows)
    return d, r
def prim_ok(st):
    # a primary electorate that runs more than 25 points from the state's own 2024 vote is
    # a turnout or data artifact, not a party profile: Vermont's 2026 file shows three
    # Republican primary ballots for every Democratic one in a state Harris won by 31
    d, r = _prim(st)
    if d + r <= 0: return False
    sh = r / (d + r)
    return 0.15 <= sh <= 0.85 and abs(sh - float(state_t.get(st, sh))) <= 0.25
def lv_lr(st, i=None):
    v = point[st]["lv"] if i is None else point[st]["lv"][i:i + 1]
    v = v.sum(0); return float(np.log(v[1] / v[0]))
# Statewide primary votes, D and R, at the top of the ticket, 2018 through 2026. L2 gives a
# voter the party of the most recent primary ballot they pulled, so 2026 counts for half
# and the cycles before it share the other half. A state outside this table uses its
# 2026 county totals alone.
PRIM_HIST = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "state_primaries_2018_2026.json")))
PG_CAP = 0.5
def prim_lr_state(st):
    d, r = _prim(st); lr26 = float(np.log(r / d))
    h = PRIM_HIST.get(st)
    if not h: return lr26
    past = [float(np.log(v[2] / v[1])) for y, v in h.items() if y != "2026" and v[1] > 0 and v[2] > 0]
    if "2026" in h: lr26 = float(np.log(h["2026"][2] / h["2026"][1]))
    return 0.5 * lr26 + 0.5 * (float(np.mean(past)) if past else lr26)
def primgap_state(st):
    return float(np.clip(prim_lr_state(st) - lv_lr(st), -PG_CAP, PG_CAP))
def mix_of(st):
    return point[st]["file" if st in UNIVERSAL else "mail"].sum(0)
REGROWS = []
for st, (R_, D_, O_) in OBS.items():
    if st not in point: continue
    mm = mix_of(st)
    REGROWS.append(dict(st=st, gR=float(np.log(R_ / D_) - np.log(mm[1] / mm[0])), gI=float(np.log(O_ / D_) - np.log(mm[2] / mm[0])),
                        pg=primgap_state(st) if prim_ok(st) else None))
def huber(y, c=1.345):
    y = np.asarray(y, float); mu = float(np.median(y))
    sc = max(1e-3, 1.4826 * float(np.median(np.abs(y - mu))))
    for _ in range(50):
        r = (y - mu) / sc; w = np.minimum(1.0, c / np.maximum(np.abs(r), 1e-9))
        mu = float((w * y).sum() / w.sum())
    return mu, sc
REGG = {st: reg_gaps(st) for st in point}
REGG = {k: v for k, v in REGG.items() if v is not None}
# Validation: in the states that publish party on their requests, the gap measured on the
# requests against the gap the published registration alone gives. Their difference is
# the error a registration anchored state carries, since its requests cannot be checked.
VAL = [dict(st=r["st"], feed=r["gR"], reg=REGG[r["st"]]["gR"]) for r in REGROWS if r["st"] in REGG]
REG_XMU, REG_X = huber([v["feed"] - v["reg"] for v in VAL])
print(f"registration anchor against the feed: mean {REG_XMU:+.3f}, robust spread {REG_X:.3f} over {len(VAL)} states")
for v in VAL: print(f"   {v['st']} requests {v['feed']:+.3f}  registration {v['reg']:+.3f}")
# the pooled gap for voters without registration or primary history: every registration
# state counted once, measured on its registered voters
gRs = np.array([v["gR"] for v in REGG.values()]); gIs = np.array([v["gI"] for v in REGG.values()])
REG_A, REG_TAU = huber(gRs)
REG_I, _ = huber(gIs)
REG_TAU = max(REG_TAU, REG_X)
_gst = list(REGG)
LOO_MU = {r["st"]: huber(np.delete(gRs, _gst.index(r["st"])) if r["st"] in _gst else gRs)[0] for r in REGROWS}
REG_LOO = float(np.sqrt(np.mean([(r["gR"] - LOO_MU[r["st"]]) ** 2 for r in REGROWS])))
# the old weighted mean let Arizona, a third of every request in the pool, set the answer
print(f"registration basis: pooled gap {REG_A:+.3f} (spread {REG_TAU:.3f}, held out error {REG_LOO:.3f}), independents {REG_I:+.3f}")
SHIFT, SHIFT_I, SHOCK, SOURCE, LAMBDA = {}, {}, {}, {}, {}
for st, r in point.items():
    nC = len(r["fips"]); mm = r["file"].sum(0)
    row = next((x for x in REGROWS if x["st"] == st), None)
    gg_ = REGG.get(st)
    if row is not None:
        # the state level from its own requests; the county pattern from its registration
        sh = np.full(nC, row["gR"]); si = np.full(nC, row["gI"]); sd = 0.05; SOURCE[st] = "feed"
        if gg_ is not None:
            sh = sh + (gg_["cR"] - gg_["gR"]); si = si + (gg_["cI"] - gg_["gI"])
            # the county pattern must not move the state off its own reported requests
            R_, D_, O_ = OBS[st]; mx = r["file" if st in UNIVERSAL else "mail"]
            for _ in range(30):
                z_ = lr(mx) + np.column_stack([sh, si]); e_ = np.concatenate([np.ones((nC, 1)), np.exp(z_)], -1)
                sm = (mx.sum(-1, keepdims=True) * e_ / e_.sum(-1, keepdims=True)).sum(0)
                dR = np.log(R_ / D_) - np.log(sm[1] / sm[0]); dI = np.log(O_ / D_) - np.log(sm[2] / sm[0])
                sh = sh + dR; si = si + dI
                if abs(dR) + abs(dI) < 1e-6: break
    elif gg_ is not None:
        sh = gg_["cR"].copy(); si = gg_["cI"].copy(); sd = REG_X; SOURCE[st] = "registration"
    elif st in NO_REG and prim_ok(st):
        d_, r_ = _prim(st)
        lam = float(min(LAM_CAP, HIST_MULT * (d_ + r_) / max(1.0, float(r["lv"].sum()))))
        # the state level from the primary history; the county pattern around it from 2026,
        # each county's own 2026 reading against the state's, shrunk by its primary turnout
        pgs = primgap_state(st); d26, r26 = _prim(st); base26 = float(np.log(r26 / d26)) - lv_lr(st); sh = []
        for i, f in enumerate(r["fips"]):
            if f in PRIM[st]:
                d, rr = PRIM[st][f]; n = d + rr
                dev = float(lg(np.clip(rr / n, 0.02, 0.98)) - lv_lr(st, i)) - base26 if n > 0 else 0.0
                pg = pgs + float(np.clip(n / (n + PRIM_N0) * dev, -1.0, 1.0))
            else:
                pg = pgs
            sh.append(lam * pg + (1 - lam) * REG_A)
        sh = np.array(sh); si = np.full(nC, REG_I); LAMBDA[st] = round(lam, 3)
        sd = float(np.sqrt(((1 - lam) * REG_TAU) ** 2 + (lam * 0.25) ** 2)); SOURCE[st] = "primary"
    else:
        sh = np.full(nC, REG_A); si = np.full(nC, REG_I); sd = REG_TAU; SOURCE[st] = "pooled"
    SHIFT[st], SHIFT_I[st], SHOCK[st] = sh, si, sd
    for m in ("mail", "early", "file", "lv"):
        z = lr(r[m]); z = z + np.column_stack([sh, si])
        n_ = r[m].sum(-1, keepdims=True); e = np.concatenate([np.ones(z.shape[:-1] + (1,)), np.exp(z)], -1)
        r[m] = n_ * e / e.sum(-1, keepdims=True)
for st in sorted(SOURCE):
    if True:
        mean_sh = float(np.average(SHIFT[st], weights=np.maximum(point[st]["lv"].sum(-1), 1e-9)))
        print(f"   {st} {SOURCE[st]:12s} shift {mean_sh:+.3f}  I {float(np.mean(SHIFT_I[st])):+.3f}  sd {SHOCK[st]:.3f}" + (f"  primary weight {LAMBDA[st]:.2f}" if st in LAMBDA else ""))
# the evidence's own error is part of every draw: a state level shock on the R/D log odds
for st in OFF:
    for o in OFF[st]:
        e = SHOCK.get(st, REG_TAU) * rng.standard_normal()
        for oo in o: oo[0] = round(oo[0] + e, 3)
REG_SD = REG_LOO
REG_B, USE_SLOPE = 0.0, False

# ── checks against states that do publish party ─────────────────────────────────
def margin(m): m = np.asarray(m, float); return float((m[0] - m[1]) / m.sum() * 100)
check = []
for st, rq in OBS.items():
    if st not in point or st not in REGG: continue
    T = sum(rq)
    sims = []
    for o in OFF[st]:
        z = state_lr(point, st, "mail") + np.array(o[0])
        e = np.array([1, np.exp(z[0]), np.exp(z[1])]); e /= e.sum(); sims.append((e[0] - e[1]) * 100)
    tot = REGG[st]["tot"]
    regm = (tot[0] - tot[1]) / tot.sum() * 100
    lvm = margin(point[st]["lv"].sum(0))
    pm = margin(point[st]["mail"].sum(0))
    own = next(x["gR"] for x in REGROWS if x["st"] == st)
    def _as_if(g):
        zz = lr(point[st]["mail"].sum(0)) + np.array([g - own, 0.0])
        ee = np.array([1, np.exp(zz[0]), np.exp(zz[1])]); ee /= ee.sum(); return float((ee[0] - ee[1]) * 100)
    # as if the state reported no party on its requests: from its published registration
    # alone, and from the pooled gap with the state itself left out
    check.append(dict(st=st, heldOut=round(_as_if(LOO_MU[st]), 1), fromRegistration=round(_as_if(REGG[st]["gR"]), 1),
                      modelMargin=round(pm, 1), lo=round(float(np.percentile(sims, 10)), 1),
                      hi=round(float(np.percentile(sims, 90)), 1), reportedMargin=round((rq[1] - rq[0]) / T * 100, 1),
                      modelTilt=round(pm - lvm, 1), reportedTilt=round((rq[1] - rq[0]) / T * 100 - regm, 1)))
check.sort(key=lambda x: -sum(OBS[x["st"]]))
_e_reg = float(np.sqrt(np.mean([(x["fromRegistration"] - x["reportedMargin"]) ** 2 for x in check])))
_e_pool = float(np.sqrt(np.mean([(x["heldOut"] - x["reportedMargin"]) ** 2 for x in check])))
print(f"request margin error as if unreported: from registration {_e_reg:.1f} points, pooled {_e_pool:.1f} points")

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
        "version": 4, "basis": "registration", "registrationFit": {"pooled": round(REG_A, 4), "spread": round(REG_TAU, 4), "heldOutError": round(REG_LOO, 4), "independents": round(REG_I, 4), "primaryHistoryMult": HIST_MULT,
            "anchorError": round(REG_X, 4), "anchorBias": round(REG_XMU, 4), "marginError": {"fromRegistration": round(_e_reg, 1), "pooled": round(_e_pool, 1)},
            "county": {st: dict(cover=v["cover"], asOf=v["asof"], spread=round(float(np.std(v["cR"])), 3)) for st, v in REGG.items()}, "states": [dict(st=r["st"], gap=round(r["gR"], 3), heldOut=round(LOO_MU[r["st"]], 3)) for r in REGROWS], "source": SOURCE, "primaryWeight": LAMBDA, "shift": {st: round(float(np.average(SHIFT[st], weights=np.maximum(point[st]["lv"].sum(-1), 1e-9))), 3) for st in SHIFT}}, "built": datetime.date.today().isoformat(), "respondents": int(len(fit)), "draws": DRAWS,
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
        "registration": {st: [int(v["tot"][1]), int(v["tot"][0]), int(v["tot"][2])] for st, v in REGG.items()},
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
    print(f"  {r['st']}  from registration D{r['fromRegistration']:+.1f}  held out D{r['heldOut']:+.1f}  fitted D{r['modelMargin']:+.1f} [{r['lo']:+.1f}, {r['hi']:+.1f}]  reported D{r['reportedMargin']:+.1f}"
          f"   tilt model {r['modelTilt']:+.1f} reported {r['reportedTilt']:+.1f}")
