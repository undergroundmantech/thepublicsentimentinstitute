"""Estimated district maps for the state legislative forecast, built county by county.

Official boundary files are not available to this build, so every district is rebuilt from the counties its voters live
in. The MIT Election Lab precinct returns say how many of each county's 2024 presidential voters (2022 top of ticket
for seats last drawn then) sit in each district. A county that one district holds whole goes to that district whole,
so most rural lines follow county lines the way the real maps do. A county split between districts is divided among
them in proportion to those voters, with each district's share placed on the side of the county that faces the rest of
the district, so a district that spills over a county line stays in one piece. The split uses a weighted nearest seed
partition whose weights are tuned until every piece has its share of the county's area, which gives straight, compact
lines inside counties. The result reads like a district map, but it is an estimate, not the official lines.

Writes public/forecast/statehouse_map/{ST}.json and public/forecast/statehouse_map_us.json, in the same format the site
reads: for every district its outline path and a label point."""
import json, re, glob, os, math
import numpy as np, pandas as pd
from shapely import contains_xy, affinity
from shapely.geometry import Polygon, MultiPolygon, Point, LineString, GeometryCollection
from shapely.ops import unary_union, polylabel
from shapely.validation import make_valid
from sklearn.cluster import KMeans
from scipy.optimize import linear_sum_assignment

PUB = os.environ.get("PUB", "/tmp/site/public/forecast")
SH = json.load(open(f"{PUB}/statehouse.json"))
GEO = json.load(open(f"{PUB}/geo.json"))
os.makedirs(f"{PUB}/statehouse_map", exist_ok=True)
rng = np.random.default_rng(5)

def load(kind):
    out = {}
    for f in glob.glob(f"/tmp/sl/geo/*_{kind}.csv"):
        d = pd.read_csv(f, dtype={"fips": str, "district": str}, keep_default_na=False)
        if not len(d): continue
        st, yr = os.path.basename(f).split("_")[:2]
        d["fips"] = d.fips.str.extract(r"(\d{4,5})")[0].fillna("").str.zfill(5)
        out[(st, int(yr))] = d
    return out
POP, LEG = load("dpop"), load("dcounty")

OEC = pd.read_csv("/tmp/statleg/final/state_legislative_county.csv", dtype=str, keep_default_na=False)
OEC = OEC[OEC.stage == "general"]
OEC["votes"] = pd.to_numeric(OEC.votes, errors="coerce").fillna(0)
OEC["dn"] = OEC.district.str.strip().str.upper().str.replace(r"^0+(\d)", r"\1", regex=True)
CNAME = json.load(open(f"{PUB}/counties.json"))["_n"]
def norm_c(s): return re.sub(r"[^A-Z]", "", str(s).upper().replace("SAINT", "ST").replace("COUNTY", "").replace("PARISH", ""))

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
    return unary_union(polys).buffer(0) if polys else None

def polys_of(g):
    if g is None or g.is_empty: return []
    if isinstance(g, Polygon): return [g]
    out = []
    for x in getattr(g, "geoms", []): out += polys_of(x)
    return out

def path_of(g, nd=1):
    out = []
    for p in polys_of(g):
        for ring in [p.exterior] + list(p.interiors):
            c = list(ring.coords)[:-1]
            if len(c) < 3: continue
            out.append("M" + "L".join(f"{x:.{nd}f},{y:.{nd}f}" for x, y in c) + "Z")
    return "".join(out)

def num(d):
    m = re.match(r"^(\d+)", str(d)); return int(m.group(1)) if m else None

def sample_in(geom, n):
    x0, y0, x1, y1 = geom.bounds; pts = np.zeros((0, 2)); tries = 0
    while len(pts) < n and tries < 40:
        xs = rng.uniform(x0, x1, n * 4); ys = rng.uniform(y0, y1, n * 4)
        ok = contains_xy(geom, xs, ys); pts = np.vstack([pts, np.column_stack([xs[ok], ys[ok]])]); tries += 1
    return pts[:n]

def halfplane(si, sj, wi, wj, big, ref):
    """Points x with |x-si|^2 - wi <= |x-sj|^2 - wj, as a large polygon around the reference point."""
    n = sj - si; nn = float(n @ n)
    if nn < 1e-12: return None
    c = (sj @ sj - si @ si + wi - wj) / 2.0          # n . x <= c
    p0 = ref - n * ((n @ ref - c) / nn); t = np.array([-n[1], n[0]]) / math.sqrt(nn); u = n / math.sqrt(nn)
    return Polygon([p0 + t * big, p0 - t * big, p0 - t * big - u * big, p0 + t * big - u * big])

def split_county(geom, ids, shares, toward):
    """Divide one county among districts by area share, each piece pushed toward the rest of its district."""
    k = len(ids); A = geom.area
    cen = np.array(geom.representative_point().coords[0])
    big = max(geom.bounds[2] - geom.bounds[0], geom.bounds[3] - geom.bounds[1]) * 50 + 10
    seeds = np.zeros((k, 2)); anchored = np.zeros(k, bool)
    inner = [i for i in range(k) if toward[i] is None]
    for i in range(k):
        if toward[i] is None: continue
        line = LineString([tuple(cen), tuple(toward[i])])
        hit = line.intersection(geom.boundary)
        pts = [np.array(g.coords[0]) for g in getattr(hit, "geoms", [hit]) if not g.is_empty and g.geom_type == "Point"]
        if pts:
            edge = min(pts, key=lambda q: np.linalg.norm(q - cen)); seeds[i] = cen + 0.62 * (edge - cen)
        else:
            seeds[i] = cen + 0.4 * (np.array(toward[i]) - cen) / max(1e-6, np.linalg.norm(np.array(toward[i]) - cen)) * math.sqrt(A) * 0.5
        anchored[i] = True
    M = int(min(4000, max(900, 140 * k)))
    P = sample_in(geom, M)
    if len(P) < k * 4: return None
    if inner:
        km = KMeans(n_clusters=len(inner), n_init=2, random_state=1).fit(P).cluster_centers_ if len(inner) > 1 else np.array([cen])
        # keep the inner districts off the anchored ones: take the cluster centers farthest from anchored seeds
        if anchored.any() and len(inner) > 1:
            km2 = KMeans(n_clusters=min(len(P) // 4, len(inner) + int(anchored.sum())), n_init=2, random_state=2).fit(P).cluster_centers_
            d = np.min(np.linalg.norm(km2[:, None, :] - seeds[anchored][None, :, :], axis=2), axis=1)
            km = km2[np.argsort(-d)[: len(inner)]]
        for j, i in enumerate(inner): seeds[i] = km[j]
    target = np.asarray(shares) / np.sum(shares) * len(P)
    w = np.zeros(k); scale = A / max(1, len(P)) * 6
    for it in range(80):
        dist = ((P[:, None, :] - seeds[None, :, :]) ** 2).sum(-1) - w[None, :]
        lab = dist.argmin(1)
        cnt = np.bincount(lab, minlength=k).astype(float)
        err = target - cnt
        w += 0.9 * err * scale / max(1.0, target.mean()) * (1 - it / 100)
        if it % 8 == 7:
            for i in range(k):
                if cnt[i] > 0:
                    c = P[lab == i].mean(0)
                    seeds[i] = c if not anchored[i] else 0.6 * seeds[i] + 0.4 * c
        if np.abs(err).max() < max(4, 0.02 * len(P)) and it > 20: break
    cells = []
    for i in range(k):
        g = geom
        for j in range(k):
            if j == i: continue
            h = halfplane(seeds[i], seeds[j], w[i], w[j], big, cen)
            if h is not None: g = g.intersection(h)
            if g.is_empty: break
        cells.append(g)
    return cells

US = {}
ONLY = set(os.environ.get("ONLY", "").split(",")) - {""}
for st in sorted({c["st"] for c in SH["chambers"]}):
    if ONLY and st not in ONLY: continue
    sj = json.load(open(f"{PUB}/states/{st}.json"))
    county = {}
    for c in sj["counties"]:
        g = to_shape(c["d"])
        if g is not None and not g.is_empty: county[c["id"]] = g
    outline = unary_union(list(county.values())).buffer(0)
    bx = outline.bounds; nb = GEO["box"][st]
    sx = nb[2] / max(1e-6, bx[2] - bx[0]); sy = nb[3] / max(1e-6, bx[3] - bx[1])
    cent = {f: np.array(g.representative_point().coords[0]) for f, g in county.items()}
    pref = next(iter(county))[:2]
    byname = {norm_c(n): f for f, n in CNAME.items() if f.startswith(pref)}
    state_out = dict(st=st, box=[round(v, 1) for v in bx], nat=[round(sx, 5), round(sy, 5), nb[0], nb[1]],
                     outline=path_of(outline.simplify(0.4)), chambers={})
    for ch in [c for c in SH["chambers"] if c["st"] == st]:
        rows = {x["d"]: x for x in ch["districts"]}
        holdP = {d: p for d, p in ch.get("holdD", [])}
        allSeats = list(rows) + [d for d in holdP if d not in rows]
        # Washington's positions and Idaho's A and B seats share one district
        def base(d):
            if ch["chamber"] == "house" and st == "WA": return d.split("-")[0]
            if ch["chamber"] == "house" and st == "ID": return re.sub(r"[AB]$", "", d)
            return d
        members = {}
        for d in allSeats: members.setdefault(base(d), []).append(d)
        allD = list(members)
        # voters of each district by county
        V = {}
        for d in allD:
            for src in (POP.get((st, 2024)), POP.get((st, 2022)), LEG.get((st, 2024)), LEG.get((st, 2022))):
                if src is None: continue
                g = src[(src.chamber == ch["chamber"]) & (src.district.isin(members[d]))]
                g = g[g.district == g.district.iloc[0]] if len(g) else g
                w = {f: float(v) for f, v in zip(g.fips, g.votes) if f in county and v > 0}
                if w: V[d] = w; break
            if d not in V:
                for yr in ("2022", "2018", "2014"):
                    g = OEC[(OEC.state == st) & (OEC.chamber == ch["chamber"]) & (OEC.dn == d) & (OEC.year == yr)]
                    w = {}
                    for cn, f0, v in zip(g.county, g.county_fips, g.votes):
                        f = f0.zfill(5) if f0 else byname.get(norm_c(cn))
                        if f in county and v > 0: w[f] = w.get(f, 0) + v
                    if w: V[d] = w; break
        # trim specks: a district's sliver of a county under 3% of its own voters and under 4% of the county's is dropped
        ctot = {}
        for d, w in V.items():
            for f, v in w.items(): ctot[f] = ctot.get(f, 0) + v
        for d, w in V.items():
            tot = sum(w.values()); keep = {f: v for f, v in w.items() if v / tot >= 0.03 or v / ctot[f] >= 0.04}
            V[d] = keep or {max(w, key=w.get): w[max(w, key=w.get)]}
        dcent = {d: sum(cent[f] * v for f, v in w.items()) / sum(w.values()) for d, w in V.items()}
        inC = {}
        for d, w in V.items():
            for f, v in w.items(): inC.setdefault(f, []).append((d, v))
        # districts the returns never placed: first an unclaimed county near their numbered neighbors, else a share of the county they sit in
        orphan = [f for f in county if f not in inC]
        unplaced = [d for d in allD if d not in V]
        reach = 2.5 * math.sqrt(outline.area / max(1, len(allD)))
        for d in sorted(unplaced, key=lambda d: (num(d) or 0, d)):
            n0 = num(d)
            near = [dcent[e] for e in dcent if n0 is not None and num(e) is not None and abs(num(e) - n0) <= 2]
            sd = np.mean(near, 0) if near else np.array(outline.representative_point().coords[0])
            cand = sorted(orphan, key=lambda f: np.linalg.norm(cent[f] - sd))
            if cand and np.linalg.norm(cent[cand[0]] - sd) <= reach:
                f = cand[0]; orphan.remove(f); inC[f] = [(d, 1.0)]; V[d] = {f: 1.0}; dcent[d] = cent[f]; continue
            hit = [f for f, g in county.items() if g.contains(Point(*sd))]
            f = hit[0] if hit else min(county, key=lambda f: np.linalg.norm(cent[f] - sd))
            lst = inC.setdefault(f, [])
            v = float(np.mean([x for _, x in lst])) if lst else 1.0
            lst.append((d, v)); V[d] = {f: v}; dcent[d] = cent[f]
        pieces = {d: [] for d in allD}
        for f in orphan:
            d = min(dcent, key=lambda d: np.linalg.norm(dcent[d] - cent[f])); pieces[d].append(county[f])
        for f, lst in inC.items():
            if len(lst) == 1: pieces[lst[0][0]].append(county[f]); continue
            ids = [d for d, _ in lst]; shares = [v for _, v in lst]
            toward = []
            for d in ids:
                other = {g: v for g, v in V[d].items() if g != f}
                toward.append(sum(cent[g] * v for g, v in other.items()) / sum(other.values()) if other else None)
            cells = split_county(county[f], ids, shares, toward)
            if cells is None:
                big = max(ids, key=lambda d: dict(lst)[d]); pieces[big].append(county[f]); continue
            for d, c in zip(ids, cells):
                if c is not None and not c.is_empty: pieces[d].append(c)
        seed = {}
        geoms = {d: unary_union(p).buffer(0.05).buffer(-0.05) for d, p in pieces.items() if p}
        # any district still without ground gets a small disc at its seed, cut out of its neighbors
        med = np.median([g.area for g in geoms.values()]) if geoms else 100.0
        for d in allD:
            if d in geoms: continue
            s0 = dcent.get(d, np.array(outline.representative_point().coords[0]))
            disc = Point(*s0).buffer(math.sqrt(med / math.pi) * 0.6).intersection(outline)
            for e in list(geoms): geoms[e] = geoms[e].difference(disc)
            geoms[d] = disc
        out, nat = {}, {}
        for d in allD:
            g = geoms.get(d)
            if g is None or g.is_empty: continue
            # drop crumbs, keep the main body
            parts = sorted(polys_of(g), key=lambda p: -p.area)
            parts = [p for p in parts if p.area >= 0.02 * parts[0].area] if parts else []
            g = unary_union(parts).simplify(0.3, preserve_topology=True)
            if g.is_empty: continue
            main = max(polys_of(g), key=lambda p: p.area)
            try: lp = polylabel(main, tolerance=0.5)
            except Exception: lp = main.representative_point()
            gn = affinity.affine_transform(g, [sx * 2, 0, 0, sy * 2, (nb[0] - bx[0] * sx) * 2, (nb[1] - bx[1] * sy) * 2]).simplify(0.6, preserve_topology=True)
            for m in members[d]:
                out[m] = [path_of(g), round(lp.x, 1), round(lp.y, 1)]
                nat[m] = path_of(gn, 0)
        state_out["chambers"][ch["chamber"]] = dict(id=ch["id"], d=out, hold=holdP, located=len(V), total=len(allD), shared={m: base(m) for m in allSeats if base(m) != m})
        US[ch["id"]] = nat
        print(ch["id"], f"{len(V)}/{len(allD)} located", len(out), "drawn", flush=True)
    json.dump(state_out, open(f"{PUB}/statehouse_map/{st}.json", "w"), separators=(",", ":"))
if not ONLY: json.dump(dict(frame=[GEO["frame"][0] * 2, GEO["frame"][1] * 2], chambers=US), open(f"{PUB}/statehouse_map_us.json", "w"), separators=(",", ":"))
print("national", os.path.getsize(f"{PUB}/statehouse_map_us.json") // 1024, "KB")
