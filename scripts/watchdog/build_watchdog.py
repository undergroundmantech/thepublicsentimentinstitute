# Builds the Watchdog section's data files in public/watchdog from the research inputs in scripts/watchdog/data.
#   python3 scripts/watchdog/build_watchdog.py /tmp/site
# Inputs: trail.json (campaign visits), attention.json (attention and endorsements), money.json (outside money,
# super PACs, donors, vendors, ad buys, compiled from public reporting on FEC filings), ledger_screens.json (figures
# read off Ledger), dc.json (data center projects), county_results.txt and county_meta.txt (Ledger's county files),
# cvap_county.csv (Census CVAP by county), and the site's own forecast files.
import csv, json, os, re, sys
from collections import defaultdict

SITE = sys.argv[1] if len(sys.argv) > 1 else "/tmp/site"
D = os.path.join(SITE, "scripts/watchdog/data")
OUT = os.path.join(SITE, "public/watchdog")
os.makedirs(OUT, exist_ok=True)
J = lambda f: json.load(open(os.path.join(D, f)))
trail, att, money, scr, dc = J("trail.json"), J("attention.json"), J("money.json"), J("ledger_screens.json"), J("dc.json")
res = J("endorsements_research.json")   # Oct 22 2026: researched endorsements and media attention, every row sourced
model = json.load(open(os.path.join(SITE, "public/forecast/model.json")))
STN = {"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","DC":"District of Columbia","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming"}

def dump(name, obj):
    json.dump(obj, open(os.path.join(OUT, name), "w"), separators=(",", ":"))
    print(name, os.path.getsize(os.path.join(OUT, name)))

# ---------------------------------------------------------------- races and candidates from the forecast
RACE = {}   # "TX Senate" -> race info
for r in model["races"]:
    if r["office"] not in ("senate", "governor"): continue
    key = f"{r['st']} {'Senate' if r['office'] == 'senate' else 'Governor'}"
    RACE[key] = {"key": key, "st": r["st"], "office": r["office"], "id": r["id"], "dem": r["dem"], "gop": r["gop"], "m": r["est"]["margin"], "p": r["est"]["prob"],
                 "ind": any(c.get("party") == "I" for c in r.get("cands", [])[:1])}
def last(n): return re.sub(r"\s+(Jr\.|Sr\.|II|III|IV)$", "", n.strip()).split(" ")[-1].lower()
def race_of(text):
    t = text.replace("Senate special", "Senate").replace("special", "")
    m = re.match(r"([A-Z]{2})[ -]+(Senate|Governor|Gov)", t.strip())
    if not m: return None
    k = f"{m.group(1)} {'Governor' if m.group(2).startswith('Gov') else 'Senate'}"
    return k if k in RACE else None
def cand_in(st, name):
    """Find the forecast nominee in state st whose last name matches."""
    ln = last(name)
    for k in (f"{st} Senate", f"{st} Governor"):
        r = RACE.get(k)
        if not r: continue
        for side, nm in (("D", r["dem"]), ("R", r["gop"])):
            if last(nm) == ln or ln in nm.lower(): return k, side, nm
    return None

# ---------------------------------------------------------------- canonical group names
ALIAS = {"slf pac": "Senate Leadership Fund", "senate leadership fund": "Senate Leadership Fund", "senate majority pac": "Senate Majority PAC", "smp": "Senate Majority PAC",
         "congressional leadership fund": "Congressional Leadership Fund", "clf": "Congressional Leadership Fund", "house majority pac": "House Majority PAC", "hmp": "House Majority PAC",
         "maga inc": "MAGA Inc.", "maga inc.": "MAGA Inc.", "future forward": "Future Forward", "ff pac": "Future Forward", "winsenate": "WinSenate", "no going back pac": "No Going Back PAC",
         "no going back pac inc.": "No Going Back PAC", "americans for prosperity action": "Americans for Prosperity Action", "afp action": "Americans for Prosperity Action"}
PEOPLE_ALIAS = {"miriam o. adelson": "Miriam Adelson", "paul e. singer": "Paul Singer", "glcf inc.": "GLCF", "koch ga inc.": "Koch Inc.", "ab pac": "AB PAC",
                "blockratize inc., polymarket parent": "Blockratize, Polymarket's parent", "howard w. lutnick": "Howard Lutnick"}
def clean(n):
    n = re.sub(r",\s*(Q\d|single IE|initial|ad time).*$", "", n.strip())
    if n.lower().startswith("senate leadership fund"): return "Senate Leadership Fund"
    return PEOPLE_ALIAS.get(n.lower(), n)
def gname(n):
    n = clean(n)
    n = n.strip()
    for part in [n] + [p.strip() for p in n.split("/")]:
        k = part.lower().rstrip(".").strip()
        if k in ALIAS: return ALIAS[k]
        if k + "." in ALIAS: return ALIAS[k + "."]
    return n.split(" / ")[0].strip()

# ---------------------------------------------------------------- money
groups = {}
for g in money["groups"]:
    nm = gname(g["name"])
    groups[nm] = {"name": nm, "side": g["side"], "raised": g.get("raised"), "spent": g.get("spent"), "cash": g.get("cash"), "states": [s[:2] for s in g.get("states", []) if re.match(r"^[A-Z]{2}", s)],
                  "donors": [[d["name"], d.get("amount"), d.get("source", "")] for d in g.get("top_donors") or [] if d.get("amount")],
                  "vendors": [[v["name"], v.get("amount"), v.get("kind", "other"), v.get("source", "")] for v in g.get("top_vendors") or [] if v.get("amount")],
                  "source": g.get("source", ""), "asOf": g.get("as_of", "")}
races_out = []
ie_edges = []    # (group, race, candidate side benefiting, amount, kind support|oppose, target name)
for r in money["races"]:
    key = race_of(f"{r['state']} {r['office']}")
    info = RACE.get(key) if key else None
    tg = []
    for t in r.get("top_groups") or []:
        if not t.get("amount"): continue
        nm = gname(t["name"]); so = (t.get("support_or_oppose") or "").lower(); targets = [x.strip() for x in (t.get("target") or "").split("/")]
        kind = "oppose" if so.startswith("oppose") else "support"
        target = targets[0] if targets else ""
        side = t.get("side")
        tg.append({"name": nm, "side": side, "kind": kind, "target": target, "amount": t["amount"]})
        ie_edges.append((nm, key, side, t["amount"], kind, target))
        if nm not in groups: groups[nm] = {"name": nm, "side": side, "raised": None, "spent": None, "cash": None, "states": [], "donors": [], "vendors": [], "source": r.get("source", ""), "asOf": r.get("as_of", "")}
        if key and key[:2] not in groups[nm]["states"]: groups[nm]["states"].append(key[:2])
    races_out.append({"key": key or f"{r['state']} {r['office']}", "st": r["state"], "office": r["office"], "total": r.get("outside_total"), "forD": r.get("for_D"), "forR": r.get("for_R"),
                      "dem": info["dem"] if info else None, "gop": info["gop"] if info else None, "m": info["m"] if info else None, "p": info["p"] if info else None,
                      "href": f"/forecast/{r['state'].lower()}/{'governor' if 'Gov' in r['office'] else 'senate'}", "groups": sorted(tg, key=lambda x: -x["amount"]), "source": r.get("source", ""), "asOf": r.get("as_of", "")})
races_out.sort(key=lambda x: -(x["total"] or 0))
for s in scr["races"]:
    for ro in races_out:
        if ro["key"] == s["race"]: ro["ledger"] = {"raised": s["raised"], "outside": s["outside"], "cands": s["cands"]}

# sankey: top donors -> top groups -> races
donor_tot = defaultdict(float)
for g in groups.values():
    for d in g["donors"]: d[0] = clean(d[0]); donor_tot[d[0]] += d[1]
    for v in g["vendors"]: v[0] = clean(v[0])
top_groups = sorted([g for g in groups.values() if any(e[0] == g["name"] for e in ie_edges)], key=lambda g: -sum(e[3] for e in ie_edges if e[0] == g["name"]))[:14]
tg_names = {g["name"] for g in top_groups}
links = []
for g in top_groups:
    for d in g["donors"][:6]:
        if d[1] >= 1_000_000: links.append({"s": "d:" + d[0], "t": "g:" + g["name"], "v": d[1]})
race_in = defaultdict(float)
for nm, key, side, amt, kind, target in ie_edges:
    if nm in tg_names and key: links.append({"s": "g:" + nm, "t": "r:" + key, "v": amt}); race_in[key] += amt
nodes = {}
for l in links:
    for k in (l["s"], l["t"]):
        if k in nodes: continue
        kind, nm = k.split(":", 1)
        side = groups[nm]["side"] if kind == "g" and nm in groups else None
        nodes[k] = {"id": k, "kind": kind, "name": nm, "side": side}
flow = {"nodes": list(nodes.values()), "links": links}

ads = [{"buyer": a["buyer"], "d90": a["d90"], "all": a["all"], "ads": a["ads"]} for a in scr["ads"]]
adbuys = [a for a in money.get("ads", []) if a.get("amount")]
dump("money.json", {"asOf": money.get("asOf"), "races": races_out, "groups": sorted(groups.values(), key=lambda g: -((g["spent"] or 0) or sum(e[3] for e in ie_edges if e[0] == g["name"]))),
                    "flow": flow, "ads": ads, "adBuys": adbuys, "tape": scr["tape"], "campaigns": scr["campaigns"], "notes": money.get("notes", "")})

# ---------------------------------------------------------------- people on the trail
ROLE = {"Donald Trump": "president", "JD Vance": "vice president", "Howard Lutnick": "cabinet", "Pete Hegseth": "cabinet", "Barack Obama": "former president", "Bill Clinton": "former president",
        "Kamala Harris": "former vice president"}
people = {}
def person(name, party, role):
    p = people.get(name)
    if not p:
        ini = "".join(w[0] for w in re.sub(r"[^A-Za-z ]", " ", name).split()[:2]).upper()
        p = people[name] = {"name": name, "party": party, "role": role, "ini": ini, "visits": 0, "attention": 0, "endorse": 0, "states": []}
    return p
visits = []
for v in trail["visits"]:
    p = person(v["person"], v.get("party", "R"), ROLE.get(v["person"], "surrogate")); p["visits"] += 1
    if v["state"] not in p["states"]: p["states"].append(v["state"])
    visits.append({"who": v["person"], "party": v.get("party"), "date": v["date"], "st": v["state"], "city": v.get("city", ""), "kind": v.get("kind", "event"), "for": v.get("for", []), "race": v.get("race", ""), "note": v.get("note", ""), "src": v.get("source", "")})
attention = []
MEDIA = {m["name"]: m for m in res.get("media_people", [])}
seen_att = set()
for a in att["attention"] + res.get("media_attention", []):
    k = (a["person"], a.get("race", ""), a.get("when", ""))
    if k in seen_att: continue
    seen_att.add(k)
    if a["person"] in ("America PAC",): continue
    lean = a.get("lean", "other"); p = person(a["person"], lean if lean in ("D", "R") else "O", a.get("role", "commentator")); p["attention"] += 1
    if a["state"] not in p["states"]: p["states"].append(a["state"])
    if a["person"] in MEDIA: p["show"] = MEDIA[a["person"]].get("show")
    attention.append({"who": a["person"], "role": a.get("role"), "lean": lean, "st": a["state"], "race": a.get("race", ""), "what": a["what"], "when": a.get("when", ""), "src": a.get("source", "")})
endorse = []
seen_e = set()
for e in att["endorsements"] + res.get("endorsements", []):
    by = e["by"].strip()
    k = (by.lower(), e["candidate"].strip().lower())
    if k in seen_e: continue
    seen_e.add(k)
    short = "Teamsters" if by.startswith("Teamsters") else by
    org = by in ("UAW",) or "Teamsters" in by or "Fraternal" in by or "Firefighters" in by
    dt, nt = (e.get("date") or "").strip(), e.get("note", "") or ""
    mdt = re.match(r"^(\d{4}-\d{2}(?:-\d{2})?)(.*)$", dt)
    if dt and not (mdt and not mdt.group(2).strip()):
        extra = (mdt.group(2) if mdt else dt).strip(" ,;")
        nt = "; ".join(x for x in (nt, extra) if x); dt = mdt.group(1) if mdt else ""
    e = dict(e, date=dt, note=nt)
    kind = e.get("byKind") or ("union" if org else "politician")
    if kind == "org": kind = "organization"
    p = person(short, "D" if by in ("Barack Obama", "Bernie Sanders", "UAW") else "R" if by == "Donald Trump" else "O", "group" if kind in ("union", "organization", "newspaper") else ROLE.get(by, e.get("byRole") or "surrogate")); p["endorse"] += 1
    p.setdefault("sides", []).append(e.get("party"))
    if e["state"] not in p["states"]: p["states"].append(e["state"])
    endorse.append({"by": short, "byFull": by, "byRole": e.get("byRole", ""), "kind": kind, "st": e["state"], "race": e.get("race", ""), "office": e.get("office") or ("governor" if "Gov" in e.get("race", "") else "senate"),
                    "cand": e["candidate"].strip(), "party": e.get("party"), "date": e.get("date") or "", "src": e.get("source", ""), "note": e.get("note", "")})
# an endorser's colour on the map is the side they back, when they back only one side
for p in people.values():
    sides = {x for x in p.pop("sides", []) if x}
    if p["party"] == "O" and len(sides) == 1: p["party"] = next(iter(sides))
# the people rail: everyone on the trail or paying attention, and endorsers with three or more, or a national role
rail = [p for p in people.values() if p["visits"] or p["attention"] or p["endorse"] >= 3 or p["role"] in ROLE.values()]
dump("trail.json", {"people": sorted(rail, key=lambda p: -(p["visits"] * 2 + p["attention"] + p["endorse"])), "visits": sorted(visits, key=lambda v: v["date"]), "attention": attention, "endorse": endorse,
                    "unconfirmed": trail.get("unconfirmed", []) + att.get("unconfirmed", []) + res.get("unconfirmed", []), "notes": [trail.get("notes", ""), att.get("notes", ""), res.get("note", "")]})

# ---------------------------------------------------------------- the endorsements board and media watch
fc_races = {}
try:
    for r in json.load(open(os.path.join(SITE, "public/forecast/model.json")))["races"]:
        if r["office"] in ("senate", "governor"): fc_races[(r["st"], r["office"])] = r
except Exception: pass
by_race = {}
for e in endorse:
    key = f"{e['st']}-{e['office']}"
    rr = by_race.setdefault(key, {"key": key, "st": e["st"], "office": e["office"], "race": e["race"], "cands": {}})
    c = rr["cands"].setdefault(e["cand"], {"name": e["cand"], "party": e["party"], "list": []})
    c["list"].append({k: e[k] for k in ("by", "byRole", "kind", "date", "src", "note")})
races_e = []
for rr in by_race.values():
    f = fc_races.get((rr["st"], rr["office"]))
    if f: rr.update(state=f["state"], id=f["id"], m=f["est"]["margin"], p=f["est"]["prob"], href=f"/forecast/{f['st'].lower()}/{f['office']}")
    rr["cands"] = sorted(rr["cands"].values(), key=lambda c: {"D": 0, "I": 1, "R": 2}.get(c["party"], 3))
    for c in rr["cands"]: c["list"].sort(key=lambda x: (x["kind"] != "politician", x["date"] or "9999"))
    rr["n"] = sum(len(c["list"]) for c in rr["cands"])
    races_e.append(rr)
races_e.sort(key=lambda r: -r["n"])
media = []
for name, m in MEDIA.items():
    items = sorted([a for a in attention if a["who"] == name], key=lambda a: a["when"] or "", reverse=True)
    if items: media.append({"name": name, "role": m.get("role"), "show": m.get("show"), "lean": m.get("lean"), "ini": people[name]["ini"] if name in people else "", "items": items})
for a in attention:
    if a["who"] not in MEDIA and a["role"] in ("commentator", "podcaster", "streamer", "host", "reporter", "analyst") and a["who"] not in [x["name"] for x in media]:
        media.append({"name": a["who"], "role": a["role"], "show": None, "lean": a["lean"], "ini": people[a["who"]]["ini"], "items": [x for x in attention if x["who"] == a["who"]]})
media.sort(key=lambda m: -len(m["items"]))
dump("endorsements.json", {"asOf": res.get("asOf"), "races": races_e, "media": media, "kinds": sorted({e["kind"] for e in endorse}),
                           "unconfirmed": res.get("unconfirmed", []), "note": res.get("note", "")})

# ---------------------------------------------------------------- the connections graph
N, E = {}, []
def node(id_, kind, name, side=None, **kw):
    if id_ not in N: N[id_] = {"id": id_, "kind": kind, "name": name, "side": side, **kw}
    elif side and not N[id_].get("side"): N[id_]["side"] = side
    return id_
def edge(s, t, kind, amount=None, note="", src=""):
    E.append({"s": s, "t": t, "k": kind, "v": amount, "note": note, "src": src})
for key, r in RACE.items():
    if key in {x["key"] for x in races_out} or any(v["st"] == r["st"] for v in visits) or any(e["st"] == r["st"] for e in endorse):
        rid = node("r:" + key, "race", key, None, href=f"/forecast/{r['st'].lower()}/{r['office']}", m=r["m"])
        for side, nm in (("D", r["dem"]), ("R", r["gop"])):
            cid = node("c:" + nm, "candidate", nm, "I" if (side == "D" and r["ind"]) else side, race=key)
            edge(cid, rid, "runs")
for nm, key, side, amt, kind, target in ie_edges:
    gid = node("g:" + nm, "group", nm, groups.get(nm, {}).get("side") or side)
    hit = cand_in(key[:2], target) if key and target else None
    if hit: edge(gid, "c:" + hit[2], kind, amt, f"{'spent for' if kind == 'support' else 'spent against'} {hit[2]}")
    elif key: edge(gid, "r:" + key, kind, amt, f"spent in the {key} race")
for g in groups.values():
    gid = node("g:" + g["name"], "group", g["name"], g["side"])
    for dn, amt, src in g["donors"][:10]:
        dn = clean(dn)
        did = "g:" + gname(dn) if gname(dn) in groups else node("d:" + dn, "donor", dn)
        edge(did, gid, "gave", amt, f"gave to {g['name']}", src)
    for vn, amt, k, src in g["vendors"][:8]:
        vn = clean(vn)
        vid = "g:" + gname(vn) if gname(vn) in groups else node("v:" + vn, "vendor", vn, None, what=k)
        edge(gid, vid, "paid", amt, f"{g['name']} paid {vn}", src)
for c in scr["campaigns"]:
    cid = node("c:" + c["candidate"], "candidate", c["candidate"], "D")
    kid = node("k:" + c["committee"], "committee", c["committee"], "D")
    edge(kid, cid, "campaign", None, f"{c['candidate']}'s campaign committee")
    for vn, amt, what in c["paid"]:
        edge(kid, node("v:" + vn, "vendor", vn, None, what=what), "paid", amt, f"{c['committee']} paid {vn}", "Ledger")
    for dn, amt in c["gifts"]:
        edge(node("d:" + dn, "donor", dn, "D"), kid, "gave", amt, f"gave to {c['committee']}", "Ledger")
for t in scr["tape"]:
    gid = node("g:" + t["group"], "group", t["group"], N.get("g:" + t["group"], {}).get("side") or "other")
    cid = node("c:" + t["against"], "candidate", t["against"], "R", race="House")
    edge(gid, cid, "oppose", t["amount"], f"{t['what']} against {t['against']}, {t['date']}", "Ledger")
    edge(gid, node("v:" + t["vendor"], "vendor", t["vendor"], None, what="media buy"), "paid", t["amount"], f"{t['group']} paid {t['vendor']} for {t['what']}", "Ledger")
for e in endorse:
    hit = cand_in(e["st"], e["cand"])
    pid = node("p:" + e["by"], "person", e["by"], people[e["by"]]["party"] if e["by"] in people else None, role=people.get(e["by"], {}).get("role"))
    if hit: edge(pid, "c:" + hit[2], "endorse", None, f"{e['by']} endorsed {hit[2]}{', ' + e['date'] if e['date'] else ''}", e["src"])
for v in visits:
    pid = node("p:" + v["who"], "person", v["who"], v["party"], role=people[v["who"]]["role"])
    for nm in v["for"]:
        hit = cand_in(v["st"], nm)
        if hit: edge(pid, "c:" + hit[2], "rally", None, f"{v['kind']} in {v['city'] or v['st']}, {v['date']}", v["src"])
for a in attention:
    pid = node("p:" + a["who"], "person", a["who"], people[a["who"]]["party"], role=a["role"])
    k = race_of(a["race"])
    if k: edge(pid, "r:" + k, "attention", None, a["what"], a["src"])
# fold repeated edges of the same kind between the same pair
fold = {}
for e in E:
    k = (e["s"], e["t"], e["k"])
    if k in fold:
        f = fold[k]; f["n"] += 1
        if e["v"]: f["v"] = (f["v"] or 0) + e["v"]
        if e["note"] and len(f["notes"]) < 4: f["notes"].append(e["note"])
    else: fold[k] = {"s": e["s"], "t": e["t"], "k": e["k"], "v": e["v"], "n": 1, "notes": [e["note"]] if e["note"] else [], "src": e["src"]}
dump("graph.json", {"nodes": list(N.values()), "edges": list(fold.values())})

# ---------------------------------------------------------------- the county data center
meta = {}
for row in open(os.path.join(D, "county_meta.txt")).read().split(";"):
    if ":" not in row: continue
    f, rest = row.split(":", 1); p = rest.split(",")
    meta[f] = {"n": p[0], "st": p[1], "area": float(p[2] or 0)}
res = {}
for row in open(os.path.join(D, "county_results.txt")).read().split(";"):
    if ":" not in row: continue
    f, rest = row.split(":", 1); v = [int(x) if x else None for x in rest.split(",")]
    res[f] = v
cv = {}
for r in csv.DictReader(open(os.path.join(D, "cvap_county.csv"))):
    tot = float(r["adu_tot"] or 0)
    if tot > 0: cv[r["fips"].zfill(5)] = {"adults": int(tot), "cvap": int(float(r["cvap_tot"] or 0)), "wnh": round(float(r["adu_wnh"]) / tot * 100, 1), "bnh": round(float(r["adu_bnh"]) / tot * 100, 1), "his": round(float(r["adu_his"]) / tot * 100, 1), "oth": round(float(r["adu_oth"]) / tot * 100, 1)}
fc = json.load(open(os.path.join(SITE, "public/forecast/counties.json")))
fcby = defaultdict(list)
for rid, cmap in fc.items():
    if rid == "_n" or not isinstance(cmap, dict): continue
    for f, v in cmap.items():
        if isinstance(v, list) and v: fcby[f].append([rid, v[0]])
dcby = defaultdict(list)
for p in dc["projects"]:
    if p.get("fips"): dcby[str(p["fips"]).zfill(5)].append(p)
counties = {}
for f, m in meta.items():
    c = {"n": m["n"], "st": m["st"], "area": m["area"]}
    v = res.get(f)
    if v:
        def mg(d, r, t): return round((r - d) / t * 100, 1) if (d is not None and r is not None and t) else None
        c["r16"], c["r20"], c["r24"] = mg(v[0], v[1], v[2]), mg(v[3], v[4], v[5]), mg(v[6], v[7], v[8])
        c["v24"] = v[8]
    if f in cv: c["pop"] = cv[f]
    if f in fcby: c["fc"] = fcby[f]
    if f in dcby: c["dc"] = len(dcby[f])
    counties[f] = c
dump("counties.json", counties)
dump("datacenters.json", {"projects": dc["projects"], "policies": dc.get("policies", []), "polls": dc.get("polls", []) + [
    {"st": "IA", "pollster": "On Point Polling", "date": "2026-10-21", "finding": "64% of Iowa voters oppose more data centers; 30% support.", "source": "https://onpointpolitics.substack.com/p/new-polls-democrats-lead-both-iowa"},
    {"st": "KS", "pollster": "On Point Polling", "date": "2026-10-21", "finding": "61% of Kansas voters oppose more data centers; 33% support.", "source": "https://onpointpolitics.substack.com/p/new-polls-democrats-lead-both-iowa"}], "notes": dc.get("notes", "")})
print("races", len(races_out), "groups", len(groups), "nodes", len(N), "edges", len(fold), "people", len(people), "counties", len(counties))
