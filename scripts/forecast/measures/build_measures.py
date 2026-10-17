"""On Point 2026 ballot measure forecast: every statewide measure on the Nov 3, 2026 ballot, county by county.

Structure     Each measure is put in a policy group (abortion, marijuana, minimum wage, voter ID, citizen only voting,
              taxes, criminal justice and so on) and given the side its Yes vote leans to. A measure's Yes share across
              the states moves with partisanship by a group slope fitted to how measures in that group have run since
              2018, from a group base level, adjusted for how the measure got on the ballot: legislative referrals and
              bonds run ahead, citizen initiatives behind.
Counties      Inside the state each county moves off the statewide Yes share by its 2024 presidential lean times the
              group's county slope, measured on the 2018, 2022 and 2024 statewide measures in the MIT Election Lab
              precinct returns, and the counties are weighted by their projected 2026 turnout.
Environment   The state's lean is its 2024 presidential vote moved 60 percent of the way to the 2026 House environment
              of the On Point forecast, since measures move with the party tide less than candidates do.
Polls         Each poll's undecided voters break two to one for No, the usual late slide on ballot measures, and polls
              paid for by one side are moved four points toward the other. Polls count by recency and sample size and
              are blended with the structural prior by their precision, with a floor for the large errors ballot
              measure polls have shown.
Passing       The odds are the chance of clearing each state's own bar: 60 percent in Florida, 55 percent for
              Colorado amendments, two thirds in New Hampshire, and a majority of all ballots cast where the state
              counts a blank as a No, with the usual 6 percent of voters skipping the question.
Simulation    2,000 draws of the statewide Yes share around the blend.
"""
import json, glob, math, os, re, sys
import numpy as np, pandas as pd

PUB = os.environ.get("PUB", "/tmp/site/public/forecast")
TODAY = pd.Timestamp(os.environ.get("TODAY", "2026-10-17"))
N = 2000; rng = np.random.default_rng(1103)
lg = lambda p: np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4)))
inv = lambda z: 1 / (1 + np.exp(-z))

M = []
for f in sorted(glob.glob("/tmp/bm/research_*.json")): M += json.load(open(f))["measures"]
OVR = json.load(open("/tmp/bm/overrides.json")) if os.path.exists("/tmp/bm/overrides.json") else {}

# ── county partisanship and turnout ──────────────────────────────────────────
PC = pd.read_csv("/tmp/bm/hist/pres24_county.csv", dtype={"fips": str})
PC["fips"] = PC.fips.str.zfill(5)
P24S = pd.read_csv("/tmp/statleg/medsl_2024/2024-president-state.csv")
STD2 = {}
for st, g in P24S.groupby("state_po"):
    d = g[g.party_simplified == "DEMOCRAT"].votes.sum(); r = g[g.party_simplified == "REPUBLICAN"].votes.sum(); STD2[st] = d / (d + r)
NAT_P24 = 75019230 / (75019230 + 77303568)
model = json.load(open(f"{PUB}/model.json"))
GB = model["meta"]["genericBallot"]["avg"]
NAT_DELTA = lg(0.5 - GB / 200) - lg(NAT_P24)
H26 = {}
for r in model["races"]:
    if r["office"] != "house" or not r.get("votes") or abs(r["est"]["margin"]) >= 99.9: continue
    h = H26.setdefault(r["st"], [0, 0]); h[0] += r["votes"]["dem"]; h[1] += r["votes"]["rep"]
H26 = {k: v[0] / (v[0] + v[1]) for k, v in H26.items()}
CJ = json.load(open(f"{PUB}/counties.json"))
NAMES = CJ.get("_n", {})

def turnout(st):
    for k in (f"sen-{st}", f"gov-{st}", f"house-{st}"):
        v = CJ.get(k)
        if isinstance(v, dict) and v: return {f: float(row[3]) for f, row in v.items() if isinstance(row, list) and len(row) > 3}
    return {}

def state_x(st):
    """State lean for 2026 in logit points of Democratic two party share, 0 is an even state."""
    base = lg(STD2.get(st, 0.5))
    shift = 0.5 * (lg(H26[st]) - lg(STD2[st])) + 0.5 * NAT_DELTA if st in H26 and st in STD2 else NAT_DELTA
    return float(base + 0.6 * shift)

# ── group structure: base Yes level at an even state, slope on state lean, county slope ─────────
# Base levels and slopes come from how comparable measures ran from 2018 to 2024; see the method note.
# Slopes are in logit of Yes per logit of Democratic share, signed for a Yes that leans Democratic.
# group: (base if Yes leans D, base if Yes leans R, base with no lean, state slope, county slope)
# Bases are the Yes share in logit at an even state; slopes are logit Yes per logit of Democratic share.
# County slopes are the median fits on 2018 to 2024 statewide measures of the group in the precinct returns
# (abortion rights 0.74 across AZ, CO, MO, MT and SD in 2024; marijuana 0.55; minimum wage 0.63; citizen only voting
# 0.6 to 0.9; ranked choice 0.8; redistricting 0.8); state slopes and bases are set so the 2022 and 2024 results of
# the group are reproduced, for example abortion rights at 52 percent in Missouri and 64 percent in Nevada.
GROUP = {
    "abortion":          (0.42, -0.42, 0.0, 1.00, 0.75), "marijuana": (0.22, -0.22, 0.0, 0.75, 0.55),
    "drugs_other":       (-0.15, 0.15, 0.0, 0.70, 0.55), "minimum_wage": (0.45, -0.45, 0.0, 0.60, 0.60),
    "labor":             (0.30, -0.30, 0.0, 0.80, 0.60), "health_care": (0.35, -0.10, 0.20, 0.70, 0.60),
    "voter_id":          (-0.85, 0.85, 0.0, 0.85, 0.60), "citizen_voting": (0.0, 1.30, 1.0, 0.50, 0.70),
    "ranked_choice":     (-0.35, -0.13, -0.20, 0.45, 0.80), "supermajority": (-0.35, -0.35, -0.35, 0.45, 0.40),
    "elections_voting":  (0.30, 0.10, 0.20, 0.60, 0.55), "redistricting": (0.0, 0.0, 0.0, 0.80, 0.80),
    "guns":              (0.45, 0.45, 0.0, 0.90, 0.60), "criminal_justice": (0.0, 0.85, 0.60, 0.45, 0.40),
    "immigration":       (0.0, 0.55, 0.0, 0.85, 0.70), "lgbtq_rights": (0.35, 0.55, 0.0, 0.95, 0.75),
    "civil_rights":      (0.45, 0.10, 0.20, 0.80, 0.60), "education": (0.30, 0.20, 0.35, 0.55, 0.40),
    "taxes_income":      (-0.10, 0.35, 0.0, 0.65, 0.45), "taxes_property": (0.0, 0.55, 0.45, 0.40, 0.30),
    "taxes_sales_other": (-0.10, 0.25, 0.20, 0.50, 0.45), "bonds_spending": (0.45, 0.20, 0.45, 0.35, 0.45),
    "housing":           (0.15, 0.0, 0.10, 0.55, 0.50), "environment_energy": (0.25, 0.25, 0.30, 0.70, 0.55),
    "gambling":          (-0.15, -0.15, -0.15, 0.20, 0.20), "government_ethics": (0.65, 0.40, 0.60, 0.35, 0.30),
    "animal":            (0.35, 0.80, 0.40, 0.40, 0.30), "other": (0.30, 0.30, 0.35, 0.30, 0.25),
}
LEANS_D_WHEN_NONE = {"bonds_spending", "housing", "education"}   # spending measures run ahead in Democratic counties
TYPE_ADJ = {"legislative referral constitutional": 0.20, "legislative referral statute": 0.20, "bond": 0.15,
            "initiated statute": -0.10, "initiated constitutional amendment": -0.15, "veto referendum": -0.05, "advisory": 0.10}

def group_of(m):
    t = (m.get("short_title", "") + " " + m.get("summary", "")).lower()
    c = m.get("category", "other")
    if re.search(r"only (u\.s\. )?citizens|citizen.only|citizens may vote", t) and c in ("elections_voting", "voter_id", "other"): return "citizen_voting"
    if re.search(r"60 ?(%|percent).*(amend|initiative|vote)|supermajority|three.fifths|two.thirds vote for", t) and c in ("elections_voting", "taxes_income", "taxes_sales_other"): return "supermajority"
    return c if c in GROUP else "other"

def sign_of(m):
    return 1.0 if m.get("lean") == "D" else -1.0 if m.get("lean") == "R" else 0.0

# ── polls ─────────────────────────────────────────────────────────────────────
def poll_point(p):
    y, n_, u = p.get("yes"), p.get("no"), p.get("undecided")
    if y is None or n_ is None: return None
    u = u if u is not None else max(0.0, 100 - y - n_)
    tot = y + n_ + u
    if tot <= 0: return None
    ys = (y + u / 3) / tot                      # undecided break two to one for No
    side = str(p.get("sponsor_side", "independent")).lower()
    if side == "yes": ys -= 0.04
    elif side == "no": ys += 0.04
    return float(np.clip(ys, 0.02, 0.98))

def poll_weight(p):
    try: age = (TODAY - pd.Timestamp(p.get("end") or p.get("start"))).days
    except Exception: return 0.0
    if age < 0 or age > 300: return 0.0
    n = p.get("n") or 600
    w = math.exp(-age / 50) * min(1.6, math.sqrt(n / 600))
    if str(p.get("pop", "LV")).upper() in ("RV", "A"): w *= 0.8
    if str(p.get("sponsor_side", "independent")).lower() in ("yes", "no"): w *= 0.6
    return w

def slug(st, mid):
    s = re.sub(r"[^a-z0-9]+", "-", mid.lower()).strip("-")
    s = re.sub(r"^(initiative-measure-no-|constitutional-amendment-)", lambda m: m.group(0), s)
    return s[:48]

def eff_threshold(m):
    t = float(m.get("threshold") or 0.5)
    note = (m.get("threshold_note") or "").lower()
    rolloff = 0.06
    if re.search(r"all ballots|total ballots|ballots cast in the election|votes cast in the (governor|gubernatorial)|majority of (all|those) (votes|voting) in the election|blank", note) and "30" not in note and "35" not in note:
        return min(0.95, t / (1 - rolloff)), "a majority of all ballots cast, so a skipped question counts as No"
    if re.search(r"35 ?(%|percent)", note): return max(t, 0.35 / (1 - rolloff)), "a majority, with Yes at least 35 percent of all ballots"
    if re.search(r"30 ?(%|percent)", note): return max(t, 0.30 / (1 - rolloff)), "a majority, with Yes at least 30 percent of all ballots"
    if t > 0.5: return t, f"{round(t * 100)} percent of the votes on the question"
    return 0.5, "a simple majority"

# ── build ─────────────────────────────────────────────────────────────────────
out = []
for m in M:
    st = m["state"]; o = OVR.get(f"{st}|{m['id']}", {})
    if o.get("drop"): continue
    m = {**m, **{k: v for k, v in o.items() if k != "drop"}}
    g = group_of(m); s = sign_of(m)
    bD, bR, bN, slope, cslope = GROUP[g]
    xs = state_x(st) if st in STD2 else 1.6
    base = bD if s > 0 else bR if s < 0 else bN
    ss = s if s else (0.5 if g in LEANS_D_WHEN_NONE else 0.0)
    mu0 = base + TYPE_ADJ.get(m.get("type", ""), 0.0) + ss * slope * xs
    sd0 = 0.42
    pts = [(poll_weight(p), poll_point(p), p) for p in (m.get("polls") or [])]
    pts = [x for x in pts if x[0] > 0 and x[1] is not None]
    if pts:
        W = sum(w for w, _, _ in pts)
        pl = sum(w * lg(y) for w, y, _ in pts) / W
        pv = 0.20 ** 2 / min(4.0, W) + 0.16 ** 2       # sampling plus the systematic miss of measure polls
        post_v = 1 / (1 / sd0 ** 2 + 1 / pv)
        mu = post_v * (mu0 / sd0 ** 2 + pl / pv); sd = math.sqrt(post_v)
        poll_avg = float(inv(pl))
    else:
        mu, sd, poll_avg, W = mu0, sd0, None, 0.0
    thr, thr_note = eff_threshold(m)
    draws = inv(mu + rng.normal(0, sd, N))
    prob = float((draws > thr).mean())
    # counties
    cnt = {}
    pcs = PC[PC.state == st]
    tw = turnout(st)
    if len(pcs) and st in STD2:
        d2 = pcs.D / (pcs.D + pcs.R).clip(lower=1)
        x = lg(d2.values) - lg(STD2[st])
        w = np.array([tw.get(f, float(t)) for f, t in zip(pcs.fips, pcs.D + pcs.R + pcs.O)])
        b = ss * cslope
        target = float(inv(mu))
        a = mu
        for _ in range(60):
            cur = float((inv(a + b * x) * w).sum() / max(1.0, w.sum()))
            a += (lg(target) - lg(cur)) * 0.9
            if abs(cur - target) < 1e-5: break
        ys = inv(a + b * x)
        cnt = {f: round(float(100 * y), 1) for f, y in zip(pcs.fips, ys)}
    out.append(dict(
        id=f"bm-{st}-{slug(st, m['id'])}", st=st, slug=slug(st, m["id"]), label=m["id"], title=m.get("short_title"), summary=m.get("summary"),
        type=m.get("type"), category=m.get("category"), group=g, lean=m.get("lean"), campaign=m.get("campaign"),
        threshold=round(thr, 4), thresholdNote=thr_note, ruleNote=m.get("threshold_note"),
        est=dict(yes=round(float(100 * inv(mu)), 1), p10=round(float(100 * np.percentile(draws, 10)), 1), p90=round(float(100 * np.percentile(draws, 90)), 1), prob=round(prob, 4)),
        prior=round(float(100 * inv(mu0)), 1), pollAvg=None if poll_avg is None else round(100 * poll_avg, 1), pollWeight=round(float(W), 2),
        polls=[dict(pollster=p.get("pollster"), sponsor=p.get("sponsor"), side=p.get("sponsor_side"), start=p.get("start"), end=p.get("end"), n=p.get("n"), pop=p.get("pop"),
                    yes=p.get("yes"), no=p.get("no"), und=p.get("undecided"), url=p.get("url"), adj=None if poll_point(p) is None else round(100 * poll_point(p), 1))
               for p in sorted(m.get("polls") or [], key=lambda p: str(p.get("end") or ""), reverse=True)],
        sources=m.get("sources") or [], counties=cnt))
    print(f"{st} {m['id'][:34]:34} {g:16} prior {100*inv(mu0):5.1f} polls {('%5.1f' % (100*poll_avg)) if poll_avg else '  -  '} est {100*inv(mu):5.1f} thr {thr:.3f} pass {prob:.2f}")

hub = [[o["st"], o["label"], o["title"], o["est"]["yes"], o["est"]["prob"], o["threshold"], f"/forecast/measures/{o['st'].lower()}/{o['slug']}"] for o in out]
json.dump(dict(updated=str(TODAY.date()), measures=hub), open(f"{PUB}/measures_hub.json", "w"), separators=(",", ":"))
meta = dict(updated=str(TODAY.date()), measures=len(out), states=len({o["st"] for o in out} - {"DC"}), sims=N, method=__doc__.strip())
json.dump(dict(meta=meta, measures=out), open(f"{PUB}/measures.json", "w"), separators=(",", ":"))
print(len(out), "measures", sum(1 for o in out if o["est"]["prob"] > 0.5), "favored to pass")
