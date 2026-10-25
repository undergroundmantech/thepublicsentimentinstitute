"""Builds the donor map's public files from the cycle pulls.

  python3 -I scripts/donors/build_donor_map.py [site root]

Reads, under scripts/forecast/donors/data/:
  cycles/<cycle>/counties.json, candidates.json, cand_county.json.gz   from fec_cycle_map.py, 2022, 2024 and 2026
  gov/<cycle>/<ST>.json                                              from gov_pull.py, governor nominees
  county_bands.json, candidates.json                                 the October 20 2026 map, used until cycles/2026 exists
and public/forecast/model.json for the 2026 nominees.
Writes, under public/forecast/donormap/:
  index.json            what exists, county names, adults, 2024 vote, the county order, and every race with its nominees
  <cycle>.json          every county's donors for all federal races and by office, both windows
  races/<cycle>/<id>.json  one race: each county's dollars to the two nominees by gift size, through Sep 30, plus full cycle
Cell layout, per county: [donations, donations under $200, D dollars by band x4, R dollars by band x4, all dollars]; -1
means the source does not carry that figure. Bands: under $200, $200 to $999, $1,000 to $2,499, $2,500 and up.
Race row layout: [county index, D by band x4, R by band x4, D full cycle, R full cycle].
"""
import glob, gzip, json, os, re, sys, time

SITE = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
D = os.path.join(SITE, "scripts", "forecast", "donors", "data")
OUT = os.path.join(SITE, "public", "forecast", "donormap"); os.makedirs(OUT, exist_ok=True)
J = lambda p: json.load(open(p))
WD = J(os.path.join(SITE, "public", "watchdog", "counties.json"))
GEO = sorted({r[0] for r in J(os.path.join(SITE, "public", "watchdog", "us_counties.json"))})
GI = {f: i for i, f in enumerate(GEO)}
ALIAS = {"02063": "02261", "02066": "02261", "46113": "46102", "02270": "02158"}  # 2020 county codes the map draws differently
OFF_LABEL = {"all": "All federal", "H": "House", "S": "Senate", "P": "President", "G": "Governor"}
CYCLES = [2022, 2024, 2026]
ST = {"AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming", "US": "United States"}
MIN_HOUSE = 250_000  # House races need this much through Sep 30 between the two nominees to get a page


def fx(f): f = ALIAS.get(f, f); return f if f in GI else None


def add(cell_map, f, v):
    f = fx(f)
    if not f: return False
    if f in cell_map: cell_map[f] = [(x + y) if x >= 0 and y >= 0 else -1 for x, y in zip(cell_map[f], v)]
    else: cell_map[f] = list(v)
    return True


def tot(cells):
    t = None
    for v in cells.values(): t = list(v) if t is None else [(a + b) if a >= 0 and b >= 0 else -1 for a, b in zip(t, v)]
    return t or [0] * 11


def cell_of(c):  # one county cell from fec_cycle_map or gov_pull, refunds floored at zero
    z = lambda a: [max(0, int(round(x))) for x in a]
    return [max(0, int(sum(c["n"]))), max(0, int(c["n"][0]))] + z(c["D"]) + z(c["R"]) + [max(0, int(sum(c["usd"])))]


P24 = J(os.path.join(SITE, "public", "forecast", "pres24_counties.json"))["c"]


def rmargin(f):
    v = P24.get(f)
    return round(100 * (v[1] - v[0]) / sum(v), 1) if v and sum(v) else None


def pretty(n):  # "OSSOFF, T. JONATHAN" to "T. Jonathan Ossoff"
    n = re.sub(r"\s+", " ", n or "").strip()
    if "," in n: lst, first = n.split(",", 1); n = f"{first.strip()} {lst.strip()}"
    out, suf = [], []
    def cap(w):
        w = "-".join(p.capitalize() for p in w.split("-"))
        w = "'".join(p[:1].upper() + p[1:] for p in w.split("'"))
        return re.sub(r"^(Mc|Mac(?=[a-z]{4}))([a-z])", lambda m: m.group(1) + m.group(2).upper(), w)
    for w in n.split():
        b = w.strip(".").upper()
        if b in ("MR", "MRS", "MS", "DR", "HON"): continue
        if b in ("JR", "SR", "II", "III", "IV"): suf.append(b if b in ("II", "III", "IV") else b.capitalize() + "."); continue
        out.append(w.upper() if re.fullmatch(r"[A-Za-z]\.", w) else cap(w.lower()))
    return " ".join(out + suf)


def last(n): return re.sub(r"[^a-z]", "", (n or "").replace(",", " ").split()[-1].lower()) if n else ""


MODEL = {}
try:
    for x in J(os.path.join(SITE, "public", "forecast", "model.json"))["races"]:
        if x["id"].startswith("sen-"): MODEL[f"S-{x['st']}"] = (x.get("dem"), x.get("gop"))
        elif x["id"].startswith("house-"): MODEL[f"H-{x['st']}-{int(x.get('district') or 0):02d}"] = (x.get("dem"), x.get("gop"))
except Exception as e: print("model.json not read:", e)

index = {"built": time.strftime("%Y-%m-%dT%H:%M:%S"), "cycles": {}, "offices": OFF_LABEL, "fips": GEO,
         "counties": {f: [c.get("n", ""), c.get("st", ""), (c.get("pop") or {}).get("adults") or 0, c.get("v24") or 0, rmargin(f)] for f, c in WD.items() if f in GI},
         "states": ST,
         "layout": "counties: fips -> [name, state, adults, 2024 votes, 2024 presidential margin R minus D]; races: [id, name, office, st, district, D name, R name, D sep30, R sep30, D full, R full, counties]"}

for cy in CYCLES:
    res = {"cycle": cy, "cells": {}, "natl": {}, "top": {}, "gov": {}}
    info = {"fed": None, "gov": [], "windows": [], "offices": [], "races": []}
    cdir = os.path.join(D, "cycles", str(cy))
    rdir = os.path.join(OUT, "races", str(cy)); os.makedirs(rdir, exist_ok=True)
    for old in glob.glob(os.path.join(rdir, "*.json")): os.remove(old)
    if os.path.exists(os.path.join(cdir, "counties.json")):
        C = J(os.path.join(cdir, "counties.json")); names = C.get("names", {})
        info["fed"] = "fec"; info["period"] = f"Jan 1 {cy - 1} to Sep 30 {cy}"
        for f, ws in C["counties"].items():
            for w, offs in ws.items():
                for o, cell in offs.items():
                    if o == "top" or (o == "P" and cy % 4): continue  # no presidential race in a midterm
                    add(res["cells"].setdefault(f"{w}|{o}", {}), f, cell_of(cell))
                if "top" in offs and fx(f):
                    res["top"].setdefault(w, {})[fx(f)] = [[pretty((names.get(c) or [c])[0]), (names.get(c) or ["", "O"])[1], (names.get(c) or ["", "", ""])[2], u] for c, u in offs["top"][:3]]
        # ---------------- races: the two nominees, every county they drew money from
        cands = J(os.path.join(cdir, "candidates.json")) if os.path.exists(os.path.join(cdir, "candidates.json")) else []
        cc = {}
        if os.path.exists(os.path.join(cdir, "cand_county.json.gz")):
            with gzip.open(os.path.join(cdir, "cand_county.json.gz"), "rt") as fh: cc = json.load(fh)
        groups = {}
        for c in cands:
            if c["cand_id"] not in cc: continue
            o = c.get("office")
            if o == "P" and cy % 4: continue
            if o == "H":
                try: dist = int(c.get("district") or 0)
                except ValueError: continue
                key = f"H-{c['state']}-{dist:02d}"
            elif o == "S": key = f"S-{c['state']}"
            elif o == "P": key = "P-US"
            else: continue
            groups.setdefault(key, []).append(c)
        for key, cs in groups.items():
            by = lambda p: sorted([c for c in cs if c["p"] == p], key=lambda c: -c["sep30"]["usd"])
            dc, rc = (by("D") or [None])[0], (by("R") or [None])[0]
            if cy == 2026 and key in MODEL:  # the forecast's nominees, an independent can sit in the Democratic slot
                dn, rn = MODEL[key]
                md = next((c for c in sorted(cs, key=lambda c: -c["sep30"]["usd"]) if last(c["name"].split(",")[0]) == last(dn)), None) if dn and "No " not in dn else None
                mr = next((c for c in sorted(cs, key=lambda c: -c["sep30"]["usd"]) if last(c["name"].split(",")[0]) == last(rn)), None) if rn and "No " not in rn else None
                dc, rc = md or dc, mr or rc
            if not dc and not rc: continue
            dsep = dc["sep30"]["usd"] if dc else 0; rsep = rc["sep30"]["usd"] if rc else 0
            if key.startswith("H-") and dsep + rsep < MIN_HOUSE: continue
            st = key.split("-")[1]
            dist = key.split("-")[2] if key.startswith("H-") else None
            nm = "President" if key == "P-US" else f"{ST.get(st, st)} Senate" if key.startswith("S-") else f"{ST.get(st, st)} {'at large' if dist == '00' else str(int(dist)) + {1: 'st', 2: 'nd', 3: 'rd'}.get(int(dist) % 10 if int(dist) % 100 not in (11, 12, 13) else 0, 'th')} District"
            rows = []
            fips_all = set(cc.get(dc["cand_id"], {}) if dc else {}) | set(cc.get(rc["cand_id"], {}) if rc else {})
            agg = {}
            for f in fips_all:
                g = fx(f)
                if not g: continue
                dv = cc.get(dc["cand_id"], {}).get(f, [0] * 8) if dc else [0] * 8
                rv = cc.get(rc["cand_id"], {}).get(f, [0] * 8) if rc else [0] * 8
                a = agg.setdefault(g, [0] * 10)
                for k in range(4): a[k] += dv[4 + k]; a[4 + k] += rv[4 + k]
                a[8] += sum(dv[:4]); a[9] += sum(rv[:4])
            for g, a in agg.items():
                if sum(a[:8]) + a[8] + a[9] < 50: continue
                rows.append([GI[g]] + [max(0, int(x)) for x in a])
            rows.sort(key=lambda r: -(sum(r[1:9])))
            rec = {"id": key, "cycle": cy, "office": key[0], "st": st, "dist": dist, "name": nm,
                   "D": {"name": pretty(dc["name"]) if dc else None, "party": dc["p"] if dc else "D", "usd": dsep, "full": dc["full"]["usd"] if dc else 0, "home": dc.get("home_state_share") if dc else None, "unitem": dc.get("unitemized") if dc else None, "small": dc.get("conduit_small_usd") if dc else None},
                   "R": {"name": pretty(rc["name"]) if rc else None, "party": "R", "usd": rsep, "full": rc["full"]["usd"] if rc else 0, "home": rc.get("home_state_share") if rc else None, "unitem": rc.get("unitemized") if rc else None, "small": rc.get("conduit_small_usd") if rc else None},
                   "rows": rows}
            if cy == 2026 and key in MODEL:
                dn, rn = MODEL[key]
                if dn and "No " not in dn and dc and last(dc["name"].split(",")[0]) == last(dn): rec["D"]["name"] = dn
                if rn and "No " not in rn and rc and last(rc["name"].split(",")[0]) == last(rn): rec["R"]["name"] = rn
            json.dump(rec, open(os.path.join(rdir, f"{key}.json"), "w"), separators=(",", ":"))
            info["races"].append([key, nm, key[0], st, dist, rec["D"]["name"], rec["R"]["name"], dsep, rsep, rec["D"]["full"], rec["R"]["full"], len(rows)])
    elif cy == 2026 and os.path.exists(os.path.join(D, "county_bands.json")):
        B = J(os.path.join(D, "county_bands.json"))["counties"]
        cand = {c["cand_id"]: c for c in J(os.path.join(D, "candidates.json"))}
        PT = {"DEM": "D", "REP": "R"}
        info["fed"] = "oct20"; info["period"] = "Jan 1 2025 to Sep 30 2026, House and Senate"
        cells = res["cells"].setdefault("sep30|all", {})
        for f, c in B.items():
            add(cells, f, [sum(c["n"]), c["n"][0]] + [-1] * 9)
            if fx(f):
                res["top"].setdefault("sep30", {})[fx(f)] = [[cand.get(cid, {}).get("display_name") or cid, PT.get(cand.get(cid, {}).get("party"), "O"), cand.get(cid, {}).get("office", ""), sum(b)] for cid, b in c.get("top", [])[:3]]
    # ---------------- governors, from the state filings
    for gp in sorted(glob.glob(os.path.join(D, "gov", str(cy), "*.json"))):
        g = J(gp); st = g["st"]
        for w in ("full", "sep30"):
            cells = res["cells"].setdefault(f"{w}|G", {})
            for f, c in g["counties"].items():
                if w in c: add(cells, f, cell_of(c[w]))
        res["gov"][st] = {"nominees": [{"name": n["name"], "party": n["party"], "sep30": [n["sep30"]["usd"], n["sep30"]["n"], n["sep30"]["bands_n"][0]],
                                        "full": [n["full"]["usd"], n["full"]["n"], n["full"]["bands_n"][0]], "home": n.get("home_state_share")} for n in g["nominees"]],
                          "individuals_only": g.get("individuals_only"), "unmatched_share": g.get("unmatched_share"), "adapter": g.get("adapter")}
        info["gov"].append(st)
        dn = next((n for n in g["nominees"] if n["party"] == "D"), None); rn = next((n for n in g["nominees"] if n["party"] == "R"), None)
        rows = []
        for f, c in g["counties"].items():
            gg = fx(f)
            if not gg or "sep30" not in c: continue
            a = [int(x) for x in c["sep30"]["D"]] + [int(x) for x in c["sep30"]["R"]] + [int(sum(c.get("full", c["sep30"])["D"])), int(sum(c.get("full", c["sep30"])["R"]))]
            if sum(a) >= 50: rows.append([GI[gg]] + [max(0, x) for x in a])
        key = f"G-{st}"
        rec = {"id": key, "cycle": cy, "office": "G", "st": st, "dist": None, "name": f"{ST.get(st, st)} Governor", "instate": True,
               "D": {"name": dn["name"] if dn else None, "party": "D", "usd": dn["sep30"]["usd"] if dn else 0, "full": dn["full"]["usd"] if dn else 0, "home": dn.get("home_state_share") if dn else None},
               "R": {"name": rn["name"] if rn else None, "party": "R", "usd": rn["sep30"]["usd"] if rn else 0, "full": rn["full"]["usd"] if rn else 0, "home": rn.get("home_state_share") if rn else None},
               "rows": rows}
        json.dump(rec, open(os.path.join(rdir, f"{key}.json"), "w"), separators=(",", ":"))
        info["races"].append([key, rec["name"], "G", st, None, rec["D"]["name"], rec["R"]["name"], rec["D"]["usd"], rec["R"]["usd"], rec["D"]["full"], rec["R"]["full"], len(rows)])
    for k, cells in res["cells"].items():
        res["natl"][k] = tot(cells)
        w, o = k.split("|")
        if w not in info["windows"]: info["windows"].append(w)
        if o not in info["offices"]: info["offices"].append(o)
    if not res["cells"]: continue
    info["races"].sort(key=lambda x: -(x[7] + x[8]))
    json.dump(res, open(os.path.join(OUT, f"{cy}.json"), "w"), separators=(",", ":"))
    info["natl"] = res["natl"]; info["gov_summary"] = res["gov"]
    index["cycles"][str(cy)] = info
    rsize = sum(os.path.getsize(p) for p in glob.glob(os.path.join(rdir, "*.json")))
    print(cy, info["fed"], "governors:", len(info["gov"]), "races:", len(info["races"]), f"{os.path.getsize(os.path.join(OUT, f'{cy}.json')) / 1e6:.2f} MB, race files {rsize / 1e6:.1f} MB")
json.dump(index, open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"))
print("index", f"{os.path.getsize(os.path.join(OUT, 'index.json')) / 1e3:.0f} KB")
