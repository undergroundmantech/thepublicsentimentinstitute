"""Targets that set every published race to a run's own numbers: each Senate and governor race to its simulated mean
margin and each county to its county forecast, each House district to its district forecast. The published win odds,
ranges and seat totals then move with the margins through patch_sweep. Written for the Oct 26 2026 full rerun with the
final methodology inside the engine, so the site shows that run rather than the run's change laid on older numbers.
usage: python3 -I rebase_targets.py RUN[,RUN2] OUT.json   (earlier runs win for a race)"""
import json, glob, os, sys
import pandas as pd
RUNS = sys.argv[1].split(","); OUT = sys.argv[2]
P = "/tmp/site/public/forecast"
m = json.load(open(f"{P}/model.json")); C = json.load(open(f"{P}/counties.json"))
R = {}; D = {}
for run in RUNS:
    for f in sorted(glob.glob(f"/tmp/fcrun/runs/{run}/lane*/run_summary.json")):
        for k, v in json.load(open(f))["results"].items():
            if k not in R: R[k] = v; D[k] = os.path.dirname(f)
key_of = lambda r: r["st"] if r["office"] == "senate" else r["st"] + "G"
out = {"statewide": {}, "house": {}}
for r in m["races"]:
    if r["office"] not in ("senate", "governor"): continue
    k = key_of(r)
    if k not in R or abs(r["est"]["margin"]) >= 99.9: continue
    v = R[k]; sim = v.get("simulation") or {}
    tgt = float(sim["margin_mean"]) if sim.get("margin_mean") is not None else float(v["deterministic_margin"] if isinstance(v["deterministic_margin"], (int, float)) else v["deterministic_margin"]["margin"])
    pub = -r["est"]["margin"]
    off = "governor" if r["office"] == "governor" else "senate"
    cf = f"{D[k]}/{v['state'].lower().replace(' ', '_')}_2026_{off}_county_forecast.csv"
    cd = {}
    cc = C.get(r["id"]) or {}
    if os.path.exists(cf) and cc:
        c = pd.read_csv(cf, dtype={"county_fips": str})
        col = "dem_margin" if "dem_margin" in c else ("bloc_margin" if "bloc_margin" in c else None)
        mc = dict(zip(c.county_fips, c[col] if col else c.dem_pct - c.rep_pct))
        for f, row in cc.items():
            if f.startswith("_"): continue
            x = mc.get(f, mc.get(f.lstrip("0"), mc.get(f.zfill(5))))
            if x is not None: cd[f] = float(x) - (-row[0])
        # the county targets carry the run's own county margins; recentre them on the statewide target
        tw = sum(cc[f][3] for f in cd) or 1
        fix = (tgt - pub) - sum(cd[f] * cc[f][3] for f in cd) / tw
        cd = {f: x + fix for f, x in cd.items()}
    out["statewide"][k] = dict(id=r["id"], published_d=pub, target_d=tgt, delta_d=tgt - pub, counties=cd)
H = {}
for run in RUNS:
    for f in glob.glob(f"/tmp/fcrun/runs/{run}/house/*_2026_house_district_forecast.csv"):
        slug = os.path.basename(f).split("_2026_")[0]
        for x in pd.read_csv(f).itertuples(): H.setdefault((slug, int(x.district)), float(x.dem_pct - x.rep_pct))
SLUG = {}
for r in m["races"]:
    if r["office"] == "house": SLUG.setdefault(r["st"], r["state"].lower().replace(" ", "_"))
for r in m["races"]:
    if r["office"] != "house" or abs(r["est"]["margin"]) >= 99.9: continue
    st = r["st"]; dn = int(r["district"]) if r["district"] else 1
    key = (SLUG[st], dn) if (SLUG[st], dn) in H else (SLUG[st], 0)
    if key not in H: continue
    pub = -r["est"]["margin"]
    out["house"][f"{st}-{dn:02d}"] = dict(id=r["id"], slug=key[0], district=key[1], published_d=pub, target_d=H[key], delta_d=H[key] - pub)
json.dump(out, open(OUT, "w"), indent=1)
print("statewide", len(out["statewide"]), "house", len(out["house"]))
