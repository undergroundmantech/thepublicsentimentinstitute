"""Builds public/earlyvote-history-model.json: where every state's early vote stood in 2022 and 2024 on each day before
Election Day, the ballots cast so far and the registered party split of those ballots, reported where a count was
published and modeled where it was not, so the 2026 tracker can say how many more or fewer ballots are in and how the
party mix compares with the same point in past cycles.

Inputs
  public/earlyvote-history.json        state checkpoints, party splits, final early vote and mail and in person mix
  scripts/earlyvote/data/ev2022_national.json   the US Elections Project 2022 national daily counts and party split
  scripts/forecast/earlyvote/snapshots/<latest>/ev_signals.json   today's 2026 party mix by state, reported or modeled
  public/forecast/pres24_counties.json  2024 presidential vote, for each state's lean

Ballots, modeled
  A state with no count near a day gets one from two clocks. Mail returns follow the national 2022 share of mail
  ballots back by that day, scaled by one pace factor. In person votes follow the elapsed share of the state's own
  early voting window raised to one power, so a state that opens 46 days out and one that opens 10 days out each run
  on their own window. The pace factor and the power are fitted each year on every published checkpoint, then one
  median factor per day lines the curves up with the states that did publish. The state's final early vote and its
  mail and in person mix come from the history file. The national 2022 tally is not used as a total to match, since on
  any given day it counted only the states that had reported to it.

Party, modeled
  The split of a past year's ballots in a state that published none starts from the state's own 2026 split today,
  which already carries how its early voters lean, and adds how much every state that did publish moved between that
  year and 2026 at the same point, allowing the move to grow with the state's 2024 lean. The move is fitted each day
  with a small ridge on the lean term, and in 2022 it is anchored on the national split of the 23 party states. Leave
  one out errors are kept in meta.

Run from the repo root:  python3 -I scripts/earlyvote/build_history_model.py
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DAYS = list(range(0, 46))
H = json.load(open(os.path.join(ROOT, "public", "earlyvote-history.json")))
N22 = json.load(open(os.path.join(HERE, "data", "ev2022_national.json")))
SNAP = os.path.join(ROOT, "scripts", "forecast", "earlyvote", "snapshots")
LATEST = sorted(d for d in os.listdir(SNAP) if d[:2] == "20" and os.path.exists(os.path.join(SNAP, d, "ev_signals.json")))[-1]
SIG = json.load(open(os.path.join(SNAP, LATEST, "ev_signals.json")))["states"]
P24 = json.load(open(os.path.join(ROOT, "public", "forecast", "pres24_counties.json")))["c"]
FIPS = {"01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY"}

# each state's 2024 lean, Republican minus Democratic share of the presidential vote
tot = {}
for f, v in P24.items():
    st = FIPS.get(f[:2])
    if not st:
        continue
    t = tot.setdefault(st, [0, 0, 0])
    for i in range(3):
        t[i] += v[i]
LEAN = {st: (t[1] - t[0]) / max(1, sum(t)) for st, t in tot.items()}
lm = sum(LEAN.values()) / len(LEAN)
lsd = math.sqrt(sum((x - lm) ** 2 for x in LEAN.values()) / len(LEAN))
Z = {st: (x - lm) / lsd for st, x in LEAN.items()}


def interp(pts, d, clamp_end=4):
    """Value on day d between dated points [[days out, value, ...]], None outside the span, held flat for the last
    few days once a series has ended."""
    if not pts:
        return None
    s = sorted(pts, key=lambda p: -p[0])
    for p in s:
        if p[0] == d:
            return p[1]
    if d > s[0][0]:
        return None
    if d < s[-1][0]:
        return s[-1][1] if s[-1][0] - d <= clamp_end else None
    for a, b in zip(s, s[1:]):
        if a[0] >= d >= b[0]:
            k = (a[0] - d) / (a[0] - b[0])
            return a[1] + k * (b[1] - a[1])
    return None


def interp_party(pts, d):
    """A state's party split on day d: between its dated splits, or the nearest one held flat."""
    if not pts:
        return None
    s = sorted(pts, key=lambda p: -p[0])
    if d >= s[0][0]:
        return s[0][1], s[0][2]
    if d <= s[-1][0]:
        return s[-1][1], s[-1][2]
    for a, b in zip(s, s[1:]):
        if a[0] >= d >= b[0]:
            k = (a[0] - d) / (a[0] - b[0])
            return a[1] + k * (b[1] - a[1]), a[2] + k * (b[2] - a[2])


# ── national 2022 curves: share of the final mail returns and in person votes in by each day ─────────────────
snaps = N22["snapshots"]
fin = snaps[-1]
mailN = [[s["daysOut"], s["mail"] / fin["mail"]] for s in snaps if s.get("mail")]
inpN = [[s["daysOut"], s["inperson"] / fin["inperson"]] for s in snaps if s.get("inperson")]
mailN.append([45, 0.0])
inpN.append([30, 0.0])
EV_N = 17  # the national in person curve is set mostly by states opening about 17 days out


def fm(d):
    v = interp(mailN, d, clamp_end=46)
    return max(0.0, min(1.0, v if v is not None else (0.0 if d > 40 else 1.0)))


def fi(d, ev, g):
    """Share of a state's in person early vote cast by day d: the elapsed share of its own window to the power g."""
    if d > ev or ev <= 0:
        return 0.0 if d > ev else 1.0
    return min(1.0, ((ev - d + 1) / (ev + 1)) ** g)


# the UF counts stop at the eve of Election Day, while EAVS also counts mail that came in on or after it
ED_RATIO = {"2022": fin["total"] / H["us"]["2022"]["early"]}


# a state with no known start opens in person early voting on the median start of the states that are known
EV_DEFAULT = {y: sorted(v[y]["evStart"] for v in H["states"].values() if v[y].get("evStart"))[len([1 for v in H["states"].values() if v[y].get("evStart")]) // 2] for y in ("2022", "2024")}


def base_curve(st, y, d, shape):
    km, g = shape
    x = H["states"][st][y]
    early = x.get("early")
    if not early:
        return None
    if x.get("earlyBasis") == "eavs":
        early *= ED_RATIO.get("2022")
    m, i = x.get("mail") or 0, x.get("inperson") or 0
    ms = m / (m + i) if m + i else 0.6
    ev = x.get("evStart") or (EV_DEFAULT[y] if i else 0)
    return early * (ms * min(1.0, fm(d) * km) + (1 - ms) * fi(d, ev, g))


def fit_shape(y):
    """The mail pace and the in person curve that best fit every published checkpoint of the year, on log error."""
    obs = [(st, c[0], c[1]) for st, v in H["states"].items() for c in (v[y].get("cps") or []) if 1 <= c[0] <= 30]
    best = None
    for km in [0.6 + 0.05 * i for i in range(29)]:
        for g in [0.6 + 0.1 * i for i in range(20)]:
            e, n = 0.0, 0
            for st, d, o in obs:
                b = base_curve(st, y, d, (km, g))
                if b and o:
                    e += math.log(max(b, 1) / o) ** 2; n += 1
            if n and (best is None or e / n < best[0]):
                best = (e / n, km, g)
    return best[1], best[2]


def fit_counts(y, shape):
    """Per day: one factor that lines the modeled curve up with the states that published counts, and its error."""
    out, errs = {}, {}
    for d in DAYS:
        pairs = []
        for st, v in H["states"].items():
            obs = interp(v[y].get("cps") or [], d)
            b = base_curve(st, y, d, shape)
            if obs and b:
                pairs.append((st, obs, b))
        if len(pairs) >= 3:
            # the median ratio, so one odd state does not move every other state
            med = lambda L: sorted(L)[len(L) // 2]
            k = med([o / b for _, o, b in pairs])
            loo = []
            for j, (st, o, b) in enumerate(pairs):
                kk = med([p[1] / p[2] for i2, p in enumerate(pairs) if i2 != j])
                loo.append(abs(kk * b / o - 1))
            out[d], errs[d] = k, sorted(loo)[len(loo) // 2]
    # days with too few published states take the nearest fitted factor
    have = sorted(out)
    for d in DAYS:
        if d not in out and have:
            n = min(have, key=lambda h: abs(h - d))
            out[d], errs[d] = out[n], errs[n]
    return out, errs


def party_now(st):
    s = SIG.get(st)
    return (s["party"]["d"], s["party"]["r"], s.get("estimatedShare", 1) > 0.5) if s and s.get("party") else None


# the 2026 split across the 2022 party states, weighted by today's ballots, for the 2022 national anchor
def now_agg(states):
    w = [(SIG[s]["ballots"], SIG[s]["party"]) for s in states if s in SIG and SIG[s].get("party")]
    B = sum(b for b, _ in w) or 1
    return sum(b * p["d"] for b, p in w) / B, sum(b * p["r"] for b, p in w) / B


def fit_party(y):
    """Per day: the move between year y and 2026 now, a + b times the state's lean, for the D and R shares."""
    res, meta = {}, {}
    for d in DAYS:
        rows = []
        for st, v in H["states"].items():
            p = interp_party(v[y].get("party") or [], d)
            n = party_now(st)
            if p and n and st in Z:
                rows.append((st, p[0] - n[0], p[1] - n[1], Z[st]))
        fit = {}
        for k, idx in (("d", 1), ("r", 2)):
            n = len(rows)
            if not n:
                fit[k] = (0.0, 0.0)
                continue
            ys = [r[idx] for r in rows]
            zs = [r[3] for r in rows]
            a0 = sum(ys) / n
            if y == "2022":
                # anchor the level on the national split of the party states on the same day
                pts = [[s["daysOut"], s["party_total"]["D"] / s["party_total"]["N"], s["party_total"]["R"] / s["party_total"]["N"]] for s in snaps if s.get("party_total")]
                nat = interp_party(pts, d)
                agg = now_agg(snaps[-1].get("partyStates", []))
                a_nat = (nat[0] - agg[0]) if k == "d" else (nat[1] - agg[1])
                a0 = (a0 * n + a_nat * 6) / (n + 6)
            zm = sum(zs) / n
            sxx = sum((z - zm) ** 2 for z in zs)
            b = sum((z - zm) * (yv - a0) for z, yv in zip(zs, ys)) / (sxx + 4.0) if n >= 4 else 0.0
            a = a0 - b * zm
            fit[k] = (a, b)
        # leave one out error on the margin
        loo = []
        for j, r in enumerate(rows):
            rest = rows[:j] + rows[j + 1:]
            if len(rest) < 3:
                continue
            md = sum(x[1] for x in rest) / len(rest)
            mr = sum(x[2] for x in rest) / len(rest)
            loo.append(abs((r[2] - r[1]) - (mr - md)))
        res[d] = fit
        meta[d] = {"n": len(rows), "marginError": round(100 * sorted(loo)[len(loo) // 2], 1) if loo else None}
    return res, meta


out_states = {}
meta = {"built": LATEST, "days": [DAYS[0], DAYS[-1]], "fit": {}}
for y in ("2022", "2024"):
    shape = fit_shape(y)
    kf, kerr = fit_counts(y, shape)
    pf, pmeta = fit_party(y)
    meta["fit"][y] = {"mailPace": round(shape[0], 2), "inPersonCurve": round(shape[1], 2), "countFactor": {d: round(kf[d], 3) for d in (21, 14, 7, 1) if d in kf},
                      "countError": {d: round(kerr[d], 3) for d in (21, 14, 7, 1) if d in kerr},
                      "partyStates": {d: pmeta[d]["n"] for d in (21, 14, 7, 1)},
                      "partyMarginError": {d: pmeta[d]["marginError"] for d in (21, 14, 7, 1)},
                      "countErrorByDay": [round(kerr[d], 3) for d in DAYS], "partyErrorByDay": [pmeta[d]["marginError"] for d in DAYS]}
    for st, v in H["states"].items():
        x = v[y]
        n, nh = [], []
        for d in DAYS:
            obs = interp(x.get("cps") or [], d)
            if obs:
                n.append(round(obs)); nh.append(1)
            else:
                b = base_curve(st, y, d, shape)
                n.append(round(b * kf[d]) if b else None); nh.append(0)
        pd, pr, ph = [], [], []
        now = party_now(st)
        for d in DAYS:
            p = interp_party(x.get("party") or [], d)
            if p:
                pd.append(round(p[0], 4)); pr.append(round(p[1], 4)); ph.append(1)
            elif now and st in Z:
                (ad, bd), (ar, br) = pf[d]["d"], pf[d]["r"]
                dd = min(.95, max(.01, now[0] + ad + bd * Z[st]))
                rr = min(.95, max(.01, now[1] + ar + br * Z[st]))
                pd.append(round(dd, 4)); pr.append(round(rr, 4)); ph.append(0)
            else:
                pd.append(None); pr.append(None); ph.append(0)
        out_states.setdefault(st, {})[y] = {"n": n, "nRep": nh, "d": pd, "r": pr, "pRep": ph}

nat = [[s["daysOut"], s["total"], s["mail"], s["inperson"]] + ([s["party_total"]["D"], s["party_total"]["R"], s["party_total"]["O"]] if s.get("party_total") else [None] * 3) for s in snaps]
out = {"meta": meta | {"note": "Arrays run from 0 to 45 days before Election Day. nRep and pRep mark a reported value with 1 and a modeled one with 0. d and r are the registered Democratic and Republican shares of the ballots cast so far.",
                       "sources": [N22["source"], "public/earlyvote-history.json", f"ev_signals {LATEST}"]},
       "us2022": {"daily": nat, "partyStates": snaps[-1].get("partyStates", []), "source": N22["source"], "url": N22["url"]},
       "states": out_states}
p = os.path.join(ROOT, "public", "earlyvote-history-model.json")
json.dump(out, open(p, "w"), separators=(",", ":"))
print(p, os.path.getsize(p))
print(json.dumps(meta["fit"], indent=1))
