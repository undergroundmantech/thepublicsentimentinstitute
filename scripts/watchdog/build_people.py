"""Watchdog people files (Oct 23 2026).

Reads the On Point Watchdog Database in scripts/watchdog/data/watchdog_db: one folder per sitting member of Congress,
sitting governor and 2026 House, Senate and governor nominee, with a profile, money edges, office levers and research
notes. Writes what the site reads:
  public/watchdog/people/index.json        one row per person for the searchable index
  public/watchdog/people/p/<id>.json       the full file for one person
  public/watchdog/people/boards/<id>.html  the database's own connections board, where one was built
  scripts/watchdog/data/people_ledger.json hand researched money ties for the Connections map
Usage: python3 -I scripts/watchdog/build_people.py SITE_DIR
Rerun after dropping a new export of the database into scripts/watchdog/data/watchdog_db, then build_watchdog.py.
"""
import csv, json, os, re, shutil, sys

SITE = sys.argv[1]
DB = os.path.join(SITE, "scripts/watchdog/data/watchdog_db")
OUT = os.path.join(SITE, "public/watchdog/people")
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(os.path.join(OUT, "p")); os.makedirs(os.path.join(OUT, "boards"))


def rows(p):
    if not os.path.exists(p): return []
    with open(p, newline="", encoding="utf-8") as f:
        return [{k: (v or "").strip() for k, v in r.items() if k} for r in csv.DictReader(f)]


def num(s):
    try: return float(s) if s not in ("", None) else None
    except ValueError: return None


PARTY = {"Democratic": "D", "Democrat": "D", "Republican": "R", "Independent": "I"}
SKIP_BLOC = ("Aggregate totals", "Small donors", "Opponent context")

roster = {r["person_id"]: r for r in rows(os.path.join(DB, "roster/master_roster.csv"))}
# candidates already on the Connections map, from the last build_watchdog.py run
try: GRAPH = {n["name"] for n in json.load(open(os.path.join(SITE, "public/watchdog/graph.json"), encoding="utf-8"))["nodes"] if n.get("kind") == "candidate"}
except Exception: GRAPH = set()
def _hand(pid):
    m = os.path.join(DB, "people", pid.split("-")[0], pid, "meta.json")
    try: return not (json.load(open(m, encoding="utf-8")).get("research_tier", "") or "").lower().startswith("queued")
    except Exception: return False
index, ledger = [], []
for st in sorted(os.listdir(os.path.join(DB, "people"))):
    sd = os.path.join(DB, "people", st)
    for pid in sorted(os.listdir(sd)):
        d = os.path.join(sd, pid)
        meta = json.load(open(os.path.join(d, "meta.json"), encoding="utf-8"))
        ro = roster.get(pid, {})
        prof = open(os.path.join(d, "profile.md"), encoding="utf-8").read()
        notes = open(os.path.join(d, "notes.md"), encoding="utf-8").read() if os.path.exists(os.path.join(d, "notes.md")) else ""
        edges = [dict(r, origin="hand research") for r in rows(os.path.join(d, "edges.csv"))] + [dict(r, origin="FEC pipeline") for r in rows(os.path.join(d, "edges_fec.csv"))]
        levers = rows(os.path.join(d, "levers.csv"))
        tier = meta.get("research_tier", "") or ""
        hand = not tier.lower().startswith("queued")
        board = os.path.exists(os.path.join(d, "board.html"))
        if board: shutil.copy(os.path.join(d, "board.html"), os.path.join(OUT, "boards", pid + ".html"))
        party = PARTY.get(meta.get("party") or ro.get("party", ""), "O")
        rec = {"id": pid, "name": meta.get("name") or ro.get("name", pid), "party": party, "st": meta.get("state") or st,
               "district": ro.get("district", ""), "office": meta.get("office_sought") or ro.get("office_sought_2026", ""),
               "current": meta.get("current_office") or ro.get("current_office", ""), "race": ro.get("race_status", ""), "role": ro.get("role", ""),
               "rating": meta.get("competitive_rating") or ro.get("competitive_rating", ""), "groups": meta.get("groups") or ro.get("groups", ""),
               "priority": str(meta.get("research_priority") or ro.get("research_priority", "")), "tier": tier, "hand": hand,
               "edges": len(edges), "levers": sum(1 for l in levers if not l.get("source", "").startswith("Template")), "board": board,
               "opp": meta.get("opponents", []) if isinstance(meta.get("opponents"), list) else []}
        rec["inGraph"] = rec["name"] in GRAPH
        rec["oppN"] = [[o, roster.get(o, {}).get("name", o), _hand(o)] for o in rec["opp"]]
        index.append(rec)
        full = dict(rec, meta=meta, profile=prof, notes=notes, edgesRows=edges, leversRows=levers,
                    links={k: ro.get(k, "") for k in ("bioguide", "fec_ids", "opensecrets", "committees", "roster_source", "roster_note")})
        json.dump(full, open(os.path.join(OUT, "p", pid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        # money ties for the Connections map: first hop rows with an amount, never running totals or context rows
        for e in edges:
            if e.get("hop") != "1" or e.get("cumulative") == "yes": continue
            amt = num(e.get("amount_usd"))
            if not amt or e.get("type") == "Relationship" or e.get("interest_bloc") in SKIP_BLOC: continue
            if re.search(r"\baggregate\b|^all contributors|unitemized|small dollar", e.get("donor_or_entity", ""), re.I): continue
            ledger.append({"subject": rec["name"], "id": pid, "st": rec["st"], "party": party, "office": rec["office"], "entity": e.get("donor_or_entity", ""),
                           "type": e.get("type", ""), "amount": amt, "vehicle": e.get("recipient_vehicle", ""), "bloc": e.get("interest_bloc", ""),
                           "status": e.get("status", ""), "date": e.get("date_or_as_of", ""), "src": e.get("source", ""), "note": e.get("note", "")})

index.sort(key=lambda r: (not r["hand"], r["priority"] or "9", r["st"], r["name"]))
json.dump({"asOf": "2026-10-23", "n": len(index), "hand": sum(1 for r in index if r["hand"]), "people": index},
          open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump({"asOf": "2026-10-23", "rows": ledger}, open(os.path.join(SITE, "scripts/watchdog/data/people_ledger.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(len(index), "people;", sum(1 for r in index if r["hand"]), "hand researched;", sum(1 for r in index if r["board"]), "boards;", len(ledger), "money ties")
