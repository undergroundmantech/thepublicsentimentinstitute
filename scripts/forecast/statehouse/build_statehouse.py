"""On Point 2026 state legislative forecast: every partisan chamber on the 2026 ballot, district by district.

District lean   the 2024 presidential vote in the district, read off the precincts that voted in it (MIT Election
                Lab precinct returns). A seat last on the ballot in 2022 uses that year's governor or U.S. Senate vote
                in the district, moved to 2024 terms by the state's own change between the two.
Environment     the district lean moved by the change from the state's 2024 presidential vote to its 2026 House vote
                in the published On Point forecast, the same generic environment the House races run on.
Candidates      half of what the last legislative result in the district ran ahead of or behind its lean, for the
                candidate, incumbency or local strength that tends to carry to the next cycle.
Primaries       where the 2026 primaries are posted, each district's Democratic share of its two party primary vote
                against the state's, at 0.15, and a seat where only one party filed is called for that party.
Polls           statewide legislative generic ballot polls move every district in the state, and district polls
                move their district, each by its weight: recency with a 45 day decay and sample size.
Simulation      2,000 runs with a shared national shock, a state shock and a district shock, and an extra seat level
                draw in districts that elect more than one member, so they can split.
Holdovers       seats not on the 2026 ballot keep the party that won them in 2024.
"""
import json, os, re, glob, math, sys
import numpy as np, pandas as pd
sys.path.insert(0, "/tmp/sl")
from chambers import HOUSE, SENATE, TWO_YEAR_SENATE, FOUR_YEAR_HOUSE, ALL_UP_2022_COHORT, HOUSE_NAME

PUB = os.environ.get("PUB", "/tmp/site/public/forecast")
OUT = os.environ.get("OUT", f"{PUB}/statehouse.json")
TODAY = pd.Timestamp(os.environ.get("TODAY") or pd.Timestamp.now(tz="America/New_York").strftime("%Y-%m-%d"))   # Oct 21 2026: was fixed at Oct 17, which aged every poll from the wrong day
N = 2000; rng = np.random.default_rng(20261017)
SD_NAT, SD_STATE, SD_DIST, SD_SEAT = 0.055, 0.05, 0.11, 0.045
K_CAND, K_PRIM = 0.5, 0.15
LEG_ELAST = 0.85                                             # legislative races move a little less than the federal ballot
lg = lambda p: np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4)))
inv = lambda z: 1 / (1 + np.exp(-z))
STATE_NAME = {}

def load(year, kind):
    out = {}
    for f in glob.glob(f"/tmp/sl/x{year[2:]}/*_{year}_{kind}.csv"):
        d = pd.read_csv(f, dtype={"district": str}, keep_default_na=False)
        if len(d): out[d.state.iloc[0]] = d
    return out
R24, T24, R22, T22 = load("2024", "results"), load("2024", "top"), load("2022", "results"), load("2022", "top")

pres = pd.read_csv("/tmp/statleg/medsl_2024/2024-president-state.csv")
P24 = {}
for st, g in pres.groupby("state_po"):
    d = g[g.party_simplified == "DEMOCRAT"].votes.sum(); r = g[g.party_simplified == "REPUBLICAN"].votes.sum()
    P24[st] = d / (d + r); STATE_NAME[st] = g.state.iloc[0].title()

model = json.load(open(f"{PUB}/model.json"))
H26 = {}
for r in model["races"]:
    if r["office"] != "house" or not r.get("votes") or abs(r["est"]["margin"]) >= 99.9: continue
    h = H26.setdefault(r["st"], [0, 0]); h[0] += r["votes"]["dem"]; h[1] += r["votes"]["rep"]
H26 = {k: v[0] / (v[0] + v[1]) for k, v in H26.items()}
GB = model["meta"]["genericBallot"]["avg"]                  # Republican minus Democratic, points
NAT_P24 = 75019230 / (75019230 + 77303568)                  # 2024 national two party Democratic share for president
NAT_DELTA = lg(0.5 - GB / 200) - lg(NAT_P24)

JUNK = re.compile(r"UNDER ?VOTE|OVER ?VOTE|\bVOTES?\b|VOTES-|WRITE|SCATTER|TOTAL|^VOID|SPOIL|REJECT|INVALID|^BLANK|/ ?BLANK|NONSENSE|^OTHER |^NAN$|^NONE OF")
def junk(c):
    c = str(c).strip().upper(); return (not c) or bool(JUNK.search(c))

def winners(res):
    """district: seats, the party of each seat won, two party Democratic share, from a results frame (regular races only)."""
    out = {}
    if res is None: return out
    r = res[(res.special.astype(str).str.lower() != "true") & (res.writein.astype(str).str.lower() != "true")]
    r = r[~r.candidate.map(junk) & ~r.district.astype(str).str.upper().isin(["NAN", "", "NONE", "STATEWIDE"])].copy()
    st = str(r.state.iloc[0]) if len(r) else ""
    def mp(p, c):
        p = str(p).upper()
        if p.startswith("DEM"): return "D"
        if p.startswith("REP"): return "R"
        return name_party(st, c) or "O"
    r["p"] = [mp(p, c) for p, c in zip(r.party, r.candidate)]
    # fusion: one candidate on several party lines counts once, under the major party line if there is one
    r["votes"] = pd.to_numeric(r.votes, errors="coerce").fillna(0)
    rank = {"D": 0, "R": 0, "O": 1}
    r = (r.assign(_maj=r.p.map(rank)).sort_values(["_maj", "votes"], ascending=[True, False])
          .groupby(["chamber", "district", "candidate"], as_index=False)
          .agg(p=("p", "first"), votes=("votes", "sum"), magnitude=("magnitude", "max")))
    for (ch, d), g in r.groupby(["chamber", "district"]):
        m = int(g.magnitude.max() or 1)
        top = g.sort_values("votes", ascending=False).head(m)
        dv = g[g.p == "D"].votes.sum(); rv = g[g.p == "R"].votes.sum()
        out[(ch, d)] = dict(seats=m, won=list(top.p), d2=(dv / (dv + rv)) if dv > 0 and rv > 0 else None,
                            dv=float(dv), rv=float(rv), cands=[(c, p, float(v)) for c, p, v in zip(g.candidate, g.p, g.votes)])
    return out

def tops(t):
    out = {}
    if t is None: return out
    for _, x in t.iterrows():
        if x.top_d + x.top_r > 0: out[(x.chamber, x.district)] = x.top_d / (x.top_d + x.top_r)
    return out

def topvotes(t, ch):
    """Oct 21 2026: every vote cast for the top office in each district, the base of the projected 2026 district turnout."""
    if t is None: return {}
    g = t[(t.chamber == ch) & (t.top_d + t.top_r > 0)]
    return {x.district: float(x.top_d + x.top_r + x.top_o) for x in g.itertuples()}

def nested_senate_votes(st, t):
    if st not in NEST or t is None: return {}
    f, k = NEST[st]
    h = t[(t.chamber == "house") & (t.top_d + t.top_r > 0)].copy()
    if not len(h): return {}
    try: h["sd"] = h.district.map(f)
    except Exception: return {}
    return {sd: float((g.top_d + g.top_r + g.top_o).sum()) for sd, g in h.groupby("sd") if st == "WA" or len(g) >= k}

def num(d):
    m = re.match(r"^(\d+)", str(d)); return int(m.group(1)) if m else None

# last known winner per district from the OpenElections general results, 2014 to 2022, a fallback for seats MEDSL left out
OE = pd.read_csv("/tmp/statleg/final/state_legislative_district.csv", dtype=str, keep_default_na=False)
OE = OE[(OE.stage == "general") & ~OE.candidate.map(junk)]
OE["votes"] = pd.to_numeric(OE.votes, errors="coerce").fillna(0)
OEW = {}
for (st, yr, ch, d), g in OE.groupby(["state", "year", "chamber", "district"]):
    dn = re.sub(r"^0+(\d)", r"\1", str(d).strip().upper())
    top = g.sort_values("votes", ascending=False).iloc[0]
    p = top.party if top.party in ("D", "R") else "O"
    dv = g[g.party == "D"].votes.sum(); rv = g[g.party == "R"].votes.sum()
    OEW[(st, ch, dn, int(yr))] = dict(won=[p], d2=(dv / (dv + rv)) if dv > 0 and rv > 0 else None)
NAMEP = {}
for (st, c), g in OE[OE.party.isin(["D", "R"])].groupby(["state", "candidate"]):
    NAMEP[(st, re.sub(r"[^A-Z ]", "", str(c).upper()).split()[-1] if str(c).split() else "", re.sub(r"[^A-Z ]", "", str(c).upper()).split()[0] if str(c).split() else "")] = g.party.mode().iloc[0]
def name_party(st, cand):
    t = re.sub(r"[^A-Z ]", "", str(cand).upper()).split()
    if not t: return None
    for k in ((st, t[-1], t[0]), (st, t[-1].replace("SR", "").replace("JR", ""), t[0])):
        if k in NAMEP: return NAMEP[k]
    return None
def oe_last(st, ch, d, years=(2022, 2018, 2014)):
    for y in years:
        v = OEW.get((st, ch, d, y))
        if v: return y, v
    return None, None

# 2026 primaries posted by OpenElections
PR = pd.read_csv("/tmp/statleg/run26/state_legislative_district.csv", dtype={"district": str}, keep_default_na=False)
PR = PR[PR.stage == "primary"]
def pparty(p):
    s = str(p).upper()
    return "D" if s.startswith("D") else "R" if s.startswith("R") else "O"
PR["p"] = PR.party.map(pparty)
def pnorm(d):
    s = str(d).strip().upper()
    m = re.match(r"^(?:DISTRICT\s*)?0*(\d+)([A-Z]?)$", s)
    return (m.group(1) + m.group(2)) if m else s
PR["d"] = PR.district.map(pnorm)
PRIM = {}
for (st, ch, d), g in PR.groupby(["state", "chamber", "d"]):
    PRIM[(st, ch, d)] = dict(D=float(g[g.p == "D"].votes.sum()), R=float(g[g.p == "R"].votes.sum()),
                             nD=int((g.p == "D").sum()), nR=int((g.p == "R").sum()))
PRIM_STATES = set(PR.state)
NOM = {}
for (st, ch, d, p), g in PR[PR.p.isin(["D", "R"])].groupby(["state", "chamber", "d", "p"]):
    g = g[~g.candidate.map(junk)]
    if len(g): NOM[(st, ch, d, p)] = str(g.sort_values("votes", ascending=False).candidate.iloc[0]).title()
NO_UNOPPOSED_PRINT = {"AL", "KY"}          # unopposed primaries are not printed, so a missing party proves nothing

# polls
POLLS = json.load(open("/tmp/statleg/polls_statleg_2026.json"))["confirmed"]
try:
    _new = json.load(open("/tmp/sl/cands/new_polls.json"))["confirmed"]
except Exception:
    _new = []
_seen = {(p.get("state"), str(p.get("chamber")), str(p.get("district")), p.get("end"), p.get("D"), p.get("R")) for p in POLLS}
for p in _new:
    k = (p.get("state"), str(p.get("chamber")), str(p.get("district")), p.get("end"), p.get("D"), p.get("R"))
    if k in _seen: continue
    # one Iowa survey was published with two weightings; keep the standard one
    if p.get("state") == "IA" and str(p.get("district")) == "35" and "recall" in (str(p.get("note", "")) + str(p.get("source", ""))).lower(): continue
    _seen.add(k); POLLS.append(p)
for p in POLLS:
    # PA House 145, State Navigate Oct 10 to 14: the independent's share sits in the Democratic slot
    if p.get("state") == "PA" and str(p.get("district")) == "145" and p.get("D") is None:
        p["D"] = 46; p["R"] = 49; p["main_challenger_party"] = "I"; p["n"] = p.get("n") or 514
def poll_w(p):
    try: age = (TODAY - pd.Timestamp(p["end"])).days
    except Exception: return 0.0
    if age < 0 or age > 160 or p.get("D") is None or p.get("R") is None: return 0.0
    n = p.get("n") or 500
    w = math.exp(-age / 45) * min(1.5, math.sqrt(n / 600)) * (0.8 if str(p.get("pop", "LV")).upper() == "RV" else 1.0)
    if re.search(r"\((D|R)\)|aligned", str(p.get("source", "")) + str(p.get("note", ""))): w *= 0.7
    return w
def poll_d2(p):
    d2 = p["D"] / (p["D"] + p["R"])
    s = str(p.get("source", "")) + " " + str(p.get("note", ""))
    if re.search(r"\(D\)|D-aligned|Democratic-aligned", s): d2 -= 0.015
    if re.search(r"\(R\)|R-aligned|Republican-aligned", s): d2 += 0.015
    return d2

# 2026 general election candidate lists, one file per state and chamber, from the October 2026 ballot research
ORDW = {w: f"{i}{'ST' if i % 10 == 1 and i != 11 else 'ND' if i % 10 == 2 and i != 12 else 'RD' if i % 10 == 3 and i != 13 else 'TH'}" for i, w in enumerate(
    "ZERO FIRST SECOND THIRD FOURTH FIFTH SIXTH SEVENTH EIGHTH NINTH TENTH ELEVENTH TWELFTH THIRTEENTH FOURTEENTH FIFTEENTH SIXTEENTH SEVENTEENTH EIGHTEENTH NINETEENTH TWENTIETH".split())}
def cnorm(d):
    s = str(d).upper().replace("&", " AND ").replace("DISTRICT", " ")
    s = re.sub(r"[-–,.]", " ", s); s = re.sub(r"\s+", " ", s).strip()
    return " ".join(ORDW.get(t, t.lstrip("0") or "0") if (t in ORDW or t.isdigit()) else t for t in s.split())
CANDS, CSPEC = {}, {}
for f in glob.glob("/tmp/sl/cands/*_*.json"):
    b = os.path.basename(f)[:-5]
    if b.count("_") != 1 or not re.match(r"^[A-Z]{2}_(house|senate)$", b): continue
    st_, ch_ = b.split("_")
    try: j = json.load(open(f))
    except Exception: continue
    for e in j.get("districts", []):
        k = cnorm(e.get("d"))
        if e.get("special"): CSPEC.setdefault((st_, ch_), {})[k] = e
        else: CANDS.setdefault((st_, ch_), {})[k] = e
SERIOUS = {"I", "P", "W", "O", "F", "C"}          # independents and the minor lines that run real campaigns; Libertarians and Greens rarely do
IND_PENALTY = 0.3                                  # an independent with no party line and no poll runs about 7 points behind a nominee

# 2022 California Senate, even districts, from the certified results (MEDSL's 2022 California file has no Senate rows).
# Two Democrat finals carry an estimated two party share from the district's character, marked below.
MANUAL22 = {("CA", "senate", d): v for d, v in {
    "2": ("D", .733), "4": ("D", .46), "6": ("R", .443), "8": ("D", .70), "10": ("D", .72), "12": ("R", .313), "14": ("D", .563),
    "16": ("D", .50005), "18": ("D", .598), "20": ("D", .75), "22": ("D", .585), "24": ("D", .671), "26": ("D", .829), "28": ("D", .85),
    "30": ("D", .61), "32": ("R", .38), "34": ("D", .588), "36": ("R", .431), "38": ("D", .522), "40": ("R", .469)}.items()}

# Senate districts that were not on the 2024 ballot still have a 2024 presidential vote on today's lines wherever the
# house districts nest inside them: the senate district is the sum of its house districts. Checked against the senate
# districts that were on the 2024 ballot, the sums match exactly in WI, MT, OR and AK and within a point or two elsewhere.
_two = lambda h: str((int(re.sub(r"\D", "", h)) + 1) // 2)
NEST = {"WI": (lambda h: str((int(h) + 2) // 3), 3), "MT": (_two, 2), "OR": (_two, 2), "IL": (_two, 2), "IA": (_two, 2),
        "MN": (lambda h: str(int(re.sub(r"[AB]$", "", h))), 2), "AK": (lambda h: chr(ord("A") + (int(h) - 1) // 2), 2),
        "WA": (lambda h: h.split("-")[0], 2), "ID": (lambda h: re.sub(r"[AB]$", "", h), 1), "ND": (lambda h: re.sub(r"[AB]$", "", h), 1)}

def nested_senate(st, t):
    if st not in NEST or t is None: return {}
    f, k = NEST[st]
    h = t[(t.chamber == "house") & (t.top_d + t.top_r > 0)].copy()
    if not len(h): return {}
    try: h["sd"] = h.district.map(f)
    except Exception: return {}
    out = {}
    for sd, g in h.groupby("sd"):
        if st == "WA" or len(g) >= k:
            out[("senate", sd)] = g.top_d.sum() / (g.top_d.sum() + g.top_r.sum())
    return out

# District leans published on lines the precinct files do not carry. Michigan's Senate was redrawn by the court in
# Agee v. Benson in July 2024 for the 2026 elections, and its districts were not on the 2024 ballot, so the 2024
# presidential margin on the new lines comes from the published district results. Margins are Republican minus
# Democratic in points. Districts in REDRAWN carry no candidate term, since their last result was on other lines.
LEAN_OVERRIDE = json.load(open("/tmp/sl/cands/lean_overrides.json"))

S26 = {}
for _r in model["races"]:
    if _r["office"] in ("senate", "governor") and _r.get("votes") and _r["votes"].get("total"):
        S26[_r["st"]] = max(S26.get(_r["st"], 0), _r["votes"]["total"])
_hs = {}
for _r in model["races"]:
    if _r["office"] == "house" and _r.get("votes") and _r["votes"].get("total"): _hs[_r["st"]] = _hs.get(_r["st"], 0) + _r["votes"]["total"]
for _k, _v in _hs.items(): S26.setdefault(_k, _v)
LEG_ROLLOFF, OTHER_SHARE = 0.04, 0.015

chambers, log = [], []
for st in sorted(set(HOUSE) | set(SENATE)):
    if st not in P24 or st not in H26: log.append((st, "no 2024 presidential or 2026 House baseline")); continue
    delta = LEG_ELAST * (0.5 * (lg(H26[st]) - lg(P24[st])) + 0.5 * NAT_DELTA)   # half the state's own House swing, half the national generic ballot
    w24, w22 = winners(R24.get(st)), winners(R22.get(st))
    for (mst, mch, md), (party, d2) in MANUAL22.items():
        if mst == st and (mch, md) not in w22: w22[(mch, md)] = dict(seats=1, won=[party], d2=d2, dv=0.0, rv=0.0, cands=[])
    t24, t22 = tops(T24.get(st)), tops(T22.get(st))
    for kk, v in nested_senate(st, T24.get(st)).items(): t24.setdefault(kk, v)
    t22_state = None
    if T22.get(st) is not None and len(T22[st]):
        g = T22[st][T22[st].chamber == ("house" if (T22[st].chamber == "house").any() else "senate")]
        if g.top_d.sum() > 0 and g.top_r.sum() > 0: t22_state = g.top_d.sum() / (g.top_d.sum() + g.top_r.sum())
        else: t22 = {}
    for ch, size in (("house", HOUSE.get(st)), ("senate", SENATE.get(st))):
        if not size: continue
        k24 = {d: v for (c, d), v in w24.items() if c == ch}
        k22 = {d: v for (c, d), v in w22.items() if c == ch}
        # Oct 21 2026: projected 2026 turnout per district. The 2024 (or 2022) top office vote on today's lines, scaled so the
        # state's house districts add to the forecast's 2026 statewide vote, less a small legislative rolloff.
        _tb = T24.get(st) if T24.get(st) is not None and len(topvotes(T24.get(st), "house")) else T22.get(st)
        _hv = topvotes(_tb, "house")
        fac = (S26[st] / sum(_hv.values())) if _hv and st in S26 and sum(_hv.values()) > 0 else None
        tvote = topvotes(_tb, ch)
        if ch == "senate":
            for _kk, _vv in nested_senate_votes(st, _tb).items(): tvote.setdefault(_kk, _vv)
        if fac is None and tvote and st in S26 and ch == "senate":
            _sv = sum(tvote.values()); fac = S26[st] / _sv if _sv > 0 else None
        # which districts are on the 2026 ballot, and who holds the rest
        if ch == "house" and st not in FOUR_YEAR_HOUSE or ch == "senate" and st in TWO_YEAR_SENATE:
            up = {d: v["seats"] for d, v in k24.items()}; hold = {}
            src_last = {d: (2024, k24[d]) for d in up}
        elif st in ALL_UP_2022_COHORT or (ch == "house" and st in ("AL", "MD")):
            up = {d: v["seats"] for d, v in k22.items()}; hold = {}
            src_last = {d: (2022, k22[d]) for d in up}
        elif st == "WV" and ch == "senate":
            up = {d: 1 for d in set(k22) | set(k24)}; hold = {d: dict(seats=1, won=k24[d]["won"][:1]) for d in k24}
            src_last = {d: (2022, k22[d]) if d in k22 else (2024, k24[d]) for d in up}
        else:
            nums24 = [num(d) for d in k24 if num(d)]
            odd = sum(n % 2 for n in nums24)
            if len(nums24) >= 8 and (odd == 0 or odd >= len(nums24) - 1):
                par = 1 if odd == 0 else 0                              # 2026 is the other parity
                alld = {str(i) for i in range(1, size + 1)} if ch == "senate" or st != "ND" else {str(i) for i in range(1, 48)}
                up_d = {d for d in alld if num(d) % 2 == par}
            else:
                allnum = all(num(d) for d in list(k22) + list(k24))
                alld = {d for d in set(k22) | set(k24) if not allnum or num(d) <= size} | ({str(i) for i in range(1, size + 1)} if allnum else set())
                up_d = alld - set(k24)
            seats_per = 2 if (ch == "house" and st == "ND") else 1
            up = {d: (k22[d]["seats"] if d in k22 and not (ch == "house" and st == "ND") else seats_per) for d in up_d}
            hold = {d: dict(seats=v["seats"], won=v["won"]) for d, v in k24.items() if d not in up_d}
            src_last = {d: (2022, k22[d]) if d in k22 else (2024, k24[d]) if d in k24 else (None, None) for d in up}
        # districts MEDSL never printed, mostly uncontested seats: fill them from the 2022 results or OpenElections
        filled = set()
        keys = list(k24) + list(k22)
        if keys and all(num(d) is not None and str(num(d)) == d for d in keys) and not (st == "ND" and ch == "house"):
            mags = [v["seats"] for v in (k24 or k22).values()]
            mag = max(set(mags), key=mags.count) if mags else 1
            ndist = min(max(num(d) for d in keys), size)
            if mag == 1 and ndist < size and size - ndist <= 3: ndist = size
            for i in range(1, ndist + 1):
                d = str(i)
                if d in up or d in hold: continue
                yr, lw = (2022, k22[d]) if d in k22 else oe_last(st, ch, d)
                party = lw["won"][0] if lw else ("D" if P24[st] > 0.5 else "R")
                two_year_like = (ch == "house" and st not in FOUR_YEAR_HOUSE) or (ch == "senate" and st in TWO_YEAR_SENATE) or st in ALL_UP_2022_COHORT or (ch == "house" and st in ("AL", "MD"))
                if two_year_like:
                    up[d] = mag; src_last[d] = (yr, dict(won=[party] * mag, d2=lw.get("d2") if lw else None) if lw else None)
                else:
                    hold[d] = dict(seats=1, won=[party])
                filled.add(d)
        # seats the candidate lists put on the ballot that the cohort rule held over: specials for vacancies, a second WV seat
        idx = {cnorm(d): d for d in set(up) | set(hold)}
        for kk, e in list(CANDS.get((st, ch), {}).items()) + list(CSPEC.get((st, ch), {}).items()):
            d = idx.get(kk)
            if d is None or d not in hold: continue
            take = max(1, int(e.get("seats") or 1)) if d not in up else 1
            take = min(take, hold[d]["seats"])
            up[d] = up.get(d, 0) + take
            if d not in src_last or src_last[d] == (None, None): src_last[d] = (2024, k24.get(d)) if d in k24 else (None, None)
            hold[d]["seats"] -= take; hold[d]["won"] = hold[d]["won"][take:]
            if hold[d]["seats"] <= 0: del hold[d]
        seats_up = sum(up.values())
        held = {"D": 0, "R": 0, "O": 0}
        for v in hold.values():
            for p in v["won"]: held[p] += 1
        missing = size - seats_up - sum(held.values())
        # districts
        rows = []
        for d, seats in sorted(up.items(), key=lambda x: (num(x[0]) or 0, x[0])):
            yr, last = src_last.get(d, (None, None))
            winner = None
            if last and last.get("cands"):
                cs = sorted([c for c in last["cands"] if not junk(c[0])], key=lambda c: -c[2])[: max(1, seats)]
                winner = ", ".join(str(c[0]).title() for c in cs) or None
            ov = LEAN_OVERRIDE.get(f"{st}_{ch}")
            if ov and d in ov["margins"]:
                m = ov["margins"][d] / 100.0
                lean = lg(0.5 - m / 2 / 0.98); lean_src = ov["label"]
            elif (ch, d) in t24: lean = lg(t24[(ch, d)]); lean_src = "2024 president"
            elif (ch, d) in t22 and t22_state: lean = lg(t22[(ch, d)]) - lg(t22_state) + lg(P24[st]); lean_src = "2022 governor or Senate, moved to 2024"
            elif last and last["d2"] is not None: lean = lg(last["d2"]) - (delta if yr == 2024 else 0); lean_src = f"{yr} legislative result"
            else: lean = None; lean_src = None
            cand = 0.0
            redrawn = bool(ov) and d in ov.get("redrawn", [])
            if last and last["d2"] is not None and lean is not None and not redrawn:
                base = lean if yr == 2024 else (lg(t22[(ch, d)]) if (ch, d) in t22 else lean)
                cand = float(np.clip(lg(last["d2"]) - base, -0.8, 0.8))
            status = "contested"
            pr = PRIM.get((st, ch, d))
            if st in PRIM_STATES and pr and st not in NO_UNOPPOSED_PRINT:
                if pr["nD"] == 0 and pr["nR"] > 0: status = "no Democrat filed"
                elif pr["nR"] == 0 and pr["nD"] > 0: status = "no Republican filed"
            ce = CANDS.get((st, ch), {}).get(cnorm(d)) or CSPEC.get((st, ch), {}).get(cnorm(d))
            info = {}
            if ce:
                dl = [x for x in (ce.get("dem") or []) if x]; gl = [x for x in (ce.get("gop") or []) if x]
                ol = [o for o in (ce.get("others") or []) if o.get("name") and str(o.get("party", "")).upper() in SERIOUS]
                info = dict(dem=", ".join(dl) or None, gop=", ".join(gl) or None, ind=ol[0]["name"] if ol else None,
                            indParty=str(ol[0].get("party", "I")).upper() if ol else None, dcap=len(dl), rcap=len(gl),
                            note="; ".join(f"{w.get('name')} ({w.get('party')}) withdrew" for w in (ce.get("withdrawn") or []) if w.get("name")) or None)
                if not dl and not gl: status = "no major party candidate" if ol else status
                elif not dl: status = "independent challenger" if ol else "no Democrat filed"
                elif not gl: status = "no Republican filed"
                else: status = "contested"
            if lean is None:
                # no lean at all: a seat that was uncontested and unprinted; it stays with its last winner
                party = (last["won"][0] if last else None)
                status = f"uncontested, last held by {party}" if party else "no data"
                if not party: party = "D" if P24[st] > 0.5 else "R"
                if status == "no Democrat filed": party = "R"
                elif status == "no Republican filed": party = "D"
                rows.append(dict(d=d, seats=seats, lean=None, leanSrc=None, last=None, L=None, status=status, hold=party, winner=winner, info=info))
                continue
            L = lean + delta + K_CAND * cand
            prim = None
            if pr and pr["D"] > 0 and pr["R"] > 0:
                prim = pr["D"] / (pr["D"] + pr["R"])
            ind_inc = bool(info.get("ind")) and ((last and "O" in (last.get("won") or [])) or (winner and info["ind"].split()[-1].upper() in str(winner).upper()))
            if ind_inc: info["indInc"] = True
            if status == "independent challenger" and not ind_inc: L -= IND_PENALTY
            rows.append(dict(d=d, seats=seats, lean=lean, leanSrc=lean_src, cand=cand, L=L, prim=prim, status=status, winner=winner, info=info,
                             last=dict(year=yr, d2=None if not last or last["d2"] is None else round(100 * last["d2"], 1),
                                       won=last["won"] if last else None) if last else None))
        if not rows: continue
        # primary leg against the state's own primary turnout
        pr_rows = [r for r in rows if r.get("prim") is not None and r["L"] is not None]
        if len(pr_rows) >= 5:
            pm = float(np.mean([lg(r["prim"]) for r in pr_rows])); lm = float(np.mean([r["lean"] for r in pr_rows]))
            for r in pr_rows:
                r["L"] += K_PRIM * float(np.clip((lg(r["prim"]) - pm) - (r["lean"] - lm), -1.0, 1.0))
        # statewide legislative generic ballot polls
        gp = [p for p in POLLS if p.get("state") == st and p.get("kind") == "generic" and (p.get("chamber") in (ch, "both", "legislature", None) or p.get("chamber") == "house" and ch == "house")]
        gw = [(poll_w(p), poll_d2(p)) for p in gp if p.get("D") is not None and p.get("R") is not None]; gw = [x for x in gw if x[0] > 0]
        wsum = sum(w for w, _ in gw)
        gen_w = min(0.5, 0.2 * wsum)
        live = [r for r in rows if r["L"] is not None]
        if gw and live:
            pl = sum(w * lg(x) for w, x in gw) / wsum
            cur = lg(np.mean([inv(r["L"]) for r in live]))
            for r in live: r["L"] += gen_w * (pl - cur)
        # district polls
        for r in live:
            dp = [p for p in POLLS if p.get("state") == st and p.get("kind") == "district_general" and str(p.get("chamber", "")).lower().startswith(ch[:3])
                  and pnorm(re.sub(r"^(HD|SD|AD)-?", "", str(p.get("district", "")), flags=re.I)) == r["d"]]
            ws = [(poll_w(p), poll_d2(p), p) for p in dp if p.get("D") is not None and p.get("R") is not None]; ws = [x for x in ws if x[0] > 0]
            if ws:
                w = min(0.6, 0.35 * sum(x[0] for x in ws))
                if r["status"] == "independent challenger":
                    if not (r.get("info") or {}).get("indInc"): r["L"] += IND_PENALTY                      # the poll speaks for the independent's real strength
                    w = min(0.75, 0.6 * sum(x[0] for x in ws))
                pl = sum(x[0] * lg(x[1]) for x in ws) / sum(x[0] for x in ws)
                r["L"] = (1 - w) * r["L"] + w * pl
                r["polls"] = [dict(pollster=re.sub(r"\s*\(.*?\)", "", x[2]["source"]).strip(), end=x[2]["end"], D=x[2]["D"], R=x[2]["R"], n=x[2].get("n")) for x in ws]
        # simulation
        nat = rng.normal(0, SD_NAT, N); stsh = rng.normal(0, SD_STATE, N)
        dseats = np.full(N, float(held["D"])); rseats = np.full(N, float(held["R"])); oseats = np.full(N, float(held["O"]))
        for r in rows:
            if r["L"] is None:
                p = r.get("hold") or "R"
                (dseats if p == "D" else rseats if p == "R" else oseats)[:] += r["seats"]; r["probD"] = 1.0 if p == "D" else 0.0; r["margin"] = None; continue
            if r["status"] == "no Democrat filed":
                rseats += r["seats"]; r["probD"] = 0.0; r["margin"] = 100.0; continue
            if r["status"] == "no Republican filed":
                dseats += r["seats"]; r["probD"] = 1.0; r["margin"] = -100.0; continue
            if r["status"] == "no major party candidate":
                oseats += r["seats"]; r["probD"] = 0.0; r["margin"] = None; continue
            z = r["L"] + nat + stsh + rng.normal(0, SD_DIST, N)
            if r["seats"] > 1:
                wins = sum((z + rng.normal(0, SD_SEAT, N)) > 0 for _ in range(r["seats"]))
            else:
                wins = (z > 0).astype(int)
            inf = r.get("info") or {}
            if inf.get("dcap") is not None and inf.get("rcap") is not None and r["status"] == "contested":
                # a multi member district with fewer nominees than seats on one side
                wins = np.clip(wins, max(0, r["seats"] - inf["rcap"]), min(r["seats"], inf["dcap"]))
            if r["status"] == "independent challenger":
                oseats += wins; rseats += r["seats"] - wins
            else:
                dseats += wins; rseats += r["seats"] - wins
            r["probD"] = round(float((z > 0).mean()), 4)
            r["margin"] = round(float(100 * (1 - 2 * inv(r["L"]))), 2)          # Republican minus Democratic, two party
        # a senate district with no top office count on its lines: the 2022 count on its lines, scaled the same way, or an
        # equal share of the state's 2026 vote, since districts are drawn to equal population
        _t22 = topvotes(T22.get(st), ch) if ch == "senate" else {}
        _h22 = topvotes(T22.get(st), "house")
        fac22 = (S26[st] / sum(_h22.values())) if _h22 and st in S26 and sum(_h22.values()) > 0 else None
        if fac22 is None and _t22 and st in S26: fac22 = S26[st] / max(1.0, sum(_t22.values()))
        if fac is None and st in S26: fac = 1.0; tvote = {}
        eq = S26[st] / size if st in S26 and size else None
        _known = [tvote[r["d"]] * fac for r in rows if fac and r["d"] in tvote]
        _med = float(np.median(_known)) if _known else None
        for r in rows:
            r["votes"] = None
            if fac is None: continue
            T = tvote[r["d"]] * fac if r["d"] in tvote else (_t22[r["d"]] * fac22 if fac22 and r["d"] in _t22 else (eq * r["seats"] if eq and not _known else _med))
            if not T: continue
            T *= (1 - LEG_ROLLOFF)
            if r.get("margin") is None: continue
            mg = max(-100.0, min(100.0, r["margin"]))
            o = 0.0 if abs(mg) >= 100 else OTHER_SHARE
            dv = T * (1 - o) * (0.5 - mg / 200); rv = T * (1 - o) * (0.5 + mg / 200); ov = T * o
            if r["status"] == "independent challenger": ov, dv = ov + dv, 0.0
            r["votes"] = [int(round(dv)), int(round(rv)), int(round(ov)), int(round(dv + rv + ov))]
        dseats += max(0, missing) * 0   # unaccounted seats are reported, not guessed
        total_known = size - max(0, missing)
        maj = size // 2 + 1
        # Alaska's House and Senate are run by bipartisan coalitions, so independents count with the Democrats for control
        dc = float(((dseats + (oseats if st == "AK" else 0)) >= maj).mean()); rc = float((rseats >= maj).mean())
        vals, cnts = np.unique(dseats.astype(int), return_counts=True)
        cur = {"D": held["D"], "R": held["R"], "O": held["O"]}
        for d, (yr, last) in src_last.items():
            if last:
                for p in last["won"][: up.get(d, 1)]: cur[p] = cur.get(p, 0) + 1
        name = f"{STATE_NAME.get(st, st)} {HOUSE_NAME.get(st, 'House') if ch == 'house' else 'Senate'}"
        chambers.append(dict(
            id=f"sl-{st}-{ch}", st=st, state=STATE_NAME.get(st, st), chamber=ch, name=name, seats=size, up=seats_up,
            majority=maj, hold=held, missing=max(0, missing), filled=len(filled), current=cur,
            note=(LEAN_OVERRIDE.get(f"{st}_{ch}") or {}).get("note"),
            holdD=[[d, v["won"][0] if v["won"] else "O"] for d, v in sorted(hold.items(), key=lambda x: (num(x[0]) or 0, x[0]))],
            votes=(lambda V: dict(dem=sum(v[0] for v in V), rep=sum(v[1] for v in V), other=sum(v[2] for v in V), total=sum(v[3] for v in V)) if V else None)([r["votes"] for r in rows if r.get("votes")]),
            demControl=round(dc, 4), gopControl=round(rc, 4), tie=round(max(0.0, 1 - dc - rc), 4),
            demSeats=round(float(dseats.mean()), 1), gopSeats=round(float(rseats.mean()), 1),
            p10=int(np.percentile(dseats, 10)), p90=int(np.percentile(dseats, 90)), median=int(np.median(dseats)),
            hist=[[int(v), round(float(c) / N, 4)] for v, c in zip(vals, cnts)],
            env=dict(pres24=round(100 * P24[st], 1), house26=round(100 * H26[st], 1), shift=round(float(100 * (inv(lg(0.5) + delta) - 0.5) * 2), 2),
                     genericPolls=[dict(source=p["source"], end=p["end"], D=p["D"], R=p["R"]) for p in gp], genericWeight=round(gen_w, 3)),
            districts=[dict(d=r["d"], seats=r["seats"], margin=r.get("margin"), probD=r.get("probD"),
                            lean=None if r["lean"] is None else round(float(100 * (1 - 2 * inv(r["lean"]))), 1), leanSrc=r.get("leanSrc"),
                            last=r.get("last"), status=r["status"], prim=None if r.get("prim") is None else round(100 * r["prim"], 1),
                            polls=r.get("polls"),
                            dem=(r.get("info") or {}).get("dem") or (None if r.get("info") else NOM.get((st, ch, r["d"], "D"))),
                            gop=(r.get("info") or {}).get("gop") or (None if r.get("info") else NOM.get((st, ch, r["d"], "R"))),
                            ind=(r.get("info") or {}).get("ind"), indParty=(r.get("info") or {}).get("indParty"),
                            indMain=r["status"] in ("independent challenger", "no major party candidate"),
                            note=(r.get("info") or {}).get("note"),
                            winner=r.get("winner"), votes=r.get("votes")) for r in rows]))
        log.append((st, ch, size, seats_up, held, missing, round(dc, 3)))

meta = dict(updated=str(TODAY.date()), chambers=len(chambers), sims=N, districts=sum(len(c["districts"]) for c in chambers),
            seatsUp=sum(c["up"] for c in chambers), method=__doc__.strip())
json.dump(dict(meta=meta, chambers=chambers), open(OUT, "w"), separators=(",", ":"))
print(f"{len(chambers)} chambers, {meta['districts']} contests, {meta['seatsUp']} seats up")
for x in log: print(*x)

# compact board file for the forecast hub: chamber summaries and one short row per district
hub = []
for c in chambers:
    hub.append(dict({k: c[k] for k in ("id", "st", "state", "chamber", "name", "seats", "up", "majority", "hold", "current",
                                        "demControl", "gopControl", "tie", "demSeats", "gopSeats", "p10", "p90", "median")},
                    d=[[x["d"], x["seats"], x["probD"], x["margin"], (x["last"] or {}).get("won", [None])[0] if x["last"] and x["last"].get("won") else None, 1 if x.get("indMain") else 0] for x in c["districts"]],
                    holdD=c["holdD"]))
json.dump(dict(meta=meta | dict(method=None), chambers=hub), open(OUT.replace(".json", "_hub.json"), "w"), separators=(",", ":"))
