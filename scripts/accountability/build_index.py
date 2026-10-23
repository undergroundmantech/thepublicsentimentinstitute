"""Accountability Index for the current Congress.

Reads the collected source files in scripts/accountability/data and writes public/accountability/index.json and
dots.json. Every part is on a 0 to 100 scale where 100 is better:

  lobby    pro-Israel lobby money over a career, TrackAIPAC's Israel Lobby Total, on a log scale
  pac      the share of this cycle's receipts that came from PACs and other non-party committees, FEC
  trading  stock trades reported in the last year and their estimated volume, Quiver Quantitative
  cross    crossing the aisle: eight interest group scorecards, four that lean left and four that lean right.
           Each scorecard is rescaled so the average Democrat and the average Republican sit at the same points,
           0 for the party it opposes and 100 for the party it backs, so no party starts ahead. The left cards
           are averaged, the right cards are averaged with the America First Foundation counted twice, and the
           part is the mean of the two sides. A typical member of either party lands near 50; a member who
           earns credit from both sides scores higher.

Weights are lobby 22, PAC 22, trading 16 and crossing the aisle 40. A part with no data takes the median of every
member who has it, so a gap neither helps nor hurts, and the member is marked partial. A side of the scorecard part
with no card on file takes that side's median. A member is ranked only with FEC campaign money on file. Votes that
benefited a member's donors are not scored yet.

Run: python3 scripts/accountability/build_index.py
"""
import json, math, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
D = lambda f: json.load(open(os.path.join(HERE, "data", f)))
OUT = os.path.join(HERE, "..", "..", "public", "accountability", "index.json")

roster = D("roster.json"); aipac = D("aipac.json"); aff = D("aff.json"); trades = D("trades.json"); money = D("money.json"); cards = D("scorecards.json")["cards"]
W = {"lobby": 22, "pac": 22, "trading": 16, "cross": 40}

# the scorecards: id, file, lean, weight inside its side
CARDS = [
    ("lcv", "League of Conservation Voters", "L", 1), ("ppunch", "ProgressivePunch", "L", 1), ("aflcio", "AFL-CIO", "L", 1), ("hrc", "Human Rights Campaign", "L", 1),
    ("heritage", "Heritage Action", "R", 1), ("acu", "CPAC ratings", "R", 1), ("cfg", "Club for Growth", "R", 1), ("aff", "America First Foundation", "R", 2),
]
CARD_RAW = {}
for cid, nm, lean, w in CARDS:
    if cid in ("lcv", "heritage"):
        c = cards[cid]; CARD_RAW[cid] = {"name": c["name"], "source": c["source"], "year": "2025" if cid == "lcv" else "119th Congress", "members": c["members"]}
    elif cid == "aff":
        CARD_RAW[cid] = {"name": "America First Foundation", "source": aff["source"], "year": "117th to 119th Congress",
                         "members": {k: {"score": round(100 * v["aligned"] / v["total"], 1), "lifetime": None, "url": v["url"], "grade": v["grade"]} for k, v in aff["members"].items() if v.get("total")}}
    else:
        c = D(f"card_{cid}.json"); CARD_RAW[cid] = {"name": c["name"], "source": c["source"], "year": c["year"], "members": c["members"]}
PARTY = {m["bio"]: m["party"][0] for m in roster}
CARD_META = []
for cid, nm, lean, w in CARDS:
    ms = CARD_RAW[cid]["members"]
    def mean(p): xs = [v["score"] for k, v in ms.items() if v.get("score") is not None and PARTY.get(k) == p]; return sum(xs) / len(xs)
    mD, mR = mean("D"), mean("R")
    lo, hi = (mR, mD) if lean == "L" else (mD, mR)     # the party the card opposes sits at 0, the party it backs at 100
    CARD_META.append({"id": cid, "name": nm, "lean": lean, "w": w, "year": CARD_RAW[cid]["year"], "source": CARD_RAW[cid]["source"], "meanD": round(mD, 1), "meanR": round(mR, 1), "lo": lo, "hi": hi})
def norm(meta, x): return 100 * (x - meta["lo"]) / (meta["hi"] - meta["lo"])   # not clipped, so each party averages exactly 0 or 100 on every card

# trades a source-cited correction adds where the Quiver table missed a member
TRADE_FIX = {
    "S001229": {"trades": 11, "volume": None, "url": "https://curvedtrading.com/congress/member/jefferson-shreve/",
                "note": "Missing from the Quiver table; CurvedTrading lists 11 transactions from Dec 29 2025 to May 20 2026, mostly annuities and structured notes, with no volume total."},
}

def clamp(x): return max(0.0, min(100.0, x))
def lobby_score(amt): return round(clamp(100 * (1 - math.log10(1 + amt / 1000) / math.log10(1 + 10000))), 1)
def pac_score(share): return round(clamp(100 * (1 - share / 0.7)), 1)
def trade_score(n, vol):
    a = clamp(100 - 22 * math.log10(1 + n))
    if vol is None: return round(a, 1)
    b = clamp(100 - 20 * math.log10(1 + vol / 1000))
    return round((a + b) / 2, 1)
def grade(x):
    return "A" if x >= 75 else "B" if x >= 66 else "C" if x >= 57 else "D" if x >= 48 else "F"

P = {"Democrat": "D", "Republican": "R", "Independent": "I"}
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split()
AIPAC_UNREAD = {"WA", "WV", "WI", "WY"}

out = []
for m in roster:
    b = m["bio"]; st = m["state"]
    seat = f"{st} Senate" if m["chamber"] == "senate" else (f"{st} at large" if (m["district"] in (0, None)) else f"{st}-{int(m['district']):02d}")
    r = {"id": b, "slug": slug(m["name"]) + "-" + b.lower(), "name": m["name"], "last": m["last"], "ch": "S" if m["chamber"] == "senate" else "H",
         "st": st, "dist": m["district"], "seat": seat, "party": P.get(m["party"], "I"), "since": m["start"][:4], "parts": {}, "src": {}}
    deleg = st not in STATES
    # lobby money
    a = aipac["members"].get(b)
    if a:
        amt = a["amount"]
        approved = amt is None and "Approved" in (a.get("label") or "")
        val = 0 if approved else amt
        r["lobby"] = {"amount": val, "pacs": a.get("pacs_or_donations"), "ie": a.get("ie"), "approved": approved, "tags": a.get("tags")}
        if val is not None: r["parts"]["lobby"] = lobby_score(val)
    else:
        r["lobby"] = {"missing": "not listed by TrackAIPAC" if deleg else "page could not be read" if st in AIPAC_UNREAD else "not listed by TrackAIPAC"}
    # PAC share
    f = money["members"].get(b)
    if f:
        r["money"] = {k: f.get(k) for k in ("raised", "pac", "pacShare", "individual", "partyCommittees", "period", "coverageThrough", "url")}
        if f.get("note"): r["money"]["note"] = f["note"]
        if f.get("pacShare") is not None and (f.get("raised") or 0) >= 25000: r["parts"]["pac"] = pac_score(f["pacShare"])
    # trading
    t = trades["members"].get(b) or TRADE_FIX.get(b)
    if t:
        r["trades"] = {"n": t["trades"], "volume": t.get("volume"), "url": t.get("url")}
        if t.get("note") or b in TRADE_FIX: r["trades"]["note"] = (t.get("note") or TRADE_FIX[b]["note"])
        r["parts"]["trading"] = trade_score(t["trades"], t.get("volume"))
    else:
        r["trades"] = {"n": 0, "volume": 0, "none": True}
        r["parts"]["trading"] = 100.0
    # the scorecards, left and right, rescaled so neither party starts ahead
    r["cards"] = {}; side = {"L": [], "R": []}
    for meta in CARD_META:
        v = CARD_RAW[meta["id"]]["members"].get(b)
        if not v or v.get("score") is None: continue
        n = round(norm(meta, v["score"]), 1)
        r["cards"][meta["id"]] = {"score": v["score"], "lifetime": v.get("lifetime"), "url": v.get("url"), "norm": n, **({"grade": v["grade"]} if v.get("grade") else {})}
        side[meta["lean"]].append((n, meta["w"]))
    # a side needs at least two cards on file; delegates and new members with one card take the party median
    r["side"] = {k: (round(sum(n * w for n, w in xs) / sum(w for _, w in xs), 1) if len(xs) >= 2 else None) for k, xs in side.items()}
    x = aff["members"].get(b)
    if x: r["aff"] = {"grade": x["grade"], "aligned": x.get("aligned"), "total": x.get("total"), "url": x["url"]}
    out.append(r)

# the index: a part with no data takes the median of every member who has it, so a gap neither helps nor hurts,
# and the member is marked partial. A member is ranked only with FEC campaign money on file.
import statistics
# a side with no card takes the median of that member's own party on that side; independents use the Democrats'
pk = lambda r: "R" if r["party"] == "R" else "D"
SIDE_MED = {p: {k: statistics.median([r["side"][k] for r in out if r["side"][k] is not None and pk(r) == p]) for k in ("L", "R")} for p in ("D", "R")}
for r in out:
    if r["side"]["L"] is None and r["side"]["R"] is None: continue
    r["sideImputed"] = [k for k in ("L", "R") if r["side"][k] is None]
    L = r["side"]["L"] if r["side"]["L"] is not None else SIDE_MED[pk(r)]["L"]; R = r["side"]["R"] if r["side"]["R"] is not None else SIDE_MED[pk(r)]["R"]
    r["parts"]["cross"] = round(max(0.0, min(100.0, (L + R) / 2)), 1)
MED = {k: statistics.median([r["parts"][k] for r in out if k in r["parts"]]) for k in W}
for r in out:
    have = [k for k in W if k in r["parts"]]
    r["coverage"] = len(have)
    if "pac" not in r["parts"]: continue
    r["imputed"] = [k for k in W if k not in r["parts"]]
    val = {k: r["parts"].get(k, MED[k]) for k in W}
    r["index"] = round(sum(W[k] * val[k] for k in W) / sum(W.values()), 1)
    r["grade"] = grade(r["index"])
ranked = sorted([r for r in out if "index" in r], key=lambda r: (-r["index"], -r["coverage"], r["last"]))
for i, r in enumerate(ranked): r["rank"] = i + 1
others = [{k: o.get(k) for k in ("name", "office", "party", "amount", "amount_text", "label", "url")} for o in aipac["others"]]
doc = {
    "updated": "2026-10-22", "count": len(out), "ranked": len(ranked), "weights": W, "medians": {k: round(v, 1) for k, v in MED.items()}, "sideMedians": SIDE_MED, "cards": [{k: v for k, v in c.items() if k not in ("lo", "hi")} for c in CARD_META],
    "sources": {
        "lobby": {"name": "TrackAIPAC", "url": "https://www.trackaipac.com/congress", "asof": "FEC data dated July 5 2026, read Oct 22 2026"},
        "pac": {"name": "FEC candidate pages", "url": "https://www.fec.gov/data/", "asof": "filings through Sept 30 2026 for most members"},
        "trading": {"name": "Quiver Quantitative", "url": "https://www.quiverquant.com/congresstrading/", "asof": "trailing year to Oct 22 2026"},
        "aff": {"name": "America First Foundation", "url": "https://americafirstfoundation.org/scorecard", "asof": "votes through June 30 2026"},
        "lcv": {"name": "League of Conservation Voters", "url": "https://www.lcv.org/congressional-scorecard/members-of-congress/", "asof": "2025 scorecard"},
        "heritage": {"name": "Heritage Action for America", "url": "https://heritageaction.com/scorecard/members", "asof": "119th Congress to Oct 22 2026"},
        "roster": {"name": "unitedstates/congress-legislators", "url": "https://github.com/unitedstates/congress-legislators"},
    },
    "members": out, "others": others,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(doc, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
# a slim file for the charts on every member page
dots = [{"slug": r["slug"], "name": r["name"], "seat": r["seat"], "party": r["party"], "ch": r["ch"], "index": r.get("index"), "grade": r.get("grade"), "rank": r.get("rank"),
         "lobby": r["lobby"].get("amount"), "pac": (r.get("money") or {}).get("pacShare"), "trades": r["trades"]["n"], "cross": r["parts"].get("cross"), "sL": r["side"]["L"], "sR": r["side"]["R"]} for r in out]
json.dump(dots, open(os.path.join(os.path.dirname(OUT), "dots.json"), "w"), separators=(",", ":"), ensure_ascii=False)
from collections import Counter
print(len(out), "members,", len(ranked), "ranked", Counter(r.get("grade") for r in out), "bytes", os.path.getsize(OUT))
