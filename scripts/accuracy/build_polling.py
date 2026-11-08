"""On Point Polling's own accuracy: every 2026 general election release scored against the count.

  python3 scripts/accuracy/build_polling.py [REPO]

Reads the releases in scripts/accuracy/onpoint_polls_2026.json, the count in public/accuracy/2026.json and the national
result in public/accuracy/benchmarks-2026.json, and writes public/accuracy/polling-2026.json. In each race the last
release before Election Day is the one scored; earlier releases are kept for the trend. Margins are Republican minus
Democratic points on the leaned likely voter results; the miss is the result minus the poll.
"""
import json, os, sys
REPO = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(HERE, "onpoint_polls_2026.json")))
A = json.load(open(os.path.join(REPO, "public/accuracy/2026.json")))
B = json.load(open(os.path.join(REPO, "public/accuracy/benchmarks-2026.json")))
R = {r["id"]: r for r in A["races"]}
r1 = lambda x, k=1: round(x, k)
OFF = {"sen": "Senate", "gov": "Governor", "house": "House"}
STN = {"OH": "Ohio", "MI": "Michigan", "TX": "Texas", "FL": "Florida", "SC": "South Carolina", "IA": "Iowa", "KS": "Kansas", "NE": "Nebraska"}

last = {}
for rel in sorted(P["releases"], key=lambda x: x["date"]):
    for race in rel["races"]:
        last[race["id"]] = (rel, race)
rows = []
for rid, (rel, race) in last.items():
    res = R.get(rid)
    pm = race["rv"] - race["dv"]
    office = rid.split("-")[0]
    label = f"{STN[rel['st']]} {OFF[office]}" + (f" {int(rid.split('-')[2])}" if office == "house" else "")
    row = dict(id=rid, race=label, st=rel["st"], office=OFF[office], date=rel["date"], n=rel["n"], title=rel["title"], sponsor=rel.get("sponsor"),
               d=race["d"], r=race["r"], ind=bool(race.get("ind")), dv=race["dv"], rv=race["rv"], poll=r1(pm), earlier=[])
    for e in sorted(P["releases"], key=lambda x: x["date"]):
        for er in e["races"]:
            if er["id"] == rid and e["date"] != rel["date"]:
                row["earlier"].append(dict(date=e["date"], poll=r1(er["rv"] - er["dv"])))
    if res and res.get("act") is not None:
        row.update(result=r1(res["act"], 2), pct=res["pct"], final=res["fin"], miss=r1(res["act"] - pm, 2),
                   right=(res["act"] > 0) == (pm > 0), winner=res["dn"] if res["act"] < 0 else res["rn"])
    rows.append(row)
order = {"Senate": 0, "Governor": 1, "House": 2}
rows.sort(key=lambda x: (order[x["office"]], abs(x.get("miss", 99))))
sc = [x for x in rows if "miss" in x]
def blk(xs):
    if not xs: return None
    return dict(n=len(xs), right=sum(x["right"] for x in xs), mae=r1(sum(abs(x["miss"]) for x in xs) / len(xs), 2),
                bias=r1(sum(x["miss"] for x in xs) / len(xs), 2), within1=sum(abs(x["miss"]) <= 1 for x in xs), within3=sum(abs(x["miss"]) <= 3 for x in xs))
nat = P["national"]
g = B["generic"]
out = dict(
    asof=A["results_asof"]["federal"], note=P["note"],
    national=dict(release=nat["release"], date=nat["date"], n=nat["n"], d=nat["d"], r=nat["r"], poll=nat["margin"], result=-g["result"]["margin"],
                  counted=-g["result"]["counted_margin"], miss=r1(-g["result"]["margin"] - nat["margin"], 2), rank=1, of=len(B["national"]["polls"]),
                  averages=-g["averages"]["margin"]),
    summary=dict(all=blk(sc), senate=blk([x for x in sc if x["office"] == "Senate"]), governor=blk([x for x in sc if x["office"] == "Governor"]),
                 house=blk([x for x in sc if x["office"] == "House"]), releases=len(P["releases"]) + 1, states=len({x["st"] for x in rows})),
    races=rows)
json.dump(out, open(os.path.join(REPO, "public/accuracy/polling-2026.json"), "w"), indent=1)
print(json.dumps(out["summary"], indent=1)); print(out["national"])
for x in rows: print(f"{x['race']:22s} poll {x['poll']:+6.1f} result {x.get('result', 0):+7.2f} miss {x.get('miss', 0):+6.2f} {'right' if x.get('right') else 'MISS'} {'' if x.get('final') else 'counting'}")
