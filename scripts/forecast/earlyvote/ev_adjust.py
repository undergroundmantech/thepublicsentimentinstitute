"""Early vote adjustment for every race in the forecast (Oct 18 2026).

What it reads
  ev_signals.json        the early vote page's own read of every reporting state (ev_signals.ts): ballots by mail and in
                         person, party as reported or as the TPSI party estimate, and the party mix the forecast's 2026
                         electorate expects of those ballots at the mix of mail and in person ballots cast so far
  earlyvote-history.json ballots cast before Election Day on dated days in 2022 and 2024, final turnout, and the party
                         split of past early votes at the same point
  earlyvote-electorate   the forecast's expected 2026 early and total vote by state
  state_primaries        Democratic and Republican primary ballots, 2018 to 2026
  behavior types         each Senate and governor run's simulated voters: adults, turnout and Democratic preference
                         for 1,152 kinds of voter in every county (32 age, race and college cells x party x 2022 and
                         2024 vote history x Trump approval)

How a state's early vote becomes a turnout correction
  1. Party gap. The ballots in against the party mix the forecast expected of them, Republican minus Democratic
     points (delta). Only part of the final electorate has voted: the ballots in carry the whole gap and the ballots
     still to come carry half of it, so the electorate gap is delta x (s + 0.5 (1 - s)), s the share of the expected
     total vote already cast. Registration runs ahead of party identification, so 85 percent of it is read as a gap
     in party identification.
  2. Strength. A state's own reading counts n / (n + 25,000) of its ballots, three times over at most, times
     pace / (pace + 0.1) for how much of its early vote is in, and a state whose party is estimated rather than reported
     counts 35 percent of that.
  3. Timing and previous results. Ballots cast early in the window run more Democratic than the whole early vote,
     so a reported gap is moved 3 points toward Republicans times the share of the early vote still to come. Where a
     state published its early vote party split on this day and at the close in 2022 or 2024, the like for like
     reading, today's lead against that day's less the forecast's expected early vote against that year's final, takes
     65 percent of the weight.
  4. Primary turnout. The Democratic share of 2026 primary ballots against the 2018 and 2022 midterm primaries is a
     weak prior on which party's voters are more engaged, for every state with primary counts.
  5. Neighbours. Every state, with ballots in or not, also reads the gaps of the reporting states most like it, by the
     forecast's own correlation between races and by 2024 vote, race and education. A state with no early vote takes
     its correction from its neighbours and its primary alone.
  6. Turnout level. Ballots cast against the early vote the forecast expects by this day, timed by the state's own
     2022 and 2024 counts on the same number of days out: running ahead points to a larger electorate.
  7. The forecast itself is the prior: the posterior gap is the weighted readings over one plus their weights, so a
     strong early vote moves a race and a thin one barely does.

How the correction moves a race (not a linear shift)
  For each Senate and governor race the gap is turned into a change in each party's turnout, a common offset on the
  turnout log odds of Democratic and Republican identifiers, solved so the simulated electorate's party mix moves by
  the gap; the turnout level moves every voter's turnout log odds. The race is then recounted from its simulated
  voters. Because turnout is a logistic curve, the same offset moves low propensity voters far more than reliable
  ones, so a state whose forecast leans on low propensity voters of one party moves more than one whose margin rests
  on habitual voters, and every county moves by its own voters. House districts take their state's correction in
  proportion to p (1 - p) of their own two party vote, so a lopsided seat moves less than a close one. Statewide down
  ballot races and the legislatures are rebuilt on the adjusted forecast by their own builders.

The correction is stored on each race as ev, so the next run replaces it rather than adding to it.
Margins in the published files are Republican minus Democratic.

Usage: python3 ev_adjust.py SIGNALS_JSON PUBLIC_FORECAST_DIR [--dry]
"""
import glob, json, math, os, sys, copy
import numpy as np

SIG = json.load(open(sys.argv[1]))
PUB = sys.argv[2]
DRY = "--dry" in sys.argv
SITE = os.environ.get("SITE", os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
RUNS = "/tmp/fcrun/runs"
RUN_ORDER = os.environ.get("EV_RUNS", "S1018AK,S1018OH,S1018,S1017C,S1017B,S1017,B2").split(",")
TODAY = os.environ.get("TODAY", "2026-10-18")
ELECTION = "2026-11-03"

KAPPA, RHO, N0, W_MAX, EST_W = 0.5, 0.85, 25000.0, 3.0, 0.35
W_HIST, W_NBR, W_PRIM, W_VOL, CAP = 0.25, 0.6, 0.3, 0.6, 4.0

H = json.load(open(f"{SITE}/public/earlyvote-history.json"))
E = json.load(open(f"{SITE}/public/earlyvote-electorate.json"))
PRIM = json.load(open(f"{SITE}/scripts/earlyvote/state_primaries_2018_2026.json"))
M = json.load(open(f"{PUB}/model.json"))
C = json.load(open(f"{PUB}/counties.json"))
X = json.load(open(f"{PUB}/crosstabs.json"))

inv = lambda x: 1 / (1 + np.exp(-x))
lg = lambda p: math.log(max(1e-6, min(1 - 1e-6, p)) / (1 - max(1e-6, min(1 - 1e-6, p))))
import datetime as _dt
D_OUT = (_dt.date.fromisoformat(ELECTION) - _dt.date.fromisoformat(SIG["snapshot"][:10])).days


def at_day(cps, d):
    """ballots cast before Election Day by d days out: a reported count, between the two nearest, else None"""
    if not cps: return None
    c = sorted(cps, key=lambda x: -x[0])
    for x in c:
        if x[0] == d: return x[1], 0
    if d > c[0][0]: return None
    for a, b in zip(c, c[1:]):
        if a[0] > d > b[0]:
            t = (a[0] - d) / (a[0] - b[0]); return a[1] * (b[1] / a[1]) ** t, a[0] - b[0]
    return None


# ── 1 to 3, 6: each reporting state's own readings ─────────────────────────────────────────────────────────────
own = {}
for st, s in SIG["states"].items():
    n = s["ballots"]; T = max(1.0, s["expectedTotal"]); sh = min(1.0, n / T)
    carry = sh + KAPPA * (1 - sh)
    # Timing. Ballots cast early in the window run more Democratic than the early vote as a whole: in the states that
    # published the party split of their ballots on the same day and at the end, the lead moved 1 to 5 points toward
    # Republicans from 16 days out to the close. The forecast's expected mix is the whole window's, so a reported
    # gap is moved toward Republicans by 3 points times the share of the early vote still to come, half that in a
    # universal mail state. An estimated party already carries the measured return rates, so it is not moved.
    t = 3.0 * (1 - min(1.0, s["pace"])) * (1 - s["estimatedShare"]) * (0.5 if s.get("regime") == "universal" else 1.0)
    own_corr = s["delta"] + t
    # Previous results. Where the state published its early vote party split on this day and at the close in 2022 or
    # 2024, the like for like reading is how far today's lead has moved since that day, less how far the forecast's
    # expected 2026 early vote sits from that year's final early vote: it holds both the calendar and the forecast fixed.
    hs = H["states"].get(st, {})
    hist = []
    if s["estimatedShare"] < 0.2 and s.get("expectedPartyFull"):
        now = (s["party"]["r"] - s["party"]["d"]) * 100
        expf = (s["expectedPartyFull"]["r"] - s["expectedPartyFull"]["d"]) * 100
        for y in ("2022", "2024"):
            pl = hs.get(y, {}).get("party") or []
            same = next((p for p in pl if abs(p[0] - D_OUT) <= 2 and p[0] > 2), None)
            fin = next((p for p in sorted(pl, key=lambda x: x[0]) if p[0] <= 2), None)
            if same and fin:
                hist.append((now - (same[2] - same[1]) * 100) - (expf - (fin[2] - fin[1]) * 100))
    used = 0.35 * own_corr + 0.65 * float(np.mean(hist)) if hist else own_corr
    g_ev = RHO * used * carry                                          # R minus D points of the electorate
    # strength: ballots in, how far into the early vote the state is (pace / (pace + 0.1), so a state with 2 percent of
    # its early vote in counts a sixth as much as one with a third in), and reported rather than estimated party
    w = min(W_MAX, W_MAX * n / (n + N0)) * (s["pace"] / (s["pace"] + 0.1)) * (1 - (1 - EST_W) * s["estimatedShare"])
    rd = {"g": g_ev, "w": w, "delta": s["delta"], "timing": t}
    if hist:
        rd["g_hist"] = RHO * float(np.mean(hist)) * carry; rd["hist_years"] = len(hist)
    # turnout level: ballots against the early vote the forecast expects by today, on the state's past timing
    es = E["states"].get(st)
    vols = []
    if es:
        exp_early = es["modes"]["mail"] + es["modes"]["early"]
        for y, wy in (("2022", 2.0), ("2024", 1.0)):
            yy = hs.get(y, {}); a = at_day(yy.get("cps"), D_OUT)
            if a and a[1] <= 8 and yy.get("early"):
                exp_now = a[0] * exp_early / yy["early"]
                if exp_now > 0: vols.append((math.log(n / exp_now), wy))
    if vols:
        lv = sum(v * w_ for v, w_ in vols) / sum(w_ for _, w_ in vols)
        rd["vol"] = max(-0.15, min(0.15, 0.35 * lv)); rd["vol_raw"] = lv
    own[st] = rd

# ── 4: primary turnout prior ───────────────────────────────────────────────────────────────────────────────────
prim = {}
for st, p in PRIM.items():
    if "2026" not in p: continue
    d26 = p["2026"][1] / max(1, p["2026"][1] + p["2026"][2])
    past = [p[y][1] / max(1, p[y][1] + p[y][2]) for y in ("2018", "2022") if y in p]
    if not past: continue
    pi = lg(d26) - float(np.mean([lg(x) for x in past]))
    prim[st] = {"pi": pi, "g": max(-3.0, min(3.0, -100 * 0.03 * pi))}

# ── 5: neighbours, by the forecast's race correlations and by demographics ─────────────────────────────────────
states = sorted(set(r["st"] for r in M["races"]))
def feats(st):
    es = E["states"].get(st, {})
    rid = next((r["id"] for r in M["races"] if r["st"] == st and r["office"] in ("senate", "governor") and r["id"] in X), None)
    rows = X.get(rid, []) if rid else []
    g = lambda d, k: next((x[2] / 100 for x in rows if x[0] == d and x[1] == k), None)
    return np.array([es.get("trump24", 0.5), g("Race", "Black") or 0.1, g("Race", "Latino") or 0.1,
                     g("Race and education", "White, no college degree") or 0.4])
F = {st: feats(st) for st in states}
SCALE = np.array([0.06, 0.06, 0.06, 0.08])
corr = {}
for r in M["races"]:
    if r["office"] == "house": continue
    for s_ in r.get("similar") or []:
        o = next((x["st"] for x in M["races"] if x["id"] == s_["id"]), None)
        if o and o != r["st"]: corr[(r["st"], o)] = max(corr.get((r["st"], o), 0), s_["corr"])
shrunk = {st: v["g"] * v["w"] / (1 + v["w"]) for st, v in own.items()}
vol_sh = {st: v["vol"] * W_VOL / (1 + W_VOL) for st, v in own.items() if "vol" in v}
def nbr(st, src):
    ws, num = 0.0, 0.0
    for o, val in src.items():
        if o == st: continue
        k = math.exp(-0.5 * float((((F[st] - F[o]) / SCALE) ** 2).sum())) + 2.0 * corr.get((st, o), 0) + 0.02
        ws += k * (own[o]["w"] if o in own else 1); num += k * (own[o]["w"] if o in own else 1) * val
    return num / ws if ws > 0 else 0.0

post = {}
for st in states:
    o = own.get(st)
    num, den = 0.0, 1.0                       # the forecast is the prior: weight one at zero
    if o:
        num += o["w"] * o["g"]; den += o["w"]
    gn = nbr(st, shrunk) if shrunk else 0.0
    num += W_NBR * gn; den += W_NBR
    if st in prim: num += W_PRIM * prim[st]["g"]; den += W_PRIM
    g = num / den
    vn = nbr(st, vol_sh) if vol_sh else 0.0
    vv = ((W_VOL * o["vol"] if o and "vol" in o else 0.0) + 0.5 * vn) / (1 + (W_VOL if o and "vol" in o else 0.0) + 0.5)
    post[st] = {"gap": g, "vol": vv, "nbr": gn, "own": o["g"] if o else None, "w": o["w"] if o else 0.0,
                "hist": o.get("g_hist") if o else None, "prim": prim.get(st, {}).get("g"), "ballots": SIG["states"].get(st, {}).get("ballots", 0),
                "estimatedShare": SIG["states"].get(st, {}).get("estimatedShare"), "source": "early vote" if o else "neighbours and primaries"}


# ── turning a state's correction into each race's change, from its simulated voters ───────────────────────────
def types_for(key):
    for t in RUN_ORDER:
        f = sorted(glob.glob(f"{RUNS}/{t}/lane*/behavior_types_{key}.npz"))
        if f: return f[0], t
    return None, None

def recount(key, gap, vol):
    f, tag = types_for(key)
    if not f: return None
    z = np.load(f)
    pops = z["pops"].astype(float); lt = z["lt"].astype(float); p = inv(z["eta"].astype(float))
    j = (z["gg"].astype(int) // 4) % 3
    cD, cR = (j == 0).astype(float), (j == 1).astype(float)
    def run(theta, v):
        t = inv(lt + v + theta * (0.5 * cR - 0.5 * cD)[None, :])
        V = pops * t
        return V
    V0 = run(0.0, 0.0)
    pm = lambda V: float(((V * cR).sum() - (V * cD).sum()) / V.sum())
    target = pm(run(0.0, vol)) + gap / 100.0
    lo, hi = -3.0, 3.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if pm(run(mid, vol)) < target: lo = mid
        else: hi = mid
    th = (lo + hi) / 2
    V1 = run(th, vol)
    d2 = lambda V: (V * p).sum(1) / np.maximum(V.sum(1), 1e-9)     # county two party Democratic share
    c0, c1 = d2(V0), d2(V1)
    s0 = float((V0 * p).sum() / V0.sum()); s1 = float((V1 * p).sum() / V1.sum())
    # composition alone, for the House
    Vc = run(th, 0.0); sc = float((Vc * p).sum() / Vc.sum())
    return dict(theta=th, run=tag, d2_before=s0, d2_after=s1, dm=200 * (s1 - s0), dm_comp=200 * (sc - s0),
                county={str(fp): 200 * (b - a) for fp, a, b in zip(z["fips"], c0, c1)},
                turnout_change=float(V1.sum() / V0.sum() - 1))


def prob_r(est, shift_r):
    d = est.get("dist")
    if d and d.get("c"):
        tot = sum(d["c"]); win = 0.0
        for i, nn in enumerate(d["c"]):
            a = d["lo"] + i * d["w"] + shift_r; b = a + d["w"]
            win += nn if a >= 0 else (0 if b <= 0 else nn * b / d["w"])
        return win / tot if tot else est["prob"]
    sd = max(1.0, (est["p90"] - est["p10"]) / 2.563)
    return 0.5 * (1 + math.erf((est["margin"] + shift_r) / sd / math.sqrt(2)))

def move(r, s_new, extra):
    """apply the change between this run's correction and the one already in the race"""
    e = r["est"]
    if abs(e["margin"]) >= 99.9: return 0.0
    s_old = (r.get("ev") or {}).get("shift", 0.0)
    ds = s_new - s_old
    p_old = e["prob"]
    p_new = min(0.9995, max(0.0005, p_old + prob_r(e, ds) - prob_r(e, 0.0)))
    e["margin"] = round(e["margin"] + ds, 2); e["prob"] = round(p_new, 4)
    e["p10"] = round(e["p10"] + ds, 2); e["p90"] = round(e["p90"] + ds, 2)
    if e.get("dist"): e["dist"]["lo"] = round(e["dist"]["lo"] + ds, 3)
    for k in ("poll", "rate", "market"):
        if k in r.get("stages", {}): r["stages"][k] = e["margin"]
    v = r.get("votes")
    if v and v.get("total") and not r.get("rcv"):
        dv = -ds / 100 * v["total"] / 2
        v["dem"] = int(round(v["dem"] + dv)); v["rep"] = int(round(v["rep"] - dv))
        for c in r.get("cands", []):
            if c["name"] == r["dem"]: c["votes"] = v["dem"]; c["pct"] = round(100 * v["dem"] / v["total"], 2)
            elif c["name"] == r["gop"]: c["votes"] = v["rep"]; c["pct"] = round(100 * v["rep"] / v["total"], 2)
    if r.get("rcv"):
        rc = r["rcv"]; tot = rc["dem"] + rc["rep"]
        rc["demPct"] = round(50 - e["margin"] / 2, 2); rc["repPct"] = round(100 - rc["demPct"], 2)
        rc["dem"] = int(round(tot * rc["demPct"] / 100)); rc["rep"] = tot - rc["dem"]
    r["ev"] = {"shift": round(s_new, 3), **extra}
    return p_new - p_old


log = []
dprob = {"senate": 0.0, "governor": 0.0, "house": 0.0}
state_comp = {}                                  # per state: composition and level change in D margin points, at its D2
key_of = lambda r: r["st"] + ("G" if r["office"] == "governor" else "")
for r in M["races"]:
    if r["office"] not in ("senate", "governor"): continue
    st = r["st"]; ps = post[st]
    rc = recount(key_of(r), ps["gap"], ps["vol"])
    if rc is None: continue
    third = 1 - (r["votes"]["dem"] + r["votes"]["rep"]) / max(1, r["votes"]["total"]) if r.get("votes") and not r.get("rcv") else 0.0
    s_new = max(-CAP, min(CAP, -rc["dm"] * (1 - third)))
    if r["office"] == "senate" or st not in state_comp:
        state_comp[st] = dict(comp=rc["dm_comp"], level=rc["dm"] - rc["dm_comp"], d2=rc["d2_before"])
    extra = {"gap": round(ps["gap"], 2), "turnout": round(ps["vol"], 3), "theta": round(rc["theta"], 3),
             "source": ps["source"], "ballots": int(ps["ballots"]), "run": rc["run"]}
    s_old = (r.get("ev") or {}).get("shift", 0.0)
    dp = move(r, s_new, extra)
    dprob[r["office"]] += -dp
    # counties: each county by its own voters, recentred so they add back to the state
    cc = C.get(r["id"])
    if cc:
        rows = [(f, v) for f, v in cc.items() if not f.startswith("_")]
        cs = {f: -rc["county"].get(f, rc["county"].get(f.lstrip("0"), rc["dm"])) * (1 - third) for f, _ in rows}
        tw = sum(v[3] for _, v in rows) or 1
        fix = s_new - sum(cs[f] * v[3] for f, v in rows) / tw
        old = cc.get("_ev") or {}
        newmap = {}
        for f, v in rows:
            sc_ = max(-2 * CAP, min(2 * CAP, cs[f] + fix)); d_ = sc_ - old.get(f, 0.0)
            v[0] = round(max(-99.9, min(99.9, v[0] + d_)), 2)
            dv = -d_ / 100 * v[3] / 2; v[1] = int(round(v[1] + dv)); v[2] = int(round(v[2] - dv))
            newmap[f] = round(sc_, 2)
        cc["_ev"] = newmap
    log.append(dict(race=r["id"], shift_r=round(s_new, 2), change_r=round(s_new - s_old, 2), prob_r=r["est"]["prob"], gap=round(ps["gap"], 2), vol=round(ps["vol"], 3)))

# House: the state's correction at the district's own two party vote
for r in M["races"]:
    if r["office"] != "house": continue
    e = r["est"]
    if abs(e["margin"]) >= 99.9: continue
    st = r["st"]; ps = post.get(st)
    if not ps: continue
    pd_ = min(0.97, max(0.03, 0.5 - e["margin"] / 200))
    if st in state_comp:
        sc = state_comp[st]; ref = max(0.05, sc["d2"] * (1 - sc["d2"]))
        dm = (sc["comp"] + sc["level"]) * (pd_ * (1 - pd_)) / ref
    else:
        dm = -RHO * ps["gap"] * (pd_ * (1 - pd_)) / 0.25
    s_new = max(-CAP, min(CAP, -dm))
    s_old = (r.get("ev") or {}).get("shift", 0.0)
    dp = move(r, s_new, {"gap": round(ps["gap"], 2), "source": ps["source"]})
    dprob["house"] += -dp
    log.append(dict(race=r["id"], shift_r=round(s_new, 2), change_r=round(s_new - s_old, 2), prob_r=e["prob"], gap=round(ps["gap"], 2), vol=round(ps["vol"], 3)))


# chambers, as patch_sweep: expected seats move by the summed change in win odds, the seat histogram with them
def shift_hist(hist, delta):
    out = {}
    for s, p in hist:
        lo = math.floor(s + delta); w = s + delta - lo
        out[lo] = out.get(lo, 0) + p * (1 - w); out[lo + 1] = out.get(lo + 1, 0) + p * w
    return sorted([[int(s), round(p, 5)] for s, p in out.items() if p > 1e-6], key=lambda x: -x[0])
def pctl(hist, q):
    acc = 0.0
    for s, p in sorted(hist):
        acc += p
        if acc >= q: return s
    return hist[0][0]
chlog = {}
for name, ch in M["chambers"].items():
    dlt = dprob.get(name, 0.0)
    old_h = [[int(s), float(p)] for s, p in ch["hist"]]
    new_h = shift_hist(old_h, -dlt)
    tot_old = sum(p for _, p in old_h)
    best = min(range(min(s for s, _ in old_h), max(s for s, _ in old_h) + 2),
               key=lambda T: abs(sum(p for s, p in old_h if s >= T) / tot_old - ch["gopControl"]))
    tail = lambda h: sum(p for s, p in h if s >= best) / sum(p for _, p in h)
    dc = tail(new_h) - tail(old_h)
    before = ch["demControl"]
    ch["gopControl"] = round(min(1, max(0, ch["gopControl"] + dc)), 4); ch["demControl"] = round(1 - ch["gopControl"], 4)
    ch["demSeats"] = round(ch["demSeats"] + dlt, 2); ch["gopSeats"] = round(ch["seatsTotal"] - ch["demSeats"], 2)
    ch["hist"] = new_h
    N = ch["seatsTotal"]
    ch["demP10"], ch["demP90"] = int(N - pctl(new_h, 0.90)), int(N - pctl(new_h, 0.10))
    if "median" in ch: ch["median"] = int(N - pctl(new_h, 0.5))
    tr = ch.get("trend") or []
    if tr: tr[-1] = {"t": tr[-1]["t"], "dem": ch["demControl"], "demSeats": ch["demSeats"]}
    chlog[name] = dict(seat_change=round(dlt, 2), dem_control_before=before, dem_control=ch["demControl"], dem_seats=ch["demSeats"])

# today's trend point for every race that moved is replaced rather than added: the forecast already published today
for r in M["races"]:
    tr = r.get("trend")
    if r.get("ev") and tr: tr[-1] = {"m": r["est"]["margin"], "p": r["est"]["prob"]}

M["meta"]["earlyVote"] = {"snapshot": SIG["snapshot"], "daysOut": D_OUT, "applied": TODAY,
                          "states": sum(1 for v in post.values() if v["source"] == "early vote"),
                          "ballots": int(sum(s["ballots"] for s in SIG["states"].values()))}
summary = {"snapshot": SIG["snapshot"], "daysOut": D_OUT, "applied": TODAY,
           "settings": dict(kappa=KAPPA, rho=RHO, n0=N0, w_max=W_MAX, estimated_weight=EST_W, w_hist=W_HIST, w_nbr=W_NBR, w_prim=W_PRIM, w_vol=W_VOL, cap=CAP),
           "states": {st: {k: (round(v, 3) if isinstance(v, float) else v) for k, v in ps.items()} for st, ps in post.items()},
           "chambers": chlog}
for st, sc in state_comp.items():
    summary["states"].setdefault(st, {}).update(comp=round(sc["comp"], 2), level=round(sc["level"], 2))
if not DRY:
    json.dump(M, open(f"{PUB}/model.json", "w"), separators=(",", ":"))
    json.dump(C, open(f"{PUB}/counties.json", "w"), separators=(",", ":"))
    json.dump(summary, open(f"{PUB}/earlyvote_adjust.json", "w"), indent=1)
    # archive: today's file and the index carry the adjusted numbers
    ap = f"{PUB}/archive/{TODAY}.json"
    if os.path.exists(ap):
        a = json.load(open(ap))
        S_, G_, H_ = M["chambers"]["senate"], M["chambers"]["governor"], M["chambers"]["house"]
        prev_d = a["chambers"]["senate"]["d_control"]
        a["chambers"]["senate"].update(d_control=round(100 * S_["demControl"], 1), d_seats_median=float(S_["median"]), p10=float(S_["demP10"]), p90=float(S_["demP90"]))
        if "d_control_without_osborn" in a["chambers"]["senate"]:
            a["chambers"]["senate"]["d_control_without_osborn"] = round(a["chambers"]["senate"]["d_control_without_osborn"] + a["chambers"]["senate"]["d_control"] - prev_d, 1)
        a["chambers"]["governors"].update(d_majority=round(100 * G_["demControl"], 1), d_median=float(G_["median"]), p10=float(G_["demP10"]), p90=float(G_["demP90"]))
        a["chambers"]["house"].update(d_majority=round(100 * H_["demControl"], 1), d_seats_median=float(H_["median"]), p10=float(H_["demP10"]), p90=float(H_["demP90"]))
        for r in M["races"]:
            if r["office"] not in ("senate", "governor"): continue
            k = key_of(r)
            if k in a["races"]:
                a["races"][k]["margin"] = round(-r["est"]["margin"], 2); a["races"][k]["win_d"] = round(100 * (1 - r["est"]["prob"]), 2)
                for q in ("p10", "p90"):
                    if q in a["races"][k]: a["races"][k][q] = round(-r["est"]["p90" if q == "p10" else "p10"], 2)
        a["early_vote"] = M["meta"]["earlyVote"]
        json.dump(a, open(ap, "w"), indent=1)
        idx_p = f"{PUB}/archive/index.json"; idx = json.load(open(idx_p))
        for day in idx["days"]:
            if day["date"] == TODAY:
                day["chambers"]["senate"].update({kk: a["chambers"]["senate"][kk] for kk in ("d_control", "d_seats_median", "p10", "p90", "d_control_without_osborn") if kk in a["chambers"]["senate"]})
                day["chambers"]["governors"].update({kk: a["chambers"]["governors"][kk] for kk in ("d_majority", "d_median", "p10", "p90")})
                day["chambers"]["house"].update({kk: a["chambers"]["house"][kk] for kk in ("d_majority", "d_seats_median", "p10", "p90")})
        json.dump(idx, open(idx_p, "w"), indent=1)
json.dump(log, open("/tmp/fcrun/ev_adjust_log.json", "w"), indent=1)
print(json.dumps(chlog, indent=1))
print("races moved", sum(1 for x in log if abs(x["change_r"]) > 0.005))
