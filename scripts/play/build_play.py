"""Campaign game data (Oct 25 2026): one file per playable race for /play.

Playable races: every Senate and governor race the forecast has within 15 points either way. For each it packs what the
game's electorate is built from, all of it the site's own published data:
  the forecast (margin, odds, range), the polls, the county map (projected margin, votes per county, 2024 presidential
  margin), the voter group estimates (crosstabs), the money books and outside spending, the early vote signals, the
  people file intel on both candidates (their message and their vulnerabilities, each sourced), and the race's news.
Inputs come from the published site files plus the War Room race files, so run build_warroom.py first.
Usage: python3 -I scripts/play/build_play.py SITE_DIR
Writes public/play/index.json and public/play/r/<id>.json.
"""
import json, os, sys

SITE = sys.argv[1]
P = lambda *a: os.path.join(SITE, *a)
J = lambda p, d=None: json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d
OUT = P("public", "play")
os.makedirs(os.path.join(OUT, "r"), exist_ok=True)
for f in os.listdir(os.path.join(OUT, "r")): os.remove(os.path.join(OUT, "r", f))

model = J(P("public/forecast/model.json"))
counties = J(P("public/forecast/counties.json"), {})
cross = J(P("public/forecast/crosstabs.json"), {})
pres = J(P("public/forecast/pres24_counties.json"), {"c": {}})["c"]
cname = counties.get("_n", {})
news = J(P("public/news/stories.json"), {"stories": []})["stories"]
donors = J(P("public/forecast/donors.json"), {"races": []})
DON = {r["id"]: r for r in donors.get("races", [])}
RES = os.path.join(SITE, "scripts", "play", "research")  # race research, Oct 25 2026, every item sourced
import re, unicodedata
def nkey(x): return re.sub(r"[^a-z]", "", unicodedata.normalize("NFKD", x).encode("ascii", "ignore").decode().lower().replace("saint", "st").replace("county", "").replace("borough", "").replace("censusarea", ""))


def party_of(race, name, dflt):
    for c in race.get("cands") or []:
        if c.get("name") == name:
            p = c.get("party") or dflt
            return "I" if p in ("IND", "I") else p[:1]
    return dflt


index = []
for race in model["races"]:
    if race["office"] not in ("senate", "governor") or abs(race["est"]["margin"]) >= 15: continue
    wr = J(P("public/watchdog/warroom/r", race["id"] + ".json"))
    if not wr: continue
    cs = counties.get(race["id"]) or {}
    rows = []
    for f, v in cs.items():
        if not isinstance(v, list) or len(v) < 4: continue
        p = pres.get(f)
        pm = round(100 * (p[1] - p[0]) / max(1, sum(p)), 1) if p else None
        rows.append([f, cname.get(f, f), round(v[0], 2), int(v[1]), int(v[2]), int(v[3]), pm])
    rows.sort(key=lambda x: -x[5])
    third = [c for c in race.get("cands") or [] if c.get("name") not in (race["dem"], race["gop"]) and (c.get("pct") or 0) >= 3]
    def cand(side):
        name = race["dem"] if side == "D" else race["gop"]
        pp = (wr.get("people") or {}).get(side) or {}
        m = (wr.get("money") or {}).get(side) or {}
        return {"side": side, "name": name, "party": party_of(race, name, side),
                "inc": (race.get("inc") == (-1 if side == "D" else 1)), "file": pp.get("id") if pp.get("hand") else None,
                "intel": pp.get("intel") or [], "blocs": pp.get("blocs") or [],
                "money": {k: m.get(k) for k in ("receipts", "cash", "outside_for", "spent", "google_ads", "as_of")},
                "health": (wr.get("health") or {}).get(side, {}).get("score")}
    def about(s):
        txt = s["title"] + " " + s.get("dek", "")
        return any(race[k] in txt for k in ("dem", "gop")) or (race["state"] in txt and any(race[k].split()[-1] in txt for k in ("dem", "gop")))
    rec = {
        "id": race["id"], "office": race["office"], "st": race["st"], "state": race["state"], "name": race["name"],
        "open": race.get("open"), "pvi": race.get("pvi"), "pres24": wr.get("pres24"),
        "est": {k: race["est"].get(k) for k in ("margin", "prob", "p10", "p90")}, "pollAvg": race.get("pollAvg"),
        "votes": race.get("votes"), "polls": (race.get("polls") or [])[:14],
        "cands": [cand("D"), cand("R")], "third": [{"name": c["name"], "party": c.get("party"), "pct": c.get("pct")} for c in third],
        "groups": [[g, l, s, d, r, o] for g, l, s, d, r, o in (cross.get(race["id"]) or [])],
        "counties": rows,
        "outside": {"total": wr["money"].get("total"), "groups": wr["money"].get("groups", [])[:8]},
        "earlyVote": wr.get("earlyVote"),
        "news": [{"id": s["id"], "title": s["title"], "dek": s.get("dek", ""), "date": s["date"]} for s in news if about(s)][:5],
        "media": [{"who": a["who"], "what": a["what"], "when": a["when"], "lean": a.get("lean")} for a in (wr.get("media") or [])][:8],
    }
    # the donor map: who gives to each nominee, how small, from where
    dn = DON.get(race["id"]) or {}
    for k, side in ((0, "D"), (1, "R")):
        x = dn.get(side) or {}
        b = x.get("bands")
        rec["cands"][k]["donors"] = None if not x else {"donations": x.get("donations"), "raised": x.get("raised"), "home": x.get("home"),
            "small": round(b[0] / sum(b), 3) if b and sum(b) else None, "big": round(b[3] / sum(b), 3) if b and sum(b) else None,
            "pacs": ((x.get("sources") or {}).get("pacs")), "self": ((x.get("sources") or {}).get("self_funding"))}
    rec["donorSignal"] = dn.get("sig")
    # the race research: real storylines, decisions, debates, endorsements, ads and regions
    rs = J(os.path.join(RES, race["id"] + ".json"), {}) or {}
    byname = {nkey(c[1]): c[0] for c in rows}
    regions = []
    for g in rs.get("regions") or []:
        fs = [byname[nkey(n)] for n in g.get("counties") or [] if nkey(n) in byname]
        if fs: regions.append({"name": g["name"], "f": fs, "note": g.get("note", "")})
    rec["research"] = {"summary": rs.get("summary"), "issues": rs.get("issues") or [], "storylines": rs.get("storylines") or [], "events": rs.get("events") or [],
                       "debates": rs.get("debates") or [], "endorsements": rs.get("endorsements") or [], "ads": rs.get("ads") or [], "regions": regions}
    json.dump(rec, open(os.path.join(OUT, "r", race["id"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    index.append({"id": race["id"], "office": race["office"], "st": race["st"], "state": race["state"], "name": race["name"],
                  "m": race["est"]["margin"], "p": race["est"]["prob"],
                  "c": [[c["name"], c["party"], c["inc"]] for c in rec["cands"]]})
index.sort(key=lambda r: abs(r["m"]))
json.dump({"asOf": model["meta"]["updated"], "election": model["meta"]["election"], "races": index}, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"play: {len(index)} races")
