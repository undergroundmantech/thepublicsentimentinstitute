"""Every other 2026 race the forecast does not model, for /forecast/other: nonpartisan and retention court seats, the
district elected utility commissions and education boards, the nonpartisan statewide offices, mayors and Washington DC,
the Nebraska Legislature, and the statewide ballot measures already decided earlier in 2026.

usage: python3 build_other_races.py SOURCE_DIR OUT_JSON
SOURCE_DIR holds the Oct 19 2026 research files (courts_listed, exec_edu_ins_labor_listed, psc_listed, local,
nebraska_legislature and measures_missing .json). The research is copied into other_races_2026.json beside this script so
the page can be rebuilt without the source folder: python3 build_other_races.py --from-saved OUT_JSON."""
import sys, json, os, re, datetime as dt
HERE = os.path.dirname(os.path.abspath(__file__))
SAVED = os.path.join(HERE, "other_races_2026.json")
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")

def norm_poll(p):
    sh = p.get("shares")
    if not sh:
        sh = {k: p[k] for k in ("D", "R", "O", "U") if p.get(k) is not None}
    return dict(pollster=p.get("source") or p.get("pollster"), dates=p.get("dates"), end=p.get("end"), n=p.get("n"), pop=p.get("pop"),
                shares=sh, url=p.get("url"), note=p.get("note"))

def norm(e, cat=None):
    cands = []
    for c in e.get("candidates") or []:
        cands.append(dict(name=c.get("name"), party=c.get("party") or c.get("party_affiliation"), incumbent=bool(c.get("incumbent")), note=c.get("note") or ""))
    st = e.get("state"); cat = cat or e.get("category") or "office"
    juris = e.get("jurisdiction") or st
    return dict(id=slug(f"{cat}-{st}-{juris}-{e.get('office')}-{e.get('seat') or ''}"), category=cat, state=st, jurisdiction=juris,
                office=e.get("office"), seat=e.get("seat"), election_type=e.get("election_type"), date=e.get("election_date"),
                status=e.get("status") or "upcoming", candidates=cands, result=e.get("result"), incumbent=e.get("incumbent"),
                primary=e.get("primary_result"), runoff=e.get("runoff_rule"), polls=[norm_poll(p) for p in e.get("polls") or []],
                sources=e.get("sources") or [], note=e.get("note") or "")

def from_sources(d):
    rows = []
    for f, cat in (("courts_listed.json", "court"), ("exec_edu_ins_labor_listed.json", None), ("psc_listed.json", "office"), ("local.json", None)):
        p = os.path.join(d, f)
        if os.path.exists(p): rows += [norm(e, cat) for e in json.load(open(p))]
    ne = json.load(open(os.path.join(d, "nebraska_legislature.json")))
    for r in ne["races"]:
        rows.append(norm(dict(state="NE", jurisdiction="Nebraska", office="Legislature", seat=f"District {r['district']}", election_type="nonpartisan",
                              election_date=ne.get("general_election_date", "2026-11-03"), status="upcoming", candidates=r.get("candidates"),
                              primary_result=r.get("primary_result"), sources=r.get("sources") or ne.get("sources", [])[:3], note=r.get("note")), "legislature"))
    ms = json.load(open(os.path.join(d, "measures_missing.json")))
    for m in ms:
        if m.get("status") != "decided": continue
        rows.append(dict(id=slug(f"measure-{m['state']}-{m['id']}"), category="measure", state=m["state"], jurisdiction=m["state"],
                         office=m["id"], seat=None, election_type="measure", date=m.get("election_date"), status="decided",
                         candidates=[], result=m.get("result"), incumbent=None, primary=None, runoff=None,
                         polls=[norm_poll(p) for p in m.get("polls") or []], sources=m.get("sources") or [],
                         note=m.get("summary") or "", title=m.get("short_title"), threshold=m.get("threshold"),
                         passed=(m.get("result") or {}).get("yes", 0) / 100 >= (m.get("threshold") or 0.5) if m.get("result") else None))
    nel = dict(current=ne.get("current_makeup"), filibuster_line=ne.get("filibuster_line"), seats_up=len(ne["races"]), method=ne.get("method_note"))
    return rows, nel

if sys.argv[1] == "--from-saved":
    saved = json.load(open(SAVED)); rows, nel = saved["races"], saved["nebraska"]; OUT = sys.argv[2]
else:
    rows, nel = from_sources(sys.argv[1]); OUT = sys.argv[2]
    json.dump(dict(races=rows, nebraska=nel), open(SAVED, "w"), indent=1)
ST = {"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","DC":"District of Columbia","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming"}
for r in rows: r["stateName"] = ST.get(r["state"], r["state"])
seen = {}
for r in rows:                                   # ids must be unique for the page anchors
    k = r["id"]; seen[k] = seen.get(k, 0) + 1
    if seen[k] > 1: r["id"] = f"{k}-{seen[k]}"
order = {"court": 0, "office": 1, "board": 2, "legislature": 3, "mayor": 4, "local": 5, "measure": 6}
rows.sort(key=lambda r: (order.get(r["category"], 9), r["stateName"], r.get("jurisdiction") or "", r.get("office") or "", r.get("seat") or ""))
meta = dict(updated=os.environ.get("TODAY", str(dt.date.today())), races=len(rows),
            counts={c: sum(1 for r in rows if r["category"] == c) for c in order}, nebraska=nel)
json.dump(dict(meta=meta, races=rows), open(OUT, "w"), separators=(",", ":"))
print(len(rows), meta["counts"])
