"""Accountability Index for the current Congress.

Reads the collected source files in scripts/accountability/data and writes public/accountability/index.json.
The index measures independence from special interest money and conflicts. It blends three measured parts,
each on a 0 to 100 scale where 100 is most independent:

  lobby    pro-Israel lobby money over a career, TrackAIPAC's Israel Lobby Total, on a log scale
  pac      the share of this cycle's receipts that came from PACs and other non-party committees, FEC
  trading  stock trades reported in the last year and their estimated volume, Quiver Quantitative

Weights are 35, 35 and 30. A part with no data is left out and the others are reweighted, and the member's
coverage is shown. A member is ranked only with FEC campaign money on file plus one more part. A fourth part, votes that benefited a member's donors, is not scored yet.
Ideological scorecards (America First Foundation, LCV, Heritage Action) are shown beside the index and never
blended into it.

Run: python3 scripts/accountability/build_index.py
"""
import json, math, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
D = lambda f: json.load(open(os.path.join(HERE, "data", f)))
OUT = os.path.join(HERE, "..", "..", "public", "accountability", "index.json")

roster = D("roster.json"); aipac = D("aipac.json"); aff = D("aff.json"); trades = D("trades.json"); money = D("money.json"); cards = D("scorecards.json")["cards"]
W = {"lobby": 35, "pac": 35, "trading": 30}

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
    return "A" if x >= 85 else "B" if x >= 72 else "C" if x >= 58 else "D" if x >= 44 else "F"

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
    # index
    have = [k for k in W if k in r["parts"]]
    # a member is ranked only with campaign money on file and at least one more measured part
    if "pac" in r["parts"] and len(have) >= 2:
        r["index"] = round(sum(W[k] * r["parts"][k] for k in have) / sum(W[k] for k in have), 1)
        r["grade"] = grade(r["index"])
    r["coverage"] = len(have)
    # beside the index, never blended
    x = aff["members"].get(b)
    if x: r["aff"] = {"grade": x["grade"], "aligned": x.get("aligned"), "total": x.get("total"), "url": x["url"]}
    for k in ("lcv", "heritage"):
        c = cards[k]["members"].get(b)
        if c: r[k] = {"score": c.get("score"), "lifetime": c.get("lifetime"), "url": c.get("url")}
    out.append(r)

ranked = sorted([r for r in out if "index" in r], key=lambda r: (-r["index"], -r["coverage"], r["last"]))
for i, r in enumerate(ranked): r["rank"] = i + 1
others = [{k: o.get(k) for k in ("name", "office", "party", "amount", "amount_text", "label", "url")} for o in aipac["others"]]
doc = {
    "updated": "2026-10-22", "count": len(out), "ranked": len(ranked), "weights": W,
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
from collections import Counter
print(len(out), "members,", len(ranked), "ranked", Counter(r.get("grade") for r in out), "bytes", os.path.getsize(OUT))
