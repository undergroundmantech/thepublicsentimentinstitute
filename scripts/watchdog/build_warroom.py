"""War Room data (Oct 25 2026).

The War Room is the Watchdog's command center for campaign watchers and campaign staff. For every Senate, governor
and contested House race it builds:
  campaign health for both candidates, the Ledger formula: Money 25, Cash 20, Momentum 15, Air cover 15,
    Early vote 15 (7 for the House), Activity 10, each scored 0 to 1 from public moves only, weighted, then liabilities
    taken off. Parts without data are left out, never guessed. A snapshot of position, not a forecast.
  the forecast, the polls, the money, the air war and the early vote in one place
  the path to victory for each side, written for a Democratic or a Republican operative, from the forecast, the polls,
    the county map, the coalition crosstabs, the money and the early vote
  the scouting report for both candidates from the watchdog people files, the media watch and the news desk

Inputs: public/forecast/model.json, counties.json, crosstabs.json, pres24_counties.json; public/watchdog/money.json,
trail.json, people/index.json and people/p/*.json; public/news/stories.json; the newest early vote snapshot's
ev_signals.json; and the forecast finance books in FIN_DIR.
Usage: python3 -I scripts/watchdog/build_warroom.py SITE_DIR [FIN_DIR, default /tmp/fcrun/fin_1025]
Writes public/watchdog/warroom/index.json and public/watchdog/warroom/r/<race id>.json. Rerun after every publish.
"""
import glob, json, math, os, re, sys
from datetime import date, datetime, timedelta

SITE = sys.argv[1]
FIN = sys.argv[2] if len(sys.argv) > 2 else "/tmp/fcrun/fin_1025"
P = lambda *a: os.path.join(SITE, *a)
J = lambda p, d=None: json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d
OUT = P("public/watchdog/warroom")
os.makedirs(os.path.join(OUT, "r"), exist_ok=True)
for f in glob.glob(os.path.join(OUT, "r", "*.json")): os.remove(f)

model = J(P("public/forecast/model.json"))
TODAY = os.environ.get("TODAY") or model["meta"].get("updated") or date.today().isoformat()
T0 = date.fromisoformat(TODAY[:10])
counties = J(P("public/forecast/counties.json"), {})
crosstabs = J(P("public/forecast/crosstabs.json"), {})
pres = J(P("public/forecast/pres24_counties.json"), {"c": {}})["c"]
money = J(P("public/watchdog/money.json"), {"races": [], "adBuys": [], "campaigns": []})
trail = J(P("public/watchdog/trail.json"), {"visits": [], "attention": []})
pidx = J(P("public/watchdog/people/index.json"), {"people": []})["people"]
news = J(P("public/news/stories.json"), {"stories": []})["stories"]
fin = {"senate": J(os.path.join(FIN, "sen_finance.json"), {}), "governor": J(os.path.join(FIN, "gov_finance.json"), {}), "house": J(os.path.join(FIN, "house_finance.json"), {})}
snaps = sorted(glob.glob(P("scripts/forecast/earlyvote/snapshots/*/ev_signals.json")))
evsig = (J(snaps[-1]) or {}).get("states", {}) if snaps else {}
ev_date = os.path.basename(os.path.dirname(snaps[-1])) if snaps else None

FIPS = {"01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY"}
pres_st = {}
for f, (d, r, o) in pres.items():
    st = FIPS.get(f[:2])
    if st: a = pres_st.setdefault(st, [0, 0, 0]); a[0] += d; a[1] += r; a[2] += o
PRES = {st: 100 * (r - d) / max(1, d + r + o) for st, (d, r, o) in pres_st.items()}
cname = counties.get("_n", {})
clamp = lambda v, lo=0.0, hi=1.0: max(lo, min(hi, v))


def usd(n):
    if n is None: return "n/a"
    n = float(n)
    return f"${n / 1e9:.2f}B" if n >= 1e9 else f"${n / 1e6:.1f}M" if n >= 1e6 else f"${round(n / 1e3)}K" if n >= 1e3 else f"${round(n)}"


def side_m(m, side):  # race margins are R minus D
    return -m if side == "D" else m


def lead(v, side_word):
    return "even" if abs(v) < 0.05 else f"{side_word} +{abs(v):.1f}"


def dt(s):
    try: return date.fromisoformat(str(s)[:10])
    except Exception: return None


# ------------------------------------------------------------- people files
def norm(s): return re.sub(r"[^a-z ]", "", (s or "").lower()).strip()
def last(s): return norm(s).replace(" jr", "").replace(" sr", "").split(" ")[-1] if s else ""
OFF = {"senate": "U.S. Senate", "governor": "Governor", "house": "U.S. House"}


def person_for(race, name):
    want = OFF[race["office"]]
    for p in pidx:
        if p["st"] != race["st"] or not (p.get("office") or "").startswith(want): continue
        if race["office"] == "house" and str(p.get("district") or "").lstrip("0") != str(race["district"]).lstrip("0"): continue
        if last(p["name"]) == last(name) or norm(p["name"]) == norm(name): return p
    return None


def intel_of(pid):
    if not pid: return None
    j = J(P("public/watchdog/people/p", pid + ".json"))
    if not j: return None
    notes = j.get("notes") or ""
    m = re.search(r"## Campaign intel\s*\n(.*?)(?:\n## |\Z)", notes, re.S)
    bullets = []
    if m:
        for line in m.group(1).splitlines():
            line = line.strip()
            if line.startswith(("- ", "* ")):
                t = line[2:].strip()
                url = re.findall(r"https?://\S+", t)
                text = re.sub(r"\s*https?://\S+", "", t)
                text = re.sub(r"[\s,;:]+(and|or)?[\s.,;:]*$", "", text).strip(" .;:")
                lm = re.match(r"\*\*(.+?)\*\*\s*(.*)", text)
                lab, text = (lm.group(1).strip(" .:"), lm.group(2)) if lm else (None, text)
                text = text.replace("**", "").strip()
                if text: bullets.append({"l": lab, "t": text + ("" if text.endswith((".", "?", "!")) else "."), "u": url[0].rstrip(").,") if url else None})
    bl = re.search(r"## Bottom line[^\n]*\n(.*?)(?:\n## |\Z)", j.get("profile") or "", re.S)
    bottom = [re.sub(r"^\s*[-*\d.]+\s*", "", x).strip() for x in (bl.group(1).splitlines() if bl else []) if x.strip()][:4]
    contested = sum(1 for e in j.get("edgesRows") or [] if (e.get("status") or "").lower() == "contested")
    return {"id": pid, "tier": j.get("tier"), "hand": j.get("hand"), "intel": bullets[:6], "bottom": bottom, "contested": contested,
            "edges": j.get("edges"), "blocs": (j.get("meta") or {}).get("top_blocs") or []}


# ------------------------------------------------------------- money for one side
def money_of(race, side):
    o = race["office"]
    if o == "senate": f = fin["senate"].get(race["st"], {}).get(side)
    elif o == "governor": f = fin["governor"].get(race["st"] + "G", {}).get(side)
    else: f = fin["house"].get(f"{race['st']}-{int(race['district']):02d}", {}).get(side)
    if not f: return None
    rec, cash, outside, asof = f.get("receipts"), f.get("cash_on_hand"), f.get("outside_for"), None
    if rec is None:
        for lab, v in f.get("items") or []:
            l = lab.lower()
            if "outside" in l: outside = (outside or 0) + v
            elif "cash" in l and cash is None: cash = v
            elif ("raised" in l or "spent" in l) and rec is None: rec = v
    if f.get("as_of"): asof = (f["as_of"] or [None])[0]
    rec = rec or None; cash = cash or None   # a zero in the books means no report was found, not an empty account
    ads = f.get("google_ads")
    return {"receipts": rec, "cash": cash, "outside_for": outside, "spent": f.get("spent"), "google_ads": ads if isinstance(ads, (int, float)) else None,
            "mix": f.get("mix"), "as_of": asof}


MRACE = {(r["st"], r["office"].lower().split()[0]): r for r in money["races"]}


# ------------------------------------------------------------- campaign health, the Ledger formula
def health(race, side, cand, me, rv, rival, info):
    parts, pens = [], []
    rv = rv or {}
    if me and me.get("receipts") and rv.get("receipts"):
        r, R = me["receipts"], rv["receipts"]
        parts.append({"key": "money", "label": "Money", "w": 25, "v": r / (r + R), "why": [f"Raised {usd(r)} against {usd(R)} for {rival}."]})
    elif me and me.get("spent") and rv.get("spent"):
        r, R = me["spent"], rv["spent"]
        parts.append({"key": "money", "label": "Money", "w": 25, "v": r / (r + R), "why": [f"Spent {usd(r)} against {usd(R)} for {rival}.", "One side has no receipts report on file, so spending stands in."]})
    if me and me.get("cash") and rv.get("cash"):
        c, C = me["cash"], rv["cash"]
        v = c / (c + C) if (c + C) else 0.5
        why = [f"{usd(c)} in the bank against {usd(C)} for {rival}."] + ([f"As of {me['as_of']}."] if me.get("as_of") else [])
        parts.append({"key": "cash", "label": "Cash", "w": 20, "v": clamp(v), "why": why})
    # Momentum needs a prior report on file; the forecast books hold one report per candidate, so it is left out until they do
    helps, hurts = (me or {}).get("outside_for") or 0, (rv or {}).get("outside_for") or 0
    mr = MRACE.get((race["st"], race["office"]))
    if mr and race["office"] != "house":
        helps = max(helps, (mr["forD"] if side == "D" else mr["forR"]) or 0); hurts = max(hurts, (mr["forR"] if side == "D" else mr["forD"]) or 0)
    if helps + hurts >= 10_000:
        parts.append({"key": "air", "label": "Air cover", "w": 15, "v": helps / (helps + hurts),
                      "why": [f"Outside groups spent {usd(helps)} helping {cand} and {usd(hurts)} helping {rival}."]})
    sg = evsig.get(race["st"])
    if sg and (sg.get("estimatedShare") or 0) < 0.5 and sg.get("ballots"):
        pt = sg["party"]; my, ot = (pt["d"], pt["r"]) if side == "D" else (pt["r"], pt["d"])
        delta = (sg.get("delta") or 0) / 100 * (-1 if side == "D" else 1)   # delta is R minus D against expectation
        v = clamp(0.5 + clamp(my - ot, -0.3, 0.3) * 1.2 + clamp(delta, -0.1, 0.1))
        party = "Democrats" if side == "D" else "Republicans"
        parts.append({"key": "early_vote", "label": "Early vote", "w": 7 if race["office"] == "house" else 15, "v": v,
                      "why": [f"Registered {party} cast {round(100 * my)}% of the {sg['ballots']:,} ballots in {race['state']} so far, against {round(100 * ot)}% for the other party.",
                              f"That is {abs(sg.get('delta') or 0):.1f} points {'better' if delta >= 0 else 'worse'} for {party} than the forecast expected by now."]
                      + (["Statewide numbers; this weighs less for a House race."] if race["office"] == "house" else []) + ["Counts registration, not votes."]})
    # activity: trail stops, media attention, online ads and headlines in the last weeks
    act, why = 0.0, []
    vis = [v for v in trail["visits"] if fits(v, race) and v.get("party") == side and dt(v.get("date")) and timedelta(0) <= T0 - dt(v["date"]) <= timedelta(days=30)]
    if vis: act += 0.25; why.append(f"{len(vis)} campaign stop{'s' if len(vis) != 1 else ''} by the candidate or surrogates in 30 days.")
    att = [a for a in trail["attention"] if a.get("st") == race["st"] and cand.split()[-1] in (a.get("what") or "") and dt(a.get("when")) and T0 - dt(a["when"]) <= timedelta(days=14)]
    if att: act += 0.25; why.append(f"{len(att)} mention{'s' if len(att) != 1 else ''} on shows and podcasts in two weeks.")
    if me and (me.get("google_ads") or 0) > 0: act += 0.25; why.append(f"{usd(me['google_ads'])} in Google political ads this cycle.")
    hl = [s for s in news if (cand in s["title"] + s.get("dek", "") or (race["state"] in s["title"] + s.get("dek", "") and cand.split()[-1] in s["title"] + s.get("dek", ""))) and dt(s.get("date")) and T0 - dt(s["date"]) <= timedelta(days=14)]
    if hl: act += 0.25; why.append(f"{len(hl)} stor{'ies' if len(hl) != 1 else 'y'} on the On Point news desk in two weeks.")
    if why: parts.append({"key": "activity", "label": "Activity", "w": 10, "v": act, "why": why})
    # liabilities
    if me and me.get("cash") is not None and rv and rv.get("cash") and (me["cash"] or 0) * 5 < rv["cash"]:
        pens.append({"key": "cash_gap", "label": "Outmatched five to one in cash", "pts": 4, "why": f"{usd(me['cash'])} against {usd(rv['cash'])}."})
    if info and info.get("contested"):
        pens.append({"key": "contested", "label": "Contested items in the watchdog file", "pts": min(8, 2 * info["contested"]),
                     "why": f"{info['contested']} allegation{'s' if info['contested'] != 1 else ''} on file that the campaign disputes; opponents can run on them."})
    tot = sum(p["w"] for p in parts)
    has_money = any(p["key"] in ("money", "cash") for p in parts)
    base = round(100 * sum(p["w"] * p["v"] for p in parts) / tot) if tot and has_money else None
    score = None if base is None else max(0, base - sum(p["pts"] for p in pens))
    lab = "Not enough data" if score is None else "Strong" if score >= 70 else "Stable" if score >= 55 else "Strained" if score >= 40 else "Critical"
    for p in parts: p["v"] = round(p["v"], 3)
    return {"score": score, "base": base, "label": lab, "parts": parts, "pens": pens}


# ------------------------------------------------------------- the map and the coalition
def map_targets(race, side):
    cs = counties.get(race["id"])
    if not cs: return None
    rows = []
    for f, v in cs.items():
        if not isinstance(v, list) or len(v) < 4: continue
        m, d, r, t = v[0], v[1], v[2], v[3]
        p = pres.get(f)
        pm = 100 * (p[1] - p[0]) / max(1, sum(p)) if p else None
        rows.append({"f": f, "n": cname.get(f, f), "m": m, "net": (d - r) if side == "D" else (r - d), "t": t, "pm": pm})
    T = sum(x["t"] for x in rows) or 1
    base = sorted([x for x in rows if x["net"] > 0], key=lambda x: -x["net"])[:4]
    bg = sorted([x for x in rows if abs(x["m"]) < 12 and x["t"] / T >= 0.004], key=lambda x: -x["t"])[:4]
    stm = race["est"]["margin"]; stp = PRES.get(race["st"])
    # counties where the side runs behind its usual share, relative to the state, against the 2024 presidential vote
    gap = []
    if stp is not None:
        for x in rows:
            if x["pm"] is None or x["t"] / T < 0.01: continue
            rel = side_m((x["m"] - stm) - (x["pm"] - stp), side)
            gap.append((rel, x))
        gap = [x for rel, x in sorted(gap, key=lambda g: g[0])[:3] if rel < -1.5]
    fmt = lambda x: {"name": x["n"], "m": round(x["m"], 1), "share": round(100 * x["t"] / T, 1), "net": round(x["net"]), "pres24": None if x["pm"] is None else round(x["pm"], 1)}
    return {"base": [fmt(x) for x in base], "battle": [fmt(x) for x in bg], "lag": [fmt(x) for x in gap]}


PARTISAN = {"Democrat", "Republican", "Harris", "Trump", "Approve", "Disapprove", "Liberal", "Conservative", "Right track", "Wrong track"}
NICE = {"Difficult": "Voters who find daily costs hard to afford", "Not difficult": "Voters who can afford daily costs", "Independent": "Independents",
        "Moderate": "Moderates", "Other or did not vote": "2024 nonvoters and third party voters", "White": "White voters", "Black": "Black voters",
        "Latino": "Latino voters", "Asian and other": "Asian and other voters", "Men": "Men", "Women": "Women", "18 to 29": "Voters 18 to 29",
        "30 to 44": "Voters 30 to 44", "45 to 64": "Voters 45 to 64", "65+": "Voters 65 and older", "College graduate": "College graduates",
        "No college degree": "Voters without a degree", "Under $50K": "Incomes under $50K", "$50K to $124K": "Incomes $50K to $124K", "$125K and up": "Incomes $125K and up",
        "Voted in 2022 and 2024": "Voters who cast ballots in 2022 and 2024", "Voted in 2024, not 2022": "2024 voters who skipped 2022",
        "Voted in 2022, not 2024": "2022 voters who skipped 2024", "New or irregular voter": "New and irregular voters",
        "Large, 250K+ adults": "Large counties", "Midsize, 50K to 250K": "Midsize counties", "Small, under 50K": "Small counties",
        "Economy and cost of living": "Economy voters", "Health care and Social Security": "Health care and Social Security voters",
        "Immigration": "Immigration voters", "Corruption": "Corruption voters", "Something else": "Other issue voters"}


def coalition(race, side):
    ct = crosstabs.get(race["id"])
    if not ct: return None
    out = []
    for g, lab, share, d, r, o in ct:
        if g in ("All voters", "Race and gender", "Race and education") or share < 4 or lab in PARTISAN: continue
        mine, theirs = (d, r) if side == "D" else (r, d)
        out.append({"group": g, "label": NICE.get(lab, lab), "share": share, "mine": mine, "theirs": theirs, "lever": round(share * 5 / 100, 2), "close": abs(mine - theirs)})
    swing = sorted([x for x in out if x["close"] < 25], key=lambda x: (-x["share"], x["close"]))[:4]
    strong = sorted(out, key=lambda x: -(x["mine"] - x["theirs"]))[:3]
    weak = sorted(out, key=lambda x: (x["mine"] - x["theirs"]))[:3]
    return {"swing": swing, "strong": strong, "weak": weak}


# ------------------------------------------------------------- the path to victory, for one side's operative
def path(race, side, H, M, mapt, coal, info_me, info_opp):
    me, op = (race["dem"], race["gop"]) if side == "D" else (race["gop"], race["dem"])
    party = "Democrats" if side == "D" else "Republicans"
    sw = "D" if side == "D" else "R"
    m = side_m(race["est"]["margin"], side); pwin = 1 - race["est"]["prob"] if side == "D" else race["est"]["prob"]   # est.prob is the Republican's chance
    total = (race.get("votes") or {}).get("total") or 0
    out = []
    if m >= 0:
        out.append({"k": "position", "h": "Protect the lead", "t": f"{me} leads by {m:.1f} in the forecast and wins {round(100 * pwin)}% of simulations. The cushion is about {round(abs(m) / 100 * total):,} votes; a one point swing is about {round(total / 200):,} voters changing sides."})
    else:
        out.append({"k": "position", "h": "Close the gap", "t": f"{me} trails by {abs(m):.1f} and wins {round(100 * pwin)}% of simulations. Closing it takes about {round(abs(m) / 100 * total / 2):,} voters switching sides, or {round(abs(m) / 100 * total):,} more net votes from new turnout."})
    lo, hi = race["est"].get("p10"), race["est"].get("p90")
    if lo is not None and hi is not None:
        best = max(side_m(lo, side), side_m(hi, side)); worst = min(side_m(lo, side), side_m(hi, side))
        out.append({"k": "range", "h": "The range", "t": f"In 8 of 10 simulations the result lands between {lead(worst, sw) if worst >= 0 else lead(-worst, 'R' if side == 'D' else 'D')} and {lead(best, sw) if best >= 0 else lead(-best, 'R' if side == 'D' else 'D')}. {'A normal polling error decides it.' if worst < 0 < best else 'Only an unusual polling error changes the winner.'}"})
    ps = [p for p in race.get("polls") or [] if p.get("age", 99) <= 30 and isinstance(p.get("margin"), (int, float))]
    if ps:
        b = max(ps, key=lambda p: side_m(p["margin"], side)); w = min(ps, key=lambda p: side_m(p["margin"], side))
        pa = race.get("pollAvg")
        avg = f"The polls page average is {lead(side_m(pa, side), sw) if pa is not None and side_m(pa, side) >= 0 else lead(-side_m(pa, side), 'R' if side == 'D' else 'D') if pa is not None else 'not set'}. "
        out.append({"k": "polls", "h": "The polls", "t": avg + f"Your best recent poll is {b['pollster']} at {lead(side_m(b['margin'], side), sw) if side_m(b['margin'], side) >= 0 else lead(-side_m(b['margin'], side), 'R' if side == 'D' else 'D')}; your worst is {w['pollster']} at {lead(side_m(w['margin'], side), sw) if side_m(w['margin'], side) >= 0 else lead(-side_m(w['margin'], side), 'R' if side == 'D' else 'D')}. {len(ps)} polls in the last 30 days."})
    if mapt:
        if mapt["base"]: out.append({"k": "turnout", "h": "Turn out the base", "t": "The biggest vote banks for " + party + ": " + "; ".join(f"{c['name']}, a projected net {c['net']:,} votes" for c in mapt["base"][:3]) + ". Every point of extra turnout here is worth more than persuasion anywhere else."})
        if mapt["battle"]: out.append({"k": "persuade", "h": "Win the battlegrounds", "t": "The large counties within 12 points: " + "; ".join(f"{c['name']}, {lead(side_m(c['m'], side), sw) if side_m(c['m'], side) >= 0 else lead(-side_m(c['m'], side), 'R' if side == 'D' else 'D')}, {c['share']}% of the vote" for c in mapt["battle"]) + "."})
        if mapt["lag"]: out.append({"k": "lag", "h": "Where you run behind the 2024 map", "t": "Against the 2024 presidential vote, " + me + " runs furthest behind in " + ", ".join(c["name"] for c in mapt["lag"]) + ". That is where the forecast sees voters who backed your side two years ago and have not come back yet."})
    if coal:
        if coal["swing"]: out.append({"k": "coalition", "h": "The coalition levers", "t": "Groups big enough to move the race: " + "; ".join(f"{x['label']}, {x['share']:.0f}% of voters, {x['mine']:.0f} to {x['theirs']:.0f}, where a 5 point gain is worth {x['lever']:.2f} points" for x in coal["swing"][:3]) + "."})
        if coal["weak"]: out.append({"k": "weak", "h": "Where you lose ground", "t": "The forecast's worst groups for " + me + ": " + ", ".join(f"{x['label']} {x['mine']:.0f} to {x['theirs']:.0f}" for x in coal["weak"]) + ". Cutting the loss here is often cheaper than winning new groups."})
    if M:
        mm, rr = M.get("me") or {}, M.get("rv") or {}
        if mm.get("cash") is not None and rr.get("cash"):
            ratio = (mm["cash"] or 0) / max(1, rr["cash"])
            t = f"{usd(mm['cash'])} cash against {usd(rr['cash'])}. " + ("Spend it early on persuasion television in the battleground counties and keep a reserve for the last week." if ratio >= 1.3 else "Roughly even money; the air war will be decided by outside groups and earned media." if ratio >= 0.75 else "Outspent: lean on earned media, digital, field and the outside groups, and pick the two or three media markets that decide it.")
            out.append({"k": "money", "h": "The money", "t": t})
    hp = {p["key"]: p for p in (H.get("me") or {}).get("parts", [])}
    if "early_vote" in hp: out.append({"k": "ev", "h": "The early vote", "t": " ".join(hp["early_vote"]["why"][:2])})
    ev = race.get("ev") or {}
    if abs(ev.get("shift") or 0) >= 0.1:
        s = ev["shift"]; good = (s < 0) == (side == "D")
        out.append({"k": "evf", "h": "What the ballots so far say", "t": f"The early vote has moved this forecast {abs(s):.1f} points {'toward' if good else 'away from'} {me}. {'Bank it: chase the remaining mail ballots and low propensity voters who have not voted.' if good else 'Election Day has to make it up: the remaining vote must break harder your way than the forecast expects.'}"})
    oh = H.get("op") or {}
    if oh.get("parts"):
        bestp = max(oh["parts"], key=lambda p: p["v"])
        out.append({"k": "threat", "h": f"{op}'s strongest asset", "t": f"{bestp['label']}: " + " ".join(bestp["why"][:1])})
    for x in (info_opp or {}).get("intel", [])[:2]:
        if re.search(r"vulnerab|attack|criticiz|controvers|weak|ethic|complaint|lawsuit|scandal", x["t"], re.I):
            out.append({"k": "opening", "h": "An opening", "t": x["t"], "u": x["u"]})
            break
    return out


OW = {"senate": "senate", "governor": "governor", "house": ""}


def fits(a, race):
    # a trail stop or a media mention belongs to the race when its race label names the state and office; House items must name a candidate
    if a.get("st") != race["st"]: return False
    lab = (a.get("race") or "").lower()
    if race["office"] != "house": return OW[race["office"]] in lab
    txt = " ".join(str(a.get(k) or "") for k in ("what", "note", "who")) + " ".join(a.get("for") or [])
    return any(last(race[k]) and last(race[k]) in norm(txt) for k in ("dem", "gop"))


def about(st, race):
    txt = st["title"] + " " + st.get("dek", "")
    return any(race[k] in txt for k in ("dem", "gop")) or (race["state"] in txt and any(race[k].split()[-1] in txt for k in ("dem", "gop")))


def party_of(race, name, dflt):
    for c in race.get("cands") or []:
        if c.get("name") == name: return {"IND": "I", "I": "I"}.get(c.get("party"), c.get("party") or dflt)[:1]
    return dflt


# ------------------------------------------------------------- build
index, n = [], 0
for race in model["races"]:
    if race["office"] not in ("senate", "governor", "house"): continue
    if race["office"] == "house" and (race["est"].get("prob") in (0.0, 1.0) or "No " in (race.get("gop") or "") or "No " in (race.get("dem") or "")): continue
    if not race.get("dem") or not race.get("gop"): continue
    pD, pR = person_for(race, race["dem"]), person_for(race, race["gop"])
    iD, iR = intel_of(pD["id"] if pD else None), intel_of(pR["id"] if pR else None)
    mD, mR = money_of(race, "D"), money_of(race, "R")
    hD = health(race, "D", race["dem"], mD, mR, race["gop"], iD)
    hR = health(race, "R", race["gop"], mR, mD, race["dem"], iR)
    mapD, mapR = map_targets(race, "D"), map_targets(race, "R")
    coD, coR = coalition(race, "D"), coalition(race, "R")
    mr = MRACE.get((race["st"], race["office"]))
    tr = [t for t in race.get("trend") or [] if isinstance(t, dict)]
    rec = {
        "id": race["id"], "office": race["office"], "st": race["st"], "state": race["state"], "district": race.get("district"), "name": race["name"],
        "dem": race["dem"], "gop": race["gop"], "dP": party_of(race, race["dem"], "D"), "rP": party_of(race, race["gop"], "R"), "inc": race.get("inc"), "open": race.get("open"), "pvi": race.get("pvi"), "pres24": None if race["st"] not in PRES else round(PRES[race["st"]], 1),
        "est": {k: race["est"].get(k) for k in ("margin", "prob", "p10", "p90")}, "pollAvg": race.get("pollAvg"), "trend": tr[-21:],
        "polls": [p for p in (race.get("polls") or []) if p.get("age", 99) <= 45][:12], "votes": race.get("votes"), "ev": race.get("ev"),
        "health": {"D": hD, "R": hR},
        "people": {"D": iD, "R": iR},
        "money": {"D": mD, "R": mR, "groups": (mr or {}).get("groups", [])[:12], "total": (mr or {}).get("total"),
                  "adBuys": [a for a in money.get("adBuys", []) if a.get("state") == race["st"] and (a.get("race") or "").lower().startswith(race["office"][:3])][:6]},
        "earlyVote": None if race["st"] not in evsig else {k: evsig[race["st"]].get(k) for k in ("ballots", "party", "estimatedShare", "actualMargin", "expectedMargin", "delta", "pace", "expectedEarly", "expectedTotal")} | {"date": ev_date},
        "paths": {"D": path(race, "D", {"me": hD, "op": hR}, {"me": mD, "rv": mR}, mapD, coD, iD, iR), "R": path(race, "R", {"me": hR, "op": hD}, {"me": mR, "rv": mD}, mapR, coR, iR, iD)},
        "map": {"D": mapD, "R": mapR}, "coalition": {"D": coD, "R": coR},
        "media": [a for a in trail["attention"] if fits(a, race)][:12],
        "visits": [v for v in trail["visits"] if fits(v, race)][-12:],
        "news": [{"id": s["id"], "title": s["title"], "date": s["date"]} for s in news if about(s, race)][:6],
        "similar": race.get("similar", [])[:4],
    }
    json.dump(rec, open(os.path.join(OUT, "r", race["id"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    n += 1
    tw = [t.get("m") for t in tr if isinstance(t.get("m"), (int, float))]
    index.append({"id": race["id"], "office": race["office"], "st": race["st"], "name": race["name"], "dem": race["dem"], "gop": race["gop"], "dP": party_of(race, race["dem"], "D"),
                  "m": race["est"]["margin"], "p": race["est"]["prob"], "d7": round(tw[-1] - tw[-8], 2) if len(tw) >= 8 else None,
                  "hD": hD["score"], "hR": hR["score"], "lD": hD["label"], "lR": hR["label"],
                  "files": [x for x in ((pD or {}).get("id") if (iD or {}).get("hand") else None, (pR or {}).get("id") if (iR or {}).get("hand") else None) if x],
                  "outside": (mr or {}).get("total"), "ev": (race.get("ev") or {}).get("shift")})
json.dump({"asOf": TODAY, "ev": ev_date, "ballots": sum((v.get("ballots") or 0) for v in evsig.values()), "evStates": len(evsig), "n": n, "races": index}, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
scored = [r for r in index if r["hD"] is not None and r["hR"] is not None]
print(f"war room: {n} races, {len(scored)} with both health scores, early vote {ev_date}")
