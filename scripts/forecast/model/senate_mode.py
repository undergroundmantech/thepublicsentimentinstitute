"""
TPSI / OnPoint Politics  Senate Mode county forecast, rerun of Sept 16 2026
Deterministic: no random draws. Same inputs produce identical outputs.

Final county two party share = 0.40 * M1 fundamental + 0.40 * M2 national/census + 0.20 * M3 history/polling
Third party candidates modeled explicitly. Turnout anchored to a national midterm turnout ratio.
"""
import json, re, math, zipfile, io, glob, os, sys
import numpy as np, pandas as pd, docx

BASE = os.path.dirname(os.path.abspath(__file__))
H = f"{BASE}/hist"
GEO = f"{BASE}/../geo"
OUT = os.environ.get("OUT_SEN", f"{BASE}/output")
os.makedirs(OUT, exist_ok=True)
AS_OF = pd.Timestamp(os.environ.get("AS_OF", "2026-09-16"))

_wx = os.environ.get("LEGW")   # audit override, "w1,w2,w3"; unset keeps the live default
W_FUND, W_CENSUS, W_HIST = (tuple(float(x) for x in _wx.split(",")) if _wx else (1 / 3, 1 / 3, 1 / 3))   # default, used when a race has no usable polling
# Adaptive blend, Sept 18 2026. The weight on the history and polling model grows with how much real polling a race has,
# counted by distinct polling houses rather than by polls, so three surveys from one pollster do not read as three reads.
# A race with no polls keeps equal thirds, where the weights make no difference anyway because M3 is then levelled to the
# mean of M1 and M2 and the blend collapses to half M1 plus half M2.
POLL_TIERS = {
    "none":     (1 / 3, 1 / 3, 1 / 3),    # no polls
    "thin":     (0.37, 0.33, 0.30),       # one poll, or only partisan sponsored polls, or nothing recent
    "moderate": (0.30, 0.25, 0.45),       # two or three nonpartisan houses, recent
    "rich":     (0.25, 0.20, 0.55),       # four or more nonpartisan houses, all inside 45 days
}
RECENT_DAYS, FRESH_DAYS = 60, 45
# Continuous ramp, Sept 18 2026. The tier table above is kept for labelling and for the no poll case, but the weights
# themselves now interpolate, because the number of polling houses is a continuous quantity and a step function on it
# means a race can move half a point on one extra survey. The endpoints are unchanged: M3 sits at 0.30 with one house
# or fewer and at 0.55 with four or more, and the old flat moderate plateau between them becomes a straight line.
# Houses inside 45 days count in full, houses between 45 and 60 days count half, which removes the second cliff at the
# freshness boundary. The M1 share of whatever is left over rises across the same span, from 0.37 / 0.70 to 0.25 / 0.45,
# so the thin and rich endpoints reproduce the old tiers exactly.
# Proximity ramp, Sept 24 2026. Until now the blend moved only with how many houses had
# polled a race, never with how close the election was, so a race sat on the same weights at
# 200 days out and at 3 days out. A poll's information about the final margin rises sharply
# over the last six weeks while the fundamentals stop learning, so the polling ceiling now
# rises as election day approaches. The anchors below are a judgement, not a fitted curve:
# they have not been validated against past cycles, because no calibration harness exists yet.
ELECTION_DAY = pd.Timestamp(os.environ.get("ELECTION_DAY", "2026-11-03"))
DAYS_OUT = max(int((ELECTION_DAY - AS_OF).days), 0)
#            days out:  ceiling, floor
# Recency tilt, Sept 24 2026. The anchors below are each raised about two to three points of weight,
# because M3's statewide level IS the polling average: raising M3 raises polling, not history.
PROXIMITY = [(180.0, 0.48, 0.28), (60.0, 0.68, 0.36), (21.0, 0.83, 0.44)]
if os.environ.get("NO_RECENCY"):    # restores the pre recency tilt anchors
    PROXIMITY = [(180.0, 0.45, 0.26), (60.0, 0.65, 0.34), (21.0, 0.80, 0.42)]

def _proximity(days):
    """Polling ceiling and floor at a given distance from election day."""
    if days >= PROXIMITY[0][0]: return PROXIMITY[0][1], PROXIMITY[0][2]
    if days <= PROXIMITY[-1][0]: return PROXIMITY[-1][1], PROXIMITY[-1][2]
    for (d0, hi0, lo0), (d1, hi1, lo1) in zip(PROXIMITY, PROXIMITY[1:]):
        if d1 <= days <= d0:
            f = (d0 - days) / (d0 - d1)
            return hi0 + f * (hi1 - hi0), lo0 + f * (lo1 - lo0)
    return PROXIMITY[-1][1], PROXIMITY[-1][2]

# RAMP_HI was 4.0, which meant the ramp stopped learning at four polling houses: a race with
# twenty six polls carried exactly the weight of one with four. It now runs to eight.
RAMP_LO, RAMP_HI = 1.0, float(os.environ.get("RAMP_HI", "8.0"))
M3_HI, M3_LO = _proximity(DAYS_OUT)
if os.environ.get("NO_PROXIMITY"):            # restores the pre Sept 24 fixed ceiling
    RAMP_HI, M3_LO, M3_HI = 4.0, 0.30, 0.55
# The remainder after M3 splits between M1 approval fundamentals and M2, whose statewide level is the
# certified 2024 presidential result. Raising M1's share is what actually moves weight off history.
M1_SHARE_LO, M1_SHARE_HI = 0.5700, 0.5900
if os.environ.get("NO_RECENCY"):
    M1_SHARE_LO, M1_SHARE_HI = 0.37 / 0.70, 0.25 / 0.45

def ramp_weights(x):
    """M1, M2, M3 for an effective nonpartisan house count of x."""
    f = min(max((x - RAMP_LO) / (RAMP_HI - RAMP_LO), 0.0), 1.0)
    w3 = M3_LO + f * (M3_HI - M3_LO)
    share = M1_SHARE_LO + f * (M1_SHARE_HI - M1_SHARE_LO)
    rest = 1.0 - w3
    return round(rest * share, 4), round(rest * (1 - share), 4), round(w3, 4)

def poll_weights(polls, pavg):
    """Pick the blend for one race from its poll file."""
    if pavg.get("no_polls") or polls is None or len(polls) == 0:
        return POLL_TIERS["none"] + ("none", 0, 0, 0.0)
    p = polls.copy()
    days = (AS_OF - pd.to_datetime(p.end)).dt.days
    nonpartisan = ~p.source.str.contains(r"\((?:D|R|I)\)", regex=True)
    house = p.source.str.replace(r"\s+(for|with|/).*$", "", regex=True).str.strip().str.lower()
    n_fresh = house[nonpartisan & (days <= FRESH_DAYS)].nunique()
    n_recent = house[nonpartisan & (days <= RECENT_DAYS)].nunique()
    newest = int(max(days.min(), 0))      # a poll can close after the as of date; report it as today, not as negative
    x = float(n_fresh) + 0.5 * float(max(n_recent - n_fresh, 0))
    tier = "rich" if n_fresh >= 4 else ("moderate" if n_recent >= 2 else "thin")
    return ramp_weights(x) + (tier, int(n_recent), newest, round(x, 2))
# Scenario knobs for stress testing the two national anchors. Both default to the
# published settings, so an unset environment reproduces the live forecast exactly.
#   GALLUP_TIED=1   party identification even instead of 49 D to 39 R
#   POLL_SHIFT=x    uniform logit shift applied to every race's polling average
GALLUP_D, GALLUP_R = (44.0, 44.0) if os.environ.get("GALLUP_TIED") else (49.0, 39.0)
POLL_SHIFT = float(os.environ.get("POLL_SHIFT", "0.0"))
# National vote anchor. Party identification is not a vote, and Gallup's 49 D to 39 R counts adults, so it ran the
# fundamentals about three points of margin more Democratic than likely voters. The anchor is now the public likely
# voter generic ballot: Silver Bulletin's likely voter adjusted average of D+8.2 on Sept. 21, 2026, on the 88.9 percent
# decided in DDHQ's average of 48.1 D to 40.8 R that day. NAT_ANCHOR=gallup restores the old anchor.
# Default since Sept. 22, 2026: the TPSI respondent database itself is the national poll. Every 2026 wave is raked on
# DSMeridian Model 13R3 Stage 2 and weighted by each respondent's Stage 3 likely voter propensity; the anchor is the two
# party share of decided likely voters (tpsi_national.py). NAT_ANCHOR=generic restores the public likely voter average.
# Since Sept. 22, 2026 the default is "meridian": DSMeridian Model 13R3 run on every wave of the database, Stages 2 to 4
# including the aggregate Meridian undecided allocation, pooled across waves (meridian_all.py). "tpsi" is the same
# database without Stage 4.
NAT_ANCHOR = os.environ.get("NAT_ANCHOR", "meridian")
GB_MARGIN, GB_DECIDED = float(os.environ.get("GB_MARGIN", "8.2")), float(os.environ.get("GB_DECIDED", "88.9"))
if NAT_ANCHOR == "gallup":
    NAT_D2 = GALLUP_D / (GALLUP_D + GALLUP_R)
elif NAT_ANCHOR == "generic":
    NAT_D2 = 0.5 + GB_MARGIN / (2 * GB_DECIDED)
elif NAT_ANCHOR == "tpsi":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import tpsi_national as _tn
    TPSI_NATIONAL = _tn.estimate()
    NAT_D2 = TPSI_NATIONAL["lv"]["two_party_d"]
else:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import meridian_all as _ma
    TPSI_NATIONAL = _ma.run()
    NAT_D2 = TPSI_NATIONAL["pooled"]["two_party_d"]
# primary structure coefficients, logit units per logit unit of county deviation from state
# UNIFORM: run every race on the identical pipeline, with no per race rule.
# Structural facts stay (ranked choice in Alaska, Montana's two name split, which region a
# state's counties map to, whether public polling exists); only discretionary rules are dropped.
# Default. Every race runs the identical pipeline: no per race third party floor, no per race
# third party pattern override, no per race history weights. The one fallback left is automatic
# and fires off the data, where a state's past races carry no third party base to pattern on.
UNIFORM = os.environ.get("NO_UNIFORM") is None
# the cosmetic and weighting exceptions, which the audit showed move a race by at most 0.7 points
DISCRETIONARY = ["third_floor", "third_uniform", "trend_carry", "hist_w"]
# the personal vote of a crossover incumbent. KEEP_PV retains it, because removing it is what
# makes the model forget that Phil Scott is a Republican who wins Vermont.
# The personal vote of a crossover incumbent is the one exception that survives, because it is
# the only thing that tells the model Phil Scott is a Republican who wins Vermont. It is still
# hand applied to three races, which is the open non uniformity in this model.
if os.environ.get("DROP_PV"):
    DISCRETIONARY += ["incumbent_effect", "incumbent_effect_multi", "osborn_effect"]
DISCRETIONARY = tuple(DISCRETIONARY)
# ---- sitting governors on the 2026 ballot, Sept 25 2026 ----------------------
# Governor races are far less polarised than Senate races: a sitting governor
# routinely runs well ahead of their party's presidential number at home. The
# model already had a way to measure that, incumbent_effect_multi, the county by
# county gap between the incumbent's OWN past races and the nearest presidential
# race, carried forward at the split ticket rate. It was hand applied to two
# governor races, which the comment above calls the open non uniformity in this
# model. It now covers every sitting governor on the ballot and nothing else,
# because an open seat has no personal vote to carry.
#
# "pairs" are the incumbent's own past elections that exist in the state's loaded
# history, each matched to the nearest presidential year. Pairing a cycle the
# incumbent did not personally contest would import a different politician's
# personal vote, so these are per person, not per state. The roster was checked
# against the sitting governor list rather than inferred from the candidate slot:
# twenty of the thirty six 2026 races are open seats and get nothing here.
# The national two party vote of each election the roster pairs, so the cycle's own
# swing can be taken out of the gap. Without this the "personal vote" is really the
# personal vote plus the national shift between the two elections, and since every
# incumbent elected in 2022 is compared against 2020, all of them inherit the same
# spurious 7 point Republican lean. Measured: an uncentred run moved 13 of 16 races
# Republican for a mean of 0.9 points, and gave Abbott a 7 point personal vote that
# is almost entirely the 2022 environment. House totals from Ballotpedia, presidential
# two party shares from the model's own certified county files.
NAT_HOUSE_D2 = {2014: 35_368_840 / (35_368_840 + 39_926_526),
                2018: 60_319_623 / (60_319_623 + 50_467_181),
                2022: 51_280_463 / (51_280_463 + 54_227_992),
                2024: 70_571_330 / (70_571_330 + 74_390_864)}

def _cycle_gap(a, b, pres_d2):
    """National logit gap between election year a and presidential year b, the part of a
    county gap that is the environment rather than the candidate."""
    if a not in NAT_HOUSE_D2 or b not in pres_d2: return 0.0
    return float(logit(NAT_HOUSE_D2[a]) - logit(pres_d2[b]))

INCUMBENT_GOV = {
    "ARG": dict(party="R", pairs=[(2022, 2020)]),                               # Sanders, elected 2022
    "AZG": dict(party="D", pairs=[(2022, 2020)]),                               # Hobbs, 2022
    "CTG": dict(party="D", pairs=[(2022, 2020), (2018, 2016)]),                 # Lamont, 2018 and 2022
    "HIG": dict(party="D", pairs=[(2022, 2020)]),                               # Green, 2022
    "IDG": dict(party="R", pairs=[(2022, 2020), (2018, 2016)]),                 # Little, 2018 and 2022
    "ILG": dict(party="D", pairs=[(2022, 2020), (2018, 2016)]),                 # Pritzker, 2018 and 2022
    "MAG": dict(party="D", pairs=[(2022, 2020)]),                               # Healey, 2022
    "MDG": dict(party="D", pairs=[(2022, 2020)]),                               # Moore, 2022
    "NEG": dict(party="R", pairs=[(2022, 2020)]),                               # Pillen, 2022
    "NHG": dict(party="R", pairs=[(2024, 2024)]),                               # Ayotte, 2024
    "NVG": dict(party="R", pairs=[(2022, 2020)]),                               # Lombardo, 2022
    "NYG": dict(party="D", pairs=[(2022, 2020)]),                               # Hochul, 2022
    "ORG": dict(party="D", pairs=[(2022, 2020)]),                               # Kotek, 2022
    "PAG": dict(party="D", pairs=[(2022, 2020)]),                               # Shapiro, 2022
    "TXG": dict(party="R", pairs=[(2022, 2020), (2018, 2016), (2014, 2016)]),   # Abbott, 2014 2018 2022
    "VTG": dict(party="R", pairs=[(2022, 2020), (2018, 2016)]),                 # Scott, 2018 and 2022
    # Rhoden succeeded Noem in January 2025 and has never won a gubernatorial
    # election, so there is no personal vote to measure. He is listed so the
    # audit records him as an incumbent, and he carries no personal vote term.
    "SDG": dict(party="R", pairs=[]),
}
# How far an incumbent's own primary showing moves the carry on their personal
# vote. The primary signal itself is already in the model as the generic unity
# term, so this does not add a second helping of it; it scales the measured
# personal vote instead, which is the part that is genuinely incumbency specific.
# An incumbent who cleared their primary carries more of their past crossover
# appeal, one who was held down carries less. The bounds stop the primary from
# ever dominating the measured gap. Judgement, not a fitted value.
GOV_INC_PRIM_K = float(os.environ.get("GOV_INC_PRIM_K", "0.25"))
GOV_INC_PRIM_LO, GOV_INC_PRIM_HI = 0.5, 1.3
_INC_AUDIT = {}

def cfgget(cfg, k, default=None):
    if UNIFORM and k in DISCRETIONARY: return default
    return cfg.get(k, default)
ELECTORATE = os.environ.get("ELECTORATE") is not None   # Electorate Mode: estimated 2026 electorate
DYNAMIC = os.environ.get("DYNAMIC") is not None   # Dynamic Mode: county elasticities in the history leg
MOVE_A = os.environ.get('NO_MOVE_A') is None   # primary structure sits with previous results, not with approval
# How much of a past split ticket gap carries to the next cycle. Measured on 192 House districts
# whose lines did not move between 2022 and 2024, comparing each district's House result against
# the presidential result on the same lines:
#   the same candidate runs again   carry 0.554   n=169  correlation +0.58
#   both candidates change          carry 0.123   n=23   correlation +0.19
# The effect belongs to the candidate, not the district. A coefficient of 1.0 assumes no
# regression at all; 0.123 is near enough to nothing that a new pairing gets no term.
# Carry rises with the size of the gap, and so does how well it predicts:
#   gap under 2 points   carry 0.206  correlation 0.11   n=82   noise, mostly
#   gap 2 to 4 points    carry 0.591  correlation 0.51   n=54
#   gap 4 points or more carry 0.612  correlation 0.82   n=33
# A small gap is one cycle's luck. A large one is a fact about the politician.
def split_ticket_carry(gap_pts):
    return 0.206 if abs(gap_pts) < 2.0 else 0.612
SPLIT_TICKET_CARRY = 0.612
SPLIT_TICKET_CARRY_NEW = 0.123
K_PRIMARY_PARTY = 0.30 if os.environ.get("NO_RECENCY") else 0.33
K_PRIMARY_CAND = 0.15 if os.environ.get("NO_RECENCY") else 0.17

# ---- campaign finance term, governor races only ------------------------------
# Governors do not file with the FEC. Every figure has to come from a state
# disclosure agency or FollowTheMoney, so the loader refuses any record not
# explicitly marked verified: an unchecked number can never reach a published
# forecast. Three deliberate restrictions, from the open seat backtest:
#   1. individual contributions only, with self funding subtracted, because
#      total receipts are dominated by self funders in governor races
#   2. an in state donor share bonus at half weight as a grassroots signal
#   3. the edge is halved when an incumbent is running, since incumbent
#      receipts correlate with vulnerability rather than with strength
# The term stands down entirely in any race with real polling, so it can never
# argue with a poll average. It is a fallback for blind races, nothing more.
FIN_PATH = os.environ.get("GOV_FINANCE", "/tmp/pvi/gov_finance.json")
try:
    GOV_FINANCE = json.load(open(FIN_PATH))
except Exception:
    GOV_FINANCE = {}
# K stays 0.0 until it is fit out of sample on 2022 and 2024 open seats.
# Shipping a guessed coefficient is the same error as shipping a guessed poll.
# Measured sensitivity for a 3 to 1 individual contribution edge in an even state:
#   K 0.03 -> +2.6 pts,  K 0.05 -> +4.3 pts,  K 0.08 -> +6.0 pts and the cap binds.
# Anything at or above 0.08 turns the term into an on off switch rather than a
# nuance, because almost every real edge then pins to FIN_CAP. Fit inside 0.02
# to 0.05 unless the backtest says otherwise.
# Governor K set to 0.03 on Sept. 21 to match the Senate and House, with researched state filing figures in gov_finance.json
K_FINANCE = float(os.environ.get("K_FINANCE", "0.03"))
FIN_MAX_POLLS = int(os.environ.get("FIN_MAX_POLLS", "999"))   # every governor race with money on file, however polled
FIN_CAP = float(os.environ.get("FIN_CAP", "0.12"))

# Senate: FEC bulk totals through senate_finance.py. Same gates and caps as the governor term, its own K so each
# office can be calibrated on its own backtest.
SEN_FIN_PATH = os.environ.get("SEN_FINANCE", "/tmp/pvi/sen_finance.json")
try:
    SEN_FINANCE = json.load(open(SEN_FIN_PATH))
except Exception:
    SEN_FINANCE = {}
# Senate K set to 0.03 on Sept. 21, the low end of the 0.02 to 0.05 range noted above, as a labeled starting value
# pending the 2022 and 2024 backtest. The Senate data carry total receipts only, so self funding cannot be removed.
K_FINANCE_SEN = float(os.environ.get("K_FINANCE_SEN", "0.03"))
MONEY_SHARE_CLIP = 0.05    # a money share is held between 5 and 95 percent, so a 19 to 1 edge is the most any race can show

FIN_MAX_POLLS_SEN = int(os.environ.get("FIN_MAX_POLLS_SEN", "999"))   # Senate: every race with verified money, however polled

def finance_term(key, n_polls, base_d2, book=None, k=None, max_polls=None):
    """Statewide logit shift from campaign finance. Returns (shift, reason).
    Zero unless K is calibrated, the record exists and is verified, and the
    race is thin enough on polling for finance to be the better signal."""
    book = GOV_FINANCE if book is None else book
    k = K_FINANCE if k is None else k
    if k == 0.0:
        return 0.0, "K not calibrated"
    rec = book.get(key)
    if not rec:
        return 0.0, "no finance record"
    if not rec.get("verified"):
        return 0.0, "record not marked verified"
    max_polls = FIN_MAX_POLLS if max_polls is None else max_polls
    if n_polls > max_polls:
        return 0.0, "%d polls, finance stands down" % n_polls
    D, R = rec.get("D") or {}, rec.get("R") or {}
    dI = max(float(D.get("individual", 0)) - float(D.get("self_fund", 0)), 0.0)
    rI = max(float(R.get("individual", 0)) - float(R.get("self_fund", 0)), 0.0)
    if dI + rI <= 0:
        return 0.0, "no individual money on file"
    # measure the EDGE against the state's own partisanship, not the raw share
    _ms = min(max(dI / (dI + rI), MONEY_SHARE_CLIP), 1 - MONEY_SHARE_CLIP)
    edge = logit(_ms) - logit(base_d2)
    grass = 0.0
    dS, rS = D.get("in_state_share"), R.get("in_state_share")
    if dS is not None and rS is not None:
        cl = lambda x: min(max(float(x), 0.02), 0.98)
        grass = 0.5 * (logit(cl(dS)) - logit(cl(rS)))
    if D.get("incumbent") or R.get("incumbent"):
        edge *= 0.5
    shift = k * (edge + grass)
    shift = max(-FIN_CAP, min(FIN_CAP, shift))
    return shift, "applied"
# history model weights by cycle (most recent first) and trend carry
HIST_W = [0.5, 0.3, 0.2] if os.environ.get("NO_RECENCY") else [0.56, 0.28, 0.16]
TREND_CARRY = 0.5 if os.environ.get("NO_RECENCY") else 0.55
# turnout
NAT_MIDTERM = {2018: (113_700_000, 2016), 2022: (107_600_000, 2020)}  # approx national House votes, prior pres year
TURNOUT_HIST_SHARE, TURNOUT_DEMO_SHARE = 0.75, 0.25
# polls
POLL_HALFLIFE_DAYS = 21.0
RV_WEIGHT, PARTISAN_WEIGHT = 0.8, 0.8
NAT_2024_D2 = 75_019_230 / (75_019_230 + 77_302_580)  # certified 2024 national Harris / Trump

logit = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))
inv = lambda x: 1 / (1 + np.exp(-x))
import unicodedata
norm = lambda s: re.sub(r"[^A-Z]", "", unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().upper().replace("SAINT", "ST"))

PKG = {
    "IA": glob.glob(f"{BASE}/e081542b*/JULIUISIOWA")[0],
    "MI": glob.glob(f"{BASE}/fc2609fd*/JULIUISMICHIGAN")[0],
    "OH": glob.glob(f"{BASE}/5002bdde*/JULIUISOHIO")[0],
    "TX": glob.glob(f"{BASE}/41050065*/TEXASMODELFINAL")[0],
    "GA": f"{BASE}/GA",
    "NC": f"{BASE}/NC",
    "SC": f"{BASE}/SC",
    "NE": f"{BASE}/NE",
    "AK": f"{BASE}/AK",
    "KS": f"{BASE}/KS",
    "NH": f"{BASE}/NH",
    "ME": f"{BASE}/ME",
    "FL": f"{BASE}/FL",
    "SD": f"{BASE}/SD",
    "ID": f"{BASE}/ID",
    "MT": f"{BASE}/MT",
    "VA": f"{BASE}/VA",
    "MN": f"{BASE}/MN",
    "MS": f"{BASE}/MS",
    "LA": f"{BASE}/LA",
    "AR": f"{BASE}/AR",
    "KY": f"{BASE}/KY",
    "OR": f"{BASE}/OR",
    "WY": f"{BASE}/WY",
    "CO": f"{BASE}/CO",
    "NM": f"{BASE}/NM",
    "OK": f"{BASE}/OK",
    "NJ": f"{BASE}/NJ",
    "AL": f"{BASE}/AL",
    "TN": f"{BASE}/TN",
    "IL": f"{BASE}/IL",
    "WV": f"{BASE}/WV",
    "DE": f"{BASE}/DE",
    "RI": f"{BASE}/RI",
    "MA": f"{BASE}/MA",
    "FLG": f"{BASE}/FLG",
    "TXG": f"{BASE}/TXG",
    "IAG": f"{BASE}/IAG",
    "OHG": f"{BASE}/OHG",
    "GAG": f"{BASE}/GAG",
    "WIG": f"{BASE}/WIG",
    "MIG": f"{BASE}/MIG",
    "NYG": f"{BASE}/NYG",
    "WA": f"{BASE}/WA",
    "MO": f"{BASE}/MO",
    "UT": f"{BASE}/UT",
    "ND": f"{BASE}/ND",
    "IN": f"{BASE}/IN",
    "PAG": f"{BASE}/PAG",
    "AZG": f"{BASE}/AZG",
    "NVG": f"{BASE}/NVG",
    "CAG": f"{BASE}/CAG",
    "ORG": f"{BASE}/ORG",
    "KSG": f"{BASE}/KSG",
    "NEG": f"{BASE}/NEG",
    "OKG": f"{BASE}/OKG",
    "ALG": f"{BASE}/ALG",
    "SDG": f"{BASE}/SDG",
    "VTG": f"{BASE}/VTG",
    "COG": f"{BASE}/COG",
    "NHG": f"{BASE}/NHG",
    "TNG": f"{BASE}/TNG",
    "MNG": f"{BASE}/MNG",
    "SCG": f"{BASE}/SCG",
    "IDG": f"{BASE}/IDG",
    "WYG": f"{BASE}/WYG",
    "AKG": f"{BASE}/AKG",
    "NMG": f"{BASE}/NMG",
    "ARG": f"{BASE}/ARG",
    "ILG": f"{BASE}/ILG",
    "MEG": f"{BASE}/MEG",
    "CTG": f"{BASE}/CTG",
    "RIG": f"{BASE}/RIG",
    "MAG": f"{BASE}/MAG",
    "MDG": f"{BASE}/MDG",
    "HIG": f"{BASE}/HIG",
}
FIPS = {"IA": "19", "MI": "26", "OH": "39", "TX": "48", "GA": "13", "NC": "37", "SC": "45", "NE": "31", "AK": "02", "KS": "20", "NH": "33", "ME": "23", "FL": "12", "SD": "46", "ID": "16", "MT": "30", "VA": "51", "MN": "27", "MS": "28", "LA": "22", "AR": "05", "KY": "21", "OR": "41", "WY": "56", "CO": "08", "NM": "35", "OK": "40", "NJ": "34", "AL": "01", "TN": "47", "IL": "17", "WV": "54", "DE": "10", "RI": "44", "MA": "25", "FLG": "12", "TXG": "48", "IAG": "19", "OHG": "39", "GAG": "13", "WIG": "55", "MIG": "26", "NYG": "36", "PAG": "42", "AZG": "04", "NVG": "32", "CAG": "06", "ORG": "41", "KSG": "20", "NEG": "31", "OKG": "40", "ALG": "01", "SDG": "46", "VTG": "50", "COG": "08", "NHG": "33", "TNG": "47", "MNG": "27", "SCG": "45", "IDG": "16", "WYG": "56", "AKG": "02", "HIG": "15", "NMG": "35", "ARG": "05", "ILG": "17", "MEG": "23", "CTG": "09", "RIG": "44", "MAG": "25", "MDG": "24", "WA": "53", "MO": "29", "IN": "18", "UT": "49", "ND": "38"}
NAMES = dict(json.load(open(f"{BASE}/county_names.json")))
# governor states whose previous results live in <prefix>_gov<year>_county.csv inside their own package folder
GOV_PRE = {"NMG": "nm", "ARG": "ar", "ILG": "il", "MEG": "me", "CTG": "ct", "RIG": "ri", "MAG": "ma", "MDG": "md"}
# Alaska: 30 boroughs and census areas as used by ACS 2024, the TPSI approval file and the 2026 primary (Chugach 02063 and
# Copper River 02066 replaced Valdez-Cordova 02261 in 2019)
AK_UNITS = pd.read_csv(f"{BASE}/AK/ak_primary_2026_borough.csv", dtype={"fips": str})
AK_FULLNAME = dict(zip(AK_UNITS.fips, AK_UNITS.borough)); AK_UNITS = sorted(AK_FULLNAME)
NAMES.update({f: n for f, n in AK_FULLNAME.items()})
# Alaska RCV transfer assumption: ballots of eliminated Republicans (Dan J. Sullivan, Gerald Heikes) move to Dan S. Sullivan,
# Mary Peltola or exhaust at the rates observed when Republican Nick Begich was eliminated in the Aug 2022 special House count
AK_RCV = dict(to_R=0.503, to_D=0.288, exhaust=0.209)
# Governor: the eliminated candidates are two Republicans, not a moderate Republican facing Sarah Palin, so more of their
# ballots rank the remaining Republican. Central assumption, with the Senate transfers kept as the published sensitivity.
AKG_RCV = dict(to_R=0.70, to_D=0.08, exhaust=0.22)
# Alaska statewide totals (Division of Elections certified): President 2016, 2020, 2024; Governor 2018; Senate 2022 first choice
AK_TOTALS = dict(p16=318_608, p20=359_530, p24=338_177, h24=140_026, t24=184_458, g18=283_134, s22=261_705)

STATES = {
    "IA": dict(name="Iowa", D="Josh Turek", R="Ashley Hinson",
               # Sept 25 2026: polls from polls_ia.csv, the full Senate table, rather than the docx plus EXTRA_POLLS.
               third=[("Thomas Laehn", "L", 1.0)], polls_csv="polls_ia.csv"),
    "MI": dict(name="Michigan", D="Abdul El-Sayed", R="Mike Rogers",
               third=[("Lydia Christensen", "L", 2.1), ("Timothy Long", "UST", 1.2), ("Douglas P. Marsh", "G", 0.9)],
               docx="MICHIGAN INSTRUCTION AND POLLS.docx"),
    "OH": dict(name="Ohio", D="Sherrod Brown", R="Jon Husted",
               third=[("Bill Redpath", "L", 1.8), ("Greg Levy", "I", 1.5)], docx="OHIO APPROVAL AND POLLS (1).docx"),
    "TX": dict(name="Texas", D="James Talarico", R="Ken Paxton",
               # Sept 25 2026: polls now come from polls_tx.csv, the full Senate table, rather than the docx plus
               # EXTRA_POLLS. EXTRA_POLLS had "TX" twice, and a dict literal keeps only the last copy, so adding the
               # Marist poll silently deleted Texas Southern, Trafalgar, Emerson and ReconMR/Siena from the average.
               third=[("Ted Brown", "L", 1.9), ("Other / write-in", "O", 0.8)], polls_csv="polls_tx.csv"),
    # Libertarian Party of Georgia failed to qualify for the 2026 statewide ballot; only write-ins remain
    "GA": dict(name="Georgia", D="Jon Ossoff", R="Mike Collins",
               third=[("Write-in", "O", 1.0)], third_floor=0.001, polls_csv="polls_ga.csv"),
    # NC ballot: Shannon Bray (L), Michael Dublin (G); split weights from 2022 NC Senate (Bray L 1.4, Hoh G 0.8)
    "NC": dict(name="North Carolina", D="Roy Cooper", R="Michael Whatley",
               third=[("Shannon Bray", "L", 1.4), ("Michael Dublin", "G", 0.8)], polls_csv="polls_nc.csv"),
    # SC: Darline Graham replaced Lindsey Graham (died July 11 2026) via the Aug 11 special primary and Aug 25 runoff
    "SC": dict(name="South Carolina", D="Annie Andrews", R="Darline Graham",
               third=[("Kasie Whitener", "L", 1.0)], polls_csv="polls_sc.csv"),
    # NE: Democratic nominee Cindy Burbank withdrew; independent Dan Osborn takes the anti Republican slot (modeled in the D column)
    # AK: top four open primary Aug 18 2026, ranked choice general. First choice modeled for all four finalists, final round
    # Peltola vs Dan S. Sullivan from the blend. trend_carry 0: the 2014 to 2020 rural swing was specific to Al Gross
    "AK": dict(name="Alaska", D="Mary Peltola", R="Dan S. Sullivan",
               third=[("Dan J. Sullivan", "R", 7.0), ("Gerald Heikes", "R", 6.0)], polls_csv="polls_ak.csv",
               trend_carry=0.0, rcv=True),
    # KS ballot: David Graham (L); split weight single candidate, county pattern from past Senate third party vote
    "KS": dict(name="Kansas", D="Adam Hamilton", R="Roger Marshall",
               third=[("David Graham", "L", 1.0)], polls_csv="polls_ks.csv"),
    # NH: open seat, Shaheen retiring. No third party nominee confirmed on the ballot: poll Other modeled as other / write-in
    "NH": dict(name="New Hampshire", D="Chris Pappas", R="John E. Sununu",
               third=[("Other / write-in", "O", 1.0)], polls_csv="polls_nh.csv"),
    # ME: Troy Jackson replaced primary winner Graham Platner (withdrew July 8 to 10, Jackson nominated July 25). Ranked choice general.
    # Independent Phillip Rench on the ballot. Collins unopposed in the June 9 primary, no county Republican primary results
    "ME": dict(name="Maine", D="Troy Jackson", R="Susan Collins",
               third=[("Phillip Rench", "I", 1.0)], polls_csv="polls_me.csv"),
    # FL: special election for the Rubio seat, appointed Sen. Ashley Moody vs Angie Nixon. No minor party nominee confirmed: poll Other as other / write-in
    "FL": dict(name="Florida", D="Angie Nixon", R="Ashley Moody",
               third=[("Other / write-in", "O", 1.0)], polls_csv="polls_fl.csv"),
    # SD: Democratic nominee Julian Beaudion withdrew Aug 4; independent Brian Bengs (2022 Democratic nominee) is the only challenger,
    # modeled in the anti Republican column. Two candidate ballot, no third party line
    "SD": dict(name="South Dakota", D="Brian Bengs", R="Mike Rounds", D_party="I", third=[], polls_csv="polls_sd.csv"),
    # ID: Democratic nominee David Roth withdrew July 28; independent Todd Achilles modeled in the anti Republican column.
    # Libertarian Matt Loesby on the ballot; independent Natalie Fleming named in two polls. Split weights from those polls
    "ID": dict(name="Idaho", D="Todd Achilles", R="Jim Risch", D_party="I",
               third=[("Natalie Fleming", "I", 8.5), ("Matt Loesby", "L", 2.7)], polls_csv="polls_id.csv"),
    # MT: open seat, Daines retired. Four candidate ballot: Kurt Alme (R), Alani Bankhead (D), Seth Bodnar (I), Kyle Austin (L).
    # The blend models the anti Republican bloc (Bankhead plus Bodnar) against Alme, as with Osborn, Bengs and Achilles, then splits
    # the bloc by the poll average share of each candidate. Austin is the third party line
    "MT": dict(name="Montana", D="Anti Republican bloc", R="Kurt Alme", polls_csv="polls_mt.csv",
               third=[("Kyle Austin", "L", 1.0)],
               split=dict(poll_col="bodnar", other_col="bankhead", names=("Seth Bodnar", "Alani Bankhead"), parties=("I", "D"))),
    # VA: Warner (D) unopposed for renomination; Bert Mizusawa won the Aug 4 R primary. No minor party nominee listed: poll Other as other / write-in
    "VA": dict(name="Virginia", D="Mark Warner", R="Bert Mizusawa", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_va.csv"),
    # MN: open seat, Tina Smith retiring. Peggy Flanagan (DFL) vs Michele Tafoya (R). No minor party nominee confirmed: poll Other as other / write-in
    "MN": dict(name="Minnesota", D="Peggy Flanagan", R="Michele Tafoya", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_mn.csv"),
    # MS: Cindy Hyde-Smith (R) vs Scott Colom (D) with independent Ty Pinkins on the ballot
    "MS": dict(name="Mississippi", D="Scott Colom", R="Cindy Hyde-Smith", third=[("Ty Pinkins", "I", 1.0)], polls_csv="polls_ms.csv",
               third_uniform=True),  # Pinkins, the 2024 Democratic nominee, has no past Other vote pattern; uniform county share
    # LA: first closed party primaries (May 16) and runoffs (June 27). Julia Letlow (R) defeated Sen. Bill Cassidy in the primary and
    # John Fleming in the runoff; Jamie Davis (D) won the Democratic runoff. No third candidate listed
    "LA": dict(name="Louisiana", D="Jamie Davis", R="Julia Letlow", third=[], polls_csv="polls_la.csv"),
    # AR: Tom Cotton (R) vs Hallie Shoffner (D). No minor party nominee confirmed: poll Other as other / write-in
    "AR": dict(name="Arkansas", D="Hallie Shoffner", R="Tom Cotton", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_ar.csv"),
    # KY: open seat, McConnell retiring. Andy Barr (R) vs Charles Booker (D); no third candidate named in the sources or polls
    "KY": dict(name="Kentucky", D="Charles Booker", R="Andy Barr", third=[], polls_csv="polls_ky.csv"),
    # OR: Jeff Merkley (D) vs David Brock Smith (R), Gary Dye (L), Brett Smith (Pacific Green). No public polls: the M3 level is set to
    # the M1 and M2 statewide average, and the third party share is the mean minor party share of the 2020 and 2022 Senate races
    "OR": dict(name="Oregon", D="Jeff Merkley", R="David Brock Smith",
               third=[("Gary Dye", "L", 42724), ("Brett Smith", "G", 39346)],
               no_polls=dict(third=(87425 / 2321286 + 66756 / 1932165) / 2)),
    # WY: open seat, Lummis retiring. Harriet Hageman (R) vs James Byrd (D). No public polls and no minor party candidates listed
    "WY": dict(name="Wyoming", D="James Byrd", R="Harriet Hageman", third=[], no_polls=dict(third=0.0)),
    # CO: John Hickenlooper (D) vs presumptive Republican nominee Mark Baisley. No public polls. Declared independents Bob Chew (Forward)
    # and Clinton Roosevelt Dale have no confirmed ballot status, so minor candidates are one other / independents line at the
    # mean minor party share of the 2020 and 2022 Colorado Senate races
    "CO": dict(name="Colorado", D="John Hickenlooper", R="Mark Baisley", third=[("Other / independents", "O", 1.0)],
               no_polls=dict(third=(75184 / 3235790 + 71338 / 2500201) / 2)),
    # NM: Ben Ray Lujan (D) vs Larry Marker (R), who won the Republican nomination as a write-in. No minor candidates listed
    "NM": dict(name="New Mexico", D="Ben Ray Lujan", R="Larry Marker", third=[], polls_csv="polls_nm.csv"),
    # OK: regular election for the Mullin seat, held by appointed Sen. Alan Armstrong, who cannot run. Kevin Hern (R) vs N'Kiyla Jasmine
    # Thomas (D), with independents Curtis Stinnett and Ron Meinhard and Libertarian Sevier White. Split weights follow the 2020 Oklahoma
    # Senate minor vote: Libertarian 34,435, the two independents 21,652 and 11,371 averaged for each
    # ---- Governor mode: same Senate Mode method with governor history. Keys ending in G write *_2026_governor_* files ----
    # FLG: Florida governor, open seat (DeSantis term limited). Byron Donalds (R) vs David Jolly (D). No minor candidates named:
    # poll Other modeled as other / write-in. Only the post primary poll is used, per instructions
    "FLG": dict(name="Florida", office="governor", D="David Jolly", R="Byron Donalds", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_flg.csv"),
    # TXG: Texas governor. Gov. Greg Abbott (R) seeking a fourth term vs Gina Hinojosa (D); Libertarian Pat Dixon on the ballot
    "TXG": dict(name="Texas", office="governor", D="Gina Hinojosa", R="Greg Abbott", third=[("Pat Dixon", "L", 1.0)], polls_csv="polls_txg.csv"),
    # IAG: Iowa governor, open seat (Reynolds not running). Zach Lahn (R) vs Rob Sand (D); Libertarian Nicholas Gluba and independent
    # Sondra Wilson on the ballot, poll Other split evenly
    "IAG": dict(name="Iowa", office="governor", D="Rob Sand", R="Zach Lahn", third=[("Nicholas Gluba", "L", 1.0), ("Sondra Wilson", "I", 1.0)], polls_csv="polls_iag.csv"),
    # OHG: Ohio governor, open seat (DeWine term limited). Vivek Ramaswamy (R) vs Amy Acton (D); Libertarian Don Kissick on the ballot
    "OHG": dict(name="Ohio", office="governor", D="Amy Acton", R="Vivek Ramaswamy", third=[("Don Kissick", "L", 1.0)], polls_csv="polls_ohg.csv"),
    # GAG: Georgia governor, open seat (Kemp term limited). Rick Jackson (R), who won the June 16 runoff, vs Keisha Lance Bottoms (D);
    # Libertarian Chase Oliver on the ballot
    "GAG": dict(name="Georgia", office="governor", D="Keisha Lance Bottoms", R="Rick Jackson", third=[("Chase Oliver", "L", 1.0)], polls_csv="polls_gag.csv", third_floor=0.001),
    # WIG: Wisconsin governor, open seat (Evers not running). Tom Tiffany (R) vs David Crowley (D). No minor candidates named: poll Other as other / write-in
    "WIG": dict(name="Wisconsin", office="governor", D="David Crowley", R="Tom Tiffany", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_wig.csv"),
    # MIG: Michigan governor, open seat (Whitmer term limited). John James (R) vs Jocelyn Benson (D). Mike Duggan withdrew his independent
    # bid in May. No minor candidates named: poll Other as other / write-in
    "MIG": dict(name="Michigan", office="governor", D="Jocelyn Benson", R="John James", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_mig.csv"),
    "NYG": dict(name="New York", office="governor", D="Kathy Hochul", R="Bruce Blakeman", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_nyg.csv"),
    "PAG": dict(name="Pennsylvania", office="governor", D="Josh Shapiro", R="Stacy Garrity",
                third=[("Ken Krawchuk", "L", 1.0), ("Tony Dastra", "G", 0.47), ("Bill Messner", "C", 0.40)], polls_csv="polls_pag.csv"),
    "AZG": dict(name="Arizona", office="governor", D="Katie Hobbs", R="Andy Biggs",
                third=[("Teri Hourihan", "NL", 1.0), ("Risa Lombardo", "G", 0.6)], polls_csv="polls_azg.csv"),
    "NVG": dict(name="Nevada", office="governor", D="Aaron Ford", R="Joe Lombardo", third=[("Other / None of These Candidates", "O", 1.0)], polls_csv="polls_nvg.csv"),
    "CAG": dict(name="California", office="governor", D="Xavier Becerra", R="Steve Hilton", third=[("Write-in", "O", 1.0)], polls_csv="polls_cag.csv", third_floor=0.001, third_uniform=True),
    "ORG": dict(name="Oregon", office="governor", D="Tina Kotek", R="Christine Drazan", third=[("Brett Smith", "G", 1.0)], polls_csv="polls_org.csv"),
    "KSG": dict(name="Kansas", office="governor", D="Cindy Holscher", R="Ty Masterson", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_ksg.csv", third_floor=0.01),
    "NEG": dict(name="Nebraska", office="governor", base="NE", D="Lynne Walz", R="Jim Pillen",
                third=[("Brett Lindstrom", "AF", 1.03), ("Rick Beard", "LMN", 1.0)], polls_csv="polls_neg.csv"),
    "OKG": dict(name="Oklahoma", office="governor", D="Cyndi Munson", R="Mike Mazzei", third=[("Other", "O", 1.0)],
                no_polls=dict(third=(31896 / 1153284 + 40833 / 1186385) / 2)),
    "ALG": dict(name="Alabama", office="governor", D="Doug Jones", R="Tommy Tuberville", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_alg.csv", third_floor=0.01),
    "SDG": dict(name="South Dakota", office="governor", D="Dan Ahlers", R="Larry Rhoden", third=[("Other", "O", 1.0)],
                no_polls=dict(third=(9983 / 350166 + 4838 / 338715) / 2)),
    "VTG": dict(name="Vermont", office="governor", D="Amanda Janoo", R="Phil Scott", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_vtg.csv",
                incumbent_effect_multi=([(2022, 2020), (2018, 2016)], 1.0)),
    "COG": dict(name="Colorado", office="governor", D="Phil Weiser", R="Victor Marx",
                third=[("Greg Lopez", "I", 1.0), ("Frederick Osborne", "NL", 0.4), ("Jeff Peckman", "U", 0.3), ("Stephen Hamilton", "ACN", 0.3), ("Shawn Bennett", "I", 0.3)],
                no_polls=dict(third=(57309 / 2508830 + 95373 / 2525062) / 2)),
    "NHG": dict(name="New Hampshire", office="governor", D="Cinde Warmington", R="Kelly Ayotte", third=[("Stephen Villee", "L", 1.0), ("Jon Kiper", "I", 0.8)],
                polls_csv="polls_nhg.csv", incumbent_effect_multi=([(2024, 2024)], 1.0)),
    "TNG": dict(name="Tennessee", office="governor", D="Jerri Green", R="Marsha Blackburn", third=[("Other / independents", "O", 1.0)], polls_csv="polls_tng.csv"),
    "MNG": dict(name="Minnesota", office="governor", D="Amy Klobuchar", R="Lisa Demuth", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_mng.csv"),
    "SCG": dict(name="South Carolina", office="governor", D="Jermaine Johnson", R="Alan Wilson", third=[("Walid Hakim", "G", 1.0), ("Michael Addison", "UC", 0.8)],
                polls_csv="polls_scg.csv", third_floor=0.01),
    "IDG": dict(name="Idaho", office="governor", D="Terri Pickens", R="Brad Little", third=[("John Stegner", "I", 1.0)], polls_csv="polls_idg.csv", third_uniform=True),
    "WYG": dict(name="Wyoming", office="governor", D="Kenneth Casner", R="Eric Barlow", third=[("Other / write-in", "O", 1.0)],
                no_polls=dict(third=(19618 / 194000 + 10861 / 203238) / 2)),
    # AKG: top four open primary Aug 18 2026, ranked choice general. Three of the four finalists are Republicans, so the
    # blend is read as the final round Kreiss-Tomkins share and first choice is backed out with the AK_RCV transfers.
    # rcv_fc: share of the Republican first choice bloc held by the two Republicans who are eliminated first, from their
    # primary votes (Bronson 13,349 and Taylor 11,924 against Wilson 16,456)
    "AKG": dict(name="Alaska", office="governor", D="Jonathan Kreiss-Tomkins", R="Bernadette Wilson",
                third=[("Dave Bronson", "R", 13.349), ("Treg Taylor", "R", 11.924)], rcv=True,
                rcv_fc=(13349 + 11924) / (13349 + 11924 + 16456), rcv_transfers=AKG_RCV, trend_carry=0.0, base="AK",
                # Sept 25 2026: the first two general election polls with the final field. The rcv_fc path reads the
                # blend as the FIRST CHOICE split between Kreiss-Tomkins and the whole Republican bloc and runs the count
                # forward itself, so each poll enters as that split: D is Kreiss-Tomkins, R is Wilson + Bronson + Taylor.
                # Fabrizio Ward/Impact's own final round (55-45) is therefore not the number used; its first choice is.
                polls_csv="polls_akg.csv"),
    "MEG": dict(name="Maine", office="governor", D="Hannah Pingree", R="Bobby Charles",
                third=[("Rick Bennett", "I", 1.0)], polls_csv="polls_meg.csv"),
    "CTG": dict(name="Connecticut", office="governor", D="Ned Lamont", R="Ryan Fazio",
                third=[("Other / write-in", "O", 1.0)], polls_csv="polls_ctg.csv"),
    "RIG": dict(name="Rhode Island", office="governor", D="Helena Foulkes", R="Aaron Guckian",
                third=[("Ken Block", "I", 18.0), ("Jay Gotra", "I", 1.0), ("C.D. Reynolds", "I", 1.0)], polls_csv="polls_rig.csv"),
    "MAG": dict(name="Massachusetts", office="governor", D="Maura Healey", R="Michael Minogue",
                third=[("Andrea James", "I", 1.0), ("Muhammed Kokonezis-Hanino", "I", 1.0)], polls_csv="polls_mag.csv",
                third_uniform=True),
    "MDG": dict(name="Maryland", office="governor", D="Wes Moore", R="Dan Cox",
                third=[("Andy Ellis", "G", 1.6), ("Cathy White", "WC", 1.0)], polls_csv="polls_mdg.csv"),
    "NMG": dict(name="New Mexico", office="governor", D="Deb Haaland", R="Gregg Hull",
                third=[("Ken Miyagishima", "I", 1.0)], polls_csv="polls_nmg.csv", third_floor=0.02, third_uniform=True),
    "ARG": dict(name="Arkansas", office="governor", D="Fredrick Love", R="Sarah Huckabee Sanders",
                third=[("Colt Shelby", "L", 1.0)], polls_csv="polls_arg.csv"),
    # ILG: two independent tickets qualified; the only public poll offered just Pritzker and Bailey, so their combined share is
    # floored at the 2022 minor party share and spread evenly, since no past race carries their vote
    "ILG": dict(name="Illinois", office="governor", D="JB Pritzker", R="Darren Bailey",
                third=[("Collin Corbett", "I", 1.0), ("Michael Vick", "I", 1.0)], polls_csv="polls_ilg.csv",
                third_floor=114527 / 4107370, third_uniform=True),
    # HIG: Green and Cordery are the only candidates who qualified, as in 2022, so there is no third party term
    "HIG": dict(name="Hawaii", office="governor", D="Josh Green", R="Gary Cordery", third=[], base="HI",
                no_polls=dict(third=0.0)),
    # MA: Ed Markey (D), who beat Seth Moulton in the Sept 1 primary, vs John Deaton (R), unopposed. Joe Tache (Party for Socialism and
    # Liberation) and independent Morgan Dawicki are on the ballot; with no past vote for either, poll Other is split evenly
    "MA": dict(name="Massachusetts", D="Ed Markey", R="John Deaton", third=[("Joe Tache", "PSL", 1.0), ("Morgan Dawicki", "I", 1.0)], polls_csv="polls_ma.csv"),
    # RI: Jack Reed (D) vs Raymond McKay (R). No minor candidates named: poll Other modeled as other / write-in
    "RI": dict(name="Rhode Island", D="Jack Reed", R="Raymond McKay", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_ri.csv"),
    # DE: Chris Coons (D) vs Michael Katz (R), both won the Sept 15 2026 primaries. No public polls: the M3 level is set to the M1 and M2
    # average, and minor candidates are one other / independents line at the mean minor share of the 2020 and 2018 Delaware Senate races
    "DE": dict(name="Delaware", D="Chris Coons", R="Michael Katz", third=[("Other / independents", "O", 1.0)],
               no_polls=dict(third=(13077 / 490935 + 8080 / 362592) / 2)),
    # WV: Shelley Moore Capito (R) vs Rachel Fetty Anderson (D). No public polls: the M3 level is set to the M1 and M2 average, and minor
    # candidates are one other / independents line at the mean minor share of the 2020 and 2018 West Virginia Senate races
    "WV": dict(name="West Virginia", D="Rachel Fetty Anderson", R="Shelley Moore Capito", third=[("Other / independents", "O", 1.0)],
               no_polls=dict(third=(21155 / 778918 + 24865 / 586488) / 2)),
    # IL: open seat, Durbin retiring. Juliana Stratton (D) vs Don Tracy (R). No public polls: the M3 level is set to the M1 and M2 average,
    # and minor candidates are one other / independents line at the mean minor share of the 2020 and 2022 Illinois Senate races
    "IL": dict(name="Illinois", D="Juliana Stratton", R="Don Tracy", third=[("Other / independents", "O", 1.0)],
               no_polls=dict(third=(372613 / 5970236 + 70096 / 4100287) / 2)),
    # TN: Bill Hagerty (R), unopposed for renomination, vs Marquita Bradshaw (D). Andrew Woodruff Mixon (Federalist) and nine independents
    # are on the ballot. Poll Other split one share per candidate: Mixon one tenth, the nine independents as one line with nine tenths
    "TN": dict(name="Tennessee", D="Marquita Bradshaw", R="Bill Hagerty",
               third=[("Andrew Woodruff Mixon", "F", 1.0), ("Other independents", "O", 9.0)], polls_csv="polls_tn.csv"),
    # AL: open seat, Tuberville running for governor. Barry Moore (R) vs Everett Wess (D), both runoff winners June 16. No minor candidates
    # listed: poll Other modeled as other / write-in
    "AL": dict(name="Alabama", D="Everett Wess", R="Barry Moore", third=[("Other / write-in", "O", 1.0)], polls_csv="polls_al.csv"),
    # NJ: Cory Booker (D), unopposed for renomination, vs Justin Murphy (R). Independents Veronica Fernandez, Nicholas Carducci and
    # Michael Estrada and Joanne Kuniansky (Socialist Workers) are on the ballot. No public polls: the M3 level is set to the M1 and M2
    # average and the minor share is the mean minor share of the 2020 and 2018 New Jersey Senate races. Split weights: Fernandez's own
    # 2020 vote, the 2020 independent Burke vote for each of Carducci and Estrada, the 2008 Socialist Workers vote for Kuniansky
    "NJ": dict(name="New Jersey", D="Cory Booker", R="Justin Murphy",
               third=[("Veronica Fernandez", "I", 32290), ("Nicholas Carducci", "I", 11632), ("Michael Estrada", "I", 11632), ("Joanne Kuniansky", "SWP", 9187)],
               no_polls=dict(third=(82210 / 4440540 + 100301 / 3169310) / 2)),
    "OK": dict(name="Oklahoma", D="N'Kiyla Jasmine Thomas", R="Kevin Hern",
               third=[("Sevier White", "L", 34435), ("Curtis Stinnett", "I", 16511.5), ("Ron Meinhard", "I", 16511.5)], polls_csv="polls_ok.csv"),
    "NE": dict(name="Nebraska", D="Dan Osborn", R="Pete Ricketts", D_party="I",
               third=[("Other / write-in", "O", 1.0)], polls_csv="polls_ne.csv",
               hist_w=[0.5, 0.2, 0.15, 0.15], trend_carry=0.0, osborn_effect=True),
}

# ── shared inputs ────────────────────────────────────────────────────────────
def county_list(st):
    if st.startswith("AK"):
        return list(AK_UNITS)
    if st == "HIG":
        # Kalawao County (15005) has no separate election results: its votes are reported inside Maui County
        return ["15001", "15003", "15007", "15009"]
    return sorted([f for f in NAMES if f.startswith(FIPS[st])])

def name_to_fips(st):
    return {norm(NAMES[f]): f for f in county_list(st)}

def pres(year):
    if year == 2016:
        d = pd.read_csv(f"{GEO}/pres16.csv"); d["f"] = d.combined_fips.astype(int).astype(str).str.zfill(5)
        return d.set_index("f")[["votes_dem", "votes_gop", "total_votes"]].astype(float)
    d = pd.read_csv(f"{GEO}/pres{str(year)[2:]}.csv", dtype={"county_fips": str}); d["f"] = d.county_fips.str.zfill(5)
    return d.set_index("f")[["votes_dem", "votes_gop", "total_votes"]].astype(float)

P16, P20, P24 = pres(2016), pres(2020), pres(2024)
# Connecticut 2024 is certified by planning region: use the county estimates built in CTG/build_ctg.py instead
_ct24 = pd.read_csv(f"{BASE}/CTG/ct_county_pres24.csv", dtype={"county_fips": str}).set_index("county_fips")
P24 = pd.concat([P24[~P24.index.str.startswith("091")], _ct24[["votes_dem", "votes_gop", "total_votes"]]])
def _ct_counties(df, f):
    """Connecticut reports by planning region since 2024. Swap those rows for the eight county rows built in CTG/build_ctg.py."""
    keep = df[~f.str.startswith("091")].copy()
    return keep

APPROVAL = pd.read_csv(f"{PKG['TX']}/TPSI_Trump_Approval_By_County_Combined_FULL.csv")
APPROVAL["f"] = APPROVAL.county_fips.astype(int).astype(str).str.zfill(5)
# APPROVAL_SRC=tpsi reads the TPSI county estimates alone. The published TRUMP APPROVE and TRUMP DISAPPROVE
# columns are the straight average of the TPSI aligned estimate and the ElectIndex estimate.
APPROVAL_SRC = os.environ.get("APPROVAL_SRC", "combined")
if APPROVAL_SRC == "tpsi":
    APPROVAL["TRUMP APPROVE"] = APPROVAL.tpsi_approve_aligned
    APPROVAL["TRUMP DISAPPROVE"] = APPROVAL.tpsi_disapprove_aligned
    APPROVAL["no_opinion"] = 100 - APPROVAL.tpsi_approve_aligned - APPROVAL.tpsi_disapprove_aligned
_ctap = pd.read_csv(f"{BASE}/CTG/ct_county_approval{'_tpsi' if APPROVAL_SRC == 'tpsi' else ''}.csv", dtype={"county_fips": str})
_ctap["f"] = _ctap.county_fips
APPROVAL = pd.concat([_ct_counties(APPROVAL, APPROVAL.f), _ctap], ignore_index=True).set_index("f")
# September 2026 national database, the same six waves as the previous export with 99 more
# respondents; every variable this model reads is identical on the 4,238 rows they share.
RESP = pd.read_csv(f"{BASE}/tpsi_db/TPSI_National_Respondent_Database.csv", low_memory=False)
ACS = pd.read_csv(glob.glob(f"{PKG['MI']}/ACSST5Y2024.S1501_2026-09-11T174726/*Data.csv")[0], skiprows=[1], low_memory=False)
ACS["f"] = ACS.GEO_ID.str[-5:]
_ctacs = pd.read_csv(f"{BASE}/CTG/ct_county_acs.csv", low_memory=False)
_ctacs["f"] = _ctacs.GEO_ID.str[-5:]
ACS = pd.concat([_ct_counties(ACS, ACS.f), _ctacs], ignore_index=True).set_index("f")

# ── polls ────────────────────────────────────────────────────────────────────
# Polls released after a state's source document or poll file was compiled. Appended before averaging, so they take the
# same recency, sample size, likely voter and partisanship weights as everything else, and they count toward the adaptive
# tier on the same terms. Source strings follow the file convention: a "(D)", "(R)" or "(I)" tag marks a sponsored poll,
# including one paid for by a group supporting an independent candidate.
EXTRA_POLLS = {
    # Big Data Poll "Peach State Poll" for the Public Polling Project, Sept 21-23 2026, 678 likely
    # voters of 712 registered, MoE 4.0, 60 percent live agent and 40 percent online through Lucid,
    # weighted on sex, age, race, education and geography. The initial ballot is carried here rather
    # than the leaned figures, because the model allocates undecideds itself; leaned, the release has
    # the Senate 55.4 to 44.6 and the governor 50.5 to 49.5.
    "GA":  [dict(source="Big Data Poll", dates="September 21-23, 2026", end="2026-09-23", n=678, pop="LV", D=52.2, R=41.0, O=0, U=6.8)],
    "GAG": [dict(source="Big Data Poll", dates="September 21-23, 2026", end="2026-09-23", n=678, pop="LV", D=46.7, R=48.7, O=0, U=4.6)],
    # UNH Survey Center September 17-21 2026 New England wave, six states fielded together.
    # Every figure below is off the release PDFs rather than a secondary report. Massachusetts
    # Senate is the one place a widely shared summary of this wave put Deaton at 40; the release
    # says 30, and 53 + 40 + 9 would total 102, so 30 is the number carried here.
    "NHG": [dict(source="University of New Hampshire", dates="September 17-21, 2026", end="2026-09-21", n=1418, pop="LV", D=43, R=47, O=3, U=7)],
    "MEG": [dict(source="University of New Hampshire", dates="September 17-21, 2026", end="2026-09-21", n=1312, pop="LV", D=48, R=40, O=5, U=7)],
    "MA":  [dict(source="University of New Hampshire", dates="September 17-21, 2026", end="2026-09-21", n=564, pop="LV", D=53, R=30, O=9, U=8)],
    "MAG": [dict(source="University of New Hampshire", dates="September 17-21, 2026", end="2026-09-21", n=564, pop="LV", D=54, R=38, O=0, U=8)],
    "RI":  [dict(source="University of New Hampshire", dates="September 17-21, 2026", end="2026-09-21", n=598, pop="LV", D=53, R=33, O=6, U=8)],
    # Rhode Island governor: Ken Block runs as an independent and leads the Republican 25 to 17.
    # Block sits in O with the other independents, so the two party split here is Foulkes against
    # Guckian alone and the 29 point O share carries most of the race.
    "RIG": [dict(source="University of New Hampshire", dates="September 17-21, 2026", end="2026-09-21", n=598, pop="LV", D=44, R=17, O=29, U=10)],
    "CTG": [dict(source="University of New Hampshire", dates="September 17-21, 2026", end="2026-09-21", n=540, pop="LV", D=55, R=38, O=1, U=6)],
    # Vermont governor. The June 18-23 and July 15-20 UNH waves are NOT listed here: they already
    # arrive through VTG/polls_vtg.csv, and adding them again produced duplicate rows because the
    # dedupe key is source plus the dates string and the two spellings of the date differ by a
    # comma. Both waves predate the August 11 primary Janoo won, and the recency curve leaves them
    # about 1 percent and 0.1 percent of the September read, so the level here is the September poll.
    "VTG": [dict(source="University of New Hampshire", dates="September 17-21, 2026", end="2026-09-21", n=835, pop="LV", D=49, R=43, O=2, U=6)],
    "MI": [dict(source="co/efficient (R)", dates="September 21-23, 2026", end="2026-09-23", n=843, pop="LV", D=45, R=45, O=2, U=8),
           dict(source="New York Times/Siena University", dates="September 15-22, 2026", end="2026-09-22", n=613, pop="LV", D=49, R=44, O=0, U=7),
           dict(source="InsiderAdvantage", dates="September 16-17, 2026", end="2026-09-17",
                n=1200, pop="LV", D=46.6, R=44.7, O=3.3, U=5.4),
           dict(source="Suffolk University", dates="September 16-20, 2026", end="2026-09-20", n=500, pop="LV", D=47, R=40, O=3, U=8),
           dict(source="Emerson College", dates="September 12-14, 2026", end="2026-09-14", n=1000, pop="LV", D=48, R=46, O=2, U=4),
           dict(source="The Washington Post/SSPG", dates="September 10-14, 2026", end="2026-09-14", n=803, pop="LV", D=48, R=45, O=5, U=2)],
    "ME": [dict(source="University of New Hampshire", dates="September 17-21, 2026", end="2026-09-21", n=1312, pop="LV", D=51, R=47, O=0, U=2),
           dict(source="New York Times/Siena University", dates="September 15-22, 2026", end="2026-09-22", n=619, pop="LV", D=46, R=49, O=0, U=5)],
    "NH": [dict(source="University of New Hampshire", dates="September 17-21, 2026", end="2026-09-21", n=1418, pop="LV", D=50, R=42, O=4, U=4),
           dict(source="New York Times/Siena University", dates="September 15-22, 2026", end="2026-09-22", n=613, pop="LV", D=50, R=45, O=0, U=5)],
    "LA": [dict(source="Hart Research (D)", dates="September 17-19, 2026", end="2026-09-19", n=500, pop="LV", D=44, R=48, O=0, U=8)],
    "CAG": [dict(source="Berkeley IGS", dates="September 15-20, 2026", end="2026-09-20", n=4512, pop="RV", D=58, R=33, O=0, U=9)],
    "MIG": [dict(source="co/efficient (R)", dates="September 21-23, 2026", end="2026-09-23", n=843, pop="LV", D=47, R=44, O=0, U=9)],
    # Sept 25 2026 sync. Five Senate polls the site's poll files carried and the model had not
    # seen. Every one was checked against a pollster release or a report giving the field dates
    # and the sample, not against an aggregator's release-date listing.
    # Ohio is the special election; Wikipedia moved the polling table to that page, which is why
    # these two were missed.
    "OH": [dict(source="Bowling Green State University/YouGov", dates="September 1-10, 2026", end="2026-09-10", n=1000, pop="LV", D=48, R=45, O=0, U=7),
           dict(source="Trafalgar Group (R)", dates="September 14-16, 2026", end="2026-09-16", n=1085, pop="LV", D=45, R=42, O=0, U=13)],
    "SC": [dict(source="Rasmussen Reports", dates="September 14, 2026", end="2026-09-14", n=1006, pop="LV", D=43, R=48, O=0, U=9)],
}

def _add_extra(st, p):
    rows = EXTRA_POLLS.get(st)
    if not rows: return p
    add = pd.DataFrame([{**r, "end": pd.Timestamp(r["end"])} for r in rows])
    have = set(p.source.str.strip() + "|" + p.dates.str.strip()) if len(p) else set()
    add = add[~(add.source.str.strip() + "|" + add.dates.str.strip()).isin(have)]
    return pd.concat([p, add], ignore_index=True) if len(add) else p

def parse_polls(st):
    cfg = STATES[st]
    rows = []
    if cfg.get("no_polls"):
        return pd.DataFrame(columns=["key", "source", "dates", "end", "pop", "n", "D", "R", "O", "U", "w"]), \
            dict(D=float("nan"), R=float("nan"), O=float("nan"), D2=None, third=cfg["no_polls"]["third"], no_polls=True)
    if cfg.get("polls_csv"):
        p = pd.read_csv(f"{PKG[st]}/{cfg['polls_csv']}"); p["end"] = pd.to_datetime(p.end)
        p["pop"] = p["pop"].replace({"V": "RV", "A": "RV"})
        if cfg.get("split"):
            sp = cfg["split"]; p["D"] = p[sp["poll_col"]] + p[sp["other_col"]]
            p["split_share"] = p[sp["poll_col"]] / p["D"]
        p = _add_extra(st, p)
        if cfg.get("rcv") and not cfg.get("rcv_fc"):
            return _poll_avg_rcv(p)
        return _poll_avg(p)
    doc = docx.Document(f"{PKG[st]}/{cfg['docx']}")
    for t in doc.tables:
        hdr = [c.text for c in t.rows[0].cells]
        if not any("Poll" in h for h in hdr):
            continue
        hj = [re.sub(r"\s+", " ", h) for h in hdr]
        iD = [i for i, h in enumerate(hj) if "(D)" in h][0]
        iR = [i for i, h in enumerate(hj) if "(R)" in h][0]
        iO = [i for i, h in enumerate(hj) if h.startswith("Other")][0]
        iU = [i for i, h in enumerate(hj) if h.startswith("Undecided")][0]
        for r in t.rows[1:]:
            c = [x.text.strip() for x in r.cells]
            num = lambda s: float(re.match(r"[\d.]+", s).group()) if re.match(r"[\d.]+", s) else 0.0
            n = num(c[2].replace(",", ""))
            dates = re.sub(r"\[.*?\]", "", c[1]).replace("–", "-").replace("—", "-")
            end = dates.split("-")[-1].strip()
            if not re.search(r"[A-Za-z]", end.split(",")[0]):
                month = re.match(r"([A-Za-z]+)", dates).group(1)
                end = f"{month} {end}"
            rows.append(dict(source=re.sub(r"\[.*?\]", "", c[0]).replace("\n", " ").strip(), dates=dates.strip(),
                             end=pd.Timestamp(pd.to_datetime(end)), n=n, pop="LV" if "LV" in c[2] else "RV",
                             D=num(c[iD]), R=num(c[iR]), O=num(c[iO]), U=num(c[iU])))
    return _poll_avg(_add_extra(st, pd.DataFrame(rows)))

def _poll_avg(p):
    # one row per poll: prefer LV over RV, average duplicate versions
    p["key"] = p.source + "|" + p.dates
    p = p[~((p["pop"] == "RV") & p.key.isin(p[p["pop"] == "LV"].key))]
    extra = [c for c in p.columns if c.startswith("split_")]
    p = p.groupby(["key", "source", "dates", "end", "pop"], as_index=False)[["n", "D", "R", "O", "U"] + extra].mean()
    days = (AS_OF - p.end).dt.days.clip(lower=0)
    p["w"] = (0.5 ** (days / POLL_HALFLIFE_DAYS)) * np.sqrt(p.n.clip(lower=300) / 600) \
        * np.where(p["pop"] == "RV", RV_WEIGHT, 1.0) \
        * np.where(p.source.str.contains(r"\((?:D|R|I)\)"), PARTISAN_WEIGHT, 1.0)
    W = p.w.sum()
    D, R, O = (p.D * p.w).sum() / W, (p.R * p.w).sum() / W, (p.O * p.w).sum() / W
    out = dict(D=D, R=R, O=O, D2=D / (D + R), third=O / (D + R + O))
    if "split_share" in p:
        out["split_share"] = float((p.split_share * p.D * p.w).sum() / (p.D * p.w).sum())
    return p, out

def _poll_avg_rcv(p):
    """Alaska: D2 target is the final round Peltola share. First choice polls are converted to a final round with AK_RCV
    transfers of the eliminated Republicans; head to head polls are already final round. First choice shares of the two
    minor Republicans come only from first choice polls."""
    p = p.copy()
    for c in ["D", "R", "O", "U", "n"]: p[c] = p[c].astype(float)
    fc = p.kind == "first_choice"
    p["D1"], p["R1"], p["O1"] = p.D, p.R, p.O
    p.loc[fc, "D"] = p.D1 + AK_RCV["to_D"] * p.O1
    p.loc[fc, "R"] = p.R1 + AK_RCV["to_R"] * p.O1
    p["O"] = 0.0
    p["key"] = p.source + "|" + p.dates
    days = (AS_OF - p.end).dt.days.clip(lower=0)
    p["w"] = (0.5 ** (days / POLL_HALFLIFE_DAYS)) * np.sqrt(p.n.clip(lower=300) / 600) \
        * np.where(p["pop"] == "RV", RV_WEIGHT, 1.0) * np.where(p.source.str.contains(r"\((?:D|R|I)\)"), PARTISAN_WEIGHT, 1.0)
    W = p.w.sum(); D, R = (p.D * p.w).sum() / W, (p.R * p.w).sum() / W
    f = p[fc]; Wf = f.w.sum()
    D1, R1 = (f.D1 * f.w).sum() / Wf, (f.R1 * f.w).sum() / Wf
    thirds = {"Dan J. Sullivan": (f.dan_j_sullivan * f.w).sum() / Wf, "Gerald Heikes": (f.heikes * f.w).sum() / Wf}
    O1 = sum(thirds.values())
    return p, dict(D=D, R=R, O=0.0, D2=D / (D + R), third=O1 / (D1 + R1 + O1), first_choice=dict(D=D1, R=R1, **thirds),
                   first_choice_share={k: v / (D1 + R1 + O1) for k, v in thirds.items()})

# ── primaries ────────────────────────────────────────────────────────────────
def primaries(st):
    """county: D primary Senate votes, R primary Senate votes, D nominee share, R nominee share"""
    cfg = STATES[st]; n2f = name_to_fips(st); out = {}
    if st in ("TX", "MI", "IA"):
        # IA: parsed from the Iowa SOS 2026 Primary Election Canvass Summary PDF by IA/parse_canvass.py
        f = {"TX": f"{PKG['TX']}/20260303__tx__primary__county.csv", "MI": f"{H}/20260804__mi__primary__county.csv",
             "IA": f"{BASE}/IA/20260602__ia__primary__county_senate.csv"}[st]
        d = pd.read_csv(f); d = d[d.office == "U.S. Senate"]
        d["fips"] = d.county.map(lambda x: n2f[norm(x)])
        for fips, g in d.groupby("fips"):
            dem = g[g.party == "DEM"]; rep = g[g.party == "REP"]
            dn = dem[dem.candidate.str.upper() == cfg["D"].upper()].votes.sum()
            rn = rep[rep.candidate.str.upper() == cfg["R"].upper()].votes.sum()
            out[fips] = dict(pD=dem.votes.sum(), pR=rep.votes.sum(), candD=dn / max(dem.votes.sum(), 1), candR=rn / max(rep.votes.sum(), 1))
        return pd.DataFrame(out).T, "county official primary results"
    if st == "OH":
        res = {}
        for party, key in [("D", "democratic"), ("R", "republican")]:
            x = pd.read_excel(glob.glob(f"{PKG['OH']}/*{key}.xlsx")[0], sheet_name="Master", header=None)
            top = x.iloc[0].ffill(); cols = [i for i, v in enumerate(top) if isinstance(v, str) and "U.S. Senator" in v]
            body = x.iloc[4:]; body = body[body[0].notna()]
            for _, r in body.iterrows():
                fips = n2f.get(norm(r[0]))
                if fips is None: continue
                tot = sum(float(r[i]) for i in cols)
                nom = sum(float(r[i]) for i in cols if cfg[party].split()[-1] in str(x.iloc[1, i]))
                res.setdefault(fips, {})[f"p{party}"] = tot
                res[fips][f"cand{party}"] = nom / max(tot, 1)
        return pd.DataFrame(res).T, "county official primary canvass (Ohio SOS)"
    if st in ("IDG", "WYG"):
        # no county primary file located: both party sides sized by the 2022 governor county vote, nominee terms neutral
        f = f"{PKG[st]}/id_gov2022_fips.csv" if st == "IDG" else f"{PKG[st]}/wy_gov2022_county.csv"
        g = pd.read_csv(f, dtype={"fips": str})
        g.index = g.fips if st == "IDG" else g.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            out[fips] = dict(pD=float(g.loc[fips, "D"]), pR=float(g.loc[fips, "R"]), candD=0.5, candR=0.5)
        return pd.DataFrame(out).T, "no county primary data: both sides proxied by 2022 governor county vote, nominee terms neutral"
    if st == "SCG":
        # civicAPI June 9 2026 primaries, R 82596 and D 82595, and June 23 Republican runoff 84105, all 46 counties. Wilson's nominee share
        # is the mean of his first round and runoff shares (SCG/build_scg.py)
        p = pd.read_csv(f"{PKG['SCG']}/sc_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=float(r.johnson_share), candR=0.5 * r.wilson_first + 0.5 * r.wilson_runoff)
        return pd.DataFrame(out).T, "civicAPI county results, June 9 2026 primaries 82596 and 82595, June 23 Republican runoff 84105"
    if st == "MNG":
        # Aug 11 2026 governor primaries from civicAPI, D 85510 and R 85511, missing counties filled by 2022 county vote (MNG/build_mng.py)
        p = pd.read_csv(f"{PKG['MNG']}/mn_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=float(r.klobuchar_share), candR=float(r.demuth_share))
        return pd.DataFrame(out).T, "civicAPI county results, Aug 11 2026 governor primaries, D 85510 and R 85511"
    if st == "TNG":
        # Aug 6 2026 governor primaries from civicAPI, D 85028 and R 85029, all 95 counties (TNG/build_tng.py)
        p = pd.read_csv(f"{PKG['TNG']}/tn_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=float(r.green_share), candR=float(r.blackburn_share))
        return pd.DataFrame(out).T, "civicAPI county results, Aug 6 2026 governor primaries, D 85028 and R 85029"
    if st == "NHG":
        # civicAPI Sept 8 2026 Republican primary 96677, towns in six counties with the remainder spread by 2024 Ayotte vote (NHG/build_nhg.py).
        # No Democratic primary contest listed: the 2024 Craig county vote sizes that side, term neutral
        p = pd.read_csv(f"{PKG['NHG']}/nh_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        g = pd.read_csv(f"{PKG['NHG']}/nh_gov2024_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            out[fips] = dict(pD=float(g.loc[fips, "D"]), pR=float(p.loc[fips, "rep_total"]), candD=0.5, candR=float(p.loc[fips, "ayotte_share"]))
        return pd.DataFrame(out).T, "civicAPI town results, Sept 8 2026 Republican primary 96677; no Democratic primary contest"
    if st == "COG":
        # June 30 2026 governor primaries from civicAPI, D 84286 and R 84287, all 64 counties (COG/build_cog.py)
        p = pd.read_csv(f"{PKG['COG']}/co_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=float(r.weiser_share), candR=float(r.marx_share))
        return pd.DataFrame(out).T, "civicAPI county results, June 30 2026 governor primaries, D 84286 and R 84287"
    if st == "VTG":
        # Aug 11 2026 primaries. Scott was unopposed; the civicAPI Democratic page 86049 mixes county and town rows whose totals do not match
        # its statewide figure, so it is not used. Both sides are sized by the 2022 Siegel and Scott county vote, nominee terms neutral
        g = pd.read_csv(f"{PKG['VTG']}/vt_gov2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            out[fips] = dict(pD=float(g.loc[fips, "D"]), pR=float(g.loc[fips, "R"]), candD=0.5, candR=0.5)
        return pd.DataFrame(out).T, "no usable county primary data: both sides proxied by 2022 governor county vote, nominee terms neutral"
    if st == "SDG":
        # civicAPI June 2 2026 Republican primary 80461 and July 28 runoff 84571, all 66 counties. Rhoden's nominee share is the mean of his first
        # round and runoff shares. No Democratic primary contest: the 2022 Smith county vote sizes that side, term neutral (SDG/build_sdg.py)
        p = pd.read_csv(f"{PKG['SDG']}/sd_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        g = pd.read_csv(f"{PKG['SDG']}/sd_gov2022_fips.csv", dtype={"fips": str}).set_index("fips")
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(g.loc[fips, "D"]), pR=float(r.rep_total), candD=0.5, candR=0.5 * r.rhoden_first + 0.5 * r.rhoden_runoff)
        return pd.DataFrame(out).T, "civicAPI county results, June 2 2026 Republican primary 80461 and July 28 runoff 84571"
    if st == "ALG":
        # civicAPI May 19 2026 governor primaries, D 79439 and R 79440, all 67 counties; two bad Santivasci cells corrected (ALG/build_alg.py)
        p = pd.read_csv(f"{PKG['ALG']}/al_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=float(r.jones_share), candR=float(r.tuberville_share))
        return pd.DataFrame(out).T, "civicAPI county results, May 19 2026 governor primaries, D 79439 and R 79440"
    if st == "OKG":
        # civicAPI June 16 2026 primaries, D 83343 all counties and R 83344 cut off after 61 counties (remainder spread by 2022 Stitt vote),
        # and the Aug 25 Republican runoff 87529. Mazzei's nominee share is the mean of his first round and runoff shares (OKG/build_okg.py)
        p = pd.read_csv(f"{PKG['OKG']}/ok_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=float(r.munson_share), candR=0.5 * r.mazzei_first + 0.5 * r.mazzei_runoff)
        return pd.DataFrame(out).T, "civicAPI county results, June 16 2026 governor primaries 83343 and 83344, Aug 25 Republican runoff 87529"
    if st == "NEG":
        # May 12 2026 governor primaries from civicAPI, R 74889 and D 74887, all 93 counties (NEG/build_neg.py)
        p = pd.read_csv(f"{PKG['NEG']}/ne_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=float(r.walz_share), candR=float(r.pillen_share))
        return pd.DataFrame(out).T, "civicAPI county results, May 12 2026 governor primaries, R 74889 and D 74887"
    if st == "KSG":
        # Aug 4 2026 governor primaries from civicAPI, D 84780 all 105 counties and R 84781 cut off after 78 counties with the statewide
        # remainder spread by 2022 Schmidt vote (KSG/build_ksg.py)
        p = pd.read_csv(f"{PKG['KSG']}/ks_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=float(r.holscher_share), candR=float(r.masterson_share))
        return pd.DataFrame(out).T, "civicAPI county results, Aug 4 2026 governor primaries, D 84780 and R 84781"
    if st == "ORG":
        # May 19 2026 governor primaries from civicAPI races 79219 D and 79220 R, all 36 counties, grossed up by percent reporting and scaled
        # to final statewide totals (ORG/build_org.py)
        p = pd.read_csv(f"{PKG['ORG']}/or_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=float(r.kotek_share), candR=float(r.drazan_share))
        return pd.DataFrame(out).T, "civicAPI county results, May 19 2026 governor primaries, D 79219 and R 79220"
    if st == "CAG":
        # June 2 2026 top two primary, California SOS Statement of Vote by county (CAG/build_cag_primary.py), all 58 counties. Party sides are
        # the summed Democratic and Republican candidate vote; nominee shares are Becerra's share of the Democratic vote and Hilton's of the Republican
        p = pd.read_csv(f"{PKG['CAG']}/ca_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r.becerra / r.dem_total, candR=r.hilton / r.rep_total)
        return pd.DataFrame(out).T, "California SOS Statement of Vote, June 2 2026 top two governor primary"
    if st == "NVG":
        # June 9 2026 governor primaries from civicAPI races 83110 D and 83111 R, all 17 counties, grossed up by percent reporting and
        # scaled to final statewide totals (NVG/build_nvg.py)
        p = pd.read_csv(f"{PKG['NVG']}/nv_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=float(r.ford_share), candR=float(r.lombardo_share))
        return pd.DataFrame(out).T, "civicAPI county results, June 9 2026 governor primaries, D 83110 and R 83111"
    if st == "AZG":
        # July 21 2026 Republican governor primary from civicAPI race 84359, all 15 counties, grossed up by percent reporting and scaled to
        # the final statewide total (AZG/build_azg.py). Hobbs was unopposed: her 2022 general county vote sizes the Democratic side, term neutral
        p = pd.read_csv(f"{PKG['AZG']}/az_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        g = pd.read_csv(f"{PKG['AZG']}/az_gov2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            out[fips] = dict(pD=float(g.loc[fips, "D"]), pR=float(p.loc[fips, "rep_total"]), candD=0.5, candR=float(p.loc[fips, "biggs_share"]))
        return pd.DataFrame(out).T, "civicAPI county results, July 21 2026 Republican governor primary 84359; Hobbs unopposed"
    if st == "PAG":
        # Both May 19 2026 governor primaries were uncontested: Shapiro 1,116,869 and Garrity 641,172 statewide. With no county
        # primary file supplied, both party sides are sized by the 2022 Shapiro and Mastriano county vote and both nominee terms are neutral 0.5
        g = pd.read_csv(f"{PKG['PAG']}/pa_gov2022_fips.csv", dtype={"fips": str}).set_index("fips")
        for fips in county_list(st):
            out[fips] = dict(pD=float(g.loc[fips, "D"]), pR=float(g.loc[fips, "R"]), candD=0.5, candR=0.5)
        return pd.DataFrame(out).T, "uncontested primaries: both sides proxied by 2022 governor county vote, nominee terms neutral"
    if st == "NYG":
        # No contested 2026 governor primary with county results: Delgado withdrew before the June 23 Democratic primary and
        # Blakeman was the Republican nominee without a primary vote. Both party sides are sized by the 2022 Hochul and Zeldin
        # county vote, all ballot lines summed, and both nominee terms are neutral 0.5
        g = pd.read_csv(f"{PKG['NYG']}/ny_gov2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            out[fips] = dict(pD=float(g.loc[fips, "D"]), pR=float(g.loc[fips, "R"]), candD=0.5, candR=0.5)
        return pd.DataFrame(out).T, "no contested primary: both sides proxied by 2022 governor county vote, nominee terms neutral"
    if st == "MIG":
        # Aug 4 2026 governor primaries from the Michigan county primary file used for the Senate model, all 83 counties
        p = pd.read_csv(f"{PKG['MIG']}/mi_primary_2026_gov_fips.csv", dtype={"fips": str}).set_index("fips")
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r.benson / r.dem_total, candR=r.james / r.rep_total)
        return pd.DataFrame(out).T, "county official primary results, Aug 4 2026 governor primaries"
    if st == "WIG":
        # civicAPI Aug 11 2026 governor primaries: R 85788 all 72 counties; D 85787 cut off after 68 counties when read, the statewide
        # remainder spread to the other 4 counties by 2022 Evers vote (WIG/build_wig.py)
        p = pd.read_csv(f"{PKG['WIG']}/wi_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r.crowley / r.dem_total, candR=r.tiffany / r.rep_total)
        return pd.DataFrame(out).T, "civicAPI county results: Aug 11 2026 governor primaries, D 85787 and R 85788"
    if st == "GAG":
        # GA SOS county results: May 19 governor primaries and June 16 Republican runoff, all 159 counties. Party size from the first round;
        # Jackson's nominee share is the mean of his first round and runoff shares, as in the Georgia Senate model
        p = pd.read_csv(f"{PKG['GAG']}/ga_primary_2026_gov_fips.csv", dtype={"fips": str}).set_index("fips")
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r.bottoms / r.dem_total,
                             candR=0.5 * r.jackson_first / r.rep_total + 0.5 * r.jackson_runoff / r.runoff_total)
        return pd.DataFrame(out).T, "GA SOS county results, May 19 governor primaries and June 16 Republican runoff"
    if st == "OHG":
        # May 5 2026 governor primaries from the Ohio SOS official canvass workbooks (OHG/build_ohg_primary.py), all 88 counties.
        # Acton was unopposed; her county vote sizes the Democratic side
        p = pd.read_csv(f"{PKG['OHG']}/oh_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r.dem_nominee / r.dem_total, candR=r.rep_nominee / r.rep_total)
        return pd.DataFrame(out).T, "Ohio SOS official canvass, May 5 2026 governor primaries"
    if st == "IAG":
        # June 2 2026 governor primaries from the Iowa SOS canvass summary PDF (IAG/parse_gov_canvass.py), all 99 counties.
        # Sand was unopposed; his county vote sizes the Democratic side and his nominee share is his share of Democratic ballots
        p = pd.read_csv(f"{PKG['IAG']}/20260602__ia__primary__county_governor.csv"); p["fips"] = p.county.map(lambda x: n2f[norm(x)])
        for fips, g in p.groupby("fips"):
            dem = g[g.party == "DEM"]; rep = g[g.party == "REP"]
            out[fips] = dict(pD=float(dem.votes.sum()), pR=float(rep.votes.sum()), candD=dem[dem.candidate == "Rob Sand"].votes.sum() / dem.votes.sum(),
                             candR=rep[rep.candidate == "Zach Lahn"].votes.sum() / rep.votes.sum())
        return pd.DataFrame(out).T, "Iowa SOS canvass summary, June 2 2026 governor primaries"
    if st == "TXG":
        # March 3 2026 governor primaries from the Texas county primary file used for the Senate model, all 254 counties. No runoffs
        p = pd.read_csv(f"{PKG['TXG']}/tx_primary_2026_gov_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r.hinojosa / max(r.dem_total, 1), candR=r.abbott / max(r.rep_total, 1))
        return pd.DataFrame(out).T, "county official primary results, March 3 2026 governor primaries"
    if st == "FLG":
        # Aug 18 2026 governor primaries. D: civicAPI race 86348, all 67 counties, sums match statewide. R: civicAPI race 86349 is cut off
        # after 50 counties when read (each checked against its percent field); the other 17 counties are from the Florida Division of
        # Elections county report. Combined R totals are within 100 votes of the civicAPI statewide totals
        r = pd.read_csv(f"{PKG['FLG']}/r_primary.csv"); r.index = r.County.map(lambda x: n2f[norm(x)])
        d = pd.read_csv(f"{PKG['FLG']}/d_primary.csv"); d.index = d.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            dt = d.loc[fips].iloc[1:].sum()
            out[fips] = dict(pD=float(dt), pR=float(r.loc[fips, "total"]), candD=d.loc[fips, "Jolly"] / dt, candR=r.loc[fips, "nominee"] / r.loc[fips, "total"])
        return pd.DataFrame(out).T, "Aug 18 2026 governor primaries: civicAPI 86348 (D) and 86349 (R) plus Florida Division of Elections for 17 R counties"
    if st == "MA":
        # civicAPI race 87556, Sept 1 2026 D primary, 14 county rows add exactly to statewide (96.9 percent reporting). Deaton had no
        # contested primary, so the Republican side of the party term is O'Connor's 2020 county vote and Deaton's nominee term is neutral
        d = pd.read_csv(f"{PKG['MA']}/d_primary.csv"); d.index = d.County.map(lambda x: n2f[norm(x)])
        g = pd.read_csv(f"{PKG['MA']}/ma_sen2020_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            dt = d.loc[fips].iloc[1:].sum()
            out[fips] = dict(pD=float(dt), pR=float(g.loc[fips, "R"]), candD=d.loc[fips, "Edward J. Markey"] / dt, candR=0.5)
        return pd.DataFrame(out).T, "civicAPI race 87556 Sept 1 2026 D primary; Republican side from O'Connor 2020 county vote"
    if st == "RI":
        # civicAPI race 97360, Sept 9 2026 D primary, county rows (plus 187 overseas votes) add to statewide. No Republican primary results
        # were provided, so the Republican side of the party term is Allen Waters' 2020 county vote and McKay's nominee share term is neutral
        d = pd.read_csv(f"{PKG['RI']}/d_primary.csv"); d.index = d.County.map(lambda x: n2f[norm(x)])
        g = pd.read_csv(f"{PKG['RI']}/ri_sen2020_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            dt = d.loc[fips].iloc[1:].sum()
            out[fips] = dict(pD=float(dt), pR=float(g.loc[fips, "R"]), candD=d.loc[fips, "Jack Reed"] / dt, candR=0.5)
        return pd.DataFrame(out).T, "civicAPI race 97360 Sept 9 2026 D primary; Republican side from Waters 2020 county vote"
    if st == "DE":
        # civicAPI Sept 15 2026 R (97883) and D (97882) primaries, all 3 counties, sums match statewide (95.7 and 97.9 percent reporting).
        # The API also lists Wilmington and the rest of New Castle, which add to New Castle and are not used separately
        r = pd.read_csv(f"{PKG['DE']}/r_primary.csv"); r.index = r.County.map(lambda x: n2f[norm(x)])
        d = pd.read_csv(f"{PKG['DE']}/d_primary.csv"); d.index = d.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            rt = r.loc[fips].iloc[1:].sum(); dt = d.loc[fips].iloc[1:].sum()
            out[fips] = dict(pD=float(dt), pR=float(rt), candD=d.loc[fips, "Chris Coons"] / dt, candR=r.loc[fips, "Michael Katz"] / rt)
        return pd.DataFrame(out).T, "civicAPI county results: Sept 15 2026 R (97883) and D (97882) Senate primaries"
    if st == "WV":
        # civicAPI May 12 2026 R (75244) and D (75243) primaries, all 55 counties, sums match the API statewide totals
        r = pd.read_csv(f"{PKG['WV']}/r_primary.csv"); r.index = r.County.map(lambda x: n2f[norm(x)])
        d = pd.read_csv(f"{PKG['WV']}/d_primary.csv"); d.index = d.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            rt = r.loc[fips].iloc[1:].sum(); dt = d.loc[fips].iloc[1:].sum()
            out[fips] = dict(pD=float(dt), pR=float(rt), candD=d.loc[fips, "Rachel Fetty Anderson"] / dt, candR=r.loc[fips, "Shelley Moore Capito"] / rt)
        return pd.DataFrame(out).T, "civicAPI county results: May 12 2026 R (75244) and D (75243) Senate primaries"
    if st == "IL":
        # civicAPI March 17 2026 D (55550) and R (55551) primaries. The API response is cut off when read: 57 D counties and 87 R counties
        # visible, each checked against the API percent field; the statewide remainder is spread to missing counties by 2020 party vote
        p = pd.read_csv(f"{PKG['IL']}/il_primary_2026_county.csv"); p.index = p.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.D_total), pR=float(r.R_total), candD=r.D_nominee / r.D_total, candR=r.R_nominee / r.R_total)
        return pd.DataFrame(out).T, "civicAPI county results: March 17 2026 D (55550) and R (55551) primaries, remainder spread to cut off counties"
    if st == "TN":
        # civicAPI race 85080, Aug 6 2026 D primary, all 95 counties, sums match statewide. Hagerty was unopposed, so the Republican side
        # of the party term is Hagerty's own 2020 county vote and his nominee share term is neutral
        d = pd.read_csv(f"{PKG['TN']}/d_primary.csv"); d.index = d.County.map(lambda x: n2f[norm(x)])
        g = pd.read_csv(f"{PKG['TN']}/tn_sen2020_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            dt = d.loc[fips].iloc[1:].sum()
            out[fips] = dict(pD=float(dt), pR=float(g.loc[fips, "R"]), candD=d.loc[fips, "Bradshaw"] / dt, candR=0.5)
        return pd.DataFrame(out).T, "civicAPI race 85080 Aug 6 2026 D primary; Republican side from Hagerty 2020 county vote"
    if st == "AL":
        # civicAPI May 19 2026 R (79432) and D (79431) primaries, all 67 counties, sums match statewide. Both nominees won June 16 runoffs,
        # but no county runoff results were provided, so nominee shares are first round shares of the full field
        r = pd.read_csv(f"{PKG['AL']}/r_primary.csv"); r.index = r.County.map(lambda x: n2f[norm(x)])
        d = pd.read_csv(f"{PKG['AL']}/d_primary.csv"); d.index = d.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            rt = r.loc[fips].iloc[1:].sum(); dt = d.loc[fips].iloc[1:].sum()
            out[fips] = dict(pD=float(dt), pR=float(rt), candD=d.loc[fips, "Everett Wess"] / dt, candR=r.loc[fips, "Barry Moore"] / rt)
        return pd.DataFrame(out).T, "civicAPI county results: May 19 2026 R (79432) and D (79431) Senate primaries"
    if st == "NJ":
        # civicAPI race 81058, June 2 2026 R primary, all 21 counties, sums match statewide. Booker was unopposed, so the Democratic side
        # of the party term is Booker's own 2020 county vote and his nominee share term is neutral
        r = pd.read_csv(f"{PKG['NJ']}/r_primary.csv"); r.index = r.County.map(lambda x: n2f[norm(x)])
        g = pd.read_csv(f"{PKG['NJ']}/nj_sen2020_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            rt = r.loc[fips].iloc[1:].sum()
            out[fips] = dict(pD=float(g.loc[fips, "D"]), pR=float(rt), candD=0.5, candR=r.loc[fips, "Justin Murphy"] / rt)
        return pd.DataFrame(out).T, "civicAPI race 81058 June 2 2026 R primary; Democratic side from Booker 2020 county vote"
    if st == "OK":
        # civicAPI June 16 2026 R (83424) and D (83423) primaries and Aug 25 D runoff (87533), all 77 counties, sums match statewide.
        # Party size from the first round; Thomas share is the mean of first round and runoff shares, as in Georgia and Louisiana
        r = pd.read_csv(f"{PKG['OK']}/r_primary.csv"); r.index = r.County.map(lambda x: n2f[norm(x)])
        d = pd.read_csv(f"{PKG['OK']}/d_primary.csv"); d.index = d.County.map(lambda x: n2f[norm(x)])
        ro = pd.read_csv(f"{PKG['OK']}/d_runoff.csv"); ro.index = ro.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            rt = r.loc[fips].iloc[1:].sum(); dt = d.loc[fips].iloc[1:].sum()
            d1 = d.loc[fips, "Thomas"] / dt; d2 = ro.loc[fips, "Thomas"] / (ro.loc[fips, "Thomas"] + ro.loc[fips, "Priest"])
            out[fips] = dict(pD=float(dt), pR=float(rt), candD=0.5 * d1 + 0.5 * d2, candR=r.loc[fips, "Kevin Hern"] / rt)
        return pd.DataFrame(out).T, "civicAPI county results: June 16 2026 R (83424) and D (83423) primaries, Aug 25 D runoff (87533)"
    if st == "NM":
        # civicAPI race 81014, June 2 2026 Democratic primary, all 33 counties, sums match statewide. Marker was nominated with write-in
        # votes and no county Republican results exist, so the Republican side of the party term is Ronchetti's 2020 county vote
        p = pd.read_csv(f"{PKG['NM']}/d_primary.csv"); p.index = p.County.map(lambda x: n2f[norm(x)])
        g = pd.read_csv(f"{PKG['NM']}/nm_sen2020_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]; dt = r["Ben Lujan"] + r["Matt Dodson"]
            out[fips] = dict(pD=float(dt), pR=float(g.loc[fips, "R"]), candD=r["Ben Lujan"] / dt, candR=0.5)
        return pd.DataFrame(out).T, "civicAPI race 81014 June 2 2026 D primary; Republican side from Ronchetti 2020 county vote"
    if st == "CO":
        # civicAPI race 84322, June 30 2026 Democratic primary, all 64 counties. No Republican primary county results were provided,
        # so the Republican side of the party term is Gardner's 2020 county vote and Baisley's nominee share term is neutral
        p = pd.read_csv(f"{PKG['CO']}/d_primary.csv"); p.index = p.County.map(lambda x: n2f[norm(x)])
        g = pd.read_csv(f"{PKG['CO']}/co_sen2020_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]; dt = r["John Hickenlooper"] + r["Julie Gonzales"]
            out[fips] = dict(pD=float(dt), pR=float(g.loc[fips, "R"]), candD=r["John Hickenlooper"] / dt, candR=0.5)
        return pd.DataFrame(out).T, "civicAPI race 84322 June 30 2026 D primary; Republican side from Gardner 2020 county vote"
    if st == "WY":
        # civicAPI Aug 18 2026 primaries: R (86810) and D (86809), all 23 counties, sums match statewide
        p = pd.read_csv(f"{PKG['WY']}/wy_primary_2026_county.csv"); p.index = p.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r["James Byrd"] / r.dem_total, candR=r["Harriet Hageman"] / r.rep_total)
        return pd.DataFrame(out).T, "county results via civicAPI: Aug 18 2026 R (86810) and D (86809) Senate primaries"
    if st == "OR":
        # civicAPI May 19 2026 primaries: D (79429) and R (79430), all 36 counties, sums match statewide in the API
        p = pd.read_csv(f"{PKG['OR']}/or_primary_2026_county.csv"); p.index = p.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r["Jeff Merkley"] / r.dem_total, candR=r["David Smith"] / r.rep_total)
        return pd.DataFrame(out).T, "county results via civicAPI: May 19 2026 D (79429) and R (79430) Senate primaries"
    if st == "KY":
        # civicAPI May 19 2026 primaries: D (76946) all 120 counties; R (76947) 56 counties returned by the API, statewide remainder
        # spread to the other counties by 2014 McConnell vote (KY/build_ky.py)
        p = pd.read_csv(f"{PKG['KY']}/ky_primary_2026_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r.Booker / r.dem_total, candR=r.Barr / r.rep_total)
        return pd.DataFrame(out).T, "county results via civicAPI: May 19 2026 R (76947) and D (76946) Senate primaries"
    if st == "AR":
        # civicAPI March 3 2026 primaries: R (44729) and D (44730), all 75 counties, sums match statewide
        p = pd.read_csv(f"{PKG['AR']}/ar_primary_2026_county.csv"); p.index = p.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r["Hallie Shoffner"] / r.dem_total, candR=r["Tom Cotton"] / r.rep_total)
        return pd.DataFrame(out).T, "county results via civicAPI: March 3 2026 R (44729) and D (44730) Senate primaries"
    if st == "LA":
        # civicAPI parish results: May 16 R (75324) and D (75323) primaries, June 27 R (84157) and D (84156) runoffs, all 64 parishes.
        # Party size from the first round; nominee share is the mean of first round share and runoff share, as in Georgia
        p = pd.read_csv(f"{PKG['LA']}/la_primary_2026_parish.csv"); p.index = p.Parish.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            d1 = r["Jamie Davis"] / r.dem_total; d2 = r.Davis_runoff / (r.Davis_runoff + r.Crockett_runoff)
            r1 = r["Julia Letlow"] / r.rep_total; r2 = r.Letlow_runoff / (r.Letlow_runoff + r.Fleming_runoff)
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=0.5 * d1 + 0.5 * d2, candR=0.5 * r1 + 0.5 * r2)
        return pd.DataFrame(out).T, "civicAPI parish results: May 16 R/D primaries and June 27 R/D runoffs"
    if st == "MS":
        # civicAPI March 10 2026 primaries: R (51420) and D (46673), all 82 counties, sums match statewide
        p = pd.read_csv(f"{PKG['MS']}/ms_primary_2026_county.csv"); p.index = p.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r["Scott Colom"] / r.dem_total, candR=r["Cindy Hyde-Smith"] / r.rep_total)
        return pd.DataFrame(out).T, "county results via civicAPI: March 10 2026 R (51420) and D (46673) Senate primaries"
    if st == "MN":
        # civicAPI Aug 11 2026 primaries: DFL (85562) all 87 counties; R (85563) 61 counties returned by the API, the statewide
        # residual for each candidate spread to the other 26 counties by 2020 Lewis vote (built by MN/build_mn.py)
        p = pd.read_csv(f"{PKG['MN']}/mn_primary_2026_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r.Flanagan / r.dem_total, candR=r.Tafoya / r.rep_total)
        return pd.DataFrame(out).T, "county results via civicAPI: Aug 11 2026 DFL (85562) and R (85563) Senate primaries"
    if st == "VA":
        # civicAPI race 84970, Aug 4 2026 R primary, all 133 counties and independent cities (four localities fetched separately,
        # one duplicate Southampton row dropped; sums match statewide). Warner was unopposed, so the Democratic side of the party
        # term is Warner's own 2020 locality vote and his nominee share term is neutral
        p = pd.read_csv(f"{PKG['VA']}/va_primary_2026_county.csv", dtype={"fips": str}).set_index("fips")
        w = pd.read_csv(f"{PKG['VA']}/va_sen2020_county.csv", dtype={"fips": str}).set_index("fips")
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(w.loc[fips, "D"]), pR=float(r.rep_total), candD=0.5, candR=r["Bert Mizusawa"] / r.rep_total)
        return pd.DataFrame(out).T, "civicAPI race 84970 Aug 4 2026 R primary; Democratic side from Warner 2020 locality vote"
    if st == "MT":
        # civicAPI county results, June 2 2026: R (80460) and D (80458) Senate primaries, all 56 counties.
        # Bodnar qualified by petition and was on no primary ballot; the bloc nominee share term uses Bankhead's primary share
        n2f = name_to_fips(st)
        r = pd.read_csv(f"{PKG['MT']}/r_primary.csv"); r.index = r.County.map(lambda x: n2f[norm(x)])
        d = pd.read_csv(f"{PKG['MT']}/d_primary.csv"); d.index = d.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            rt = r.loc[fips].iloc[1:].sum(); dt = d.loc[fips].iloc[1:].sum()
            out[fips] = dict(pD=float(dt), pR=float(rt), candD=d.loc[fips, "Alani Bankhead"] / dt, candR=r.loc[fips, "Kurt Alme"] / rt)
        return pd.DataFrame(out).T, "county results via civicAPI: June 2 2026 R (80460) and D (80458) Senate primaries"
    if st == "ID":
        # civicAPI county results, May 19 2026: R (78434) and D (78432) Senate primaries, all 44 counties, sums match statewide.
        # Achilles was not on a primary ballot, so the anti Republican nominee share term is neutral
        p = pd.read_csv(f"{PKG['ID']}/id_primary_2026_county.csv"); p.index = p.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=0.5, candR=r["Jim Risch"] / r.rep_total)
        return pd.DataFrame(out).T, "county results via civicAPI: May 19 2026 R (78434) and D (78432) Senate primaries"
    if st == "SD":
        # civicAPI race 80512, June 2 2026 R Senate primary, all 66 counties (sums match statewide). The Democratic primary was
        # uncontested with no county results and its nominee withdrew, so the anti Republican side of the party term is Bengs's
        # own 2022 Senate county vote; his nominee share term is neutral
        p = pd.read_csv(f"{PKG['SD']}/r_primary.csv"); p.index = p.County.map(lambda x: n2f[norm(x)])
        b = pd.read_csv(f"{PKG['SD']}/sen2022.csv"); b.index = b.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]; tot = r["Mike Rounds"] + r["Justin McNeal"]
            out[fips] = dict(pD=float(b.loc[fips, "D"]), pR=float(tot), candD=0.5, candR=r["Mike Rounds"] / tot)
        return pd.DataFrame(out).T, "civicAPI race 80512 June 2 2026 R primary; anti Republican side from Bengs 2022 county vote"
    if st == "FL":
        # civicAPI county results, Aug 18 2026: R (86440) and D (86439) Senate primaries, all 67 counties, sums match statewide
        p = pd.read_csv(f"{PKG['FL']}/fl_primary_2026_county.csv"); p.index = p.County.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r["Angie Nixon"] / r.dem_total,
                             candR=r["Ashley Moody"] / r.rep_total)
        return pd.DataFrame(out).T, "county results via civicAPI: Aug 18 2026 R (86440) and D (86439) Senate primaries"
    if st == "ME":
        # civicAPI race 83063, June 9 2026 Democratic primary, county file built by ME/build_me.py. Collins was unopposed and no
        # county Republican primary results exist, so the Republican side of the party term is the 2022 LePage county vote.
        # Jackson was not on the primary ballot and Collins had no opponent, so both nominee shares are neutral
        p = pd.read_csv(f"{PKG['ME']}/me_primary_2026_county.csv"); p.index = p.county.map(lambda x: n2f[norm(x)])
        g = pd.read_csv(f"{PKG['ME']}/gov22_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        for fips in county_list(st):
            out[fips] = dict(pD=float(p.loc[fips, "dem_total"]), pR=float(g.loc[fips, "R"]), candD=0.5, candR=0.5,
                             platner_primary_share=p.loc[fips, "Platner"] / p.loc[fips, "dem_total"])
        return pd.DataFrame(out).T, "civicAPI race 83063 June 9 2026 Democratic primary; Republican side proxied by 2022 LePage vote"
    if st == "NH":
        # civicAPI town results, Sept 8 2026: R (96679) and D (96678) Senate primaries, aggregated to counties by NH/build_nh.py.
        # The API response was cut off after the first counties; counties without complete town rows get the statewide residual
        # spread by 2020 Senate party vote (column rep_source / dem_source)
        p = pd.read_csv(f"{PKG['NH']}/nh_primary_2026_county.csv")
        p["fips"] = p.county.map(lambda x: n2f[norm(x)]); p = p.set_index("fips")
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r["Chris Pappas"] / r.dem_total,
                             candR=r["John E. Sununu"] / r.rep_total)
        return pd.DataFrame(out).T, "town results via civicAPI: Sept 8 2026 R (96679) and D (96678) Senate primaries"
    if st == "KS":
        # civicAPI county results, Aug 4 2026: R Senate primary (84841) all 105 counties; D Senate primary (84840) 51 counties
        # returned by the API, the remaining statewide residual spread to the other 54 counties by 2020 Bollier vote
        p = pd.read_csv(f"{PKG['KS']}/ks_primary_2026_county.csv")
        p["fips"] = p.County.map(lambda x: n2f[norm(x)]); p = p.set_index("fips")
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=r["Adam Hamilton"] / r.dem_total,
                             candR=r["Roger Marshall"] / r.rep_total)
        return pd.DataFrame(out).T, "county results via civicAPI: Aug 4 2026 R (84841) and D (84840) Senate primaries"
    if st == "AK":
        # civicAPI race 86863, Aug 18 2026 top four open primary, borough and census area results (all 16 candidates)
        p = pd.read_csv(f"{PKG['AK']}/ak_primary_2026_borough.csv", dtype={"fips": str}).set_index("fips")
        dc = [c for c in p if c.endswith("_D")]; rc = [c for c in p if c.endswith("_R")]
        for fips in county_list(st):
            r = p.loc[fips]; pD = r[dc].sum(); pR = r[rc].sum()
            out[fips] = dict(pD=float(pD), pR=float(pR), candD=r.Peltola_D / pD, candR=r.DanS_Sullivan_R / pR,
                             danj_primary=r.DanJ_Sullivan_R / r.total, heikes_primary=r.Heikes_R / r.total)
        return pd.DataFrame(out).T, "borough results via civicAPI: Aug 18 2026 top four open primary (race 86863)"
    if st in ("NMG", "ARG", "ILG"):
        # no civicAPI page for these governor primaries. AR and IL share a primary ballot with the Senate race, so the party
        # structure term uses those same day Senate primary county totals; NM uses the June 2 Senate D primary and the 2022
        # governor Republican county vote. Candidate terms are neutral at 0.5.
        if st == "ARG":
            p = pd.read_csv(f"{PKG['AR']}/ar_primary_2026_county.csv"); p.index = p.County.map(lambda x: n2f[norm(x)])
            get = lambda f: (float(p.loc[f, "dem_total"]), float(p.loc[f, "rep_total"]))
            note = "no county file for the March 3 2026 governor primaries: same day Senate primary county turnout used for the party term"
        elif st == "ILG":
            p = pd.read_csv(f"{PKG['IL']}/il_primary_2026_county.csv"); p.index = p.County.map(lambda x: n2f[norm(x)])
            get = lambda f: (float(p.loc[f, "D_total"]), float(p.loc[f, "R_total"]))
            note = "no county file for the March 17 2026 governor primaries: same day Senate primary county turnout used for the party term"
        else:
            d = pd.read_csv(f"{PKG['NM']}/d_primary.csv"); d.index = d.County.map(lambda x: n2f[norm(x)])
            g = pd.read_csv(f"{PKG['NMG']}/nm_gov2022_county.csv", dtype={"fips": str}).set_index("fips")
            get = lambda f: (float(d.loc[f].iloc[1:].sum()), float(g.loc[f, "R"]))
            note = "no county file for the June 2 2026 governor primaries: June 2 Senate Democratic primary turnout and the 2022 governor Republican county vote used for the party term"
        for fips in county_list(st):
            pD, pR = get(fips)
            out[fips] = dict(pD=pD, pR=pR, candD=0.5, candR=0.5)
        return pd.DataFrame(out).T, note
    if st in ("MEG", "CTG", "RIG", "MAG", "MDG"):
        # no county primary file for any of these five governor primaries: the party structure term is proxied by the 2022
        # governor county vote and the candidate term is neutral at 0.5
        g = pd.read_csv(f"{PKG[st]}/{GOV_PRE[st]}_gov2022_county.csv", dtype={"fips": str}).set_index("fips")
        for fips in county_list(st):
            out[fips] = dict(pD=float(g.loc[fips, "D"]), pR=float(g.loc[fips, "R"]), candD=0.5, candR=0.5)
        return pd.DataFrame(out).T, "no county primary file: 2022 governor county vote used for the party term"
    if st in ("AKG", "HIG"):
        # no civicAPI page for either 2026 governor primary: the party structure term is proxied by the 2022 governor
        # county / borough vote and the candidate term is neutral at 0.5
        if st == "AKG":
            g = pd.read_csv(f"{PKG['AKG']}/ak_gov2022_borough.csv", dtype={"fips": str}).set_index("fips")
            note = "no county primary file: 2022 governor borough vote used for the party term (Aug 18 2026 statewide results from the Division of Elections)"
        else:
            g = pd.read_csv(f"{PKG['HIG']}/hi_gov2022_county.csv", dtype={"fips": str}).set_index("fips")
            note = "no county primary file: 2022 governor county vote used for the party term (Aug 8 2026 statewide results from the Office of Elections)"
        for fips in county_list(st):
            out[fips] = dict(pD=float(g.loc[fips, "D"]), pR=float(g.loc[fips, "R"]), candD=0.5, candR=0.5)
        return pd.DataFrame(out).T, note
    if st == "NE":
        # civicAPI county results, May 12 2026: R Senate primary (74896) and D Senate primary (74894)
        p = pd.read_csv(f"{PKG['NE']}/ne_primary_2026_county.csv")
        p["fips"] = p.county.map(lambda x: n2f[norm(x)]); p = p.set_index("fips")
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.dem_total), pR=float(r.rep_total), candD=1.0, candR=r.ricketts / r.rep_total)
        return pd.DataFrame(out).T, "county results via civicAPI: May 12 2026 R and D Senate primaries"
    if st == "SC":
        # civicAPI county results: Jun 9 R Senate primary (82664), Jun 9 D governor primary (82595) as the Democratic
        # primary turnout measure, Aug 11 special R primary (86330) and Aug 25 special R runoff (87534)
        p = pd.read_csv(f"{PKG['SC']}/sc_primary_2026_county.csv")
        p["fips"] = p.county.map(lambda x: n2f[norm(x)]); p = p.set_index("fips")
        for fips in county_list(st):
            r = p.loc[fips]
            first = r.special_primary_graham / r.special_primary_total; runoff = r.runoff_graham / r.runoff_total
            out[fips] = dict(pD=float(r.dem_governor_primary_jun9), pR=float(r.rep_senate_primary_jun9), candD=1.0,
                             candR=0.5 * first + 0.5 * runoff, graham_first=first, graham_runoff=runoff)
        return pd.DataFrame(out).T, "county results via civicAPI: Jun 9 primaries, Aug 11 special primary, Aug 25 runoff"
    if st == "NC":
        # NCSBE ENR county results, March 3 2026: contest 2147 (DEM) and 2149 (REP); reconciles to Cooper 761,345 of 827,755 and Whatley 405,140 of 627,404
        p = pd.read_csv(f"{PKG['NC']}/nc_primary_2026_county.csv", dtype={"fips": str}).set_index("fips")
        for fips in county_list(st):
            r = p.loc[fips]
            out[fips] = dict(pD=float(r.D), pR=float(r.R), candD=r.C / r.D, candR=r.W / r.R)
        return pd.DataFrame(out).T, "county official results, NCSBE March 3 2026 primary"
    if st == "GA":
        # official Georgia SOS "Total Votes Excel" county results: May 19 primary and June 16 Republican runoff
        n2f = name_to_fips(st)
        def county_sheet(path):
            d = pd.read_excel(path, sheet_name="County Results")
            d = d[d["Office Name"].str.startswith("US Senate") & ~d["Ballot Name"].isin(["Total Votes", "Ballots Cast"])].copy()
            d["fips"] = d.County.str.replace(" County", "", regex=False).map(lambda x: n2f[norm(x)])
            return d
        p = county_sheet(f"{PKG['GA']}/primary_0519.xlsx"); ro = county_sheet(f"{PKG['GA']}/runoff_0616.xlsx")
        for fips in county_list(st):
            dem = p[(p.fips == fips) & (p["Office Name"] == "US Senate - Dem")]
            rep = p[(p.fips == fips) & (p["Office Name"] == "US Senate - Rep")]
            run = ro[ro.fips == fips]
            first = rep[rep["Ballot Name"] == "Mike Collins"].Total.sum() / max(rep.Total.sum(), 1)
            runoff = run[run["Ballot Name"] == "Mike Collins"].Total.sum() / max(run.Total.sum(), 1)
            out[fips] = dict(pD=float(dem.Total.sum()), pR=float(rep.Total.sum()),
                             candD=1.0,  # Ossoff unopposed
                             candR=0.5 * first + 0.5 * runoff, collins_first=first, collins_runoff=runoff)
        return pd.DataFrame(out).T, "county official results, GA SOS May 19 primary and June 16 runoff (Collins strength = mean of first round and runoff share)"
    # IA: county primary file not available to this run; statewide results used, no county structure
    rows = {f: dict(pD=191950.0, pR=206255.0, candD=120287 / 191950, candR=153059 / 206255) for f in county_list(st)}
    return pd.DataFrame(rows).T, "STATEWIDE ONLY: county primary results unavailable, county structure term neutral"

# ── history ──────────────────────────────────────────────────────────────────
JUNK = re.compile(r"total|under|over|registered|ballots|cast votes|absentee|election_day|rejected|unresolved|^dem$|^rep$|write-?ins?$", re.I)

def tally(df, cand_col, vote_col, county_col, dpat, rpat, st, allow_o=True):
    n2f = name_to_fips(st)
    df = df.copy()
    df["v"] = pd.to_numeric(df[vote_col].astype(str).str.replace(r"[ ,]", "", regex=True), errors="coerce").fillna(0)
    c = df[cand_col].astype(str)
    df["p"] = np.where(c.str.contains(dpat, case=False, regex=True), "D",
              np.where(c.str.contains(rpat, case=False, regex=True), "R",
              np.where(c.str.contains(JUNK), "X", "O")))
    df = df[df.p != "X"]
    df["fips"] = df[county_col].map(lambda x: n2f.get(norm(x)))
    g = df.dropna(subset=["fips"]).pivot_table(index="fips", columns="p", values="v", aggfunc="sum").fillna(0)
    for k in "DRO":
        if k not in g: g[k] = 0.0
    return g[["D", "R", "O"]]

def medsl(path, office, st):
    d = pd.read_csv(path, low_memory=False); d = d[(d.office == office) & (d.stage == "GEN")]
    # use TOTAL mode rows where a county reports them, otherwise sum modes
    d = d[~d.candidate.astype(str).str.upper().str.contains(r"BALLOTS CAST|CAST VOTES|OVERVOTE|UNDERVOTE|REJECTED|UNRESOLVED|UNASSIGNED|UNQUALIFIED|^TOTAL$")]
    d["pk"] = d.county_fips.astype(str) + "|" + d.precinct.astype(str)
    has_total = set(d[d["mode"] == "TOTAL"].pk)
    d = d[(d["mode"] == "TOTAL") | ~d.pk.isin(has_total)]
    d["f"] = d.county_fips.astype(int).astype(str).str.zfill(5)
    d["p"] = np.where(d.party_simplified == "DEMOCRAT", "D", np.where(d.party_simplified == "REPUBLICAN", "R", "O"))
    g = d.pivot_table(index="f", columns="p", values="votes", aggfunc="sum").fillna(0)
    for k in "DRO":
        if k not in g: g[k] = 0.0
    return g[["D", "R", "O"]]

def fill_missing(g, st, pres_year):
    """counties missing or clearly incomplete use presidential two party share shifted by the covered county Senate minus President gap"""
    P = {2020: P20, 2016: P16, 2024: P24}.get(pres_year, P20)
    fl = county_list(st); pr = P.reindex(fl)
    tp = (g.D + g.R).reindex(fl)
    ratio = tp / (pr.votes_dem + pr.votes_gop)
    ok = tp.notna() & (ratio > 0.6 * ratio.median())
    cov = g.reindex(fl)[ok]
    gap = logit(cov.D.sum() / (cov.D + cov.R).sum()) - logit(pr[ok].votes_dem.sum() / (pr[ok].votes_dem + pr[ok].votes_gop).sum())
    out = g.reindex(fl).astype(float).copy()
    osh = (cov.O.sum() / (cov.D + cov.R + cov.O).sum())
    for f in [f for f in fl if not ok[f]]:
        tot2 = pr.loc[f, "votes_dem"] + pr.loc[f, "votes_gop"]
        d2 = inv(logit(pr.loc[f, "votes_dem"] / tot2) + gap)
        out.loc[f] = [d2 * tot2, (1 - d2) * tot2, osh / (1 - osh) * tot2]
    return out, int((~ok).sum())

def history(st):
    S = {}
    if st == "IA":
        d = pd.read_csv(f"{H}/20201103__ia__general__precinct.csv"); d = d[d.office == "U.S. Senate"]
        S[2020] = tally(d, "candidate", "votes", "county", "Greenfield", "Ernst", st)
        d = pd.read_csv(f"{H}/20141104__ia__general__precinct.csv"); d = d[(d.office == "U.S. Senate") & d.precinct.isna()]
        S[2014] = tally(d, "candidate", "votes", "county", "Braley", "Ernst", st)
        d = pd.read_csv(f"{H}/20081104__ia__general__county.csv"); d = d[d.office == "U.S. Senate"]
        S[2008] = tally(d, "candidate", "votes", "county", "HARKIN", "REED", st)
        years = [2020, 2014, 2008]; pres_year = {2020: 2020, 2014: 2016, 2008: 2016}
    elif st == "MI":
        a = pd.read_csv(f"{H}/20201103__mi__general__county.csv", dtype=str); a = a[a.office == "U.S. Senate"]
        b = pd.read_csv(f"{H}/20201103__mi__general__precinct.csv", dtype=str); b = b[b.office == "U.S. Senate"]
        ga = tally(a, "candidate", "votes", "county", "Peters", "John James", st)
        gb = tally(b, "candidate", "votes", "county", "Peters", "John James", st)
        g = ga.reindex(ga.index.union(gb.index)).fillna(0)
        for f in gb.index:
            if f not in ga.index or (gb.loc[f, ["D", "R"]].sum() > ga.loc[f, ["D", "R"]].sum()):
                g.loc[f] = gb.loc[f]
        S[2020] = g
        d = pd.read_csv(f"{H}/20141104__mi__general__precinct.csv", dtype=str); d = d[d.office == "U.S. Senate"]
        S[2014] = tally(d, "candidate", "votes", "county", "Gary Peters", "Terri Lynn Land", st)
        d = pd.read_csv(f"{H}/20081104__mi__general__precinct.csv", dtype=str); d = d[d.office == "U.S. Senate"]
        S[2008] = tally(d, "candidate", "votes", "county", "Carl Levin", "Hoogendyk", st)
        years = [2020, 2014, 2008]; pres_year = {2020: 2020, 2014: 2016, 2008: 2016}
    elif st == "TX":
        d = pd.read_csv(f"{H}/20201103__tx__general__precinct.csv", usecols=["county", "office", "party", "candidate", "votes"], low_memory=False)
        d = d[d.office == "U.S. Senate"]
        S[2020] = tally(d, "candidate", "votes", "county", "Hegar", "Cornyn", st)
        d = pd.read_csv(f"{H}/20181106__tx__general__county.csv"); d = d[d.office == "U.S. Senate"]
        S[2018] = tally(d, "candidate", "votes", "county", "O'Rourke", "Cruz", st)  # substitute: 2014 county file unavailable
        # the OpenElections 2018 county file carries El Paso's totals on the Ellis row and Ellis's on the El Paso row
        S[2018].loc[["48139", "48141"]] = S[2018].loc[["48141", "48139"]].values
        d = pd.read_csv(f"{H}/20081104__tx__general__county.csv"); d = d[d.office == "U.S. Senate"]
        S[2008] = tally(d, "candidate", "votes", "county", "Noriega", "Cornyn", st)
        years = [2020, 2018, 2008]; pres_year = {2020: 2020, 2018: 2020, 2008: 2016}
    elif st == "IDG":
        n2f = name_to_fips(st)
        S[2022] = pd.read_csv(f"{PKG['IDG']}/id_gov2022_fips.csv", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)  # Heidt vs Little, Bundy other, MEDSL
        def rd(n):
            d = pd.read_csv(f"{PKG['IDG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2018] = rd("id_gov2018_county.csv")   # Jordan (D) vs Little (R), OpenElections county file
        S[2014] = rd("id_gov2014_county.csv")   # Balukoff (D) vs Otter (R), OpenElections county file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st in GOV_PRE:
        pre = GOV_PRE[st]
        rd = lambda y: pd.read_csv(f"{PKG[st]}/{pre}_gov{y}_county.csv", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)
        S[2022] = rd(2022); S[2018] = rd(2018); S[2014] = rd(2014)
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "AKG":
        rd = lambda n: pd.read_csv(f"{PKG['AKG']}/ak_{n}_borough.csv", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)
        S[2022] = rd("gov2022")   # Gara (D) and Walker (I) pooled against Dunleavy and Pierce (R), MEDSL precinct file
        S[2018] = pd.read_csv(f"{PKG['AK']}/ak_gov2018_borough.csv", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)  # Begich (D) vs Dunleavy (R)
        S[2014] = rd("gov2014")   # Walker / Mallott unity ticket in the D column vs Parnell (R), OpenElections
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "HIG":
        rd = lambda n: pd.read_csv(f"{PKG['HIG']}/hi_{n}_county.csv", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)
        S[2022] = rd("gov2022")   # Green (D) vs Aiona (R), MEDSL precinct file
        S[2018] = rd("gov2018")   # Ige (D) vs Tupola (R), OpenElections precinct file
        S[2014] = rd("gov2014")   # Ige (D) vs Aiona (R) with Hannemann (I) in the other column, OpenElections
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "WYG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['WYG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("wy_gov2022_county.csv")   # Livingston (D) vs Gordon (R)
        S[2018] = rd("wy_gov2018_county.csv")   # Throne (D) vs Gordon (R)
        S[2014] = rd("wy_gov2014_county.csv")   # Gosar (D) vs Mead (R)
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "SCG":
        n2f = name_to_fips(st)
        rf = lambda n: pd.read_csv(f"{PKG['SCG']}/{n}", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)
        S[2022] = rf("sc_gov2022_fips.csv")   # Cunningham (D) vs McMaster (R), MEDSL
        S[2018] = rf("sc_gov2018_fips.csv")   # Smith (D) vs McMaster (R), MEDSL
        d = pd.read_csv(f"{PKG['SCG']}/sc_gov2014_county.csv"); d.index = d.county.map(lambda x: n2f[norm(x)])
        S[2014] = d[["D", "R", "O"]].astype(float)   # Sheheen (D) vs Haley (R), OpenElections county precinct files
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "MNG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['MNG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("mn_gov2022_county.csv")   # Walz (DFL) vs Jensen (R), OpenElections precinct file
        S[2018] = rd("mn_gov2018_county.csv")   # Walz (DFL) vs Johnson (R), OpenElections county file
        S[2014] = rd("mn_gov2014_county.csv")   # Dayton (DFL) vs Johnson (R), OpenElections county file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "TNG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['TNG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("tn_gov2022_county.csv")   # Martin (D) vs Lee (R), OpenElections county file
        S[2018] = rd("tn_gov2018_county.csv")   # Dean (D) vs Lee (R), OpenElections county file
        S[2014] = rd("tn_gov2014_county.csv")   # Brown (D) vs Haslam (R), OpenElections county file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "NHG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['NHG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2024] = rd("nh_gov2024_county.csv")   # Craig (D) vs Ayotte (R), OpenElections precinct file
        S[2022] = rd("nh_gov2022_county.csv")   # Sherman (D) vs Sununu (R), OpenElections precinct file
        S[2020] = rd("nh_gov2020_county.csv")   # Feltes (D) vs Sununu (R), OpenElections precinct file, repeated levels removed
        years = [2024, 2022, 2020]
        return S, years, {2024: 0, 2022: 0, 2020: 0}
    elif st == "COG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['COG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("co_gov2022_county.csv")   # Polis (D) vs Ganahl (R), OpenElections precinct file
        S[2018] = rd("co_gov2018_county.csv")   # Polis (D) vs Stapleton (R), OpenElections county file
        S[2014] = rd("co_gov2014_county.csv")   # Hickenlooper (D) vs Beauprez (R), OpenElections county file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "VTG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['VTG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("vt_gov2022_county.csv")   # Siegel (D) vs Scott (R), MEDSL
        S[2018] = rd("vt_gov2018_county.csv")   # Hallquist (D) vs Scott (R), OpenElections precinct file
        S[2014] = rd("vt_gov2014_county.csv")   # Shumlin (D) vs Milne (R), OpenElections town file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "SDG":
        n2f = name_to_fips(st)
        rf = lambda n: pd.read_csv(f"{PKG['SDG']}/{n}", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)
        S[2022] = rf("sd_gov2022_fips.csv")   # Smith (D) vs Noem (R), MEDSL
        S[2018] = rf("sd_gov2018_fips.csv")   # Sutton (D) vs Noem (R), MEDSL
        d = pd.read_csv(f"{PKG['SDG']}/sd_gov2014_county.csv"); d.index = d.county.map(lambda x: n2f[norm(x)])
        S[2014] = d[["D", "R", "O"]].astype(float)   # Wismer (D) vs Daugaard (R), OpenElections county file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "ALG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['ALG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = pd.read_csv(f"{PKG['ALG']}/al_gov2022_fips.csv", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)  # Flowers vs Ivey, MEDSL
        S[2018] = rd("al_gov2018_county.csv")   # Maddox (D) vs Ivey (R), OpenElections precinct file
        S[2014] = rd("al_gov2014_county.csv")   # Griffith (D) vs Bentley (R), OpenElections precinct file, aggregate rows removed
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "OKG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['OKG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = pd.read_csv(f"{PKG['OKG']}/ok_gov2022_fips.csv", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)  # Hofmeister vs Stitt, MEDSL
        S[2018] = rd("ok_gov2018_county.csv")   # Edmondson (D) vs Stitt (R), OpenElections county file
        S[2014] = rd("ok_gov2014_county.csv")   # Dorman (D) vs Fallin (R), OpenElections precinct file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "NEG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['NEG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = pd.read_csv(f"{PKG['NEG']}/ne_gov2022_fips.csv", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)  # Blood vs Pillen, MEDSL
        S[2018] = rd("ne_gov2018_county.csv")   # Krist (D) vs Ricketts (R), OpenElections precinct file
        S[2014] = rd("ne_gov2014_county.csv")   # Hassebrook (D) vs Ricketts (R), OpenElections precinct file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "KSG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['KSG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("ks_gov2022_county.csv")   # Kelly (D) vs Schmidt (R)
        S[2018] = rd("ks_gov2018_county.csv")   # Kelly (D) vs Kobach (R), Orman (I) as other, OpenElections precinct file
        S[2014] = rd("ks_gov2014_county.csv")   # Davis (D) vs Brownback (R), certified county table
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "ORG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['ORG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("or_gov2022_county.csv")   # Kotek (D) vs Drazan (R) vs Johnson (I), OpenElections precinct file
        S[2018] = rd("or_gov2018_county.csv")   # Brown (D) vs Buehler (R), OpenElections county file
        S[2014] = rd("or_gov2014_county.csv")   # Kitzhaber (D) vs Richardson (R), OpenElections county file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "CAG":
        n2f = name_to_fips(st)
        def rf(n):
            return pd.read_csv(f"{PKG['CAG']}/{n}", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)
        S[2022] = rf("ca_gov2022_fips.csv")   # Newsom (D) vs Dahle (R), MEDSL
        S[2018] = rf("ca_gov2018_fips.csv")   # Newsom (D) vs Cox (R), MEDSL
        d = pd.read_csv(f"{PKG['CAG']}/ca_gov2014_county.csv"); d.index = d.county.map(lambda x: n2f[norm(x)])
        S[2014] = d[["D", "R", "O"]].astype(float)   # Brown (D) vs Kashkari (R), OpenElections county file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "NVG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['NVG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("nv_gov2022_county.csv")   # Sisolak (D) vs Lombardo (R), OpenElections precinct file
        S[2018] = rd("nv_gov2018_county.csv")   # Sisolak (D) vs Laxalt (R), OpenElections precinct file
        S[2014] = rd("nv_gov2014_county.csv")   # Goodman (D) vs Sandoval (R), OpenElections precinct file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "AZG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['AZG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("az_gov2022_county.csv")   # Hobbs (D) vs Lake (R), OpenElections precinct file
        S[2018] = rd("az_gov2018_county.csv")   # Garcia (D) vs Ducey (R), OpenElections precinct file
        S[2014] = rd("az_gov2014_county.csv")   # DuVal (D) vs Ducey (R), OpenElections county file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "PAG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['PAG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = pd.read_csv(f"{PKG['PAG']}/pa_gov2022_fips.csv", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)  # Shapiro vs Mastriano, MEDSL
        S[2018] = rd("pa_gov2018_county.csv")   # Wolf (D) vs Wagner (R), OpenElections county file
        S[2014] = rd("pa_gov2014_county.csv")   # Wolf (D) vs Corbett (R), OpenElections county file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "NYG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['NYG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("ny_gov2022_county.csv")   # Hochul (D) vs Zeldin (R), OpenElections precinct file, fusion lines summed
        S[2018] = rd("ny_gov2018_county.csv")   # Cuomo (D) vs Molinaro (R), OpenElections precinct file, 6 county rows certified
        S[2014] = rd("ny_gov2014_county.csv")   # Cuomo (D) vs Astorino (R), OpenElections county file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "MIG":
        def rd(n):
            return pd.read_csv(f"{PKG['MIG']}/{n}", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)
        S[2022] = rd("mi_gov2022_fips.csv")   # Whitmer (D) vs Dixon (R), OpenElections county file
        S[2018] = rd("mi_gov2018_fips.csv")   # Whitmer (D) vs Schuette (R), OpenElections precinct file
        S[2014] = rd("mi_gov2014_fips.csv")   # Schauer (D) vs Snyder (R), OpenElections precinct file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "WIG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['WIG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("wi_gov2022_county.csv")   # Evers (D) vs Michels (R), OpenElections ward file
        S[2018] = rd("wi_gov2018_county.csv")   # Evers (D) vs Walker (R), OpenElections ward file
        S[2014] = rd("wi_gov2014_county.csv")   # Burke (D) vs Walker (R), OpenElections ward file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "GAG":
        def rd(n):
            return pd.read_csv(f"{PKG['GAG']}/{n}", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)
        S[2022] = rd("ga_gov2022_fips.csv")   # Abrams (D) vs Kemp (R), MEDSL
        S[2018] = rd("ga_gov2018_fips.csv")   # Abrams (D) vs Kemp (R), MEDSL
        S[2014] = rd("ga_gov2014_fips.csv")   # Carter (D) vs Deal (R), OpenElections county level file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "OHG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['OHG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("oh_gov2022_county.csv")   # Whaley (D) vs DeWine (R), MEDSL precinct file
        S[2018] = rd("oh_gov2018_county.csv")   # Cordray (D) vs DeWine (R), OpenElections precinct file
        S[2014] = rd("oh_gov2014_county.csv")   # FitzGerald (D) vs Kasich (R), OpenElections precinct file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "IAG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['IAG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("ia_gov2022_county.csv")   # DeJear (D) vs Reynolds (R), MEDSL precinct file
        S[2018] = rd("ia_gov2018_county.csv")   # Hubbell (D) vs Reynolds (R), OpenElections county file
        S[2014] = rd("ia_gov2014_county.csv")   # Hatch (D) vs Branstad (R), OpenElections precinct rows
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "TXG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['TXG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("tx_gov2022_county.csv")   # O'Rourke (D) vs Abbott (R), MEDSL precinct file
        S[2018] = rd("tx_gov2018_county.csv")   # Valdez (D) vs Abbott (R), OpenElections county file
        S[2014] = rd("tx_gov2014_county.csv")   # Davis (D) vs Abbott (R), OpenElections county file
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "FLG":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['FLG']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("fl_gov2022_county.csv")   # Crist (D) vs DeSantis (R), MEDSL precinct file
        S[2018] = rd("fl_gov2018_county.csv")   # Gillum (D) vs DeSantis (R), OpenElections precinct file
        S[2014] = rd("fl_gov2014_county.csv")   # Crist (D) vs Scott (R), Wyllie (L) in Other, Florida Division of Elections county report
        years = [2022, 2018, 2014]
        return S, years, {2022: 0, 2018: 0, 2014: 0}
    elif st == "MA":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['MA']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("ma_sen2020_county.csv")   # Markey (D) vs O'Connor (R), OpenElections precinct file summed to counties
        S[2014] = rd("ma_sen2014_county.csv")   # Markey (D) vs Herr (R), OpenElections precinct file summed to counties
        S[2008] = rd("ma_sen2008_county.csv")   # Kerry (D) vs Beatty (R), Underwood (L) in Other, OpenElections precinct file summed to counties
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "RI":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['RI']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("ri_sen2020_county.csv")   # Reed (D) vs Waters (R), OpenElections town file aggregated to counties
        S[2014] = rd("ri_sen2014_county.csv")   # Reed (D) vs Zaccaria (R), OpenElections town file aggregated to counties
        S[2008] = rd("ri_sen2008_county.csv")   # Reed (D) vs Tingle (R), OpenElections town file with county column
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "DE":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['DE']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("de_sen2020_county.csv")   # Coons (D) vs Witzke (R), OpenElections county file
        S[2014] = rd("de_sen2014_county.csv")   # Coons (D) vs Wade (R), OpenElections precinct file, statewide total rows removed
        S[2008] = rd("de_sen2008_county.csv")   # Biden (D) vs O'Donnell (R), OpenElections precinct file, statewide total rows removed
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "WV":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['WV']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("wv_sen2020_county.csv")   # Swearengin (D) vs Capito (R), OpenElections county file, statewide row removed
        S[2014] = rd("wv_sen2014_county.csv")   # Tennant (D) vs Capito (R), OpenElections county file
        # Rockefeller (D) vs Wolfe (R): OpenElections 2008 precinct files cover 49 counties; missing or incomplete counties use the 2020
        # presidential share shifted by the covered county Senate minus President gap
        S[2008], n08 = fill_missing(rd("wv_sen2008_county.csv"), st, 2020)
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: n08}
    elif st == "IL":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['IL']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("il_sen2020_county.csv")   # Durbin (D) vs Curran (R), Wilson (I) in Other, OpenElections precinct file, city authorities merged
        S[2014] = rd("il_sen2014_county.csv")   # Durbin (D) vs Oberweis (R), OpenElections county file
        S[2008] = rd("il_sen2008_county.csv")   # Durbin (D) vs Sauerberg (R), OpenElections county file
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "TN":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['TN']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("tn_sen2020_county.csv")   # Bradshaw (D) vs Hagerty (R), OpenElections county file
        S[2014] = rd("tn_sen2014_county.csv")   # Ball (D) vs Alexander (R), OpenElections county file
        S[2008] = rd("tn_sen2008_county.csv")   # Tuke (D) vs Alexander (R), OpenElections county file
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "AL":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['AL']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("al_sen2020_county.csv")   # Jones (D) vs Tuberville (R), OpenElections precinct file
        S[2016] = rd("al_sen2016_county.csv")   # Crumpton (D) vs Shelby (R), substitute: Sessions ran unopposed in 2014
        S[2017] = rd("al_sen2017_county.csv")   # Jones (D) vs Roy Moore (R) special for this seat, substitute: no 2008 county file available
        years = [2020, 2016, 2017]
        return S, years, {2020: 0, 2016: 0, 2017: 0}
    elif st == "NJ":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['NJ']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("nj_sen2020_county.csv")   # Booker (D) vs Mehta (R), Wikipedia county table, sums match certified totals
        S[2014] = rd("nj_sen2014_county.csv")   # Booker (D) vs Bell (R), OpenElections county file
        S[2008] = rd("nj_sen2008_county.csv")   # Lautenberg (D) vs Zimmer (R), Wikipedia county table
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "OK":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['OK']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("ok_sen2020_county.csv")   # Broyles (D) vs Inhofe (R), Murphy (L), Farr and Nesbit in Other, OpenElections county file
        S[2014] = rd("ok_sen2014_county.csv")   # Silverstein (D) vs Inhofe (R), regular race only, OpenElections precinct file
        S[2008] = rd("ok_sen2008_county.csv")   # Rice (D) vs Inhofe (R), Wallace (I) in Other, OpenElections county file
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "NM":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['NM']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("nm_sen2020_county.csv")   # Lujan (D) vs Ronchetti (R), OpenElections precinct file, duplicate rows halved
        S[2014] = rd("nm_sen2014_county.csv")   # Udall (D) vs Weh (R), OpenElections precinct file
        S[2008] = rd("nm_sen2008_county.csv")   # Udall (D) vs Pearce (R), OpenElections county file
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "CO":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['CO']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("co_sen2020_county.csv")   # Hickenlooper (D) vs Gardner (R), OpenElections precinct file
        S[2014] = rd("co_sen2014_county.csv")   # Udall (D) vs Gardner (R), OpenElections county file
        S[2008] = rd("co_sen2008_county.csv")   # Udall (D) vs Schaffer (R), OpenElections precinct file
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "WY":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['WY']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("wy_sen2020_county.csv")   # Ben David (D) vs Lummis (R), OpenElections county file
        S[2014] = rd("wy_sen2014_county.csv")   # Hardy (D) vs Enzi (R), independent Gottshall in Other
        S[2008] = rd("wy_sen2008_county.csv")   # Rothfuss (D) vs Enzi (R), regular election for this seat
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "OR":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['OR']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("or_sen2020_county.csv")   # Merkley (D) vs Perkins (R), OpenElections precinct file
        S[2014] = rd("or_sen2014_county.csv")   # Merkley (D) vs Wehby (R), OpenElections county file
        S[2008] = rd("or_sen2008_county.csv")   # Merkley (D) vs Gordon Smith (R), OpenElections county file
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "KY":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['KY']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2016] = rd("ky_sen2016_county.csv")   # substitute for 2020 (no county file reachable): Gray (D) vs Paul (R), OpenElections
        S[2014] = rd("ky_sen2014_county.csv")   # Grimes (D) vs McConnell (R), OpenElections county precinct files
        S[2008] = rd("ky_sen2008_county.csv")   # Lunsford (D) vs McConnell (R), Wikipedia county table
        years = [2016, 2014, 2008]
        return S, years, {2016: 0, 2014: 0, 2008: 0}
    elif st == "AR":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['AR']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        # 2020 (Cotton vs Libertarian Harrington, no Democrat) and 2008 (Pryor vs Green Kennedy, no Republican) had no two party race
        S[2022] = rd("sen2022.csv")             # substitute for 2020: James (D) vs Boozman (R), Wikipedia county table
        S[2014] = rd("ar_sen2014_county.csv")   # Pryor (D) vs Cotton (R), OpenElections; Arkansas County derived from certified totals
        S[2016] = rd("ar_sen2016_county.csv")   # substitute for 2008: Eldridge (D) vs Boozman (R), OpenElections
        years = [2022, 2014, 2016]
        return S, years, {2022: 0, 2014: 0, 2016: 0}
    elif st == "LA":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['LA']}/{n}"); d.index = d.parish.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("la_sen2020_parish.csv")   # jungle general: all Democrats (Perkins, Edwards, ...) vs all Republicans (Cassidy, Murphy)
        S[2014] = rd("la_sen2014_parish.csv")   # Dec 6 runoff, Landrieu (D) vs Cassidy (R)
        S[2008] = rd("la_sen2008_parish.csv")   # Landrieu (D) vs Kennedy (R)
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "MS":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['MS']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("ms_sen2020_county.csv")   # Espy (D) vs Hyde-Smith (R), OpenElections county file
        S[2014] = rd("ms_sen2014_county.csv")   # Childers (D) vs Cochran (R), OpenElections, state total rows removed
        S[2008] = rd("ms_sen2008_county.csv")   # Fleming (D) vs Cochran (R), OpenElections, special election rows removed
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "MN":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['MN']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("mn_sen2020_county.csv")    # Smith (DFL) vs Lewis (R), OpenElections precinct file
        S[2014] = rd("mn_sen2014_county.csv")    # Franken (DFL) vs McFadden (R), OpenElections county file
        S[2018] = rd("mn_sen2018s_county.csv")   # substitute for 2008: 2018 special for this seat, Smith (DFL) vs Housley (R)
        years = [2020, 2014, 2018]
        return S, years, {2020: 0, 2014: 0, 2018: 0}
    elif st == "VA":
        rd = lambda n: pd.read_csv(f"{PKG['VA']}/{n}", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)
        S[2020] = rd("va_sen2020_county.csv")   # Warner (D) vs Gade (R), Wikipedia locality table
        S[2014] = rd("va_sen2014_county.csv")   # Warner (D) vs Gillespie (R), Sarvis (L) in Other, Wikipedia
        S[2024] = rd("va_sen2024_county.csv")   # substitute for 2008: Kaine (D) vs Cao (R), Wikipedia locality table
        years = [2020, 2014, 2024]
        return S, years, {2020: 0, 2014: 0, 2024: 0}
    elif st == "MT":
        n2f = name_to_fips(st)
        def oe(path, dpat, rpat):
            d = pd.read_csv(f"{PKG['MT']}/{path}", dtype=str, low_memory=False); d = d[d.office.isin(["US Senate", "U.S. Senate"])].copy()   # State Senate rows excluded
            d = d[~d.county.astype(str).str.upper().str.contains("TOTAL")]
            d["v"] = pd.to_numeric(d.votes.str.replace(",", ""), errors="coerce").fillna(0)
            d["p"] = d.candidate.map(lambda c: "D" if dpat in str(c) else "R" if rpat in str(c) else "O")
            g = d.pivot_table(index=d.county.map(lambda x: n2f[norm(re.sub(r",? MT$", "", str(x).replace("&", "and").strip()))]), columns="p", values="v", aggfunc="sum").fillna(0)
            return g.reindex(columns=["D", "R", "O"], fill_value=0.0).astype(float)
        S[2020] = oe("oe/2020/20201103__mt__general__county.csv", "Bullock", "Daines")   # OpenElections county file
        S[2014] = oe("oe/2014/20141104__mt__general__county.csv", "Curtis", "Daines")
        S[2008] = oe("oe/2008/20081104__mt__general__county.csv", "Baucus", "Kelleher")
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "ID":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['ID']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("sen2020.csv")             # Jordan (D) vs Risch (R), Wikipedia county table
        S[2014] = rd("id_sen2014_county.csv")   # Mitchell (D) vs Risch (R), OpenElections county file
        S[2008] = rd("id_sen2008_county.csv")   # LaRocco (D) vs Risch (R), Rammell (I) and others in Other, OpenElections
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "SD":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['SD']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("sen2022.csv")            # Bengs (D) vs Thune (R), substitute for 2008, Wikipedia county table
        S[2020] = rd("sen2020.csv")            # Ahlers (D) vs Rounds (R), Wikipedia county table
        S[2014] = rd("sd_sen2014_county.csv")  # Weiland (D) vs Rounds (R), Pressler (I) and Howie (I) in Other, Wikipedia
        years = [2022, 2020, 2014]
        return S, years, {2022: 0, 2020: 0, 2014: 0}
    elif st == "FL":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['FL']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2022] = rd("fl_sen2022_county.csv")   # Demings (D) vs Rubio (R), class 3, Wikipedia county table
        S[2018] = rd("fl_sen2018_county.csv")   # substitute for 2010: Nelson (D) vs Scott (R), OpenElections precinct file
        S[2016] = rd("fl_sen2016_county.csv")   # Murphy (D) vs Rubio (R), class 3, NYT county scrape (Prooffreader election_2016_data)
        years = [2022, 2018, 2016]
        return S, years, {2022: 0, 2018: 0, 2016: 0}
    elif st == "ME":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['ME']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("sen2020_county.csv")   # Gideon (D) vs Collins (R), OpenElections county Total rows, UOCAVA excluded
        S[2014] = rd("sen2014_county.csv")   # Bellows (D) vs Collins (R), Wikipedia county table
        S[2008] = rd("sen2008_county.csv")   # Allen (D) vs Collins (R), Wikipedia county table
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "NH":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['NH']}/{n}"); d.index = d.county.map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("nh_sen2020_county.csv")   # Shaheen (D) vs Messner (R), OpenElections
        S[2014] = rd("nh_sen2014_county.csv")   # Shaheen (D) vs Brown (R), OpenElections
        S[2008] = rd("sen2008_county.csv")      # Shaheen (D) vs John E. Sununu (R), Wikipedia county table
        years = [2020, 2014, 2008]
        return S, years, {2020: 0, 2014: 0, 2008: 0}
    elif st == "KS":
        n2f = name_to_fips(st)
        def rd(n):
            d = pd.read_csv(f"{PKG['KS']}/ks_{n}_county.csv"); d.index = d.iloc[:, 0].map(lambda x: n2f[norm(x)])
            return d[["D", "R", "O"]].astype(float)
        S[2020] = rd("sen2020")   # Bollier (D) vs Marshall (R), OpenElections county precinct files, three duplicated counties halved
        S[2016] = rd("sen2016")   # substitute for 2008: Wiesner (D) vs Moran (R), 2008 county file unavailable
        S[2014] = rd("sen2014")   # Orman (I) vs Roberts (R); Democratic nominee Taylor withdrew, Orman in the D column
        years = [2020, 2016, 2014]
        return S, years, {2020: 0, 2016: 0, 2014: 0}
    elif st == "AK":
        # OpenElections Alaska precinct files mapped to boroughs with the MGGG precinct shapefile (AK/build_history.py)
        rd = lambda n: pd.read_csv(f"{PKG['AK']}/ak_{n}_borough.csv", dtype={"fips": str}).set_index("fips")[["D", "R", "O"]].astype(float)
        S[2020] = rd("sen2020")   # Gross (I, Democratic nominee) vs Sullivan (R)
        S[2014] = rd("sen2014")   # Begich (D) vs Sullivan (R)
        S[2018] = rd("gov2018")   # substitute for 2008: Begich (D) vs Dunleavy (R) governor, 2008 borough data unavailable
        years = [2020, 2014, 2018]; pres_year = {}
        return S, years, {2020: 0, 2014: 0, 2018: 0}
    elif st == "NE":
        n2f = name_to_fips(st)
        def wiki(fn):
            rows = {}
            for l in open(f"{PKG['NE']}/{fn}"):
                c, r_, d_, o_ = l.strip().split("|")
                rows[n2f[norm(c)]] = dict(D=float(d_.replace(",", "")), R=float(r_.replace(",", "")), O=float(o_.replace(",", "")))
            return pd.DataFrame(rows).T[["D", "R", "O"]]
        S[2024] = wiki("sen2024.txt")   # Osborn (I) vs Fischer (R), Osborn in the D column
        S[2020] = wiki("sen2020.txt")   # Janicek (D) vs Sasse (R)
        d = pd.read_csv(f"{PKG['NE']}/20141104__ne__general__precinct.csv", low_memory=False); d = d[d.office == "U.S. Senate"]
        S[2014] = tally(d, "candidate", "votes", "county", "Domina", "Sasse", st)
        d = pd.read_csv(f"{PKG['NE']}/20081104__ne__general__precinct.csv", low_memory=False); d = d[d.office == "U.S. Senate"]
        S[2008] = tally(d, "candidate", "votes", "county", "Kleeb", "Johanns", st)
        years = [2024, 2020, 2014, 2008]; pres_year = {2024: 2024, 2020: 2020, 2014: 2016, 2008: 2016}
    elif st == "SC":
        d = pd.read_csv(f"{PKG['SC']}/20201103__sc__general__precinct.csv", low_memory=False); d = d[d.office == "U.S. Senate"]
        S[2020] = tally(d, "candidate", "votes", "county", "Harrison", "Lindsey Graham", st)
        S[2022] = medsl(f"{PKG['SC']}/med22/south_carolina_cleaned.csv", "US SENATE", st)  # substitute: 2014 county file unavailable
        d = pd.read_csv(f"{PKG['SC']}/20081104__sc__general__precinct.csv", low_memory=False); d = d[d.office == "U.S. Senate"]
        S[2008] = tally(d, "candidate", "votes", "county", "Conley", "Lindsey Graham", st)
        years = [2022, 2020, 2008]; pres_year = {2022: 2020, 2020: 2020, 2008: 2016}
    elif st == "NC":
        for y in (2020, 2014, 2008):
            d = pd.read_csv(f"{PKG['NC']}/nc_senate_{y}_county.csv", dtype={"fips": str}).set_index("fips")
            S[y] = d[["D", "R", "O"]].astype(float)
        years = [2020, 2014, 2008]; pres_year = {2020: 2020, 2014: 2016, 2008: 2016}
    elif st == "GA":
        G = PKG["GA"]
        d = pd.read_csv(f"{G}/ga20.csv", low_memory=False); d = d[d.office == "U.S. Senate"].copy()
        d["votes"] = d[["election_day_votes", "advanced_votes", "absentee_by_mail_votes", "provisional_votes"]].apply(pd.to_numeric, errors="coerce").sum(axis=1)
        S[2020] = tally(d, "candidate", "votes", "county", "Ossoff", "Perdue", st)
        d = pd.read_csv(f"{G}/ga16.csv", low_memory=False); d = d[d.office == "United States Senator"]
        S[2016] = tally(d, "candidate", "votes", "county", "Barksdale", "Isakson", st)  # substitute: 2014 county file unavailable
        d = pd.read_csv(f"{G}/ga08.csv", low_memory=False); d = d[d.office == "U.S. Senate"]
        S[2008] = tally(d, "candidate", "votes", "county", "Jim Martin", "Chambliss", st)
        years = [2020, 2016, 2008]; pres_year = {2020: 2020, 2016: 2016, 2008: 2016}
    else:  # OH: the special is for the class 3 seat. 2022 and 2016 class 3 races plus Brown's own 2018 race
        S[2022] = medsl(f"{H}/med_oh22/oh22_cleaned.csv", "US SENATE", st)
        d = pd.read_csv(f"{H}/20181106__oh__general__precinct.csv", low_memory=False); d = d[d.office == "U.S. Senate"]
        S[2018] = tally(d, "candidate", "votes", "county", "Sherrod Brown", "Renacci", st)
        d = pd.read_csv(f"{H}/20161108__oh__general__precinct.csv", low_memory=False); d = d[d.office == "U.S. Senate"]
        S[2016] = tally(d, "candidate", "votes", "county", "Strickland", "Portman", st)
        years = [2022, 2018, 2016]; pres_year = {2022: 2020, 2018: 2016, 2016: 2016}
    notes = {}
    for y in years:
        S[y], nfill = fill_missing(S[y], st, pres_year[y]); notes[y] = nfill
    return S, years, notes

def midterm_totals(st):
    if st == "ND":
        # 2022 at large House county totals, OpenElections, and the 2018 Senate statewide total
        g = pd.read_csv(f"{PKG['ND']}/nd_house2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), 326_138.0
    if st == "UT":
        # certified 2022 Senate statewide total; county split follows the 2024 presidential pattern, as for MO and IN
        g = pd.read_csv(f"{PKG['UT']}/ut_sen2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), 1_062_845.0
    if st in ("MO", "IN"):
        # 2022 Senate statewide totals are certified; no county level 2022 file is reachable for either state, so the
        # county split is the 2024 presidential pattern scaled to that total. Only the sums enter the district model.
        pre = {"MO": ("mo", 2_442_289.0), "IN": ("in", 2_270_174.0)}[st]
        g = pd.read_csv(f"{PKG[st]}/{pre[0]}_sen2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), pre[1]
    if st == "WA":
        # 2022 Senate county totals, Murray vs Smiley, and the 2018 Senate statewide total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['WA']}/wa_sen2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 3_086_168.0
    if st == "IDG":
        g = pd.read_csv(f"{PKG['IDG']}/id_gov2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), 605_131.0
    if st == "WYG":
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['WYG']}/wy_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 203_238.0
    if st in GOV_PRE:
        pre = GOV_PRE[st]
        g = pd.read_csv(f"{PKG[st]}/{pre}_gov2022_county.csv", dtype={"fips": str}).set_index("fips")
        t18 = pd.read_csv(f"{PKG[st]}/{pre}_gov2018_county.csv", dtype={"fips": str}).set_index("fips").sum().sum()
        return g.sum(axis=1).astype(float).reindex(county_list(st)), float(t18)
    if st == "AKG":
        g = pd.read_csv(f"{PKG['AKG']}/ak_gov2022_borough.csv", dtype={"fips": str}).set_index("fips")
        return g.sum(axis=1).astype(float).reindex(county_list(st)), float(AK_TOTALS["g18"])
    if st == "HIG":
        g = pd.read_csv(f"{PKG['HIG']}/hi_gov2022_county.csv", dtype={"fips": str}).set_index("fips")
        return g.sum(axis=1).astype(float).reindex(county_list(st)), 390_843.0
    if st == "SCG":
        # 2022 and 2018 governor totals, MEDSL
        g = pd.read_csv(f"{PKG['SCG']}/sc_gov2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), 1_707_569.0
    if st == "MNG":
        # 2022 and 2018 governor totals, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['MNG']}/mn_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 2_587_287.0
    if st == "TNG":
        # 2022 and 2018 governor totals, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['TNG']}/tn_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 2_243_294.0
    if st == "NHG":
        # 2022 governor county totals and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['NHG']}/nh_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 573_602.0
    if st == "COG":
        # 2022 and 2018 governor totals, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['COG']}/co_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 2_525_062.0
    if st == "VTG":
        # 2022 governor county totals, MEDSL, and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['VTG']}/vt_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 274_084.0
    if st == "SDG":
        # 2022 and 2018 governor totals, MEDSL
        g = pd.read_csv(f"{PKG['SDG']}/sd_gov2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), 338_715.0
    if st == "ALG":
        # 2022 governor county totals, MEDSL, and 2018 governor total, OpenElections
        g = pd.read_csv(f"{PKG['ALG']}/al_gov2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), 1_717_817.0
    if st == "OKG":
        # 2022 governor county totals, MEDSL, and 2018 governor total, OpenElections
        g = pd.read_csv(f"{PKG['OKG']}/ok_gov2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), 1_186_385.0
    if st == "NEG":
        # 2022 governor county totals, MEDSL, and 2018 governor total, OpenElections
        g = pd.read_csv(f"{PKG['NEG']}/ne_gov2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), 697_981.0
    if st == "KSG":
        # 2022 governor county totals and 2018 certified governor total
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['KSG']}/ks_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 1_056_147.0
    if st == "ORG":
        # 2022 and 2018 governor totals, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['ORG']}/or_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 1_799_558.0
    if st == "CAG":
        # 2022 governor county totals, MEDSL, and 2018 governor total, MEDSL
        g = pd.read_csv(f"{PKG['CAG']}/ca_gov2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), 12_464_235.0
    if st == "NVG":
        # 2022 governor county totals and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['NVG']}/nv_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 971_799.0
    if st == "AZG":
        # 2022 governor county totals and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['AZG']}/az_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 2_379_369.0
    if st == "PAG":
        # 2022 governor county totals, MEDSL, and 2018 governor total, OpenElections
        g = pd.read_csv(f"{PKG['PAG']}/pa_gov2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), 5_012_555.0
    if st == "NYG":
        # 2022 governor county totals, OpenElections, and 2018 certified governor total
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['NYG']}/ny_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 6_104_477.0
    if st == "MIG":
        # 2022 governor county totals and 2018 governor total, OpenElections
        g = pd.read_csv(f"{PKG['MIG']}/mi_gov2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), 4_250_585.0
    if st == "WIG":
        # 2022 and 2018 governor totals, OpenElections ward files
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['WIG']}/wi_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 2_673_308.0
    if st == "GAG":
        # 2022 and 2018 governor totals, MEDSL
        g = pd.read_csv(f"{PKG['GAG']}/ga_gov2022_total_fips.csv", dtype={"fips": str}).set_index("fips")
        return g.total.astype(float).reindex(county_list(st)), 3_939_328.0
    if st == "OHG":
        # 2022 governor county totals, MEDSL, and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['OHG']}/oh_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 4_435_462.0
    if st == "IAG":
        # 2022 governor county totals, MEDSL, and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['IAG']}/ia_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 1_327_150.0
    if st == "TXG":
        # 2022 governor county totals, MEDSL, and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['TXG']}/tx_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 8_343_443.0
    if st == "FLG":
        # 2022 governor county totals, MEDSL, and 2018 governor total, OpenElections precinct file
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['FLG']}/fl_gov2022_total_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 8_228_238.0
    if st == "MA":
        # no 2022 Senate race: 2022 governor county totals, MEDSL, and 2018 governor total, OpenElections precinct file
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['MA']}/ma_gov2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 2_674_615.0
    if st == "RI":
        # no 2022 Senate race: 2022 governor county totals and 2018 governor total, OpenElections town files aggregated to counties
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['RI']}/ri_gov2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 376_401.0
    if st == "DE":
        # no 2022 Senate race: 2022 U.S. House county totals, MEDSL TOTAL rows, and the 2018 Senate total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['DE']}/de_house2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 362_592.0
    if st == "WV":
        # no 2022 statewide race: 2022 U.S. House county totals, OpenElections, and the 2018 Senate total, OpenElections precinct file
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['WV']}/wv_house2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 586_488.0
    if st == "IL":
        # 2022 Senate county totals (Duckworth vs Salvi), MEDSL precinct file, and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['IL']}/il_sen2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 4_547_657.0
    if st == "TN":
        # no 2022 Senate race: 2022 governor county totals and 2018 governor total, OpenElections, both matching certified totals
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['TN']}/tn_gov2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 2_243_294.0
    if st == "AL":
        # 2022 Senate county totals (Britt vs Boyd), MEDSL precinct file matching certified, and the certified 2018 governor total
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['AL']}/al_sen2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 1_719_589.0
    if st == "NJ":
        # no 2022 statewide race: 2018 Senate county totals scaled to the certified 2022 House statewide total, and the 2018 Senate total
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['NJ']}/nj_mid2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 3_169_310.0
    if st == "OK":
        # 2022 regular Senate county totals (Lankford vs Horn), MEDSL precinct file, and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['OK']}/ok_sen2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 1_186_385.0
    if st == "NM":
        # no 2022 Senate race: 2022 governor county totals; 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['NM']}/nm_gov2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 696_459.0
    if st == "CO":
        # 2022 Senate county totals (Bennet vs O'Dea) and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['CO']}/co_sen2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 2_525_062.0
    if st == "WY":
        # 2022 governor county totals (no 2022 Senate race) and 2018 governor total, OpenElections, over and under votes removed
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['WY']}/wy_gov2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 203_238.0
    if st == "OR":
        # 2022 Senate county totals (Wyden vs Perkins) and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['OR']}/or_sen2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 1_799_558.0
    if st == "KY":
        # no 2022 county file reachable: 2022 Senate statewide total 1,477,637 (Paul vs Booker) spread by the 2018 U.S. House county
        # pattern; 2018 midterm total = 2018 U.S. House total 1,569,798 (OpenElections)
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['KY']}/ky_house2018_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return (g.total / g.total.sum() * 1_477_637).reindex(county_list(st)).astype(float), 1_569_798.0
    if st == "AR":
        # 2022 Senate county totals (Wikipedia) and 2018 governor total (OpenElections)
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['AR']}/sen2022.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 891_509.0
    if st == "LA":
        # 2022 Senate jungle total 1,383,290 (no parish table reachable) spread by the 2020 Senate parish pattern;
        # 2018 had no Senate or governor race: Secretary of State special election total 1,456,917 (OpenElections)
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['LA']}/la_sen2020_parish.csv"); g.index = g.parish.map(lambda x: n2f[norm(x)]); t = g[["D", "R", "O"]].sum(axis=1)
        return (t / t.sum() * 1_383_290).reindex(county_list(st)).astype(float), 1_456_917.0
    if st == "MS":
        # no 2022 statewide race: 2022 U.S. House county totals; 2018 regular Senate total (Wicker vs Baria), OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['MS']}/ms_house2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 935_745.0
    if st == "MN":
        # 2022 governor county totals (Walz vs Jensen) and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['MN']}/mn_gov2022_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 2_587_287.0
    if st == "VA":
        # no 2022 statewide race: 2022 U.S. House statewide total 3,047,639 spread by the 2020 Senate locality pattern; 2018 Senate total
        w = pd.read_csv(f"{PKG['VA']}/va_sen2020_county.csv", dtype={"fips": str}).set_index("fips").total
        return (w / w.sum() * 3_047_639).reindex(county_list(st)).astype(float), 3_351_373.0
    if st == "MT":
        # no 2022 Senate race: 2022 U.S. House county totals across both districts (Wikipedia, sums match 463,632); 2018 Senate total
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['MT']}/house22.csv"); g = g.groupby(g.county.map(lambda x: n2f[norm(x)])).total_votes.sum()
        return g.astype(float).reindex(county_list(st)), 504_384.0
    if st == "ID":
        # 2022 Senate county totals (Wikipedia) and 2018 governor total (OpenElections county file)
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['ID']}/sen2022.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 605_131.0
    if st == "SD":
        # 2022 Senate county totals (Wikipedia) and 2018 governor total (OpenElections county files)
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['SD']}/sen2022.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 339_214.0
    if st == "FL":
        # 2022 Senate county totals (Wikipedia) and 2018 governor total excluding over and under votes (OpenElections)
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['FL']}/sen2022_wiki.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 8_228_238.0
    if st == "ME":
        # 2022 governor county totals (Mills vs LePage, Wikipedia) and 2018 governor total (OpenElections town file, blanks excluded)
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['ME']}/gov22_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.total.astype(float).reindex(county_list(st)), 630_667.0
    if st == "NH":
        # 2022 Senate county totals (Hassan vs Bolduc) and 2018 governor total, OpenElections
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['NH']}/nh_m22_county.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        return g.v.astype(float).reindex(county_list(st)), 573_602.0
    if st == "KS":
        # no 2022 Senate county file reachable: 2022 governor county totals (Kelly vs Schmidt, certified, via Wikipedia); 2018 governor from MEDSL
        n2f = name_to_fips(st)
        g = pd.read_csv(f"{PKG['KS']}/gov22.csv"); g.index = g.county.map(lambda x: n2f[norm(x)])
        t18 = medsl(f"{PKG['KS']}/med18/2018-ks-precinct-general.csv", "GOVERNOR", st).sum().sum()
        return g.total.astype(float).reindex(county_list(st)), float(t18)
    if st == "AK":
        # 2022 Senate first choice total spread by the 2018 governor borough pattern (2022 results exist only by the 2022 plan house districts)
        g = pd.read_csv(f"{PKG['AK']}/ak_gov2018_borough.csv", dtype={"fips": str}).set_index("fips").sum(axis=1)
        return (g / g.sum() * AK_TOTALS["s22"]).reindex(county_list(st)), float(AK_TOTALS["g18"])
    if st == "NE":
        # no 2022 Senate race: 2022 governor used; 2018 Senate (Fischer vs Raybould)
        m22 = medsl(f"{PKG['NE']}/med22/ne22_cleaned.csv", "GOVERNOR", st)
        t18 = medsl(f"{PKG['NE']}/med18/2018-ne-precinct-general.csv", "US SENATE", st).sum().sum()
    elif st == "SC":
        m22 = medsl(f"{PKG['SC']}/med22/south_carolina_cleaned.csv", "US SENATE", st)
        t18 = medsl(f"{PKG['SC']}/med18/2018-sc-precinct-general.csv", "GOVERNOR", st).sum().sum()
    elif st == "NC":
        m22 = medsl(f"{PKG['NC']}/med22/NC-cleaned-final3.csv", "US SENATE", st)
        # no 2018 statewide partisan race; statewide Supreme Court associate justice contest used as the 2018 midterm total
        t18 = medsl(f"{PKG['NC']}/med18/2018-nc-precinct-general.csv", "SUPREME COURT ASSOCIATE JUSTICE", st).sum().sum()
    elif st == "GA":
        m22 = medsl(f"{PKG['GA']}/med22/ga22_cleaned.csv", "US SENATE", st)
        t18 = medsl(f"{PKG['GA']}/med18/2018-ga-precinct-general.csv", "GOVERNOR", st).sum().sum()
    elif st == "TX":
        m22 = medsl(f"{GEO}/med/TX-cleaned.csv", "GOVERNOR", st); t18 = 8_371_655
    elif st == "IA":
        m22 = medsl(f"{GEO}/med/IA_cleaned.csv", "US SENATE", st); t18 = 1_327_150
    elif st == "MI":
        m22 = medsl(f"{H}/med_mi22/mi22_cleaned.csv", "GOVERNOR", st)
        d = pd.read_csv(f"{H}/20181106__mi__general__precinct.csv", dtype=str); d = d[d.office == "U.S. Senate"]
        t18 = tally(d, "candidate", "votes", "county", "Stabenow", "John James", st).sum().sum()
    else:
        m22 = medsl(f"{H}/med_oh22/oh22_cleaned.csv", "US SENATE", st)
        d = pd.read_csv(f"{H}/20181106__oh__general__precinct.csv", low_memory=False); d = d[d.office == "U.S. Senate"]
        t18 = tally(d, "candidate", "votes", "county", "Sherrod Brown", "Renacci", st).sum().sum()
    return m22.sum(axis=1).reindex(county_list(st)).fillna(0), float(t18)

# ── M2 national/census respondent model ──────────────────────────────────────
AGE = ["18-29", "30-44", "45-64", "65+"]; RACE = ["White", "Black", "Hispanic", "Asian/Other"]; COL = ["NON-COLLEGE", "COLLEGE"]

def design(age, race, col, reg, regions):
    x = [1.0] + [1.0 * (age == a) for a in AGE[1:]] + [1.0 * (race == r) for r in RACE[1:]] + [1.0 * (col == "COLLEGE")] \
        + [1.0 * (reg == g) for g in regions[1:]]
    return np.array(x, dtype=float)

def irls(X, y, w, ridge=1.0, it=50):
    b = np.zeros(X.shape[1])
    for _ in range(it):
        p = inv(X @ b); W = w * p * (1 - p)
        A = X.T @ (X * W[:, None]) + ridge * np.eye(X.shape[1]); A[0, 0] -= ridge
        b = b + np.linalg.solve(A, X.T @ (w * (y - p)) - ridge * np.r_[0, b[1:]])
    return b

def fit_respondents():
    r = RESP.dropna(subset=["age_band", "race4", "college", "region8"]).copy()
    regions = sorted(r.region8.unique())
    X = np.vstack([design(a, b, c, g, regions) for a, b, c, g in zip(r.age_band, r.race4, r.college, r.region8)])
    lv = r.turnout_propensity.values
    m = r.gb_2way.notna().values
    bvote = irls(X[m], (r.gb_2way[m] == "Democrat").values.astype(float), lv[m])
    # Turnout model. Stated intent is not a midterm electorate: it averages 69.5 percent against
    # the 46 percent of eligible adults who actually voted in 2022, and it overstates by 20 points
    # among 18 to 29 year olds against 8 among the over 65s. Weighting by intent therefore builds
    # an electorate younger and more diverse than any midterm produces. This fits the model on
    # whether the respondent reports having voted in a recent midterm, 2022 or 2018, which carries
    # the relative shape a midterm actually has.
    def _midterm(s):
        if not isinstance(s, str): return 0.0
        ys = {y for y in s.replace(" ", "").split(";") if y.isdigit()}
        return 1.0 if ("2022" in ys or "2018" in ys) else 0.0
    mid = r.vote_history_years.map(_midterm).values
    if os.environ.get("TURNOUT_INTENT"):
        bturn = irls(X, r.turnout_propensity.values, np.ones(len(r)))
    else:
        bturn = irls(X, mid, np.ones(len(r)))
    m24 = r.recall_2024.isin(["Harris", "Trump"]).values
    b24 = irls(X[m24], (r.recall_2024[m24] == "Harris").values.astype(float), np.ones(m24.sum()))
    state_region = r.groupby("state").region8.agg(lambda s: s.value_counts().index[0]).to_dict()
    return dict(bvote=bvote, b24=b24, bturn=bturn, regions=regions, state_region=state_region)

def county_cells(fips_list):
    a = ACS.reindex(fips_list)
    g = lambda c: pd.to_numeric(a[f"S1501_C01_{c:03d}E"], errors="coerce").fillna(0).values
    age = np.vstack([g(1) + 0.5 * g(16), 0.5 * g(16) + g(19), g(22), g(25)]).T
    tot25 = g(6)
    wnh, blk, his = g(31), g(34), g(52)
    oth = np.clip(tot25 - wnh - blk - his, 0, None)
    race = np.vstack([wnh, blk, his, oth]).T
    col_r = np.vstack([g(33) / np.maximum(wnh, 1), g(36) / np.maximum(blk, 1), g(54) / np.maximum(his, 1),
                       np.clip((g(15) - g(33) - g(36) - g(54)) / np.maximum(oth, 1), 0, 1)]).T
    adults = age.sum(axis=1)
    return age / np.maximum(adults[:, None], 1), race / np.maximum(race.sum(axis=1)[:, None], 1), np.clip(col_r, 0, 1), adults

def census_components(model, fips_list, region_of):
    ageS, raceS, colR, adults = county_cells(fips_list)
    regions = model["regions"]; n = len(fips_list)
    pops, eta, turn, eta24 = np.zeros((n, 32)), np.zeros((n, 32)), np.zeros((n, 32)), np.zeros((n, 32))
    regs = [region_of(f) for f in fips_list]
    cache = {}
    for i in range(n):
        k = 0
        for ai, a in enumerate(AGE):
            for ri, rc in enumerate(RACE):
                for ci, c in enumerate(COL):
                    pc = colR[i, ri] if c == "COLLEGE" else 1 - colR[i, ri]
                    pops[i, k] = adults[i] * ageS[i, ai] * raceS[i, ri] * pc
                    key = (a, rc, c, regs[i])
                    if key not in cache:
                        x = design(a, rc, c, regs[i], regions)
                        cache[key] = (x @ model["bvote"], inv(x @ model["bturn"]), x @ model["b24"])
                    eta[i, k], turn[i, k], eta24[i, k] = cache[key]
                    k += 1
    return pops, eta, turn, adults, eta24

def census_predict(model, fips_list, region_of, shift=0.0, comps=None, use24=False):
    pops, eta, turn, adults, eta24 = comps if comps is not None else census_components(model, fips_list, region_of)
    wt = pops * turn
    e = eta24 if use24 else eta
    d = (wt * inv(e + shift)).sum(axis=1) / np.maximum(wt.sum(axis=1), 1e-9)
    t = wt.sum(axis=1) / np.maximum(adults, 1)
    return d, t, adults

def national_shift(model):
    ACS_US = ACS[ACS.index.str.match(r"^\d{5}$") & ~ACS.index.str.startswith("72")]
    fl = [f for f in ACS_US.index if f in APPROVAL.index]
    abbr = APPROVAL.state_abbr.to_dict()
    region_of = lambda f: model["state_region"].get(abbr.get(f), model["regions"][0])
    comps = census_components(model, fl, region_of)
    out = []
    global _MODEL
    _MODEL = model
    if M2_ANCHOR == "gallup":
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import anchors as _an
        t26 = _an.gallup_lv_d2(sys.modules[__name__], model)
    else:
        t26 = NAT_D2
    for target, use24 in [(t26, False), (NAT_2024_D2, True)]:
        lo, hi = -2.0, 2.0
        for _ in range(50):
            mid = (lo + hi) / 2
            d, t, a = census_predict(model, fl, region_of, mid, comps, use24)
            nat = (d * t * a).sum() / (t * a).sum()
            lo, hi = (mid, hi) if nat < target else (lo, mid)
        out.append((lo + hi) / 2)
    global _SHIFT
    _SHIFT = out
    return out, nat, float((t * a).sum() / a.sum())

_CAL = {}
_M1K = {}
_MODEL, _SHIFT = None, None
# census leg anchor. Since Sept. 22, 2026 the default is "meridian": the Gallup party identification anchor is removed and
# the census leg takes the same TPSI Meridian ballot as the other two legs; M2_ANCHOR=gallup restores Gallup.
M2_ANCHOR = os.environ.get("M2_ANCHOR", "meridian")
ELASTIC_ANCHORS = os.environ.get("ELASTIC_ANCHORS", "1") == "1"

def m1_anchor(fl=None):
    """Approval leg national level. With ELASTIC_ANCHORS the national constant is scaled by each county's elasticity."""
    if ELASTIC_ANCHORS and fl is not None and _MODEL is not None:
        import anchors as _an
        me = sys.modules[__name__]
        return _an.county_e(me, _MODEL, _SHIFT, list(fl)) * _an.m1_constant(me, _MODEL, _SHIFT)
    return m1_anchor_flat()

def m1_county(fl, D=None, R=None):
    """Approval leg county log odds before candidate terms. Voter File Mode: the simulated 2026 electorate's
    preference with each voter's TPSI Trump approval; otherwise county approval through the TPSI crosstab."""
    import anchors as _an
    if ELASTIC_ANCHORS and _MODEL is not None and _an.vf_on():
        import voters as _vf
        N = _vf.load_national()
        x = np.array([N.get(f, np.nan) for f in fl], float)
        if np.isfinite(x).all():
            return pd.Series(logit(np.clip(x, 1e-4, 1 - 1e-4)), index=list(fl)) + m1_anchor(fl)
    return logit(D / (D + R)) + m1_anchor(fl)

def m1_anchor_flat():
    """One national log odds constant so the approval leg's 2024 vote weighted national two party share equals the
    likely voter generic ballot anchor. The county pattern of approval and the TPSI crosstab are untouched; only the
    national level, which the TPSI respondents alone put about a point of two party share more Democratic than the
    public likely voter average, is set to the same anchor as the other two legs."""
    if NAT_ANCHOR == "gallup": return 0.0
    if "k" in _M1K: return _M1K["k"]
    fl = [f for f in APPROVAL.index if f in P24.index]
    r = RESP; w = r.turnout_propensity
    ct = pd.crosstab(r.trump_approve_2way, r.generic_ballot, values=w, aggfunc="sum", normalize="index")
    app, dis, noop, cal = calibrated_approval(fl)
    Dv = dis * ct.loc["Disapprove", "Democrat"] + app * ct.loc["Approve", "Democrat"] + noop * ct.loc["Neutral", "Democrat"]
    Rv = dis * ct.loc["Disapprove", "Republican"] + app * ct.loc["Approve", "Republican"] + noop * ct.loc["Neutral", "Republican"]
    x = logit((Dv / (Dv + Rv)).values); vw = P24.reindex(fl).total_votes.fillna(0).values
    lo, hi = -2.0, 2.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if (inv(x + mid) * vw).sum() / vw.sum() < NAT_D2: lo = mid
        else: hi = mid
    _M1K.update(k=(lo + hi) / 2, before=float((inv(x) * vw).sum() / vw.sum()))
    return _M1K["k"]

def calibrated_approval(fl):
    """County approval pattern from the published TPSI county file (TRUMP APPROVE / DISAPPROVE / no_opinion),
    shifted by one national logit constant so the 2024 vote weighted national two way approval equals the
    TPSI 2026 likely voter approval that the approval to vote crosstab is built on. Neutral share is scaled the same way."""
    if not _CAL:
        r = RESP; w = r.turnout_propensity
        lv = pd.Series(w.values, index=r.trump_approve_2way).groupby(level=0).sum() / w.sum()
        tA, tD, tN = lv["Approve"], lv["Disapprove"], lv["Neutral"]
        a = APPROVAL
        vw = P24.reindex(a.index).total_votes.fillna(0)
        x = logit(a["TRUMP APPROVE"] / (a["TRUMP APPROVE"] + a["TRUMP DISAPPROVE"]))
        target = tA / (tA + tD)
        lo, hi = -2.0, 2.0
        for _ in range(60):
            mid = (lo + hi) / 2
            m = (inv(x + mid) * vw).sum() / vw.sum()
            lo, hi = (mid, hi) if m < target else (lo, mid)
        _CAL.update(k=(lo + hi) / 2, tA=tA, tD=tD, tN=tN, n_nat=(a.no_opinion * vw).sum() / vw.sum() / 100,
                    raw_nat=((a["TRUMP APPROVE"] * vw).sum() / vw.sum(), (a["TRUMP DISAPPROVE"] * vw).sum() / vw.sum()))
    a = APPROVAL.reindex(fl)
    neu = (a.no_opinion / 100) * (_CAL["tN"] / _CAL["n_nat"])
    two = inv(logit(a["TRUMP APPROVE"] / (a["TRUMP APPROVE"] + a["TRUMP DISAPPROVE"])) + _CAL["k"])
    app = (1 - neu) * two; dis = (1 - neu) * (1 - two)
    return app, dis, neu, _CAL

# ── run one state ────────────────────────────────────────────────────────────
def pres_frames(st):
    if not st.startswith("AK"):
        return P16, P20, P24
    rd = lambda n: pd.read_csv(f"{PKG['AK']}/ak_{n}_borough.csv", dtype={"fips": str}).set_index("fips")
    def fr(d, total):
        t = d.D + d.R + d.O
        return pd.DataFrame(dict(votes_dem=d.D, votes_gop=d.R, total_votes=t / t.sum() * total))
    p16, p20 = fr(rd("pres2016"), AK_TOTALS["p16"]), fr(rd("pres2020"), AK_TOTALS["p20"])
    # 2024 exists only by 2022 plan house districts: 2020 borough two party share moved by the statewide 2020 to 2024 logit swing
    d20 = p20.votes_dem / (p20.votes_dem + p20.votes_gop)
    sw = logit(AK_TOTALS["h24"] / (AK_TOTALS["h24"] + AK_TOTALS["t24"])) - logit(p20.votes_dem.sum() / (p20.votes_dem + p20.votes_gop).sum())
    d24 = inv(logit(d20) + sw); t24 = p20.total_votes / p20.total_votes.sum() * AK_TOTALS["p24"]
    two = t24 * (AK_TOTALS["h24"] + AK_TOTALS["t24"]) / AK_TOTALS["p24"]
    p24 = pd.DataFrame(dict(votes_dem=d24 * two, votes_gop=(1 - d24) * two, total_votes=t24))
    return p16, p20, p24

def run_state(st, model, shift, nat_turn_rate):
    cfg = STATES[st]; fl = county_list(st)
    P16, P20, P24 = pres_frames(st)
    polls, pavg = parse_polls(st)
    prim, prim_note = primaries(st); prim = prim.reindex(fl)
    S, years, fillnotes = history(st)
    w_fund, w_census, w_hist, poll_tier, n_houses, newest_days, house_index = poll_weights(polls, pavg)
    ap = APPROVAL.reindex(fl)

    # M1 fundamental: county approval calibrated to the TPSI 2026 likely voter approval level, converted to vote with TPSI respondent crosstab, plus primary structure
    r = RESP; w = r.turnout_propensity
    ct = pd.crosstab(r.trump_approve_2way, r.generic_ballot, values=w, aggfunc="sum", normalize="index")
    app, dis, noop, cal = calibrated_approval(fl)
    D = dis * ct.loc["Disapprove", "Democrat"] + app * ct.loc["Approve", "Democrat"] + noop * ct.loc["Neutral", "Democrat"]
    R = dis * ct.loc["Disapprove", "Republican"] + app * ct.loc["Approve", "Republican"] + noop * ct.loc["Neutral", "Republican"]
    base = m1_county(fl, D, R)
    ps = prim.pD / (prim.pD + prim.pR); ps_state = prim.pD.sum() / (prim.pD.sum() + prim.pR.sum())
    cd_state = (prim.candD * prim.pD).sum() / prim.pD.sum(); cr_state = (prim.candR * prim.pR).sum() / prim.pR.sum()
    party_term = K_PRIMARY_PARTY * (logit(ps) - logit(ps_state))
    cand_term = K_PRIMARY_CAND * ((logit(prim.candD) - logit(cd_state)) - (logit(prim.candR) - logit(cr_state)))
    cand_effect = 0.0
    if cfgget(cfg, 'incumbent_effect'):
        # optional sensitivity: county gap between the incumbent's last Senate race and the same year presidential race, times a scale
        _y, _k = cfg['incumbent_effect']; _s = S[_y]; _p = {2020: P20, 2016: P16, 2024: P24}[_y].reindex(fl)
        cand_effect = _k * (logit(_s.D / (_s.D + _s.R)) - logit(_p.votes_dem / (_p.votes_dem + _p.votes_gop)))
    if cfgget(cfg, 'incumbent_effect_multi') and st not in INCUMBENT_GOV:
        # personal vote of a crossover incumbent: mean county gap between his past governor races and the nearest presidential race, times a scale
        _pairs, _k = cfg['incumbent_effect_multi']; _PP = {2020: P20, 2016: P16, 2024: P24}
        _raw = sum(logit(S[a].D / (S[a].D + S[a].R)) - logit(_PP[b].reindex(fl).votes_dem / (_PP[b].reindex(fl).votes_dem + _PP[b].reindex(fl).votes_gop))
                   for a, b in _pairs) / len(_pairs)
        _w = P24.reindex(fl).total_votes.values
        _sz = 100 * (inv(float((_raw.values * _w).sum() / _w.sum())) - 0.5) * 2
        cand_effect = split_ticket_carry(_sz) * _k * _raw
    if cfgget(cfg, 'osborn_effect'):
        _o = S[2024]; _p = P24.reindex(fl)
        _raw = logit(_o.D / (_o.D + _o.R)) - logit(_p.votes_dem / (_p.votes_dem + _p.votes_gop))
        _w = _p.total_votes.values
        _sz = 100 * (inv(float((_raw.values * _w).sum() / _w.sum())) - 0.5) * 2
        cand_effect = split_ticket_carry(_sz) * _raw
    fin_shift, fin_why = 0.0, "no finance term for this office"
    if cfg.get("office") == "governor" or cfg.get("office", "senate") == "senate":
        _p24 = P24.reindex(fl)
        _b = float(_p24.votes_dem.sum() / (_p24.votes_dem.sum() + _p24.votes_gop.sum()))
        fin_shift, fin_why = finance_term(st, len(polls), _b,
                                          book=SEN_FINANCE if cfg.get("office", "senate") == "senate" else GOV_FINANCE,
                                          k=K_FINANCE_SEN if cfg.get("office", "senate") == "senate" else K_FINANCE,
                                          max_polls=FIN_MAX_POLLS_SEN if cfg.get("office", "senate") == "senate" else FIN_MAX_POLLS)
        if fin_shift:
            cand_effect = cand_effect + fin_shift
    cand_prof = None
    if os.environ.get("CANDIDATE"):
        # Candidate Mode: party unity behind each nominee moves the race; demographic strength enters the voter groups
        import candidate as _cq
        _meta = [(ai, ri, ci) for ai in range(4) for ri in range(4) for ci in range(2)]
        cand_prof = _cq.profile(sys.modules[__name__], st, fl, prim, _meta, len(polls), None, model=model)
        cand_effect = cand_effect + cand_prof["unity_shift"]
    # sitting governor's personal vote, systematic across the roster above
    _inc = INCUMBENT_GOV.get(st) if cfg.get("office") == "governor" else None
    if _inc and _inc["pairs"] and not os.environ.get("DROP_PV"):
        _PP = {2016: P16, 2020: P20, 2024: P24}
        _pairs = [(a, b) for a, b in _inc["pairs"] if a in S]
        if _pairs:
            _pd2 = {y: float(_PP[y].votes_dem.sum() / (_PP[y].votes_dem.sum() + _PP[y].votes_gop.sum())) for y in set(b for _, b in _pairs)}
            _raw = sum(logit(S[a].D / (S[a].D + S[a].R))
                       - logit(_PP[b].reindex(fl).votes_dem / (_PP[b].reindex(fl).votes_dem + _PP[b].reindex(fl).votes_gop))
                       - _cycle_gap(a, b, _pd2)
                       for a, b in _pairs) / len(_pairs)
            _w = P24.reindex(fl).total_votes.values
            _sz = 100 * (inv(float((_raw.values * _w).sum() / _w.sum())) - 0.5) * 2
            _side = (cand_prof or {}).get("sides", {}).get(_inc["party"], {})
            _u = _side.get("unity") if _side.get("kind") == "contested" else None
            _scale = 1.0 if _u is None else float(np.clip(1.0 + GOV_INC_PRIM_K * _u, GOV_INC_PRIM_LO, GOV_INC_PRIM_HI))
            _term = split_ticket_carry(_sz) * _scale * _raw
            cand_effect = cand_effect + _term
            _INC_AUDIT[st] = dict(party=_inc["party"], cycles=[a for a, _ in _pairs],
                                  cycle_centering_logit={f"{a}v{b}": round(_cycle_gap(a, b, _pd2), 4) for a, b in _pairs},
                                  measured_gap_pts=round(float(_sz), 3), carry=split_ticket_carry(_sz),
                                  primary_unity=None if _u is None else round(float(_u), 4),
                                  primary_scale=round(_scale, 4),
                                  shift_pts_statewide=round(float(100 * (inv(float((_term.values * _w).sum() / _w.sum())) - 0.5) * 2), 3))
    elif _inc:
        _INC_AUDIT[st] = dict(party=_inc["party"], cycles=[], measured_gap_pts=None, carry=None,
                              primary_unity=None, primary_scale=None, shift_pts_statewide=0.0,
                              note="incumbent has never won a gubernatorial election, so no personal vote exists to carry")
    m1 = inv(base + cand_effect) if MOVE_A else inv(base + party_term + cand_term + cand_effect)

    # M2 national/census: TPSI respondent model on ACS 2024 composition, anchored to Gallup 49 D 39 R
    reg = model["state_region"][cfg.get("base", st[:2])]
    comps = census_components(model, fl, lambda f: reg)
    g26, turn_idx, adults = census_predict(model, fl, lambda f: reg, shift[0], comps)
    g24, _, _ = census_predict(model, fl, lambda f: reg, shift[1], comps, use24=True)
    p24 = P24.reindex(fl); actual24 = p24.votes_dem / (p24.votes_dem + p24.votes_gop)
    # county partisanship from certified 2024 result, moved by the demographic swing from 2024 to the Gallup anchored 2026 environment
    demo_swing = pd.Series(logit(g26) - logit(g24), index=fl)
    if ELASTIC_ANCHORS:
        # the swing keeps its county to county shape; its national level moves each county by its own elasticity
        import anchors as _an
        _mean, _k2 = _an.m2_params(sys.modules[__name__], model, shift)
        demo_swing = demo_swing - _mean + pd.Series(_an.county_e(sys.modules[__name__], model, shift, fl) * _k2, index=fl)
    m2 = inv(logit(actual24) + demo_swing + cand_effect + (party_term + cand_term if MOVE_A else 0.0))
    turn_idx = pd.Series(turn_idx, index=fl); adults = pd.Series(adults, index=fl)
    if ELECTORATE:
        # Electorate Mode: the census leg is anchored on 2024 presidential voters; move it to the estimated 2026 midterm electorate
        import electorate as _ev
        el_delta, el_w26, el_enth, el_prim_share, _G, _acomp = _ev.midterm_shift(sys.modules[__name__], model, fl, reg, actual24, p24.total_votes, prim)
        m2 = inv(logit(m2) + el_delta)
        if cand_prof is not None:
            _hinfo = _ev.HISTORY_INFO.get(st, {})
            m1 = inv(logit(m1) + pd.Series(_hinfo.get("candidate_county_shift", np.zeros(len(fl))), index=fl))
    if cand_prof is not None:
        # candidate strength against the environment: polls against the model's own fundamentals
        _w = p24.total_votes.astype(float)
        _fund = float((((w_fund * m1 + w_census * m2) / max(w_fund + w_census, 1e-9)) * _w).sum() / _w.sum())
        _ps, _gap = _cq.poll_strength(len(polls), pavg.get("D2"), _fund)
        cand_prof.update(poll_strength=_ps, poll_gap=_gap, fundamentals_d2=_fund)
        if _ps:
            m1 = inv(logit(m1) + _ps); m2 = inv(logit(m2) + _ps)

    # turnout: national midterm ratio anchor x state relative midterm factor, distributed by 2022 county votes grown to 2024 and TPSI demographic turnout
    m22, t18 = midterm_totals(st)
    sp = lambda P: P.reindex(fl).total_votes.sum()
    nat_ratio = np.mean([v / {2016: 136_669_276, 2020: 158_429_631}[py] for v, py in NAT_MIDTERM.values()])
    st_factor = np.mean([(t18 / sp(P16)) / (NAT_MIDTERM[2018][0] / 136_669_276), (m22.sum() / sp(P20)) / (NAT_MIDTERM[2022][0] / 158_429_631)])
    state_total = sp(P24) * nat_ratio * st_factor
    grown = m22 * (P24.reindex(fl).total_votes / P20.reindex(fl).total_votes)
    demo = adults * turn_idx
    share = TURNOUT_HIST_SHARE * grown / grown.sum() + TURNOUT_DEMO_SHARE * demo / demo.sum()
    if ELECTORATE:
        _pt = (prim.pD.fillna(0) + prim.pR.fillna(0)).astype(float)
        _g = grown / grown.sum(); _d = el_w26 / el_w26.sum()
        if _pt.sum() > 0:
            _p = _pt / _pt.sum()
            _p = _p.where(_pt > 0, _g)            # a county with no primary record falls back to its 2022 share
            _p = _p / _p.sum()
            share = _ev.W_HIST * _g + _ev.W_PRIM * _p + _ev.W_DEMO * _d
        else:
            share = (_ev.W_HIST + _ev.W_PRIM) * _g + _ev.W_DEMO * _d
    turnout = state_total * share
    if ELECTORATE and os.environ.get("HISTORY"):
        # Vote History Mode: 2026 turnout is the sum of every group's own 2026 turnout chance, not a share of an anchored total
        turnout = el_w26.astype(float)
        state_total = float(turnout.sum())

    # M3 history/polling: county lean from three Senate cycles with trend, level set to polling average
    lean = {y: logit(S[y].D / (S[y].D + S[y].R)) - logit(S[y].D.sum() / (S[y].D.sum() + S[y].R.sum())) for y in years}
    hw = cfgget(cfg, 'hist_w', HIST_W); tc = cfgget(cfg, 'trend_carry', TREND_CARRY)
    lean_base = sum(wt * lean[y] for wt, y in zip(hw, years)) + tc * (lean[years[0]] - lean[years[1]]) * 0.5
    if pavg.get("D2") is None:
        # no polls: level M3 to the turnout weighted average of M1 and M2, so M3 contributes only the historical county pattern
        pavg["D2"] = float((((w_fund * m1 + w_census * m2) / (w_fund + w_census)) * turnout).sum() / turnout.sum())
    _target = pavg["D2"]
    if POLL_SHIFT:
        _target = inv(logit(_target) + POLL_SHIFT)
    if DYNAMIC:
        # Dynamic Mode: the county history is moved from its own past level to the 2026 target by county elasticity,
        # not by one uniform logit swing, so responsive counties absorb more of the statewide move than anchored ones
        import elasticity as _el
        _hl = sum(wt * logit(S[y].D.sum() / (S[y].D.sum() + S[y].R.sum())) for wt, y in zip(hw, years)) / sum(hw[:len(years)])
        _base3 = lean_base + _hl
        _dnow = inv(_base3)
        elast, elast_prior, elast_data_share, elast_used = _el.county_elasticity(sys.modules[__name__], st, cfg, fl, model, shift, comps, S, years, P16, P20, P24, turnout, _dnow)
        lo, hi = -3, 3
        for _ in range(60):
            mid = (lo + hi) / 2
            agg = (inv(_base3 + elast * mid) * turnout).sum() / turnout.sum()
            lo, hi = (mid, hi) if agg < _target else (lo, mid)
        m3 = inv(_base3 + elast * (lo + hi) / 2)
    else:
        lo, hi = -3, 3
        for _ in range(60):
            mid = (lo + hi) / 2
            agg = (inv(lean_base + mid) * turnout).sum() / turnout.sum()
            lo, hi = (mid, hi) if agg < _target else (lo, mid)
        m3 = inv(lean_base + (lo + hi) / 2)

    d2 = w_fund * m1 + w_census * m2 + w_hist * m3

    # third parties: statewide share from poll Other, split by historic party weights, county pattern from history
    o_hist = sum(wt * (S[y].O / (S[y].D + S[y].R + S[y].O)) for wt, y in zip(hw, years)) / sum(hw[:len(years)])
    o_rel = (o_hist / ((o_hist * turnout).sum() / turnout.sum())).clip(0.5, 2.0)
    if not np.isfinite(float((o_hist * turnout).sum() / turnout.sum())) or float((o_hist * turnout).sum()) <= 0:
        o_rel = pd.Series(1.0, index=o_rel.index)   # history carries no third party base here, so spread it evenly
    elif cfgget(cfg, 'third_uniform'):
        o_rel = pd.Series(1.0, index=o_rel.index)
    third_total = max(pavg["third"], cfgget(cfg, 'third_floor', 0.0))
    osh = (third_total * o_rel)
    osh = osh * third_total / ((osh * turnout).sum() / turnout.sum()) if third_total > 0 else osh * 0.0
    tw = sum(x[2] for x in cfg["third"])
    if cfg.get("rcv"):
        # first choice shares of the two minor Republicans: statewide from first choice polls, borough pattern from each
        # candidate's 2026 primary share relative to statewide, clipped 0.5 to 2
        ind = {}
        RCV = cfg.get("rcv_transfers", AK_RCV)
        if cfg.get("rcv_fc"):
            # no general election poll with the final field: the blend is read as the first choice two way split between the
            # Democrat and the Republican bloc, the bloc is divided by the primary, and the count is run forward
            f = cfg["rcv_fc"]
            osh = f * (1 - d2)
            _tw = sum(x[2] for x in cfg["third"])
            for nm, pty, wt in cfg["third"]:
                ind[nm] = osh * wt / _tw
            d1 = d2.copy(); r1 = (1 - f) * (1 - d2); d2_fc = d2.copy()
            cont = 1 - RCV["exhaust"] * osh
            d2 = (d1 + RCV["to_D"] * osh) / cont          # final round share of continuing ballots
        else:
            for (nm, pty, wt), col in zip(cfg["third"], ["danj_primary", "heikes_primary"]):
                tgt = pavg["first_choice_share"][nm]
                rel = (prim[col] / ((prim[col] * turnout).sum() / turnout.sum())).clip(0.5, 2.0)
                x = tgt * rel; ind[nm] = x * tgt / ((x * turnout).sum() / turnout.sum())
                osh = sum(ind.values())
            # d2 is the final round share of continuing ballots. Back out first choice:
            # final D = D1 + to_D * O, final R = R1 + to_R * O, continuing = 1 - exhaust * O
            cont = 1 - RCV["exhaust"] * osh
            d1 = d2 * cont - RCV["to_D"] * osh
            r1 = (1 - d2) * cont - RCV["to_R"] * osh

    df = pd.DataFrame(index=fl)
    df["county_fips"] = fl
    df["county"] = [NAMES[f] if st.startswith("AK") else (NAMES[f] + (" city" if int(f[2:]) >= 500 else " County")) if st in ("VA", "MDG")
                    else NAMES[f] + " Parish" if st == "LA"
                    else NAMES[f] + (" County" if not NAMES[f].endswith("County") else "") for f in fl]
    tcols = []
    if cfg.get("rcv"):
        df["dem_pct"] = 100 * d1; df["rep_pct"] = 100 * r1
        for nm, pty, wt in cfg["third"]:
            col = re.sub(r"[^a-z]+", "_", nm.lower()).strip("_") + "_pct"
            df[col] = 100 * ind[nm]; tcols.append((nm, pty, col))
    else:
        df["dem_pct"] = 100 * d2 * (1 - osh)
        df["rep_pct"] = 100 * (1 - d2) * (1 - osh)
        for nm, pty, wt in cfg["third"]:
            col = re.sub(r"[^a-z]+", "_", nm.lower()).strip("_") + "_pct"
            df[col] = 100 * osh * wt / tw; tcols.append((nm, pty, col))
    df["dem_margin"] = df.dem_pct - df.rep_pct
    df["winner"] = np.where(df.dem_margin > 0, cfg["D"] + " (D)", cfg["R"] + " (R)")
    if cfg.get("rcv"):
        df["rcv_final_dem_pct"] = 100 * d2; df["rcv_final_rep_pct"] = 100 * (1 - d2)
        df["rcv_final_margin"] = df.rcv_final_dem_pct - df.rcv_final_rep_pct
        df["rcv_exhausted_pct_of_ballots"] = 100 * cfg.get("rcv_transfers", AK_RCV)["exhaust"] * osh
        df["rcv_final_dem_votes"] = (turnout * cont * d2).round(0); df["rcv_final_rep_votes"] = (turnout * cont * (1 - d2)).round(0)
        df["winner"] = np.where(df.rcv_final_margin > 0, cfg["D"] + " (D)", cfg["R"] + " (R)")
    df["projected_turnout"] = turnout.round(0)
    df["dem_votes"] = (turnout * df.dem_pct / 100).round(0)
    df["rep_votes"] = (turnout * df.rep_pct / 100).round(0)
    for nm, pty, col in tcols:
        df[col.replace("_pct", "_votes")] = (turnout * df[col] / 100).round(0)
    df["m1_fundamental_d2"] = 100 * m1; df["m2_census_d2"] = 100 * m2; df["tpsi_demographic_swing_logit"] = demo_swing; df["pres_2024_d2"] = 100 * actual24; df["m3_history_polling_d2"] = 100 * m3
    df["final_d2"] = 100 * d2
    if cfg.get("rcv_fc"):
        df["first_choice_two_way_d2"] = 100 * d2_fc
    df["county_trump_approve_published"] = ap["TRUMP APPROVE"]
    df["county_trump_disapprove_published"] = ap["TRUMP DISAPPROVE"]
    df["m1_approve_lv_calibrated"] = 100 * app
    df["m1_disapprove_lv_calibrated"] = 100 * dis
    df["primary_dem_share_of_two_party_primary_vote"] = 100 * ps
    df[f"primary_{cfg['D'].split()[-1].lower()}_share"] = 100 * prim.candD
    df[f"primary_{cfg['R'].split()[-1].lower()}_share"] = 100 * prim.candR
    if "graham_first" in prim:
        df["special_primary_graham_share"] = 100 * prim.graham_first
        df["special_runoff_graham_share"] = 100 * prim.graham_runoff
    if "collins_first" in prim:
        df["primary_collins_first_round_share"] = 100 * prim.collins_first
        df["runoff_collins_share"] = 100 * prim.collins_runoff
    for y in years:
        df[f"{cfg.get('office', 'senate')}_{y}_d2"] = 100 * S[y].D / (S[y].D + S[y].R)
    df["tpsi_turnout_index"] = turn_idx
    if ELECTORATE:
        df["electorate_midterm_shift_logit"] = el_delta.values
    if DYNAMIC:
        df["elasticity"] = elast.values; df["elasticity_demographic_prior"] = elast_prior.values; df["elasticity_own_history_share"] = elast_data_share.values
    df["midterm_2022_votes"] = m22
    df = df.sort_values("dem_margin", ascending=False).reset_index(drop=True)

    if cfg.get("split"):
        # split the anti Republican bloc by the poll average share; the county margin is the leading bloc candidate minus the Republican
        sp = cfg["split"]; sh = pavg["split_share"]; n1, n2 = sp["names"]
        c1 = re.sub(r"[^a-z]+", "_", n1.lower()).strip("_"); c2 = re.sub(r"[^a-z]+", "_", n2.lower()).strip("_")
        df.insert(df.columns.get_loc("dem_pct"), f"{c1}_pct", df.dem_pct * sh)
        df.insert(df.columns.get_loc("dem_pct"), f"{c2}_pct", df.dem_pct * (1 - sh))
        df.insert(df.columns.get_loc("dem_votes"), f"{c1}_votes", (df.projected_turnout * df[f"{c1}_pct"] / 100).round(0))
        df.insert(df.columns.get_loc("dem_votes"), f"{c2}_votes", (df.projected_turnout * df[f"{c2}_pct"] / 100).round(0))
        df = df.rename(columns={"dem_pct": "anti_republican_bloc_pct", "dem_votes": "anti_republican_bloc_votes", "dem_margin": "bloc_margin",
                                "final_d2": "final_bloc_two_way"})
        lead = np.maximum(df[f"{c1}_pct"], df[f"{c2}_pct"])
        df["leader_margin"] = lead - df.rep_pct
        df["winner"] = np.where(df.leader_margin > 0, np.where(df[f"{c1}_pct"] >= df[f"{c2}_pct"], f"{n1} ({sp['parties'][0]})", f"{n2} ({sp['parties'][1]})"), cfg["R"] + " (R)")
        df = df.sort_values("leader_margin", ascending=False).reset_index(drop=True)
        V = df.projected_turnout.sum()
        top = {n1: df[f"{c1}_votes"].sum() / V * 100, n2: df[f"{c2}_votes"].sum() / V * 100, cfg["R"]: df.rep_votes.sum() / V * 100}
        for nm, pty, col in tcols:
            top[nm] = df[col.replace("_pct", "_votes")].sum() / V * 100
        summary = dict(state=cfg["name"], topline=top, margin=max(top[n1], top[n2]) - top[cfg["R"]], turnout=V,
                       counties_D=int((df.leader_margin > 0).sum()), counties=len(df), bloc_share_split=sh,
                       components_statewide=dict(M1=float((m1 * turnout).sum() / V * 100), M2=float((m2 * turnout).sum() / V * 100),
                                                 M3=float((m3 * turnout).sum() / V * 100), final_d2=float((d2 * turnout).sum() / V * 100)),
                       poll_avg=pavg, n_polls=len(polls), primary_source=prim_note, history_years=years, history_counties_filled=fillnotes,
                   blend_weights=dict(M1=round(w_fund, 4), M2=round(w_census, 4), M3=round(w_hist, 4)),
                   poll_tier=poll_tier, poll_house_index=house_index, poll_houses_recent=n_houses, newest_poll_days=newest_days,
                       state_total_turnout=state_total, nat_ratio=nat_ratio, st_factor=st_factor, third_parties=[(nm, pty) for nm, pty, _ in tcols])
        summary["finance"] = dict(shift_logit=float(fin_shift), status=fin_why)
        summary["incumbency"] = _INC_AUDIT.get(st)
        if ELECTORATE:
            summary["electorate"] = dict(enthusiasm_logit=el_enth, primary_dem_share=el_prim_share,
                                         midterm_shift_statewide=float(np.average(el_delta, weights=turnout)), history={k_: v_ for k_, v_ in (_ev.HISTORY_INFO.get(st) or {}).items() if k_ != "candidate_county_shift"})
        if cand_prof is not None:
            summary["candidate"] = {k_: v_ for k_, v_ in cand_prof.items() if k_ != "sides"}
            summary["candidate"]["sides"] = {s_: {**{k_: v_ for k_, v_ in d_.items() if k_ not in ("dev", "mob", "geo")}, "home_ground_range": [float(np.min(d_["geo"])), float(np.max(d_["geo"]))] if len(d_.get("geo", [])) else None} for s_, d_ in cand_prof["sides"].items()}
        return df, polls, summary
    V = df.projected_turnout.sum()
    top = {cfg["D"]: df.dem_votes.sum() / V * 100, cfg["R"]: df.rep_votes.sum() / V * 100}
    for nm, pty, col in tcols:
        top[nm] = df[col.replace("_pct", "_votes")].sum() / V * 100
    summary = dict(state=cfg["name"], topline=top, margin=top[cfg["D"]] - top[cfg["R"]], turnout=V,
                   counties_D=int((df.dem_margin > 0).sum()), counties=len(df),
                   components_statewide=dict(
                       M1=float((m1 * turnout).sum() / V * 100), M2=float((m2 * turnout).sum() / V * 100),
                       M3=float((m3 * turnout).sum() / V * 100), final_d2=float((d2 * turnout).sum() / V * 100),
                       **(dict(first_choice_d2=float((d2_fc * turnout).sum() / V * 100)) if cfg.get("rcv_fc") else {})),
                   poll_avg=pavg, n_polls=len(polls), primary_source=prim_note, history_years=years,
                   history_counties_filled=fillnotes,
                   blend_weights=dict(M1=round(w_fund, 4), M2=round(w_census, 4), M3=round(w_hist, 4)),
                   poll_tier=poll_tier, poll_house_index=house_index, poll_houses_recent=n_houses, newest_poll_days=newest_days, state_total_turnout=state_total, nat_ratio=nat_ratio, st_factor=st_factor,
                   third_parties=[(nm, pty) for nm, pty, _ in tcols])
    if ELECTORATE:
        summary["electorate"] = dict(enthusiasm_logit=el_enth, primary_dem_share=el_prim_share,
                                     midterm_shift_statewide=float(np.average(el_delta, weights=turnout)), history={k_: v_ for k_, v_ in (_ev.HISTORY_INFO.get(st) or {}).items() if k_ != "candidate_county_shift"})
        if cand_prof is not None:
            summary["candidate"] = {k_: v_ for k_, v_ in cand_prof.items() if k_ != "sides"}
            summary["candidate"]["sides"] = {s_: {**{k_: v_ for k_, v_ in d_.items() if k_ not in ("dev", "mob", "geo")}, "home_ground_range": [float(np.min(d_["geo"])), float(np.max(d_["geo"]))] if len(d_.get("geo", [])) else None} for s_, d_ in cand_prof["sides"].items()}
    summary["finance"] = dict(shift_logit=float(fin_shift), status=fin_why)
    summary["incumbency"] = _INC_AUDIT.get(st)
    if cfg.get("rcv"):
        FD, FR = df.rcv_final_dem_votes.sum(), df.rcv_final_rep_votes.sum()
        summary["rcv_final"] = {cfg["D"]: FD / (FD + FR) * 100, cfg["R"]: FR / (FD + FR) * 100}
        summary["rcv_final_margin"] = (FD - FR) / (FD + FR) * 100
        summary["rcv_exhausted_votes"] = V - FD - FR
        summary["counties_D"] = int((df.rcv_final_margin > 0).sum())
        summary["rcv_transfer_assumption"] = cfg.get("rcv_transfers", AK_RCV)
    return df, polls, summary

def main():
    model = fit_respondents()
    shift, nat, nat_turn = national_shift(model)
    results = {}
    import sys
    todo = sys.argv[1:] or ["IA", "MI", "OH", "TX"]
    prev = json.load(open(f"{OUT}/run_summary.json"))["results"] if os.path.exists(f"{OUT}/run_summary.json") else {}
    for st in todo:
        df, polls, summ = run_state(st, model, shift, nat_turn)
        slug = STATES[st]["name"].lower().replace(" ", "_")
        office = STATES[st].get("office", "senate")
        df.to_csv(f"{OUT}/{slug}_2026_{office}_county_forecast.csv", index=False, float_format="%.3f")
        polls.drop(columns="key").to_csv(f"{OUT}/{slug}{'_governor' if office == 'governor' else ''}_poll_average_inputs.csv", index=False, float_format="%.3f")
        results[st] = summ
        print(st, {k: round(v, 2) for k, v in summ["topline"].items()}, "margin", round(summ["margin"], 2),
              "turnout", round(summ["turnout"]), "components", {k: round(v, 2) for k, v in summ["components_statewide"].items()},
              "polls D2", round(summ["poll_avg"]["D2"] * 100, 2), "3P", round(summ["poll_avg"]["third"] * 100, 2), "fills", summ["history_counties_filled"])
    meta = dict(national_intercept_shift=shift, national_lv_d2=nat, national_mean_turnout_index=nat_turn,
                state_region=model["state_region"], results={**prev, **results})
    json.dump(meta, open(f"{OUT}/run_summary.json", "w"), indent=1, default=float)

if __name__ == "__main__":
    main()
