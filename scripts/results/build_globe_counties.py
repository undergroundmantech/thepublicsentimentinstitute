"""County outlines in longitude and latitude for the results monitor globe, tagged with FIPS codes.
Reads public/geo/us-counties.geojson (county_id like OH-CUYAHOGA) and public/watchdog/counties.json (names and FIPS),
simplifies each outline and writes public/results/2026/counties_ll.json as {fips: [[ring], ...]} with 3 decimals.
Usage: python3 build_globe_counties.py SITE_DIR"""
import json, os, re, sys, unicodedata
from shapely.geometry import shape, mapping
from shapely.geometry.polygon import orient
SITE = sys.argv[1]
g = json.load(open(os.path.join(SITE, "public/geo/us-counties.geojson")))
co = json.load(open(os.path.join(SITE, "public/watchdog/counties.json")))
k = lambda st, n: st + "-" + re.sub(r"[^A-Z0-9]", "", unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode().upper())
names = {k(v["st"], v["n"]): f for f, v in co.items()}
out, miss = {}, []
for ft in g["features"]:
    cid = ft["properties"]["county_id"]; st, nm = cid.split("-", 1)
    f = names.get(k(st, nm.replace("_", " ")))
    if not f: miss.append(cid); continue
    geom = shape(ft["geometry"]).simplify(0.008, preserve_topology=True)
    polys = [geom] if geom.geom_type == "Polygon" else list(getattr(geom, "geoms", []))
    rings = []
    for p in polys:
        p = orient(p, sign=-1.0)  # clockwise outer rings, the winding d3-geo reads as the small polygon
        ring = [[round(x, 3), round(y, 3)] for x, y in p.exterior.coords]
        if len(ring) >= 4: rings.append(ring)
    if rings: out[f] = rings
json.dump(out, open(os.path.join(SITE, "public/results/2026/counties_ll.json"), "w"), separators=(",", ":"))
print(len(out), "counties; unmatched:", miss)
