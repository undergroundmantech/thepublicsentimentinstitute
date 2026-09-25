"""Python port of TPSI buildDailyModel.ts, line for line, for the Senate and Governor poll averages.

Poll weight = sampleSizeWeight x recencyWeight x sampleTypeWeight x pollsterRepetitionFactor x getPollsterWeight
x undecidedPenalty, then per candidate z score clipping at 2 SD, then the weighted mean rounded to one decimal.
buildDailyWeightedSeries is run for every day from a race's first poll to AS_OF_DAILY, and the final day is the average.

Mapping from the forecast poll files: D and R are the two candidates, O is "Other", U is "Undecided". Polls marked V
(voters, type unstated) count as RV. Montana's Bodnar and Bankhead are averaged as separate candidates and summed into
the anti Republican bloc. Alaska's first choice polls are converted to a final round with the published transfer rates
before averaging, so its candidates are the final round pair. The .ts series averages named candidates only; the Other
share used for the third party layer is averaged here with exactly the same per poll weights.
"""
import math, os, re, json
from datetime import date, timedelta
import numpy as np, pandas as pd

# The daily series runs to this date and its last day IS the polling average, so any poll ending
# after it contributes nothing. It was frozen at 2026-09-21 while the forecast ran at AS_OF
# 2026-09-24, which silently dropped seven polls across six races. They still counted toward the
# house count, so they raised the weight on the polling leg without entering its level. It now
# follows AS_OF.
AS_OF_DAILY = os.environ.get("AS_OF_DAILY", os.environ.get("AS_OF", "2026-09-21"))

SCORECARD = {}
def _add(grade, weight, *keys):
    for k in keys:
        SCORECARD[k] = dict(grade=grade, weight=weight)
# insertion order matches the .ts object, which decides the first substring match
_add("Gold", 6.00, "quantus insights", "quantus")
_add("A++", 4.00, "atlasintel", "bsp research/shaw & company", "bsp research", "shaw & company", "patriot polling")
_add("A+", 3.00, "onmessage inc.", "onmessage", "big data poll", "u. georgia spia", "georgia spia", "the washington post",
     "washington post", "insideradvantage", "insider advantage")
_add("A", 2.25, "research & polling", "fabrizio, lee & associates", "fabrizio lee", "fabrizio lee & associates",
     "landmark communications", "tipp", "tarrance", "tarrance group", "data orbital")
_add("A-", 1.70, "susquehanna", "fabrizio/gbao", "fabrizio/gbao [wsj]", "global strategy group", "harrisx", "harris x",
     "trafalgar group", "trafalgar", "socal strategies", "oh predictive insights", "oh predictive insights / mbqf",
     "east carolina university")
_add("B+", 1.30, "j.l. partners", "jl partners", "j. l. partners", "emerson", "emerson college", "emerson college polling",
     "mitchell research & communications", "mitchell research", "wpai", "suffolk", "suffolk university")
_add("B", 1.00, "mclaughlin", "mclaughlin & associates", "mclaughlin and associates", "fabrizio ward", "harris poll",
     "fabrizio/impact", "uc berkeley", "echelon insights", "massinc polling group", "massinc", "kaconsulting llc",
     "marquette law school", "washington post/george mason university", "washington post/george mason")
_add("A+(adj)", 1.00, "rasmussen", "rasmussen reports")
_add("B-", 0.75, "u. massachusetts - lowell", "umass lowell", "u. massachusetts lowell", "wick", "activote")
_add("C+", 0.50, "harper polling", "siena/nyt", "siena college/nyt", "siena/new york times", "co/efficient", "roanoke college",
     "spry strategies", "targoz market research", "hart research associates", "hart research", "muhlenberg",
     "muhlenberg college", "cygnal", "rmg research", "redfield & wilton strategies", "redfield and wilton strategies",
     "redfield & wilton", "research co.", "research co", "opinion insight", "epic/mra", "st. anselm", "saint anselm",
     "surveyusa", "survey usa", "glengariff group inc.", "glengariff group", "noble predictive insights", "beacon/shaw")
_add("C", 0.25, "benenson strategy group", "benenson strategy group/gs strategy group", "highground", "cnn/ssrs", "cnn",
     "quinnipiac", "quinnipiac university", "remington", "remington research", "marist college", "marist", "selzer",
     "selzer & company", "yougov", "leger", "ipsos", "virginia commonwealth u.", "virginia commonwealth university",
     "siena college", "gravis marketing", "gravis")
_add("C-", 0.15, "civiqs", "monmouth", "monmouth university", "abc/washington post", "data for progress",
     "university of texas at tyler", "ut tyler", "florida atlantic university", "florida atlantic university/mainstreet research",
     "florida atlantic", "franklin and marshall college", "franklin & marshall", "u. new hampshire", "university of new hampshire",
     "kaiser family foundation", "morning consult", "qriously")
_add("D+", 0.06, "ces / yougov", "victory insights", "patinkin research strategies", "patinkin research")
_add("D", 0.06, "change research", "swayable")
_add("D-", 0.03, "mason-dixon", "mason dixon", "focaldata", "surveymonkey", "survey monkey", "ppp", "public policy polling")
_add("F", 0.01, "navigator", "baldwin wallace university", "bullfinch", "gbao", "the political matrix/the listener group", "the political matrix")
_add("F-", 0.01, "big village", "usc dornsife", "strategies 360", "citizen data")
_add("Super F", 0.005, "outward intelligence", "research america", "ascend action", "alaska survey research", "prri",
     "raba research", "amber integrated", "center street pac", "anzalone liszt grove", "clarity", "soonerpoll.com", "soonerpoll")
UNKNOWN = 0.60

def norm_key(raw):
    s = raw.lower().strip().replace("**", "")
    s = re.sub(r"\s+", " ", s)
    return s.replace("–", "-").replace("—", "-")

def pollster_entry(raw):
    n = norm_key(raw)
    if n in SCORECARD: return SCORECARD[n]["grade"], SCORECARD[n]["weight"], n
    for k in SCORECARD:
        if k in n: return SCORECARD[k]["grade"], SCORECARD[k]["weight"], k
    for k in SCORECARD:
        if n in k and len(n) > 4: return SCORECARD[k]["grade"], SCORECARD[k]["weight"], k
    return "NR", UNKNOWN, ""

clamp = lambda x, lo, hi: max(lo, min(hi, x))
def days_between(a, b):
    return (date.fromisoformat(b) - date.fromisoformat(a)).days
def round1(x):
    return math.floor(x * 10 + 0.5) / 10          # Math.round semantics
def recency(d):
    return math.exp(-((d / 21) ** 1.3))
def sample_size_w(n):
    raw = 1 / (1 + math.exp(-0.003 * (n - 1100)))
    return 0.05 + 0.95 * raw
def sample_type_w(t):
    return 3.0 if t == "LV" else 1.0 if t == "RV" else 0.1
def repetition(occ, days_since_newest):
    if occ <= 1 or days_since_newest > 21: return 1.00
    if occ == 2: return 0.75
    if occ == 3: return 0.50
    return 0.33
def undecided_penalty(res):
    cand = sum(v for k, v in res.items() if k not in ("Undecided", "Other"))
    explicit = res.get("Undecided", 0) + res.get("Other", 0)
    u = max(explicit, 100 - cand) / 100
    return clamp(1 - 3.0 * math.sqrt(max(0.0, u)), 0.10, 1.00)
def poll_weight(p, as_of, occ=1, dsn=0):
    d = clamp(days_between(p["endDate"], as_of), 0, 3650)
    return (sample_size_w(max(0, p["sampleSize"])) * recency(d) * sample_type_w(p["sampleType"])
            * repetition(occ, dsn) * pollster_entry(p["pollster"])[1] * undecided_penalty(p["results"]))
def clip_outliers(vals):
    if len(vals) < 3: return list(vals)
    m = sum(vals) / len(vals)
    var = sum((v - m) ** 2 for v in vals) / (len(vals) - 1); sd = math.sqrt(var)
    if sd == 0: return list(vals)
    return [v if abs((v - m) / sd) <= 2.0 else m + math.copysign(2.0 * sd, (v - m) / sd) for v in vals]

def daily_series(polls, candidates, start, end, extra_series=("Other",)):
    """buildDailyWeightedSeries. extra_series are averaged with the same weights for the third party layer."""
    srt = sorted(polls, key=lambda p: p["endDate"])
    out = []
    d = date.fromisoformat(start); e = date.fromisoformat(end)
    while d <= e:
        day = d.isoformat()
        avail = [p for p in srt if p["endDate"] <= day]
        desc = sorted(avail, key=lambda p: p["endDate"], reverse=True)   # stable, like Array.sort
        row = {"date": day}
        for c in list(candidates) + list(extra_series):
            meta = {}; ent = []
            for p in desc:
                v = p["results"].get(c)
                if not isinstance(v, (int, float)) or (isinstance(v, float) and math.isnan(v)): continue
                k = norm_key(p["pollster"])
                m = meta.get(k, dict(occ=0, newest=p["endDate"]))
                occ = m["occ"] + 1
                meta[k] = dict(occ=occ, newest=p["endDate"] if m["occ"] == 0 else m["newest"])
                dsn = 0 if occ == 1 else days_between(p["endDate"], meta[k]["newest"])
                ent.append((v, poll_weight(p, day, occ, dsn)))
            cl = clip_outliers([v for v, _ in ent])
            num = sum(cv * w for cv, (_, w) in zip(cl, ent)); den = sum(w for _, w in ent)
            row[c] = round1(num / den) if den > 0 else 0
        out.append(row)
        d += timedelta(days=1)
    return out

def frame_to_polls(p, candidates):
    """Forecast poll frame to .ts Poll objects. candidates maps .ts candidate name to frame column."""
    polls = []
    for r in p.itertuples():
        res = {c: float(getattr(r, col)) for c, col in candidates.items() if pd.notna(getattr(r, col))}
        if pd.notna(getattr(r, "O", np.nan)): res["Other"] = float(r.O)
        if pd.notna(getattr(r, "U", np.nan)): res["Undecided"] = float(r.U)
        polls.append(dict(pollster=str(r.source), endDate=pd.Timestamp(r.end).date().isoformat(),
                          sampleSize=float(r.n), sampleType="LV" if r.pop == "LV" else "A" if r.pop == "A" else "RV", results=res))
    return polls

def poll_audit(polls, as_of=AS_OF_DAILY):
    """Per poll factors on the as of day, with the repetition index taken the way the .ts loop takes it."""
    desc = sorted([p for p in polls if p["endDate"] <= as_of], key=lambda p: p["endDate"], reverse=True)
    meta = {}; rows = []
    for p in desc:
        k = norm_key(p["pollster"]); m = meta.get(k, dict(occ=0, newest=p["endDate"]))
        occ = m["occ"] + 1; meta[k] = dict(occ=occ, newest=p["endDate"] if m["occ"] == 0 else m["newest"])
        dsn = 0 if occ == 1 else days_between(p["endDate"], meta[k]["newest"])
        g, w, matched = pollster_entry(p["pollster"])
        dago = clamp(days_between(p["endDate"], as_of), 0, 3650)
        rows.append(dict(pollster=p["pollster"], end=p["endDate"], n=p["sampleSize"], type=p["sampleType"], grade=g, matched_key=matched,
                         quality=w, sample_w=sample_size_w(p["sampleSize"]), recency_w=recency(dago), type_w=sample_type_w(p["sampleType"]),
                         repeat_w=repetition(occ, dsn), undecided_w=undecided_penalty(p["results"]),
                         weight=poll_weight(p, as_of, occ, dsn), **{f"res_{a}": b for a, b in p["results"].items()}))
    df = pd.DataFrame(rows)
    if len(df): df["weight_share"] = df.weight / df.weight.sum()
    return df

# ── install into the forecast ────────────────────────────────────────────────
REGISTRY = {}      # race key -> dict(series=..., audit=..., avg=...)
_CUR = {"st": None}

def _dedupe(p):
    # data preparation only, as in the forecast: one row per poll, LV kept over an RV version of the same poll
    # The key used to be the raw dates string, so the same poll entered twice under two spellings
    # of its field dates, "July 15-20 2026" and "July 15-20, 2026", survived as two rows and was
    # counted twice. Punctuation and case are stripped so only the actual content distinguishes polls.
    p = p.copy()
    _k = lambda x: re.sub(r"[^a-z0-9]", "", str(x).lower())
    p["key"] = p.source.map(_k) + "|" + p.dates.map(_k) + "|" + p.end.astype(str)
    p = p[~((p["pop"] == "RV") & p.key.isin(p[p["pop"] == "LV"].key))]
    extra = [c for c in p.columns if c not in ("key", "source", "dates", "end", "pop") and p[c].dtype != object]
    return p.groupby(["key", "source", "dates", "end", "pop"], as_index=False)[extra].mean()

def _final(polls, cands, as_of=AS_OF_DAILY):
    start = min(p["endDate"] for p in polls)
    ser = daily_series(polls, cands, start, as_of)
    return ser, ser[-1]

def install(sm):
    orig_parse = sm.parse_polls
    def parse_polls(st):
        _CUR["st"] = st
        return orig_parse(st)
    def _poll_avg(p):
        st = _CUR["st"]; cfg = sm.STATES[st]
        p = _dedupe(p)
        sp = cfg.get("split")
        cmap = {"Bodnar": sp["poll_col"], "Bankhead": sp["other_col"], "R": "R"} if sp else {"D": "D", "R": "R"}
        polls = frame_to_polls(p, cmap)
        ser, last = _final(polls, [k for k in cmap])
        aud = poll_audit(polls)
        if sp:
            D = last["Bodnar"] + last["Bankhead"]; R = last["R"]; O = last["Other"]
        else:
            D, R, O = last["D"], last["R"], last["Other"]
        out = dict(D=D, R=R, O=O, D2=D / (D + R), third=O / (D + R + O), method="daily")
        if sp:
            out["split_share"] = last["Bodnar"] / (last["Bodnar"] + last["Bankhead"])
        wmap = dict(zip(zip(aud.pollster, aud.end), aud.weight)) if len(aud) else {}
        p["w"] = [wmap.get((s, pd.Timestamp(e).date().isoformat()), 0.0) for s, e in zip(p.source, p.end)]
        REGISTRY[st] = dict(series=ser, audit=aud, avg=out)
        return p, out
    def _poll_avg_rcv(p):
        st = _CUR["st"]
        p = p.copy()
        for c in ["D", "R", "O", "U", "n"]: p[c] = p[c].astype(float)
        fc = p.kind == "first_choice"
        p["D1"], p["R1"], p["O1"] = p.D, p.R, p.O
        p.loc[fc, "D"] = p.D1 + sm.AK_RCV["to_D"] * p.O1
        p.loc[fc, "R"] = p.R1 + sm.AK_RCV["to_R"] * p.O1
        p["key"] = p.source + "|" + p.dates
        fin = p.assign(O=0.0)
        polls = frame_to_polls(fin, {"D": "D", "R": "R"})
        ser, last = _final(polls, ["D", "R"])
        aud = poll_audit(polls)
        f = p[fc]
        fpolls = frame_to_polls(f.assign(D=f.D1, R=f.R1, O=np.nan), {"D": "D", "R": "R", "Dan J. Sullivan": "dan_j_sullivan", "Gerald Heikes": "heikes"})
        for q, (_, r) in zip(fpolls, f.iterrows()):
            q["results"]["Other"] = float(r.O1)
        _, fl = _final(fpolls, ["D", "R", "Dan J. Sullivan", "Gerald Heikes"])
        D, R = last["D"], last["R"]; D1, R1 = fl["D"], fl["R"]
        thirds = {"Dan J. Sullivan": fl["Dan J. Sullivan"], "Gerald Heikes": fl["Gerald Heikes"]}
        O1 = sum(thirds.values())
        wmap = dict(zip(zip(aud.pollster, aud.end), aud.weight)) if len(aud) else {}
        p["O"] = 0.0
        p["w"] = [wmap.get((s, pd.Timestamp(e).date().isoformat()), 0.0) for s, e in zip(p.source, p.end)]
        out = dict(D=D, R=R, O=0.0, D2=D / (D + R), third=O1 / (D1 + R1 + O1), first_choice=dict(D=D1, R=R1, **thirds),
                   first_choice_share={k: v / (D1 + R1 + O1) for k, v in thirds.items()}, method="daily")
        REGISTRY[st] = dict(series=ser, audit=aud, avg=out)
        return p, out
    sm.parse_polls = parse_polls; sm._poll_avg = _poll_avg; sm._poll_avg_rcv = _poll_avg_rcv
