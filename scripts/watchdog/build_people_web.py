"""People web (Oct 25 2026): the connections behind the Watchdog people files, for /watchdog/people/web.

Every person in public/watchdog/people is a node. People connect through hubs:
  race       the two nominees in the same race
  committee  members of the same House or Senate committee, with chair and ranking roles kept
  delegation sitting members and nominees from the same state
  bloc       the same top donor bloc in a researched file
  donor      the same named donor, PAC or party committee in two or more researched files
Aggregates like "Donors, all" or "Individual donors, all" are not donors and are skipped.
Usage: python3 -I scripts/watchdog/build_people_web.py SITE_DIR
Writes public/watchdog/people/web.json. Run after build_people.py.
"""
import ast, collections, json, os, re, sys

SITE = sys.argv[1]
D = os.path.join(SITE, "public", "watchdog", "people")
idx = json.load(open(os.path.join(D, "index.json"), encoding="utf-8"))
people = idx["people"]
pos = {p["id"]: i for i, p in enumerate(people)}
OCODE = lambda o: "S" if o.startswith("U.S. Senate") else "G" if o.startswith("Governor") else "H" if o.startswith("U.S. House") else ""
AGG = re.compile(r"\b(all|total|transfers?|unitemized|itemized|individual donors|small donors|self|candidate|loans?|refunds?|other receipts|campaign committee|for governor committee|candidate account|aggregate|linked individuals)\b", re.I)


ALIAS = {"SMP": "Senate Majority PAC", "NRSC": "National Republican Senatorial Committee", "DSCC": "Democratic Senatorial Campaign Committee",
         "RGA": "Republican Governors Association", "DGA": "Democratic Governors Association", "AFP Action": "Americans for Prosperity Action", "MAGA": "MAGA Inc."}


def lst(v):
    if isinstance(v, list): return v
    try: return ast.literal_eval(v) if v else []
    except Exception: return []


hubs = {}  # key -> {kind, name, m: {idx: role}}
def hub(kind, name, i, role=""):
    k = f"{kind}:{name}"
    h = hubs.setdefault(k, {"kind": kind, "name": name, "m": {}})
    if i not in h["m"] or role: h["m"][i] = role


pairs = set()
for i, p in enumerate(people):
    try: j = json.load(open(os.path.join(D, "p", p["id"] + ".json"), encoding="utf-8"))
    except Exception: continue
    for o in p.get("opp") or []:
        if o in pos: pairs.add(tuple(sorted((i, pos[o]))))
    for c in ((j.get("links") or {}).get("committees") or "").split(";"):
        c = c.strip()
        if not c: continue
        m = re.match(r"(.*?)\s*\((Chairman|Chair|Ranking Member|Vice Chairman|Vice Chair)\)\s*$", c)
        name, role = (m.group(1), m.group(2).replace("Chairman", "Chair")) if m else (c, "")
        hub("committee", name, i, role)
    cur = (p.get("current") or "").lower()
    if p.get("st") and (cur not in ("", "none") or p.get("race") == "nominee"):
        hub("delegation", p["st"], i)
    if p.get("hand"):
        for b in lst((j.get("meta") or {}).get("top_blocs")):
            if b: hub("bloc", b, i)
        seen = set()
        for e in j.get("edgesRows") or []:
            n = ALIAS.get(*(2 * [re.sub(r",?\s*FEC C\d+.*$|,?\s*Inc\.?$", "", (e.get("donor_or_entity") or "").strip())]))
            if not n or AGG.search(n) or n in seen: continue
            if (e.get("status") or "").lower() == "contested": continue
            seen.add(n); hub("donor", n, i)

KC = {"committee": "c", "delegation": "s", "bloc": "b", "donor": "m"}
out_h = []
for k, h in hubs.items():
    n = len(h["m"])
    if n < 2: continue
    out_h.append({"k": KC[h["kind"]], "n": h["name"], "m": sorted(h["m"]), "r": {str(i): r for i, r in h["m"].items() if r}})
order = {"c": 0, "s": 1, "b": 2, "m": 3}
out_h.sort(key=lambda h: (order.get(h["k"], 9), -len(h["m"]), h["n"]))
for h in out_h:
    if not h["r"]: del h["r"]
nodes = [[p["id"], p["name"], p["party"], p["st"], OCODE(p.get("office") or "") or ("S" if "Senate" in (p.get("current") or "") else "H" if "House" in (p.get("current") or "") else "G" if "Governor" in (p.get("current") or "") else ""),
          p.get("district") or "", 1 if p.get("hand") else 0, (p.get("rating") or "").replace("Cook: ", ""), 1 if (p.get("race") == "nominee") else 0, p.get("current") or ""] for p in people]
json.dump({"asOf": idx["asOf"], "nodes": nodes, "hubs": out_h, "races": sorted(pairs)}, open(os.path.join(D, "web.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
c = collections.Counter(h["k"] for h in out_h)
print(f"people web: {len(nodes)} people, {len(pairs)} races, hubs {dict(c)}, {os.path.getsize(os.path.join(D, 'web.json')) // 1024} KB")
