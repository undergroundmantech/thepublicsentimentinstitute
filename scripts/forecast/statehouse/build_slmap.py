"""Approximate district maps for the state legislative forecast.

No district boundary files reach this build, so the maps are drawn from where each district's voters are. Every
district gets a seed point: a district whose votes sit mostly in one county gets one of a set of points spread evenly
over that county, matched toward the neighbors it spills into, and a district that spans counties sits at the vote
weighted center of them. The state is then split among the seeds, each point of the state going to its nearest seed,
and clipped to the state outline. Equal population districts come out small in the cities and large in the country,
the way the real maps look, but the lines are an estimate, not the official boundaries.

Inputs: /tmp/sl/geo/{ST}_{year}_dcounty.csv (district votes by county from the MIT Election Lab precinct files),
public/forecast/states/{ST}.json (county outlines), public/forecast/geo.json (national frame).
Writes public/forecast/statehouse_map/{ST}.json for the chamber pages and public/forecast/statehouse_map_us.json."""
import json, re, glob, math, os
import numpy as np, pandas as pd
from scipy.spatial import Voronoi
from scipy.optimize import linear_sum_assignment
from sklearn.cluster import KMeans
from shapely.geometry import Polygon, MultiPolygon, Point, box as sbox
from shapely.ops import unary_union
from shapely.validation import make_valid

PUB = os.environ.get("PUB", "/tmp/site/public/forecast")
SH = json.load(open(f"{PUB}/statehouse.json"))
GEO = json.load(open(f"{PUB}/geo.json"))
os.makedirs(f"{PUB}/statehouse_map", exist_ok=True)
rng = np.random.default_rng(11)

DC = {}
for f in glob.glob("/tmp/sl/geo/*_dcounty.csv"):
    d = pd.read_csv(f, dtype={"fips": str, "district": str}, keep_default_na=False)
    if not len(d): continue
    st, yr = os.path.basename(f).split("_")[:2]
    d["fips"] = d.fips.str.extract(r"(\d{4,5})")[0].fillna("").str.zfill(5)
    DC[(st, int(yr))] = d

# OpenElections county results, 2014 to 2022, place the districts the precinct files left out (mostly unopposed seats)
OEC = pd.read_csv("/tmp/statleg/final/state_legislative_county.csv", dtype=str, keep_default_na=False)
OEC = OEC[OEC.stage == "general"]
OEC["votes"] = pd.to_numeric(OEC.votes, errors="coerce").fillna(0)
OEC["dn"] = OEC.district.str.strip().str.upper().str.replace(r"^0+(\d)", r"\1", regex=True)
CNAME = json.load(open(f"{PUB}/counties.json"))["_n"]
def norm_c(s): return re.sub(r"[^A-Z]", "", str(s).upper().replace("SAINT", "ST").replace("COUNTY", "").replace("PARISH", ""))
def oe_weights(st, ch, d, fips_prefix, county):
    byname = {norm_c(n): f for f, n in CNAME.items() if f.startswith(fips_prefix)}
    for yr in ("2022", "2018", "2014"):
        g = OEC[(OEC.state == st) & (OEC.chamber == ch) & (OEC.dn == d) & (OEC.year == yr)]
        w = {}
        for c, f0, v in zip(g.county, g.county_fips, g.votes):
            f = f0.zfill(5) if f0 else byname.get(norm_c(c))
            if f in county and v > 0: w[f] = w.get(f, 0) + v
        if w:
            t = sum(w.values()); return {f: v / t for f, v in w.items()}
    return None

def rings(path):
    out = []
    for sub in re.split(r"(?=M)", path):
        pts = [tuple(map(float, p)) for p in re.findall(r"(-?\d+\.?\d*),(-?\d+\.?\d*)", sub)]
        if len(pts) >= 3: out.append(pts)
    return out

def to_shape(path):
    polys = []
    for r in rings(path):
        p = Polygon(r)
        if not p.is_valid: p = make_valid(p)
        if p.area > 0: polys.append(p)
    return unary_union(polys) if polys else None

def num(d):
    m = re.match(r"^(\d+)", str(d)); return int(m.group(1)) if m else None

def sample_in(geom, n):
    x0, y0, x1, y1 = geom.bounds; pts = []
    from shapely import contains_xy
    while len(pts) < n:
        xs = rng.uniform(x0, x1, n * 3); ys = rng.uniform(y0, y1, n * 3)
        ok = contains_xy(geom, xs, ys)
        pts += list(zip(xs[ok], ys[ok]))
    return np.array(pts[:n])

def path_of(g, nd=1):
    if g is None or g.is_empty: return ""
    geoms = [g] if isinstance(g, Polygon) else [x for x in getattr(g, "geoms", []) if isinstance(x, Polygon)]
    out = []
    for p in geoms:
        for ring in [p.exterior] + list(p.interiors):
            c = list(ring.coords)[:-1]
            if len(c) < 3: continue
            out.append("M" + "L".join(f"{x:.{nd}f},{y:.{nd}f}" for x, y in c) + "Z")
    return "".join(out)

def cells(points, outline):
    x0, y0, x1, y1 = outline.bounds; span = max(x1 - x0, y1 - y0) * 4
    far = np.array([[x0 - span, y0 - span], [x1 + span, y0 - span], [x0 - span, y1 + span], [x1 + span, y1 + span]])
    P = points + rng.normal(0, 1e-3, points.shape)
    vor = Voronoi(np.vstack([P, far]))
    res = []
    for i in range(len(P)):
        reg = vor.regions[vor.point_region[i]]
        if not reg or -1 in reg: res.append(None); continue
        poly = Polygon(vor.vertices[reg])
        res.append(make_valid(poly).intersection(outline))
    return res

US = {}
for st in sorted({c["st"] for c in SH["chambers"]}):
    sj = json.load(open(f"{PUB}/states/{st}.json"))
    county = {}
    for c in sj["counties"]:
        g = to_shape(c["d"])
        if g is not None and not g.is_empty: county[c["id"]] = g
    outline = unary_union(list(county.values())).buffer(0)
    bx = outline.bounds
    nb = GEO["box"][st]
    sx = nb[2] / max(1e-6, bx[2] - bx[0]); sy = nb[3] / max(1e-6, bx[3] - bx[1])
    state_out = dict(st=st, box=[round(v, 1) for v in bx], nat=[round(sx, 5), round(sy, 5), nb[0], nb[1]],
                     outline=path_of(outline.simplify(0.4)), chambers={})
    cent = {f: (g.centroid.x, g.centroid.y) for f, g in county.items()}
    for ch in [c for c in SH["chambers"] if c["st"] == st]:
        rows = {x["d"]: x for x in ch["districts"]}
        holdP = {d: p for d, p in ch.get("holdD", [])}
        allD = list(rows) + [d for d in holdP if d not in rows]
        # county weights, 2024 first, then 2022
        W = {}
        for d in allD:
            for yr in (2024, 2022):
                src = DC.get((st, yr))
                if src is None: continue
                g = src[(src.chamber == ch["chamber"]) & (src.district == d)]
                w = {f: v for f, v in zip(g.fips, g.votes) if f in county and v > 0}
                if w:
                    tot = sum(w.values()); W[d] = {f: v / tot for f, v in w.items()}; break
        pref = next(iter(county))[:2]
        for d in allD:
            if d not in W:
                w = oe_weights(st, ch["chamber"], d, pref, county)
                if w: W[d] = w
        target = {}
        for d, w in W.items():
            target[d] = (sum(cent[f][0] * v for f, v in w.items()), sum(cent[f][1] * v for f, v in w.items()))
        # seeds: districts that live in one county share that county's evenly spread points
        anchored = {}
        for d, w in W.items():
            f, v = max(w.items(), key=lambda x: x[1])
            if v >= 0.6: anchored.setdefault(f, []).append(d)
        seed = {}
        for f, ds in anchored.items():
            n = len(ds)
            if n == 1:
                p = county[f].representative_point() if not county[f].contains(Point(*target[ds[0]])) else Point(*target[ds[0]])
                seed[ds[0]] = (p.x, p.y); continue
            pts = sample_in(county[f], max(300, 60 * n))
            km = KMeans(n_clusters=n, n_init=3, random_state=3).fit(pts).cluster_centers_
            tg = np.array([target[d] for d in ds])
            cost = ((km[:, None, :] - tg[None, :, :]) ** 2).sum(-1)
            ri, ci = linear_sum_assignment(cost)
            for a, b in zip(ri, ci): seed[ds[b]] = tuple(km[a])
        for d in W:
            if d in seed: continue
            p = Point(*target[d])
            if not outline.contains(p):
                from shapely.ops import nearest_points
                p = nearest_points(outline, p)[0]
            seed[d] = (p.x, p.y)
        # districts with no precinct rows sit between their numbered neighbors
        for d in allD:
            if d in seed: continue
            n0 = num(d)
            near = [seed[e] for e in seed if n0 is not None and num(e) is not None and abs(num(e) - n0) <= 2]
            if near: seed[d] = tuple(np.mean(near, 0) + rng.normal(0, 2, 2))
            else:
                p = outline.representative_point(); seed[d] = (p.x + rng.normal(0, 5), p.y + rng.normal(0, 5))
        P = np.array([seed[d] for d in allD])
        geoms = cells(P, outline)
        out = {}
        nat = {}
        for d, g, p in zip(allD, geoms, P):
            if g is None or g.is_empty: continue
            gs = g.simplify(0.35, preserve_topology=True)
            out[d] = [path_of(gs), round(float(p[0]), 1), round(float(p[1]), 1)]
            gn = gs.simplify(0.6, preserve_topology=True)
            from shapely import affinity
            gn = affinity.affine_transform(gn, [sx * 2, 0, 0, sy * 2, (nb[0] - bx[0] * sx) * 2, (nb[1] - bx[1] * sy) * 2])
            nat[d] = path_of(gn.simplify(0.5, preserve_topology=True), 0)
        state_out["chambers"][ch["chamber"]] = dict(id=ch["id"], d=out, hold=holdP, located=len(W), total=len(allD))
        US[ch["id"]] = nat
        print(ch["id"], f"{len(W)}/{len(allD)} located", len(out), "cells", flush=True)
    json.dump(state_out, open(f"{PUB}/statehouse_map/{st}.json", "w"), separators=(",", ":"))
json.dump(dict(frame=[GEO["frame"][0] * 2, GEO["frame"][1] * 2], chambers=US), open(f"{PUB}/statehouse_map_us.json", "w"), separators=(",", ":"))
print("national", os.path.getsize(f"{PUB}/statehouse_map_us.json") // 1024, "KB")
