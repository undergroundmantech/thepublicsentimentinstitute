"""Builds the national donor map's public files from the cycle pulls.

  python3 -I scripts/donors/build_donor_map.py [site root]

Reads, under scripts/forecast/donors/data/:
  cycles/<cycle>/counties.json     from fec_cycle_map.py, for 2022, 2024 and 2026
  gov/<cycle>/<ST>.json            from gov_pull.py, governor nominees for 2022 and 2026
  county_bands.json, candidates.json   the October 20 2026 map, used for 2026 until cycles/2026 exists
Writes public/forecast/donormap/index.json (what exists, county names, adults, 2024 vote) and one <cycle>.json each.
Cell layout, per county: [donations, donations under $200, dollars, Democratic dollars, Republican dollars]; -1 means
the source does not carry that figure.
"""
import glob, json, os, sys, time

SITE = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
D = os.path.join(SITE, "scripts", "forecast", "donors", "data")
OUT = os.path.join(SITE, "public", "forecast", "donormap"); os.makedirs(OUT, exist_ok=True)
J = lambda p: json.load(open(p))
WD = J(os.path.join(SITE, "public", "watchdog", "counties.json"))
GEO = {r[0] for r in J(os.path.join(SITE, "public", "watchdog", "us_counties.json"))}
# 2020 county codes the crosswalk uses that the map draws differently
ALIAS = {"02063": "02261", "02066": "02261", "46113": "46102", "02270": "02158"}
OFF_LABEL = {"all": "All federal", "H": "House", "S": "Senate", "P": "President", "G": "Governor"}
CYCLES = [2022, 2024, 2026]


def fx(f): f = ALIAS.get(f, f); return f if f in GEO else None


def add(cell_map, f, v):
    f = fx(f)
    if not f: return False
    if f in cell_map:
        a = cell_map[f]; cell_map[f] = [(x + y) if x >= 0 and y >= 0 else -1 for x, y in zip(a, v)]
    else: cell_map[f] = list(v)
    return True


def tot(cells):
    t = [0, 0, 0, 0, 0]
    for v in cells.values():
        t = [(a + b) if a >= 0 and b >= 0 else -1 for a, b in zip(t, v)]
    return t


P24 = J(os.path.join(SITE, "public", "forecast", "pres24_counties.json"))["c"]


def rmargin(f):
    v = P24.get(f)
    return round(100 * (v[1] - v[0]) / sum(v), 1) if v and sum(v) else None


index = {"built": time.strftime("%Y-%m-%dT%H:%M:%S"), "cycles": {}, "offices": OFF_LABEL,
         "counties": {f: [c.get("n", ""), c.get("st", ""), (c.get("pop") or {}).get("adults") or 0, c.get("v24") or 0, rmargin(f)] for f, c in WD.items() if f in GEO},
         "layout": "counties: fips -> [name, state, adults, 2024 votes, 2024 presidential margin, Republican minus Democratic points]"}

for cy in CYCLES:
    res = {"cycle": cy, "cells": {}, "natl": {}, "top": {}, "gov": {}, "dropped": {}}
    info = {"fed": None, "gov": [], "windows": [], "offices": []}
    fp = os.path.join(D, "cycles", str(cy), "counties.json")
    if os.path.exists(fp):
        C = J(fp); names = C.get("names", {}); meta = J(os.path.join(D, "cycles", str(cy), "meta.json")) if os.path.exists(os.path.join(D, "cycles", str(cy), "meta.json")) else {}
        info["fed"] = "fec"; info["period"] = f"Jan 1 {cy - 1} to Sep 30 {cy}, and the full cycle"; info["unmatched_share"] = meta.get("unmatched_share")
        miss = 0
        for f, ws in C["counties"].items():
            for w, offs in ws.items():
                for o, cell in offs.items():
                    if o == "top" or (o == "P" and cy % 4): continue  # no presidential race in a midterm
                    ok = add(res["cells"].setdefault(f"{w}|{o}", {}), f, [sum(cell["n"]), cell["n"][0], sum(cell["usd"]), sum(cell["D"]), sum(cell["R"])])
                    miss += 0 if ok else 1
                if "top" in offs and fx(f):
                    res["top"].setdefault(w, {})[fx(f)] = [[(names.get(c) or [c])[0], (names.get(c) or ["", "O"])[1], (names.get(c) or ["", "", ""])[2], u] for c, u in offs["top"][:3]]
        res["dropped"]["fed_cells_off_map"] = miss
    elif cy == 2026 and os.path.exists(os.path.join(D, "county_bands.json")):
        B = J(os.path.join(D, "county_bands.json"))["counties"]
        cand = {c["cand_id"]: c for c in J(os.path.join(D, "candidates.json"))}
        PT = {"DEM": "D", "REP": "R"}
        info["fed"] = "oct20"; info["period"] = "Jan 1 2025 to Sep 30 2026, House and Senate"
        cells = res["cells"].setdefault("sep30|all", {})
        for f, c in B.items():
            add(cells, f, [sum(c["n"]), c["n"][0], -1, -1, -1])
            if fx(f):
                tops = []
                for cid, b in c.get("top", [])[:3]:
                    x = cand.get(cid, {})
                    tops.append([x.get("display_name") or x.get("name") or cid, PT.get(x.get("party"), "O"), x.get("office", ""), sum(b)])
                res["top"].setdefault("sep30", {})[fx(f)] = tops
    for gp in sorted(glob.glob(os.path.join(D, "gov", str(cy), "*.json"))):
        g = J(gp); st = g["st"]
        for w, ww in (("full", "full"), ("sep30", "sep30")):
            cells = res["cells"].setdefault(f"{w}|G", {})
            for f, c in g["counties"].items():
                if ww in c: add(cells, f, [sum(c[ww]["n"]), c[ww]["n"][0], sum(c[ww]["usd"]), sum(c[ww]["D"]), sum(c[ww]["R"])])
        res["gov"][st] = {"nominees": [{"name": n["name"], "party": n["party"], "sep30": [n["sep30"]["usd"], n["sep30"]["n"], n["sep30"]["bands_n"][0]],
                                        "full": [n["full"]["usd"], n["full"]["n"], n["full"]["bands_n"][0]], "home": n.get("home_state_share")} for n in g["nominees"]],
                          "individuals_only": g.get("individuals_only"), "unmatched_share": g.get("unmatched_share"), "adapter": g.get("adapter")}
        info["gov"].append(st)
    for k, cells in res["cells"].items():
        res["natl"][k] = tot(cells)
        w, o = k.split("|")
        if w not in info["windows"]: info["windows"].append(w)
        if o not in info["offices"]: info["offices"].append(o)
    if not res["cells"]: continue
    json.dump(res, open(os.path.join(OUT, f"{cy}.json"), "w"), separators=(",", ":"))
    info["natl"] = res["natl"]
    info["gov_summary"] = res["gov"]
    index["cycles"][str(cy)] = info
    print(cy, info["fed"], "governors:", len(info["gov"]), "keys:", sorted(res["cells"]), f"{os.path.getsize(os.path.join(OUT, f'{cy}.json')) / 1e6:.2f} MB")
json.dump(index, open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"))
print("index", f"{os.path.getsize(os.path.join(OUT, 'index.json')) / 1e3:.0f} KB")
