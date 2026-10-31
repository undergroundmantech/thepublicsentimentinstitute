"""Expected results for every November 3, 2026 race the forecast covers (Oct 22 2026).

Writes public/results/2026/index.json, one entry per race with its expected vote by candidate, margin, win or pass
probability, forecast page and the hints the results pages use to find the race in civicAPI, and
public/results/2026/st/<ST>.json with the expected vote in every county for each statewide race and ballot measure
and the expected vote in every state legislative district. Every number is the published forecast; nothing is new.

Usage: python3 build_2026_expected.py SITE_DIR
"""
import json, os, re, sys
SITE = sys.argv[1]
F = lambda n: json.load(open(os.path.join(SITE, "public/forecast", n)))
model, db, dbc, cnty, meas, mc, sh, other = F("model.json"), F("downballot.json"), F("downballot_counties.json"), F("counties.json"), F("measures.json"), F("measures_counties.json"), F("statehouse.json"), F("other_races.json")
STN = {r["st"]: r["state"] for r in model["races"]}
OFFICE_CIV = {
    "lieutenant-governor": ["Lieutenant Governor"], "attorney-general": ["Attorney General"], "secretary-of-state": ["Secretary of State"],
    "treasurer": ["State Treasurer", "Treasurer"], "auditor": ["Auditor", "State Auditor"], "comptroller": ["Comptroller", "Controller"],
    "agriculture-commissioner": ["Agriculture Commissioner", "Commissioner of Agriculture and Industries", "Secretary of Agriculture", "Commissioner of Agriculture"],
    "land-commissioner": ["Land Commissioner", "Commissioner of State Lands", "Commissioner of Public Lands"],
    "superintendent": ["Superintendent of Public Instruction", "Superintendent"], "insurance-commissioner": ["Insurance Commissioner"],
    "labor-commissioner": ["Labor Commissioner", "Commissioner of Labor"], "mine-inspector": ["State Mine Inspector"],
    "public-service-commission": ["Public Service Commissioner", "Public Service Commission"], "railroad-commissioner": ["Railroad Commissioner"],
    "education-board": ["State Board of Education", "Education"], "supreme-court": ["Supreme Court", "Judicial"],
}
r1 = lambda x: None if x is None else round(float(x), 2)
# Probabilities keep the forecast's own precision (4 places); 2 places turned 0.005 into 0.01.
p4 = lambda x: None if x is None else round(float(x), 4)
idx, per = [], {}
def st_file(st): return per.setdefault(st, {"counties": {}, "leg": {}})

def rows(src, rid):
    out = {}
    for f, v in (src.get(rid) or {}).items():
        if not isinstance(v, list) or len(v) < 4: continue
        d, r, t = int(v[1]), int(v[2]), int(v[3]); out[f] = [d, r, max(0, t - d - r), t]
    return out

# Senate, governor, House
for r in model["races"]:
    o = {"senate": "sen", "governor": "gov", "house": "house"}[r["office"]]
    v = r.get("votes") or {}
    cands = [[c["name"], c["party"], int(c.get("votes") or 0)] for c in r.get("cands", []) if c.get("name") and not c["name"].startswith("No ")]
    e = {"id": r["id"], "k": o, "st": r["st"], "nm": r["name"] if o != "house" else f"{r['state']} {int(r['district']) if r['district'] else 'at large'}",
         "off": {"sen": "U.S. Senate", "gov": "Governor", "house": "U.S. House"}[o], "c": cands, "tot": int(v.get("total") or 0),
         "m": r1(r["est"]["margin"]), "pR": p4(r["est"]["prob"]), "href": None,
         "civ": {"t": ["US Senate"] if o == "sen" else ["Governor"] if o == "gov" else ["House of Representatives", "US House"],
                 "d": f"{r['st']}-{int(r['district']):02d}" if o == "house" else None}}
    if o == "house" and r["st"] in ("AK", "WY", "ND", "SD", "VT", "DE"): e["civ"]["al"] = True
    if o != "house":
        c = rows(cnty, r["id"])
        if c: st_file(r["st"])["counties"][r["id"]] = c; e["cty"] = len(c)
    idx.append(e)

# statewide offices
for r in db["races"]:
    v = r.get("votes") or {}
    cands = [[r["dem"], "D", int(v.get("dem") or 0)]] if r.get("dem") else []
    if r.get("gop"): cands.append([r["gop"], "R", int(v.get("rep") or 0)])
    for x in r.get("others") or []:
        nm = x.get("name") if isinstance(x, dict) else x
        if nm: cands.append([nm, (x.get("party") if isinstance(x, dict) else None) or "O", 0])
    e = {"id": r["id"], "k": "state", "st": r["st"], "nm": f"{r['state']} {r['officeLabel'].lower() if r['officeLabel'][0].isupper() and r['officeLabel'] not in ('Supreme Court',) else r['officeLabel']}",
         "off": r["officeLabel"], "c": cands, "tot": int(v.get("total") or 0), "m": r1((r.get("est") or {}).get("margin")), "pR": p4((r.get("est") or {}).get("prob")),
         "civ": {"t": OFFICE_CIV.get(r["office"], [r["officeLabel"]]), "seat": r.get("seat")}}
    c = rows(dbc, r["id"])
    if c: st_file(r["st"])["counties"][r["id"]] = c; e["cty"] = len(c)
    idx.append(e)

# ballot measures
def mkey(label):
    nums = re.findall(r"\d+[A-Z]?", label)
    return nums[0] if nums else None
for r in meas["measures"]:
    v = r.get("votes") or {}
    e = {"id": r["id"], "k": "measure", "st": r["st"], "nm": f"{STN.get(r['st'], r['st'])} {r['label']}", "off": r["title"],
         "c": [["Yes", "Y", int(v.get("yes") or 0)], ["No", "N", int(v.get("no") or 0)]], "tot": int(v.get("total") or 0),
         "yes": r1((r.get("est") or {}).get("yes")), "pPass": p4((r.get("est") or {}).get("prob")), "thr": r.get("threshold"),
         "civ": {"t": ["Proposition", "Referendum", "Ballot Measure", "Initiative", "Amendment", "Constitutional Amendment", "Question", "Issue"], "n": mkey(r["label"]), "lab": r["label"]}}
    c = {}
    for f, x in (mc.get(r["id"]) or {}).items():
        if isinstance(x, list) and len(x) >= 3: c[f] = [int(x[1]), int(x[2]), 0, int(x[1]) + int(x[2])]
    if c: st_file(r["st"])["counties"][r["id"]] = c; e["cty"] = len(c)
    idx.append(e)

# state legislatures: a chamber entry with expected seats, districts in the state file
for ch in sh["chambers"]:
    st = ch["st"]; lab = "State House" if ch["chamber"] == "house" else "State Senate" if ch["chamber"] == "senate" else ch["chamber"].title()
    dists = []
    for d in ch.get("districts") or []:
        v = d.get("votes") or [0, 0, 0, 0]
        dists.append({"d": str(d["d"]), "s": d.get("seats", 1), "D": d.get("dem"), "R": d.get("gop"), "I": d.get("ind"), "v": [int(x or 0) for x in v[:4]], "m": r1(d.get("margin")), "pD": p4(d.get("probD")), "st": d.get("status")})
    st_file(st)["leg"][ch["id"]] = dists
    idx.append({"id": ch["id"], "k": "leg", "st": st, "nm": ch["name"], "off": lab, "up": ch.get("up"), "seats": ch.get("seats"), "maj": ch.get("majority"),
                "dS": r1(ch.get("demSeats")), "rS": r1(ch.get("gopSeats")), "pD": p4(ch.get("demControl")), "pR": p4(ch.get("gopControl")), "nd": len(dists),
                "civ": {"t": ["State Assembly", "State House", "House of Delegates"] if ch["chamber"] == "house" else ["State Senate"], "code": "HD" if ch["chamber"] == "house" else "SD"}})

# courts, mayors and local races: candidates only, no expected vote
for r in other["races"]:
    if r.get("date") != "2026-11-03": continue
    idx.append({"id": r["id"], "k": "other", "st": r["state"], "nm": f"{r.get('jurisdiction') or r['state']} {r['office']}{(' ' + r['seat']) if r.get('seat') else ''}",
                "off": r["office"], "cat": r.get("category"), "c": [[c["name"], c.get("party") or "O", 0] for c in r.get("candidates", [])], "tot": 0,
                "civ": {"names": [c["name"].split()[-1] for c in r.get("candidates", []) if c.get("name")]}})

# county names for every state file
names = cnty.get("_n") or {}
FIPS_ST = {"01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY"}
for f, n in names.items():
    st = FIPS_ST.get(f[:2])
    if st: st_file(st).setdefault("names", {})[f] = n

out = os.path.join(SITE, "public/results/2026"); os.makedirs(os.path.join(out, "st"), exist_ok=True)
json.dump({"asOf": model["meta"]["updated"], "election": "2026-11-03", "races": idx}, open(os.path.join(out, "index.json"), "w"), separators=(",", ":"), ensure_ascii=False)
for st, v in per.items(): json.dump(v, open(os.path.join(out, "st", f"{st}.json"), "w"), separators=(",", ":"))
from collections import Counter
print(len(idx), dict(Counter(e["k"] for e in idx)), len(per), "state files")
